/**
 * Процедурный звук на WebAudio — без внешних файлов.
 * Атмосферный гул, щелчки интерфейса, сирена тревоги и помехи.
 */
export class AudioManager {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.ambientGain = null;
    this.alarmNodes = null;
    this.muted = false;
    this.volume = 0.5;
    this.started = false;
  }

  /** Вызывать после первого пользовательского жеста. */
  init() {
    if (this.started) return;
    const Ctx = typeof window !== 'undefined' ? window.AudioContext || window.webkitAudioContext : null;
    if (!Ctx) return;
    try {
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : this.volume;
      this.master.connect(this.ctx.destination);
      this.startAmbient();
      this.started = true;
    } catch (error) {
      console.warn('[Audio] init failed', error);
    }
  }

  resume() {
    if (!this.ctx) {
      this.init();
      return;
    }
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.master) {
      this.master.gain.setTargetAtTime(muted ? 0 : this.volume, this.ctx.currentTime, 0.05);
    }
  }

  setVolume(value) {
    this.volume = Math.max(0, Math.min(1, value));
    if (this.master && !this.muted) {
      this.master.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.05);
    }
  }

  noiseBuffer(duration = 2, gainValue = 0.5) {
    const length = Math.floor(this.ctx.sampleRate * duration);
    const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) {
      data[i] = (Math.random() * 2 - 1) * gainValue;
    }
    return buffer;
  }

  startAmbient() {
    const ctx = this.ctx;
    this.ambientGain = ctx.createGain();
    this.ambientGain.gain.value = 0.05;
    this.ambientGain.connect(this.master);

    const hum = ctx.createOscillator();
    hum.type = 'sine';
    hum.frequency.value = 48;
    hum.connect(this.ambientGain);
    hum.start();

    const hum2 = ctx.createOscillator();
    hum2.type = 'triangle';
    hum2.frequency.value = 71.5;
    const hum2Gain = ctx.createGain();
    hum2Gain.gain.value = 0.35;
    hum2.connect(hum2Gain);
    hum2Gain.connect(this.ambientGain);
    hum2.start();

    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuffer(3, 0.35);
    noise.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 340;
    const noiseGain = ctx.createGain();
    noiseGain.gain.value = 0.18;
    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(this.ambientGain);
    noise.start();
  }

  beep(frequency = 440, duration = 0.06, type = 'square', gain = 0.08, slide = 0) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const env = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, now);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(40, frequency + slide), now + duration);
    env.gain.setValueAtTime(gain, now);
    env.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(env);
    env.connect(this.master);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  ui() {
    this.beep(420, 0.045, 'square', 0.05);
  }

  confirm() {
    this.beep(520, 0.05, 'square', 0.06, 120);
  }

  error() {
    this.beep(110, 0.16, 'sawtooth', 0.06, -30);
  }

  feed() {
    this.beep(180, 0.12, 'triangle', 0.08, 60);
  }

  buy() {
    this.beep(660, 0.05, 'square', 0.05, 180);
    setTimeout(() => this.beep(880, 0.05, 'square', 0.04), 60);
  }

  mutate() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    for (let i = 0; i < 3; i += 1) {
      const osc = this.ctx.createOscillator();
      const env = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(140 + i * 60, now);
      osc.frequency.exponentialRampToValueAtTime(60, now + 0.5);
      env.gain.setValueAtTime(0.05, now);
      env.gain.exponentialRampToValueAtTime(0.0001, now + 0.5);
      osc.connect(env);
      env.connect(this.master);
      osc.start(now);
      osc.stop(now + 0.55);
    }
  }

  glitch() {
    if (!this.ctx) return;
    const source = this.ctx.createBufferSource();
    source.buffer = this.noiseBuffer(0.25, 0.6);
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1200;
    const gain = this.ctx.createGain();
    gain.gain.value = 0.09;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    source.start();
  }

  startAlarm() {
    if (!this.ctx || this.alarmNodes) return;
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.value = 420;
    lfo.frequency.value = 1.6;
    lfoGain.gain.value = 160;
    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);
    gain.gain.value = 0.03;
    osc.connect(gain);
    gain.connect(this.master);
    osc.start();
    lfo.start();
    this.alarmNodes = { osc, lfo, gain };
  }

  stopAlarm() {
    if (!this.alarmNodes) return;
    try {
      this.alarmNodes.osc.stop();
      this.alarmNodes.lfo.stop();
      this.alarmNodes.gain.disconnect();
    } catch {
      /* ignore */
    }
    this.alarmNodes = null;
  }

  escape() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(900, now);
    osc.frequency.exponentialRampToValueAtTime(55, now + 1.8);
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.9);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(now);
    osc.stop(now + 2);
  }

  /** Резкий скример: шумовой удар + падающий визг. */
  scream() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;

    // Шумовой удар.
    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuffer(0.55, 0.9);
    const high = ctx.createBiquadFilter();
    high.type = 'highpass';
    high.frequency.value = 900;
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.32, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.5);
    noise.connect(high);
    high.connect(noiseGain);
    noiseGain.connect(this.master);
    noise.start(now);

    // Визг из трёх расстроенных пил.
    [0, 18, -23].forEach((detune, index) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.detune.value = detune;
      osc.frequency.setValueAtTime(1500 + index * 120, now);
      osc.frequency.exponentialRampToValueAtTime(70, now + 0.75);
      gain.gain.setValueAtTime(0.14, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.8);
      osc.connect(gain);
      gain.connect(this.master);
      osc.start(now);
      osc.stop(now + 0.85);
    });
  }

  heartbeat() {
    this.beep(55, 0.12, 'sine', 0.16);
    setTimeout(() => this.beep(48, 0.14, 'sine', 0.12), 220);
  }
}
