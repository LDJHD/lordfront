'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Clock, Crown, Dices, History, MessageCircle, RotateCcw, Send, Trophy } from 'lucide-react'
import { onlineAction, type OnlineSnapshot } from './online-api'
import { resumeAudio } from './game-sounds'
import { ChatAudioPlayer, VoiceRecordButton, type ChatAudio } from './voice-chat'

type LudoPawn = { home: number; track: number | null; finished: boolean }
type LudoPlayerEntry = { id: number; color: string; pawns: LudoPawn[] }
type LudoState = {
  phase: 'playing' | 'finished'
  players: LudoPlayerEntry[]
  turnOrder: number[]
  turnIndex: number
  currentPlayerId: number | null
  status: 'idle' | 'rolled'
  lastRolls: [number, number] | null
  lastRollAt: string | null
  lastRollerId: number | null
  diceUsed: [boolean, boolean]
  extraRoll: boolean
  lastRollPassed: boolean
  consecutiveSixes: number
  turnStartAt: string | null
  turnCount: number
  winnerId: number | null
  moveHistory: string[]
  chatMessages: { senderId: number; text: string; timestamp: string; audio?: ChatAudio }[]
}

type LudoDieOption = {
  dice: number[]
  amount: number
  moves: { pawnIndex: number; target: number }[]
}

function sameDice(first: number[] | null, second: number[] | null) {
  if (!first || !second || first.length !== second.length) return false
  return first.every((die) => second.includes(die))
}

const LUDU_PAWN_COUNT = 4
const LUDU_HOME_COLUMN_START = 51
const LUDU_FINAL_POSITION = 56
const LUDU_RING_SIZE = 52
const TURN_TIME_LIMIT = 5 * 60 * 1000
const WARNING_TIME = 4 * 60 * 1000

type BoardColor = 'red' | 'green' | 'yellow' | 'blue'
const BOARD_COLORS: BoardColor[] = ['red', 'green', 'blue', 'yellow']

const COLOR_LABELS: Record<string, string> = {
  red: 'rouge',
  green: 'vert',
  blue: 'bleu',
  yellow: 'jaune',
}

// Les 4 cases de départ, décalées de 13 cases sur la piste de 52 cases.
const START_INDEX: Record<string, number> = { red: 1, green: 14, yellow: 27, blue: 40 }
// Cases sûres : les 4 départs + les 4 étoiles (8 cases après chaque départ).
const SAFE_RING_CELLS = new Set([1, 9, 14, 22, 27, 35, 40, 48])
const STAR_COLOR_BY_RING: Record<number, BoardColor> = { 9: 'red', 22: 'green', 35: 'yellow', 48: 'blue' }

// Plateau classique 15x15 : la piste est une boucle de 52 cases.
const RING_CELLS: ReadonlyArray<readonly [number, number]> = [
  [6, 0], [6, 1], [6, 2], [6, 3], [6, 4], [6, 5],
  [5, 6], [4, 6], [3, 6], [2, 6], [1, 6], [0, 6],
  [0, 7],
  [0, 8], [1, 8], [2, 8], [3, 8], [4, 8], [5, 8],
  [6, 9], [6, 10], [6, 11], [6, 12], [6, 13], [6, 14],
  [7, 14],
  [8, 14], [8, 13], [8, 12], [8, 11], [8, 10], [8, 9],
  [9, 8], [10, 8], [11, 8], [12, 8], [13, 8], [14, 8],
  [14, 7],
  [14, 6], [13, 6], [12, 6], [11, 6], [10, 6], [9, 6],
  [8, 5], [8, 4], [8, 3], [8, 2], [8, 1], [8, 0],
  [7, 0],
]

// Colonnes finales privées (5 cases) menant au centre.
const HOME_COLUMNS: Record<string, ReadonlyArray<readonly [number, number]>> = {
  red: [[7, 1], [7, 2], [7, 3], [7, 4], [7, 5]],
  green: [[1, 7], [2, 7], [3, 7], [4, 7], [5, 7]],
  yellow: [[7, 13], [7, 12], [7, 11], [7, 10], [7, 9]],
  blue: [[13, 7], [12, 7], [11, 7], [10, 7], [9, 7]],
}

// Les bases occupent 6x6 cases dans chaque coin.
const BASE_AREAS: Record<BoardColor, string> = {
  red: '1 / 1 / 7 / 7',
  green: '1 / 10 / 7 / 16',
  blue: '10 / 1 / 16 / 7',
  yellow: '10 / 10 / 16 / 16',
}

function formatTimer(ms: number): string {
  const seconds = Math.max(0, Math.ceil(ms / 1000))
  const minutes = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${minutes}:${String(secs).padStart(2, '0')}`
}

function ludoRingIndex(color: string, progress: number | null): number | null {
  if (progress === null) return null
  const start = START_INDEX[color]
  if (start === undefined) return null
  if (!Number.isInteger(progress) || progress < 0 || progress >= LUDU_HOME_COLUMN_START) return null
  return (start + progress) % LUDU_RING_SIZE
}

function cellKeyForPawn(color: string, track: number | null): string | null {
  if (track === null) return null
  if (track >= LUDU_HOME_COLUMN_START) {
    const home = HOME_COLUMNS[color]
    if (!home) return null
    const index = track - LUDU_HOME_COLUMN_START
    const cell = home[index]
    if (!cell) return null
    return `${cell[0]}-${cell[1]}`
  }
  const ringIndex = ludoRingIndex(color, track)
  if (ringIndex === null) return null
  const cell = RING_CELLS[ringIndex]
  if (!cell) return null
  return `${cell[0]}-${cell[1]}`
}

// Emplacement des points sur chaque face (en % du côté du dé).
const DIE_PIPS: Record<number, ReadonlyArray<readonly [number, number]>> = {
  1: [[50, 50]],
  2: [[30, 30], [70, 70]],
  3: [[26, 26], [50, 50], [74, 74]],
  4: [[30, 30], [70, 30], [30, 70], [70, 70]],
  5: [[28, 28], [72, 28], [50, 50], [28, 72], [72, 72]],
  6: [[30, 24], [70, 24], [30, 50], [70, 50], [30, 76], [70, 76]],
}

const DIE_FACE_CLASS: Record<number, string> = { 1: 'front', 2: 'top', 3: 'right', 4: 'left', 5: 'bottom', 6: 'back' }

// Orientation finale du cube pour présenter la face du résultat côté joueur.
const DIE_LANDING: Record<number, string> = {
  1: 'rotateX(-8deg) rotateY(12deg)',
  2: 'rotateX(-98deg) rotateY(6deg)',
  3: 'rotateX(-8deg) rotateY(-78deg)',
  4: 'rotateX(-8deg) rotateY(78deg)',
  5: 'rotateX(82deg) rotateY(6deg)',
  6: 'rotateX(-8deg) rotateY(192deg)',
}

// Vrai dé 3D : un cube avec ses 6 faces à points. Il tourne pendant le lancer puis se pose sur le résultat.
function Dice3D({ value, rolling, delayMs = 0, size = 'normal' }: { value: number; rolling: boolean; delayMs?: number; size?: 'normal' | 'big' }) {
  const [rotation, setRotation] = useState<string>(DIE_LANDING[value] ?? DIE_LANDING[1])

  useEffect(() => {
    if (!rolling) {
      setRotation(DIE_LANDING[value] ?? DIE_LANDING[1])
      return
    }
    const spin = () => {
      setRotation(
        `rotateX(${Math.round(Math.random() * 360)}deg) rotateY(${Math.round(Math.random() * 360)}deg) rotateZ(${Math.round(Math.random() * 160 - 80)}deg)`
      )
    }
    spin()
    const interval = window.setInterval(spin, 75)
    return () => window.clearInterval(interval)
  }, [rolling, value])

  const transition = rolling ? 'transform 75ms linear' : `transform ${760 + delayMs}ms cubic-bezier(.2,1.35,.28,1)`

  return (
    <div className={`ludo-die-wrap ${size === 'big' ? 'big' : ''} ${rolling ? 'rolling' : ''}`} role="img" aria-label={`Dé : ${value}`}>
      <div className="ludo-die-scene">
        <div className="ludo-die-cube" style={{ transform: rotation, transition }}>
          {[1, 2, 3, 4, 5, 6].map((face) => (
            <div key={face} className={`ludo-die-face ${DIE_FACE_CLASS[face]}`}>
              {DIE_PIPS[face].map(([x, y], index) => (
                <span key={index} className="ludo-die-pip" style={{ left: `${x}%`, top: `${y}%` }} />
              ))}
            </div>
          ))}
        </div>
      </div>
      <span className="ludo-die-shadow" aria-hidden="true" />
    </div>
  )
}

// Table de lancer permanente : les deux dés, le total et un message lisible par tous les joueurs.
function DiceTable({
  state,
  hasRolled,
  currentName,
  rollerName,
  isMyTurn,
  isMyRollTurn,
  rolling,
  restingRolls,
  dieOptions,
  selectedDice,
  onSelectDice,
  onRoll,
}: {
  state: LudoState
  hasRolled: boolean
  currentName: string
  rollerName: string
  isMyTurn: boolean
  isMyRollTurn: boolean
  rolling: boolean
  restingRolls: [number, number]
  dieOptions: LudoDieOption[]
  selectedDice: number[] | null
  onSelectDice: (dice: number[]) => void
  onRoll: () => void
}) {
  const rolls = state.lastRolls
  const display = rolls ?? restingRolls
  const isRolled = state.status === 'rolled' && rolls !== null
  const autoPassed = state.status === 'idle' && state.lastRollPassed && rolls !== null
  const pendingExtraRoll = state.status === 'idle' && state.extraRoll && state.currentPlayerId === state.lastRollerId
  const total = display[0] + display[1]
  const number = (value: number) => (rolling ? '?' : value)
  const selectedOption = dieOptions.find((option) => sameDice(option.dice, selectedDice)) ?? null
  const unused = rolls ? [0, 1].filter((index) => !(state.diceUsed?.[index] ?? true)) : []
  const doubleSix = Boolean(rolls && rolls[0] === 6 && rolls[1] === 6)
  const remainingText = unused.length ? unused.map((index) => rolls?.[index] ?? display[index]).join(' + ') : 'aucun dé'

  let headline: string
  if (rolling) headline = `${rollerName} lance les dés…`
  else if (isRolled) headline = `${rollerName} a fait ${rolls[0]} + ${rolls[1]} = ${rolls[0] + rolls[1]}`
  else if (pendingExtraRoll) headline = `Double 6 : ${rollerName} relance les dés`
  else if (autoPassed) headline = `${rollerName} a fait ${display[0]} + ${display[1]} = ${total}`
  else if (hasRolled) headline = `Dernier lancer : ${display[0]} + ${display[1]} = ${total}`
  else headline = 'Dés prêts sur la table'

  let advice: string
  if (rolling) advice = 'Les deux dés roulent sur la table…'
  else if (isRolled) {
    if (selectedOption) advice = `Déplacez un pion de ${selectedOption.amount} case${selectedOption.amount > 1 ? 's' : ''} (${selectedOption.dice.length === 2 ? `somme ${selectedOption.amount}` : `dé ${selectedOption.amount}`}).`
    else if (isMyTurn) advice = 'Choisissez un dé ou la somme ci-dessous, puis cliquez sur un pion.'
    else advice = `En attente : ${currentName} choisit un dé ou la somme (${remainingText}).`
  } else if (pendingExtraRoll) advice = isMyRollTurn ? 'Double 6 : à vous de relancer les dés.' : `Double 6 : ${currentName} va relancer les dés.`
  else if (autoPassed) advice = isMyRollTurn ? 'Aucun déplacement possible : à vous de relancer les dés.' : `Aucun déplacement possible : au tour de ${currentName} de relancer.`
  else if (isMyRollTurn) advice = 'Cliquez sur « Lancer les dés » pour commencer votre tour.'
  else advice = `En attente du lancer de ${currentName}.`

  const dieUsed = (index: number) => (isRolled ? Boolean(state.diceUsed?.[index]) : Boolean(hasRolled && state.status === 'idle'))

  return (
    <div className="ludo-dice-table">
      <div className="ludo-dice-table-head">
        <span className="ludo-dice-kicker">Table de lancer</span>
        <span className={`ludo-dice-badge ${isMyTurn ? 'mine' : ''}`}>{isMyTurn ? 'Votre tour' : `Tour de ${currentName}`}</span>
      </div>

      <div className="ludo-dice-stage">
        <div className={`ludo-die-slot ${dieUsed(0) ? 'used' : ''}`}>
          <Dice3D value={display[0]} rolling={rolling} />
          <span className={`ludo-die-number ${rolling ? 'pending' : ''}`}>{number(display[0])}</span>
        </div>
        <span className="ludo-dice-op">+</span>
        <div className={`ludo-die-slot ${dieUsed(1) ? 'used' : ''}`}>
          <Dice3D value={display[1]} rolling={rolling} delayMs={90} />
          <span className={`ludo-die-number ${rolling ? 'pending' : ''}`}>{number(display[1])}</span>
        </div>
        <span className="ludo-dice-op">=</span>
        <div className={`ludo-dice-total ${rolling ? 'pending' : ''}`}>
          <strong>{rolling ? '…' : total}</strong>
          <span>cases</span>
        </div>
      </div>

      {isRolled && rolls && (
        <div className="ludo-dice-choices" role="group" aria-label="Choisir un dé à jouer">
          {[0, 1].map((index) => {
            const used = Boolean(state.diceUsed?.[index])
            const option = dieOptions.find((item) => item.dice.length === 1 && item.dice[0] === index)
            const playable = Boolean(option && option.moves.length > 0)
            const selected = sameDice(selectedDice, [index])
            return (
              <button
                key={`die-choice-${index}`}
                type="button"
                className={`ludo-dice-choice ${selected ? 'selected' : ''} ${used ? 'used' : ''}`}
                disabled={!isMyTurn || used || !playable}
                onClick={() => onSelectDice([index])}
              >
                <span>Dé {index + 1}</span>
                <strong>{rolls[index]}</strong>
                <em>{used ? 'utilisé' : playable ? 'jouer' : 'bloqué'}</em>
              </button>
            )
          })}
          {unused.length === 2 && (
            <button
              type="button"
              className={`ludo-dice-choice sum ${sameDice(selectedDice, [0, 1]) ? 'selected' : ''}`}
              disabled={!isMyTurn || !(dieOptions.find((item) => item.dice.length === 2)?.moves.length)}
              onClick={() => onSelectDice([0, 1])}
            >
              <span>Somme</span>
              <strong>{rolls[0] + rolls[1]}</strong>
              <em>{dieOptions.find((item) => item.dice.length === 2)?.moves.length ? 'jouer' : 'bloqué'}</em>
            </button>
          )}
        </div>
      )}

      <p className="ludo-dice-headline" aria-live="polite">
        {headline}
      </p>
      <p className="ludo-dice-advice">{advice}</p>
      {isRolled && doubleSix && <p className="ludo-dice-six">Double 6 : une relance sera accordée après avoir utilisé les deux dés.</p>}

      {isMyRollTurn && (
        <button className="launch ludo-dice-roll" onClick={onRoll}>
          <Dices size={18} /> Lancer les dés
        </button>
      )}
    </div>
  )
}

// Gros plan sur le plateau : les dés roulent au centre de la table, puis affichent leur résultat.
function DiceBoardOverlay({ rolls, rolling, rollerName }: { rolls: [number, number]; rolling: boolean; rollerName: string }) {
  const total = rolls[0] + rolls[1]
  return (
    <div className="ludo-dice-overlay" aria-hidden="true">
      <div className="ludo-dice-overlay-stage">
        <span className="ludo-dice-kicker">Lancer sur la table</span>
        <div className="ludo-dice-overlay-row">
          <Dice3D value={rolls[0]} rolling={rolling} size="big" />
          <span className="ludo-dice-op big">+</span>
          <Dice3D value={rolls[1]} rolling={rolling} size="big" delayMs={90} />
          <span className="ludo-dice-op big">=</span>
          <strong className="ludo-dice-overlay-total">{rolling ? '…' : total}</strong>
        </div>
        <p className="ludo-dice-overlay-msg">{rolling ? `${rollerName} lance les dés…` : `${rollerName} a fait ${rolls[0]} + ${rolls[1]} = ${total}`}</p>
      </div>
    </div>
  )
}

export default function LudoGameOnline({
  sessionCode,
  snapshot,
  onUpdate,
}: {
  sessionCode: string
  snapshot: OnlineSnapshot
  onUpdate: (data: OnlineSnapshot) => void
}) {
  const state = snapshot.gameState as unknown as LudoState
  const me = snapshot.me
  const chatEndRef = useRef<HTMLDivElement>(null)
  const savedResult = useRef(false)

  const [chatInput, setChatInput] = useState('')
  const [now, setNow] = useState(Date.now())
  const [actionFeedback, setActionFeedback] = useState('')
  const rollKey = state.lastRolls ? state.lastRollAt ?? `${state.lastRolls.join('-')}-${state.turnCount}` : null
  const [diceRolling, setDiceRolling] = useState(false)
  const [showDiceOverlay, setShowDiceOverlay] = useState(false)
  const [restingRolls, setRestingRolls] = useState<[number, number]>(() => state.lastRolls ?? [1, 1])
  const [hasRolled, setHasRolled] = useState<boolean>(() => state.lastRolls !== null)
  const [selectedDice, setSelectedDice] = useState<number[] | null>(null)
  const lastAnimatedRollRef = useRef<string | null>(rollKey)

  // Chaque nouveau lancer (même quand le tour passe automatiquement) déclenche la
  // rotation sur la table, puis on laisse le résultat affiché quelques secondes.
  useEffect(() => {
    if (!rollKey) return
    if (lastAnimatedRollRef.current === rollKey) return
    lastAnimatedRollRef.current = rollKey
    setDiceRolling(true)
    setShowDiceOverlay(true)
    const settleTimer = window.setTimeout(() => setDiceRolling(false), 1150)
    const hideTimer = window.setTimeout(() => setShowDiceOverlay(false), 3400)
    return () => {
      window.clearTimeout(settleTimer)
      window.clearTimeout(hideTimer)
    }
  }, [rollKey])

  useEffect(() => {
    if (!state.lastRolls) return
    setRestingRolls(state.lastRolls)
    setHasRolled(true)
  }, [state.lastRolls])

  const myEntry = useMemo(() => state.players.find((player) => player.id === me.id) ?? null, [state.players, me.id])

  const isMyTurn = state.phase === 'playing' && state.currentPlayerId === me.id
  const isMyRollTurn = isMyTurn && state.status === 'idle'
  const isMyMoveTurn = isMyTurn && state.status === 'rolled' && state.lastRolls !== null

  const dieOptions = useMemo<LudoDieOption[]>(() => {
    if (state.phase !== 'playing' || state.status !== 'rolled' || state.lastRolls === null || !myEntry) return []
    const used = state.diceUsed ?? [true, true]
    const unused = [0, 1].filter((index) => !used[index])
    const movesFor = (amount: number, allowBaseExit: boolean) => {
      const moves: { pawnIndex: number; target: number }[] = []
      const bounce = (from: number) => {
        const raw = from + amount
        return raw > LUDU_FINAL_POSITION ? 2 * LUDU_FINAL_POSITION - raw : raw
      }
      myEntry.pawns.forEach((pawn, pawnIndex) => {
        if (pawn.finished) return
        const from = pawn.track
        if (from === null) {
          if (allowBaseExit) moves.push({ pawnIndex, target: 0 })
          return
        }
        const destination = bounce(from)
        if (destination > LUDU_FINAL_POSITION) return
        const blockedByOwnPawn = myEntry.pawns.some((other, otherIndex) => otherIndex !== pawnIndex && !other.finished && other.track === destination)
        if (blockedByOwnPawn) return
        if (destination >= LUDU_HOME_COLUMN_START) {
          moves.push({ pawnIndex, target: destination })
          return
        }
        const ringIndex = ludoRingIndex(myEntry.color, destination)
        if (ringIndex !== null) {
          const enemyPawn = state.players.some(
            (player) =>
              player.id !== me.id &&
              player.pawns.some((other) => !other.finished && other.track !== null && ludoRingIndex(player.color, other.track) === ringIndex)
          )
          if (enemyPawn && SAFE_RING_CELLS.has(ringIndex)) return
        }
        moves.push({ pawnIndex, target: destination })
      })
      return moves
    }
    const options: LudoDieOption[] = []
    for (const index of unused) {
      const value = state.lastRolls[index]
      options.push({ dice: [index], amount: value, moves: movesFor(value, value === 6) })
    }
    if (unused.length === 2) {
      const amount = state.lastRolls[0] + state.lastRolls[1]
      options.push({ dice: [0, 1], amount, moves: movesFor(amount, false) })
    }
    return options
  }, [state, myEntry, me.id])

  // Sélection automatique quand un seul dé est jouable ; sinon le joueur choisit.
  useEffect(() => {
    const playable = dieOptions.filter((option) => option.moves.length > 0)
    setSelectedDice((previous) => {
      if (previous) {
        const match = playable.find((option) => sameDice(option.dice, previous))
        if (match) return previous
      }
      return playable.length === 1 ? playable[0].dice : null
    })
  }, [dieOptions])

  const selectedOption = useMemo(
    () => dieOptions.find((option) => sameDice(option.dice, selectedDice)) ?? null,
    [dieOptions, selectedDice]
  )
  const legalMoves = selectedOption?.moves ?? []

  const movablePawnIndices = useMemo(() => new Set(legalMoves.map((move) => move.pawnIndex)), [legalMoves])

  const pawnsByCell = useMemo(() => {
    const map = new Map<string, Array<{ player: LudoPlayerEntry; pawnIndex: number }>>()
    for (const player of state.players) {
      player.pawns.forEach((pawn, pawnIndex) => {
        if (pawn.finished || pawn.track === null) return
        const key = cellKeyForPawn(player.color, pawn.track)
        if (!key) return
        const occupants = map.get(key) ?? []
        occupants.push({ player, pawnIndex })
        map.set(key, occupants)
      })
    }
    return map
  }, [state.players])

  const targetCells = useMemo(() => {
    const map = new Map<string, { capture: boolean }>()
    if (!myEntry) return map
    for (const move of legalMoves) {
      const key = cellKeyForPawn(myEntry.color, move.target)
      if (!key) continue
      let capture = false
      const ringIndex = ludoRingIndex(myEntry.color, move.target)
      if (ringIndex !== null) {
        capture = state.players.some(
          (player) =>
            player.id !== me.id &&
            player.pawns.some((pawn) => !pawn.finished && ludoRingIndex(player.color, pawn.track) === ringIndex)
        )
      }
      map.set(key, { capture })
    }
    return map
  }, [legalMoves, myEntry, state.players, me.id])

  useEffect(() => {
    if (state.phase !== 'playing') return
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [state.phase])

  const elapsed = state.turnStartAt ? now - new Date(state.turnStartAt).getTime() : 0
  const showWarning = state.phase === 'playing' && elapsed >= WARNING_TIME && elapsed < TURN_TIME_LIMIT
  const showDanger = state.phase === 'playing' && elapsed >= TURN_TIME_LIMIT

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

  function playPawn(pawnIndex: number) {
    const move = legalMoves.find((item) => item.pawnIndex === pawnIndex)
    if (!move || !selectedOption) return
    void act('move', { pawnIndex, target: move.target, dice: selectedOption.dice })
  }

  function handleCellClick(cellKey: string) {
    if (!isMyMoveTurn) return
    const occupants = pawnsByCell.get(cellKey) ?? []
    const mine = occupants.find((entry) => entry.player.id === me.id && movablePawnIndices.has(entry.pawnIndex))
    if (mine) playPawn(mine.pawnIndex)
  }

  function sendChat(payload?: { audioUrl: string; audioMime?: string; audioDurationMs?: number }) {
    if (!payload && !chatInput.trim()) return
    void act('chat', payload ?? { text: chatInput.trim() })
    if (!payload) setChatInput('')
  }

  function renderPawns(cellKey: string) {
    const occupants = pawnsByCell.get(cellKey) ?? []
    if (!occupants.length) return null
    return (
      <span className={`ludo-pawn-stack ${occupants.length > 1 ? 'multi' : ''}`}>
        {occupants.map(({ player, pawnIndex }) => {
          const movable = player.id === me.id && movablePawnIndices.has(pawnIndex)
          return (
            <span
              key={`${player.id}-${pawnIndex}`}
              className={`ludo-pawn ${player.color} ${movable ? 'movable' : ''}`}
              onClick={
                movable
                  ? (event) => {
                      event.stopPropagation()
                      playPawn(pawnIndex)
                    }
                  : undefined
              }
              role={movable ? 'button' : undefined}
              aria-label={movable ? 'Déplacer ce pion' : undefined}
            />
          )
        })}
      </span>
    )
  }

  const winnerPlayer = state.players.find((player) => player.id === state.winnerId) ?? null
  const winnerName = winnerPlayer ? snapshot.players.find((item) => item.id === winnerPlayer.id)?.displayName ?? 'Un joueur' : 'Un joueur'

  if (state.phase === 'finished') {
    return (
      <div className="ludo-container">
        <div className="truth-card setup ludo-result">
          <Trophy size={40} className="ludo-trophy" />
          <p className="kicker">LUDO · FIN DE PARTIE</p>
          <h1>{winnerName} remporte la partie !</h1>
          <p>{state.moveHistory.length} coups joués · Tour #{state.turnCount}</p>
          {me.isHost && (
            <button className="launch" onClick={() => void act('replay')}>
              <RotateCcw size={16} /> Rejouer
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="ludo-container">
      <div className="ludo-header">
        <p className="kicker">LUDO · EN LIGNE</p>
        <h1>Plateau de Ludo</h1>
        <div className="ludo-players">
          {state.players.map((player) => {
            const display = snapshot.players.find((item) => item.id === player.id)
            const isActive = state.phase === 'playing' && state.currentPlayerId === player.id
            const isWinner = state.winnerId === player.id
            const finishedCount = player.pawns.filter((pawn) => pawn.finished).length
            return (
              <div key={player.id} className={`ludo-player ${isActive ? 'active' : ''} ${isWinner ? 'winner' : ''}`}>
                <span className={`ludo-dot ${player.color}`} />
                {display?.displayName ?? `Joueur ${player.id}`}
                <span className="ludo-player-score">{finishedCount}/{LUDU_PAWN_COUNT}</span>
                {isWinner && <Crown size={16} className="crown-icon" />}
              </div>
            )
          })}
        </div>
      </div>

      <div className="ludo-timer-bar">
        <Clock size={16} />
        {state.status === 'rolled' && <span className={showDanger ? 'timer-danger' : showWarning ? 'timer-warning' : ''}>{formatTimer(TURN_TIME_LIMIT - elapsed)}</span>}
        {state.status === 'idle' && <span className="timer-idle">{state.extraRoll && state.currentPlayerId === state.lastRollerId ? 'Double 6 : relance à venir…' : 'En attente du prochain lancer…'}</span>}
        <span className="ludo-turn-count">Tour #{state.turnCount}</span>
      </div>

      <div className="ludo-board-panel">
        <DiceTable
          state={state}
          currentName={snapshot.players.find((player) => player.id === state.currentPlayerId)?.displayName ?? 'Le joueur'}
          rollerName={snapshot.players.find((player) => player.id === state.lastRollerId)?.displayName ?? 'Le joueur'}
          hasRolled={hasRolled}
          isMyTurn={isMyTurn}
          isMyRollTurn={isMyRollTurn}
          rolling={diceRolling}
          restingRolls={restingRolls}
          dieOptions={dieOptions}
          selectedDice={selectedDice}
          onSelectDice={setSelectedDice}
          onRoll={() => void act('roll')}
        />
        {actionFeedback && <p className="feedback">{actionFeedback}</p>}
        {isMyMoveTurn && selectedOption && legalMoves.length > 0 && (
          <p className="ludo-hint">Dé {selectedOption.amount} sélectionné : cliquez sur un pion en surbrillance (base ou plateau) pour le déplacer.</p>
        )}
        {isMyMoveTurn && !selectedOption && dieOptions.some((option) => option.moves.length > 0) && (
          <p className="ludo-hint">Choisissez d’abord un dé ou la somme, puis déplacez un pion.</p>
        )}
      </div>

      <div className="ludo-board-wrap">
        <div className="ludo-board" aria-label="Plateau de Ludo">
          {BOARD_COLORS.map((color) => {
            const player = state.players.find((entry) => entry.color === color) ?? null
            const isActiveBase = Boolean(player && state.phase === 'playing' && state.currentPlayerId === player.id)
            return (
              <div key={`base-${color}`} className={`ludo-base ${color} ${isActiveBase ? 'active' : ''}`} style={{ gridArea: BASE_AREAS[color] }}>
                <div className="ludo-base-inner">
                  {Array.from({ length: LUDU_PAWN_COUNT }, (_, pawnIndex) => {
                    const pawn = player?.pawns[pawnIndex] ?? null
                    const inBase = Boolean(pawn && pawn.track === null && !pawn.finished)
                    const movable = Boolean(player && inBase && player.id === me.id && movablePawnIndices.has(pawnIndex))
                    return (
                      <button
                        key={pawnIndex}
                        type="button"
                        className={`ludo-base-slot ${movable ? 'movable' : ''}`}
                        onClick={() => movable && playPawn(pawnIndex)}
                        disabled={!movable}
                        aria-label={movable ? 'Faire sortir ce pion' : `Emplacement ${pawnIndex + 1} ${COLOR_LABELS[color] ?? color}`}
                      >
                        {player && inBase && <span className={`ludo-pawn ${player.color} ${movable ? 'movable' : ''}`} />}
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}

          {RING_CELLS.map(([row, col], index) => {
            const key = `${row}-${col}`
            const startColor = Object.keys(START_INDEX).find((color) => START_INDEX[color] === index)
            const starColor = STAR_COLOR_BY_RING[index]
            const target = targetCells.get(key)
            return (
              <div
                key={`ring-${key}`}
                className={`ludo-sq ${startColor ? `start ${startColor}` : ''} ${target ? (target.capture ? 'capture' : 'target') : ''}`}
                style={{ gridRow: row + 1, gridColumn: col + 1 }}
                onClick={() => handleCellClick(key)}
              >
                {starColor && <span className={`ludo-star ${starColor}`}>★</span>}
                {renderPawns(key)}
              </div>
            )
          })}

          {Object.keys(HOME_COLUMNS).flatMap((color) =>
            HOME_COLUMNS[color].map(([row, col]) => {
              const key = `${row}-${col}`
              const target = targetCells.get(key)
              return (
                <div
                  key={`home-${key}`}
                  className={`ludo-sq home ${color} ${target ? (target.capture ? 'capture' : 'target') : ''}`}
                  style={{ gridRow: row + 1, gridColumn: col + 1 }}
                  onClick={() => handleCellClick(key)}
                >
                  {renderPawns(key)}
                </div>
              )
            })
          )}

          <div className="ludo-center" style={{ gridArea: '7 / 7 / 10 / 10' }}>
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
              <polygon points="50,50 0,0 100,0" fill="#00a030" stroke="#ffffff" strokeWidth="1.6" />
              <polygon points="50,50 100,0 100,100" fill="#fff000" stroke="#ffffff" strokeWidth="1.6" />
              <polygon points="50,50 100,100 0,100" fill="#00b0ff" stroke="#ffffff" strokeWidth="1.6" />
              <polygon points="50,50 0,100 0,0" fill="#ff0000" stroke="#ffffff" strokeWidth="1.6" />
            </svg>
          </div>

          {showDiceOverlay && state.lastRolls && (
            <DiceBoardOverlay
              key={`overlay-${state.lastRolls.join('-')}-${state.turnCount}-${state.consecutiveSixes}`}
              rolls={state.lastRolls}
              rolling={diceRolling}
              rollerName={snapshot.players.find((player) => player.id === state.lastRollerId)?.displayName ?? 'Le joueur'}
            />
          )}
        </div>
      </div>

      <div className="ludo-history">
        {state.moveHistory.length > 0 && (
          <details>
            <summary>
              <History size={14} /> Historique ({state.moveHistory.length} coups)
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

      {isMyTurn && state.phase === 'playing' && (
        <p className={`ludo-turn-indicator ${isMyRollTurn || isMyMoveTurn ? '' : 'waiting'}`}>
          {isMyRollTurn ? <Dices size={14} /> : <Crown size={14} />}
          {isMyRollTurn ? 'Cliquez sur « Lancer les dés » pour commencer votre tour.' : 'C’est votre tour : cliquez sur un pion en surbrillance pour jouer.'}
        </p>
      )}
      {!isMyTurn && state.phase === 'playing' && (
        <p className="ludo-turn-indicator waiting">
          <Clock size={14} /> En attente du coup de{' '}
          {snapshot.players.find((player) => player.id === state.currentPlayerId)?.displayName ?? 'l’adversaire'}…
        </p>
      )}
    </div>
  )
}
