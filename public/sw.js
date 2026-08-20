const CACHE = "realsign-shell-v2";
const SHELL = ["/", "/profile", "/provider", "/bookings"];
self.addEventListener("install", event => { event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)).catch(() => undefined)); self.skipWaiting(); });
self.addEventListener("activate", event => { event.waitUntil(self.clients.claim()); });
self.addEventListener("fetch", event => { if (event.request.method !== "GET") return; event.respondWith(fetch(event.request).catch(() => caches.match(event.request).then(r => r || caches.match("/")))); });
self.addEventListener("push", event => {
  let data={title:"RealSign",body:"You have a RealSign update.",url:"/bookings"};
  try { if(event.data) data={...data,...event.data.json()}; } catch { if(event.data) data.body=event.data.text(); }
  event.waitUntil(self.registration.showNotification(data.title,{body:data.body,icon:"/icon.svg",badge:"/icon.svg",data:{url:data.url||"/bookings"},tag:data.tag||undefined,renotify:false,vibrate:[200,100,200]}));
});
self.addEventListener("notificationclick", event => {
  event.notification.close(); const target=event.notification.data?.url||"/bookings";
  event.waitUntil(clients.matchAll({type:"window",includeUncontrolled:true}).then(list=>{for(const client of list){if("focus" in client){client.navigate?.(target);return client.focus();}}return clients.openWindow(target);}));
});
