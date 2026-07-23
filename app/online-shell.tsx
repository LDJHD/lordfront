'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowRight, Check, LoaderCircle, LogOut, RefreshCw, UserRound, Users } from 'lucide-react'
import A3GameOnline from './a3-game-online'
import TruthGameOnline from './truth-game-online'
import WerewolfGameOnline from './werewolf-game-online'
import GameMusicPlayer from './game-music-player'
import {
  approvePlayer,
  clearOnlineSession,
  hostOnline,
  joinOnline,
  loadJoinMode,
  loadPlayerToken,
  pollOnline,
  reconnectOnline,
  resumeOnline,
  saveJoinMode,
  startOnline,
  type OnlineSnapshot,
} from './online-api'

type Props = {
  sessionCode: string
  game: 'truth' | 'werewolf' | 'a3'
  isJoinLink?: boolean
  onLeaveSession?: () => void
}

export default function OnlineShell({ sessionCode, game, isJoinLink = false, onLeaveSession }: Props) {
  const [snapshot, setSnapshot] = useState<OnlineSnapshot | null>(null)
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [feedback, setFeedback] = useState('')
  const [loading, setLoading] = useState(false)
  const [needsIdentity, setNeedsIdentity] = useState(true)
  const [bootstrapping, setBootstrapping] = useState(true)
  const [syncError, setSyncError] = useState('')
  const [canAutoContinue, setCanAutoContinue] = useState(false)
  const bootstrapDone = useRef(false)
  const snapshotVersion = useRef(0)

  const applySnapshot = useCallback((data: OnlineSnapshot) => {
    snapshotVersion.current += 1
    setSnapshot(data)
  }, [])

  const sync = useCallback(async () => {
    const requestVersion = snapshotVersion.current
    const data = await pollOnline(sessionCode)
    if (requestVersion === snapshotVersion.current) setSnapshot(data)
    setNeedsIdentity(false)
    setSyncError('')
    return data
  }, [sessionCode])

  const reconnect = useCallback(async () => {
    const savedEmail = window.localStorage.getItem('lord-player-email') ?? email
    const savedName = window.localStorage.getItem(`lord-player-${sessionCode}`) ?? displayName
    if (!savedEmail || !savedName) throw new Error('Entrez votre e-mail et votre prénom pour reprendre.')
    const data = await reconnectOnline(sessionCode, savedName, savedEmail)
    setSnapshot(data)
    setNeedsIdentity(false)
    setSyncError('')
    if (data.status === 'active') {
      try {
        setSnapshot(await resumeOnline(sessionCode))
      } catch {
        /* resume is optional */
      }
    }
    return data
  }, [displayName, email, sessionCode])

  useEffect(() => {
    if (bootstrapDone.current) return
    bootstrapDone.current = true

    async function bootstrap() {
      const savedEmail = window.localStorage.getItem('lord-player-email') ?? ''
      const savedName = window.localStorage.getItem(`lord-player-${sessionCode}`) ?? ''
      if (savedEmail) setEmail(savedEmail)
      if (savedName) setDisplayName(savedName)
      setCanAutoContinue(Boolean(savedEmail && savedName))
      if (isJoinLink) saveJoinMode(sessionCode, true)

      try {
        if (loadPlayerToken(sessionCode)) {
          const data = await sync()
          if (data.status === 'active') {
            try {
              setSnapshot(await resumeOnline(sessionCode))
            } catch {
              /* resume is optional */
            }
          }
          return
        }

        if (savedEmail && savedName) {
          await reconnect()
          return
        }
      } catch (error) {
        clearOnlineSession(sessionCode)
        setFeedback(error instanceof Error ? error.message : 'Reconnexion impossible. Entrez à nouveau vos informations.')
      } finally {
        setBootstrapping(false)
      }
    }

    bootstrap().finally(() => setBootstrapping(false))
  }, [isJoinLink, reconnect, sessionCode, sync])

  useEffect(() => {
    if (needsIdentity || bootstrapping) return
    const timer = window.setInterval(() => {
      sync().catch((error) => {
        setSyncError(error instanceof Error ? error.message : 'Synchronisation impossible.')
      })
    }, 2000)
    return () => window.clearInterval(timer)
  }, [bootstrapping, needsIdentity, sessionCode, sync])

  async function enterRoom(asJoin: boolean) {
    setLoading(true)
    setFeedback('')
    try {
      const trimmedEmail = email.trim().toLowerCase()
      const trimmedName = displayName.trim()
      window.localStorage.setItem('lord-player-email', trimmedEmail)
      window.localStorage.setItem(`lord-player-${sessionCode}`, trimmedName)
      saveJoinMode(sessionCode, asJoin)
      const data = asJoin
        ? await joinOnline(sessionCode, trimmedName, trimmedEmail)
        : await hostOnline(sessionCode, trimmedName, trimmedEmail)
      setSnapshot(data)
      setNeedsIdentity(false)
      setSyncError('')
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Connexion impossible.')
    } finally {
      setLoading(false)
    }
  }

  async function continueGame() {
    setLoading(true)
    setFeedback('')
    try {
      await reconnect()
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Impossible de reprendre la partie.')
    } finally {
      setLoading(false)
    }
  }

  function leaveGame() {
    clearOnlineSession(sessionCode)
    setSnapshot(null)
    setNeedsIdentity(true)
    setFeedback('Vous avez quitté la partie en ligne. Vous pouvez la reprendre avec le même e-mail.')
    setSyncError('')
  }

  function quitSession() {
    clearOnlineSession(sessionCode)
    onLeaveSession?.()
  }

  async function approve(id: number) {
    try {
      setSnapshot(await approvePlayer(sessionCode, id))
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Approbation impossible.')
    }
  }

  async function startGame() {
    try {
      setSnapshot(await startOnline(sessionCode))
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Impossible de démarrer.')
    }
  }

  const sessionControls = (
    <div className="session-controls">
      <button className="ghost" onClick={continueGame} disabled={loading}>
        <RefreshCw size={15}/> Continuer la partie
      </button>
      <button className="ghost" onClick={leaveGame}>
        <LogOut size={15}/> Quitter la partie
      </button>
      {onLeaveSession && (
        <button className="ghost danger" onClick={quitSession}>
          <LogOut size={15}/> Quitter la session
        </button>
      )}
    </div>
  )

  if (bootstrapping) {
    return <div className="truth-card setup online-lobby"><LoaderCircle size={28} className="spinning"/><p className="kicker">PARTIE EN LIGNE</p><h1>Reconnexion à la partie…</h1><p>Récupération de votre session et de l’état du jeu.</p></div>
  }

  if (needsIdentity || !snapshot) {
    const joinMode = isJoinLink || loadJoinMode(sessionCode)
    return <div className="truth-card setup online-lobby">
      <UserRound size={28}/>
      <p className="kicker">PARTIE EN LIGNE · {joinMode ? 'REJOINDRE' : 'ORGANISER'}</p>
      <h1>{joinMode ? 'Rejoindre la session' : 'Créer la salle en ligne'}</h1>
      <p>Entrez votre e-mail et le nom affiché pendant la partie. Utilisez les mêmes informations qu’à votre première connexion pour reprendre la partie.</p>
      <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" placeholder="Votre e-mail"/>
      <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && enterRoom(joinMode)} placeholder="Votre prénom ou surnom" maxLength={40}/>
      {feedback && <p className="feedback">{feedback}</p>}
      {canAutoContinue && <button className="launch" disabled={loading} onClick={continueGame}><RefreshCw size={16}/> {loading ? 'Reconnexion…' : 'Continuer la partie'}</button>}
      <button className="launch" disabled={loading} onClick={() => enterRoom(joinMode)}>{loading ? 'Connexion…' : joinMode ? 'Rejoindre la partie' : 'Ouvrir la salle'} <ArrowRight size={18}/></button>
      {onLeaveSession && <button className="ghost danger" onClick={quitSession}><LogOut size={15}/> Quitter la session</button>}
    </div>
  }

  if (snapshot.status === 'lobby') {
    const pending = snapshot.players.filter((player) => !player.approved)
    const approved = snapshot.players.filter((player) => player.approved)
    return <div className="truth-card setup online-lobby">
      <Users size={28}/>
      <p className="kicker">SALLE D’ATTENTE · EN LIGNE</p>
      <h1>{snapshot.me.approved ? 'En attente des joueurs' : 'Demande envoyée'}</h1>
      <p>{snapshot.limits.min === snapshot.limits.max ? `${snapshot.limits.min} joueurs requis` : `${snapshot.limits.min} à ${snapshot.limits.max} joueurs`} · {approved.length} connecté{approved.length > 1 ? 's' : ''}</p>
      <div className="lobby-list">{snapshot.players.map((player) => <article key={player.id} className={`lobby-player ${player.approved ? 'approved' : 'pending'}`}><span>{player.displayName}{player.isHost ? ' · hôte' : ''}</span>{snapshot.me.isHost && !player.approved ? <button onClick={() => approve(player.id)}>Approuver</button> : player.approved ? <Check size={15}/> : <LoaderCircle size={15} className="spinning"/>}</article>)}</div>
      {pending.length > 0 && snapshot.me.isHost && <p className="night-alert">{pending.length} joueur(s) en attente d’approbation</p>}
      {feedback && <p className="feedback">{feedback}</p>}
      {snapshot.me.isHost && snapshot.canStart && <button className="launch" onClick={startGame}>Lancer la partie <ArrowRight size={18}/></button>}
      {snapshot.me.isHost && !snapshot.canStart && <p className="online-hint">Il faut {snapshot.limits.min} joueur{snapshot.limits.min > 1 ? 's' : ''} approuvé{snapshot.limits.min > 1 ? 's' : ''} minimum.</p>}
      {sessionControls}
    </div>
  }

  return <>
    <GameMusicPlayer/>
    {syncError && <p className="feedback">{syncError}</p>}
    {sessionControls}
    {snapshot.game === 'a3' ? <A3GameOnline sessionCode={sessionCode} snapshot={snapshot} onUpdate={applySnapshot}/> : snapshot.game === 'werewolf' ? <WerewolfGameOnline sessionCode={sessionCode} snapshot={snapshot} onUpdate={applySnapshot}/> : <TruthGameOnline sessionCode={sessionCode} snapshot={snapshot} onUpdate={applySnapshot}/>} 
  </>
}
