// Service worker minimal — rend l'app installable (PWA) sur Android et iPhone.
// Stratégie volontairement simple : "réseau d'abord" pour la page principale (l'appli est
// une compétition en direct, on veut TOUJOURS la dernière version dès qu'il y a du réseau),
// avec un secours en cache uniquement si le réseau est indisponible (mode avion, zone
// blanche). Les icônes/manifeste sont mis en cache normalement (ils ne changent jamais).
//
// IMPORTANT : change ce numéro de version à chaque fois que tu modifies index.html, sinon
// les appareils qui retombent sur le cache de secours (hors-ligne) garderont une ancienne copie.
const CACHE_VERSION = 'poomsae-cache-v1';
const APP_SHELL = [
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then(cache => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if(req.method !== 'GET') return; // ne jamais intercepter les écritures Firestore

  // Navigation (ouverture/rafraîchissement de la page) : réseau d'abord, cache en secours.
  if(req.mode === 'navigate'){
    event.respondWith(
      fetch(req).then(res => {
        caches.open(CACHE_VERSION).then(cache => cache.put('./index.html', res.clone()));
        return res;
      }).catch(() => caches.match('./index.html'))
    );
    return;
  }

  // Fichiers de l'app (mêmes origine) : cache d'abord, réseau en secours.
  if(new URL(req.url).origin === location.origin){
    event.respondWith(
      caches.match(req).then(cached => cached || fetch(req))
    );
  }
  // Tout le reste (Firebase, CDN Google, etc.) : laissé au comportement normal du navigateur.
});
