'use client'

import { useEffect, useState } from 'react'
import { Check, Clipboard, Crown, KeyRound, LogOut, Plus, RefreshCw, ShieldCheck } from 'lucide-react'
import './admin.css'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '/api'

type GameId = 'truth' | 'werewolf' | 'a3'
type PaymentRequest = { reference: string; game: GameId; durationHours: number; status: 'pending' | 'code_sent'; accessCode: string | null; createdAt: string }
type GeneratedCode = { code: string; game: GameId; durationHours: number }

const games: { id: GameId; label: string }[] = [
  { id: 'truth', label: 'Vérités en Jeu' },
  { id: 'werewolf', label: 'Village Secret' },
  { id: 'a3', label: 'À 3' },
]

const gameName = (game: GameId) => games.find((item) => item.id === game)?.label ?? game

export default function AdminPage() {
  const [password, setPassword] = useState('')
  const [email, setEmail] = useState('admin@lordgames.local')
  const [token, setToken] = useState<string | null>(null)
  const [requests, setRequests] = useState<PaymentRequest[]>([])
  const [feedback, setFeedback] = useState('')
  const [loading, setLoading] = useState(false)
  const [selectedGame, setSelectedGame] = useState<GameId>('truth')
  const [selectedDuration, setSelectedDuration] = useState(2)
  const [generatedCodes, setGeneratedCodes] = useState<GeneratedCode[]>([])
  const [creatingCode, setCreatingCode] = useState(false)

  async function loadRequests(currentToken = token) {
    if (!currentToken) return
    setLoading(true)
    try {
      const response = await fetch(`${API_URL}/admin/payment-requests`, { headers: { Authorization: `Bearer ${currentToken}` } })
      const data = await response.json()
      if (!response.ok) throw new Error(data.message ?? 'Impossible de charger les demandes.')
      setRequests(data)
    } catch (error) { setFeedback(error instanceof Error ? error.message : 'Erreur de connexion.') }
    finally { setLoading(false) }
  }

  useEffect(() => { if (token) loadRequests() }, [token])

  async function login() {
    setFeedback('')
    try {
      const response = await fetch(`${API_URL}/admin/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) })
      const data = await response.json()
      if (!response.ok) return setFeedback(data.message ?? 'Connexion refusée.')
      setToken(data.token)
      setPassword('')
    } catch {
      setFeedback(`Impossible de joindre le serveur (${API_URL}). Vérifiez que le backend est démarré.`)
    }
  }

  async function createCode() {
    if (!token) return
    setCreatingCode(true)
    setFeedback('')
    try {
      const response = await fetch(`${API_URL}/admin/access-codes`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ game: selectedGame, durationHours: selectedDuration }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.message ?? 'Impossible de générer le code.')
      setGeneratedCodes((items) => [{ code: data.code, game: data.game, durationHours: data.durationHours }, ...items])
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Erreur lors de la génération.')
    } finally { setCreatingCode(false) }
  }

  async function generate(request: PaymentRequest) {
    if (!token) return
    const response = await fetch(`${API_URL}/admin/payment-requests/${request.reference}/code`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } })
    const data = await response.json()
    if (!response.ok) return setFeedback(data.message ?? 'Impossible de générer le code.')
    setRequests((items) => items.map((item) => item.reference === request.reference ? { ...item, accessCode: data.code, status: 'code_sent' } : item))
  }

  if (!token) {
    return <main className="admin-page"><section className="admin-login"><div className="brand"><Crown size={20}/> THE LORD <span>ADMIN</span></div><span className="modal-icon"><ShieldCheck/></span><p className="kicker">ESPACE ADMINISTRATEUR</p><h1>Gérez les accès de jeu.</h1><p>Connectez-vous pour générer des codes et consulter les demandes de paiement.</p><input value={email} onChange={(event) => setEmail(event.target.value)} type="email" placeholder="E-mail administrateur"/><input value={password} onChange={(event) => setPassword(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && login()} type="password" placeholder="Mot de passe administrateur"/><button className="launch" onClick={login}>Se connecter <KeyRound size={18}/></button>{feedback && <p className="feedback">{feedback}</p>}</section></main>
  }

  return <main className="admin-page"><nav><div className="brand"><Crown size={20}/> THE LORD <span>ADMIN</span></div><button className="ghost admin-logout" onClick={() => setToken(null)}><LogOut size={16}/> Déconnexion</button></nav><section className="admin-dashboard"><div className="admin-heading"><div><p className="kicker">GÉNÉRATION DIRECTE</p><h1>Créer un code d’accès</h1><p>Choisissez le jeu et la durée. Le temps ne démarre que lorsque l’utilisateur entre le code pour la première fois.</p></div></div><div className="code-generator"><div className="generator-games">{games.map((game) => <button key={game.id} className={selectedGame === game.id ? 'active' : ''} onClick={() => setSelectedGame(game.id)}>{game.label}</button>)}</div><div className="generator-duration">{[1, 2, 3, 4, 5].map((hour) => <button key={hour} className={selectedDuration === hour ? 'active' : ''} onClick={() => setSelectedDuration(hour)}>{hour}h</button>)}</div><button className="generate-code" onClick={createCode} disabled={creatingCode}><Plus size={17}/> {creatingCode ? 'Génération…' : 'Générer le code'}</button></div>{generatedCodes.length > 0 && <div className="requests-list">{generatedCodes.map((item) => <article className="request-card" key={item.code}><div><span className="request-state code_sent">Code prêt</span><h2>{gameName(item.game)}</h2><p>{item.durationHours} heure{item.durationHours > 1 ? 's' : ''} · À envoyer au client</p></div><div className="generated-code"><strong>{item.code}</strong><button onClick={() => navigator.clipboard.writeText(item.code)} title="Copier le code"><Clipboard size={16}/></button><span><Check size={14}/> Le décompte commence à la première activation</span></div></article>)}</div>}<div className="admin-heading section-gap"><div><p className="kicker">PAIEMENTS WHATSAPP</p><h1>Demandes de sessions</h1><p>Générez un code après confirmation du paiement.</p></div><button className="refresh" onClick={() => loadRequests()}><RefreshCw size={16} className={loading ? 'spinning' : ''}/> Actualiser</button></div>{feedback && <p className="feedback">{feedback}</p>}<div className="requests-list">{requests.length === 0 ? <div className="empty-state">Aucune demande pour le moment.</div> : requests.map((request) => <article className="request-card" key={request.reference}><div><span className={`request-state ${request.status}`}>{request.status === 'pending' ? 'À payer' : 'Code envoyé'}</span><h2>{gameName(request.game)}</h2><p>{request.durationHours} heure{request.durationHours > 1 ? 's' : ''} · Référence {request.reference}</p></div>{request.accessCode ? <div className="generated-code"><strong>{request.accessCode}</strong><button onClick={() => navigator.clipboard.writeText(request.accessCode!)} title="Copier le code"><Clipboard size={16}/></button><span><Check size={14}/> À transmettre au client</span></div> : <button className="generate-code" onClick={() => generate(request)}><KeyRound size={17}/> Générer le code</button>}</article>)}</div></section></main>
}
