'use client';
import {useEffect,useState} from 'react';
import {Database,PlugZap,ShieldCheck,RefreshCw,ArrowRight,ExternalLink,AlertCircle,CheckCircle2,KeyRound,LoaderCircle,ChevronRight,FileClock} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {Label} from '@/components/ui/label';
import {Select,SelectTrigger,SelectValue,SelectContent,SelectItem} from '@/components/ui/select';
import {Tabs,TabsList,TabsTrigger,TabsContent} from '@/components/ui/tabs';
import {Table,TableHeader,TableBody,TableRow,TableHead,TableCell} from '@/components/ui/table';
import {Dialog,DialogContent,DialogTitle,DialogDescription,DialogHeader} from '@/components/ui/dialog';
import {AlertDialog,AlertDialogContent,AlertDialogHeader,AlertDialogTitle,AlertDialogDescription,AlertDialogFooter,AlertDialogCancel,AlertDialogAction} from '@/components/ui/alert-dialog';
import {Skeleton} from '@/components/ui/skeleton';
import {channels,channelById} from '@/lib/mapi/catalog';
import OceanConnect from '@/app/ocean-connect';

type Fault={message:string;code:string;action:string;upstream?:{status?:number;code?:string;requestId?:string}};
const yesterday=()=>new Date(Date.now()-86400000).toISOString().slice(0,10);
const labels:Record<string,string>={unverified:'待真实校验',verified:'接口校验通过',needs_attention:'需要处理',fetching:'拉取中 / 未完成',fetched:'已取回 · 待保存',empty:'媒体返回为空',failed:'拉取失败',committed:'已保存报表'};
const resultDimensionLabels:Record<string,string>={account:'账户',campaign:'项目',adgroup:'单元',ad:'广告',creative:'创意',material:'素材',keyword:'关键词'};
const time=(s:string)=>s?new Date(s).toLocaleString('zh-CN',{hour12:false}):'尚未校验';
const resultName=(row:any,dimension:string)=>row?.name&&String(row.name)!==String(row.entityId)?String(row.name):`媒体未返回${resultDimensionLabels[dimension]||'该维度'}名称`;
function fault(e:any):Fault{return e?.code?e:{code:'NETWORK_UNAVAILABLE',message:'暂时无法连接平台服务。',action:'请检查网络并刷新；原有正式数据不会改变。'};}
const oauthFaults:Record<string,Pick<Fault,'message'|'action'>>={
 OAUTH_STATE_INVALID:{message:'本次授权不是从当前平台发起的。',action:'请回到本页点击“前往巨量官方授权”，不要直接点击巨量后台展示的授权 URL。'},
 OAUTH_STATE_EXPIRED:{message:'授权会话已经超过 10 分钟。',action:'请重新点击“前往巨量官方授权”并完成授权。'},
 OAUTH_STATE_USED:{message:'这次授权回调已经处理过。',action:'请刷新状态；如仍未成功，请重新发起一次授权。'},
 MEDIA_TIMEOUT:{message:'巨量接口响应超时。',action:'无需修改回调地址，请稍后从平台重新发起授权。'},
 MEDIA_UNREACHABLE:{message:'平台暂时无法连接巨量接口。',action:'这不是回调地址填写问题；请稍后重试，如持续出现需由开发检查媒体 API 网络。'},
 MEDIA_REDIRECTED:{message:'巨量接口返回了非预期跳转。',action:'平台已停止并保护凭证，请开发核对官方 API 地址后重新发起。'},
 MEDIA_REJECTED:{message:'巨量拒绝了 Token 或账户请求。',action:'请确认 App ID、最新 Secret、应用权限及本次勾选的授权账户，再重新发起。'},
 OCEAN_TOKEN_SCHEMA_CHANGED:{message:'巨量没有返回可保存的 Token。',action:'请重新发起授权；若仍出现，请开发根据媒体错误码核对 Token 接口。'},
};
function Choice({value,onChange,options,label,disabled=false}:{value:string;onChange:(x:string)=>void;options:{id:string;label:string}[];label:string;disabled?:boolean}){
 return <Select value={value} onValueChange={onChange} disabled={disabled}><SelectTrigger aria-label={label} className="control"><SelectValue placeholder={label}/></SelectTrigger><SelectContent>{options.map(o=><SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent></Select>;
}
function Tag({state,children}:{state?:string;children:React.ReactNode}){return <span className={'tag '+(['verified','committed'].includes(state||'')?'good':['failed','needs_attention'].includes(state||'')?'bad':'')}>{children}</span>;}
function ErrorBox({error}:{error:Fault|null}){return error?<div role="alert" className="notice error"><AlertCircle size={20}/><div><strong>{error.message}</strong><p>{error.action}</p><small>平台分类：{error.code}{error.upstream?.status?' · 媒体 HTTP '+error.upstream.status:''}{error.upstream?.code?' · 媒体错误码 '+error.upstream.code:''}</small>{error.upstream?.requestId&&<small>媒体请求 ID：{error.upstream.requestId}</small>}</div></div>:null;}

export default function Workbench(){
 const [tab,setTab]=useState('connect'),[channel,setChannel]=useState('ocean'),[product,setProduct]=useState('有道词典'),[account,setAccount]=useState(''),[name,setName]=useState(''),[secret,setSecret]=useState<Record<string,string>>({}),[editId,setEditId]=useState('');
 const [date,setDate]=useState(yesterday),[dimension,setDimension]=useState('campaign'),[parent,setParent]=useState(''),[selected,setSelected]=useState('');
 const [data,setData]=useState<any>(null),[loading,setLoading]=useState(true),[busy,setBusy]=useState(''),[error,setError]=useState<Fault|null>(null),[message,setMessage]=useState(''),[result,setResult]=useState<any>(null),[sop,setSop]=useState(false),[confirm,setConfirm]=useState(false);
 const c=channelById(channel)!;const conn=data?.connections?.find((x:any)=>x.id===selected);const reportChannel=channelById(conn?.channel||channel)!;
 async function rpc(input:any){const r=await fetch('/api/mapi',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input)});const body:any=await r.json();if(!body.ok)throw body.error;return body;}
 async function reload(){try{const r=await fetch('/api/mapi',{cache:'no-store'});const body:any=await r.json();if(!body.ok)throw body.error;setData(body);}catch(e){setError(fault(e));}finally{setLoading(false);}}
 useEffect(()=>{void reload();const params=new URLSearchParams(window.location.search),oauth=params.get('oauth');if(oauth){const count=params.get('accounts')||'0',code=params.get('code')||'',copy=oauthFaults[code];if(oauth==='success')setMessage(`巨量官方授权完成，已发现 ${count} 个可拉数广告账户。请选择账户进行真实试拉。`);else if(oauth==='partial')setMessage('巨量授权已完成，但尚未发现可拉数广告账户。请检查授权范围、账户类型与应用权限。');else setError({code:code||'OAUTH_FAILED',message:copy?.message||'巨量官方授权未完成。',action:copy?.action||'请确认应用权限和授权账户后，从平台重新发起授权。'});window.history.replaceState({},'',window.location.pathname);}},[]);
 function changeChannel(id:string){setChannel(id);setSecret({});setAccount('');setName('');setEditId('');setDimension(channelById(id)?.dimensions[0]?.id||'');setParent('');setResult(null);setError(null);setMessage('');}
 async function saveAndTest(e:React.FormEvent){e.preventDefault();setBusy('凭证加密保存中…');setError(null);setMessage('');setResult(null);try{
  const saved=await rpc({action:'save',id:editId||undefined,channel,product,account,name:name||account,secret});
  setSecret({});setEditId(saved.id);setSelected(saved.id);await reload();setBusy('正在请求媒体：鉴权、账户权限、报表…');
  const pulled=await rpc({action:'pull',id:saved.id,day:date,dimension,parent});setResult(pulled.run);
  setMessage(pulled.run.count?'已取回真实报表，请核对后保存。':'接口调用完成，但这一天返回 0 行；还不能证明有投放数据。');
 }catch(e){setError(fault(e));}finally{setBusy('');await reload();}}
 async function pull(){if(!selected)return;setBusy('正在向媒体请求完整单日报表…');setError(null);setResult(null);setMessage('');try{const r=await rpc({action:'pull',id:selected,day:date,dimension,parent});setResult(r.run);}catch(e){setError(fault(e));}finally{setBusy('');await reload();}}
 async function commit(){setConfirm(false);setBusy('正在保存完整数据版本…');setError(null);try{const r=await rpc({action:'commit',id:result.id,confirm:true});setMessage(r.message);setResult({...result,status:'committed'});await reload();}catch(e){setError(fault(e));}finally{setBusy('');}}
 async function inspect(id:string){setBusy('正在读取任务记录…');setError(null);try{const r=await fetch('/api/mapi?run='+encodeURIComponent(id),{cache:'no-store'});const body:any=await r.json();if(!body.ok)throw body.error;setResult(body.run);setTab('reports');}catch(e){setError(fault(e));}finally{setBusy('');}}
 async function startOceanAuth(appConfigId:string,grantId?:string){setBusy('正在创建一次性授权会话…');setError(null);try{const r=await rpc({action:'start_ocean_oauth',appConfigId,grantId});window.location.assign(r.authorizationUrl);}catch(e){setError(fault(e));setBusy('');}}
 async function syncOceanAccounts(grantId:string){setBusy('正在刷新 Token 并同步授权账户…');setError(null);try{const r=await rpc({action:'sync_ocean_accounts',grantId});setMessage(r.message);await reload();}catch(e){setError(fault(e));}finally{setBusy('');}}
 function repair(x:any){if(x.channel==='ocean'&&x.auth_grant_id){setTab('repair');setMessage('此账户使用 OAuth。请在下方同步账户或重新授权，无需手工粘贴 Access Token。');return;}setChannel(x.channel);setProduct(x.product);setAccount(x.account);setName(x.name);setEditId(x.id);setSecret({});setDimension(channelById(x.channel)?.dimensions[0]?.id||'');setParent('');setResult(null);setError(null);setMessage('请填写新的凭证。保存后必须重新进行真实校验。');setTab('connect');}
 const verified=data?.connections?.filter((x:any)=>x.status==='verified')||[];
 const expiring=[...(data?.connections?.filter((x:any)=>!x.auth_grant_id&&x.expires_at&&new Date(x.expires_at).getTime()<Date.now()+7*86400000)||[]),...(data?.oceanGrants?.filter((x:any)=>x.refresh_expires_at&&new Date(x.refresh_expires_at).getTime()<Date.now()+7*86400000)||[])];
 const readyCount=channels.filter(x=>x.ready).length;
 const runControls=(ch:typeof c)=><div className="form-grid">
  <div className="field"><Label htmlFor="report-day">报表日期（UTC）</Label><Input id="report-day" type="date" value={date} max={yesterday()} onChange={e=>setDate(e.target.value)} required/></div>
  <div className="field"><Label>报表粒度</Label><Choice value={dimension} onChange={v=>{setDimension(v);setParent('');setResult(null);}} options={ch.dimensions} label="报表粒度"/></div>
  {ch.id==='asa'&&['adgroup','ad'].includes(dimension)&&<div className="field wide"><Label htmlFor="campaign-id">所属 Campaign ID</Label><Input id="campaign-id" inputMode="numeric" value={parent} onChange={e=>setParent(e.target.value)} required placeholder="填写该广告单元 / 广告所属的计划 ID"/><small>当前按指定计划拉取，不会默认遍历组织内所有计划。</small></div>}
 </div>;
 return <div className="workbench">
 <header className="topbar"><a className="brand" href="/"><span className="brand-icon"><Database size={23}/></span><div>MAPI<span>数据接入工作台</span></div></a><div className="top-meta"><span className="private-badge"><ShieldCheck size={15}/>私有联调环境</span><span className="muted">未更新 GitHub 正式版</span></div></header>
 <Tabs value={tab} onValueChange={v=>{setTab(v);setError(null);setMessage('');}} className="shell">
 <aside className="navigation"><div className="nav-caption">数据工作流</div><TabsList className="nav-list">
  <TabsTrigger value="connect"><PlugZap size={19}/>渠道接入<ChevronRight size={15}/></TabsTrigger>
  <TabsTrigger value="reports"><Database size={19}/>拉数与补拉<ChevronRight size={15}/></TabsTrigger>
  <TabsTrigger value="repair"><KeyRound size={19}/>异常与授权<ChevronRight size={15}/></TabsTrigger>
 </TabsList><div className="nav-note"><ShieldCheck size={22}/><strong>真实结果，逐项确认</strong><p>凭证保存在服务端。没有媒体返回，就不会显示接入成功。</p></div></aside>
 <main><div className="heading"><div><div className="eyebrow">MAPI / 从零接入</div><h1>{tab==='connect'?'连接你的第一个媒体账户':tab==='reports'?'拉取、核对，再保存':'发现问题，恢复数据'}</h1><p>{tab==='connect'?'从官方授权开始。接口、参数和校验结果在同一处可见。':tab==='reports'?'按天试拉或补拉，核对完整结果后再替换同范围数据。':'查看真实任务记录与凭证到期信息。'}</p></div><Button variant="outline" disabled={!!busy} onClick={()=>void reload()}><RefreshCw size={16}/>刷新状态</Button></div>
 <div className="stats">
  <div><span>已校验渠道</span><strong>{loading||!data?'—':new Set(verified.map((x:any)=>x.channel)).size}</strong><small>至少一个账户通过实际调用</small></div>
  <div><span>已配置账户</span><strong>{loading||!data?'—':data.connections.length}</strong><small>保存凭证不等于校验成功</small></div>
  <div><span>已保存报表范围</span><strong>{loading||!data?'—':data.partitions.length}</strong><small>按账户、日期、粒度区分</small></div>
  <div><span>7 天内凭证到期</span><strong className={expiring.length?'amber':''}>{loading||!data?'—':expiring.length}</strong><small>基于所填凭证的到期声明</small></div>
 </div>
 <ErrorBox error={error}/>{error?.code==='SIGN_IN_REQUIRED'&&<a className="signin" href="/signin-with-chatgpt?return_to=/" target="_top">登录此私有平台 <ArrowRight size={16}/></a>}
 {message&&<div className="notice"><CheckCircle2 size={19}/><p>{message}</p></div>}
 {busy&&<div className="notice" role="status"><LoaderCircle className="spin" size={20}/><p>{busy} 请勿重复点击。</p></div>}
 <TabsContent value="connect" className="tab-content"><div className="section-grid">
 <section className="panel"><div className="panel-title"><span className="step">01</span><div><h2>{editId?'更新授权':'选择渠道'}</h2><p>全部从未接入状态开始，按真实能力开放。</p></div></div>
 <div className="field"><Label>广告渠道</Label><Choice value={channel} onChange={changeChannel} label="选择广告渠道" options={channels.map(x=>({id:x.id,label:x.name+(x.ready?'':' · 待适配')}))} disabled={!!busy||!!editId}/></div>
 <div className="channel-info"><Tag>{c.category}</Tag><Tag>{c.status}</Tag><p>{c.note}</p></div>
 {!c.ready?<div className="blocked-state"><AlertCircle size={30}/><h3>这个渠道还不能直接拉数</h3><p>当前不收集该渠道的密钥，也不提供模拟校验。需要先完成官方接口和参数的确认与实现。</p><ol>{c.sop.map(s=><li key={s}>{s}</li>)}</ol></div>:c.id==='ocean'?<OceanConnect data={data} busy={busy} rpc={rpc} reload={reload} setBusy={setBusy} setError={e=>setError(fault(e))} setMessage={setMessage} setResult={setResult} setSelected={setSelected} startAuth={startOceanAuth} syncAccounts={syncOceanAccounts}/>:
 <form onSubmit={saveAndTest} autoComplete="off"><fieldset disabled={!!busy}>
 <div className="section-divider"/><div className="panel-title"><span className="step">02</span><div><h2>账户与授权</h2><p>仅限已获媒体 API 读取权限的账户。</p></div><Button type="button" variant="outline" size="sm" onClick={()=>setSop(true)}>如何获取授权</Button></div>
 <div className="form-grid"><div className="field"><Label>产品归属</Label><Choice value={product} onChange={setProduct} label="产品归属" disabled={!!editId||!!busy} options={['有道词典','有道翻译官','叭哥说','其他产品'].map(x=>({id:x,label:x}))}/></div>
 <div className="field"><Label htmlFor="account-name">账户备注名</Label><Input id="account-name" value={name} onChange={e=>setName(e.target.value)} maxLength={120} placeholder="例如：词典 iOS 推广"/></div>
 <div className="field wide"><Label htmlFor="account-id">{c.accountLabel}</Label><Input id="account-id" value={account} onChange={e=>setAccount(e.target.value)} inputMode="numeric" required disabled={!!editId} placeholder="请输入媒体后台的数字 ID" maxLength={20}/></div>
 {c.fields.map(f=><div className="field wide" key={f.key}><Label htmlFor={f.key}>{f.label}</Label><Input id={f.key} type={f.secret?'password':'text'} value={secret[f.key]||''} onChange={e=>setSecret({...secret,[f.key]:e.target.value})} autoComplete="off" required maxLength={10000} placeholder={editId?'重新填写；已有密钥不会回显':f.label}/><small>{f.hint}</small></div>)}</div>
 <div className="section-divider"/><div className="panel-title"><span className="step">03</span><div><h2>选择一天，真实试拉</h2><p>建议选择确认有投放的日期。</p></div></div>{runControls(c)}
 <div className="metric-note"><strong>本次读取</strong><span>{c.id==='ocean'?'曝光 · 点击 · 消耗 · 转化':'曝光 · 点击 · 消耗 · 安装'}</span><small>{c.id==='ocean'?'平台先查询此广告主实际开放的字段与投放版本；任一核心字段不可用即停止。':'其他返回指标一并保留，不将缺失字段补成 0。'}</small></div>
 <div className="form-actions"><Button type="submit" disabled={!!busy||!data?.vaultReady}><ShieldCheck size={17}/>加密保存并真实试拉<ArrowRight size={17}/></Button>{editId&&<Button type="button" variant="outline" onClick={()=>changeChannel(channel)}>退出更新 / 新增账户</Button>}</div>
 <small className="form-footnote">凭证只发送到本站后端及对应官方媒体接口，不写入浏览器存储、GitHub 或页面日志。媒体请求只读，不修改广告投放。</small>
 {data&&!data.vaultReady&&<div className="notice error">安全存储尚未就绪，已禁止提交凭证。</div>}
 </fieldset></form>}
 </section><aside className="right-rail"><section className="panel compact"><div className="rail-title"><PlugZap size={20}/><h2>实际调用接口</h2></div><p className="label">{c.scene}</p><code className="endpoint">{c.endpoint}</code>
 {c.ready&&<ol className="flow-list">{c.id==='ocean'?<><li><span>1</span><div>配置开放平台应用<small>App ID、Secret、官方授权 URL、可配置回调</small></div></li><li><span>2</span><div>完成官方 OAuth<small>auth_code 在后端换 Token，并自动续期</small></div></li><li><span>3</span><div>发现授权账户<small>展开工作台 / 代理商下的广告账户</small></div></li><li><span>4</span><div>探测并读取报表<small>分页和总行数一致后才可保存</small></div></li></>:<><li><span>1</span><div>换取访问令牌<small>凭证无效即停止</small></div></li><li><span>2</span><div>核对组织权限<small>确认账户可访问</small></div></li><li><span>3</span><div>读取完整报表<small>分页完成后才允许保存</small></div></li></>}</ol>}
 <div className="doc-links">{c.docs.map(d=><a href={d.url} key={d.url} target="_blank" rel="noreferrer">{d.title}<ExternalLink size={14}/></a>)}</div></section>
 <section className="panel compact"><h2>这版的实际边界</h2><p>{readyCount} / {channels.length} 个渠道已实现请求流程，全部仍需你的授权和实际账户验收。</p><p>巨量已支持官方 OAuth、Token 自动刷新、直接授权账户和工作台 / 代理商账户发现。</p><p>当前仍是手动单日拉取；尚未配置每天自动执行、离线任务和外部预警通知。</p></section></aside></div></TabsContent>

 <TabsContent value="reports" className="tab-content"><section className="panel"><div className="panel-title"><span className="step"><RefreshCw size={19}/></span><div><h2>拉数 / 某日补拉</h2><p>失败、空数据和不完整分页均不覆盖已有报表。</p></div></div>
 {loading?<Skeleton className="h-32 w-full"/>:!data?.connections?.length?<div className="empty-state"><Database size={32}/><h3>还没有账户</h3><p>先添加一个媒体账户，报表会从真实接口返回。</p><Button onClick={()=>setTab('connect')}>去接入账户<ArrowRight size={16}/></Button></div>:
 <fieldset disabled={!!busy}><div className="field"><Label>产品 / 渠道 / 账户</Label><Choice value={selected} label="选择账户" disabled={!!busy} onChange={id=>{setSelected(id);const x=data.connections.find((v:any)=>v.id===id);setDimension(channelById(x.channel)?.dimensions[0]?.id||'');setParent('');setResult(null);}} options={data.connections.map((x:any)=>({id:x.id,label:x.product+' · '+channelById(x.channel)?.name+' · '+x.name+' ('+x.account+')'}))}/></div>
 {selected&&<>{runControls(reportChannel)}<div className="form-actions"><Button onClick={()=>void pull()} disabled={!!busy}><RefreshCw size={16}/>请求真实报表</Button></div></>}</fieldset>}
 </section><section className="panel"><h2>已保存的数据</h2><p className="muted">仅展示已核对并保存的完整报表，每个范围只有一个生效版本。</p>
 {!data?.partitions?.length?<div className="empty-inline">暂无正式数据。试拉成功后点击“核对并保存”即可在这里查看。</div>:<Table><TableHeader><TableRow><TableHead>产品 / 渠道</TableHead><TableHead>账户</TableHead><TableHead>日期</TableHead><TableHead>粒度</TableHead><TableHead>行数</TableHead><TableHead>操作</TableHead></TableRow></TableHeader><TableBody>{data.partitions.map((x:any)=><TableRow key={x.scope_key}><TableCell>{x.product}<small>{channelById(x.channel)?.name}</small></TableCell><TableCell>{x.account}</TableCell><TableCell>{x.day}</TableCell><TableCell>{channelById(x.channel)?.dimensions.find(d=>d.id===x.dimension)?.label}</TableCell><TableCell>{x.count}</TableCell><TableCell><Button variant="outline" size="sm" disabled={!!busy} onClick={()=>void inspect(x.active_run_id)}>查看数据</Button></TableCell></TableRow>)}</TableBody></Table>}
 </section></TabsContent>

 <TabsContent value="repair" className="tab-content"><section className="panel"><h2>巨量 OAuth 授权</h2><p className="muted">Access Token 到期前自动刷新；Refresh Token 即将到期或媒体解除授权时，需要账户管理员重新授权。</p>
 {!data?.oceanGrants?.length?<div className="empty-inline">尚无巨量 OAuth 授权。请在“渠道接入”中先配置开放平台应用。</div>:<Table><TableHeader><TableRow><TableHead>应用 / 授权</TableHead><TableHead>可用账户</TableHead><TableHead>Access Token</TableHead><TableHead>Refresh Token</TableHead><TableHead>处理</TableHead></TableRow></TableHeader><TableBody>{data.oceanGrants.map((x:any)=><TableRow key={x.id}><TableCell>{x.app_name}<small>授权时间：{time(x.authorized_at)}</small></TableCell><TableCell>{x.account_count} 个<small>{x.manager_count} 个管理账户</small></TableCell><TableCell>{time(x.access_expires_at)}<small>使用前自动刷新</small></TableCell><TableCell>{time(x.refresh_expires_at)}{x.refresh_expires_at&&new Date(x.refresh_expires_at).getTime()<Date.now()+7*86400000&&<small className="amber">7 天内到期，请重新授权</small>}</TableCell><TableCell><div className="table-actions"><Button size="sm" variant="outline" disabled={!!busy} onClick={()=>void syncOceanAccounts(x.id)}>同步账户</Button><Button size="sm" variant="outline" disabled={!!busy} onClick={()=>void startOceanAuth(x.app_config_id,x.id)}>重新授权</Button></div></TableCell></TableRow>)}</TableBody></Table>}
 </section><section className="panel"><h2>账户连接状态</h2><p className="muted">本页刷新时检查有效期。尚未开通邮件、短信或离线预警。</p>
 {!data?.connections?.length?<div className="empty-inline">尚无授权。没有演示账户，也没有预置异常。</div>:<Table><TableHeader><TableRow><TableHead>产品 / 账户</TableHead><TableHead>状态</TableHead><TableHead>授权方式 / 到期</TableHead><TableHead>最近校验</TableHead><TableHead>处理</TableHead></TableRow></TableHeader><TableBody>{data.connections.map((x:any)=><TableRow key={x.id}><TableCell>{x.name}<small>{x.product} · {channelById(x.channel)?.name} · {x.account}</small></TableCell><TableCell><Tag state={x.status}>{labels[x.status]}</Tag></TableCell><TableCell>{x.auth_grant_id?'OAuth 自动续期':'手动凭证'}<small>{x.expires_at?time(x.expires_at):'到期时间未知'}</small>{x.expires_at&&new Date(x.expires_at).getTime()<Date.now()+7*86400000&&<small className="amber">请及时处理授权</small>}</TableCell><TableCell>{time(x.verified_at)}</TableCell><TableCell><Button size="sm" variant="outline" disabled={!!busy} onClick={()=>repair(x)}>{x.auth_grant_id?'查看 OAuth':'更新并校验'}</Button></TableCell></TableRow>)}</TableBody></Table>}
 </section><section className="panel"><h2>真实任务记录</h2><p className="muted">最近 50 次请求。长时间未完成的记录不视为成功，可重新拉取。</p>
 {!data?.runs?.length?<div className="empty-inline">还没有执行过真实拉取。</div>:<Table><TableHeader><TableRow><TableHead>账户 / 日期</TableHead><TableHead>状态</TableHead><TableHead>结果</TableHead><TableHead>时间</TableHead><TableHead>诊断</TableHead></TableRow></TableHeader><TableBody>{data.runs.map((x:any)=><TableRow key={x.id}><TableCell>{x.account}<small>{x.day}</small></TableCell><TableCell><Tag state={x.status}>{labels[x.status]}</Tag></TableCell><TableCell>{x.count} 行</TableCell><TableCell>{time(x.created_at)}</TableCell><TableCell><Button variant="outline" size="sm" disabled={!!busy} onClick={()=>void inspect(x.id)}>查看详情</Button></TableCell></TableRow>)}</TableBody></Table>}
 </section><div className="diagnostic-grid">{[['授权失效 / 权限不足','更新凭证并重新试拉；Token 有效并不代表有目标账户权限。'],['媒体返回 0 行','检查日期、账户、投放状态、媒体数据延迟和报表范围；不会自动把原数据清零。'],['重复拉取 / 数据重述','按产品、渠道、账户、日期、粒度及父级范围替换完整版本；保留历史，不做简单追加。'],['限流 / 超时 / 结构变化','保留正式数据，显示媒体错误码；调整频率或由开发核对接口后重试。']].map(([title,body])=><section className="panel compact" key={title}><h3>{title}</h3><p>{body}</p></section>)}</div></TabsContent>

 {result&&<section className="panel result" aria-live="polite"><div className="panel-title"><span className="step"><FileClock size={19}/></span><div><h2>媒体返回与数据核对</h2><p>{result.product} · {channelById(result.channel)?.name} · {result.account} · {result.day}（UTC）{result.parent?' · 计划 '+result.parent:''}</p></div><Tag state={result.status}>{labels[result.status]}</Tag></div><ErrorBox error={result.error}/>
 {result.status==='empty'?<><div className="notice"><AlertCircle size={20}/><p>接口调用成功且已完整翻页，但巨量返回 0 行。平台不会把“请求成功”误判为“有数据”，也不会用空结果覆盖历史报表。</p></div>{result.evidence&&<div className="metric-note"><strong>本次已核对的媒体范围</strong><span>{result.evidence.date} · {resultDimensionLabels[result.dimension]||'所选'}维度 · 已检查 {result.evidence.dimensions?.length||0} 个维度字段和 {Array.isArray(result.evidence.metrics)?result.evidence.metrics.length:Object.values(result.evidence.metrics||{}).filter(Boolean).length} 个指标</span><small>媒体声明总行数：{result.evidence.mediaReportedTotal??0}。如平台已自动复核仍为 0，请换一个确定有消耗的日期；无需重新授权。</small></div>}</>:<><div className="result-summary"><strong>{result.count} <span>行真实数据</span></strong><span>{result.requests} 次媒体请求</span><span>下方最多预览 100 行</span></div>
 {!!result.preview?.length&&<Table><TableHeader><TableRow><TableHead>{resultDimensionLabels[result.dimension]||'数据'} ID / 名称</TableHead><TableHead>曝光</TableHead><TableHead>点击</TableHead><TableHead>消耗 / 币种</TableHead><TableHead>{result.channel==='ocean'?'转化':'安装'}</TableHead></TableRow></TableHeader><TableBody>{result.preview.map((r:any)=><TableRow key={r.entityId}><TableCell>{r.entityId}<small className={!r.name||String(r.name)===String(r.entityId)?'amber':undefined}>{resultName(r,result.dimension)}</small></TableCell><TableCell>{r.impressions??'未返回'}</TableCell><TableCell>{r.clicks??'未返回'}</TableCell><TableCell>{r.spend??'未返回'} {r.currency||''}</TableCell><TableCell>{r.conversions??'未返回'}</TableCell></TableRow>)}</TableBody></Table>}</>}
 {result.evidence&&<details><summary>开发排查信息（运营无需查看）</summary><pre>{JSON.stringify({evidence:result.evidence,sample:result.preview?.slice(0,3)},null,2)}</pre></details>}
 {result.status==='fetched'&&<div className="form-actions"><Button onClick={()=>setConfirm(true)} disabled={!!busy}><CheckCircle2 size={17}/>核对并保存本次数据</Button><span className="muted">未确认前，不替换正式数据。</span></div>}
 </section>}
 <footer>真实接口联调版 · 接口已实现 ≠ 账户已授权 ≠ 数据已核对</footer>
 </main></Tabs>
 <Dialog open={sop} onOpenChange={setSop}><DialogContent className="sop-dialog"><DialogHeader><DialogTitle>{c.name} · 手动授权步骤</DialogTitle><DialogDescription>仅在官方媒体后台操作。不要在聊天、仓库或共享文档中填写密钥。</DialogDescription></DialogHeader><ol>{c.sop.map((s,i)=><li key={s}><span>{i+1}</span><p>{s}</p></li>)}</ol><div className="doc-links">{c.docs.map(d=><a key={d.url} href={d.url} target="_blank" rel="noreferrer">{d.title}<ExternalLink size={14}/></a>)}</div></DialogContent></Dialog>
 <AlertDialog open={confirm} onOpenChange={setConfirm}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>确认保存这个完整范围？</AlertDialogTitle><AlertDialogDescription>产品：{result?.product}；账户：{result?.account}；日期：{result?.day}（UTC）；粒度：{result?.dimension}；父级计划：{result?.parent||'全部计划'}。共 {result?.count} 行。相同范围切换到本次版本，其他账户与日期不变；原版本保留。</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>返回核对</AlertDialogCancel><AlertDialogAction onClick={()=>void commit()}>确认保存</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
 </div>;
}
