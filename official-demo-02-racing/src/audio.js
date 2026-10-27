import { clamp, lerp } from './utils.js';

export class AudioSystem {
  constructor(settings = {}) {
    this.ctx = null;
    this.ready = false;
    this.muted = false;
    this.volume = (settings.volume ?? 70) / 100;
    this.engineOn = false;
    this.paused = false;
    this.musicTimer = null;
    this.nextNoteTime = 0;
    this.step = 0;
    this.screech = 0;
    this.speed = 0;
  }

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = this.ctx = new Ctx();
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : this.volume;
    this.compressor = ctx.createDynamicsCompressor();
    this.compressor.threshold.value = -18;
    this.compressor.knee.value = 24;
    this.compressor.ratio.value = 4;
    this.compressor.attack.value = 0.004;
    this.compressor.release.value = 0.25;
    this.master.connect(this.compressor);
    this.compressor.connect(ctx.destination);

    this.engineBus = ctx.createGain();
    this.engineBus.gain.value = 0;
    this.engineBus.connect(this.master);
    this.fxBus = ctx.createGain();
    this.fxBus.gain.value = 0.8;
    this.fxBus.connect(this.master);
    this.musicBus = ctx.createGain();
    this.musicBus.gain.value = 0.0;
    this.musicBus.connect(this.master);

    this.noiseBuffer = this.createNoise(4);
    this.buildEngine();
    this.buildWind();
    this.buildScreech();
    this.ready = true;
    this.startMusic();
  }

  createNoise(seconds = 2) {
    const rate = this.ctx.sampleRate;
    const buffer = this.ctx.createBuffer(1, rate * seconds, rate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < data.length; i++) {
      const white = Math.random() * 2 - 1;
      last = 0.96 * last + 0.04 * white;
      data[i] = last * 4.5;
    }
    return buffer;
  }

  buildEngine() {
    const ctx = this.ctx;
    const gain = ctx.createGain();
    gain.gain.value = 0.0;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 700;
    filter.Q.value = 1.4;
    const shaper = ctx.createWaveShaper();
    const curve = new Float32Array(1024);
    for (let i = 0; i < curve.length; i++) {
      const x = (i / (curve.length - 1)) * 2 - 1;
      curve[i] = Math.tanh(x * 2.2) * 0.7;
    }
    shaper.curve = curve;
    shaper.oversample = '2x';
    const osc1 = ctx.createOscillator();
    osc1.type = 'sawtooth';
    osc1.frequency.value = 52;
    const osc2 = ctx.createOscillator();
    osc2.type = 'square';
    osc2.frequency.value = 104.6;
    const osc3 = ctx.createOscillator();
    osc3.type = 'triangle';
    osc3.frequency.value = 26;
    const g1 = ctx.createGain();
    const g2 = ctx.createGain();
    const g3 = ctx.createGain();
    g1.gain.value = 0.55;
    g2.gain.value = 0.20;
    g3.gain.value = 0.42;
    osc1.connect(g1); osc2.connect(g2); osc3.connect(g3);
    g1.connect(filter); g2.connect(filter); g3.connect(filter);
    filter.connect(shaper);
    shaper.connect(gain);
    gain.connect(this.engineBus);
    osc1.start(); osc2.start(); osc3.start();
    // intake noise
    const intake = ctx.createBufferSource();
    intake.buffer = this.noiseBuffer;
    intake.loop = true;
    const intakeFilter = ctx.createBiquadFilter();
    intakeFilter.type = 'bandpass';
    intakeFilter.frequency.value = 1000;
    intakeFilter.Q.value = 0.6;
    const intakeGain = ctx.createGain();
    intakeGain.gain.value = 0.0;
    intake.connect(intakeFilter);
    intakeFilter.connect(intakeGain);
    intakeGain.connect(this.engineBus);
    intake.start();

    this.engine = { osc1, osc2, osc3, filter, gain, intakeGain, intakeFilter, shaper };
  }

  buildWind() {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 700;
    filter.Q.value = 0.5;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    src.connect(filter); filter.connect(gain); gain.connect(this.fxBus);
    src.start();
    this.wind = { src, filter, gain };
  }

  buildScreech() {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1800;
    bp.Q.value = 5;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    src.connect(bp); bp.connect(gain); gain.connect(this.fxBus);
    src.start();
    this.tire = { src, bp, gain };
  }

  startEngine() {
    if (!this.ready && this.ctx === null) this.init();
    if (!this.ctx) return;
    this.engineOn = true;
    if (this.ctx.state === 'suspended') this.ctx.resume();
    this.engineBus.gain.setTargetAtTime(this.paused ? 0 : 0.55, this.ctx.currentTime, 0.3);
    this.musicBus.gain.setTargetAtTime(0.0, this.ctx.currentTime, 0.7);
  }

  stopEngine() {
    this.engineOn = false;
    if (!this.ctx) return;
    this.engineBus.gain.setTargetAtTime(0, this.ctx.currentTime, 0.25);
    this.musicBus.gain.setTargetAtTime(0.11, this.ctx.currentTime, 0.8);
  }

  setPaused(paused) {
    this.paused = paused;
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.engineBus.gain.setTargetAtTime(paused ? 0 : this.engineOn ? 0.55 : 0, t, 0.2);
    this.fxBus.gain.setTargetAtTime(paused ? 0.12 : 0.8, t, 0.2);
    this.musicBus.gain.setTargetAtTime(paused ? 0.035 : this.engineOn ? 0 : 0.11, t, 0.4);
  }

  setMuted(muted) {
    this.muted = muted;
    if (!this.ctx) return;
    this.master.gain.setTargetAtTime(muted ? 0 : this.volume, this.ctx.currentTime, 0.08);
  }

  setVolume(v) {
    this.volume = clamp(v, 0, 1);
    if (!this.ctx) return;
    this.master.gain.setTargetAtTime(this.muted ? 0 : this.volume, this.ctx.currentTime, 0.08);
  }

  updateCar(state) {
    if (!this.ready || !this.engineOn) return;
    const t = this.ctx.currentTime;
    const speed = state.speed ?? 0;
    const speedAbs = Math.abs(speed);
    const rpm = clamp(state.rpm ?? 0, 0, 1);
    const throttle = clamp(state.throttle ?? 0, 0, 1);
    const load = clamp(0.18 + throttle * 0.82, 0, 1);
    const base = 42 + rpm * 155 + speedAbs * 0.4;
    const eg = this.engine;
    eg.osc1.frequency.setTargetAtTime(base, t, 0.045);
    eg.osc2.frequency.setTargetAtTime(base * 2.013 + 0.7, t, 0.045);
    eg.osc3.frequency.setTargetAtTime(base * 0.5, t, 0.06);
    eg.filter.frequency.setTargetAtTime(280 + rpm * 1450 + throttle * 700, t, 0.06);
    eg.gain.gain.setTargetAtTime(0.05 + load * 0.052 + rpm * 0.015, t, 0.05);
    eg.intakeGain.gain.setTargetAtTime(0.018 + throttle * 0.04 + rpm * 0.01, t, 0.08);
    eg.intakeFilter.frequency.setTargetAtTime(600 + rpm * 1800, t, 0.08);
    this.wind.filter.frequency.setTargetAtTime(300 + speedAbs * 7, t, 0.12);
    this.wind.gain.gain.setTargetAtTime(clamp(speedAbs / 110, 0, 1) * 0.035, t, 0.18);
    const slip = clamp(state.slip ?? 0, 0, 1);
    this.screech = lerp(this.screech, slip, 0.12);
    this.tire.gain.gain.setTargetAtTime(this.screech * 0.07, t, 0.06);
    this.tire.bp.frequency.setTargetAtTime(1500 + this.screech * 900, t, 0.08);
    this.speed = speedAbs;
  }

  hit(intensity = 1) {
    if (!this.ready) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1800, t);
    filter.frequency.exponentialRampToValueAtTime(120, t + 0.22);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.35 * clamp(intensity, 0, 1.4), t + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.34);
    src.connect(filter); filter.connect(gain); gain.connect(this.fxBus);
    src.start(t); src.stop(t + 0.4);
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(86, t);
    osc.frequency.exponentialRampToValueAtTime(36, t + 0.28);
    const og = ctx.createGain();
    og.gain.setValueAtTime(0.26 * intensity, t);
    og.gain.exponentialRampToValueAtTime(0.0001, t + 0.32);
    osc.connect(og); og.connect(this.fxBus);
    osc.start(t); osc.stop(t + 0.34);
  }

  boost() {
    if (!this.ready) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 0.8;
    bp.frequency.setValueAtTime(350, t);
    bp.frequency.exponentialRampToValueAtTime(4200, t + 0.55);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.12, t + 0.08);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.8);
    src.connect(bp); bp.connect(gain); gain.connect(this.fxBus);
    src.start(t); src.stop(t + 0.9);
  }

  click() {
    if (!this.ready) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(1000, t);
    osc.frequency.exponentialRampToValueAtTime(520, t + 0.05);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.045, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
    osc.connect(g); g.connect(this.fxBus);
    osc.start(t); osc.stop(t + 0.09);
  }

  beep(freq = 540, duration = 0.12, gainVal = 0.1) {
    if (!this.ready) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gainVal, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    osc.connect(g); g.connect(this.fxBus);
    osc.start(t); osc.stop(t + duration + 0.02);
  }

  startMusic() {
    if (!this.ready || this.musicTimer) return;
    this.musicBus.gain.value = 0.11;
    this.nextNoteTime = this.ctx.currentTime + 0.3;
    this.step = 0;
    const tempo = 96;
    const eighth = 60 / tempo / 2;
    const schedule = () => {
      if (!this.ctx) return;
      while (this.nextNoteTime < this.ctx.currentTime + 0.7) {
        this.scheduleStep(this.step, this.nextNoteTime, eighth);
        this.nextNoteTime += eighth;
        this.step++;
      }
    };
    this.musicTimer = setInterval(schedule, 220);
    schedule();
  }

  scheduleStep(step, time, eighth) {
    const bar = Math.floor(step / 8) % 4;
    const beat = step % 8;
    const chordRoots = [38.89, 34.65, 32.70, 36.71]; // D, A, C, B
    const root = chordRoots[bar];
    // sparse bass pulse
    if (beat === 0 || beat === 3 || beat === 6) {
      this.playNote(root / 2, time, eighth * 1.6, 'sine', 0.055, 300);
      this.playNote(root, time, eighth * 1.2, 'triangle', 0.022, 500);
    }
    // airy arpeggio
    if (step % 2 === 0) {
      const seq = [0, 7, 10, 12, 7, 15, 10, 12];
      const semis = seq[(step / 2) % seq.length | 0];
      const freq = root * Math.pow(2, semis / 12) * 2;
      this.playNote(freq, time, eighth * 0.9, 'sine', 0.012, 1800);
    }
    // pad every two bars
    if (beat === 0 && bar % 2 === 0) {
      for (const semi of [0, 7, 14, 17]) {
        this.playNote(root * Math.pow(2, semi / 12) / 2, time, eighth * 13, 'triangle', 0.012, 620);
      }
    }
    // hat
    if (beat === 2 || beat === 6) this.playHat(time, 0.012);
  }

  playNote(freq, time, duration, type, gainVal, cutoff) {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = cutoff;
    filter.Q.value = 0.6;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, time);
    g.gain.exponentialRampToValueAtTime(gainVal, time + 0.08);
    g.gain.exponentialRampToValueAtTime(0.0001, time + duration);
    osc.connect(filter); filter.connect(g); g.connect(this.musicBus);
    osc.start(time); osc.stop(time + duration + 0.05);
  }

  playHat(time, gainVal) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 6500;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gainVal, time);
    g.gain.exponentialRampToValueAtTime(0.0001, time + 0.045);
    src.connect(filter); filter.connect(g); g.connect(this.musicBus);
    src.start(time); src.stop(time + 0.06);
  }

  suspend() {
    if (this.ctx && this.ctx.state === 'running') this.ctx.suspend();
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }
}
