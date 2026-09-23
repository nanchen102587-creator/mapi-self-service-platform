export class MapiError extends Error {
  constructor(public code: string, message: string, public action: string, public status = 400, public upstream?: {status?: number; code?: string; requestId?: string}) { super(message); }
}
export function friendlyError(error: unknown) {
  if (error instanceof MapiError) return {code:error.code, message:error.message, action:error.action, upstream:error.upstream};
  return {code:'PLATFORM_UNAVAILABLE',message:'本次操作未完成。',action:'请稍后重试；原有正式数据未被覆盖。如持续出现，请联系开发检查服务日志。'};
}
export async function mediaJSON(url: string, init: RequestInit, secrets: string[] = []): Promise<{body:any; status:number; requestId:string|null}> {
  let res: Response;
  try { res = await fetch(url, {...init,redirect:'manual',signal:AbortSignal.timeout(20000)}); }
  catch(error) {
    const name=error instanceof Error?error.name:'FetchError',timeout=name==='TimeoutError'||name==='AbortError';
    throw new MapiError(timeout?'MEDIA_TIMEOUT':'MEDIA_UNREACHABLE',timeout?'媒体接口在 20 秒内没有响应。':'平台无法连接媒体接口。',timeout?'请稍后重新发起；本次未写入任何正式数据。':'请开发检查媒体 API 域名、服务端出口网络或重定向限制；这通常不是回调地址问题。',502,{code:name.slice(0,80)});
  }
  if(res.status>=300&&res.status<400){
    const requestId=res.headers.get('x-request-id');
    throw new MapiError('MEDIA_REDIRECTED','媒体接口返回了非预期跳转。','平台不会携带凭证自动跟随跳转；请开发核对当前官方 API 域名。',502,{status:res.status,code:'HTTP_REDIRECT',requestId:requestId?String(requestId).slice(0,120):undefined});
  }
  let body:any;
  const bytes=await res.text();
  if(bytes.length>5_000_000) throw new MapiError('RESPONSE_TOO_LARGE','媒体单页响应超过当前安全上限。','请缩小报表范围。',502);
  try { body = JSON.parse(bytes); } catch { throw new MapiError('MEDIA_RESPONSE_INVALID','媒体返回了非 JSON 响应。','检查媒体服务状态、接口版本及网络白名单。',502,{status:res.status}); }
  const requestId=res.headers.get('x-request-id') || body.request_id || body.trace_id || null;
  if(!res.ok || (body.code !== undefined && String(body.code) !== '0') || body.error) {
    const raw=body.error?.errors?.[0] || body.error || body;
    let message=String(raw.message || raw.error_description || body.message || '媒体拒绝了本次请求').slice(0,500);
    for(const value of secrets.filter(Boolean)) message=message.split(value).join('[已隐藏]');
    const status=res.status;
    const action=status===401?'凭证无效或已过期，请在授权修复中更新凭证并重新试拉。':status===403?'请账户管理员确认该账户的报表读取权限、应用审批和 IP 白名单。':status===429?'触发媒体频控，请稍后重试；本次未覆盖正式数据。':'请根据媒体原始错误码检查账户 ID、报表粒度、日期范围和所申请的 API 权限。';
    throw new MapiError('MEDIA_REJECTED',message,action,502,{status,code:String(raw.code || body.code || body.error || status).slice(0,120),requestId:requestId?String(requestId).slice(0,120):undefined});
  }
  return {body,status:res.status,requestId};
}
