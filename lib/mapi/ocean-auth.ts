import {MapiError,friendlyError,mediaJSON} from './errors';
import {requiredString} from './apple';
import {OCEAN_API_ORIGIN} from './ocean-endpoints';

const TOKEN_PATH='/open_api/oauth2/access_token/';
const REFRESH_PATH='/open_api/oauth2/refresh_token/';
const ACCOUNT_PATH='/open_api/oauth2/advertiser/get/';
const EBP_ACCOUNT_PATH='/open_api/2/ebp/advertiser/list/';
const UPGRADED_WORKBENCH_TYPES=new Set([
  'PLATFORM_ROLE_ENTERPRISE_BP_ADMIN',
  'PLATFORM_ROLE_ENTERPRISE_BP_OPERATOR',
  'PLATFORM_ROLE_ENTERPRISE_BP_CUSTOM',
  'PLATFORM_ROLE_GROUP_BP_ADMIN',
  'PLATFORM_ROLE_GROUP_BP_OPERATOR',
]);

export type OceanToken={accessToken:string;refreshToken:string;accessExpiresAt:string|null;refreshExpiresAt:string|null;advertiserIds:string[]};
export type OceanAccount={accountId:string;accountName:string;accountType:string;parentAccountId:string|null;source:string;isValid:boolean;selectable:boolean};
export type OceanDiscovery={accounts:OceanAccount[];warnings:{managerId:string;accountType:string;error:ReturnType<typeof friendlyError>}[]};

function digits(value:unknown,label:string){const text=requiredString(value,label,30);if(!/^\d{1,20}$/.test(text))throw new MapiError('INPUT_INVALID',`${label} 必须是纯数字。`,'请从巨量引擎开发者后台复制，不要填写账户名称。');return text;}
function future(seconds:unknown){const n=Number(seconds);return Number.isFinite(n)&&n>0?new Date(Date.now()+Math.floor(n)*1000).toISOString():null;}
function numericJson(appId:string,fields:Record<string,string>){return `{"app_id":${digits(appId,'App ID')},${Object.entries(fields).map(([key,value])=>`${JSON.stringify(key)}:${JSON.stringify(value)}`).join(',')}}`;}
function parseToken(body:any):OceanToken{
  const data=body?.data;if(!data||typeof data!=='object')throw new MapiError('OCEAN_TOKEN_SCHEMA_CHANGED','巨量未返回 Token 数据。','请开发核对 OAuth 接口响应；不要重复使用同一个 auth_code。',502);
  const accessToken=requiredString(data.access_token,'巨量 Access Token',10000),refreshToken=requiredString(data.refresh_token,'巨量 Refresh Token',10000);
  const advertiserIds=Array.isArray(data.advertiser_ids)?data.advertiser_ids.map((x:unknown)=>String(x)).filter(x=>/^\d+$/.test(x)):[];
  return {accessToken,refreshToken,accessExpiresAt:future(data.expires_in),refreshExpiresAt:future(data.refresh_token_expires_in),advertiserIds};
}

export function validateOceanAuthorizationUrl(value:unknown,appIdValue:unknown){
  const raw=requiredString(value,'官方授权 URL',3000),appId=digits(appIdValue,'App ID');let url:URL;
  try{url=new URL(raw);}catch{throw new MapiError('INPUT_INVALID','官方授权 URL 格式不正确。','请在巨量开发者后台的应用基本信息页复制完整授权 URL。');}
  if(url.protocol!=='https:'||url.hostname!=='open.oceanengine.com'||url.pathname.toLowerCase()!=='/audit/oauth.html')throw new MapiError('OCEAN_AUTH_URL_INVALID','这不是当前巨量后台展示的官方授权地址。','请复制应用管理页“授权 URL”的完整地址；应以 https://open.oceanengine.com/audit/oauth.html 开头。');
  const urlAppId=url.searchParams.get('app_id');if(urlAppId&&urlAppId!==appId)throw new MapiError('OCEAN_APP_ID_MISMATCH','授权 URL 中的 App ID 与表单不一致。','请复制同一个应用的 App ID、Secret 和授权 URL。');
  return {url:url.toString(),scopes:url.searchParams.getAll('scope')};
}

export function validateOceanRedirectUri(value:unknown){
  const raw=requiredString(value,'授权回调地址',2000);let url:URL;
  try{url=new URL(raw);}catch{throw new MapiError('OCEAN_REDIRECT_URI_INVALID','授权回调地址格式不正确。','请填写完整的 HTTPS 地址，例如 https://你的域名/api/mapi/ocean/callback。');}
  if(url.protocol!=='https:'||!url.hostname||url.username||url.password||url.hash)throw new MapiError('OCEAN_REDIRECT_URI_INVALID','授权回调地址必须是安全的 HTTPS 地址。','不要包含账号密码或 # 片段；请使用可公开访问并已登记到巨量应用中的 HTTPS 地址。');
  if(url.searchParams.has('auth_code')||url.searchParams.has('state'))throw new MapiError('OCEAN_REDIRECT_URI_INVALID','授权回调地址不能预先包含 auth_code 或 state。','这些参数由巨量在授权完成后自动追加。');
  return url.toString();
}

export function buildOceanAuthorizationUrl(raw:string,appId:string,redirectUri:string,state:string,materialAuth:boolean){
  const url=new URL(raw);url.searchParams.set('app_id',digits(appId,'App ID'));url.searchParams.set('state',state);url.searchParams.set('redirect_uri',redirectUri);url.searchParams.set('material_auth',materialAuth?'1':'0');return url.toString();
}

export async function exchangeOceanAuthCode(appId:string,secret:string,authCode:string){
  const code=requiredString(authCode,'auth_code',2000);const response=await mediaJSON(OCEAN_API_ORIGIN+TOKEN_PATH,{method:'POST',headers:{'Content-Type':'application/json'},body:numericJson(appId,{secret,auth_code:code})},[secret,code]);return parseToken(response.body);
}
export async function refreshOceanAccess(appId:string,secret:string,refreshToken:string){
  const token=requiredString(refreshToken,'Refresh Token',10000);const response=await mediaJSON(OCEAN_API_ORIGIN+REFRESH_PATH,{method:'POST',headers:{'Content-Type':'application/json'},body:numericJson(appId,{secret,refresh_token:token})},[secret,token]);return parseToken(response.body);
}

function normalizeId(value:unknown){const id=String(value??'');return /^\d{1,20}$/.test(id)?id:null;}
export function isOceanUpgradedWorkbenchType(value:string){return UPGRADED_WORKBENCH_TYPES.has(value);}
export function summarizeOceanAccounts(accounts:OceanAccount[]){const selectable=accounts.filter(x=>x.selectable&&x.isValid);return {accountCount:selectable.length,upgradedAccountCount:selectable.filter(x=>x.source==='ebp/advertiser/list').length,legacyAccountCount:selectable.filter(x=>x.source==='customer_center/account/list').length,directAccountCount:selectable.filter(x=>x.source!=='ebp/advertiser/list'&&x.source!=='customer_center/account/list').length,managerCount:accounts.filter(x=>!x.selectable).length,upgradedManagerCount:accounts.filter(x=>!x.selectable&&isOceanUpgradedWorkbenchType(x.accountType)).length};}
export function oceanDiscoveryIssue(discovery:OceanDiscovery){const summary=summarizeOceanAccounts(discovery.accounts);if(discovery.warnings.length){const first=discovery.warnings[0].error;return {code:first.code,message:`有 ${discovery.warnings.length} 个授权管理主体未能展开：${first.message}`,action:first.action,details:discovery.warnings};}if(!summary.accountCount)return {code:'NO_ADVERTISER_ACCOUNT',message:'授权成功，但没有发现可用于巨量广告报表的广告账户。',action:'请重新授权并在巨量官方页面勾选广告账户，或勾选旧版 / 升级版工作台管理主体。'};return null;}
function unique(accounts:OceanAccount[]){const map=new Map<string,OceanAccount>();for(const item of accounts){const current=map.get(item.accountId),preferSelectable=current&&!current.selectable&&item.selectable,preferUpgraded=current?.source!=='ebp/advertiser/list'&&item.source==='ebp/advertiser/list';if(!current||preferSelectable||(current.selectable===item.selectable&&preferUpgraded))map.set(item.accountId,item);}return [...map.values()];}
async function expandWorkbench(token:string,managerId:string){const out:OceanAccount[]=[];
  for(let page=1;page<=20;page++){const url=new URL(OCEAN_API_ORIGIN+'/open_api/v3.0/customer_center/account/list/');url.searchParams.set('account_id',managerId);url.searchParams.set('filter',JSON.stringify({account_type:'AD'}));url.searchParams.set('page',String(page));url.searchParams.set('page_size','100');const response=await mediaJSON(url.toString(),{headers:{'Access-Token':token}},[token]);const rows=response.body?.data?.accounts;if(!Array.isArray(rows))throw new MapiError('OCEAN_ACCOUNT_SCHEMA_CHANGED','巨量工作台账户列表结构无法识别。','请开发核对 customer_center/account/list 接口。',502);for(const row of rows){const id=normalizeId(row?.account_id);if(id)out.push({accountId:id,accountName:String(row?.account_name||`广告账户 ${id}`).slice(0,160),accountType:String(row?.account_type||'AD'),parentAccountId:managerId,source:'customer_center/account/list',isValid:true,selectable:true});}const totalPage=Number(response.body?.data?.page_info?.total_page);if(rows.length<100||(Number.isFinite(totalPage)&&page>=totalPage))return out;}
  throw new MapiError('OCEAN_ACCOUNT_LIMIT_REACHED','该工作台管理的广告账户超过当前同步上限。','请开发改为离线分页同步；当前不把不完整账户列表当成成功。',413);
}
async function expandAgent(token:string,managerId:string){const out:OceanAccount[]=[];
  for(let page=1;page<=20;page++){const url=new URL(OCEAN_API_ORIGIN+'/open_api/2/agent/advertiser/select/');url.searchParams.set('advertiser_id',managerId);url.searchParams.set('page',String(page));url.searchParams.set('page_size','100');const response=await mediaJSON(url.toString(),{headers:{'Access-Token':token}},[token]);const rows=response.body?.data?.advertiser_ids||response.body?.data?.list;if(!Array.isArray(rows))throw new MapiError('OCEAN_ACCOUNT_SCHEMA_CHANGED','巨量代理商账户列表结构无法识别。','请开发核对 agent/advertiser/select 接口。',502);for(const value of rows){const id=normalizeId(value);if(id)out.push({accountId:id,accountName:`广告账户 ${id}`,accountType:'AD',parentAccountId:managerId,source:'agent/advertiser/select',isValid:true,selectable:true});}const totalPage=Number(response.body?.data?.page_info?.total_page);if(rows.length<100||(Number.isFinite(totalPage)&&page>=totalPage))return out;}
  throw new MapiError('OCEAN_ACCOUNT_LIMIT_REACHED','该代理商管理的广告账户超过当前同步上限。','请开发改为离线分页同步；当前不把不完整账户列表当成成功。',413);
}
async function expandMajordomo(token:string,managerId:string){const url=new URL(OCEAN_API_ORIGIN+'/open_api/2/majordomo/advertiser/select/');url.searchParams.set('advertiser_id',managerId);const response=await mediaJSON(url.toString(),{headers:{'Access-Token':token}},[token]);const rows=response.body?.data?.list;if(!Array.isArray(rows))throw new MapiError('OCEAN_ACCOUNT_SCHEMA_CHANGED','巨量纵横组织账户列表结构无法识别。','请开发核对 majordomo/advertiser/select 接口。',502);return rows.flatMap((row:any)=>{const id=normalizeId(row?.advertiser_id);return id?[{accountId:id,accountName:String(row?.advertiser_name||`广告账户 ${id}`).slice(0,160),accountType:'AD',parentAccountId:managerId,source:'majordomo/advertiser/select',isValid:true,selectable:true} as OceanAccount]:[];});}
async function expandUpgradedWorkbench(token:string,organizationId:string){const out:OceanAccount[]=[];
  for(let page=1;page<=100;page++){const url=new URL(OCEAN_API_ORIGIN+EBP_ACCOUNT_PATH);url.searchParams.set('enterprise_organization_id',organizationId);url.searchParams.set('account_source','AD');url.searchParams.set('page',String(page));url.searchParams.set('page_size','100');const response=await mediaJSON(url.toString(),{headers:{'Access-Token':token}},[token]);const rows=response.body?.data?.account_list;if(!Array.isArray(rows))throw new MapiError('OCEAN_UPGRADED_ACCOUNT_SCHEMA_CHANGED','巨量升级版工作台账户列表结构无法识别。','请开发核对 ebp/advertiser/list 接口；平台不会把旧版列表冒充升级版账户。',502);for(const row of rows){const id=normalizeId(row?.account_id);if(!id)continue;const type=String(row?.account_type||'UNKNOWN');out.push({accountId:id,accountName:String(row?.account_name||`广告账户 ${id}`).slice(0,160),accountType:type,parentAccountId:organizationId,source:'ebp/advertiser/list',isValid:true,selectable:type==='AD_NORMAL'});}const totalPage=Number(response.body?.data?.page_info?.total_page);if(rows.length<100||(Number.isFinite(totalPage)&&page>=totalPage))return out;}
  throw new MapiError('OCEAN_UPGRADED_ACCOUNT_LIMIT_REACHED','升级版工作台直接挂接的广告账户超过 1 万个。','请开发切换巨量官方异步账户任务接口；当前不会把不完整列表当成成功。',413);
}

export async function discoverOceanAccounts(accessToken:string,fallbackIds:string[]=[]):Promise<OceanDiscovery>{
  const url=new URL(OCEAN_API_ORIGIN+ACCOUNT_PATH);url.searchParams.set('access_token',accessToken);const response=await mediaJSON(url.toString(),{},[accessToken]);const list=response.body?.data?.list;if(!Array.isArray(list))throw new MapiError('OCEAN_ACCOUNT_SCHEMA_CHANGED','巨量未返回已授权账户列表。','请确认应用具有账户授权查询权限，并重新授权。',502);
  const accounts:OceanAccount[]=[],warnings:{managerId:string;accountType:string;error:ReturnType<typeof friendlyError>}[]=[];
  for(const row of list){const id=normalizeId(row?.account_id??row?.advertiser_id);if(!id)continue;const type=String(row?.account_type||row?.account_role||'UNKNOWN'),valid=row?.is_valid!==false,name=String(row?.account_name||row?.advertiser_name||`${type} ${id}`).slice(0,160);accounts.push({accountId:id,accountName:name,accountType:type,parentAccountId:null,source:'oauth2/advertiser/get',isValid:valid,selectable:valid&&type==='ADVERTISER'});if(!valid||type==='ADVERTISER')continue;
    try{if(type==='CUSTOMER_ADMIN'||type==='CUSTOMER_OPERATOR')accounts.push(...await expandWorkbench(accessToken,id));else if(isOceanUpgradedWorkbenchType(type))accounts.push(...await expandUpgradedWorkbench(accessToken,id));else if(type==='AGENT'||type==='CHILD_AGENT')accounts.push(...await expandAgent(accessToken,id));else if(type==='AGENT_SYSTEM_ACCOUNT')accounts.push(...await expandMajordomo(accessToken,id));}
    catch(error){warnings.push({managerId:id,accountType:type,error:friendlyError(error)});}
  }
  for(const id of fallbackIds){if(/^\d+$/.test(id))accounts.push({accountId:id,accountName:`广告账户 ${id}`,accountType:'ADVERTISER',parentAccountId:null,source:'access_token.advertiser_ids',isValid:true,selectable:true});}
  return {accounts:unique(accounts),warnings};
}
