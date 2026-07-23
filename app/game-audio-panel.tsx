'use client'

import { useEffect, useState } from 'react'
import { Volume2, VolumeX } from 'lucide-react'
import { resumeAudio, setAmbientVolume, startAmbient, stopAmbient } from './game-sounds'

const VOLUME_KEY = 'lord-ambient-volume'
const MUTED_KEY = 'lord-ambient-muted'

export default function GameAudioPanel() {
  const [volume, setVolume] = useState(0.22)
  const [muted, setMuted] = useState(false)

  useEffect(() => {
    const savedVolume = window.localStorage.getItem(VOLUME_KEY)
    const savedMuted = window.localStorage.getItem(MUTED_KEY)
    if (savedVolume) setVolume(Number(savedVolume))
    if (savedMuted) setMuted(savedMuted === '1')
  }, [])

  useEffect(() => {
    resumeAudio().then(() => {
      if (!muted) startAmbient(volume)
      else stopAmbient()
    })
    return () => stopAmbient()
  }, [])

  useEffect(() => {
    window.localStorage.setItem(VOLUME_KEY, String(volume))
    window.localStorage.setItem(MUTED_KEY, muted ? '1' : '0')
    if (muted) {
      stopAmbient()
      return
    }
    startAmbient(volume)
    setAmbientVolume(volume)
  }, [volume, muted])

  return (
    <div className="sound-controls">
      <button className="ghost" onClick={() => setMuted((value) => !value)} aria-label={muted ? 'Activer la musique' : 'Couper la musique'}>
        {muted ? <VolumeX size={16}/> : <Volume2 size={16}/>}
      </button>
      <input
        type="range"
        min={0.05}
        max={0.4}
        step={0.01}
        value={muted ? 0.05 : volume}
        onChange={(event) => {
          setMuted(false)
          setVolume(Number(event.target.value))
        }}
        aria-label="Volume de la musique d'ambiance"
      />
      <span className="sound-label">{muted ? 'Musique coupée' : 'Ambiance soirée'}</span>
    </div>
  )
}
