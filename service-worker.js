const CACHE = 'energetra-predracun-v2.9';
const CORE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './pdf-email-v2.js',
  './auto-download-email.js'
];

function injectSendFlow(html){
  if(html.includes('auto-download-email.js')) return html;
  const tags='<script src="./pdf-email-v2.js?v=2.9"></script><script src="./auto-download-email.js?v=2.9"></script>';
  return html.includes('</body>') ? html.replace('</body>',tags+'</body>') : html+tags;
}

async function networkIndex(req){
  const res=await fetch(req);
  const html=injectSendFlow(await res.text());
  const out=new Response(html,{status:res.status,statusText:res.statusText,headers:{'content-type':'text/html; charset=utf-8'}});
  const cache=await caches.open(CACHE);
  cache.put('./index.html',out.clone());
  return out;
}

self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(CORE)));
  self.skipWaiting();
});

self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener('fetch',event=>{
  const req=event.request;
  if(req.method!=='GET') return;
  if(req.mode==='navigate'){
    event.respondWith(networkIndex(req).catch(async()=>{
      const cached=await caches.match('./index.html');
      if(!cached) throw new Error('offline');
      const html=injectSendFlow(await cached.text());
      return new Response(html,{headers:{'content-type':'text/html; charset=utf-8'}});
    }));
    return;
  }
  event.respondWith(caches.match(req).then(hit=>hit||fetch(req).then(res=>{
    if(res&&res.status===200&&res.type==='basic'){
      const copy=res.clone();
      caches.open(CACHE).then(cache=>cache.put(req,copy));
    }
    return res;
  })));
});
