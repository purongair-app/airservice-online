const CACHE='purongair-pwa-v850';
const ASSETS=[
  '/airservice-online/',
  '/airservice-online/index.html',
  '/airservice-online/app.js',
  '/airservice-online/manifest.webmanifest',
  '/airservice-online/icons/icon-192.svg',
  '/airservice-online/icons/icon-512.svg'
];
self.addEventListener('install',e=>{self.skipWaiting();e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)))});
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{
  const u=new URL(e.request.url);
  if(u.origin!==location.origin)return;
  e.respondWith(fetch(e.request).then(r=>{const x=r.clone();caches.open(CACHE).then(c=>c.put(e.request,x));return r}).catch(()=>caches.match(e.request).then(r=>r||caches.match('/airservice-online/'))));
});