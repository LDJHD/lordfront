'use client'

import { useEffect, useRef, useState } from 'react'
import {
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  Image as ImageIcon,
  LoaderCircle,
  Mic,
  Paperclip,
  Play,
  Send,
  Square,
  Trash2,
  Video,
  X,
} from 'lucide-react'
import { openChatMedia, resolveMediaUrl, uploadChatMedia, type OnlineSnapshot } from './online-api'

export type ChatAttachmentKind = 'audio' | 'image' | 'video'

export type ChatAttachment = {
  id?: string
  kind: ChatAttachmentKind
  url: string
  mime?: string
  durationMs?: number
  name?: string
  viewOnce?: boolean
  viewedBy?: number[]
  consumed?: boolean
}

export type ChatMessage = {
  id?: string
  senderId: number
  text: string
  timestamp?: string
  audio?: { url: string; mime?: string; durationMs?: number }
  attachments?: ChatAttachment[]
}

export type ChatSendPayload = {
  text?: string
  attachments?: Array<{ id?: string; kind: ChatAttachmentKind; url: string; mime?: string; durationMs?: number; name?: string; viewOnce?: boolean }>
  // legacy compat
  audioUrl?: string
  audioMime?: string
  audioDurationMs?: number
}

type PendingMedia = {
  file: File
  url: string
  kind: 'image' | 'video'
  mime: string
  viewOnce: boolean
}

const MEDIA_MIME_BY_EXT: Record<string, string> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif', avif: 'image/avif',
  mp4: 'video/mp4', m4v: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime',
}

function guessMediaMime(name: string) {
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  return MEDIA_MIME_BY_EXT[ext] ?? ''
}

function pickAudioMime() {
  if (typeof MediaRecorder === 'undefined') return ''
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4']
  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) ?? ''
}

function fmtDuration(ms?: number) {
  if (!Number.isFinite(ms) || !ms || ms < 0) return ''
  const total = Math.round(ms / 1000)
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

function fmtTime(ts?: string) {
  if (!ts) return ''
  const d = new Date(ts)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function attachmentKind(a: ChatAttachment): ChatAttachmentKind {
  if (a.kind === 'image' || a.kind === 'video' || a.kind === 'audio') return a.kind
  if (a.mime?.startsWith('image/')) return 'image'
  if (a.mime?.startsWith('video/')) return 'video'
  return 'audio'
}

function isViewOnceConsumed(a: ChatAttachment, meId: number, senderId: number) {
  if (!a.viewOnce) return false
  if (senderId === meId) return false
  return Boolean(a.consumed || a.viewedBy?.includes(meId) || !a.url)
}

function normalizeLegacyAudio(msg: ChatMessage): ChatAttachment[] {
  const atts = Array.isArray(msg.attachments) ? msg.attachments : []
  if (atts.length || !msg.audio?.url) return atts
  return [{ kind: 'audio', url: msg.audio.url, mime: msg.audio.mime, durationMs: msg.audio.durationMs }]
}

function AttachmentView({
  attachment,
  senderId,
  meId,
  messageId,
  sessionCode,
  onOpened,
}: {
  attachment: ChatAttachment
  senderId: number
  meId: number
  messageId?: string
  sessionCode?: string
  onOpened?: (snapshot?: OnlineSnapshot) => void
}) {
  const kind = attachmentKind(attachment)
  const consumed = isViewOnceConsumed(attachment, meId, senderId)
  const isMine = senderId === meId
  // On mémorise l'URL au moment de l'ouverture : le serveur redacte ensuite le
  // média dans le snapshot (vue unique), mais l'utilisateur doit pouvoir le voir
  // jouer maintenant, tant que le composant reste monté.
  const [revealedUrl, setRevealedUrl] = useState<string | null>(null)
  const [opening, setOpening] = useState(false)
  const [mediaError, setMediaError] = useState(false)

  const effectiveUrl = revealedUrl || attachment.url
  const baseSrc = resolveMediaUrl(effectiveUrl)

  // Le type MIME est passé en indice au serveur : indispensable pour les anciens
  // fichiers .webm audio (le navigateur a besoin de audio/webm, pas video/webm).
  const params: string[] = []
  const mimeHint = attachment.mime || (kind === 'audio' ? 'audio/webm' : kind === 'video' ? 'video/mp4' : '')
  if (mimeHint) params.push(`mime=${encodeURIComponent(mimeHint)}`)
  // Sans no-store, un média à vue unique resterait dans le cache du navigateur
  // et pourrait être rejoué après avoir été consommé.
  if (attachment.viewOnce) params.push('once=1')
  const src = baseSrc
    ? (params.length ? `${baseSrc}${baseSrc.includes('?') ? '&' : '?'}${params.join('&')}` : baseSrc)
    : ''

  useEffect(() => {
    setMediaError(false)
  }, [src])

  async function openOnce() {
    if (!attachment.viewOnce || consumed || isMine || revealedUrl) return
    const url = attachment.url
    setOpening(true)
    try {
      const snapshot = sessionCode && messageId
        ? await openChatMedia(sessionCode, messageId, attachment.id)
        : undefined
      setRevealedUrl(url)
      onOpened?.(snapshot)
    } catch {
      // keep closed on error
    } finally {
      setOpening(false)
    }
  }

  if (consumed && !revealedUrl) {
    return (
      <div className="gc-attachment gc-consumed" aria-label="Média à vue unique ouvert">
        <EyeOff size={16} />
        <span>{kind === 'video' ? 'Vidéo vue' : kind === 'image' ? 'Photo vue' : 'Média vu'}</span>
      </div>
    )
  }

  if (attachment.viewOnce && !isMine && !revealedUrl) {
    return (
      <button type="button" className="gc-attachment gc-viewonce" onClick={() => void openOnce()} disabled={opening}>
        {opening ? <LoaderCircle size={18} className="spin" /> : kind === 'video' ? <Play size={18} /> : kind === 'image' ? <Eye size={18} /> : <Play size={18} />}
        <span>{kind === 'video' ? 'Voir la vidéo (1 fois)' : kind === 'image' ? 'Voir la photo (1 fois)' : 'Écouter (1 fois)'}</span>
        <em>Vue unique</em>
      </button>
    )
  }

  if (!baseSrc) return null

  if (kind === 'image') {
    return (
      <div className="gc-attachment gc-image">
        {attachment.viewOnce && <span className="gc-badge"><Eye size={12} /> {isMine ? 'Vue unique' : 'Vue unique ouverte'}</span>}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={attachment.name || 'Photo'} loading="lazy" onError={() => setMediaError(true)} onClick={() => window.open(src, '_blank', 'noopener,noreferrer')} />
        {mediaError ? <a className="gc-media-fallback" href={src} target="_blank" rel="noopener noreferrer">Ouvrir la photo</a> : null}
      </div>
    )
  }
  if (kind === 'video') {
    return (
      <div className="gc-attachment gc-video">
        {attachment.viewOnce && <span className="gc-badge"><Eye size={12} /> {isMine ? 'Vue unique' : 'Vue unique ouverte'}</span>}
        <video key={src} controls playsInline preload="metadata" src={src} onError={() => setMediaError(true)}>
          {mimeHint ? <source src={src} type={mimeHint} /> : null}
        </video>
        {mediaError ? <a className="gc-media-fallback" href={src} target="_blank" rel="noopener noreferrer">Ouvrir la vidéo</a> : null}
      </div>
    )
  }
  return (
    <div className="gc-attachment gc-audio">
      {attachment.viewOnce && <span className="gc-badge"><Eye size={12} /> {isMine ? 'Vue unique' : 'Vue unique'}</span>}
      <audio key={src} controls preload="auto" src={src} onError={() => setMediaError(true)}>
        {mimeHint ? <source src={src} type={mimeHint} /> : null}
      </audio>
      {attachment.durationMs ? <small>{fmtDuration(attachment.durationMs)}</small> : null}
      {mediaError ? <a className="gc-media-fallback" href={src} target="_blank" rel="noopener noreferrer">Télécharger l’audio</a> : null}
    </div>
  )
}

export function GameChatPanel({
  messages,
  meId,
  sessionCode,
  playerName,
  onSend,
  onOpened,
  title = 'Chat',
  placeholder = 'Message…',
  emptyText = 'Aucun message pour le moment.',
  className = '',
  compact = false,
  maxHeight = 220,
  disabled = false,
  readOnly = false,
}: {
  messages: ChatMessage[]
  meId: number
  sessionCode: string
  playerName: (id: number) => string
  onSend: (payload: ChatSendPayload) => Promise<void> | void
  onOpened?: (snapshot?: OnlineSnapshot) => void
  title?: string
  placeholder?: string
  emptyText?: string
  className?: string
  compact?: boolean
  maxHeight?: number
  disabled?: boolean
  readOnly?: boolean
}) {
  const [collapsed, setCollapsed] = useState(false)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  // Vue unique de la note vocale en cours d'aperçu (une option par message envoyé).
  const [viewOnce, setViewOnce] = useState(false)
  const [attachMenu, setAttachMenu] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pendingMedia, setPendingMedia] = useState<PendingMedia | null>(null)
  const endRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  // Libère l'URL locale de l'aperçu photo/vidéo quand on le remplace/ferme.
  useEffect(() => () => {
    if (pendingMedia?.url) URL.revokeObjectURL(pendingMedia.url)
  }, [pendingMedia?.url])

  // Voice recording state
  const [recState, setRecState] = useState<'idle' | 'recording' | 'preview'>('idle')
  const [recMs, setRecMs] = useState(0)
  const [recBlob, setRecBlob] = useState<Blob | null>(null)
  const [recUrl, setRecUrl] = useState<string | null>(null)
  const [recMime, setRecMime] = useState('')
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const startRef = useRef(0)
  const timerRef = useRef<number | null>(null)
  const cancelledRef = useRef(false)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  useEffect(() => () => {
    if (timerRef.current) window.clearInterval(timerRef.current)
    recorderRef.current?.stream.getTracks().forEach((t) => t.stop())
    streamRef.current?.getTracks().forEach((t) => t.stop())
    if (recUrl) URL.revokeObjectURL(recUrl)
  }, [recUrl])

  function clearRecording() {
    if (timerRef.current) window.clearInterval(timerRef.current)
    timerRef.current = null
    recorderRef.current = null
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    chunksRef.current = []
    if (recUrl) URL.revokeObjectURL(recUrl)
    setRecUrl(null)
    setRecBlob(null)
    setRecMs(0)
    setRecState('idle')
    setViewOnce(false)
  }

  async function startRecording() {
    if (sending || recState !== 'idle' || disabled) return
    setError(null)
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setError('Microphone non disponible sur cet appareil/navigateur.')
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const mime = pickAudioMime()
      setRecMime(mime || 'audio/webm')
      const recorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream)
      recorderRef.current = recorder
      chunksRef.current = []
      cancelledRef.current = false
      startRef.current = Date.now()
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      recorder.onerror = () => { setError('Erreur d’enregistrement.'); clearRecording() }
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop())
        streamRef.current = null
        if (timerRef.current) window.clearInterval(timerRef.current)
        timerRef.current = null
        if (cancelledRef.current) { clearRecording(); return }
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || mime || 'audio/webm' })
        if (blob.size < 200) { clearRecording(); return }
        const url = URL.createObjectURL(blob)
        setRecBlob(blob)
        setRecUrl(url)
        setRecState('preview')
      }
      recorder.start(250)
      setRecState('recording')
      timerRef.current = window.setInterval(() => setRecMs(Math.max(0, Date.now() - startRef.current)), 250)
    } catch {
      setError('Accès micro refusé ou impossible.')
      clearRecording()
    }
  }

  function stopRecording() {
    if (recState !== 'recording') return
    cancelledRef.current = false
    try { recorderRef.current?.stop() } catch { clearRecording() }
  }

  function cancelRecording() {
    if (recState === 'recording') {
      cancelledRef.current = true
      try { recorderRef.current?.stop() } catch { clearRecording() }
      return
    }
    clearRecording()
  }

  async function sendVoiceNote() {
    if (!recBlob || recState !== 'preview' || sending) return
    setSending(true)
    setError(null)
    try {
      const uploaded = await uploadChatMedia(sessionCode, recBlob, `voice-note.${(recMime || recBlob.type || '').includes('ogg') ? 'ogg' : (recMime || '').includes('mp4') ? 'm4a' : 'webm'}`)
      await onSend({
        attachments: [{
          kind: 'audio',
          url: uploaded.url,
          mime: uploaded.mime || recMime || recBlob.type || 'audio/webm',
          durationMs: recMs || undefined,
          viewOnce: viewOnce || undefined,
        }],
      })
      clearRecording()
      setViewOnce(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Envoi impossible.')
    } finally {
      setSending(false)
    }
  }

  async function sendText() {
    const v = text.trim()
    if (!v || sending || disabled) return
    setSending(true)
    setError(null)
    try {
      await onSend({ text: v })
      setText('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Envoi impossible.')
    } finally {
      setSending(false)
    }
  }

  function pickFile(kind: 'image' | 'video') {
    setAttachMenu(false)
    const input = fileRef.current
    if (!input) return
    // On met à jour l'attribut directement (synchrone) : sinon le sélecteur
    // peut encore être filtré sur l'ancien type et refuser les vidéos.
    input.accept = kind === 'image'
      ? 'image/jpeg,image/png,image/webp,image/gif,image/avif'
      : 'video/mp4,video/webm,video/quicktime,video/x-m4v'
    input.click()
  }

  function clearPendingMedia() {
    if (pendingMedia?.url) URL.revokeObjectURL(pendingMedia.url)
    setPendingMedia(null)
  }

  function onFileSelected(file: File | null) {
    if (fileRef.current) fileRef.current.value = ''
    if (!file || sending || disabled) return
    setError(null)
    const declared = file.type.trim().toLowerCase()
    const mime = declared && declared !== 'application/octet-stream' ? declared : guessMediaMime(file.name)
    const isImage = mime.startsWith('image/')
    const isVideo = mime.startsWith('video/')
    if (!isImage && !isVideo) {
      setError('Format non supporté : choisissez une photo ou une vidéo.')
      return
    }
    if (pendingMedia?.url) URL.revokeObjectURL(pendingMedia.url)
    setPendingMedia({
      file,
      url: URL.createObjectURL(file),
      kind: isVideo ? 'video' : 'image',
      mime,
      viewOnce: false,
    })
  }

  async function sendPendingMedia() {
    if (!pendingMedia || sending) return
    setSending(true)
    setError(null)
    try {
      const uploaded = await uploadChatMedia(sessionCode, pendingMedia.file, pendingMedia.file.name, pendingMedia.mime)
      await onSend({
        attachments: [{
          kind: pendingMedia.kind,
          url: uploaded.url,
          mime: uploaded.mime || pendingMedia.mime || pendingMedia.file.type,
          name: uploaded.name || pendingMedia.file.name,
          viewOnce: pendingMedia.viewOnce || undefined,
        }],
      })
      clearPendingMedia()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Envoi impossible.')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className={`gc-panel ${collapsed ? 'collapsed' : ''} ${compact ? 'compact' : ''} ${className}`.trim()}>
      <button type="button" className="gc-header" onClick={() => setCollapsed((v) => !v)} aria-expanded={!collapsed}>
        <span className="gc-header-title">{title} <em>{messages.length}</em></span>
        {collapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
      </button>

      {!collapsed && (
        <>
          <div className="gc-messages" style={{ maxHeight }}>
            {messages.length === 0 && <p className="gc-empty">{emptyText}</p>}
            {messages.map((msg, index) => {
              const own = msg.senderId === meId
              const attachments = normalizeLegacyAudio(msg)
              return (
                <div key={msg.id || `${msg.senderId}-${msg.timestamp}-${index}`} className={`gc-msg ${own ? 'own' : 'other'} ${attachments.length ? 'has-media' : ''}`.trim()}>
                  <div className="gc-msg-meta">
                    <strong>{playerName(msg.senderId)}</strong>
                    {msg.timestamp ? <time>{fmtTime(msg.timestamp)}</time> : null}
                  </div>
                  {msg.text ? <p className="gc-msg-text">{msg.text}</p> : null}
                  {attachments.map((att, ai) => (
                    <AttachmentView key={att.id || ai} attachment={att} senderId={msg.senderId} meId={meId} messageId={msg.id} sessionCode={sessionCode} onOpened={onOpened} />
                  ))}
                </div>
              )
            })}
            <div ref={endRef} />
          </div>

          {error && <div className="gc-error">{error} <button type="button" onClick={() => setError(null)}><X size={14} /></button></div>}

          {!readOnly && recState === 'recording' && (
            <div className="gc-voice-bar recording">
              <span className="gc-rec-dot" /> <span>Enregistrement… {fmtDuration(recMs)}</span>
              <div className="gc-voice-actions">
                <button type="button" className="gc-btn danger" onClick={cancelRecording} title="Supprimer"><Trash2 size={16} /> <span>Supprimer</span></button>
                <button type="button" className="gc-btn primary" onClick={stopRecording} title="Arrêter et écouter"><Square size={15} /> <span>Arrêter</span></button>
              </div>
            </div>
          )}

          {!readOnly && recState === 'preview' && recUrl && (
            <div className="gc-voice-bar preview">
              <audio src={recUrl} controls preload="metadata" />
              <label className={`gc-vo-toggle ${viewOnce ? 'on' : ''}`} title="Vue unique">
                <input type="checkbox" checked={viewOnce} disabled={sending} onChange={(e) => setViewOnce(e.target.checked)} />
                {viewOnce ? <Eye size={14} /> : <EyeOff size={14} />} <span>1 vue</span>
              </label>
              <div className="gc-voice-actions">
                <button type="button" className="gc-btn danger" onClick={clearRecording} disabled={sending} title="Supprimer"><Trash2 size={16} /></button>
                <button type="button" className="gc-btn primary" onClick={() => void sendVoiceNote()} disabled={sending} title="Envoyer">
                  {sending ? <LoaderCircle size={16} className="spin" /> : <Send size={16} />} <span>Envoyer</span>
                </button>
              </div>
            </div>
          )}

          {!readOnly && recState === 'idle' && pendingMedia && (
            <div className="gc-media-preview">
              {pendingMedia.kind === 'image' ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={pendingMedia.url} alt="Aperçu" />
              ) : (
                <video src={pendingMedia.url} controls playsInline preload="metadata" />
              )}
              <div className="gc-media-preview-bar">
                <label className={`gc-vo-toggle ${pendingMedia.viewOnce ? 'on' : ''}`} title="Vue unique pour ce message">
                  <input
                    type="checkbox"
                    checked={pendingMedia.viewOnce}
                    disabled={sending}
                    onChange={(e) => setPendingMedia((p) => (p ? { ...p, viewOnce: e.target.checked } : p))}
                  />
                  {pendingMedia.viewOnce ? <Eye size={14} /> : <EyeOff size={14} />} <span>1 vue</span>
                </label>
                <div className="gc-voice-actions">
                  <button type="button" className="gc-btn danger" onClick={clearPendingMedia} disabled={sending} title="Supprimer"><Trash2 size={16} /></button>
                  <button type="button" className="gc-btn primary" onClick={() => void sendPendingMedia()} disabled={sending} title="Envoyer">
                    {sending ? <LoaderCircle size={16} className="spin" /> : <Send size={16} />} <span>Envoyer</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {!readOnly && recState === 'idle' && !pendingMedia && (
            <div className="gc-compose">
              <input
                type="file"
                ref={fileRef}
                className="gc-file-input"
                accept="image/jpeg,image/png,image/webp,image/gif,image/avif,video/mp4,video/webm,video/quicktime,video/x-m4v"
                onChange={(e) => onFileSelected(e.target.files?.[0] ?? null)}
              />
              <div className="gc-attach-wrap">
                <button type="button" className="gc-icon-btn" onClick={() => setAttachMenu((v) => !v)} disabled={disabled || sending} title="Joindre photo/vidéo">
                  <Paperclip size={18} />
                </button>
                {attachMenu && (
                  <div className="gc-attach-menu">
                    <button type="button" onClick={() => pickFile('image')}><ImageIcon size={16} /> Photo</button>
                    <button type="button" onClick={() => pickFile('video')}><Video size={16} /> Vidéo</button>
                  </div>
                )}
              </div>
              <input
                className="gc-text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void sendText() } }}
                placeholder={placeholder}
                maxLength={500}
                disabled={disabled || sending}
              />
              <button type="button" className="gc-icon-btn" onClick={() => void startRecording()} disabled={disabled || sending} title="Note vocale">
                <Mic size={18} />
              </button>
              <button type="button" className="gc-icon-btn primary" onClick={() => void sendText()} disabled={disabled || sending || !text.trim()} title="Envoyer">
                {sending ? <LoaderCircle size={18} className="spin" /> : <Send size={18} />}
              </button>
            </div>
          )}
          {readOnly ? <div className="gc-vo-hint" style={{justifyContent:'center',color:'#9b90a8'}}><EyeOff size={13} /> Lecture seule</div> : null}
        </>
      )}
    </div>
  )
}
