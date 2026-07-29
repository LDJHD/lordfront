'use client'

let audioContext: AudioContext | null = null
let ambientEngine: LoungeAmbient | null = null

function getContext() {
  if (!audioContext) audioContext = new AudioContext()
  return audioContext
}

function tone(frequency: number, duration = 0.2, type: OscillatorType = 'sine', volume = 0.06, delay = 0) {
  const ctx = getContext()
  const start = ctx.currentTime + delay
  const oscillator = ctx.createOscillator()
  const gain = ctx.createGain()
  const filter = ctx.createBiquadFilter()
  filter.type = 'lowpass'
  filter.frequency.value = 1800
  oscillator.type = type
  oscillator.frequency.value = frequency
  gain.gain.setValueAtTime(0.0001, start)
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.02)
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration)
  oscillator.connect(filter)
  filter.connect(gain)
  gain.connect(ctx.destination)
  oscillator.start(start)
  oscillator.stop(start + duration + 0.05)
}

export function playTurnSound() {
  tone(392, 0.18, 'triangle', 0.07)
  tone(494, 0.22, 'triangle', 0.06, 0.08)
  tone(587, 0.26, 'sine', 0.05, 0.16)
}

export function playQuestionSound() {
  tone(330, 0.14, 'sine', 0.05)
  tone(415, 0.16, 'sine', 0.045, 0.07)
  tone(523, 0.2, 'triangle', 0.04, 0.14)
}

export function playAnswerSound() {
  tone(440, 0.12, 'triangle', 0.05)
  tone(554, 0.16, 'sine', 0.045, 0.06)
}

export function playApproveSound() {
  tone(523, 0.14, 'triangle', 0.06)
  tone(659, 0.18, 'triangle', 0.055, 0.08)
  tone(784, 0.24, 'sine', 0.05, 0.16)
}

export function playRejectSound() {
  tone(330, 0.16, 'triangle', 0.06)
  tone(262, 0.22, 'sine', 0.05, 0.1)
}

// Dames (Checkers) sounds
export function playDamesMoveSound() {
  tone(280, 0.1, 'triangle', 0.05)
  tone(350, 0.12, 'sine', 0.04, 0.05)
}

export function playDamesCaptureSound() {
  tone(180, 0.08, 'square', 0.07)
  tone(240, 0.1, 'triangle', 0.06, 0.04)
  tone(480, 0.15, 'sine', 0.05, 0.08)
}

export function playDamesKingSound() {
  tone(400, 0.1, 'triangle', 0.06)
  tone(500, 0.12, 'triangle', 0.055, 0.06)
  tone(630, 0.18, 'sine', 0.05, 0.12)
  tone(800, 0.25, 'sine', 0.04, 0.18)
}

export function playDamesWinSound() {
  tone(523, 0.12, 'triangle', 0.07)
  tone(659, 0.14, 'triangle', 0.065, 0.08)
  tone(784, 0.16, 'sine', 0.06, 0.16)
  tone(1047, 0.3, 'sine', 0.05, 0.24)
}

export function playDamesWarningSound() {
  tone(880, 0.08, 'square', 0.04)
  tone(660, 0.08, 'square', 0.035, 0.1)
}

export function playDamesPauseSound() {
  tone(350, 0.15, 'triangle', 0.05)
  tone(300, 0.2, 'sine', 0.04, 0.12)
}

export function playDamesResumeSound() {
  tone(350, 0.1, 'triangle', 0.05)
  tone(440, 0.15, 'sine', 0.045, 0.06)
  tone(550, 0.2, 'triangle', 0.04, 0.12)
}

class DamesAmbient {
  private master: GainNode
  private filter: BiquadFilterNode
  private timer: number | null = null
  private step = 0
  private running = false

  // Deep, strategic ambience for checkers - minor chords with tension
  private readonly drones = [73.42, 98.0, 110.0, 146.83] // D2, G2, A2, D3
  private readonly tensionNotes = [220, 261.63, 293.66, 349.23] // A3, C4, D4, F4
  private readonly rhythm = [0.3, 0.5, 0.2, 0.6]

  constructor(private ctx: AudioContext) {
    this.filter = ctx.createBiquadFilter()
    this.filter.type = 'lowpass'
    this.filter.frequency.value = 800
    this.master = ctx.createGain()
    this.master.gain.value = 0.18
    this.master.connect(this.filter)
    this.filter.connect(ctx.destination)
  }

  setVolume(volume: number) {
    this.master.gain.value = Math.max(0, Math.min(0.5, volume))
  }

  start() {
    if (this.running) return
    this.running = true
    this.step = 0
    this.scheduleLayer()
    this.timer = window.setInterval(() => this.scheduleLayer(), 4000)
  }

  stop() {
    this.running = false
    if (this.timer) window.clearInterval(this.timer)
    this.timer = null
  }

  private scheduleLayer() {
    if (!this.running) return
    const ctx = this.ctx
    const start = ctx.currentTime + 0.05

    // Deep drone pad
    this.drones.forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = freq
      const vol = i === 0 ? 0.06 : 0.025
      gain.gain.setValueAtTime(0.0001, start)
      gain.gain.linearRampToValueAtTime(vol, start + 0.5)
      gain.gain.linearRampToValueAtTime(vol * 0.7, start + 3.5)
      gain.gain.linearRampToValueAtTime(0.0001, start + 4.0)
      osc.connect(gain)
      gain.connect(this.master)
      osc.start(start)
      osc.stop(start + 4.2)
    })

    // Tension pulses (slow, like thinking)
    for (let i = 0; i < 3; i++) {
      const note = this.tensionNotes[(this.step * 3 + i) % this.tensionNotes.length]
      const t = start + i * 1.2 + 0.3
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'triangle'
      osc.frequency.value = note
      gain.gain.setValueAtTime(0.0001, t)
      gain.gain.linearRampToValueAtTime(0.025, t + 0.05)
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.8)
      osc.connect(gain)
      gain.connect(this.filter)
      osc.start(t)
      osc.stop(t + 1.0)
    }

    // Subtle board impact (like piece being placed)
    for (let i = 0; i < 2; i++) {
      const t = start + i * 1.8 + 0.1
      const bufferSize = Math.floor(ctx.sampleRate * 0.03)
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
      const data = buffer.getChannelData(0)
      for (let j = 0; j < bufferSize; j++) {
        data[j] = (Math.random() * 2 - 1) * Math.exp(-j / (bufferSize * 0.15))
      }
      const source = ctx.createBufferSource()
      const gain = ctx.createGain()
      const filter = ctx.createBiquadFilter()
      filter.type = 'lowpass'
      filter.frequency.value = 400
      source.buffer = buffer
      gain.gain.setValueAtTime(0.012, t)
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.05)
      source.connect(filter)
      filter.connect(gain)
      gain.connect(this.master)
      source.start(t)
      source.stop(t + 0.06)
    }

    this.step += 1
  }
}

let damesAmbientEngine: DamesAmbient | null = null

export function startDamesAmbient(volume = 0.18) {
  if (damesAmbientEngine) {
    damesAmbientEngine.setVolume(volume)
    return
  }
  const ctx = getContext()
  damesAmbientEngine = new DamesAmbient(ctx)
  damesAmbientEngine.setVolume(volume)
  damesAmbientEngine.start()
}

export function stopDamesAmbient() {
  damesAmbientEngine?.stop()
  damesAmbientEngine = null
}

export function setDamesAmbientVolume(volume: number) {
  damesAmbientEngine?.setVolume(volume)
}

class LoungeAmbient {
  private master: GainNode
  private filter: BiquadFilterNode
  private timer: number | null = null
  private step = 0
  private running = false

  private readonly chords = [
    [146.83, 174.61, 220.0, 261.63],
    [164.81, 196.0, 246.94, 293.66],
    [174.61, 220.0, 261.63, 329.63],
    [155.56, 196.0, 233.08, 293.66],
  ]

  private readonly melody = [392, 440, 494, 523, 494, 440, 392, 349, 392, 440, 523, 587]

  constructor(private ctx: AudioContext) {
    this.filter = ctx.createBiquadFilter()
    this.filter.type = 'lowpass'
    this.filter.frequency.value = 2200
    this.master = ctx.createGain()
    this.master.gain.value = 0.22
    this.master.connect(this.filter)
    this.filter.connect(ctx.destination)
  }

  setVolume(volume: number) {
    this.master.gain.value = Math.max(0, Math.min(0.5, volume))
  }

  start() {
    if (this.running) return
    this.running = true
    this.step = 0
    this.scheduleBar()
    this.timer = window.setInterval(() => this.scheduleBar(), 2400)
  }

  stop() {
    this.running = false
    if (this.timer) window.clearInterval(this.timer)
    this.timer = null
  }

  private scheduleBar() {
    if (!this.running) return
    const ctx = this.ctx
    const start = ctx.currentTime + 0.05
    const chord = this.chords[this.step % this.chords.length]
    const beat = 0.6

    chord.forEach((freq, index) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = index === 0 ? 'triangle' : 'sine'
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0.0001, start)
      gain.gain.linearRampToValueAtTime(index === 0 ? 0.08 : 0.035, start + 0.25)
      gain.gain.linearRampToValueAtTime(0.0001, start + 2.2)
      osc.connect(gain)
      gain.connect(this.master)
      osc.start(start)
      osc.stop(start + 2.3)
    })

    for (let i = 0; i < 4; i++) {
      const note = this.melody[(this.step * 4 + i) % this.melody.length]
      const noteStart = start + i * beat + 0.15
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'triangle'
      osc.frequency.value = note
      gain.gain.setValueAtTime(0.0001, noteStart)
      gain.gain.linearRampToValueAtTime(0.045, noteStart + 0.04)
      gain.gain.exponentialRampToValueAtTime(0.0001, noteStart + 0.45)
      osc.connect(gain)
      gain.connect(this.master)
      osc.start(noteStart)
      osc.stop(noteStart + 0.5)
    }

    this.playBrush(start, 4, beat)
    this.step += 1
  }

  private playBrush(start: number, count: number, spacing: number) {
    for (let i = 0; i < count; i++) {
      const t = start + i * spacing
      const bufferSize = this.ctx.sampleRate * 0.04
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate)
      const data = buffer.getChannelData(0)
      for (let j = 0; j < bufferSize; j++) data[j] = (Math.random() * 2 - 1) * (1 - j / bufferSize)
      const source = this.ctx.createBufferSource()
      const gain = this.ctx.createGain()
      const filter = this.ctx.createBiquadFilter()
      filter.type = 'highpass'
      filter.frequency.value = 7000
      source.buffer = buffer
      gain.gain.setValueAtTime(0.018, t)
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.04)
      source.connect(filter)
      filter.connect(gain)
      gain.connect(this.master)
      source.start(t)
      source.stop(t + 0.05)
    }
  }
}

export function startAmbient(volume = 0.22) {
  if (ambientEngine) {
    ambientEngine.setVolume(volume)
    return
  }
  const ctx = getContext()
  ambientEngine = new LoungeAmbient(ctx)
  ambientEngine.setVolume(volume)
  ambientEngine.start()
}

export function stopAmbient() {
  ambientEngine?.stop()
  ambientEngine = null
}

export function setAmbientVolume(volume: number) {
  ambientEngine?.setVolume(volume)
}

export async function resumeAudio() {
  const ctx = getContext()
  if (ctx.state === 'suspended') await ctx.resume()
}
