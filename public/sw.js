// Service worker : précache de l'app shell, cache runtime et page hors-ligne.
const VERSION = 'v1'
const STATIC_CACHE = `tlg-static-${VERSION}`
const RUNTIME_CACHE = `tlg-runtime-${VERSION}`
const OFFLINE_URL = '/offline.html'

const PRECACHE_URLS = ['/', OFFLINE_URL, '/site.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png']

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(STATIC_CACHE)
      await Promise.allSettled(PRECACHE_URLS.map((url) => cache.add(new Request(url, { cache: 'reload' }))))
      await self.skipWaiting()
    })(),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(keys.filter((key) => key !== STATIC_CACHE && key !== RUNTIME_CACHE).map((key) => caches.delete(key)))
      await self.clients.claim()
    })(),
  )
})

// Réseau d'abord pour la navigation : la dernière version est toujours affichée,
// avec repli sur la page hors-ligne si le réseau est indisponible.
// Réseau d'abord pour /api/* (données de jeu toujours à jour), sans mise en cache.
self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return
  if (url.pathname.startsWith('/api/')) return

  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const response = await fetch(request)
          const cache = await caches.open(STATIC_CACHE)
          cache.put(request, response.clone())
          return response
        } catch {
          const cached = await caches.match(request)
          if (cached) return cached
          const offline = await caches.match(OFFLINE_URL)
          if (offline) return offline
          return new Response('Hors ligne', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
        }
      })(),
    )
    return
  }

  // Cache d'abord pour le reste (assets statiques _next, icônes, manifest…),
  // avec mise à jour silencieuse en arrière-plan (stale-while-revalidate).
  event.respondWith(
    (async () => {
      const cached = await caches.match(request)
      const fetchPromise = fetch(request)
        .then(async (response) => {
          if (response && response.ok) {
            const cache = await caches.open(RUNTIME_CACHE)
            cache.put(request, response.clone())
          }
          return response
        })
        .catch(() => undefined)
      event.waitUntil(fetchPromise)
      if (cached) return cached
      const response = await fetchPromise
      if (response) return response
      return new Response('', { status: 504, statusText: 'Hors ligne' })
    })(),
  )
})
