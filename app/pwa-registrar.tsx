'use client'

import { useEffect } from 'react'

// Enregistre le service worker et détecte la mise à jour disponible.
// Un bandeau discret permet de recharger la page pour appliquer la nouvelle version.
export default function PwaRegistrar() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') return

    let reloading = false
    const onControllerChange = () => {
      if (reloading) return
      reloading = true
      window.location.reload()
    }
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange)

    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then((registration) => {
        // Vérifie les mises à jour à chaque chargement et toutes les heures.
        registration.update().catch(() => undefined)
        const interval = setInterval(() => registration.update().catch(() => undefined), 60 * 60 * 1000)

        const announceUpdate = () => {
          if (!registration.waiting) return
          const banner = document.createElement('div')
          banner.textContent = 'Nouvelle version disponible — recharger'
          banner.setAttribute('role', 'status')
          banner.style.cssText =
            'position:fixed;left:50%;bottom:20px;transform:translateX(-50%);z-index:9999;' +
            'background:#201a2a;color:#fff;padding:12px 18px;border-radius:10px;font-size:14px;cursor:pointer;box-shadow:0 10px 30px #00000055'
          banner.onclick = () => registration.waiting?.postMessage('SKIP_WAITING')
          document.body.appendChild(banner)
        }
        registration.addEventListener('updatefound', () => {
          registration.installing?.addEventListener('statechange', (event) => {
            if ((event.target as ServiceWorker)?.state === 'installed' && navigator.serviceWorker.controller) announceUpdate()
          })
        })
        if (registration.waiting) announceUpdate()

        return () => clearInterval(interval)
      })
      .catch(() => undefined)

    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange)
    }
  }, [])

  return null
}
