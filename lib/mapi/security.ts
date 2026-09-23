import {env} from 'cloudflare:workers';
import {MapiError} from './errors';
const encoder=new TextEncoder();
function keyBytes() {
  const value=(env as unknown as Record<string,string>).CREDENTIAL_ENCRYPTION_KEY;
  if(!value || !/^[0-9a-f]{64}$/.test(value)) throw new MapiError('VAULT_NOT_CONFIGURED','凭证保险箱尚未配置。','请管理员配置服务端加密密钥；当前不会保存任何凭证。',503);
  return Uint8Array.from(value.match(/../g)!,x=>parseInt(x,16));
}
export function vaultReady(){try{keyBytes();return true;}catch{return false;}}
function base64(bytes:Uint8Array){return btoa(Array.from(bytes,c=>String.fromCharCode(c)).join(''));}
function unbase64(s:string){return Uint8Array.from(atob(s),c=>c.charCodeAt(0));}
async function key(){return crypto.subtle.importKey('raw',keyBytes(),'AES-GCM',false,['encrypt','decrypt']);}
export async function seal(payload: unknown, context:string){const iv=crypto.getRandomValues(new Uint8Array(12));const ct=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:encoder.encode(context)},await key(),encoder.encode(JSON.stringify(payload)));return JSON.stringify({v:1,iv:base64(iv),data:base64(new Uint8Array(ct))});}
export async function unseal(value:string,context:string){try{const box=JSON.parse(value);const p=await crypto.subtle.decrypt({name:'AES-GCM',iv:unbase64(box.iv),additionalData:encoder.encode(context)},await key(),unbase64(box.data));return JSON.parse(new TextDecoder().decode(p));}catch(e){if(e instanceof MapiError)throw e;throw new MapiError('VAULT_DECRYPT_FAILED','无法读取此授权凭证。','请管理员检查密钥是否被替换；不要重复提交报表。',503);}}
export async function hash(value:string){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(value))),x=>x.toString(16).padStart(2,'0')).join('');}
