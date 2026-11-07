'use client'

import { useEffect, useRef, useState } from 'react'
import { LoaderCircle, Mic, Square } from 'lucide-react'
import { resolveMediaUrl, uploadVoiceNote } from './online-api'

export type ChatAudio = { url: string; mime?: string; durationMs?: number }

function pickMime() {
  if (typeof MediaRecorder === 'undefined') return ''
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4']
  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) ?? ''
}

export function formatAudioDuration(ms?: number) {
  if (!Number.isFinite(ms) || !ms || ms < 0) return ''
  const total = Math.round(ms / 1000)
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

export function ChatAudioPlayer({ audio, className = '' }: { audio?: ChatAudio | null; className?: string }) {
  if (!audio?.url) return null
  return (
    <audio
      className={`chat-audio-player ${className}`.trim()}
      controls
      preload="none"
      src={resolveMediaUrl(audio.url)}
    />
  )
}

export function VoiceRecordButton({
  sessionCode,
  onSend,
  disabled,
  className = 'ghost',
  label,
}: {
  sessionCode: string
  onSend: (payload: { text?: string; audioUrl: string; audioMime?: string; audioDurationMs?: number }) => Promise<void> | void
  disabled?: boolean
  className?: string
  label?: string
}) {
  const [recording, setRecording] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [error, setError] = useState('')
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const startedAtRef = useRef(0)
  const timerRef = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current)
      streamRef.current?.getTracks().forEach((track) => track.stop())
      if (recorderRef.current && recorderRef.current.state !== 'inactive') recorderRef.current.stop()
    }
  }, [])

  async function start() {
    setError('')
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setError('Les notes vocales ne sont pas supportées sur ce navigateur.')
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const mime = pickMime()
      const recorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream)
      recorderRef.current = recorder
      chunksRef.current = []
      startedAtRef.current = Date.now()
      setElapsed(0)
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data)
      }
      recorder.onerror = () => setError('Enregistrement audio interrompu.')
      recorder.onstop = async () => {
        if (timerRef.current) window.clearInterval(timerRef.current)
        timerRef.current = null
        stream.getTracks().forEach((track) => track.stop())
        streamRef.current = null
        const durationMs = Math.max(0, Date.now() - startedAtRef.current)
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || mime || 'audio/webm' })
        chunksRef.current = []
        setRecording(false)
        if (blob.size < 256) return
        setUploading(true)
        try {
          const uploaded = await uploadVoiceNote(sessionCode, blob)
          await onSend({
            audioUrl: uploaded.url,
            audioMime: uploaded.mime ?? blob.type,
            audioDurationMs: durationMs,
          })
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Envoi de la note vocale impossible.')
        } finally {
          setUploading(false)
        }
      }
      recorder.start(250)
      setRecording(true)
      timerRef.current = window.setInterval(() => setElapsed(Date.now() - startedAtRef.current), 200)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Microphone refusé ou indisponible.')
    }
  }

  function stop() {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') recorderRef.current.stop()
  }

  if (uploading) {
    return (
      <button type="button" className={className} disabled title="Envoi de la note vocale…">
        <LoaderCircle size={16} className="spinning" />
      </button>
    )
  }

  return (
    <span className="voice-record-wrap">
      <button
        type="button"
        className={`${className} ${recording ? 'recording' : ''}`.trim()}
        onClick={() => (recording ? stop() : void start())}
        disabled={disabled || uploading}
        title={recording ? 'Arrêter et envoyer la note vocale' : 'Enregistrer une note vocale'}
        aria-label={recording ? 'Arrêter la note vocale' : 'Enregistrer une note vocale'}
      >
        {recording ? <Square size={16} /> : <Mic size={16} />}
        {label ? <span>{label}</span> : null}
      </button>
      {recording && <small className="voice-record-timer">{formatAudioDuration(elapsed)}</small>}
      {error && <small className="voice-record-error" title={error}>!</small>}
    </span>
  )
}
