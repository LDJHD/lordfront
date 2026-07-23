'use client'

import { useEffect, useState } from 'react'
import { ArrowRight, Circle, FileText, RotateCcw, Scissors } from 'lucide-react'

type Choice = 'rock' | 'paper' | 'scissors'
type Phase = 'countdown' | 'choosing' | 'reveal' | 'question'

const choices: { id: Choice; label: string; icon: typeof Circle }[] = [
  { id: 'rock', label: 'Pierre', icon: Circle },
  { id: 'paper', label: 'Feuille', icon: FileText },
  { id: 'scissors', label: 'Ciseaux', icon: Scissors },
]

const beats: Record<Choice, Choice> = { rock: 'scissors', scissors: 'paper', paper: 'rock' }

function winnerPhrase(winner: Choice, loser: Choice) {
  if (winner === 'rock' && loser === 'scissors') return 'La pierre écrase les ciseaux !'
  if (winner === 'scissors' && loser === 'paper') return 'Les ciseaux coupent le papier !'
  if (winner === 'paper' && loser === 'rock') return 'Le papier enveloppe la pierre !'
  return 'Victoire !'
}

function resolveRound(p1: Choice, p2: Choice) {
  if (p1 === p2) return { winner: 'draw' as const, phrase: 'Égalité parfaite. Personne ne gagne ce round.' }
  if (beats[p1] === p2) return { winner: 1 as const, phrase: winnerPhrase(p1, p2) }
  return { winner: 2 as const, phrase: winnerPhrase(p2, p1) }
}

export default function A3Game() {
  const [phase, setPhase] = useState<Phase>('countdown')
  const [countdown, setCountdown] = useState(3)
  const [picker, setPicker] = useState<1 | 2>(1)
  const [p1Choice, setP1Choice] = useState<Choice | null>(null)
  const [p2Choice, setP2Choice] = useState<Choice | null>(null)
  const [roundResult, setRoundResult] = useState<ReturnType<typeof resolveRound> | null>(null)
  const [winnerQuestion, setWinnerQuestion] = useState('')

  useEffect(() => {
    if (phase !== 'countdown') return
    if (countdown <= 0) {
      setPhase('choosing')
      return
    }
    const timer = window.setTimeout(() => setCountdown((value) => value - 1), 700)
    return () => window.clearTimeout(timer)
  }, [phase, countdown])

  function pick(choice: Choice) {
    if (picker === 1) {
      setP1Choice(choice)
      setPicker(2)
      return
    }
    setP2Choice(choice)
    const result = resolveRound(p1Choice!, choice)
    setRoundResult(result)
    setPhase('reveal')
    window.setTimeout(() => {
      if (result.winner === 'draw') replay()
      else setPhase('question')
    }, 1800)
  }

  function replay() {
    setPhase('countdown')
    setCountdown(3)
    setPicker(1)
    setP1Choice(null)
    setP2Choice(null)
    setRoundResult(null)
    setWinnerQuestion('')
  }

  if (phase === 'countdown') {
    return <div className="a3-stage"><p className="kicker">À 3 · PRÉPAREZ-VOUS</p><div className="a3-countdown">{countdown > 0 ? countdown : 'Choisissez !'}</div><p>Les deux joueurs choisissent en même temps après le décompte.</p></div>
  }

  if (phase === 'choosing') {
    return <div className="a3-stage"><p className="kicker">À 3 · TOUR DU JOUEUR {picker}</p><h1>{picker === 2 ? 'Ne regardez pas l’écran !' : 'Votre choix reste secret.'}</h1><p>Sélectionnez pierre, feuille ou ciseaux.</p><div className="a3-choices">{choices.map((item) => { const Icon = item.icon; return <button key={item.id} className="a3-choice" onClick={() => pick(item.id)}><Icon size={28}/><span>{item.label}</span></button> })}</div></div>
  }

  if (phase === 'reveal' && p1Choice && p2Choice && roundResult) {
    const label = (choice: Choice) => choices.find((item) => item.id === choice)!.label
    return <div className="a3-stage reveal"><p className="kicker">À 3 · RÉSULTAT</p><div className="a3-result-grid"><article><span>Joueur 1</span><strong>{label(p1Choice)}</strong></article><article><span>Joueur 2</span><strong>{label(p2Choice)}</strong></article></div><h1>{roundResult.winner === 'draw' ? 'Match nul' : `Joueur ${roundResult.winner} gagne !`}</h1><p>{roundResult.phrase}</p></div>
  }

  return <div className="a3-stage"><p className="kicker">À 3 · QUESTION DU GAGNANT</p><h1>Joueur {roundResult?.winner} pose sa question</h1><p>Écrivez une question ou une demande à l’autre joueur.</p><textarea value={winnerQuestion} onChange={(event) => setWinnerQuestion(event.target.value)} placeholder="Ex. Quelle est la chose la plus folle que tu aies faite ?" rows={4}/><div className="a3-actions"><button className="launch" onClick={replay}><RotateCcw size={18}/> Rejouer</button>{winnerQuestion.trim() && <button className="ghost" onClick={replay}>Question posée · nouvelle manche <ArrowRight size={16}/></button>}</div></div>
}
