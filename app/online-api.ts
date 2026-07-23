const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '/api'

export type OnlinePlayer = {
  id: number
  displayName: string
  email: string
  isHost: boolean
  approved: boolean
  alive: boolean
  role: string | null
}

export type OnlineSnapshot = {
  status: 'lobby' | 'active' | 'finished'
  game: 'truth' | 'werewolf' | 'a3'
  limits: { min: number; max: number }
  players: OnlinePlayer[]
  me: OnlinePlayer & { playerToken: string }
  gameState: Record<string, unknown>
  canStart: boolean
  availableQuestions?: { id: number; body: string; level: number }[]
}

function tokenKey(code: string) {
  return `lord-online-token-${code}`
}

export function savePlayerToken(code: string, token: string) {
  window.localStorage.setItem(tokenKey(code), token)
}

export function loadPlayerToken(code: string) {
  return window.localStorage.getItem(tokenKey(code))
}

export function clearOnlineSession(code: string) {
  window.localStorage.removeItem(tokenKey(code))
}

export function saveJoinMode(code: string, isJoin: boolean) {
  window.localStorage.setItem(`lord-join-mode-${code}`, isJoin ? '1' : '0')
}

export function loadJoinMode(code: string) {
  return window.localStorage.getItem(`lord-join-mode-${code}`) === '1'
}

export async function reconnectOnline(code: string, displayName: string, email: string) {
  const asJoin = loadJoinMode(code)
  return asJoin ? joinOnline(code, displayName, email) : hostOnline(code, displayName, email)
}

export async function hostOnline(code: string, displayName: string, email: string) {
  const response = await fetch(`${API_URL}/access-codes/${code}/online/host`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ displayName, email }),
  })
  const data = await response.json()
  if (!response.ok) throw new Error(data.message ?? 'Impossible de créer la salle.')
  savePlayerToken(code, data.me.playerToken)
  return data as OnlineSnapshot
}

export async function joinOnline(code: string, displayName: string, email: string) {
  const response = await fetch(`${API_URL}/access-codes/${code}/online/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ displayName, email }),
  })
  const data = await response.json()
  if (!response.ok) throw new Error(data.message ?? 'Impossible de rejoindre.')
  savePlayerToken(code, data.me.playerToken)
  return data as OnlineSnapshot
}

export async function pollOnline(code: string) {
  const token = loadPlayerToken(code)
  if (!token) throw new Error('Session en ligne introuvable.')
  const response = await fetch(`${API_URL}/access-codes/${code}/online`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const data = await response.json()
  if (response.status === 410) throw new Error(data.message ?? 'Session expirée.')
  if (!response.ok) throw new Error(data.message ?? 'Synchronisation impossible.')
  return data as OnlineSnapshot
}

export async function approvePlayer(code: string, playerId: number) {
  const token = loadPlayerToken(code)
  const response = await fetch(`${API_URL}/access-codes/${code}/online/players/${playerId}/approve`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
  })
  const data = await response.json()
  if (!response.ok) throw new Error(data.message ?? 'Approbation impossible.')
  return data as OnlineSnapshot
}

export async function startOnline(code: string) {
  const token = loadPlayerToken(code)
  const response = await fetch(`${API_URL}/access-codes/${code}/online/start`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  })
  const data = await response.json()
  if (!response.ok) throw new Error(data.message ?? 'Démarrage impossible.')
  return data as OnlineSnapshot
}

export async function resumeOnline(code: string) {
  return onlineAction(code, 'resume')
}

export async function onlineAction(code: string, action: string, payload: Record<string, unknown> = {}) {
  const token = loadPlayerToken(code)
  const response = await fetch(`${API_URL}/access-codes/${code}/online/action`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, payload }),
  })
  const data = await response.json()
  if (!response.ok) throw new Error(data.message ?? 'Action impossible.')
  return data as OnlineSnapshot
}
