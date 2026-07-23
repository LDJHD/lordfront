'use client'

import { useEffect, useState } from 'react'
import { ArrowRight, Circle, FileText, RotateCcw, Scissors } from 'lucide-react'
import { onlineAction, type OnlineSnapshot } from './online-api'

type Choice = 'rock' | 'paper' | 'scissors'

const choices: { id: Choice; label: string; icon: typeof Circle }[] = [
  { id: 'rock', label: 'Pierre', icon: Circle },
  { id: 'paper', label: 'Feuille', icon: FileText },
  { id: 'scissors', label: 'Ciseaux', icon: Scissors },
]

const label = (choice: Choice | 'hidden' | null) => {
  if (choice === 'hidden') return 'Choix secret'
  if (!choice) return '—'
  return choices.find((item) => item.id === choice)?.label ?? choice
}

export default function A3GameOnline({ sessionCode, snapshot, onUpdate }: { sessionCode: string; snapshot: OnlineSnapshot; onUpdate: (data: OnlineSnapshot) => void }) {
  const state = snapshot.gameState as {
    phase: string
    countdown: number
    choices: Record<string, Choice | 'hidden' | null>
    result: { winnerId: number | null; phrase: string; draw: boolean } | null
    winnerQuestion: string
    answer: string
    answerPlayerId: number | null
    answerRejected: boolean
    round: number
  }
  const approved = snapshot.players.filter((player) => player.approved)
  const me = snapshot.me.id
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('')

  useEffect(() => { setQuestion(state.winnerQuestion ?? '') }, [state.winnerQuestion])
  useEffect(() => { setAnswer(state.answer ?? '') }, [state.answer])

  useEffect(() => {
    if (state.phase !== 'countdown') return
    if (state.countdown <= 0) return
    const timer = window.setTimeout(async () => {
      onUpdate(await onlineAction(sessionCode, 'tick'))
    }, 700)
    return () => window.clearTimeout(timer)
  }, [state.phase, state.countdown, sessionCode, onUpdate])

  async function pick(choice: Choice) {
    onUpdate(await onlineAction(sessionCode, 'choose', { choice }))
  }

  async function replay() {
    onUpdate(await onlineAction(sessionCode, 'replay'))
  }

  async function act(action: string, payload: Record<string, unknown> = {}) {
    onUpdate(await onlineAction(sessionCode, action, payload))
  }

  if (state.phase === 'countdown') {
    return <div className="a3-stage"><p className="kicker">À 3 · MANCHE {state.round}</p><div className="a3-countdown">{state.countdown > 0 ? state.countdown : 'Choisissez !'}</div><p>Les deux joueurs choisissent en ligne en même temps.</p></div>
  }

  if (state.phase === 'choosing') {
    const mine = state.choices[String(me)]
    if (mine) return <div className="a3-stage"><p className="kicker">À 3 · EN ATTENTE</p><h1>Choix enregistré</h1><p>En attente de l’autre joueur…</p></div>
    return <div className="a3-stage"><p className="kicker">À 3 · À VOUS</p><h1>Choisissez maintenant !</h1><div className="a3-choices">{choices.map((item) => { const Icon = item.icon; return <button key={item.id} className="a3-choice" onClick={() => pick(item.id)}><Icon size={28}/><span>{item.label}</span></button> })}</div></div>
  }

  if (state.phase === 'reveal' && state.result) {
    const entries = approved.slice(0, 2)
    return <div className="a3-stage reveal"><p className="kicker">À 3 · RÉSULTAT</p><div className="a3-result-grid">{entries.map((player) => <article key={player.id}><span>{player.displayName}</span><strong>{label(state.choices[String(player.id)])}</strong></article>)}</div><h1>{state.result.draw ? 'Match nul' : `${approved.find((player) => player.id === state.result?.winnerId)?.displayName} gagne !`}</h1><p>{state.result.phrase}</p><div className="a3-actions"><button className="launch" onClick={replay}><RotateCcw size={18}/> Continuer</button></div></div>
  }

  const isWinner = state.result?.winnerId === me
  const winner = approved.find((player) => player.id === state.result?.winnerId)

  if (state.phase === 'question') {
    return <div className="a3-stage"><p className="kicker">A 3 · QUESTION DU GAGNANT</p><h1>{isWinner ? 'Posez votre question' : `${winner?.displayName ?? 'Le gagnant'} prépare sa question`}</h1>{isWinner ? <><textarea value={question} placeholder="Votre question…" onChange={(event) => setQuestion(event.target.value)} rows={4}/><div className="a3-actions"><button className="launch" disabled={question.trim().length < 2} onClick={() => act('setQuestion', { question })}><ArrowRight size={18}/> Envoyer la question</button></div></> : <p>La question va vous être envoyée.</p>}</div>
  }

  if (state.phase === 'answering') {
    return <div className="a3-stage"><p className="kicker">A 3 · REPONSE</p><h1>{isWinner ? 'En attente de la réponse' : 'Répondez à la question'}</h1><p className="winner-question">{state.winnerQuestion}</p>{isWinner ? <p>{state.answerRejected ? 'La réponse a été refusée : elle peut être modifiée.' : 'L’autre joueur prépare sa réponse.'}</p> : <><textarea value={answer} placeholder="Votre réponse…" onChange={(event) => setAnswer(event.target.value)} rows={5}/>{state.answerRejected && <p className="feedback">La réponse n’est pas encore satisfaisante. Modifiez-la et envoyez-la à nouveau.</p>}<div className="a3-actions"><button className="launch" disabled={answer.trim().length < 2} onClick={() => act('submitAnswer', { answer })}><ArrowRight size={18}/> Envoyer ma réponse</button></div></>}</div>
  }

  if (state.phase === 'awaitingApproval') {
    return <div className="a3-stage"><p className="kicker">A 3 · VALIDATION</p><h1>{isWinner ? 'La réponse vous convient-elle ?' : 'Réponse envoyée'}</h1><p className="winner-question">Question : {state.winnerQuestion}</p><p className="winner-question">Réponse : {state.answer}</p>{isWinner ? <div className="a3-actions"><button className="launch" onClick={() => act('approveAnswer')}>Satisfait · nouvelle manche <RotateCcw size={18}/></button><button className="a3-reject" onClick={() => act('rejectAnswer')}>Pas satisfait · modifier la réponse</button></div> : <p>Le gagnant examine votre réponse.</p>}</div>
  }
  return <div className="a3-stage"><p className="kicker">À 3 · QUESTION DU GAGNANT</p><h1>{isWinner ? 'Posez votre question' : 'Le gagnant prépare sa question'}</h1>{isWinner ? <textarea readOnly={false} defaultValue={state.winnerQuestion} placeholder="Votre question…" onBlur={async (event) => onUpdate(await onlineAction(sessionCode, 'setQuestion', { question: event.target.value }))} rows={4}/> : state.winnerQuestion ? <p className="winner-question">{state.winnerQuestion}</p> : <p>Patience…</p>}<div className="a3-actions"><button className="launch" onClick={replay}><RotateCcw size={18}/> Rejouer</button></div></div>
}
