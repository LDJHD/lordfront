'use client'

import { useEffect, useState } from 'react'
import { ArrowRight, Moon, Sun, Target } from 'lucide-react'
import { onlineAction, type OnlineSnapshot } from './online-api'

const roleLabels: Record<string, string> = { wolf: 'Loup-garou', seer: 'Voyante', witch: 'Sorcière', hunter: 'Chasseur', cupid: 'Cupidon', littleGirl: 'Petite Fille', chief: 'Chef du village', villager: 'Villageois' }

type WerewolfState = { phase: 'roles' | 'night' | 'discussion' | 'day' | 'reveal' | 'chiefDecision' | 'hunter' | 'finished'; nightStep: 'cupid' | 'seer' | 'littleGirl' | 'wolves' | 'witch'; night: number; nightDone: number[]; votes: Record<string, number>; wolfVotes: Record<string, number>; wolfPlayerIds: number[]; wolfMessages: { senderId: number; text: string }[]; wolfTarget: number | null; lovers: number[]; witchLifeAvailable: boolean; witchDeathAvailable: boolean; seerResult: { targetId: number; isWolf: boolean; role: string; roleLabel?: string } | null; privateNotice: { recipientIds: number[]; message: string } | null; announcement: string; lastDeaths: number[]; hunterQueue: number[]; winner: 'wolves' | 'village' | 'lovers' | null; chiefId: number | null; discussionEndsAt: string | null; dayMessages: { senderId: number; text: string }[] }

export default function WerewolfGameOnline({ sessionCode, snapshot, onUpdate }: { sessionCode: string; snapshot: OnlineSnapshot; onUpdate: (data: OnlineSnapshot) => void }) {
  const state = snapshot.gameState as WerewolfState
  const alive = snapshot.players.filter((player) => player.approved && player.alive)
  const [lovers, setLovers] = useState<number[]>([])
  const [wolfMessage, setWolfMessage] = useState('')
  const [dayMessage, setDayMessage] = useState('')
  const [witchSave, setWitchSave] = useState(false)
  const [witchKillTarget, setWitchKillTarget] = useState<number | null>(null)
  const [now, setNow] = useState(Date.now())
  const role = snapshot.me.role
  const announcement = state.announcement ?? ''
  const playerName = (id: number | null) => snapshot.players.find((player) => player.id === id)?.displayName ?? 'ce joueur'
  async function act(action: string, payload: Record<string, unknown> = {}) { onUpdate(await onlineAction(sessionCode, action, payload)) }
  async function sendWolfMessage() { if (!wolfMessage.trim()) return; await act('wolfMessage', { text: wolfMessage }); setWolfMessage('') }
  async function sendDayMessage() { if (!dayMessage.trim()) return; await act('dayMessage', { text: dayMessage }); setDayMessage('') }
  async function submitWitchAction() {
    await act('witchAction', { save: witchSave, ...(witchKillTarget ? { killTargetId: witchKillTarget } : {}) })
    setWitchSave(false)
    setWitchKillTarget(null)
  }

  useEffect(() => {
    if (state.phase !== 'discussion' || !state.discussionEndsAt) return
    const timer = window.setInterval(() => {
      const current = Date.now()
      setNow(current)
      if (current >= new Date(state.discussionEndsAt!).getTime()) act('closeDiscussion')
    }, 1000)
    return () => window.clearInterval(timer)
  }, [state.discussionEndsAt, state.phase])

  const canTakeLastHunterShot = state.phase === 'hunter' && state.hunterQueue.includes(snapshot.me.id)
  if (!snapshot.me.alive && state.phase !== 'finished' && !canTakeLastHunterShot) return <div className="wolf-stage night"><Moon size={28}/><p className="kicker">VILLAGE SECRET</p><h1>Vous êtes éliminé</h1><p className="wolf-announcement">{announcement}</p>{state.phase === 'discussion' && <div className="day-chat">{state.dayMessages.map((message, index) => <p key={`${message.senderId}-${index}`}><strong>{playerName(message.senderId)} :</strong> {message.text}</p>)}</div>}<p>Vous ne pouvez plus agir ni voter. Observez la suite en silence.</p></div>

  if (state.phase === 'roles') {
    const seen = state.nightDone.includes(snapshot.me.id)
    return <div className="wolf-stage night"><Moon size={28}/><p className="kicker">VILLAGE SECRET · RÔLE SECRET</p><h1>{snapshot.me.displayName}</h1><div className="role-card"><strong>{roleLabels[role ?? 'villager']}</strong><span>Gardez ce rôle secret pendant toute la partie.</span></div>{!seen ? <button className="launch" onClick={() => act('ackRole')}>J’ai mémorisé mon rôle <ArrowRight size={18}/></button> : <p>En attente que chaque joueur mémorise son rôle…</p>}</div>
  }
  if (state.phase === 'finished') return <div className="wolf-stage day"><Sun size={28}/><p className="kicker">PARTIE TERMINÉE</p><h1>{state.winner === 'village' ? 'Le village gagne !' : state.winner === 'lovers' ? 'Les amoureux gagnent !' : 'Les loups-garous gagnent !'}</h1>{snapshot.me.isHost && <button className="launch" onClick={() => act('restartWerewolf')}>Recommencer la partie <ArrowRight size={18}/></button>}</div>
  if (state.phase === 'hunter') {
    const mustShoot = state.hunterQueue.includes(snapshot.me.id)
    return <div className="wolf-stage night"><Target size={28}/><p className="kicker">DERNIÈRE ACTION</p><h1>{mustShoot ? 'Chasseur, choisissez votre cible' : 'Le Chasseur choisit sa cible'}</h1><p className="wolf-announcement">{announcement}</p>{mustShoot && <div className="vote-grid">{alive.map((player) => <button key={player.id} onClick={() => act('hunterShot', { targetPlayerId: player.id })}>{player.displayName}</button>)}</div>}</div>
  }
  if (state.phase === 'night') {
    const canCupid = state.nightStep === 'cupid' && role === 'cupid'
    const canSee = state.nightStep === 'seer' && role === 'seer'
    const canWolf = state.nightStep === 'wolves' && role === 'wolf'
    const canWitch = state.nightStep === 'witch' && role === 'witch'
    const canLittleGirl = state.nightStep === 'littleGirl' && role === 'littleGirl'
    const choices = Object.values(state.wolfVotes)
    const divergence = choices.length === state.wolfPlayerIds.length && new Set(choices).size > 1
    const chooseLover = (id: number) => setLovers((current) => current.includes(id) ? current.filter((item) => item !== id) : current.length < 2 ? [...current, id] : [current[1], id])
    return <div className="wolf-stage night"><span className="phase-icon"><Moon/></span><p className="kicker">NUIT {state.night} · ACTION SECRÈTE</p><p className="wolf-announcement">{announcement}</p>{state.privateNotice && <p className="wolf-private-notice">{state.privateNotice.message}</p>}
      {canCupid && <><h1>Cupidon, choisissez deux amoureux</h1><div className="vote-grid">{alive.map((player) => <button key={player.id} className={lovers.includes(player.id) ? 'picked' : ''} onClick={() => chooseLover(player.id)}>{player.displayName}</button>)}</div><button className="launch" disabled={lovers.length !== 2} onClick={() => act('chooseLovers', { playerIds: lovers })}>Unir les amoureux <ArrowRight size={18}/></button></>}
      {canSee && <><h1>Voyante, observez un joueur</h1>{state.seerResult ? <><p className="wolf-private-notice">Le rôle de {playerName(state.seerResult.targetId)} est : {state.seerResult.roleLabel ?? roleLabels[state.seerResult.role] ?? 'Villageois'}.</p><button className="launch" onClick={() => act('ackSeerResult')}>J’ai vu le rôle · continuer <ArrowRight size={18}/></button></> : <div className="vote-grid">{alive.filter((player) => player.id !== snapshot.me.id).map((player) => <button key={player.id} onClick={() => act('inspectPlayer', { targetPlayerId: player.id })}>{player.displayName}</button>)}</div>}</>}
      {canLittleGirl && <><h1>Petite Fille, observez discrètement</h1><p className="wolf-private-notice">Les Loups présents sont : {state.wolfPlayerIds.map(playerName).join(', ') || 'aucun'}.</p><button className="launch" onClick={() => act('ackLittleGirl')}>J’ai observé · continuer <ArrowRight size={18}/></button></>}
      {canWolf && <><h1>Loups-Garous, accordez-vous sur une victime</h1><div className="wolf-chat">{state.wolfMessages.map((message, index) => <p key={`${message.senderId}-${index}`}><strong>{playerName(message.senderId)} :</strong> {message.text}</p>)}</div><div className="wolf-chat-compose"><input value={wolfMessage} onChange={(event) => setWolfMessage(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && sendWolfMessage()} placeholder="Écrire aux Loups…" maxLength={300}/><button className="ghost" onClick={sendWolfMessage}>Envoyer</button></div>{divergence && <p className="night-alert">Vos choix divergent. Discutez et désignez tous la même personne.</p>}<div className="vote-grid">{alive.filter((player) => !state.wolfPlayerIds.includes(player.id)).map((player) => <button key={player.id} className={state.wolfVotes[String(snapshot.me.id)] === player.id ? 'picked' : ''} onClick={() => act('wolfVote', { targetPlayerId: player.id })}>{player.displayName}</button>)}</div></>}
      {canWitch && <><h1>Sorcière, la victime est {playerName(state.wolfTarget)}</h1><p>Potions : vie {state.witchLifeAvailable ? 'disponible' : 'utilisée'} · mort {state.witchDeathAvailable ? 'disponible' : 'utilisée'}</p><p>Préparez vos choix, puis validez-les ensemble.</p><div className="wolf-actions">{state.witchLifeAvailable && <button className={witchSave ? 'launch picked' : 'launch'} onClick={() => setWitchSave((current) => !current)}>{witchSave ? 'Victime sauvée' : 'Sauver la victime'}</button>}<button className="ghost" onClick={() => act('witchAction')}>Ne rien faire</button></div>{state.witchDeathAvailable && <div className="vote-grid">{alive.filter((player) => player.id !== snapshot.me.id).map((player) => <button key={player.id} className={witchKillTarget === player.id ? 'picked' : ''} onClick={() => setWitchKillTarget((current) => current === player.id ? null : player.id)}>Potion de mort : {player.displayName}</button>)}</div>}<button className="launch" onClick={submitWitchAction} disabled={!witchSave && !witchKillTarget}>Valider mes potions <ArrowRight size={18}/></button></>}
      {!canCupid && !canSee && !canLittleGirl && !canWolf && !canWitch && <><h1>Le village dort</h1><p>Restez silencieux : seuls les rôles appelés peuvent agir cette nuit.</p></>}
    </div>
  }
  if (state.phase === 'discussion' && true) {
    const seconds = Math.max(0, Math.ceil((new Date(state.discussionEndsAt ?? now).getTime() - now) / 1000))
    const hasVoted = Boolean(state.votes[String(snapshot.me.id)])
    return <div className="wolf-stage day"><span className="phase-icon"><Sun/></span><p className="kicker">JOUR · DEBAT DU VILLAGE</p><h1>Discutez et votez</h1><p className="wolf-announcement">{announcement}</p><p className="discussion-timer">Temps restant : {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}</p><div className="day-chat">{state.dayMessages.map((message, index) => <p key={`${message.senderId}-${index}`}><strong>{playerName(message.senderId)} :</strong> {message.text}</p>)}</div><div className="wolf-chat-compose"><input value={dayMessage} onChange={(event) => setDayMessage(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && sendDayMessage()} placeholder="Ecrire au village..." maxLength={400}/><button className="ghost" onClick={sendDayMessage}>Envoyer</button></div><p className="online-hint">Le debat dure 5 minutes. Si tous les survivants votent avant la fin, le resultat est applique immediatement.</p><div className="vote-grid">{alive.filter((player) => player.id !== snapshot.me.id).map((player) => <button key={player.id} className={state.votes[String(snapshot.me.id)] === player.id ? 'picked' : ''} disabled={hasVoted} onClick={() => act('vote', { targetPlayerId: player.id })}>{player.displayName}</button>)}</div>{hasVoted && <p>Vote enregistre. En attente des autres joueurs...</p>}</div>
  }
  if (false) {
    const seconds = Math.max(0, Math.ceil((new Date(state.discussionEndsAt ?? now).getTime() - now) / 1000))
    return <div className="wolf-stage day"><span className="phase-icon"><Sun/></span><p className="kicker">JOUR · DÉBAT DU VILLAGE</p><h1>Discutez avant la décision</h1><p className="wolf-announcement">{announcement}</p><p className="discussion-timer">Temps restant : {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}</p><div className="day-chat">{state.dayMessages.map((message, index) => <p key={`${message.senderId}-${index}`}><strong>{playerName(message.senderId)} :</strong> {message.text}</p>)}</div><div className="wolf-chat-compose"><input value={dayMessage} onChange={(event) => setDayMessage(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && sendDayMessage()} placeholder="Écrire au village…" maxLength={400}/><button className="ghost" onClick={sendDayMessage}>Envoyer</button></div></div>
  }
  if ((state.phase as string) === 'reveal') return <div className="wolf-stage day"><span className="phase-icon"><Sun/></span><p className="kicker">RESULTAT DU VOTE</p><h1>Le village a rendu son verdict</h1><p className="wolf-announcement">{announcement}</p><button className="launch" onClick={() => act('ackElimination')}>Continuer <ArrowRight size={18}/></button></div>
  if (state.phase === 'chiefDecision') {
    const isChief = snapshot.me.id === state.chiefId
    return <div className="wolf-stage day"><span className="phase-icon"><Sun/></span><p className="kicker">DÉCISION DU CHEF</p><h1>{isChief ? 'Chef du village, désignez un joueur' : 'Le Chef du village prend sa décision'}</h1><p className="wolf-announcement">{announcement}</p>{isChief && <div className="vote-grid">{alive.filter((player) => player.id !== snapshot.me.id).map((player) => <button key={player.id} onClick={() => act('chiefEliminate', { targetPlayerId: player.id })}>{player.displayName}</button>)}</div>}</div>
  }
  const hasVoted = Boolean(state.votes[String(snapshot.me.id)])
  return <div className="wolf-stage day"><span className="phase-icon"><Sun/></span><p className="kicker">JOUR · VOTE DU VILLAGE</p><h1>Éliminez un suspect</h1><p className="wolf-announcement">{announcement}</p><div className="vote-grid">{alive.filter((player) => player.id !== snapshot.me.id).map((player) => <button key={player.id} className={state.votes[String(snapshot.me.id)] === player.id ? 'picked' : ''} disabled={hasVoted} onClick={() => act('vote', { targetPlayerId: player.id })}>{player.displayName}</button>)}</div>{hasVoted && <p>Vote enregistré. En attente des autres joueurs…</p>}</div>
}
