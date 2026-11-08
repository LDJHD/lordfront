'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Crown, MessageCircle, RotateCcw, Send, Trophy } from 'lucide-react'
import { onlineAction, type OnlineSnapshot } from './online-api'
import { resumeAudio } from './game-sounds'
import { ChatAudioPlayer, VoiceRecordButton } from './voice-chat'

type PiqueCard = string
type PiquePlayerScore = { points: number; tricks: number; bags: number }
type PiqueState = {
  phase: 'announce' | 'playing' | 'finished'
  hands: Record<string, PiqueCard[]>
  turnOrder: number[]
  turnIndex: number
  currentPlayerId: number | null
  status: 'idle' | 'announced'
  mode: 'solo' | 'team'
  teams: Record<string, number[]>
  teamScores: Record<string, PiquePlayerScore>
  winningTeam: 'A' | 'B' | null
  contract: { playerId: number; plis: number; nil: boolean } | null
  announcements: Record<string, { plis: number; nil: boolean }>
  tricks: { number: number; plays: { playerId: number; card: string }[]; winnerId: number | null }[]
  currentTrick: { playerId: number; card: string }[]
  scores: Record<string, PiquePlayerScore>
  nils: number[]
  winnerId: number | null
  turnStartAt: string | null
  turnCount: number
  moveHistory: string[]
  chatMessages: { senderId: number; text: string; timestamp: string; audio?: { url: string; mime?: string; durationMs?: number } }[]
}

const SUIT_SYMBOLS: Record<string, string> = { S: '♠', H: '♥', D: '♦', C: '♣' }
const SUIT_NAMES: Record<string, string> = { S: 'Pique', H: 'Cœur', D: 'Carreau', C: 'Trèfle' }
const SUIT_LABELS: Record<string, string> = { S: 'Pique', H: 'Cœur', D: 'Carreau', C: 'Trèfle' }

function piqueCardLabel(card: string): string {
  const suit = card[0] ?? 'S'
  const rank = card.slice(1)
  const display = rank === '10' ? '10' : rank
  const red = suit === 'H' || suit === 'D'
  return `${display}${SUIT_SYMBOLS[suit] ?? '•'}`
}

type PiqueLiveScore = { points: number; tricks: number; bags: number; nilStatus: 'ongoing' | 'failed' | null }

// Scores provisoires calculés en temps réel à partir des plis déjà remportés et des annonces
// (même règle que le backend : contrat 10 × plis + surplus, raté −10 × plis, nil ±100).
function livePiqueScores(state: PiqueState): Record<string, PiqueLiveScore> {
  const won = new Map<number, number>()
  for (const trick of state.tricks) {
    if (trick.winnerId === null) continue
    won.set(trick.winnerId, (won.get(trick.winnerId) ?? 0) + 1)
  }
  const result: Record<string, PiqueLiveScore> = {}
  for (const id of state.turnOrder) {
    const ann = state.announcements[String(id)]
    const w = won.get(id) ?? 0
    if (!ann) {
      result[String(id)] = { points: 0, tricks: w, bags: 0, nilStatus: null }
    } else if (ann.nil) {
      result[String(id)] = { points: w === 0 ? 100 : -100, tricks: w, bags: 0, nilStatus: w === 0 ? 'ongoing' : 'failed' }
    } else if (w >= ann.plis && w <= 2 * ann.plis) {
      // Contrat réalisé : entre le nombre demandé et le double.
      result[String(id)] = { points: 10 * ann.plis + (w - ann.plis), tricks: w, bags: w - ann.plis, nilStatus: null }
    } else {
      // En dessous ou au-delà du double : pénalité de 10 points par pli demandé.
      result[String(id)] = { points: -10 * ann.plis, tricks: w, bags: 0, nilStatus: null }
    }
  }
  return result
}

function getLegalPiqueCards(state: PiqueState, playerId: number): PiqueCard[] {
  if (state.phase !== 'playing' || state.status !== 'announced' || state.currentPlayerId !== playerId) return []
  const hand = state.hands[String(playerId)] ?? []
  const current = state.currentTrick
  if (current.length >= 4) return []
  const legal: PiqueCard[] = []
  for (const card of hand) {
    if (current.length > 0) {
      const ledSuit = current[0]!.card[0]
      const hasLed = hand.some((entry) => entry[0] === ledSuit)
      if (hasLed) {
        if (card[0] === ledSuit) legal.push(card)
        continue
      }
      // Sans la couleur demandée : il faut piquer (atout) tant qu'il reste des piques en main.
      const hasSpade = hand.some((entry) => entry[0] === 'S')
      if (hasSpade) {
        if (card[0] === 'S') legal.push(card)
        continue
      }
      legal.push(card)
      continue
    }
    const hasNonSpade = hand.some((entry) => entry[0] !== 'S')
    const spadesPlayed = current.some((play) => play.card[0] === 'S')
    if (card[0] !== 'S' || !hasNonSpade || spadesPlayed) legal.push(card)
  }
  return legal
}

// Figures « portrait français » (Roi / Dame / Valet) : personnage symétrique haut/bas
// comme les vraies cartes — la moitié supérieure est miroir de la moitié inférieure.
function PiqueCardArt({ kind, symbol }: { kind: string; symbol: string }) {
  if (kind === 'A') {
    return (
      <svg viewBox="0 0 44 56" className="pique-card-art" aria-hidden="true">
        <path d="M15 9 L17.5 4.5 L22 8 L26.5 4.5 L29 9 Z" fill="#c99b3f" />
        <circle cx="22" cy="30" r="17" fill="none" stroke="currentColor" strokeWidth="2.2" />
        <circle cx="22" cy="30" r="13.5" fill="none" stroke="#c99b3f" strokeWidth="1.2" />
        <text x="22" y="42" textAnchor="middle" fontSize="30" fontWeight="800" fill="currentColor">{symbol}</text>
      </svg>
    )
  }
  if (kind === 'K') {
    return (
      <svg viewBox="0 0 44 56" className="pique-card-art" aria-hidden="true">
        <defs>
          <g id="pique-king-half">
            <path d="M10 15 L13 5 L18 12.5 L22 4.5 L26 12.5 L31 5 L34 15 Z" fill="#c99b3f" stroke="currentColor" strokeWidth="0.8" />
            <circle cx="13" cy="4.5" r="1.9" fill="#c99b3f" />
            <circle cx="22" cy="4" r="2.1" fill="#c99b3f" />
            <circle cx="31" cy="4.5" r="1.9" fill="#c99b3f" />
            <rect x="10" y="15" width="24" height="3" fill="#c99b3f" />
            <path d="M15 18 Q22 15.8 29 18 L29 24 Q22 27 15 24 Z" fill="currentColor" />
            <circle cx="19" cy="21" r="1" fill="#fff" />
            <circle cx="25" cy="21" r="1" fill="#fff" />
            <path d="M15.5 23.5 Q22 26.5 28.5 23.5 L28 26.5 L16 26.5 Z" fill="currentColor" opacity="0.85" />
            <path d="M18 26.5 L22 33 L26 26.5 Z" fill="currentColor" />
            <path d="M13 33 L22 39.5 L31 33 L29.5 42 L14.5 42 Z" fill="currentColor" opacity="0.7" />
            <path d="M14.5 41 L29.5 41 L29 44 L15 44 Z" fill="#fff" opacity="0.75" />
            <path d="M12 47 L33 29 L35 31 L14 49.5 Z" fill="currentColor" />
            <path d="M31.5 28.5 L36 24 L37 26 L33.5 31 Z" fill="currentColor" />
          </g>
        </defs>
        <use href="#pique-king-half" />
        <g transform="translate(0,56) scale(1,-1)"><use href="#pique-king-half" /></g>
      </svg>
    )
  }
  if (kind === 'Q') {
    return (
      <svg viewBox="0 0 44 56" className="pique-card-art" aria-hidden="true">
        <defs>
          <g id="pique-queen-half">
            <path d="M14 15.5 L17 9 L22 13.5 L27 9 L30 15.5 Z" fill="#c99b3f" stroke="currentColor" strokeWidth="0.8" />
            <circle cx="17" cy="8.5" r="1.7" fill="#c99b3f" />
            <circle cx="27" cy="8.5" r="1.7" fill="#c99b3f" />
            <path d="M14.5 16 Q22 13 29.5 16 L29.5 28 L14.5 28 Z" fill="currentColor" opacity="0.45" />
            <path d="M16.5 16.5 Q22 14.5 27.5 16.5 L27.5 23 Q22 25.5 16.5 23 Z" fill="currentColor" />
            <circle cx="19.5" cy="20" r="1" fill="#fff" />
            <circle cx="24.5" cy="20" r="1" fill="#fff" />
            <circle cx="22" cy="32.5" r="2.2" fill="#c99b3f" />
            <path d="M15 35 L22 41 L29 35 L30.5 48 L13.5 48 Z" fill="currentColor" opacity="0.7" />
            <path d="M28 48 L30.5 33" stroke="currentColor" strokeWidth="2" />
            <circle cx="30.5" cy="31" r="2.6" fill="currentColor" />
            <circle cx="30.5" cy="31" r="1" fill="#c99b3f" />
          </g>
        </defs>
        <use href="#pique-queen-half" />
        <g transform="translate(0,56) scale(1,-1)"><use href="#pique-queen-half" /></g>
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 44 56" className="pique-card-art" aria-hidden="true">
      <defs>
        <g id="pique-jack-half">
          <path d="M12 15 Q22 7 32 15 Q22 19.5 12 15 Z" fill="currentColor" />
          <path d="M27 9 Q34 13 32 19" stroke="currentColor" strokeWidth="2.2" fill="none" />
          <path d="M16 16 Q22 14.5 28 16 L28 22.5 Q22 25 16 22.5 Z" fill="currentColor" />
          <circle cx="19.5" cy="19.5" r="1" fill="#fff" />
          <circle cx="24.5" cy="19.5" r="1" fill="#fff" />
          <path d="M15.5 24 L22 28.5 L28.5 24 L28.5 29.5 L15.5 29.5 Z" fill="#fff" opacity="0.7" />
          <path d="M14 30 L22 36 L30 30 L30.5 45 L13.5 45 Z" fill="currentColor" opacity="0.7" />
          <path d="M30.5 45 L32.5 27" stroke="currentColor" strokeWidth="2.2" />
          <path d="M30.5 27 L36 22.5 L37 24.5 L32.5 29.5 Z" fill="currentColor" />
        </g>
      </defs>
      <use href="#pique-jack-half" />
      <g transform="translate(0,56) scale(1,-1)"><use href="#pique-jack-half" /></g>
    </svg>
  )
}

function PiqueCardView({ card, playable, onPlay }: { card: string; playable?: boolean; onPlay?: (card: string) => void }) {
  const suit = card[0] ?? 'S'
  const rank = card.slice(1)
  const display = rank === '10' ? '10' : rank
  const red = suit === 'H' || suit === 'D'
  const symbol = SUIT_SYMBOLS[suit] ?? '•'
  const isFigure = rank === 'J' || rank === 'Q' || rank === 'K'
  const isAce = rank === 'A'
  const center = isFigure || isAce ? <PiqueCardArt kind={rank} symbol={symbol} /> : symbol
  const corner = (flip: boolean) => (
    <span className={`pique-card-corner ${flip ? 'flip' : ''}`} aria-hidden="true">
      <span className="pique-card-rank">{display}</span>
      <span className="pique-card-corner-suit">{symbol}</span>
    </span>
  )
  const face = (
    <div className={`pique-card ${red ? 'red' : 'black'} ${playable ? 'playable' : ''} ${isFigure || isAce ? 'face' : ''}`}>
      {corner(false)}
      <span className="pique-card-center" aria-hidden="true">{center}</span>
      {corner(true)}
    </div>
  )
  if (!playable || !onPlay) return face
  return (
    <button type="button" className="pique-card-btn" onClick={() => onPlay(card)} aria-label={`Jouer ${piqueCardLabel(card)}`}>
      {face}
    </button>
  )
}

export default function PiqueGameOnline({
  sessionCode,
  snapshot,
  onUpdate,
}: {
  sessionCode: string
  snapshot: OnlineSnapshot
  onUpdate: (data: OnlineSnapshot) => void
}) {
  const state = snapshot.gameState as unknown as PiqueState
  const me = snapshot.me
  const chatEndRef = useRef<HTMLDivElement>(null)
  const savedResult = useRef(false)
  const [chatInput, setChatInput] = useState('')
  const [now, setNow] = useState(Date.now())
  const [actionFeedback, setActionFeedback] = useState('')
  const [plisInput, setPlisInput] = useState('0')
  const [nilInput, setNilInput] = useState(false)

  const myHand = state.hands[String(me.id)] ?? []
  const myLegalCards = useMemo(() => getLegalPiqueCards(state, me.id), [state, me.id])
  const liveScores = useMemo(() => livePiqueScores(state), [state])
  const nilCount = state.turnOrder.filter((id) => state.announcements[String(id)]?.nil).length
  const isMyAnnounceTurn = state.phase === 'announce' && state.currentPlayerId === me.id
  const isMyPlayTurn = state.phase === 'playing' && state.status === 'announced' && state.currentPlayerId === me.id

  const elapsed = state.turnStartAt ? now - new Date(state.turnStartAt).getTime() : 0
  const TURN_TIME_LIMIT = 30 * 1000

  useEffect(() => {
    resumeAudio()
  }, [])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [state.chatMessages.length])

  useEffect(() => {
    if (state.phase === 'finished' && state.winnerId) {
      if (savedResult.current) return
      savedResult.current = true
    } else {
      savedResult.current = false
    }
  }, [state.phase, state.winnerId])

  const act = useCallback(
    async (action: string, payload: Record<string, unknown> = {}) => {
      setActionFeedback('')
      try {
        onUpdate(await onlineAction(sessionCode, action, payload))
      } catch (error) {
        setActionFeedback(error instanceof Error ? error.message : 'Action impossible.')
      }
    },
    [onUpdate, sessionCode]
  )

  function sendChat(payload?: { audioUrl: string; audioMime?: string; audioDurationMs?: number }) {
    if (!payload && !chatInput.trim()) return
    void act('chat', payload ?? { text: chatInput.trim() })
    if (!payload) setChatInput('')
  }

  function playCard(card: string) {
    void act('play', { card })
  }

  function announce(nil: boolean, plis: number) {
    return void act('announce', { plis: nil ? 0 : Math.max(0, Math.min(Math.trunc(plis), 26)), nil })
  }

  const maxPlis = state.turnOrder.length <= 2 ? 26 : state.turnOrder.length === 3 ? 17 : 13

  const winnerName = useMemo(() => {
    if (!state.winnerId) return 'Un joueur'
    const winnerEntry = state.turnOrder.find((id) => id === state.winnerId)
    const entry = winnerEntry ? state.scores[String(winnerEntry)] : null
    const scorePlayer = snapshot.players.find((player) => player.id === state.winnerId)
    return scorePlayer?.displayName ?? (winnerEntry ? `Joueur ${winnerEntry}` : 'Un joueur')
  }, [state, snapshot.players])

  const contractPlayerName = useMemo(() => {
    if (!state.contract) return null
    const player = snapshot.players.find((item) => item.id === state.contract?.playerId)
    return player?.displayName ?? null
  }, [state.contract, snapshot.players])

  // Détail de fin de partie : pour chaque joueur, son annonce, ses plis remportés,
  // le résultat de son contrat/nil et les pénalités appliquées (contrat échoué, nil raté, sacs).
  const breakdown = useMemo(() => {
    const won = new Map<number, number>()
    for (const trick of state.tricks) {
      if (trick.winnerId === null) continue
      won.set(trick.winnerId, (won.get(trick.winnerId) ?? 0) + 1)
    }
    return state.turnOrder.map((id) => {
      const name = snapshot.players.find((p) => p.id === id)?.displayName ?? `Joueur ${id}`
      const team = state.mode === 'team' ? (state.teams?.A?.includes(id) ? 'A' : state.teams?.B?.includes(id) ? 'B' : null) : null
      const ann = state.announcements[String(id)]
      const w = won.get(id) ?? 0
      const final = state.scores[String(id)]?.points ?? 0
      if (!ann) return { id, name, team, contractLabel: 'non annoncé', won: w, resultLabel: '—', penalty: false, bagLabel: null, bagPenalty: false, final }
      if (ann.nil) {
        const ok = w === 0
        return {
          id, name, team,
          contractLabel: 'nil',
          won: w,
          resultLabel: ok ? 'nil réussi +100' : 'nil raté −100',
          penalty: !ok,
          bagLabel: null,
          bagPenalty: false,
          final,
        }
      }
      if (w >= ann.plis && w <= 2 * ann.plis) {
        const base = 10 * ann.plis + (w - ann.plis)
        const bags = w - ann.plis
        const bagPenalty = base - final
        return {
          id, name, team,
          contractLabel: `contrat ${ann.plis}`,
          won: w,
          resultLabel: `réussi +${base}`,
          penalty: bagPenalty >= 100,
          bagLabel: bagPenalty >= 100 ? 'pénalité de sacs −100' : bags > 0 ? `sacs ${bags}` : null,
          bagPenalty: bagPenalty >= 100,
          final,
        }
      }
      return {
        id, name, team,
        contractLabel: `contrat ${ann.plis}`,
        won: w,
        resultLabel: `échoué −${10 * ann.plis} (pénalité)`,
        penalty: true,
        bagLabel: null,
        bagPenalty: false,
        final,
      }
    })
  }, [state, snapshot.players])

  const penaltyLines = useMemo(
    () => breakdown.filter((entry) => entry.penalty).map((entry) => `${entry.name} : ${entry.resultLabel.replace(' (pénalité)', '')}`),
    [breakdown]
  )

  if (state.phase === 'finished') {
    return (
      <div className="ludo-container">
        <div className="truth-card setup ludo-result">
          <Trophy size={40} className="ludo-trophy" />
          <p className="kicker">PIQUE · FIN DE PARTIE</p>
          <h1>
            {state.mode === 'team'
              ? state.winningTeam
                ? `L’équipe ${state.winningTeam} remporte la partie !`
                : 'Égalité : aucune équipe ne l’emporte !'
              : `${winnerName} remporte la partie !`}
          </h1>
          {state.mode === 'team' && (
            <p className="pique-team-result">
              Équipe A : {state.teamScores?.A?.points ?? 0} pts ({state.teamScores?.A?.tricks ?? 0} plis) · Équipe B :{' '}
              {state.teamScores?.B?.points ?? 0} pts ({state.teamScores?.B?.tricks ?? 0} plis)
            </p>
          )}
          <p>
            {state.tricks.length} plis · Contrat de {state.contract?.plis ?? 0} {state.contract?.nil ? 'nil' : 'réussi'} par{' '}
            {contractPlayerName ?? 'le joueur'}
          </p>
          <div className="pique-live-panel pique-breakdown">
            <p className="pique-table-title">Détail des scores</p>
            <div className="pique-live-rows">
              {breakdown.map((entry) => (
                <div key={entry.id} className="pique-live-row">
                  <span className="pique-live-name">
                    {entry.name}
                    {entry.team && <span className={`pique-team-badge ${entry.team.toLowerCase()}`}>Éq. {entry.team}</span>}
                  </span>
                  <span className={`pique-live-contract ${entry.contractLabel === 'nil' ? 'nilpick' : entry.contractLabel === 'non annoncé' ? 'pending' : ''}`}>
                    {entry.contractLabel}
                  </span>
                  <span className="pique-live-tricks">{entry.won} pli{entry.won === 1 ? '' : 's'}</span>
                  <span className={`pique-live-nil ${entry.penalty ? 'failed' : 'ongoing'}`}>{entry.resultLabel}</span>
                  {entry.bagLabel && <span className={`pique-live-bags ${entry.bagPenalty ? 'penalty' : ''}`}>{entry.bagLabel}</span>}
                  <span className={`pique-live-points ${entry.final < 0 ? 'negative' : ''}`}>
                    {entry.final > 0 ? '+' : ''}{entry.final} pts
                  </span>
                </div>
              ))}
            </div>
            {penaltyLines.length > 0 && (
              <p className="pique-penalties-summary">Pénalités appliquées : {penaltyLines.join(' · ')}</p>
            )}
          </div>
          {me.isHost && (
            <button className="launch" onClick={() => void act('replay')}>
              <RotateCcw size={16} /> Rejouer
            </button>
          )}
        </div>
      </div>
    )
  }

  const trickPlays = state.currentTrick
  const isMyTurnPlaying = state.phase === 'playing' && state.currentPlayerId === me.id

  return (
    <div className="ludo-container">
      <div className="ludo-header">
        <p className="kicker">PIQUE · EN LIGNE</p>
        <h1>Partie de Pique</h1>
        <div className="ludo-players">
          {state.turnOrder.map((id, index) => {
            const display = snapshot.players.find((player) => player.id === id)
            const isActive = state.phase === 'playing' && state.currentPlayerId === id
            const isWinner = state.winnerId === id || (state.mode === 'team' && state.winningTeam !== null && state.teams?.[state.winningTeam]?.includes(id))
            const score = state.scores[String(id)]
            const announcement = state.announcements[String(id)]
            const live = liveScores[String(id)] ?? { points: 0, tricks: 0, bags: 0, nilStatus: null }
            const team = state.mode === 'team' ? (state.teams?.A?.includes(id) ? 'A' : state.teams?.B?.includes(id) ? 'B' : null) : null
            const color = ['red', 'blue', 'green', 'yellow'][index % 4] ?? 'red'
            return (
              <div key={id} className={`ludo-player ${isActive ? 'active' : ''} ${isWinner ? 'winner' : ''}`}>
                <Crown size={14} className="crown-icon" />
                <span className={`ludo-dot ${color}`} />
                {display?.displayName ?? `Joueur ${id}`}
                {team && <span className={`pique-team-badge ${team.toLowerCase()}`}>Éq. {team}</span>}
                <span className="ludo-player-score">
                  {state.phase === 'finished'
                    ? `${score ? `${score.points > 0 ? '+' : ''}${score.points}` : '0'} pts · ${score?.tricks ?? 0} plis`
                    : announcement
                      ? `${announcement.nil ? 'nil' : `contrat ${announcement.plis}`} · ${live.tricks} plis · ${live.points > 0 ? '+' : ''}${live.points} pts`
                      : 'annonce…'}
                </span>
              </div>
            )
          })}
        </div>
        {state.mode === 'team' && (
          <div className="pique-team-scores">
            <span className="pique-team-chip a">
              Équipe A · {(state.teams?.A ?? []).reduce((sum, id) => sum + (liveScores[String(id)]?.points ?? 0), 0)} pts
            </span>
            <span className="pique-team-chip b">
              Équipe B · {(state.teams?.B ?? []).reduce((sum, id) => sum + (liveScores[String(id)]?.points ?? 0), 0)} pts
            </span>
          </div>
        )}
      </div>

      <div className="ludo-timer-bar">
        <Crown size={16} />
        {state.phase === 'announce' && <span className="timer-idle">En attente des annonces…</span>}
        {state.phase === 'playing' && <span className={isMyTurnPlaying ? 'timer-idle' : ''}>{state.status === 'announced' ? 'Posez votre carte' : 'En attente…'}</span>}
        <span className="ludo-turn-count">Tour #{state.turnCount}</span>
      </div>

      <div className="pique-live-panel">
        <p className="pique-table-title">Scores en temps réel (provisoires)</p>
        <div className="pique-live-rows">
          {state.turnOrder.map((id) => {
            const display = snapshot.players.find((player) => player.id === id)
            const ann = state.announcements[String(id)]
            const live = liveScores[String(id)] ?? { points: 0, tricks: 0, bags: 0, nilStatus: null }
            const team = state.mode === 'team' ? (state.teams?.A?.includes(id) ? 'A' : state.teams?.B?.includes(id) ? 'B' : null) : null
            return (
              <div key={id} className="pique-live-row">
                <span className="pique-live-name">
                  {display?.displayName ?? `Joueur ${id}`}
                  {team && <span className={`pique-team-badge ${team.toLowerCase()}`}>Éq. {team}</span>}
                </span>
                <span className={`pique-live-contract ${ann ? (ann.nil ? 'nilpick' : '') : 'pending'}`}>
                  {ann ? (ann.nil ? 'nil choisi' : `contrat ${ann.plis}`) : 'pas encore annoncé'}
                </span>
                <span className="pique-live-tricks">{live.tricks} pli{live.tricks === 1 ? '' : 's'}</span>
                {ann?.nil ? (
                  <span className={`pique-live-nil ${live.nilStatus === 'failed' ? 'failed' : 'ongoing'}`}>
                    {live.nilStatus === 'failed' ? 'nil raté' : 'nil en cours'}
                  </span>
                ) : live.bags > 0 ? (
                  <span className="pique-live-bags">+{live.bags} sacs</span>
                ) : null}
                <span className={`pique-live-points ${live.points < 0 ? 'negative' : ''}`}>
                  {live.points > 0 ? '+' : ''}{live.points} pts
                </span>
              </div>
            )
          })}
        </div>
        <p className="pique-live-summary">
          {state.tricks.length} plis joués · Nils choisis : {nilCount}
        </p>
      </div>

      <div className="ludo-board-panel">
        {actionFeedback && <p className="feedback">{actionFeedback}</p>}

        {state.phase === 'announce' && isMyAnnounceTurn && (
          <div className="pique-announce">
            <p className="pique-announce-title">Annoncez votre contrat avant le début de la partie.</p>
            <div className="pique-announce-row">
              <label className="pique-announce-field">
                <span>Nombre de plis</span>
                <input
                  type="number"
                  min={nilInput ? 0 : 1}
                  max={maxPlis}
                  value={nilInput ? '0' : (plisInput === '0' ? '1' : plisInput)}
                  disabled={nilInput}
                  onChange={(event) => {
                    const v = event.target.value
                    if (v === '') { setPlisInput('1'); return }
                    const n = Math.trunc(Number(v))
                    setPlisInput(String(Math.max(1, Math.min(Number.isFinite(n) ? n : 1, maxPlis))))
                  }}
                  className="pique-announce-input"
                  aria-label="Nombre de plis annoncés"
                />
              </label>
              <label className="pique-announce-nil">
                <input
                  type="checkbox"
                  checked={nilInput}
                  onChange={(event) => {
                    const checked = event.target.checked
                    setNilInput(checked)
                    if (checked) setPlisInput('0')
                    else if (Number(plisInput) < 1) setPlisInput('1')
                  }}
                />
                <span>Nil (0 pli)</span>
              </label>
              <button className="launch" disabled={!nilInput && (Number(plisInput) < 1 || !Number.isFinite(Number(plisInput)))} onClick={() => announce(nilInput, nilInput ? 0 : Math.max(1, Math.min(Math.trunc(Number(plisInput) || 1), maxPlis)))}>
                Annoncer
              </button>
            </div>
            <p className="pique-announce-help">
              {nilInput
                ? 'Vous annoncez que vous ne remporterez aucun pli : +100 points si vous réussissez, −100 sinon.'
                : `En dessous de ${plisInput || 0} plis ou au-delà du double (${2 * (Number(plisInput) || 0)}), la pénalité est de 10 points par pli demandé.`}
            </p>
          </div>
        )}

        {state.phase === 'announce' && (
          <div className="pique-hand">
            <p className="pique-table-title">
              {isMyAnnounceTurn ? 'Vos cartes — évaluez votre contrat' : 'Votre main'}
            </p>
            <div className="pique-hand-grid">
              {myHand.map((card) => (
                <PiqueCardView key={card} card={card} playable={false} />
              ))}
            </div>
          </div>
        )}

        {state.phase === 'playing' && (
          <div className="pique-table">
            <p className="pique-table-title">Pli en cours</p>
            {trickPlays.length === 0 ? (
              <p className="pique-table-empty">En attente de la première carte…</p>
            ) : (
              <>
                <p className="pique-led-suit">
                  Couleur demandée :{' '}
                  <strong className={trickPlays[0]!.card[0] === 'H' || trickPlays[0]!.card[0] === 'D' ? 'red' : 'black'}>
                    {SUIT_SYMBOLS[trickPlays[0]!.card[0]] ?? '•'} {SUIT_NAMES[trickPlays[0]!.card[0]] ?? ''}
                  </strong>
                  {trickPlays[0]!.card[0] === 'S' ? ' (atout — tout le monde doit suivre)' : ''}
                </p>
                <div className="pique-trick">
                  {trickPlays.map((play, index) => {
                    const player = snapshot.players.find((item) => item.id === play.playerId)
                    return (
                      <div key={index} className={`pique-trick-play ${index === 0 ? 'lead' : ''}`}>
                        <span className="pique-trick-player">{player?.displayName ?? `Joueur ${play.playerId}`}</span>
                        <PiqueCardView card={play.card} />
                        {index === 0 ? (
                          <span className="pique-led-badge">Mène</span>
                        ) : (
                          <span className="pique-led-badge empty" aria-hidden="true">&nbsp;</span>
                        )}
                      </div>
                    )
                  })}
                </div>
              </>
            )}
          </div>
        )}

        {state.phase === 'playing' && isMyPlayTurn && (
          <div className="pique-hand">
            <p className="pique-table-title">Votre main — cliquez sur une carte pour jouer</p>
            <div className="pique-hand-grid">
              {myHand.map((card) => (
                <PiqueCardView key={card} card={card} playable={myLegalCards.includes(card)} onPlay={playCard} />
              ))}
            </div>
            {actionFeedback && <p className="feedback">{actionFeedback}</p>}
          </div>
        )}

        {state.phase === 'playing' && !isMyPlayTurn && <p className="pique-hint">Posez votre carte pour suivre le pli en cours.</p>}
      </div>

      <div className="ludo-history">
        {state.moveHistory.length > 0 && (
          <details>
            <summary>
              <Crown size={14} /> Historique ({state.moveHistory.length} plis)
            </summary>
            <div className="ludo-history-list">
              {state.moveHistory.map((entry, index) => (
                <p key={index} className="ludo-history-entry">
                  <span className="ludo-move-num">{index + 1}.</span> {entry}
                </p>
              ))}
            </div>
          </details>
        )}
      </div>

      <div className="ludo-chat">
        <div className="ludo-chat-header">
          <MessageCircle size={16} /> Chat
        </div>
        <div className="ludo-chat-messages">
          {state.chatMessages.length === 0 && <p className="ludo-chat-empty">Aucun message. Échangez avec vos adversaires !</p>}
          {state.chatMessages.map((msg, index) => {
            const sender = snapshot.players.find((player) => player.id === msg.senderId)
            return (
              <div key={index} className={`ludo-chat-msg ${msg.senderId === me.id ? 'own' : 'other'}`}>
                <strong>{sender?.displayName ?? 'Inconnu'}</strong>
                {msg.text ? <span>{msg.text}</span> : null}
                <ChatAudioPlayer audio={msg.audio} />
              </div>
            )
          })}
          <div ref={chatEndRef} />
        </div>
        <div className="ludo-chat-input">
          <input value={chatInput} onChange={(event) => setChatInput(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && sendChat()} placeholder="Message ou note vocale..." maxLength={400} />
          <VoiceRecordButton sessionCode={sessionCode} onSend={async (payload) => sendChat(payload)} />
          <button className="ghost" onClick={() => sendChat()} disabled={!chatInput.trim()}>
            <Send size={16} />
          </button>
        </div>
      </div>

      {state.phase === 'playing' && (
        <p className={`ludo-turn-indicator ${isMyTurnPlaying ? '' : 'waiting'}`}>
          {isMyTurnPlaying ? <Crown size={14} /> : <Crown size={14} />}
          {isMyTurnPlaying ? 'C’est votre tour : choisissez une carte de votre main.' : `En attente du coup de ${snapshot.players.find((player) => player.id === state.currentPlayerId)?.displayName ?? 'l’adversaire'}…`}
        </p>
      )}
    </div>
  )
}
