export type TruthQuestion = { id: number; body: string; level: number }
export type TruthChatAudio = { url: string; mime?: string; durationMs?: number }
export type TruthChatAttachment = { id?: string; kind?: 'audio' | 'image' | 'video'; url: string; mime?: string; durationMs?: number; name?: string; viewOnce?: boolean; viewedBy?: number[]; consumed?: boolean }
export type TruthChatMessage = { id?: string; senderId: number; text: string; timestamp?: string; audio?: TruthChatAudio; attachments?: TruthChatAttachment[] }

export type TruthState = {
  phase: 'chooseQuestion' | 'revealed' | 'answering' | 'awaitingApproval'
  currentTurnPlayerId: number | null
  targetPlayerId: number | null
  currentQuestion: TruthQuestion | null
  turnOrder: number[]
  turnIndex: number
  answer: string
  answerPlayerId: number | null
  approvedBy: number | null
  answerRejected: boolean
  chatMessages: TruthChatMessage[]
}

export function normalizeTruthState(raw: Record<string, unknown>, playerIds: number[]): TruthState {
  const legacy = raw as TruthState & { revealed?: boolean }
  const activeIds = playerIds.map((id) => Number(id)).filter((id) => Number.isFinite(id))

  let turnOrder = (Array.isArray(raw.turnOrder) ? raw.turnOrder : []).map((id) => Number(id)).filter((id) => activeIds.includes(id))
  if (!turnOrder.length) turnOrder = [...activeIds]

  let turnIndex = Number.isFinite(Number(raw.turnIndex)) ? Number(raw.turnIndex) : 0
  if (turnIndex < 0 || turnIndex >= turnOrder.length) turnIndex = 0

  let currentTurnPlayerId = raw.currentTurnPlayerId ? Number(raw.currentTurnPlayerId) : null
  if (!currentTurnPlayerId || !activeIds.includes(currentTurnPlayerId)) {
    currentTurnPlayerId = turnOrder[turnIndex] ?? turnOrder[0] ?? null
  } else {
    turnIndex = turnOrder.indexOf(currentTurnPlayerId)
    if (turnIndex < 0) turnIndex = 0
  }

  let targetPlayerId = raw.targetPlayerId ? Number(raw.targetPlayerId) : null
  if (!targetPlayerId || targetPlayerId === currentTurnPlayerId || !activeIds.includes(targetPlayerId)) {
    targetPlayerId = turnOrder[(turnIndex + 1) % turnOrder.length] ?? null
  }

  const currentQuestion = (raw.currentQuestion as TruthQuestion | null) ?? null
  const answer = String(raw.answer ?? '')
  const answerPlayerId = raw.answerPlayerId ? Number(raw.answerPlayerId) : null

  let phase = raw.phase as TruthState['phase'] | undefined
  if (!phase && legacy.revealed === true) {
    phase = currentQuestion ? 'answering' : 'chooseQuestion'
  }
  if (phase === 'revealed') {
    phase = currentQuestion ? 'answering' : 'chooseQuestion'
  }
  if (!phase || !['chooseQuestion', 'answering', 'awaitingApproval'].includes(phase)) {
    phase = currentQuestion ? (answer.trim() && answerPlayerId ? 'awaitingApproval' : 'answering') : 'chooseQuestion'
  }

  const chatMessages = Array.isArray(raw.chatMessages)
    ? (raw.chatMessages as any[]).filter((m) => m && Number.isInteger(Number(m.senderId))).map((m) => ({ ...m, senderId: Number(m.senderId) } as TruthChatMessage))
    : []
  return {
    phase,
    currentTurnPlayerId,
    targetPlayerId,
    currentQuestion,
    turnOrder,
    turnIndex,
    answer,
    answerPlayerId,
    approvedBy: raw.approvedBy ? Number(raw.approvedBy) : null,
    answerRejected: Boolean(raw.answerRejected),
    chatMessages,
  }
}
