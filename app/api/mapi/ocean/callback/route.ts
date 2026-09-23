import {env} from 'cloudflare:workers';
import {getChatGPTUser} from '@/app/chatgpt-auth';
import {MapiError,friendlyError} from '@/lib/mapi/errors';
import {hash,seal,unseal} from '@/lib/mapi/security';
import {discoverOceanAccounts,exchangeOceanAuthCode,oceanDiscoveryIssue,summarizeOceanAccounts} from '@/lib/mapi/ocean-auth';

export const dynamic='force-dynamic';
function db(){if(!env.DB)throw new MapiError('DATABASE_UNAVAILABLE','数据存储暂不可用。','请管理员检查服务配置。',503);return env.DB;}
function back(req:Request,params:Record<string,string>){const origin=(env as unknown as Record<string,string>).SITE_ORIGIN||new URL(req.url).origin,url=new URL('/',origin);for(const [key,value] of Object.entries(params))url.searchParams.set(key,value);return Response.redirect(url.toString(),302);}

export async function GET(req:Request){
  let appRow:any=null;
  try{
    const user=await getChatGPTUser();if(!user)return back(req,{oauth:'error',code:'SIGN_IN_REQUIRED'});
    const url=new URL(req.url),state=url.searchParams.get('state')||'',authCode=url.searchParams.get('auth_code')||url.searchParams.get('code')||'';
    if(!state||!authCode)throw new MapiError('OCEAN_CALLBACK_INVALID','巨量授权回调缺少必要参数。','请从平台重新发起授权，不要手工拼接回调地址。');
    const stateHash=await hash(state);const row=await db().prepare(`SELECT s.state_hash,s.owner,s.app_config_id,s.grant_id,s.expires_at,s.consumed_at,a.app_id,a.secret,a.id AS app_id_internal FROM oauth_states s JOIN channel_apps a ON a.id=s.app_config_id AND a.owner=s.owner WHERE s.state_hash=? AND s.owner=? AND s.channel='ocean'`).bind(stateHash,user.userId).first<any>();
    if(!row)throw new MapiError('OAUTH_STATE_INVALID','授权状态不存在或不属于当前用户。','请回到平台重新点击“前往巨量官方授权”。',403);appRow=row;
    if(row.consumed_at)throw new MapiError('OAUTH_STATE_USED','这次授权回调已经处理过。','请刷新平台状态；如需重新授权，请重新发起。',409);
    if(Date.parse(row.expires_at)<=Date.now())throw new MapiError('OAUTH_STATE_EXPIRED','授权会话已超过 10 分钟。','请回到平台重新发起授权。',409);
    const consumedAt=new Date().toISOString();const consumed=await db().prepare('UPDATE oauth_states SET consumed_at=? WHERE state_hash=? AND owner=? AND consumed_at IS NULL').bind(consumedAt,stateHash,user.userId).run();if(!consumed.meta.changes)throw new MapiError('OAUTH_STATE_USED','这次授权回调已经处理过。','请刷新平台状态。',409);
    const appSecret=(await unseal(row.secret,`${user.userId}:app:${row.app_config_id}`) as {appSecret?:string}).appSecret;if(!appSecret)throw new MapiError('VAULT_DECRYPT_FAILED','无法读取巨量应用密钥。','请管理员重新保存应用配置。',503);
    const token=await exchangeOceanAuthCode(row.app_id,appSecret,authCode);const discovery=await discoverOceanAccounts(token.accessToken,token.advertiserIds);const grantId=row.grant_id||crypto.randomUUID(),now=new Date().toISOString();const encrypted=await seal({accessToken:token.accessToken,refreshToken:token.refreshToken},`${user.userId}:grant:${grantId}`);const summary=summarizeOceanAccounts(discovery.accounts),grantStatus=summary.accountCount?'active':'needs_attention',issue=oceanDiscoveryIssue(discovery),warning=issue?JSON.stringify(issue):null;
    if(row.grant_id){const existing=await db().prepare('SELECT id FROM oauth_grants WHERE id=? AND owner=? AND app_config_id=?').bind(grantId,user.userId,row.app_config_id).first();if(!existing)throw new MapiError('OAUTH_GRANT_NOT_FOUND','要更新的授权记录不存在。','请重新发起一次全新授权。',404);await db().prepare('UPDATE oauth_grants SET token=?,status=?,access_expires_at=?,refresh_expires_at=?,authorized_at=?,last_refreshed_at=NULL,last_error=?,updated_at=? WHERE id=? AND owner=?').bind(encrypted,grantStatus,token.accessExpiresAt,token.refreshExpiresAt,now,warning,now,grantId,user.userId).run();}
    else await db().prepare('INSERT INTO oauth_grants(id,owner,channel,app_config_id,token,status,access_expires_at,refresh_expires_at,authorized_at,last_error,created_at,updated_at) VALUES(?,?,\'ocean\',?,?,?,?,?,?,?,?,?)').bind(grantId,user.userId,row.app_config_id,encrypted,grantStatus,token.accessExpiresAt,token.refreshExpiresAt,now,warning,now,now).run();
    await db().prepare('DELETE FROM authorized_accounts WHERE grant_id=? AND owner=?').bind(grantId,user.userId).run();
    for(let i=0;i<discovery.accounts.length;i+=40){await db().batch(discovery.accounts.slice(i,i+40).map(account=>db().prepare('INSERT INTO authorized_accounts(id,owner,channel,grant_id,account_id,account_name,account_type,parent_account_id,source,is_valid,selectable,created_at,updated_at) VALUES(?,?,\'ocean\',?,?,?,?,?,?,?,?,?,?)').bind(crypto.randomUUID(),user.userId,grantId,account.accountId,account.accountName,account.accountType,account.parentAccountId,account.source,account.isValid?1:0,account.selectable?1:0,now,now)));}
    await db().batch([db().prepare("UPDATE channel_apps SET status='authorized',last_error=NULL,updated_at=? WHERE id=? AND owner=?").bind(now,row.app_config_id,user.userId),db().prepare('UPDATE connections SET expires_at=?,updated_at=? WHERE auth_grant_id=? AND owner=?').bind(token.refreshExpiresAt,now,grantId,user.userId)]);
    return back(req,{oauth:summary.accountCount?'success':'partial',accounts:String(summary.accountCount),upgraded:String(summary.upgradedAccountCount),legacy:String(summary.legacyAccountCount),managers:String(summary.managerCount)});
  }catch(error){const safe=friendlyError(error);if(appRow?.app_config_id&&appRow?.owner){try{await db().prepare("UPDATE channel_apps SET status='needs_attention',last_error=?,updated_at=? WHERE id=? AND owner=?").bind(JSON.stringify(safe),new Date().toISOString(),appRow.app_config_id,appRow.owner).run();}catch{/* callback still returns a safe status */}}return back(req,{oauth:'error',code:safe.code});}
}
