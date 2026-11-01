/**
 * Звук: процедурные WebAudio-эффекты + музыка и голоса из sounds/.
 */
import { AUDIO_TRACKS } from '../audio/tracks.js';

export class AudioManager {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.ambientGain = null;
    this.alarmNodes = null;
    this.muted = false;
    this.volume = 0.5;
    this.started = false;
    this.unlocked = false;

    this.mode = 'none';
    this.menuAudio = null;
    this.ambientAudio = null;
    this.endingAudio = null;
    this.sirenAudio = null;
    this.audioElements = new Set();
    this.oneShots = new Set();
    this.ambientTimer = null;
    this.creepyTimer = null;
    this.voicesTimer = null;
    this.lastAmbient = -1;
  }

  asset(path) {
    const map = typeof window !== 'undefined' ? window.ATD_SOUNDS : null;
    return (map && map[path]) || path;
  }

  htmlVolume(channel = 1) {
    return this.muted ? 0 : Math.min(1, Math.max(0, this.volume * channel));
  }

  makeAudio(path, loop, channelVolume) {
    if (typeof Audio === 'undefined' || !path) return null;
    const audio = new Audio(this.asset(path));
    audio.preload = 'auto';
    audio.loop = Boolean(loop);
    audio._atdChannelVolume = channelVolume;
    audio.volume = this.htmlVolume(channelVolume);
    this.audioElements.add(audio);
    return audio;
  }

  playAudio(audio) {
    if (!audio) return false;
    try {
      const promise = audio.play();
      if (promise?.catch) {
        promise.catch(() => {
          if (audio._atdAutoplayMuted) return;
          // Браузер не разрешил звук до жеста: запускаем беззвучно,
          // чтобы трек уже шёл, и включаем звук на первом движении/клике.
          audio._atdAutoplayMuted = true;
          audio.muted = true;
          try {
            const retry = audio.play();
            if (retry?.catch) retry.catch(() => {});
          } catch {
            /* ignore */
          }
        });
      }
      return true;
    } catch {
      return false;
    }
  }

  applyHtmlVolumes() {
    for (const audio of this.audioElements) {
      audio.volume = this.htmlVolume(audio._atdChannelVolume ?? 1);
    }
  }

  randomTrack(list) {
    if (!list?.length) return null;
    return list[Math.floor(Math.random() * list.length)];
  }

  stopAudio(audio, reset = true) {
    if (!audio) return;
    try {
      audio.pause();
      if (reset) audio.currentTime = 0;
    } catch {
      /* ignore */
    }
  }

  clearTimer(name) {
    if (this[name]) {
      clearTimeout(this[name]);
      this[name] = null;
    }
  }

  stopOneShots() {
    for (const audio of this.oneShots) this.stopAudio(audio);
    this.oneShots.clear();
  }

  stopGameLayers() {
    this.clearTimer('ambientTimer');
    this.clearTimer('creepyTimer');
    this.clearTimer('voicesTimer');
    if (this.ambientAudio) {
      this.ambientAudio.onended = null;
      this.stopAudio(this.ambientAudio);
    }
    this.stopOneShots();
  }

  stopMenuMusic() {
    this.stopAudio(this.menuAudio);
  }

  stopEndingMusic() {
    this.stopAudio(this.endingAudio);
  }

  playMenuMusic() {
    this.init();
    this.stopGameLayers();
    this.stopEndingMusic();
    this.stopAlarm();
    this.mode = 'menu';
    if (!this.menuAudio) {
      this.menuAudio = this.makeAudio(AUDIO_TRACKS.menu[0], true, 0.45);
    }
    if (this.menuAudio) {
      this.menuAudio.currentTime = 0;
      this.menuAudio.onended = null;
      this.playAudio(this.menuAudio);
    }
  }

  startGameMusic() {
    this.init();
    if (this.mode === 'game') {
      if (this.ambientAudio?.paused && !this.ambientTimer) this.playAudio(this.ambientAudio);
      if (this.unlocked) this.scheduleExtras();
      return;
    }
    this.mode = 'game';
    this.stopMenuMusic();
    this.stopEndingMusic();
    this.stopGameLayers();
    this.lastAmbient = -1;
    this.nextAmbient();
    this.scheduleCreepy(50000 + Math.random() * 50000);
    this.scheduleVoices(20000 + Math.random() * 25000);
  }

  nextAmbient() {
    if (this.mode !== 'game') return;
    this.clearTimer('ambientTimer');
    const list = AUDIO_TRACKS.ambient;
    if (!list.length) return;
    let index = Math.floor(Math.random() * list.length);
    if (list.length > 1 && index === this.lastAmbient) index = (index + 1) % list.length;
    this.lastAmbient = index;
    const path = list[index];
    if (!this.ambientAudio) {
      this.ambientAudio = this.makeAudio(path, false, 0.4);
    } else {
      this.ambientAudio.onended = null;
      this.ambientAudio.src = this.asset(path);
      this.ambientAudio.load();
    }
    if (!this.ambientAudio) return;
    this.ambientAudio.onended = () => {
      if (this.mode !== 'game') return;
      this.ambientTimer = setTimeout(() => this.nextAmbient(), 1600 + Math.random() * 2600);
    };
    this.ambientAudio.onerror = () => {
      if (this.mode !== 'game') return;
      this.ambientTimer = setTimeout(() => this.nextAmbient(), 2000);
    };
    this.playAudio(this.ambientAudio);
  }

  playOneShot(list, channelVolume = 0.55) {
    const path = this.randomTrack(list);
    if (!path) return;
    const audio = this.makeAudio(path, false, channelVolume);
    if (!audio) return;
    this.oneShots.add(audio);
    audio.onended = () => {
      this.oneShots.delete(audio);
      this.audioElements.delete(audio);
    };
    this.playAudio(audio);
  }

  scheduleExtras() {
    if (this.mode !== 'game' || !this.unlocked) return;
    if (!this.creepyTimer) this.scheduleCreepy();
    if (!this.voicesTimer) this.scheduleVoices();
  }

  scheduleCreepy(delay) {
    this.clearTimer('creepyTimer');
    const wait = delay ?? 45000 + Math.random() * 75000;
    this.creepyTimer = setTimeout(() => {
      this.creepyTimer = null;
      if (this.mode !== 'game') return;
      this.playOneShot(AUDIO_TRACKS.creepy, 0.55);
      this.scheduleCreepy();
    }, wait);
  }

  scheduleVoices(delay) {
    this.clearTimer('voicesTimer');
    const wait = delay ?? 30000 + Math.random() * 60000;
    this.voicesTimer = setTimeout(() => {
      this.voicesTimer = null;
      if (this.mode !== 'game') return;
      this.playOneShot(AUDIO_TRACKS.voices, 0.5);
      this.scheduleVoices();
    }, wait);
  }

  playEndingMusic() {
    this.init();
    if (this.mode === 'ending' && this.endingAudio) {
      if (this.endingAudio.paused) this.playAudio(this.endingAudio);
      return;
    }
    this.mode = 'ending';
    this.stopMenuMusic();
    this.stopGameLayers();
    this.stopAlarm();
    this.stopEndingMusic();
    this.endingAudio = this.makeAudio(AUDIO_TRACKS.ending[0], false, 0.55);
    if (this.endingAudio) {
      this.endingAudio.onended = null;
      this.playAudio(this.endingAudio);
    }
  }

  unlock() {
    this.unlocked = true;
    this.init();
    this.resume();
    for (const audio of this.audioElements) {
      if (audio._atdAutoplayMuted) {
        audio._atdAutoplayMuted = false;
        audio.muted = false;
        this.playAudio(audio);
      }
    }
    this.applyHtmlVolumes();
    if (this.mode === 'menu' && this.menuAudio) this.playAudio(this.menuAudio);
    if (this.mode === 'ending' && this.endingAudio) this.playAudio(this.endingAudio);
    if (this.mode === 'game') {
      if (this.ambientAudio) this.playAudio(this.ambientAudio);
      else this.nextAmbient();
      this.scheduleExtras();
    }
    if (this.sirenAudio) this.playAudio(this.sirenAudio);
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
    this.applyHtmlVolumes();
  }

  setVolume(value) {
    this.volume = Math.max(0, Math.min(1, value));
    if (this.master && !this.muted) {
      this.master.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.05);
    }
    this.applyHtmlVolumes();
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
    this.ambientGain.gain.value = 0.025;
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
    noiseGain.gain.value = 0.1;
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
    this.init();
    this.resume();
    if (this.sirenAudio) {
      this.playAudio(this.sirenAudio);
      return;
    }
    this.sirenAudio = this.makeAudio(AUDIO_TRACKS.siren[0], true, 0.8);
    if (this.sirenAudio) this.playAudio(this.sirenAudio);
    else this.startFallbackAlarm();
  }

  startFallbackAlarm() {
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
    if (this.sirenAudio) {
      this.stopAudio(this.sirenAudio);
      this.sirenAudio = null;
    }
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

  /** Резкий скример из папки Jumpscares. */
  scream() {
    const path = this.randomTrack(AUDIO_TRACKS.jumpscare);
    if (path) {
      const audio = this.makeAudio(path, false, 1);
      if (audio) {
        this.oneShots.add(audio);
        audio.onended = () => {
          this.oneShots.delete(audio);
          this.audioElements.delete(audio);
        };
        this.playAudio(audio);
        return;
      }
    }
    this.screamProcedural();
  }

  screamProcedural() {
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
