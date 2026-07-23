'use client'

import { useEffect, useRef, useState } from 'react'
import { Pause, Play, SkipBack, SkipForward, Volume2, VolumeX } from 'lucide-react'
import { GAME_PLAYLIST } from './game-playlist'

const TRACK_KEY = 'lord-music-track'
const VOLUME_KEY = 'lord-music-volume'
const MUTED_KEY = 'lord-music-muted'
const PLAYING_KEY = 'lord-music-playing'

export default function GameMusicPlayer() {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [trackIndex, setTrackIndex] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [volume, setVolume] = useState(0.45)
  const [muted, setMuted] = useState(false)

  useEffect(() => {
    const savedTrack = window.localStorage.getItem(TRACK_KEY)
    const savedVolume = window.localStorage.getItem(VOLUME_KEY)
    const savedMuted = window.localStorage.getItem(MUTED_KEY)
    const savedPlaying = window.localStorage.getItem(PLAYING_KEY)
    if (savedTrack) setTrackIndex(Number(savedTrack) % GAME_PLAYLIST.length)
    if (savedVolume) setVolume(Number(savedVolume))
    if (savedMuted) setMuted(savedMuted === '1')
    if (savedPlaying) setPlaying(savedPlaying === '1')
  }, [])

  useEffect(() => {
    const audio = new Audio(GAME_PLAYLIST[trackIndex]?.src)
    audio.loop = true
    audio.volume = muted ? 0 : volume
    audioRef.current = audio

    if (playing) {
      audio.play().catch(() => setPlaying(false))
    }

    return () => {
      audio.pause()
      audio.src = ''
    }
  }, [trackIndex])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    audio.volume = muted ? 0 : volume
    window.localStorage.setItem(VOLUME_KEY, String(volume))
    window.localStorage.setItem(MUTED_KEY, muted ? '1' : '0')
  }, [volume, muted])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    if (playing) audio.play().catch(() => setPlaying(false))
    else audio.pause()
    window.localStorage.setItem(PLAYING_KEY, playing ? '1' : '0')
  }, [playing])

  function changeTrack(nextIndex: number) {
    const wrapped = (nextIndex + GAME_PLAYLIST.length) % GAME_PLAYLIST.length
    setTrackIndex(wrapped)
    window.localStorage.setItem(TRACK_KEY, String(wrapped))
    setPlaying(true)
  }

  const current = GAME_PLAYLIST[trackIndex]

  return (
    <div className="music-player">
      <div className="music-player-top">
        <button className="ghost" onClick={() => changeTrack(trackIndex - 1)} aria-label="Musique précédente">
          <SkipBack size={16}/>
        </button>
        <button className="ghost" onClick={() => setPlaying((value) => !value)} aria-label={playing ? 'Pause' : 'Lecture'}>
          {playing ? <Pause size={16}/> : <Play size={16}/>}
        </button>
        <button className="ghost" onClick={() => changeTrack(trackIndex + 1)} aria-label="Musique suivante">
          <SkipForward size={16}/>
        </button>
        <button className="ghost" onClick={() => setMuted((value) => !value)} aria-label={muted ? 'Activer le son' : 'Couper le son'}>
          {muted ? <VolumeX size={16}/> : <Volume2 size={16}/>}
        </button>
        <input
          type="range"
          min={0.05}
          max={1}
          step={0.01}
          value={muted ? 0 : volume}
          onChange={(event) => {
            setMuted(false)
            setVolume(Number(event.target.value))
          }}
          aria-label="Volume musique"
        />
      </div>
      <select
        className="music-select"
        value={trackIndex}
        onChange={(event) => changeTrack(Number(event.target.value))}
        aria-label="Choisir une musique"
      >
        {GAME_PLAYLIST.map((track, index) => (
          <option key={track.id} value={index}>{track.title}</option>
        ))}
      </select>
      <span className="sound-label">{playing ? `En cours : ${current?.title ?? '—'}` : 'Musique en pause'}</span>
    </div>
  )
}
