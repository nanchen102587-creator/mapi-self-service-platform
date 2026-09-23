import {MapiError,mediaJSON} from './errors';
import {addMoney,requiredString,type PullRequest,type PullResult,type ReportRow} from './apple';
import {OCEAN_API_ORIGIN} from './ocean-endpoints';

type FieldConfig={field?:string;name?:string;description?:string;exclusion_dims?:string[];exclusion_metrics?:string[]};
type TopicConfig={data_topic?:string;dimensions?:FieldConfig[];metrics?:FieldConfig[]};
type MetricMap={impressions:string;clicks:string;spend:string;conversions:string};
type OceanPlan={topic:string;dimensions:string[];idField:string;nameField:string|null;metrics:MetricMap;availableConversionLabel:string};
export type OceanFieldOption={id:string;label:string;description:string;exclusionDimensions:string[];exclusionMetrics:string[]};
export type OceanTopicOption={id:string;label:string;dimensions:OceanFieldOption[];metrics:OceanFieldOption[]};

const CONFIG_TOPICS=['BASIC_DATA','STD_BASIC_DATA','UNI_PROJECT_DATA','MATERIAL_DATA','STD_MATERIAL_DATA','UNI_PROJECT_MATERIAL_DATA'];
const TOPIC_PRIORITY:Record<string,string[]>={
  account:['BASIC_DATA','STD_BASIC_DATA','UNI_PROJECT_DATA'],
  campaign:['BASIC_DATA','STD_BASIC_DATA','UNI_PROJECT_DATA'],
  ad:['BASIC_DATA','STD_BASIC_DATA','UNI_PROJECT_DATA'],
  material:['UNI_PROJECT_MATERIAL_DATA','STD_MATERIAL_DATA','MATERIAL_DATA'],
};
const ID_FIELDS:Record<string,string[]>={
  account:['cdp_project_id','project_id','campaign_id','cdp_promotion_id','promotion_id','ad_id','stat_time_day'],
  campaign:['cdp_project_id','project_id','campaign_id'],
  ad:['cdp_promotion_id','promotion_id','ad_id'],
  material:['material_adjustment_id','material_id','creative_id','image_id','video_id'],
};
const NAME_FIELDS:Record<string,string[]>={
  cdp_project_id:['cdp_project_name'],project_id:['project_name'],campaign_id:['campaign_name'],
  cdp_promotion_id:['cdp_promotion_name'],promotion_id:['promotion_name'],ad_id:['ad_name'],
  material_adjustment_id:['material_adjustment_name'],material_id:['material_name','image_name','video_name'],creative_id:['creative_name'],image_id:['image_name'],video_id:['video_name'],
};
const METRIC_FIELDS={
  impressions:['show','show_cnt','impression','impressions'],
  clicks:['click','click_cnt','valid_click'],
  spend:['stat_cost','cost'],
  conversions:['convert','convert_cnt','conversion','conversion_count'],
};

export function parseOceanSecret(value:Record<string,unknown>){
  return {secret:{accessToken:requiredString(value.accessToken,'Access Token',5000)},expiresAt:null};
}
function asFields(value:unknown):FieldConfig[]{return Array.isArray(value)?value.filter((x):x is FieldConfig=>!!x&&typeof x==='object'&&typeof (x as FieldConfig).field==='string'):[];}
function fieldSet(fields:FieldConfig[]){return new Set(fields.map(x=>x.field!));}
function first(set:Set<string>,values:string[]){return values.find(x=>set.has(x))||null;}
function compatible(dimensions:FieldConfig[],metrics:FieldConfig[],dimensionFields:string[],metricFields:string[]){
  for(const field of dimensionFields){const item=dimensions.find(x=>x.field===field);if(!item)return false;if(item.exclusion_dims?.some(x=>dimensionFields.includes(x))||item.exclusion_metrics?.some(x=>metricFields.includes(x)))return false;}
  for(const field of metricFields){const item=metrics.find(x=>x.field===field);if(!item)return false;if(item.exclusion_dims?.some(x=>dimensionFields.includes(x)))return false;}
  return true;
}
function topicValue(entry:any){return String(entry?.data_topic||entry?.dataTopic||'');}
const FRIENDLY_FIELDS:Record<string,string>={stat_time_day:'日期',stat_time_hour:'小时',stat_time_week:'周',stat_time_month:'月',cdp_project_id:'项目 ID',cdp_project_name:'项目名称',project_id:'项目 ID',project_name:'项目名称',campaign_id:'计划 ID',campaign_name:'计划名称',adgroup_id:'单元 ID',adgroup_name:'单元名称',unit_id:'单元 ID',unit_name:'单元名称',cdp_promotion_id:'广告 ID',cdp_promotion_name:'广告名称',promotion_id:'广告 ID',promotion_name:'广告名称',ad_id:'广告 ID',ad_name:'广告名称',material_adjustment_id:'素材 ID',material_adjustment_name:'素材名称',material_id:'素材 ID',material_name:'素材名称',creative_id:'创意 ID',creative_name:'创意名称',show:'曝光',show_cnt:'曝光',impression:'曝光',impressions:'曝光',all_show_cnt_trend:'曝光',click:'点击',click_cnt:'点击',valid_click:'有效点击',all_click_cnt_trend:'点击',stat_cost:'消耗',cost:'消耗',all_stat_cost_trend:'消耗',convert:'转化',convert_cnt:'转化',conversion:'转化',conversion_count:'转化',all_convert_cnt_trend:'转化',all_pay_amount_fen_trend:'付费金额',all_pay_amount_income_count_trend:'付费次数'};
const TOPIC_LABELS:Record<string,string>={BASIC_DATA:'旧版基础数据',STD_BASIC_DATA:'标准基础数据',UNI_PROJECT_DATA:'升级版项目数据',MATERIAL_DATA:'旧版素材数据',STD_MATERIAL_DATA:'标准素材数据',UNI_PROJECT_MATERIAL_DATA:'升级版项目素材数据'};
function option(field:FieldConfig):OceanFieldOption{const id=field.field!;return {id,label:String(FRIENDLY_FIELDS[id]||field.name||'其他字段'),description:String(field.description||''),exclusionDimensions:field.exclusion_dims||[],exclusionMetrics:field.exclusion_metrics||[]};}
export function normalizeOceanOptions(raw:unknown):OceanTopicOption[]{return (Array.isArray(raw)?raw as TopicConfig[]:[]).map(entry=>{const id=topicValue(entry);return {id,label:TOPIC_LABELS[id]||id,dimensions:asFields(entry.dimensions).map(option),metrics:asFields(entry.metrics).map(option)};}).filter(x=>x.id&&x.dimensions.length&&x.metrics.length);}
export async function getOceanReportOptions(secret:{accessToken:string},account:string){const headers={'Access-Token':secret.accessToken};const url=new URL(OCEAN_API_ORIGIN+'/open_api/v3.0/report/custom/config/get/');url.searchParams.set('advertiser_id',account);url.searchParams.set('data_topics',JSON.stringify(CONFIG_TOPICS));const response=await mediaJSON(url.toString(),{headers},[secret.accessToken]);const list=response.body?.data?.list;if(!Array.isArray(list))throw new MapiError('REPORT_SCHEMA_CHANGED','媒体未返回自定义报表配置列表。','请确认广告主报表权限及接口版本。',502);return {topics:normalizeOceanOptions(list),requestId:response.requestId||null};}
function resolveSelectedPlan(raw:unknown,selection:NonNullable<PullRequest['oceanSelection']>):OceanPlan{
 const topic=requiredString(selection.dataTopic,'数据主题',80),list=Array.isArray(raw)?raw as TopicConfig[]:[],entry=list.find(x=>topicValue(x)===topic);if(!entry)throw new MapiError('OCEAN_FIELD_CONFIG_CHANGED','所选数据主题已不在媒体当前配置中。','请重新加载字段后再试拉。',409);
 const dims=asFields(entry.dimensions),metrics=asFields(entry.metrics),availableDims=fieldSet(dims),availableMetrics=fieldSet(metrics);
 const selectedDims=[...new Set(selection.dimensions.map(String))],selectedMetrics=[...new Set(selection.metrics.map(String))];if(!selectedDims.length||!selectedMetrics.length)throw new MapiError('INPUT_INVALID','请至少选择一个维度和一个指标。','可搜索项目、素材、曝光、点击、消耗或转化。');
 if(selectedDims.some(x=>!availableDims.has(x))||selectedMetrics.some(x=>!availableMetrics.has(x)))throw new MapiError('OCEAN_FIELD_CONFIG_CHANGED','部分所选字段已不在媒体当前配置中。','请重新加载字段后再试拉。',409);
 if(!compatible(dims,metrics,selectedDims,selectedMetrics))throw new MapiError('OCEAN_FIELDS_INCOMPATIBLE','媒体规定所选维度和指标不能同时使用。','减少字段，或根据下拉项提示更换数据主题。',422);
 const selectedIds=selectedDims.filter(x=>/(^|_)id$/.test(x)),selectedNames=selectedDims.filter(x=>/(^|_)name$/.test(x));
 if(!selectedIds.length)throw new MapiError('OCEAN_ID_REQUIRED','请至少选择一个 ID 维度。','名称和日期不能单独用于安全去重，请同时勾选对应的项目、广告或素材 ID。',422);
 const matchedId=selectedIds.find(id=>(NAME_FIELDS[id]||[]).some(name=>selectedNames.includes(name)));
 const orphanNames=selectedNames.filter(name=>!selectedIds.some(id=>(NAME_FIELDS[id]||[]).includes(name)));
 if(orphanNames.length)throw new MapiError('OCEAN_NAME_PAIR_INVALID','所选名称与 ID 不是同一类字段。','请成对选择“素材 ID + 素材名称”或“项目 ID + 项目名称”，平台不会把不同字段强行拼接。',422);
 const idField=matchedId||selectedIds[0],nameField=(NAME_FIELDS[idField]||[]).find(name=>selectedNames.includes(name))||null;
 const metSet=new Set(selectedMetrics),mapped={impressions:first(metSet,METRIC_FIELDS.impressions)||'',clicks:first(metSet,METRIC_FIELDS.clicks)||'',spend:first(metSet,METRIC_FIELDS.spend)||'',conversions:first(metSet,METRIC_FIELDS.conversions)||''};
 return {topic,dimensions:selectedDims,idField,nameField,metrics:mapped,availableConversionLabel:mapped.conversions?(metrics.find(x=>x.field===mapped.conversions)?.name||mapped.conversions):'未选择转化指标'};
}

export function resolveOceanPlan(raw:unknown,dimension:string):OceanPlan{
  const list=Array.isArray(raw)?raw as TopicConfig[]:[];
  const priorities=TOPIC_PRIORITY[dimension]||[];
  for(const topic of priorities){
    const entry=list.find(x=>topicValue(x)===topic);if(!entry)continue;
    const dimensions=asFields(entry.dimensions),metrics=asFields(entry.metrics),dims=fieldSet(dimensions),mets=fieldSet(metrics);
    const selected={
      impressions:first(mets,METRIC_FIELDS.impressions),clicks:first(mets,METRIC_FIELDS.clicks),
      spend:first(mets,METRIC_FIELDS.spend),conversions:first(mets,METRIC_FIELDS.conversions),
    };
    if(!selected.impressions||!selected.clicks||!selected.spend||!selected.conversions)continue;
    for(const idField of ID_FIELDS[dimension]||[]){
      if(!dims.has(idField))continue;
      const metricFields=[selected.impressions,selected.clicks,selected.spend,selected.conversions];
      if(!compatible(dimensions,metrics,[idField],metricFields))continue;
      const nameField=(NAME_FIELDS[idField]||[]).find(name=>dims.has(name)&&compatible(dimensions,metrics,[idField,name],metricFields))||null;
      const conversion=metrics.find(x=>x.field===selected.conversions);
      return {topic,dimensions:nameField?[idField,nameField]:[idField],idField,nameField,metrics:selected as MetricMap,availableConversionLabel:conversion?.name||conversion?.description||selected.conversions};
    }
  }
  const available=list.map(x=>{const dims=asFields(x.dimensions).map(y=>y.field).slice(0,8).join('/');const metrics=asFields(x.metrics).map(y=>y.field).slice(0,8).join('/');return `${topicValue(x)}：维度 ${dims||'无'}；指标 ${metrics||'无'}`;}).filter(Boolean).join('｜').slice(0,1200);
  throw new MapiError('OCEAN_REPORT_SCOPE_UNAVAILABLE','该广告主当前开放的报表字段不能组成所选粒度的“展现、点击、消耗、转化”报表。',available?`媒体返回：${available}。请确认应用已申请报表权限及广告主使用的投放版本。`:'请确认 Access Token、报表权限和广告主的投放版本。',422);
}
function metricNumber(value:unknown,label:string){if(value===undefined||value===null||value===''||value==='--')return null;const n=Number(value);if(!Number.isFinite(n)||n<0)throw new MapiError('REPORT_SCHEMA_CHANGED',`媒体返回的${label}不是可识别数字。`,'未覆盖任何正式数据，请开发核对报表字段。',502);return n;}
function money(value:unknown){if(value===undefined||value===null||value===''||value==='--')return null;const v=String(value);if(!/^\d+(\.\d+)?$/.test(v))throw new MapiError('REPORT_SCHEMA_CHANGED','媒体返回的消耗不是有效小数。','未覆盖任何正式数据，请开发核对 stat_cost。',502);return v;}
function normalizeRows(rows:any[],plan:OceanPlan,p:PullRequest):ReportRow[]{
  return rows.map((row,index)=>{
    if(!row||typeof row!=='object'||!row.dimensions||!row.metrics)throw new MapiError('REPORT_SCHEMA_CHANGED','媒体报表行缺少 dimensions 或 metrics。','未覆盖任何正式数据，请开发核对 API 响应。',502);
    const dimensions=row.dimensions as Record<string,unknown>,metrics=row.metrics as Record<string,unknown>;
    const rawId=dimensions[plan.idField];
    if(rawId===undefined||rawId===null||String(rawId).length>120)throw new MapiError('REPORT_SCHEMA_CHANGED',`媒体报表缺少维度字段 ${plan.idField}。`,'未覆盖任何正式数据，请开发核对接口配置。',502);
    const identityDimensions=p.oceanSelection?plan.dimensions.filter(x=>/(^|_)id$/.test(x)):[];const entityId=identityDimensions.length?identityDimensions.map(x=>String(dimensions[x]??'')).join(' / '):p.dimension==='account'?p.account:String(rawId);
    const nameDimensions=p.oceanSelection?plan.dimensions.filter(x=>/(^|_)name$/.test(x)).map(x=>String(dimensions[x]??'')).filter(Boolean):[];const rawName=plan.nameField?dimensions[plan.nameField]:null;
    const name=nameDimensions.length?nameDimensions.join(' · '):p.dimension==='account'?`账户汇总 · ${p.account}`:rawName?String(rawName):'';
    return {entityId,name,date:p.day,
      impressions:plan.metrics.impressions?metricNumber(metrics[plan.metrics.impressions],'展现数'):null,clicks:plan.metrics.clicks?metricNumber(metrics[plan.metrics.clicks],'点击数'):null,
      spend:plan.metrics.spend?money(metrics[plan.metrics.spend]):null,currency:null,conversions:plan.metrics.conversions?metricNumber(metrics[plan.metrics.conversions],'转化数'):null,
      raw:{dimensions,metrics,dataTopic:plan.topic,metricMapping:plan.metrics}};
  });
}
function aggregateAccount(rows:ReportRow[],p:PullRequest):ReportRow[]{
  if(!rows.length)return [];
  const sum=(field:'impressions'|'clicks'|'conversions')=>rows.some(r=>r[field]===null)?null:rows.reduce((total,row)=>total+(row[field]||0),0);
  const spend=rows.some(r=>r.spend===null)?null:rows.reduce((total,row)=>addMoney(total,row.spend!),'0');
  return [{entityId:p.account,name:`账户汇总 · ${p.account}`,date:p.day,impressions:sum('impressions'),clicks:sum('clicks'),spend,currency:null,conversions:sum('conversions'),raw:{source:'巨量自定义报表按当前账户完整结果汇总',sourceRowCount:rows.length,dataTopic:rows[0].raw.dataTopic,metricMapping:rows[0].raw.metricMapping}}];
}

export async function pullOcean(secret:{accessToken:string},p:PullRequest):Promise<PullResult>{
  const pageSize=100,maxPages=100;
  const headers={'Access-Token':secret.accessToken};const secrets=[secret.accessToken];let requests=0;const requestIds:string[]=[];
  const configUrl=new URL(OCEAN_API_ORIGIN+'/open_api/v3.0/report/custom/config/get/');
  configUrl.searchParams.set('advertiser_id',p.account);configUrl.searchParams.set('data_topics',JSON.stringify(CONFIG_TOPICS));
  const config=await mediaJSON(configUrl.toString(),{headers},secrets);requests++;if(config.requestId)requestIds.push(String(config.requestId));
  const configList=config.body?.data?.list;if(!Array.isArray(configList))throw new MapiError('REPORT_SCHEMA_CHANGED','媒体未返回自定义报表配置列表。','请确认广告主报表权限及接口版本。',502);
  const plan=p.oceanSelection?resolveSelectedPlan(configList,p.oceanSelection):resolveOceanPlan(configList,p.dimension);const rows:ReportRow[]=[];let reportedTotal:number|null=null;let pagesFetched=0;
  for(let page=1;page<=maxPages;page++){
    const url=new URL(OCEAN_API_ORIGIN+'/open_api/v3.0/report/custom/get/');
    url.searchParams.set('advertiser_id',p.account);url.searchParams.set('data_topic',plan.topic);url.searchParams.set('dimensions',JSON.stringify(plan.dimensions));
    const selectedMetrics=p.oceanSelection?p.oceanSelection.metrics:Object.values(plan.metrics);url.searchParams.set('metrics',JSON.stringify(selectedMetrics));url.searchParams.set('filters','[]');url.searchParams.set('order_by',JSON.stringify([{field:plan.idField,type:'ASC'}]));
    url.searchParams.set('start_time',p.day);url.searchParams.set('end_time',p.day);url.searchParams.set('page',String(page));url.searchParams.set('page_size',String(pageSize));
    const response=await mediaJSON(url.toString(),{headers},secrets);requests++;pagesFetched++;if(response.requestId)requestIds.push(String(response.requestId));
    const pageRows=response.body?.data?.rows;if(!Array.isArray(pageRows))throw new MapiError('REPORT_SCHEMA_CHANGED','媒体响应缺少 data.rows，不能将其当作零数据。','请开发核对响应结构；原数据未改变。',502);
    rows.push(...normalizeRows(pageRows,plan,p));
    const info=response.body?.data?.page_info||{};const totalPage=Number(info.total_page);const totalNumber=Number(info.total_number);
    if(Number.isFinite(totalNumber)&&totalNumber>=0)reportedTotal=totalNumber;
    if((Number.isFinite(totalPage)&&totalPage>0&&page>=totalPage)||pageRows.length<pageSize){
      if(reportedTotal!==null&&rows.length!==reportedTotal)throw new MapiError('REPORT_INCOMPLETE',`媒体声明 ${reportedTotal} 行，但本次完整读取到 ${rows.length} 行。`,'请稍后重试；本次不保存部分数据。',502);
      const finalRows=p.dimension==='account'?aggregateAccount(rows,p):rows;
      if(p.dimension!=='account'){const ids=new Set(finalRows.map(row=>row.entityId));if(ids.size!==finalRows.length)throw new MapiError('DUPLICATE_SOURCE_ROWS','同一报表出现重复维度 ID。','媒体数据可能在分页期间变动，请重试；当前不会覆盖正式数据。',409);}
      return {rows:finalRows,requests,accountName:p.account,evidence:{provider:'巨量引擎',apiVersion:'v3.0',configEndpoint:'/open_api/v3.0/report/custom/config/get/',reportEndpoint:'/open_api/v3.0/report/custom/get/',requestIds,advertiserId:p.account,date:p.day,dimension:p.dimension,dataTopic:plan.topic,dimensions:plan.dimensions,nameField:plan.nameField,metrics:p.oceanSelection?p.oceanSelection.metrics:plan.metrics,conversionDefinition:plan.availableConversionLabel,mediaReportedTotal:reportedTotal,pagesFetched,paginationComplete:true,currencyNote:'该报表响应不单独返回币种，消耗保留 stat_cost 原值。',verifiedAt:new Date().toISOString()}};
    }
  }
  throw new MapiError('REPORT_LIMIT_REACHED',`报表超过本版同步接口单次 ${pageSize*maxPages} 行的安全上限。`,'请缩小日期或粒度，或由开发切换巨量异步报表；本次不保存部分数据。',413);
}
