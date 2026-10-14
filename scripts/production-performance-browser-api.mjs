// APIRequestContext is independent of browser route interception.
export async function browserApi(context, origin, pathname, {method='GET',...options}={}) {
  if(!/^http:\/\/127\.0\.0\.1:\d+$/.test(origin)||!pathname.startsWith('/api/')||!['GET','POST'].includes(method))throw Error('Local browser API rejected');
  const url=new URL(pathname,origin);if(url.origin!==origin||!url.pathname.startsWith('/api/'))throw Error('Browser API target rejected');
  const response=await context.request.fetch(url.href,{...options,method,maxRedirects:0,timeout:30000});
  if(response.status()<200||response.status()>=300||new URL(response.url()).origin!==origin)throw Error('Browser API response rejected');
  return response;
}
