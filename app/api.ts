// Configuration partagée du client API (frontend).
//
// NEXT_PUBLIC_API_URL est remplacé par sa valeur au moment du build. Si ce build
// est réalisé en local puis déployé tel quel (Netlify publie le dossier
// .next-local), une valeur locale (localhost / 127.0.0.1) enverrait tous les
// visiteurs vers localhost de LEUR appareil : aucune requête n'aboutirait et le
// lien d'invitation resterait bloqué sur la page d'accueil. On neutralise donc
// ces valeurs au moment du build et on retombe sur '/api' (même origine), qui est
// redirigé vers le backend AdonisJS :
//   - en développement : réécriture next.config.ts -> backend local ;
//   - en production    : proxy Netlify (netlify.toml et .next-local/_redirects)
//                        -> backend public.
// Si une vraie URL publique est fournie au build, elle est utilisée directement.
const BUILT_API_URL = process.env.NEXT_PUBLIC_API_URL?.trim()

function isLocalUrl(url: string) {
  return /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})(:\d+)?(\/|$)/i.test(url)
}

export const API_URL = BUILT_API_URL && !isLocalUrl(BUILT_API_URL)
  ? BUILT_API_URL.replace(/\/+$/, '')
  : '/api'

// Les médias (surtout les vidéos) ont besoin des requêtes HTTP Range pour être
// lus et déplacés correctement. En production, on les charge donc directement
// depuis le backend plutôt que via le proxy Netlify de /api. L'URL reprend
// exactement la destination configurée dans netlify.toml.
const PUBLIC_MEDIA_ORIGIN = 'https://floralwhite-chimpanzee-459944.hostingersite.com'

function mediaBaseUrl() {
  if (API_URL !== '/api') return API_URL
  if (typeof window !== 'undefined' && !isLocalUrl(window.location.origin)) return PUBLIC_MEDIA_ORIGIN
  return API_URL
}

export function resolveMediaUrl(path: string) {
  if (!path) return ''
  if (/^https?:\/\//i.test(path)) return path
  return `${mediaBaseUrl()}${path.startsWith('/') ? path : `/${path}`}`
}

const DEFAULT_TIMEOUT_MS = 12000

// fetch() plafonné dans le temps : une API muette (réseau coupé, backend arrêté)
// ne doit jamais laisser l'utilisateur figé sur un écran de chargement ou de
// synchronisation.
export async function fetchWithTimeout(input: RequestInfo | URL, init?: RequestInit, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(input, { ...init, signal: controller.signal })
  } catch (error) {
    if (controller.signal.aborted) throw new Error('Le serveur ne répond pas. Vérifiez votre connexion et réessayez.')
    throw error
  } finally {
    window.clearTimeout(timer)
  }
}
