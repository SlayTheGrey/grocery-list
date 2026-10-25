const C="grocery-v38-1",F=["./","index.html","data.js","manifest.webmanifest","icon.svg","aisle-map.json"];
self.addEventListener("install",e=>{self.skipWaiting();e.waitUntil(caches.open(C).then(c=>c.addAll(F.map(u=>new Request(u,{cache:"reload"})))))});
self.addEventListener("activate",e=>e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==C).map(x=>caches.delete(x)))).then(()=>self.clients.claim())));
// network first, bypassing the browser HTTP cache (Pages sends max-age=600); cache only as offline fallback
self.addEventListener("fetch",e=>{const u=new URL(e.request.url);if(e.request.method!=="GET"||u.origin!==location.origin)return;
 e.respondWith(fetch(e.request,{cache:"no-store"}).then(r=>{if(r.ok){const cp=r.clone();caches.open(C).then(c=>c.put(e.request.mode==="navigate"?"index.html":u.pathname.endsWith("data.js")?"data.js":e.request,cp))}return r}).catch(()=>caches.match(e.request.mode==="navigate"?"index.html":e.request,{ignoreSearch:true})))});
