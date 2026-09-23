import {MapiError,mediaJSON} from './errors';
export type ReportRow={entityId:string;name:string;date:string;impressions:number|null;clicks:number|null;spend:string|null;currency:string|null;conversions:number|null;raw:Record<string,unknown>};
export type PullRequest={account:string;day:string;dimension:string;parent:string;oceanSelection?:{dataTopic:string;dimensions:string[];metrics:string[]}};
export type PullResult={rows:ReportRow[];requests:number;evidence:Record<string,unknown>;accountName:string};
export function addMoney(a:string,b:string){const [ai,af='']=a.split('.'),[bi,bf='']=b.split('.');const scale=Math.max(af.length,bf.length);const total=BigInt(ai+af.padEnd(scale,'0'))+BigInt(bi+bf.padEnd(scale,'0'));const s=total.toString().padStart(scale+1,'0');return scale?s.slice(0,-scale)+'.'+s.slice(-scale):s;}
export function aggregateAccount(rows:ReportRow[],p:PullRequest):ReportRow[]{
 const groups=new Map<string,ReportRow[]>();
 for(const row of rows){if(row.spend!==null&&!row.currency)throw new MapiError('CURRENCY_MISSING','金额缺少币种，不能汇总账户数据。','请开发核对响应；不合并不同币种。',502);const k=row.currency||'未返回币种';groups.set(k,[...(groups.get(k)||[]),row]);}
 return Array.from(groups,([currency,items])=>{const sum=(field:'impressions'|'clicks'|'conversions')=>items.some(r=>r[field]===null)?null:items.reduce((a,r)=>a+(r[field]||0),0);const spend=items.some(r=>r.spend===null)?null:items.reduce((a,r)=>addMoney(a,r.spend!),'0');return {entityId:p.account+':'+currency,name:'账户汇总 · '+p.account,date:p.day,impressions:sum('impressions'),clicks:sum('clicks'),conversions:sum('conversions'),spend,currency:currency==='未返回币种'?null:currency,raw:{source:'完整计划报表按币种求和',campaignCount:items.length,campaignIds:items.map(r=>r.entityId)}};});
}
export function requiredString(value:unknown,label:string,max=10000){if(typeof value!=='string'||!value.trim()||value.length>max)throw new MapiError('INPUT_INVALID',`${label} 缺失或格式不正确。`,'请检查并重新填写。');return value.trim();}
export function numericId(value:unknown,label:string){const v=requiredString(value,label,30);if(!/^\d{1,20}$/.test(v))throw new MapiError('INPUT_INVALID',`${label} 应为数字 ID。`,'请填写媒体后台的 ID，不是账户名称。');return v;}
export function parseAppleSecret(s:Record<string,unknown>){const clientId=requiredString(s.clientId,'Client ID',200),clientSecret=requiredString(s.clientSecret,'Client Secret',10000);if(!clientId.startsWith('SEARCHADS.')||clientSecret.split('.').length!==3)throw new MapiError('INPUT_INVALID','请提供 Apple Ads Client ID 和已签名的 Client Secret JWT。','查看本页授权步骤，请勿填写 Apple ID 密码。');let expiresAt:string|null=null;try{const p=JSON.parse(atob(clientSecret.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));if(typeof p.exp==='number'&&p.exp>0&&p.exp<1e12)expiresAt=new Date(p.exp*1000).toISOString();}catch{}return {secret:{clientId,clientSecret},expiresAt};}
function numberOrNull(x:unknown){if(x===undefined||x===null)return null;const n=Number(x);if(!Number.isFinite(n)||n<0)throw new MapiError('REPORT_SCHEMA_CHANGED','媒体返回了不可识别的数值。','请开发核对字段；未覆盖任何正式数据。',502);return n;}
export function normalizeAppleRows(rows:any[],p:PullRequest):ReportRow[]{return rows.map(r=>{const m=r.metadata,t=r.total;if(!m||!t||typeof t!=='object')throw new MapiError('REPORT_SCHEMA_CHANGED','媒体报表缺少 metadata 或 total。','请开发核对 API 版本和响应结构。',502);const entityId=p.dimension==='campaign'?m.campaignId:p.dimension==='adgroup'?m.adGroupId:m.adId;if(entityId===undefined||entityId===null||(typeof entityId==='number'&&!Number.isSafeInteger(entityId)))throw new MapiError('REPORT_SCHEMA_CHANGED','报表缺少维度 ID，无法安全去重。','保留原数据，请开发检查字段映射。',502);const amount=t.localSpend?.amount,currency=t.localSpend?.currency;if(amount!==undefined&&!/^\d+(\.\d+)?$/.test(String(amount)))throw new MapiError('REPORT_SCHEMA_CHANGED','媒体金额不是有效的小数。','请检查原始报表。',502);return {entityId:String(entityId),name:String((p.dimension==='campaign'?m.campaignName:p.dimension==='adgroup'?m.adGroupName:m.adName)||entityId),date:p.day,impressions:numberOrNull(t.impressions),clicks:numberOrNull(t.taps),spend:amount===undefined?null:String(amount),currency:currency?String(currency):null,conversions:numberOrNull(t.totalInstalls),raw:{metadata:m,metrics:t}};});}
export async function pullApple(secret:{clientId:string;clientSecret:string},p:PullRequest):Promise<PullResult>{
  const values=[secret.clientId,secret.clientSecret];let requests=0;
  const auth=await mediaJSON('https://appleid.apple.com/auth/oauth2/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'client_credentials',scope:'searchadsorg',client_id:secret.clientId,client_secret:secret.clientSecret})},values);requests++;
  if(typeof auth.body.access_token!=='string')throw new MapiError('MEDIA_RESPONSE_INVALID','鉴权接口未返回 Access Token。','检查 Client Secret 与 API 用户权限。',502);
  values.push(auth.body.access_token);
  const headers={'Authorization':`Bearer ${auth.body.access_token}`,'Content-Type':'application/json','X-AP-Context':`orgId=${p.account}`};
  const acl=await mediaJSON('https://api.searchads.apple.com/api/v5/acls',{headers:{Authorization:headers.Authorization}},values);requests++;
  const acls=Array.isArray(acl.body.data)?acl.body.data:acl.body.data?[acl.body.data]:[];
  const account=acls.find((a:any)=>String(a.orgId)===p.account);
  if(!account)throw new MapiError('ACCOUNT_NOT_AUTHORIZED','Token 有效，但所填组织不在授权列表中。','核对 Organization ID，并请管理员为此 API 用户授予该 Campaign Group 的访问权限。',403);
  const endpoint=(p.dimension==='campaign'||p.dimension==='account')?'https://api.searchads.apple.com/api/v5/reports/campaigns':`https://api.searchads.apple.com/api/v5/reports/campaigns/${numericId(p.parent,'Campaign ID')}/${p.dimension==='adgroup'?'adgroups':'ads'}`;
  const orderField=(p.dimension==='campaign'||p.dimension==='account')?'campaignId':p.dimension==='adgroup'?'adGroupId':'adId';
  const rows:ReportRow[]=[];const requestIds:string[]=[];
  for(let page=0;page<20;page++){
    const response=await mediaJSON(endpoint,{method:'POST',headers,body:JSON.stringify({startTime:p.day,endTime:p.day,timeZone:'UTC',returnRecordsWithNoMetrics:false,returnRowTotals:true,returnGrandTotals:false,selector:{orderBy:[{field:orderField,sortOrder:'ASCENDING'}],pagination:{offset:page*500,limit:500}}})},values);requests++;
    if(response.requestId)requestIds.push(String(response.requestId));
    const report=response.body.data?.reportingDataResponse||response.body.reportingDataResponse||response.body.data||response.body;
    if(!Array.isArray(report.row))throw new MapiError('REPORT_SCHEMA_CHANGED','媒体响应缺少报表行，不能将其当作零数据。','请开发核对响应结构，原数据未改变。',502);
    rows.push(...normalizeAppleRows(report.row,{...p,dimension:p.dimension==='account'?'campaign':p.dimension}));
    if(report.row.length<500){const ids=new Set(rows.map(r=>r.entityId));if(ids.size!==rows.length)throw new MapiError('DUPLICATE_SOURCE_ROWS','同一报表出现重复维度 ID。','媒体数据可能在分页期间变动，请重试；当前不会覆盖正式数据。',409);return {rows:p.dimension==='account'?aggregateAccount(rows,p):rows,requests,accountName:account.orgName||account.displayName||p.account,evidence:{provider:'Apple Ads',apiVersion:'v5',method:'POST',endpoint,requestIds,timezone:'UTC',accountId:p.account,date:p.day,dimension:p.dimension,parent:p.parent,paginationComplete:true,accountAggregation:p.dimension==='account'?'账户数据按完整计划报表分币种求和，不是独立账户接口':null,conversionDefinition:'totalInstalls（媒体归因安装，不是激活/注册/付费）',verifiedAt:new Date().toISOString()}};}
  }
  throw new MapiError('REPORT_LIMIT_REACHED','报表超过本版每次 10,000 行的安全上限。','请按计划拆分；本次不把部分数据写入正式报表。',413);
}
