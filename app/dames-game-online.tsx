'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Clock,
  Crown,
  History,
  Medal,
  MessageCircle,
  Pause,
  Play,
  RefreshCw,
  RotateCcw,
  Send,
  SkipForward,
} from 'lucide-react'
import { onlineAction, type OnlineSnapshot } from './online-api'
import {
  playDamesMoveSound,
  playDamesCaptureSound,
  playDamesKingSound,
  playDamesWinSound,
  playDamesWarningSound,
  playDamesPauseSound,
  playDamesResumeSound,
  resumeAudio,
} from './game-sounds'

type DamesState = {
  phase: 'playing' | 'paused' | 'finished'
  board: number[][]
  currentPlayer: 1 | 2
  whitePlayerId: number | null
  blackPlayerId: number | null
  turnStartAt: string | null
  moveHistory: string[]
  winner: 1 | 2 | 'draw' | null
  chatMessages: { senderId: number; text: string; timestamp: string }[]
  pauseRequestedBy: number | null
  warnings: string[]
  turnCount: number
  replayConfirmations: number[]
  whiteCaptured: number
  blackCaptured: number
  drawOfferBy: number | null
  noProgressCount: number
}

// Constants
const BOARD_SIZE = 10
const TURN_TIME_LIMIT = 5 * 60 * 1000 // 5 minutes
const WARNING_TIME = 4 * 60 * 1000 // Show warning at 4 min

const PIECE_NAMES: Record<number, string> = {
  0: '',
  1: 'Pion Blanc',
  2: 'Pion Noir',
  3: 'Dame Blanche',
  4: 'Dame Noire',
}

const PIECE_CHARS: Record<number, string> = {
  0: '',
  1: '○',
  2: '●',
  3: '⛃',
  4: '⛂',
}

function isDarkSquare(row: number, col: number): boolean {
  return (row + col) % 2 === 1
}

function formatTimer(ms: number): string {
  const seconds = Math.max(0, Math.ceil(ms / 1000))
  const minutes = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${minutes}:${String(secs).padStart(2, '0')}`
}

export default function DamesGameOnline({
  sessionCode,
  snapshot,
  onUpdate,
}: {
  sessionCode: string
  snapshot: OnlineSnapshot
  onUpdate: (data: OnlineSnapshot) => void
}) {
  const state = snapshot.gameState as DamesState
  const me = snapshot.me
  const approvedPlayers = snapshot.players.filter((p) => p.approved)
  const whitePlayer = approvedPlayers.find((p) => p.id === state.whitePlayerId)
  const blackPlayer = approvedPlayers.find((p) => p.id === state.blackPlayerId)
  const isMyTurn =
    state.phase === 'playing' &&
    ((state.currentPlayer === 1 && me.id === state.whitePlayerId) ||
      (state.currentPlayer === 2 && me.id === state.blackPlayerId))
  const isWhite = me.id === state.whitePlayerId
  const isBlack = me.id === state.blackPlayerId

  const [selectedCell, setSelectedCell] = useState<{ row: number; col: number } | null>(null)
  const [legalMoves, setLegalMoves] = useState<
    { toRow: number; toCol: number; captures: { row: number; col: number }[] }[]
  >([])
  const [chatInput, setChatInput] = useState('')
  const [now, setNow] = useState(Date.now())
  const [actionFeedback, setActionFeedback] = useState('')
  const boardRef = useRef<HTMLDivElement>(null)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const prevMoveCount = useRef(state.moveHistory.length)
  const prevPhase = useRef(state.phase)
  const prevWarning = useRef(false)
  const warnedThisTurn = useRef(false)
  const [multiCaptureActive, setMultiCaptureActive] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [gameHistory, setGameHistory] = useState<
    { date: string; winner: string; whitePlayer: string; blackPlayer: string; whiteCaptured: number; blackCaptured: number; turnCount: number; moveCount: number }[]
  >([])

  // Load history from localStorage
  useEffect(() => {
    try {
      const stored = JSON.parse(window.localStorage.getItem('lord-dames-history') ?? '[]')
      setGameHistory(stored.slice(0, 20))
    } catch { /* ignore */ }
  }, [])

  // Compute captured pieces for display
  const whiteCaptured = state.whiteCaptured ?? 0
  const blackCaptured = state.blackCaptured ?? 0

  // Compute legal moves when it's my turn
  const allLegalMoves = useMemo(() => {
    if (state.phase !== 'playing') return []
    // Compute from board state snapshot
    const board = state.board
    const player = state.currentPlayer
    const moves: {
      fromRow: number
      fromCol: number
      toRow: number
      toCol: number
      captures: { row: number; col: number }[]
    }[] = []

    // Find all pieces of current player and check if any capture exists
    let hasCapture = false
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        if (!isDarkSquare(r, c)) continue
        const piece = board[r]?.[c]
        if (!piece) continue
        const color = piece === 1 || piece === 3 ? 1 : 2
        if (color !== player) continue
        const isKing = piece === 3 || piece === 4
        // Men (simple pawns) may capture in ALL 4 diagonal directions, exactly
        // like kings (international draughts: a pawn can capture backward).
        const captureDirs: [number, number][] = [[-1, -1], [-1, 1], [1, -1], [1, 1]]

        for (const [dr, dc] of captureDirs) {
          let ar = r + dr
          let ac = c + dc
          while (ar >= 0 && ar < BOARD_SIZE && ac >= 0 && ac < BOARD_SIZE) {
            if (!isDarkSquare(ar, ac)) { ar += dr; ac += dc; continue }
            const adj = board[ar]?.[ac]
            if (!adj) { if (!isKing) break; ar += dr; ac += dc; continue }
            const adjColor = adj === 1 || adj === 3 ? 1 : 2
            if (adjColor === color) break

            // Check landing squares
            let lr = ar + dr
            let lc = ac + dc
            while (lr >= 0 && lr < BOARD_SIZE && lc >= 0 && lc < BOARD_SIZE) {
              if (!isDarkSquare(lr, lc)) { lr += dr; lc += dc; continue }
              if (board[lr]?.[lc]) break
              hasCapture = true
              if (!isKing) break
              lr += dr
              lc += dc
            }
            // Stop scanning this diagonal after the first enemy piece: a capture
            // can never jump through an occupied landing square.
            break
          }
        }
      }
      if (hasCapture) break
    }

    // Now collect all legal moves
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        if (!isDarkSquare(r, c)) continue
        const piece = board[r]?.[c]
        if (!piece) continue
        const color = piece === 1 || piece === 3 ? 1 : 2
        if (color !== player) continue

        const dir = player === 1 ? -1 : 1
        const isKing = piece === 3 || piece === 4
        // Simple moves stay forward-only for men; only captures may go backward.
        const moveDirs: [number, number][] = isKing
          ? [[-1, -1], [-1, 1], [1, -1], [1, 1]]
          : [[dir, -1], [dir, 1]]
        // Captures are allowed in all 4 diagonal directions (international draughts).
        const captureDirs: [number, number][] = [[-1, -1], [-1, 1], [1, -1], [1, 1]]

        const pieceCaptures: typeof moves = []
        const pieceMoves: typeof moves = []

        // Simple moves — forward only for men
        if (!hasCapture) {
          for (const [dr, dc] of moveDirs) {
            let nr = r + dr
            let nc = c + dc
            while (nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE) {
              if (!isDarkSquare(nr, nc)) { nr += dr; nc += dc; continue }
              if (board[nr]?.[nc]) break
              pieceMoves.push({ fromRow: r, fromCol: c, toRow: nr, toCol: nc, captures: [] })
              if (!isKing) break
              nr += dr
              nc += dc
            }
          }
        }

        // Captures — all 4 diagonal directions for men and kings
        for (const [dr, dc] of captureDirs) {
          let ar = r + dr
          let ac = c + dc
          while (ar >= 0 && ar < BOARD_SIZE && ac >= 0 && ac < BOARD_SIZE) {
            if (!isDarkSquare(ar, ac)) { ar += dr; ac += dc; continue }
            const adj = board[ar]?.[ac];              if (!adj) { if (!isKing) break; ar += dr; ac += dc; continue }
            const adjColor = adj === 1 || adj === 3 ? 1 : 2
            if (adjColor === color) break

            let lr = ar + dr
            let lc = ac + dc
            while (lr >= 0 && lr < BOARD_SIZE && lc >= 0 && lc < BOARD_SIZE) {
              if (!isDarkSquare(lr, lc)) { lr += dr; lc += dc; continue }
              if (board[lr]?.[lc]) break
              pieceCaptures.push({
                fromRow: r,
                fromCol: c,
                toRow: lr,
                toCol: lc,
                captures: [{ row: ar, col: ac }],
              })
              if (!isKing) break
              lr += dr
              lc += dc
            }
            // Stop scanning this diagonal after the first enemy piece: a capture
            // can never jump through an occupied landing square.
            break
          }
        }

        // Best capture rule: choose captures with most pieces
        if (pieceCaptures.length > 0) {
          const maxCap = Math.max(...pieceCaptures.map((m) => m.captures.length))
          moves.push(...pieceCaptures.filter((m) => m.captures.length === maxCap))
        } else if (!hasCapture) {
          moves.push(...pieceMoves)
        }
      }
    }

    return moves
  }, [state.board, state.currentPlayer, state.phase])

  // Find which pieces have forced captures (must capture)
  const forcedCapturePieces = useMemo(() => {
    if (state.phase !== 'playing' || state.currentPlayer !== (isWhite ? 1 : 2)) return new Set<string>()
    const pieces = new Set<string>()
    for (const move of allLegalMoves) {
      if (move.captures.length > 0) {
        pieces.add(`${move.fromRow},${move.fromCol}`)
      }
    }
    return pieces
  }, [allLegalMoves, state.phase, state.currentPlayer, isWhite])

  const hasForcedCapture = forcedCapturePieces.size > 0

  // Get legal moves for a specific piece
  const getMovesForPiece = useCallback(
    (row: number, col: number) => {
      return allLegalMoves.filter((m) => m.fromRow === row && m.fromCol === col)
    },
    [allLegalMoves]
  )

  // Timer effect
  useEffect(() => {
    if (state.phase !== 'playing') return
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [state.phase])

  // Warning effect
  const elapsed = state.turnStartAt ? now - new Date(state.turnStartAt).getTime() : 0
  const showWarning = elapsed >= WARNING_TIME && elapsed < TURN_TIME_LIMIT && state.phase === 'playing'
  const showDanger = elapsed >= TURN_TIME_LIMIT && state.phase === 'playing'

  // Auto-select piece after a capture for multi-capture continuation
  const prevHistoryForMulti = useRef(state.moveHistory.length)

  useEffect(() => {
    if (state.moveHistory.length > prevHistoryForMulti.current && state.phase === 'playing') {
      // A new move was added — extract destination from last history entry
      // Format: "♟ ×1 (1,0)→(3,2)"
      const lastEntry = state.moveHistory[state.moveHistory.length - 1] ?? ''
      if (lastEntry.includes('×')) {
        // Capture move — extract destination (last coordinates in the string)
        const coords = [...lastEntry.matchAll(/\((\d+),(\d+)\)/g)]
        if (coords.length >= 2) {
          const destCoords = coords[coords.length - 1]
          const toRow = parseInt(destCoords[1])
          const toCol = parseInt(destCoords[2])
          // Check if piece at destination has further captures
          const furtherMoves = allLegalMoves.filter(
            (m) => m.fromRow === toRow && m.fromCol === toCol && m.captures.length > 0
          )
          if (furtherMoves.length > 0) {
            setSelectedCell({ row: toRow, col: toCol })
            setLegalMoves(furtherMoves)
            setMultiCaptureActive(true)
          } else {
            setMultiCaptureActive(false)
          }
        }
      } else {
        setMultiCaptureActive(false)
      }
    }
    prevHistoryForMulti.current = state.moveHistory.length
  }, [state.moveHistory, state.phase, allLegalMoves])

  // Reset multi-capture flag when turn changes
  useEffect(() => {
    setMultiCaptureActive(false)
  }, [state.currentPlayer, state.turnCount])

  // Scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [state.chatMessages.length])

  // Clear selection when turn changes
  useEffect(() => {
    setSelectedCell(null)
    setLegalMoves([])
  }, [state.currentPlayer, state.turnCount])

  async function act(action: string, payload: Record<string, unknown> = {}) {
    setActionFeedback('')
    try {
      onUpdate(await onlineAction(sessionCode, action, payload))
    } catch (error) {
      setActionFeedback(error instanceof Error ? error.message : 'Action impossible.')
    }
  }

  function handleCellClick(row: number, col: number) {
    if (!isMyTurn || state.phase !== 'playing') return

    const piece = state.board[row]?.[col]

    // If clicking on own piece, select it
    if (piece) {
      const pieceColor = piece === 1 || piece === 3 ? 1 : 2
      if (pieceColor === state.currentPlayer) {
        const moves = getMovesForPiece(row, col)
        if (moves.length > 0) {
          setSelectedCell({ row, col })
          setLegalMoves(moves)
        }
        return
      }
    }

    // If clicking on a legal move destination, make the move
    if (selectedCell) {
      const move = legalMoves.find((m) => m.toRow === row && m.toCol === col)
      if (move) {
        act('move', {
          fromRow: selectedCell.row,
          fromCol: selectedCell.col,
          toRow: row,
          toCol: col,
        })
        setSelectedCell(null)
        setLegalMoves([])
        return
      }
    }

    // Deselect
    setSelectedCell(null)
    setLegalMoves([])
  }

  // Save game result to history when finished (once per finish event)
  const savedResult = useRef(false)
  useEffect(() => {
    if (state.phase === 'finished' && state.winner) {
      if (savedResult.current) return
      savedResult.current = true
      try {
        const key = 'lord-dames-history'
        const existing = JSON.parse(window.localStorage.getItem(key) ?? '[]') as {
          date: string; winner: string; whitePlayer: string; blackPlayer: string
          whiteCaptured: number; blackCaptured: number; turnCount: number; moveCount: number
        }[]
        const entry = {
          date: new Date().toISOString(),
          winner: state.winner === 'draw' ? 'Nulle' : state.winner === 1 ? (whitePlayer?.displayName ?? 'Blanc') : (blackPlayer?.displayName ?? 'Noir'),
          whitePlayer: whitePlayer?.displayName ?? 'Blanc',
          blackPlayer: blackPlayer?.displayName ?? 'Noir',
          whiteCaptured: state.whiteCaptured ?? 0,
          blackCaptured: state.blackCaptured ?? 0,
          turnCount: state.turnCount,
          moveCount: state.moveHistory.length,
        }
        existing.unshift(entry)
        window.localStorage.setItem(key, JSON.stringify(existing.slice(0, 50)))
      } catch { /* localStorage may be full */ }
    } else {
      savedResult.current = false
    }
  }, [state.phase, state.winner])

  // Sound effects
  useEffect(() => {
    resumeAudio()

    // Move sound (detect new entries in moveHistory)
    if (state.moveHistory.length > prevMoveCount.current) {
      const latestMove = state.moveHistory[state.moveHistory.length - 1] ?? ''
      if (latestMove.includes('×') || latestMove.includes('capture')) {
        playDamesCaptureSound()
      } else {
        playDamesMoveSound()
      }
      if (latestMove.includes('promu')) {
        setTimeout(playDamesKingSound, 200)
      }
    }
    prevMoveCount.current = state.moveHistory.length

    // Phase change sounds
    if (prevPhase.current !== state.phase) {
      if (state.phase === 'finished' && state.winner) {
        setTimeout(playDamesWinSound, 300)
      }
      if (state.phase === 'paused' && prevPhase.current === 'playing') {
        playDamesPauseSound()
      }
      if (state.phase === 'playing' && prevPhase.current === 'paused') {
        playDamesResumeSound()
      }
      prevPhase.current = state.phase
    }
  }, [state.moveHistory, state.phase, state.winner, state.currentPlayer])

  // Warning sound
  useEffect(() => {
    if (showWarning && !warnedThisTurn.current) {
      playDamesWarningSound()
      warnedThisTurn.current = true
    }
    if (!showWarning) {
      warnedThisTurn.current = false
    }
  }, [showWarning])

  function sendChat() {
    if (!chatInput.trim()) return
    act('chat', { text: chatInput.trim() })
    setChatInput('')
  }

  const isPauseRequester = state.pauseRequestedBy === me.id
  const otherPlayerPaused = state.pauseRequestedBy !== null && state.pauseRequestedBy !== me.id

  // Board rendering
  const board = state.board

  return (
    <div className="dames-container">
      {/* Header */}
      <div className="dames-header">
        <p className="kicker">DAMES INTERNATIONALES · EN LIGNE</p>
        <h1>Damier 10×10</h1>
        <div className="dames-players">              <div className={`dames-player ${state.currentPlayer === 1 && state.phase === 'playing' ? 'active' : ''} ${state.winner === 1 ? 'winner' : ''}`}>
            <span className="dames-pawn white" /> {whitePlayer?.displayName ?? 'Blanc'}
            <span className="dames-captured-count" title="Pions capturés">×{blackCaptured}</span>
            {state.winner === 1 && <Crown size={16} className="crown-icon" />}
          </div>
          <span className="dames-vs">VS</span>
          <div className={`dames-player ${state.currentPlayer === 2 && state.phase === 'playing' ? 'active' : ''} ${state.winner === 2 ? 'winner' : ''}`}>
            <span className="dames-pawn black" /> {blackPlayer?.displayName ?? 'Noir'}
            <span className="dames-captured-count" title="Pions capturés">×{whiteCaptured}</span>
            {state.winner === 2 && <Crown size={16} className="crown-icon" />}
          </div>
        </div>
      </div>

      {/* Timer & Status */}
      <div className="dames-timer-bar">
        <Clock size={16} />
        {state.phase === 'playing' && (
          <span className={showDanger ? 'timer-danger' : showWarning ? 'timer-warning' : ''}>
            {formatTimer(TURN_TIME_LIMIT - elapsed)}
          </span>
        )}
        {state.phase === 'paused' && <span className="timer-paused">PARTIE EN PAUSE</span>}
        {state.phase === 'finished' && (
          <span className={`timer-finished${state.winner === 'draw' ? ' draw' : ''}`}>
            {state.winner === 'draw'
              ? 'Match nul !'
              : state.winner
                ? `${state.winner === 1 ? (whitePlayer?.displayName ?? 'Blanc') : (blackPlayer?.displayName ?? 'Noir')} a gagné !`
                : 'Match nul !'}
          </span>
        )}
        <span className="dames-turn-count">Tour #{state.turnCount}</span>
      </div>

      {/* Captured pieces bar */}
      <div className="dames-capture-bar">
        <div className="dames-capture-side">
          <span className="dames-pawn white" /> 
          <span className="dames-captured-pieces">
            {Array.from({ length: Math.min(whiteCaptured, 20) }, (_, i) => (
              <span key={i} className="captured-icon captured-white">◯</span>
            ))}
          </span>
          <span className="dames-captured-total">{whiteCaptured}/20</span>
        </div>
        <div className="dames-capture-side right">
          <span className="dames-captured-total">{blackCaptured}/20</span>
          <span className="dames-captured-pieces">
            {Array.from({ length: Math.min(blackCaptured, 20) }, (_, i) => (
              <span key={i} className="captured-icon captured-black">●</span>
            ))}
          </span>
          <span className="dames-pawn black" />
        </div>
      </div>

      {/* Warnings */}
      {showWarning && (
        <p className="dames-warning">
          ⏰ Attention ! Il vous reste moins d&apos;une minute pour jouer !
        </p>
      )}
      {showDanger && (
        <p className="dames-danger">
          ⏰ Temps écoulé ! Vous devriez jouer rapidement.
        </p>
      )}
      {multiCaptureActive && (
        <p className="dames-multi-capture">
          ⚡ Capture supplémentaire possible ! Continuez à capturer avec la même pièce.
        </p>
      )}
      {hasForcedCapture && isMyTurn && !selectedCell && (
        <p className="dames-forced-capture animated">
          ⚔️ Capture obligatoire ! Vous devez capturer un pion adverse.
        </p>
      )}
      {state.drawOfferBy !== null && state.drawOfferBy !== me.id && (
        <div className="dames-draw-offer">
          <span>🏳️ L&apos;adversaire propose une partie nulle</span>
          <button className="launch small" onClick={() => act('acceptDraw')}>Accepter</button>
          <button className="ghost" onClick={() => act('rejectDraw')}>Refuser</button>
        </div>
      )}
      {actionFeedback && <p className="feedback">{actionFeedback}</p>}

      {/* Board */}
      <div className="dames-board-wrapper" ref={boardRef}>
        <div className="dames-board">
          {/* Column labels */}
          <div className="dames-labels-row">
            <div className="dames-label-corner" />
            {Array.from({ length: BOARD_SIZE }, (_, i) => (
              <div key={i} className="dames-label-col">
                {String.fromCharCode(97 + i)}
              </div>
            ))}
            <div className="dames-label-corner" />
          </div>

          {board.map((row, r) => (
            <div key={r} className="dames-row">
              <div className="dames-label-row">{BOARD_SIZE - r}</div>
              {row.map((cell, c) => {
                const isDark = isDarkSquare(r, c)
                const isSelected = selectedCell?.row === r && selectedCell?.col === c
                const isValidTarget = legalMoves.some((m) => m.toRow === r && m.toCol === c)
                const hasCapture = legalMoves.some(
                  (m) => m.toRow === r && m.toCol === c && m.captures.length > 0
                )
                const isPlayable = isDark && isMyTurn && state.phase === 'playing'
                const pieceColor =
                  cell === 1 || cell === 3 ? 'white' : cell === 2 || cell === 4 ? 'black' : null
                const isKing = cell === 3 || cell === 4

                const isChainTarget = hasCapture && multiCaptureActive
                const isChainCapturing = isSelected && multiCaptureActive
                const isForcedCapture = forcedCapturePieces.has(`${r},${c}`)

                return (
                  <div
                    key={c}
                    className={`dames-cell ${isDark ? 'dark' : 'light'} ${isSelected ? 'selected' : ''} ${isValidTarget ? (hasCapture ? 'capture-target' : 'valid-target') : ''} ${isChainTarget ? 'chain-target' : ''} ${isPlayable ? 'playable' : ''}`}
                    onClick={() => handleCellClick(r, c)}
                  >
                    {pieceColor && (
                      <div className={`dames-piece ${pieceColor} ${isKing ? 'king' : ''} ${isMyTurn && pieceColor === (state.currentPlayer === 1 ? 'white' : 'black') ? 'movable' : ''} ${isChainCapturing ? 'chain-capturing' : ''} ${isForcedCapture ? 'forced-capture' : ''}`}>
                        <div className="piece-inner">
                          {isKing ? '♛' : pieceColor === 'white' ? '◯' : '●'}
                        </div>
                        {isForcedCapture && <div className="forced-capture-ring" />}
                        {isChainCapturing && <div className="chain-capture-ring" />}
                      </div>
                    )}
                    {isValidTarget && !pieceColor && (
                      <div className={`dames-target-dot ${hasCapture ? 'capture' : ''}`} />
                    )}
                  </div>
                )
              })}
              <div className="dames-label-row">{BOARD_SIZE - r}</div>
            </div>
          ))}

          {/* Bottom column labels */}
          <div className="dames-labels-row">
            <div className="dames-label-corner" />
            {Array.from({ length: BOARD_SIZE }, (_, i) => (
              <div key={i} className="dames-label-col">
                {String.fromCharCode(97 + i)}
              </div>
            ))}
            <div className="dames-label-corner" />
          </div>
        </div>
      </div>

      {/* Game Controls */}
      <div className="dames-controls">
        {state.phase === 'playing' && !otherPlayerPaused && !isPauseRequester && state.drawOfferBy === null && (
          <>
            {isMyTurn && <button className="ghost" onClick={() => act('offerDraw')}>
              🏳️ Nulle
            </button>}
            <button className="ghost" onClick={() => act('requestPause')} disabled={!isMyTurn && !isWhite && !isBlack}>
              <Pause size={16} /> Pause
            </button>
          </>
        )}
        {state.phase === 'playing' && state.drawOfferBy === me.id && (
          <span className="dames-pause-request">
            🏳️ Proposition de nulle envoyée...
            <button className="ghost" onClick={() => act('rejectDraw')}>
              Annuler
            </button>
          </span>
        )}
        {state.phase === 'playing' && isPauseRequester && (
          <span className="dames-pause-request">
            En attente que l&apos;adversaire accepte la pause...
            <button className="ghost" onClick={() => act('cancelPause')}>
              Annuler
            </button>
          </span>
        )}
        {state.phase === 'playing' && otherPlayerPaused && (
          <div className="dames-confirm-row">
            <span>L&apos;adversaire demande une pause</span>
            <button className="launch small" onClick={() => act('confirmPause')}>
              Accepter la pause
            </button>
          </div>
        )}
        {state.phase === 'paused' && isPauseRequester && (
          <span className="dames-pause-request">
            En attente que l&apos;adversaire accepte de reprendre...
            <button className="ghost" onClick={() => act('cancelResume')}>
              Annuler
            </button>
          </span>
        )}
        {state.phase === 'paused' && otherPlayerPaused && (
          <div className="dames-confirm-row">
            <span>L&apos;adversaire veut reprendre</span>
            <button className="launch small" onClick={() => act('confirmResume')}>
              <Play size={16} /> Reprendre
            </button>
          </div>
        )}
        {state.phase === 'paused' && !isPauseRequester && !otherPlayerPaused && (
          <div className="dames-confirm-row">
            <span>Partie en pause</span>
            <button className="launch small" onClick={() => act('resumeGame')}>
              <Play size={16} /> Reprendre
            </button>
          </div>
        )}
        {state.phase === 'finished' && me.isHost && (
          <div className="dames-confirm-row">
            {state.replayConfirmations.length === 0 && (
              <button className="launch" onClick={() => act('replay')}>
                <RotateCcw size={16} /> Rejouer
              </button>
            )}
            {state.replayConfirmations.length > 0 &&
              !state.replayConfirmations.includes(me.id) && (
                <button className="launch" onClick={() => act('confirmReplay')}>
                  <RotateCcw size={16} /> Confirmer pour rejouer
                </button>
              )}
            {state.replayConfirmations.includes(me.id) && (
              <span className="dames-pause-request">
                En attente que l&apos;adversaire confirme pour rejouer...
              </span>
            )}
          </div>
        )}
        {state.phase === 'finished' && !me.isHost && (
          <div className="dames-confirm-row">
            {!state.replayConfirmations.includes(me.id) && (
              <button className="launch" onClick={() => act('confirmReplay')}>
                <RotateCcw size={16} /> Rejouer
              </button>
            )}
            {state.replayConfirmations.includes(me.id) && (
              <span className="dames-pause-request">
                En attente que l&apos;hôte confirme pour rejouer...
              </span>
            )}
          </div>
        )}
      </div>

      {/* Move History */}
      {state.moveHistory.length > 0 && (
        <details className="dames-history">
          <summary>
            <RefreshCw size={14} /> Historique ({state.moveHistory.length} coups)
          </summary>
          <div className="dames-history-list">
            {state.moveHistory.map((entry, i) => (
              <p key={i} className="dames-history-entry">
                <span className="dames-move-num">{i + 1}.</span> {entry}
              </p>
            ))}
          </div>
        </details>
      )}

      {/* Game History */}
      <div className="dames-history-panel">
        <button className="dames-history-toggle" onClick={() => setHistoryOpen(!historyOpen)}>
          <History size={14} />
          <span>Historique des parties ({gameHistory.length})</span>
          <span className={`dames-chevron ${historyOpen ? 'open' : ''}`}>▾</span>
        </button>
        {historyOpen && (
          <div className="dames-history-content">
            {gameHistory.length === 0 ? (
              <p className="dames-history-empty">Aucune partie terminée pour le moment.</p>
            ) : (
              <div className="dames-history-list detailed">
                {gameHistory.map((entry, i) => {
                  const isDraw = entry.winner === 'Nulle'
                  const isWhiteWin = entry.winner === entry.whitePlayer
                  return (
                    <div key={i} className={`dames-history-card ${isDraw ? 'draw' : isWhiteWin ? 'white-wins' : 'black-wins'}`}>
                      <div className="dames-history-card-header">
                        <Medal size={14} className={`dames-history-medal ${isDraw ? 'draw' : 'win'}`} />
                        <span className="dames-history-result">
                          {isDraw ? 'Match nul' : `${entry.winner} a gagné`}
                        </span>
                        <span className="dames-history-date">
                          {new Date(entry.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <div className="dames-history-card-players">
                        <span className="dames-history-player white">
                          <span className="dames-pawn white" /> {entry.whitePlayer}
                        </span>
                        <span className="dames-history-vs">vs</span>
                        <span className="dames-history-player black">
                          <span className="dames-pawn black" /> {entry.blackPlayer}
                        </span>
                      </div>
                      <div className="dames-history-card-stats">
                        <span>Pris : {entry.whiteCaptured} | {entry.blackCaptured}</span>
                        <span>{entry.turnCount} tours · {entry.moveCount} coups</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Chat */}
      <div className="dames-chat">
        <div className="dames-chat-header">
          <MessageCircle size={16} /> Chat
        </div>
        <div className="dames-chat-messages">
          {state.chatMessages.length === 0 && (
            <p className="dames-chat-empty">Aucun message. Échangez avec votre adversaire !</p>
          )}
          {state.chatMessages.map((msg, i) => {
            const sender = snapshot.players.find((p) => p.id === msg.senderId)
            return (
              <div
                key={i}
                className={`dames-chat-msg ${msg.senderId === me.id ? 'own' : 'other'}`}
              >
                <strong>{sender?.displayName ?? 'Inconnu'}</strong>
                <span>{msg.text}</span>
              </div>
            )
          })}
          <div ref={chatEndRef} />
        </div>
        <div className="dames-chat-input">
          <input
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && sendChat()}
            placeholder="Écrire un message..."
            maxLength={300}
          />
          <button className="ghost" onClick={sendChat} disabled={!chatInput.trim()}>
            <Send size={16} />
          </button>
        </div>
      </div>

      {/* Turn indicator */}
      {isMyTurn && state.phase === 'playing' && (
        <p className="dames-turn-indicator">
          <SkipForward size={14} /> C&apos;est à vous de jouer !
        </p>
      )}
      {!isMyTurn && state.phase === 'playing' && (
        <p className="dames-turn-indicator waiting">
          En attente du coup de l&apos;adversaire...
        </p>
      )}
    </div>
  )
}
