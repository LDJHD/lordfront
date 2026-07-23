'use client'

import { useEffect, useRef, useState } from 'react'
import { ArrowRight, Check, Eye, List, Shuffle, X } from 'lucide-react'
import { onlineAction, type OnlineSnapshot } from './online-api'
import { playAnswerSound, playApproveSound, playQuestionSound, playRejectSound, playTurnSound } from './game-sounds'
import { normalizeTruthState } from './truth-state'

export default function TruthGameOnline({ sessionCode, snapshot, onUpdate }: { sessionCode: string; snapshot: OnlineSnapshot; onUpdate: (data: OnlineSnapshot) => void }) {
  const approvedIds = snapshot.players.filter((player) => player.approved).map((player) => player.id)
  const state = normalizeTruthState(snapshot.gameState, approvedIds)
  const availableQuestions = snapshot.availableQuestions ?? []
  const current = snapshot.players.find((player) => player.id === state.currentTurnPlayerId)
  const target = snapshot.players.find((player) => player.id === state.targetPlayerId)
  const isQuestioner = state.currentTurnPlayerId === snapshot.me.id
  const isAnswerer = state.targetPlayerId === snapshot.me.id
  const isAnsweringPhase = state.phase === 'answering' || state.phase === 'awaitingApproval'
  const [answerInput, setAnswerInput] = useState(state.answer)
  const [showList, setShowList] = useState(false)
  const [actionError, setActionError] = useState('')
  const prevPhase = useRef(state.phase)
  const prevTurn = useRef(state.currentTurnPlayerId)
  const prevRejected = useRef(state.answerRejected)

  useEffect(() => {
    if (state.phase !== 'awaitingApproval' || state.answerPlayerId !== snapshot.me.id) {
      setAnswerInput(state.answer)
    }
  }, [snapshot.me.id, state.answer, state.answerPlayerId, state.phase])

  useEffect(() => {
    if (prevTurn.current !== state.currentTurnPlayerId) {
      playTurnSound()
      prevTurn.current = state.currentTurnPlayerId
    }
    if (prevPhase.current !== state.phase) {
      if (state.phase === 'answering' && state.currentQuestion) playQuestionSound()
      if (state.phase === 'awaitingApproval') playAnswerSound()
      if (state.phase === 'chooseQuestion' && prevPhase.current === 'awaitingApproval') playApproveSound()
      prevPhase.current = state.phase
    }
    if (!prevRejected.current && state.answerRejected) {
      playRejectSound()
    }
    prevRejected.current = state.answerRejected
  }, [state.phase, state.currentTurnPlayerId, state.currentQuestion, state.answerRejected])

  async function runAction(action: string, payload: Record<string, unknown> = {}) {
    setActionError('')
    try {
      onUpdate(await onlineAction(sessionCode, action, payload))
      return true
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Action impossible.')
      return false
    }
  }

  async function pickRandom() {
    await runAction('pickQuestion')
  }

  async function pickQuestion(questionId: number) {
    await runAction('pickQuestion', { questionId })
    setShowList(false)
  }

  async function submitAnswer() {
    if (await runAction('submitAnswer', { answer: answerInput })) setAnswerInput('')
  }

  return <>
    <p className="kicker">VÉRITÉS EN JEU · EN LIGNE · TOUR DE {current?.displayName?.toUpperCase() ?? '…'}</p>
    {actionError && <p className="feedback">{actionError}</p>}

    {state.phase === 'chooseQuestion' && isQuestioner && (
      <div className="truth-card setup revealed">
        <Eye size={28}/>
        <h1>Choisissez une question pour {target?.displayName}</h1>
        <p>Tirez au hasard ou choisissez une question pour {target?.displayName}.</p>
        {!target && (
        <p>Tirez au hasard ou sélectionnez une question parmi celles encore disponibles pour vous.</p>
        )}
        <div className="truth-actions-row">
          <button className="launch" onClick={pickRandom}><Shuffle size={16}/> Question au hasard</button>
          <button className="ghost" onClick={() => setShowList((value) => !value)}><List size={16}/> Choisir dans la liste ({availableQuestions.length})</button>
        </div>
        {showList && (
          <div className="question-list">
            {availableQuestions.length === 0 ? <p>Aucune question restante.</p> : availableQuestions.map((question) => (
              <button key={question.id} className="question-item" onClick={() => pickQuestion(question.id)}>
                <span className="level-tag">Niv. {question.level}</span>
                <span>{question.body}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    )}

    {state.phase === 'chooseQuestion' && !isQuestioner && target && (
      <div className="truth-card revealed"><Eye size={28}/><h1>En attente de {current?.displayName}</h1><p>Le joueur actif choisit une question pour {target.displayName}.</p></div>
    )}

    {state.phase === 'chooseQuestion' && !isQuestioner && !target && (
      <div className="truth-card revealed"><Eye size={28}/><h1>En attente de {current?.displayName}</h1><p>Le joueur actif choisit sa question…</p></div>
    )}

    {isAnsweringPhase && state.currentQuestion && (
      <div className="truth-card revealed">
        <Eye size={28}/>
        <h1 className="no-copy">{state.currentQuestion.body}</h1>
        {target && <p><span className="level-tag">Niveau {state.currentQuestion.level}</span> · {target.displayName} doit repondre</p>}
        {!target && (
        <p><span className="level-tag">Niveau {state.currentQuestion.level}</span> · {current?.displayName} doit répondre</p>

        )}
        {isAnswerer && (
          <>
            {state.answerRejected && (
              <p className="night-alert">Votre réponse n’a pas été approuvée. Modifiez-la et renvoyez-la.</p>
            )}
            {state.phase === 'awaitingApproval' && !state.answerRejected && (
              <p className="online-hint">Réponse envoyée. Vous pouvez encore la modifier en attendant la validation.</p>
            )}
            <textarea
              value={answerInput}
              onChange={(event) => setAnswerInput(event.target.value)}
              placeholder="Écrivez votre réponse ici…"
              rows={4}
            />
            <button className="launch" onClick={submitAnswer} disabled={answerInput.trim().length < 2}>
              {state.phase === 'awaitingApproval' ? 'Mettre à jour ma réponse' : 'Envoyer ma réponse'} <ArrowRight size={18}/>
            </button>
          </>
        )}

        {!isAnswerer && state.phase === 'awaitingApproval' && (
          <div className="answer-review">
            {target && <h2>Reponse de {target.displayName}</h2>}
            {!target && (
            <h2>Réponse de {current?.displayName}</h2>
            )}
            <p className="answer-box">{state.answer}</p>
            {isQuestioner && (
              <div className="truth-actions-row">
                <button className="launch" onClick={() => runAction('approveAnswer')}><Check size={16}/> Approuver et passer la main</button>
                <button className="ghost reject-btn" onClick={() => runAction('rejectAnswer')}><X size={16}/> Réponse non approuvée</button>
              </div>
            )}
          </div>
        )}

        {!isAnswerer && state.phase === 'answering' && target && (
          <p className="online-hint">{state.answerRejected ? `${target.displayName} modifie sa reponse...` : `${target.displayName} redige sa reponse...`}</p>
        )}

        {!isAnswerer && state.phase === 'answering' && !target && (
          <p className="online-hint">{state.answerRejected ? `${current?.displayName} modifie sa réponse…` : `${current?.displayName} rédige sa réponse…`}</p>
        )}
      </div>
    )}

    <div className="lobby-list compact">
      {snapshot.players.filter((player) => player.approved).map((player) => (
        <article key={player.id} className={`lobby-player ${player.id === state.currentTurnPlayerId ? 'approved' : ''}`}>
          <span>{player.displayName}{player.id === state.currentTurnPlayerId ? ' · en jeu' : ''}</span>
        </article>
      ))}
    </div>
  </>
}
