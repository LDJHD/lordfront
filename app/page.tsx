'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowRight, BookOpen, Check, Clock3, Copy, Crown, Download, FileText, Gamepad2, Hand, KeyRound, LoaderCircle, LockKeyhole, MessageCircle, RefreshCw, ShieldCheck, Sparkles, Users, Vote, X, Zap } from 'lucide-react'
import OnlineShell from './online-shell'
import { API_URL, fetchWithTimeout } from './api'
import './game.css'
import './activation.css'

const WHATSAPP_NUMBER = '22967357728'

const games = [
  { id: 'truth', eyebrow: 'Questions & réponses', title: 'Vérités en Jeu', description: 'Des questions qui font rire, rougir et rapprochent. Sans jamais dépasser les limites.', icon: Sparkles, tone: 'pink', players: '2 à 12 joueurs', prompts: ['Qui ici te connaît le mieux ?', 'Quelle est la dernière chose qui t’a fait rire aux larmes ?', 'Quel talent secret aimerais-tu montrer ?'], rulesPdf: '/regles/verites-en-jeu.pdf', rulesIntro: 'Le jeu de questions-réponses à deux ou en groupe : chaque tour, un joueur pose une question à la cible désignée, qui répond puis se fait valider sa réponse.', rulesPoints: ['4 niveaux de questions, du brise-glace aux vérités piquantes.', 'Rôles détaillés : poseur, cible, organisateur et participants.', 'Déroulement complet d’un tour, de la question à la validation.', 'Anti-répétition : une question déjà posée ne revient jamais.'] },
  { id: 'werewolf', eyebrow: 'Stratégie & rôle', title: 'Village Secret', description: 'La nuit tombe. Trouvez les loups avant que le village ne disparaisse.', icon: Vote, tone: 'purple', players: '5 à 18 joueurs', prompts: ['Le village s’endort. Qui observez-vous ?', 'Un indice apparaît : à qui faites-vous confiance ?', 'Le jour se lève. Discutez avant de voter.'], rulesPdf: '/regles/village-secret.pdf', rulesIntro: 'La version en ligne des Loups-Garous : la nuit les rôles agissent en secret, le jour le village débat 5 minutes puis vote pour éliminer un suspect.', rulesPoints: ['Les 8 rôles : Loups, Voyante, Cupidon, Chasseur, Sorcière, Petite Fille, Chef, Villageois.', 'Composition automatique des rôles selon le nombre de joueurs (5 à 18).', 'Nuit, débat chronométré, vote, dernières balles du Chasseur : tout le cycle.', 'Conditions de victoire du village, des Loups et des amoureux.'] },
  { id: 'a3', eyebrow: 'Duel instantané', title: 'À 3', description: 'Pierre, feuille ou ciseaux. Le gagnant pose une question au perdant.', icon: Hand, tone: 'gold', players: '2 joueurs', prompts: [], rulesPdf: '/regles/a3.pdf', rulesIntro: 'Le duel en 3 temps : après un décompte de 3, les deux joueurs choisissent Pierre, Feuille ou Ciseaux en même temps, puis le gagnant pose sa question.', rulesPoints: ['Décompte, choix simultanés secrets, révélation avec phrase de victoire.', 'Qui bat qui : pierre, feuille et ciseaux expliqués.', 'La question du gagnant, la réponse du perdant et sa validation.', 'Égalité rejouée automatiquement et bouton Rejouer à volonté.'] },
  { id: 'dames', eyebrow: 'Stratégie & réflexion', title: 'Dames Internationales', description: 'Damier 10×10. 20 pions par joueur. Capturez, devenez dame, gagnez la partie.', icon: Crown, tone: 'bronze', players: '2 joueurs', prompts: [], rulesPdf: '/regles/dames-internationales.pdf', rulesIntro: 'Le dames international en ligne : damier 10×10, 20 pions par joueur, captures obligatoires et promotion en Dame, avec chrono de 5 minutes par coup.', rulesPoints: ['Mise en place : damier, cases foncées, 20 pions, les Blancs commencent.', 'Déplacements, captures obligatoires, prises multiples et meilleure prise.', 'La Dame : promotion, déplacement libre et captures à distance.', 'Chrono 5 min par tour, pause à double confirmation, chat et rejouer.'] },
] as const

type GameId = typeof games[number]['id']
type Session = { game: GameId; duration: number; expiresAt: string; code: string }

function saveSession(nextSession: Session) {
  window.localStorage.setItem('lord-session', JSON.stringify(nextSession))
}

async function fetchSessionFromCode(code: string): Promise<Session> {
  const response = await fetchWithTimeout(`${API_URL}/access-codes/activate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: code.trim().toUpperCase() }),
  })
  const data = await response.json()
  if (response.status === 410) throw new Error(data.message ?? 'Code expiré. Demandez un nouveau temps de jeu.')
  if (!response.ok) throw new Error(data.message ?? 'Impossible d’activer ce code.')
  if (!data.expiresAt) throw new Error('Impossible de démarrer la session.')

  return {
    game: data.game,
    duration: data.durationHours,
    code: data.code,
    expiresAt: data.expiresAt,
  }
}

function formatRemaining(milliseconds: number) {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000))
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
}

export default function Home() {
  const [selected, setSelected] = useState<GameId>('truth' as GameId)
  const [duration, setDuration] = useState(2)
  const [paymentOpen, setPaymentOpen] = useState(false)
  const [sessionsOpen, setSessionsOpen] = useState(false)
  const [rulesOpen, setRulesOpen] = useState<GameId | null>(null)
  const [paymentReference, setPaymentReference] = useState<string | null>(null)
  const [codeOpen, setCodeOpen] = useState(false)
  const [code, setCode] = useState('')
  const [feedback, setFeedback] = useState('')
  const [isActivating, setIsActivating] = useState(false)
  const [session, setSession] = useState<Session | null>(null)
  const [now, setNow] = useState(Date.now())
  const [inviteFeedback, setInviteFeedback] = useState('')
  const [joinMode, setJoinMode] = useState(false)
  const [joining, setJoining] = useState(false)
  const game = useMemo(() => games.find((item) => item.id === selected)!, [selected])
  const activeGame = session ? games.find((item) => item.id === session.game)! : null
  const remaining = session ? new Date(session.expiresAt).getTime() - now : 0
  const amount = duration * 500
  const whatsappText = `Salut, je souhaite effectuer le paiement pour : ${game.title} — session de ${duration} heure${duration > 1 ? 's' : ''} — ${amount} FCFA.${paymentReference ? ` Référence de demande : ${paymentReference}.` : ''}`
  const whatsappHref = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(whatsappText)}`

  useEffect(() => {
    // Un lien d'invitation (?join=CODE) a toujours priorité sur une session
    // précédemment stockée : sinon, un joueur qui a déjà cliqué un lien retombe
    // dans son ancienne partie au lieu du formulaire e-mail / nom du nouveau lien.
    const hasInviteLink = new URLSearchParams(window.location.search).get('join') !== null
    if (hasInviteLink) return
    const stored = window.localStorage.getItem('lord-session')
    if (!stored) return
    const saved = JSON.parse(stored) as Session
    if (new Date(saved.expiresAt).getTime() <= Date.now()) {
      window.localStorage.removeItem('lord-session')
      return
    }
    fetch(`${API_URL}/access-codes/${saved.code}`).then(async (response) => {
      const data = await response.json()
      if (response.status === 410) {
        window.localStorage.removeItem('lord-session')
        setFeedback('Votre session est terminée. Demandez un nouveau code pour rejouer.')
        return
      }
      if (!response.ok) {
        setSession(saved)
        return
      }
      if (data.expiresAt) {
        const synced = { game: data.game, duration: data.durationHours, code: data.code, expiresAt: data.expiresAt }
        saveSession(synced)
        setSession(synced)
      } else {
        setSession(saved)
      }
      setNow(Date.now())
    }).catch(() => setSession(saved))
  }, [])

  const joinViaLink = useCallback(async () => {
    const joinCode = new URLSearchParams(window.location.search).get('join')
    if (!joinCode?.trim()) {
      setFeedback('Lien d’invitation invalide. Utilisez le code reçu par l’organisateur.')
      return
    }
    setJoinMode(true)
    setJoining(true)
    setFeedback('')
    try {
      const response = await fetchWithTimeout(`${API_URL}/access-codes/${joinCode.trim().toUpperCase()}`)
      const data = await response.json()
      if (response.status === 410) throw new Error(data.message ?? 'Code expiré. Demandez un nouveau lien.')
      if (!response.ok) throw new Error(data.message ?? 'Code introuvable.')
      if (!data.expiresAt) {
        setFeedback('La partie n’a pas encore été activée par l’organisateur. Réessayez dans un instant.')
        return
      }
      // Le lien d'invitation remplace l'ancienne session stockée : un joueur qui
      // a déjà rejoint une partie via un lien arrive toujours sur le formulaire
      // e-mail / nom de la NOUVELLE partie, jamais dans son ancienne partie.
      const joined: Session = { game: data.game, duration: data.durationHours, code: data.code, expiresAt: data.expiresAt }
      saveSession(joined)
      window.localStorage.setItem(`lord-join-mode-${joined.code}`, '1')
      setJoinMode(true)
      setSession(joined)
      setNow(Date.now())
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Impossible de rejoindre cette session. Vérifiez le lien et réessayez.')
    } finally {
      setJoining(false)
    }
  }, [])

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('join') !== null) joinViaLink()
  }, [joinViaLink])

  useEffect(() => {
    if (!session) return
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [session])

  useEffect(() => {
    if (session && remaining <= 0) {
      window.localStorage.removeItem('lord-session')
      setSession(null)
      setFeedback('Votre session est terminée. Demandez un nouveau code pour rejouer.')
    }
  }, [remaining, session])

  function openCodeDialog() {
    setFeedback('')
    setPaymentOpen(false)
    setCodeOpen(true)
  }

  async function beginPayment() {
    setPaymentReference(null)
    setPaymentOpen(true)
    try {
      const response = await fetch(`${API_URL}/payment-requests`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ game: selected, durationHours: duration }) })
      const data = await response.json()
      if (response.ok) setPaymentReference(data.reference)
    } catch { /* Le paiement WhatsApp reste accessible même si l'API est temporairement arrêtée. */ }
  }

  async function activateCode() {
    if (!code.trim()) return setFeedback('Saisissez le code transmis par l’administrateur.')
    setIsActivating(true)
    setFeedback('')
    try {
      const nextSession = await fetchSessionFromCode(code)
      saveSession(nextSession)
      window.localStorage.setItem(`lord-join-mode-${nextSession.code}`, '0')
      setSession(nextSession)
      setSelected(nextSession.game)
      setDuration(nextSession.duration)
      setJoinMode(false)
      setNow(Date.now())
      setCodeOpen(false)
      setCode('')
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'La vérification du code a échoué.')
    } finally { setIsActivating(false) }
  }

  async function copyInviteLink() {
    if (!session) return
    await navigator.clipboard.writeText(`${window.location.origin}?join=${session.code}`)
    setInviteFeedback('Lien copié : envoie-le aux joueurs que tu invites.')
  }

  if (joining) {
    return <main className="game-screen">
      <div className="game-noise"/><div className="game-glow pink"/>
      <nav><div className="brand"><Crown size={20}/> THE LORD <span>GAMES</span></div></nav>
      <section className="live-game">
        <div className="truth-card setup online-lobby"><LoaderCircle size={28} className="spinning"/><p className="kicker">PARTIE EN LIGNE · REJOINDRE</p><h1>Connexion à la partie…</h1><p>Récupération de la session et préparation de la salle.</p></div>
      </section>
    </main>
  }

  if (session && activeGame) {
    const Icon = activeGame.icon
    return <main className="game-screen">
      <div className="game-noise"/><div className={`game-glow ${activeGame.tone}`}/>
      <nav><div className="brand"><Crown size={20}/> THE LORD <span>GAMES</span></div><div className="timer"><Clock3 size={16}/><span>Session en cours</span><strong>{formatRemaining(remaining)}</strong></div></nav>
      <section className="live-game">
        <div className="live-label"><span className={`live-icon ${activeGame.tone}`}><Icon size={24}/></span><span>{activeGame.title}</span><i>EN DIRECT</i></div>
        <div className="pulse-ring"><span/><span/><span/><Gamepad2 size={40}/></div>
        {(() => { const leaveSession = () => { window.localStorage.removeItem('lord-session'); window.localStorage.removeItem(`lord-online-token-${session.code}`); setSession(null); setJoinMode(false) }; const gameSlug = activeGame.id as 'truth' | 'werewolf' | 'a3' | 'dames'; return <OnlineShell key={session.code} sessionCode={session.code} game={gameSlug} isJoinLink={joinMode} onLeaveSession={leaveSession}/> })()}
        <div className="game-actions"><button className="ghost" onClick={copyInviteLink}><Copy size={16}/> Copier le lien de la partie</button></div>
        {inviteFeedback && <p className="invite-feedback"><Check size={15}/>{inviteFeedback}</p>}
        <p className="session-code"><LockKeyhole size={14}/> Code {session.code} · accès protégé jusqu’à la fin du compteur</p>
      </section>
    </main>
  }

  return <main>
    <nav><div className="brand"><Crown size={20}/> THE LORD <span>GAMES</span></div><div className="nav-right"><span className="online"><i/> Expérience privée</span><button className="ghost" onClick={() => setSessionsOpen(true)}>Mes parties</button></div></nav>
    <section className="hero"><div className="orb orb-one"/><div className="orb orb-two"/><div className="spark spark-one"/><div className="spark spark-two"/>
      <p className="kicker">LA SOIRÉE COMMENCE ICI</p><h1>Jouez. Riez.<br/><em>Rapprochez-vous.</em></h1><p className="intro">Des jeux de groupe imaginés pour créer de vrais moments, où que vous soyez.</p>
      <div className="trust"><span><ShieldCheck/> Paiement sécurisé</span><span><Users/> Jusqu’à 18 joueurs</span><span><Clock3/> Sessions flexibles</span></div>
    </section>
    <section className="playground" id="jouer"><div className="section-label"><span>01</span><div><p>CHOISISSEZ VOTRE UNIVERS</p><h2>Quelle histoire allez-vous vivre ?</h2></div></div>
      <div className="game-grid">{games.map((item) => { const Icon = item.icon; return <div key={item.id} role="button" tabIndex={0} onClick={() => { setSelected(item.id); setFeedback('') }} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSelected(item.id); setFeedback('') } }} className={`game-card ${item.tone} ${selected === item.id ? 'selected' : ''}`}><div className="card-top"><span className="icon"><Icon/></span>{selected === item.id && <span className="chosen"><Check size={14}/> Sélectionné</span>}</div><p>{item.eyebrow}</p><h3>{item.title}</h3><span className="description">{item.description}</span><button className="rules-toggle" onClick={(event) => { event.stopPropagation(); setRulesOpen(item.id) }}><BookOpen size={15}/> Lire plus · règles du jeu</button><footer><span><Users size={15}/>{item.players}</span><ArrowRight size={19}/></footer></div>})}</div>
      <div className="session-box"><div><p className="mini-title">02 — DURÉE DE LA SALLE</p><h3>Combien de temps jouez-vous ?</h3><span>Votre code démarre le compteur au moment de son activation.</span></div><div className="duration-picker">{[1,2,3,4,5].map((hour) => <button onClick={() => setDuration(hour)} key={hour} className={duration === hour ? 'active' : ''}>{hour}h</button>)}</div><div className="price"><strong>{duration * 500}</strong><span>FCFA<br/>pour {duration}h</span></div></div>
      {feedback && <p className="feedback">{feedback}</p>}
      {joinMode && feedback && <button className="received-code-button" onClick={joinViaLink}><RefreshCw size={15}/> Réessayer la connexion</button>}
      <button className="launch cta-main" onClick={beginPayment}><Zap size={18}/> Commencer la partie <ArrowRight size={19}/></button>
      <p className="activation-note"><KeyRound size={15}/> Après paiement, entrez le code reçu pour lancer votre session.</p><button className="received-code-button" onClick={openCodeDialog}><KeyRound size={17}/> J’ai reçu mon code</button>
    </section>
    <section className="how"><div><p className="kicker">SIMPLE ET PRIVÉ</p><h2>Votre partie, vos règles.</h2></div><div className="steps"><article><b>01</b><h3>Choisissez</h3><p>Votre jeu et la durée de votre session.</p></article><article><b>02</b><h3>Payez via WhatsApp</h3><p>L’administrateur vous transmet votre code personnel.</p></article><article><b>03</b><h3>Jouez sans attendre</h3><p>Le minuteur commence à l’activation du code.</p></article></div></section>
    {paymentOpen && <div className="modal-backdrop" role="dialog" aria-modal="true"><section className="payment-modal"><button className="modal-close" onClick={() => setPaymentOpen(false)} aria-label="Fermer"><X/></button><span className="modal-icon"><MessageCircle/></span><p className="kicker">PAIEMENT PAR WHATSAPP</p><h2>Votre partie est prête.</h2><p>Envoyez votre demande. L’administrateur vous répondra avec un code correspondant exactement à votre sélection.</p><div className="order-summary"><span>Jeu <b>{game.title}</b></span><span>Durée <b>{duration} heure{duration > 1 ? 's' : ''}</b></span>          <span>Montant <b>{duration * 500} FCFA</b></span>{paymentReference && <span>Référence <b>{paymentReference}</b></span>}</div><a className="whatsapp-button" href={whatsappHref} target="_blank" rel="noreferrer"><MessageCircle/> Ouvrir WhatsApp et payer</a><button className="code-link" onClick={openCodeDialog}>J’ai déjà reçu un code <ArrowRight size={16}/></button></section></div>}
    {codeOpen && <div className="modal-backdrop" role="dialog" aria-modal="true"><section className="payment-modal code-modal"><button className="modal-close" onClick={() => setCodeOpen(false)} aria-label="Fermer"><X/></button><span className="modal-icon"><KeyRound/></span><p className="kicker">ACTIVATION DE SESSION</p><h2>Entrez votre code.</h2><p>Le jeu et la durée sont définis par l’administrateur. Le minuteur démarre à la <b>première activation</b> et continue même si vous changez d’appareil.</p><input autoFocus value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} onKeyDown={(event) => event.key === 'Enter' && activateCode()} placeholder="Ex. LORD-AB12CD34" aria-label="Code reçu"/><button className="launch activate-button" onClick={activateCode} disabled={isActivating}>{isActivating ? 'Vérification…' : 'Activer et commencer'} <ArrowRight size={18}/></button>{feedback && <p className="feedback modal-feedback">{feedback}</p>}</section></div>}
    {rulesOpen && (() => { const rulesGame = games.find((item) => item.id === rulesOpen)!; const RulesIcon = rulesGame.icon; return <div className="modal-backdrop" role="dialog" aria-modal="true" onClick={() => setRulesOpen(null)}><section className="payment-modal rules-modal" onClick={(event) => event.stopPropagation()}><button className="modal-close" onClick={() => setRulesOpen(null)} aria-label="Fermer"><X/></button><span className={`rules-icon ${rulesGame.tone}`}><RulesIcon size={26}/></span><p className="kicker">RÈGLES & DÉROULEMENT</p><h2>{rulesGame.title}</h2><p className="rules-tagline">{rulesGame.rulesIntro}</p><div className="rules-summary">{rulesGame.rulesPoints.map((point) => <span key={point}><BookOpen size={14}/>{point}</span>)}</div><div className="rules-actions"><a className="rules-download" href={rulesGame.rulesPdf} download={`regles-${rulesGame.id}.pdf`}><Download size={18}/> Télécharger la fiche PDF</a><a className="rules-preview" href={rulesGame.rulesPdf} target="_blank" rel="noreferrer"><FileText size={16}/> Lire la fiche dans le navigateur</a></div><p className="rules-note"><ShieldCheck size={14}/> Fiche complète : déroulement pas à pas, rôle de chaque acteur, règles et astuces.</p></section></div> })()}
    {sessionsOpen && <div className="modal-backdrop" role="dialog" aria-modal="true"><section className="payment-modal"><button className="modal-close" onClick={() => setSessionsOpen(false)} aria-label="Fermer"><X/></button><span className="modal-icon"><Gamepad2/></span><p className="kicker">MES PARTIES</p><h2>Retrouvez votre session.</h2><p>Vos parties actives s’ouvrent automatiquement sur cet appareil. Si vous avez reçu un nouveau code, activez-le ici.</p><button className="launch activate-button" onClick={() => { setSessionsOpen(false); openCodeDialog() }}><KeyRound size={18}/> Entrer un code reçu</button></section></div>}
  </main>
}
