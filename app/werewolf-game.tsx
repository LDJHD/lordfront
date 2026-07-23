'use client'

import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, Moon, Plus, Sun, UserRound, X } from 'lucide-react'

type Role = 'wolf' | 'seer' | 'healer' | 'villager'
type Phase = 'setup' | 'roles' | 'night' | 'day' | 'finished'
type Player = { name: string; role: Role; alive: boolean }

const roleLabels: Record<Role, string> = {
  wolf: 'Loup-garou',
  seer: 'Voyante',
  healer: 'Guérisseur',
  villager: 'Villageois',
}

const roleHints: Record<Role, string> = {
  wolf: 'La nuit, choisissez qui éliminer en secret avec les autres loups.',
  seer: 'La nuit, vous pouvez découvrir le rôle d’un joueur.',
  healer: 'La nuit, vous pouvez protéger un joueur des loups.',
  villager: 'Le jour, discutez et votez pour éliminer un suspect.',
}

function buildRoles(count: number): Role[] {
  if (count < 5 || count > 18) throw new Error('Village Secret nécessite entre 5 et 18 joueurs.')
  const wolves = count >= 12 ? 3 : count >= 7 ? 2 : 1
  const roles: Role[] = Array(wolves).fill('wolf')
  if (count >= 6) roles.push('seer')
  if (count >= 8) roles.push('healer')
  while (roles.length < count) roles.push('villager')
  for (let i = roles.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [roles[i], roles[j]] = [roles[j], roles[i]]
  }
  return roles
}

function wolvesWin(players: Player[]) {
  const wolves = players.filter((player) => player.alive && player.role === 'wolf').length
  const others = players.filter((player) => player.alive && player.role !== 'wolf').length
  return wolves >= others
}

function villageWin(players: Player[]) {
  return players.filter((player) => player.alive && player.role === 'wolf').length === 0
}

export default function WerewolfGame({ sessionCode }: { sessionCode: string }) {
  const storageKey = `lord-werewolf-${sessionCode}`
  const [phase, setPhase] = useState<Phase>('setup')
  const [players, setPlayers] = useState<Player[]>([])
  const [nameInput, setNameInput] = useState('')
  const [roleIndex, setRoleIndex] = useState(0)
  const [voteTarget, setVoteTarget] = useState('')
  const [nightActor, setNightActor] = useState(0)
  const [nightDone, setNightDone] = useState<string[]>([])
  const [feedback, setFeedback] = useState('')
  const [winner, setWinner] = useState<'wolves' | 'village' | null>(null)

  useEffect(() => {
    const saved = window.localStorage.getItem(storageKey)
    if (!saved) return
    const parsed = JSON.parse(saved) as { phase: Phase; players: Player[]; roleIndex: number }
    setPlayers(parsed.players)
    setPhase(parsed.phase)
    setRoleIndex(parsed.roleIndex)
  }, [storageKey])

  useEffect(() => {
    if (players.length === 0) return
    window.localStorage.setItem(storageKey, JSON.stringify({ phase, players, roleIndex }))
  }, [phase, players, roleIndex, storageKey])

  const alivePlayers = useMemo(() => players.filter((player) => player.alive), [players])

  function addPlayer() {
    const trimmed = nameInput.trim()
    if (trimmed.length < 2) return setFeedback('Nom trop court.')
    if (players.some((player) => player.name.toLowerCase() === trimmed.toLowerCase())) return setFeedback('Ce joueur existe déjà.')
    if (players.length >= 18) return setFeedback('Maximum 18 joueurs.')
    setPlayers((items) => [...items, { name: trimmed, role: 'villager', alive: true }])
    setNameInput('')
    setFeedback('')
  }

  function removePlayer(name: string) {
    setPlayers((items) => items.filter((player) => player.name !== name))
  }

  function startGame() {
    try {
      const roles = buildRoles(players.length)
      setPlayers(players.map((player, index) => ({ ...player, role: roles[index], alive: true })))
      setRoleIndex(0)
      setPhase('roles')
      setFeedback('')
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Impossible de démarrer.')
    }
  }

  function revealNextRole() {
    if (roleIndex + 1 >= players.length) {
      setPhase('night')
      setNightActor(0)
      setNightDone([])
      return
    }
    setRoleIndex((index) => index + 1)
  }

  function markNightDone(name: string) {
    setNightDone((items) => [...items, name])
    if (nightActor + 1 >= alivePlayers.length) {
      setPhase('day')
      setVoteTarget('')
      return
    }
    setNightActor((index) => index + 1)
  }

  function submitVote() {
    if (!voteTarget) return setFeedback('Choisissez un suspect.')
    const updated = players.map((player) => player.name === voteTarget ? { ...player, alive: false } : player)
    setPlayers(updated)
    setVoteTarget('')
    setFeedback('')
    if (villageWin(updated)) {
      setWinner('village')
      setPhase('finished')
      return
    }
    if (wolvesWin(updated)) {
      setWinner('wolves')
      setPhase('finished')
      return
    }
    setPhase('night')
    setNightActor(0)
    setNightDone([])
  }

  const pendingNight = alivePlayers.filter((player) => !nightDone.includes(player.name))

  if (phase === 'setup') {
    return <div className="wolf-stage day setup"><UserRound size={28}/><p className="kicker">VILLAGE SECRET · PRÉPARATION</p><h1>Ajoutez les joueurs présents</h1><p>Minimum 5 joueurs. Passez le téléphone pour que chacun entre son prénom.</p><div className="wolf-add"><input value={nameInput} onChange={(event) => setNameInput(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && addPlayer()} placeholder="Prénom du joueur" maxLength={32}/><button className="launch" onClick={addPlayer}><Plus size={16}/> Ajouter</button></div>{feedback && <p className="feedback">{feedback}</p>}<div className="vote-grid">{players.map((player) => <button key={player.name} className="player-chip" onClick={() => removePlayer(player.name)}>{player.name}<X size={14}/></button>)}</div><button className="launch" disabled={players.length < 5} onClick={startGame}>Distribuer les rôles · {players.length}/5 min <ArrowRight size={18}/></button></div>
  }

  if (phase === 'roles') {
    const player = players[roleIndex]
    return <div className="wolf-stage night"><Moon size={28}/><p className="kicker">VILLAGE SECRET · RÔLE SECRET</p><h1>{player.name}, regardez seul</h1><p>Passez l’appareil uniquement à cette personne.</p><div className="role-card"><strong>{roleLabels[player.role]}</strong><span>{roleHints[player.role]}</span></div><button className="launch" onClick={revealNextRole}>{roleIndex + 1 >= players.length ? 'Commencer la nuit' : 'Joueur suivant'} <ArrowRight size={18}/></button></div>
  }

  if (phase === 'night') {
    const actor = alivePlayers[nightActor]
    return <div className="wolf-stage night"><span className="phase-icon"><Moon/></span><p className="kicker">NUIT {Math.floor(nightActor / alivePlayers.length) + 1}</p><h1>{actor.name}, c’est votre tour</h1><p>{roleHints[actor.role]}</p>{pendingNight.length > 0 && <p className="night-alert">En attente : {pendingNight.map((player) => player.name).join(', ')}</p>}<button className="launch" onClick={() => markNightDone(actor.name)}>Action terminée <ArrowRight size={18}/></button></div>
  }

  if (phase === 'day') {
    return <div className="wolf-stage day"><span className="phase-icon"><Sun/></span><p className="kicker">LE JOUR SE LÈVE</p><h1>Le village délibère</h1><p>Votez pour éliminer le suspect le plus dangereux.</p><div className="vote-grid">{alivePlayers.map((player) => <button key={player.name} className={voteTarget === player.name ? 'picked' : ''} onClick={() => setVoteTarget(player.name)}>{player.name}</button>)}</div>{feedback && <p className="feedback">{feedback}</p>}<button className="launch" onClick={submitVote}>{voteTarget ? `Éliminer ${voteTarget}` : 'Choisir un suspect'} <ArrowRight size={18}/></button></div>
  }

  return <div className="wolf-stage day"><Sun size={28}/><p className="kicker">PARTIE TERMINÉE</p><h1>{winner === 'village' ? 'Le village gagne !' : 'Les loups-garous gagnent !'}</h1><p>Relancez une nouvelle partie en ajoutant à nouveau les joueurs.</p><button className="launch" onClick={() => { window.localStorage.removeItem(storageKey); setPlayers([]); setPhase('setup'); setWinner(null) }}>Nouvelle partie <ArrowRight size={18}/></button></div>
}
