'use client';
import {useEffect,useMemo,useRef,useState} from 'react';
import {ArrowRight,CheckCircle2,ChevronDown,ExternalLink,KeyRound,RefreshCw,Search,ShieldCheck,Users} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Combobox,ComboboxContent,ComboboxEmpty,ComboboxInput,ComboboxItem,ComboboxList} from '@/components/ui/combobox';
import {Input} from '@/components/ui/input';
import {Label} from '@/components/ui/label';
import {Select,SelectContent,SelectItem,SelectTrigger,SelectValue} from '@/components/ui/select';

const OCEAN_INTERNAL_PRODUCT='未区分产品';
const dimensions=[{id:'account',label:'账户汇总'},{id:'campaign',label:'项目 / 计划'},{id:'ad',label:'广告'},{id:'material',label:'素材'}];
const yesterday=()=>new Date(Date.now()-86400000).toISOString().slice(0,10);
const when=(value:string|null|undefined)=>value?new Date(value).toLocaleString('zh-CN',{hour12:false}):'媒体未返回';
function Choice({value,onChange,options,label,disabled=false}:{value:string;onChange:(x:string)=>void;options:{id:string;label:string}[];label:string;disabled?:boolean}){return <Select value={value} onValueChange={onChange} disabled={disabled}><SelectTrigger aria-label={label} className="control"><SelectValue placeholder={label}/></SelectTrigger><SelectContent>{options.map(x=><SelectItem key={x.id} value={x.id}>{x.label}</SelectItem>)}</SelectContent></Select>;}
type AccountOption={id:string;name:string;label:string;sourceLabel:string};
const sourceLabel=(source:string)=>source==='ebp/advertiser/list'?'升级版工作台':source==='customer_center/account/list'?'旧版工作台':'单账户授权';
const managerLabel=(type:string)=>type.startsWith('PLATFORM_ROLE_ENTERPRISE_BP_')||type.startsWith('PLATFORM_ROLE_GROUP_BP_')?'升级版工作台':type.startsWith('CUSTOMER_')?'旧版工作台':type;
type FieldOption={id:string;label:string;description?:string;exclusionDimensions?:string[];exclusionMetrics?:string[]};
type TopicOption={id:string;label:string;dimensions:FieldOption[];metrics:FieldOption[]};
const topicPreference=(dimension:string)=>dimension==='material'?['UNI_PROJECT_MATERIAL_DATA','STD_MATERIAL_DATA','MATERIAL_DATA']:['BASIC_DATA','STD_BASIC_DATA','UNI_PROJECT_DATA'];
const dimensionPairs:Record<string,[string,string][]>= {
 material:[['material_adjustment_id','material_adjustment_name'],['material_id','material_name'],['creative_id','creative_name'],['image_id','image_name'],['video_id','video_name']],
 ad:[['cdp_promotion_id','cdp_promotion_name'],['promotion_id','promotion_name'],['ad_id','ad_name']],
 campaign:[['cdp_project_id','cdp_project_name'],['project_id','project_name'],['campaign_id','campaign_name']],
 account:[['cdp_project_id','cdp_project_name'],['project_id','project_name'],['campaign_id','campaign_name']],
};
const metricPreference=[['show','show_cnt','impression','impressions','all_show_cnt_trend'],['click','click_cnt','valid_click','all_click_cnt_trend'],['stat_cost','cost','all_stat_cost_trend'],['convert','convert_cnt','conversion','conversion_count','all_convert_cnt_trend']];
function compatible(topic:TopicOption,dimensions:string[],metrics:string[]){
 for(const id of dimensions){const item=topic.dimensions.find(x=>x.id===id);if(!item||item.exclusionDimensions?.some(x=>dimensions.includes(x))||item.exclusionMetrics?.some(x=>metrics.includes(x)))return false;}
 for(const id of metrics){const item=topic.metrics.find(x=>x.id===id);if(!item||item.exclusionDimensions?.some(x=>dimensions.includes(x)))return false;}
 return true;
}
function suggestedFields(topic:TopicOption,dimension:string){
 const dimIds=new Set(topic.dimensions.map(x=>x.id)),metricIds=new Set(topic.metrics.map(x=>x.id));
 const pairs=dimensionPairs[dimension]||[];
 const matched=pairs.find(([id,name])=>dimIds.has(id)&&dimIds.has(name));
 const fallbackId=pairs.map(([id])=>id).find(id=>dimIds.has(id))||topic.dimensions.find(x=>/(^|_)id$/.test(x.id))?.id||topic.dimensions[0]?.id;
 const dimensions=(matched?[matched[0],matched[1]]:[fallbackId]).filter((x):x is string=>!!x);
 const metrics:string[]=[];
 for(const group of metricPreference){const next=group.find(id=>metricIds.has(id)&&compatible(topic,dimensions,[...metrics,id]));if(next)metrics.push(next);}
 return {dimensions,metrics,hasName:!!matched};
}
function rankedTopics(items:TopicOption[],dimension:string){
 const preference=topicPreference(dimension);
 return [...items].sort((a,b)=>{
  const left=suggestedFields(a,dimension),right=suggestedFields(b,dimension);
  const score=(topic:TopicOption,fields:ReturnType<typeof suggestedFields>)=>{const index=preference.indexOf(topic.id);return (fields.hasName?2000:0)+(fields.metrics.length===4?1000:fields.metrics.length*100)+(index<0?0:preference.length-index);};
  return score(b,right)-score(a,left);
 });
}
function AccountPicker({value,onChange,options,disabled=false}:{value:string;onChange:(x:string)=>void;options:AccountOption[];disabled?:boolean}){
 const selected=options.find(x=>x.id===value)||null;
 return <Combobox<AccountOption>
  items={options}
  value={selected}
  onValueChange={next=>onChange(next?.id||'')}
  itemToStringLabel={item=>item.label}
  itemToStringValue={item=>item.id}
  isItemEqualToValue={(a,b)=>a.id===b.id}
  filter={(item,query)=>{const q=query.trim().toLocaleLowerCase();return !q||item.id.includes(q)||item.name.toLocaleLowerCase().includes(q);}}
  autoHighlight="always"
  limit={50}
  disabled={disabled}
  required
 >
  <ComboboxInput className="control account-combobox" aria-label="搜索并选择授权广告账户" placeholder={`输入账户 ID 或名称搜索（共 ${options.length} 个）`}/>
  <ComboboxContent className="account-combobox-menu">
   <ComboboxEmpty>没有匹配的授权广告账户</ComboboxEmpty>
   <ComboboxList>{(item:AccountOption)=><ComboboxItem key={item.id} value={item} className="account-combobox-item"><span className="account-id">{item.id}</span><span className="account-name">{item.name}</span><span className={'account-source '+(item.sourceLabel==='升级版工作台'?'upgraded':'')}>{item.sourceLabel}</span></ComboboxItem>}</ComboboxList>
  </ComboboxContent>
 </Combobox>;
}
function FieldPicker({label,items,value,onChange,placeholder,emptyMessage='没有匹配字段'}:{label:string;items:FieldOption[];value:string[];onChange:(next:string[])=>void;placeholder:string;emptyMessage?:string}){
 const [query,setQuery]=useState('');const shown=items.filter(x=>(x.label+' '+x.id+' '+(x.description||'')).toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
 return <details className="field-picker"><summary><span>{value.length?`已选择 ${value.length} 项：${items.filter(x=>value.includes(x.id)).map(x=>x.label).join('、')}`:placeholder}</span><ChevronDown size={17}/></summary><div className="field-picker-pop"><div className="field-search"><Search size={16}/><input aria-label={`搜索${label}`} value={query} onChange={e=>setQuery(e.target.value)} placeholder={`搜索${label}名称`}/></div><div className="field-options">{!shown.length?<span className="empty-option">{query.trim()&&items.length?'没有匹配当前关键词的字段':emptyMessage}</span>:shown.map(item=><label key={item.id}><input type="checkbox" checked={value.includes(item.id)} onChange={e=>onChange(e.target.checked?[...value,item.id]:value.filter(x=>x!==item.id))}/><span><strong>{item.label}</strong>{item.description&&<small>{item.description}</small>}</span></label>)}</div></div></details>;
}

type Props={data:any;busy:string;rpc:(input:any)=>Promise<any>;reload:()=>Promise<void>;setBusy:(x:string)=>void;setError:(x:any)=>void;setMessage:(x:string)=>void;setResult:(x:any)=>void;setSelected:(x:string)=>void;startAuth:(appId:string,grantId?:string)=>Promise<void>;syncAccounts:(grantId:string)=>Promise<void>};
export default function OceanConnect({data,busy,rpc,reload,setBusy,setError,setMessage,setResult,setSelected,startAuth,syncAccounts}:Props){
 const app=data?.oceanApps?.[0],grants=data?.oceanGrants||[];
 const [hydrated,setHydrated]=useState(''),[appName,setAppName]=useState('MAPI 数据接入'),[appType,setAppType]=useState('self_client'),[appId,setAppId]=useState(''),[appSecret,setAppSecret]=useState(''),[authorizationUrl,setAuthorizationUrl]=useState(''),[materialAuth,setMaterialAuth]=useState(false),[redirectUri,setRedirectUri]=useState(''),[callbackSuggestion,setCallbackSuggestion]=useState('/api/mapi/ocean/callback');
 const [grantId,setGrantId]=useState(''),[account,setAccount]=useState(''),[name,setName]=useState(''),[day,setDay]=useState(yesterday),[dimension,setDimension]=useState('campaign');
 const [topics,setTopics]=useState<TopicOption[]>([]),[topicId,setTopicId]=useState(''),[selectedDimensions,setSelectedDimensions]=useState<string[]>([]),[selectedMetrics,setSelectedMetrics]=useState<string[]>([]),[fieldsBusy,setFieldsBusy]=useState(false),[fieldsError,setFieldsError]=useState(''),[testedId,setTestedId]=useState('');
 const loadedFieldsKey=useRef('');
 const [startDate,setStartDate]=useState(''),[endDate,setEndDate]=useState(''),[warehouseName,setWarehouseName]=useState(''),[warehouseUrl,setWarehouseUrl]=useState(''),[warehouseToken,setWarehouseToken]=useState('');
 const [manualAccount,setManualAccount]=useState(''),[manualToken,setManualToken]=useState(''),[manualName,setManualName]=useState('');
 useEffect(()=>{if(app&&app.id!==hydrated){setHydrated(app.id);setAppName(app.app_name);setAppType(app.app_type);setAppId(app.app_id);setMaterialAuth(!!app.material_auth);setRedirectUri(app.redirect_uri||'');setAppSecret('');setAuthorizationUrl('');}},[app,hydrated]);
 useEffect(()=>{const suggested=window.location.origin+'/api/mapi/ocean/callback';setCallbackSuggestion(suggested);setRedirectUri(current=>current||suggested);},[]);
 useEffect(()=>{if(!grantId&&grants[0])setGrantId(grants[0].id);},[grants,grantId]);
 const grant=grants.find((x:any)=>x.id===grantId)||grants[0];
 const accounts=useMemo(()=>data?.oceanAccounts?.filter((x:any)=>x.grant_id===(grant?.id||grantId)&&x.selectable&&x.is_valid)||[],[data,grant,grantId]);
 const accountOptions=useMemo<AccountOption[]>(()=>accounts.map((x:any)=>({id:String(x.account_id),name:String(x.account_name||x.account_id),sourceLabel:sourceLabel(String(x.source||'')),label:`${x.account_id} · ${x.account_name||x.account_id} · ${sourceLabel(String(x.source||''))}`})).sort((a:AccountOption,b:AccountOption)=>a.id.localeCompare(b.id,'zh-CN',{numeric:true})),[accounts]);
 const managers=useMemo(()=>data?.oceanAccounts?.filter((x:any)=>x.grant_id===(grant?.id||grantId)&&!x.selectable)||[],[data,grant,grantId]);
 const topic=topics.find(x=>x.id===topicId)||null;
 const topicLabel=topic?.label||'请先选择账户';
 const selectedDimensionLabels=dimension==='account'?['账户 ID','账户名称']:selectedDimensions.map(id=>topic?.dimensions.find(x=>x.id===id)?.label).filter(Boolean);
 const selectedMetricLabels=selectedMetrics.map(id=>topic?.metrics.find(x=>x.id===id)?.label).filter(Boolean);
 useEffect(()=>{if(!grant||busy||Number(grant.upgraded_manager_count)===0||Number(grant.upgraded_account_count)>0)return;const key=`ocean-upgraded-account-sync:${grant.id}`;if(sessionStorage.getItem(key))return;sessionStorage.setItem(key,'1');void syncAccounts(grant.id);},[grant,busy,syncAccounts]);
 useEffect(()=>{if(account&&!accounts.some((x:any)=>String(x.account_id)===account))setAccount('');},[accounts,account]);
 function defaults(next:TopicOption){const suggested=suggestedFields(next,dimension);setSelectedDimensions(suggested.dimensions);setSelectedMetrics(suggested.metrics);}
 function updateDimensions(value:string[]){
  const next=new Set(value),added=value.find(id=>!selectedDimensions.includes(id)),removed=selectedDimensions.find(id=>!value.includes(id));
  for(const [id,name] of dimensionPairs[dimension]||[]){if(added===name&&topic?.dimensions.some(x=>x.id===id))next.add(id);if(removed===id)next.delete(name);}
  setSelectedDimensions([...next]);setTestedId('');
 }
 async function loadFields(nextAccount:string,nextDimension=dimension){if(!grant||!nextAccount)return;setFieldsBusy(true);setFieldsError('');setTopics([]);setTopicId('');setSelectedDimensions([]);setSelectedMetrics([]);setTestedId('');try{const r=await rpc({action:'ocean_report_options',grantId:grant.id,account:nextAccount});const available:TopicOption[]=r.topics||[];if(!available.length)throw new Error('媒体没有返回可用的数据主题、维度和指标，请确认该账户的自定义报表权限后重试。');setTopics(available);const chosen=rankedTopics(available,nextDimension)[0];if(chosen){const suggested=suggestedFields(chosen,nextDimension);setTopicId(chosen.id);setSelectedDimensions(suggested.dimensions);setSelectedMetrics(suggested.metrics);}}catch(error){const message=error instanceof Error?error.message:'读取媒体字段失败';setFieldsError(message);setError(error);}finally{setFieldsBusy(false);}}
 useEffect(()=>{if(!grant?.id||!account)return;const key=`${grant.id}:${account}:${dimension}`;if(loadedFieldsKey.current===key)return;loadedFieldsKey.current=key;void loadFields(account,dimension);},[grant?.id,account,dimension]);
 function retryFields(){if(!grant?.id||!account)return;loadedFieldsKey.current='';void loadFields(account,dimension);}
 async function saveApp(e:React.FormEvent){e.preventDefault();setBusy('正在加密保存巨量应用配置…');setError(null);setMessage('');try{const r=await rpc({action:'save_ocean_app',id:app?.id,appName,appType,appId,appSecret,authorizationUrl,redirectUri,materialAuth});setMessage(r.message);setAppSecret('');setAuthorizationUrl('');await reload();}catch(error){setError(error);}finally{setBusy('');}}
 async function attachAndTest(e:React.FormEvent){e.preventDefault();if(!grant||!account||!topicId)return;setBusy('正在按自选字段请求真实报表…');setError(null);setMessage('');setResult(null);setTestedId('');try{const linked=await rpc({action:'attach_ocean_account',grantId:grant.id,account,name});setSelected(linked.id);let activeTopic=topicId,activeDimensions=selectedDimensions,activeMetrics=selectedMetrics,fallbackUsed=false;let pulled=await rpc({action:'pull',id:linked.id,day,dimension,parent:'',dataTopic:activeTopic,dimensions:activeDimensions,metrics:activeMetrics});if(!pulled.run.count){const fallback=rankedTopics(topics,dimension).find(candidate=>{const suggested=suggestedFields(candidate,dimension);return suggested.dimensions.length&&suggested.metrics.length>=3&&(candidate.id!==activeTopic||suggested.dimensions.join('|')!==activeDimensions.join('|')||suggested.metrics.join('|')!==activeMetrics.join('|'));});if(fallback){const suggested=suggestedFields(fallback,dimension);setBusy(dimension==='material'&&suggested.hasName?'当前组合返回 0 行，正在用成对的素材 ID 与素材名称自动复核…':'当前组合返回 0 行，正在用标准展点消转字段自动复核…');const checked=await rpc({action:'pull',id:linked.id,day,dimension,parent:'',dataTopic:fallback.id,dimensions:suggested.dimensions,metrics:suggested.metrics});pulled=checked;fallbackUsed=true;activeTopic=fallback.id;activeDimensions=suggested.dimensions;activeMetrics=suggested.metrics;setTopicId(activeTopic);setSelectedDimensions(activeDimensions);setSelectedMetrics(activeMetrics);}}
 setResult(pulled.run);if(pulled.run.count){setTestedId(linked.id);setStartDate(day);setMessage(fallbackUsed?`原字段组合返回 0 行；平台已自动改用 ${activeTopic} 的标准展点消转字段，并成功拉回数据。`:'自选字段已通过真实试拉。现在可以创建历史补拉与每日自动任务。');}else setMessage(fallbackUsed?'平台已用标准展点消转字段自动复核，媒体仍返回 0 行；该账户在所选日期大概率没有对应报表数据，请更换有投放日期。':'媒体返回 0 行，且当前账户没有可用于自动复核的基础字段组合；请更换有投放日期或数据主题。');}catch(error){setError(error);}finally{setBusy('');await reload();}}
 async function createSchedule(e:React.FormEvent){e.preventDefault();if(!testedId)return;setBusy('正在保存每日自动任务…');setError(null);setMessage('');try{const r=await rpc({action:'create_ocean_schedule',id:testedId,dataTopic:topicId,dimensions:selectedDimensions,metrics:selectedMetrics,startDate,endDate,warehouseName,warehouseUrl,warehouseToken});setWarehouseToken('');setMessage(r.message);await reload();}catch(error){setError(error);}finally{setBusy('');}}
 async function manualTest(e:React.FormEvent){e.preventDefault();setBusy('正在使用手动 Token 进行一次性联调…');setError(null);setMessage('');setResult(null);try{const linked=await rpc({action:'save',channel:'ocean',product:OCEAN_INTERNAL_PRODUCT,account:manualAccount,name:manualName||manualAccount,secret:{accessToken:manualToken}});setManualToken('');setSelected(linked.id);const pulled=await rpc({action:'pull',id:linked.id,day,dimension,parent:''});setResult(pulled.run);setMessage(pulled.run.count?'手动 Token 已取回真实报表；正式运行仍建议改用 OAuth。':'媒体返回 0 行；不会覆盖正式数据。');}catch(error){setError(error);}finally{setBusy('');await reload();}}
 return <>
 <div className="formal-steps">
  <section className="setup-block"><div className="setup-head"><span className="step">02</span><div><h2>管理员一次配置开放平台应用</h2><p>App Secret 只加密保存于服务端；Access Token 不再由运营手工维护。</p></div>{app&&<span className="tag good">应用已保存</span>}</div>
   <form onSubmit={saveApp} autoComplete="off"><fieldset disabled={!!busy||!data?.vaultReady}><div className="form-grid">
    <div className="field"><Label htmlFor="ocean-app-name">应用备注名</Label><Input id="ocean-app-name" value={appName} onChange={e=>setAppName(e.target.value)} maxLength={100} required placeholder="例如：MAPI 数据接入"/></div>
    <div className="field"><Label>应用使用方式</Label><Choice value={appType} onChange={setAppType} label="应用使用方式" options={[{id:'self_client',label:'自有广告主数据接入'},{id:'self_agency',label:'代理商 / 账户管家接入'},{id:'third_party',label:'第三方服务平台'}]}/></div>
    <div className="field"><Label htmlFor="ocean-app-id">App ID</Label><Input id="ocean-app-id" value={appId} onChange={e=>setAppId(e.target.value)} inputMode="numeric" required disabled={!!grants.length} placeholder="开发者后台的数字 App ID"/><small>{grants.length?'已有 OAuth 授权，App ID 已锁定。':'需与 App Secret、授权 URL 属于同一个应用。授权前仍可修正。'}</small></div>
    <div className="field"><Label htmlFor="ocean-app-secret">App Secret</Label><Input id="ocean-app-secret" type="password" value={appSecret} onChange={e=>setAppSecret(e.target.value)} required={!app} autoComplete="new-password" placeholder={app?'留空则保留已加密的 Secret':'仅在管理员配置时填写'}/><small>不会回显，不要放入 GitHub、聊天或浏览器存储。</small></div>
    <div className="field wide"><Label htmlFor="ocean-auth-url">官方授权 URL</Label><Input id="ocean-auth-url" value={authorizationUrl} onChange={e=>setAuthorizationUrl(e.target.value)} required={!app} placeholder={app?'已保存；留空则保持不变':'复制应用管理页“授权 URL”的完整地址'}/><small>应以 <code>https://open.oceanengine.com/audit/oauth.html</code> 开头。平台会核对 App ID，并在每次授权时安全替换 state 与回调地址。</small></div>
    <div className="field wide"><Label htmlFor="ocean-callback">授权回调地址</Label><div className="callback-control"><Input id="ocean-callback" type="url" value={redirectUri} onChange={e=>setRedirectUri(e.target.value)} required maxLength={2000} spellCheck={false} placeholder="https://你的域名/回调路径"/><Button type="button" variant="outline" size="sm" onClick={()=>setRedirectUri(callbackSuggestion)}>使用当前站点地址</Button></div><small>当前站点地址只是建议值。使用公司自有域名或网关时，请将巨量追加的 auth_code 与 state 通过 302 原样转发至 <code>{callbackSuggestion}</code>；此处保存值必须与巨量后台登记值完全一致。</small></div>
   </div><label className="check-row"><input type="checkbox" checked={materialAuth} onChange={e=>setMaterialAuth(e.target.checked)}/><span><strong>申请敏感物料授权</strong><small>只有读取素材 URL、线索或评论等敏感数据时才勾选；当前核心报表不依赖它。</small></span></label>
   <div className="permission-box"><strong>应用后台必须已获批的能力</strong><div><span><CheckCircle2 size={16}/>查询已授权账户</span><code>/open_api/oauth2/advertiser/get/</code></div><div><span><CheckCircle2 size={16}/>展开旧版工作台账户</span><code>/open_api/v3.0/customer_center/account/list/</code></div><div><span><CheckCircle2 size={16}/>展开升级版工作台账户</span><code>/open_api/2/ebp/advertiser/list/</code></div><div><span><CheckCircle2 size={16}/>自定义报表配置与读取</span><code>/open_api/v3.0/report/custom/config/get/ · /report/custom/get/</code></div><small>平台不能代替巨量审核应用权限；缺少任一权限时会在当场校验中显示媒体错误。</small></div>
   <div className="form-actions"><Button type="submit" disabled={!!busy||!data?.vaultReady}><ShieldCheck size={17}/>{app?'更新应用配置':'加密保存应用配置'}</Button><a className="inline-link" href="https://open.oceanengine.com/developer/admin" target="_blank" rel="noreferrer">打开巨量开发者后台<ExternalLink size={14}/></a></div></fieldset></form>
  </section>

  <section className={'setup-block '+(!app?'disabled-block':'')}><div className="setup-head"><span className="step">03</span><div><h2>账户管理员完成官方 OAuth 授权</h2><p>在巨量官方页同时选择需要接入的旧版工作台和升级版工作台；平台会分别调用对应账户接口。</p></div></div>
   {!app?<div className="empty-inline">先完成上一步应用配置，并在巨量后台登记相同的回调地址。</div>:<><div className="oauth-actions"><Button type="button" disabled={!!busy} onClick={()=>void startAuth(app.id)}><Users size={17}/>前往巨量官方授权<ArrowRight size={17}/></Button><span className="muted">授权会话 10 分钟有效；auth_code 由本站后端立即换取 Token。</span></div>
   {!grants.length?<div className="empty-inline">尚无授权记录。平台不会要求你复制 auth_code、Access Token 或 Refresh Token。</div>:<div className="grant-list">{grants.map((x:any)=><button type="button" key={x.id} className={'grant-card '+(grant?.id===x.id?'selected':'')} onClick={()=>{setGrantId(x.id);setAccount('');}}><span><strong>{x.app_name}</strong><small>授权于 {when(x.authorized_at)}</small></span><span><b>{x.account_count}</b><small>升级 {x.upgraded_account_count} · 旧版 {x.legacy_account_count}</small></span><span className={'tag '+(x.status==='active'?'good':'bad')}>{x.status==='active'?'授权可用':'需要处理'}</span></button>)}</div>}
   {grant&&<div className="token-status"><div><span>Access Token</span><strong>{when(grant.access_expires_at)}</strong><small>拉数前 5 分钟内自动刷新</small></div><div><span>Refresh Token</span><strong>{when(grant.refresh_expires_at)}</strong><small>到期后必须重新授权</small></div><div><span>账户发现</span><strong>{grant.account_count} 个广告账户</strong><small>升级版 {grant.upgraded_account_count} · 旧版 {grant.legacy_account_count} · 单账户 {grant.direct_account_count}</small></div><div className="token-actions"><Button variant="outline" size="sm" onClick={()=>void syncAccounts(grant.id)} disabled={!!busy}><RefreshCw size={15}/>同步账户</Button><Button variant="outline" size="sm" onClick={()=>void startAuth(grant.app_config_id,grant.id)} disabled={!!busy}><KeyRound size={15}/>重新授权</Button></div></div>}
   {grant&&Number(grant.upgraded_manager_count)===0&&<div className="notice compact-notice"><div><strong>当前授权未包含升级版工作台管理主体</strong><p>点击“重新授权”，在巨量官方页勾选升级版工作台；授权完成后平台会自动读取升级版账户，不需要手填组织 ID。</p></div></div>}
   {grant&&Number(grant.upgraded_manager_count)>0&&Number(grant.upgraded_account_count)===0&&!grant.last_error&&<div className="notice compact-notice"><div><strong>已识别升级版工作台，但暂未返回升级版广告账户</strong><p>点击“同步账户”实时刷新；若仍为 0，请确认应用已获批升级版账户列表接口权限。</p></div></div>}
   {grant?.last_error&&<div className="notice error compact-notice"><div><strong>{grant.last_error.message||'部分账户未能同步'}</strong><p>{grant.last_error.action||'请核对授权账户类型和应用权限后重试。'}</p></div></div>}
   {!!managers.length&&<details><summary>查看授权中的管理主体（{managers.length}）</summary><div className="manager-list">{managers.map((x:any)=><span key={x.id}><b>{managerLabel(String(x.account_type))}</b> · {x.account_id} · {x.account_name}</span>)}</div></details>}</>}
  </section>

  <section className={'setup-block '+(!accounts.length?'disabled-block':'')}><div className="setup-head"><span className="step">04</span><div><h2>选择授权账户并当场试拉</h2><p>账户 ID 从媒体返回列表选择，不让运营手工抄写。</p></div></div>
   {!accounts.length?<div className="empty-inline">完成授权后，可拉数的巨量广告账户会出现在这里；管理账户会自动尝试展开。</div>:<form onSubmit={attachAndTest}><fieldset disabled={!!busy}><div className="form-grid">
    <div className="field wide"><Label>授权广告账户（{accountOptions.length} 个）</Label><AccountPicker value={account} onChange={setAccount} options={accountOptions} disabled={!!busy}/><small>账户 ID 优先展示；支持输入完整或部分账户 ID，也可以按账户名称检索。选中后会自动读取该账户真实可用的报表字段。</small></div>
    <div className="field wide"><Label htmlFor="ocean-account-name">平台备注名（可选）</Label><Input id="ocean-account-name" value={name} onChange={e=>setName(e.target.value)} maxLength={160} placeholder="留空则使用媒体返回的账户名称"/></div>
    <div className="field"><Label htmlFor="ocean-day">报表日期（UTC）</Label><Input id="ocean-day" type="date" value={day} max={yesterday()} onChange={e=>setDay(e.target.value)} required/></div>
    <div className="field"><Label>报表粒度</Label><Choice value={dimension} onChange={setDimension} label="报表粒度" options={dimensions}/></div>
    <div className="field"><Label>报表类型</Label><Choice value={topicId} onChange={value=>{setTopicId(value);const next=topics.find(x=>x.id===value);if(next)defaults(next);setTestedId('');}} label={fieldsBusy?'正在读取媒体字段…':'选择报表类型'} disabled={fieldsBusy||!topics.length} options={topics.map(x=>({id:x.id,label:x.label}))}/></div>
    {dimension==='account'?<div className="field"><Label>输出维度</Label><div className="fixed-field"><strong>账户 ID、账户名称</strong><small>平台会读取完整项目明细后自动汇总为一条账户数据。</small></div></div>:<div className="field"><Label>维度（支持搜索、多选）</Label><FieldPicker label="维度" items={topic?.dimensions||[]} value={selectedDimensions} onChange={updateDimensions} placeholder="选择项目 ID、项目名称、素材名称等" emptyMessage={fieldsBusy?'正在读取媒体字段…':fieldsError?'媒体字段读取失败，请先点击重新读取':account?'等待媒体返回字段':'请先选择授权广告账户'}/></div>}
    <div className="field"><Label>指标（支持搜索、多选）</Label><FieldPicker label="指标" items={topic?.metrics||[]} value={selectedMetrics} onChange={value=>{setSelectedMetrics(value);setTestedId('');}} placeholder="选择曝光、点击、消耗、转化等" emptyMessage={fieldsBusy?'正在读取媒体字段…':fieldsError?'媒体字段读取失败，请先点击重新读取':account?'等待媒体返回字段':'请先选择授权广告账户'}/></div>
    {(fieldsBusy||fieldsError)&&<div className="field wide"><div className={'empty-inline '+(fieldsError?'field-load-error':'')}><span>{fieldsBusy?'正在从巨量读取该账户的数据主题、维度和指标…':fieldsError}</span>{fieldsError&&<Button type="button" variant="outline" size="sm" onClick={retryFields} disabled={!!busy||fieldsBusy}><RefreshCw size={15}/>重新读取媒体字段</Button>}</div></div>}
   </div><div className="metric-note"><strong>本次拉取内容</strong><span>{topicLabel} · 输出：{selectedDimensionLabels.join('、')||'未选择'} · 指标：{selectedMetricLabels.join('、')||'未选择'}</span><small>字段来自该广告账户当前可用的报表配置；提交时平台会自动检查字段是否可以组合。</small></div><div className="form-actions"><Button type="submit" disabled={!!busy||fieldsBusy||!account||!topicId||!selectedDimensions.length||!selectedMetrics.length}><ShieldCheck size={17}/>按自选字段真实试拉<ArrowRight size={17}/></Button></div></fieldset></form>}
   </section>
  <section className={'setup-block '+(!testedId?'disabled-block':'')}><div className="setup-head"><span className="step">05</span><div><h2>创建历史补拉与每日自动任务</h2><p>只有上一步真实试拉返回数据后才开放；任务沿用刚刚验证通过的数据主题、维度和指标。</p></div></div>
   {!testedId?<div className="empty-inline">请先选择字段，并完成一次有数据的真实试拉。</div>:<form onSubmit={createSchedule} autoComplete="off"><fieldset disabled={!!busy}><div className="form-grid">
    <div className="field"><Label htmlFor="schedule-start">开始日期（UTC）</Label><Input id="schedule-start" type="date" value={startDate} onChange={e=>setStartDate(e.target.value)} required/><small>从这一天开始补拉；后续每天继续处理尚未拉取的日期。</small></div>
    <div className="field"><Label htmlFor="schedule-end">停止日期（可选）</Label><Input id="schedule-end" type="date" value={endDate} min={startDate||undefined} onChange={e=>setEndDate(e.target.value)}/><small>留空则持续每日拉取；填写后，处理完该日期自动停止。</small></div>
    <div className="field"><Label htmlFor="warehouse-name">数仓名称</Label><Input id="warehouse-name" value={warehouseName} onChange={e=>setWarehouseName(e.target.value)} required maxLength={120} placeholder="例如：广告投放数仓 / ads_dwd"/></div>
    <div className="field"><Label htmlFor="warehouse-url">数仓接收地址</Label><Input id="warehouse-url" type="url" value={warehouseUrl} onChange={e=>setWarehouseUrl(e.target.value)} required maxLength={2000} placeholder="https://data-gateway.example.com/mapi/ocean"/><small>填写数仓或公司数据网关提供的 HTTPS 接收接口；不能填写 JDBC、MySQL 内网地址。</small></div>
    <div className="field wide"><Label htmlFor="warehouse-token">接收接口鉴权 Token（可选）</Label><Input id="warehouse-token" type="password" value={warehouseToken} onChange={e=>setWarehouseToken(e.target.value)} autoComplete="new-password" placeholder="仅加密保存于服务端，不回显"/></div>
   </div><div className="metric-note"><strong>任务会保存的字段模板</strong><span>{topicLabel} · 输出：{selectedDimensionLabels.join('、')} · 指标：{selectedMetricLabels.join('、')}</span><small>历史补拉和每日任务使用同一模板；同账户、日期和字段范围按完整版本覆盖，避免重复追加。</small></div><div className="form-actions"><Button type="submit" disabled={!!busy||!startDate||!warehouseName||!warehouseUrl}><CheckCircle2 size={17}/>创建每日自动任务</Button></div></fieldset></form>}
   {!!data?.oceanSchedules?.length&&<div className="schedule-list">{data.oceanSchedules.map((x:any)=><div className="schedule-card" key={x.id}><span><strong>{x.account_name} · {x.account}</strong><small>{x.data_topic} · {x.dimensions.length} 个维度 · {x.metrics.length} 个指标</small></span><span><strong>{x.start_date} → {x.end_date||'持续运行'}</strong><small>下次待处理：{x.next_date}</small></span><span><strong>{x.warehouse_name}</strong><small>{x.warehouse_url}</small></span><span className="tag good">{x.status==='active'?'已启用':x.status}</span></div>)}</div>}
  </section>
  </div>

 <details className="manual-fallback"><summary>开发联调兜底：手动 Access Token + 广告主 ID</summary><div className="notice"><KeyRound size={19}/><p>只用于 OAuth 尚未配置完成时的单账户联调。Token 不会自动续期，也不能自动发现账户，不建议作为正式运行方式。</p></div><form onSubmit={manualTest} autoComplete="off"><fieldset disabled={!!busy}><div className="form-grid"><div className="field"><Label htmlFor="manual-account">广告主 ID</Label><Input id="manual-account" inputMode="numeric" value={manualAccount} onChange={e=>setManualAccount(e.target.value)} required/></div><div className="field"><Label htmlFor="manual-name">账户备注名</Label><Input id="manual-name" value={manualName} onChange={e=>setManualName(e.target.value)} placeholder="可选"/></div><div className="field wide"><Label htmlFor="manual-token">Access Token</Label><Input id="manual-token" type="password" value={manualToken} onChange={e=>setManualToken(e.target.value)} required autoComplete="off"/></div></div><Button type="submit" variant="outline" disabled={!!busy}>保存并真实试拉</Button></fieldset></form></details>
 </>;
}
