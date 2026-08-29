const CACHE='energetra-predracun-v2.3-web';
const CORE=["./", "./index.html", "./manifest.webmanifest", "./icon.svg", "./app0.b64", "./app1.b64", "./app2.b64", "./app3.b64", "./app4.b64"];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)));self.skipWaiting();});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==CACHE).map(x=>caches.delete(x)))));self.clients.claim();});
self.addEventListener('fetch',e=>{if(e.request.method!=='GET')return;e.respondWith(caches.match(e.request).then(h=>h||fetch(e.request).then(r=>{if(r&&r.status===200){const q=r.clone();caches.open(CACHE).then(c=>c.put(e.request,q));}return r;})));});
