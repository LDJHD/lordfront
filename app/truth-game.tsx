'use client'

import { useEffect, useState } from 'react'
import { ArrowRight, Eye, UserRound } from 'lucide-react'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '/api'

type TruthQuestion = { id: number; body: string; level: number }

export default function TruthGame({ sessionCode }: { sessionCode: string }) {
  const [playerName, setPlayerName] = useState('')
  const [nameInput, setNameInput] = useState('')
  const [question, setQuestion] = useState<TruthQuestion | null>(null)
  const [revealed, setRevealed] = useState(false)
  const [loading, setLoading] = useState(false)
  const [complete, setComplete] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [questionCount, setQuestionCount] = useState(0)

  useEffect(() => {
    const saved = window.localStorage.getItem(`lord-player-${sessionCode}`)
    if (saved) setPlayerName(saved)
  }, [sessionCode])

  function saveName() {
    const trimmed = nameInput.trim()
    if (trimmed.length < 2) return setFeedback('Entrez un prénom ou surnom (2 caractères minimum).')
    window.localStorage.setItem(`lord-player-${sessionCode}`, trimmed)
    setPlayerName(trimmed)
    setFeedback('')
  }

  async function loadQuestion() {
    if (!playerName) return
    setLoading(true)
    setFeedback('')
    try {
      const response = await fetch(`${API_URL}/access-codes/${sessionCode}/questions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerName }),
      })
      const data = await response.json()
      if (response.status === 410) throw new Error(data.message ?? 'Session terminée.')
      if (!response.ok) throw new Error(data.message ?? 'Impossible de charger une question.')
      if (data.complete) {
        setComplete(true)
        setQuestion(null)
        setRevealed(false)
        return
      }
      setQuestion(data.question)
      setRevealed(false)
      setQuestionCount((count) => count + 1)
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Erreur de connexion.')
    } finally {
      setLoading(false)
    }
  }

  if (!playerName) {
    return <div className="truth-card setup"><UserRound size={28}/><p className="kicker">VÉRITÉS EN JEU · IDENTITÉ</p><h1>Comment vous appelez-vous ?</h1><p>Ce nom sera utilisé pour toute la session. Chaque joueur ne verra jamais deux fois la même question.</p><input value={nameInput} onChange={(event) => setNameInput(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && saveName()} placeholder="Votre prénom ou surnom" maxLength={40}/>{feedback && <p className="feedback">{feedback}</p>}<button className="launch" onClick={saveName}>Entrer dans la partie <ArrowRight size={18}/></button></div>
  }

  if (complete) {
    return <div className="truth-card revealed"><Eye size={28}/><p className="kicker">VÉRITÉS EN JEU · TERMINÉ</p><h1>Bravo {playerName} !</h1><p>Vous avez épuisé toutes les questions disponibles pour cette session.</p></div>
  }

  return <><p className="kicker">VÉRITÉ {questionCount || 1} · {playerName.toUpperCase()}</p><div className={`truth-card ${revealed ? 'revealed' : ''}`}><Eye size={28}/><h1 className="no-copy">{revealed && question ? question.body : 'La prochaine vérité attend son joueur.'}</h1><p>{revealed ? 'Répondez avec bienveillance, puis passez la carte au joueur suivant.' : 'Appuyez pour révéler une question inédite.'}{question && revealed && <span className="level-tag">Niveau {question.level}</span>}</p>{feedback && <p className="feedback">{feedback}</p>}<button className="launch" disabled={loading} onClick={() => revealed ? loadQuestion() : (question ? setRevealed(true) : loadQuestion())}>{loading ? 'Chargement…' : revealed ? 'J’ai répondu · suivante' : question ? 'Révéler la vérité' : 'Tirer une question'} <ArrowRight size={18}/></button></div></>
}
