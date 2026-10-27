/**
 * 极简的程序化音频：不加载任何音频文件，所有潮声、风、拨弦与锤击都由 Web Audio 合成。
 */
export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.enabled = true;
    this.started = false;
    this.ambientStarted = false;
    this.oscillators = [];
    this.noiseSource = null;
    this.lastFootstep = 0;
  }

  async unlock() {
    if (this.ambientStarted) {
      if (this.ctx?.state === 'suspended') await this.ctx.resume();
      return;
    }
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    try {
      this.ctx = new AudioContextClass();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.enabled ? 0.5 : 0;
      this.master.connect(this.ctx.destination);
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0.21;
      this.musicGain.connect(this.master);
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = 0.38;
      this.sfxGain.connect(this.master);
      this.ambientStarted = true;
      this.started = true;
      if (this.ctx.state === 'suspended') await this.ctx.resume();
      this.startAmbient();
    } catch (error) {
      console.warn('[知屿] 音频初始化失败，游戏仍可继续。', error);
    }
  }

  setEnabled(enabled) {
    this.enabled = enabled;
    if (!this.master || !this.ctx) return;
    const target = enabled ? 0.5 : 0;
    this.master.gain.cancelScheduledValues(this.ctx.currentTime);
    this.master.gain.linearRampToValueAtTime(target, this.ctx.currentTime + 0.35);
  }

  startAmbient() {
    if (!this.ctx || this.noiseSource) return;
    const ctx = this.ctx;

    // 潮汐：循环噪声 + 缓慢滤波。
    const buffer = ctx.createBuffer(1, ctx.sampleRate * 4, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let brown = 0;
    for (let i = 0; i < data.length; i += 1) {
      const white = Math.random() * 2 - 1;
      brown = (brown + 0.02 * white) / 1.02;
      data[i] = brown * 3.2 + Math.sin(i / ctx.sampleRate * 0.18) * 0.02;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 540;
    const noiseGain = ctx.createGain();
    noiseGain.gain.value = 0.13;
    noise.connect(filter).connect(noiseGain).connect(this.musicGain);
    noise.start();
    this.noiseSource = noise;

    // 海面起伏。
    const swell = ctx.createOscillator();
    swell.type = 'sine';
    swell.frequency.value = 0.09;
    const swellGain = ctx.createGain();
    swellGain.gain.value = 90;
    swell.connect(swellGain).connect(filter.frequency);
    swell.start();
    this.oscillators.push(swell);

    // 空灵和声垫：D 大调加九音，缓慢呼吸。
    const notes = [146.83, 220, 293.66, 329.63, 440];
    notes.forEach((freq, index) => {
      const osc = ctx.createOscillator();
      osc.type = index % 2 ? 'sine' : 'triangle';
      osc.frequency.value = freq;
      osc.detune.value = (index - 2) * 3.5;
      const gain = ctx.createGain();
      gain.gain.value = 0.026 / (1 + index * 0.35);
      const lfo = ctx.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.value = 0.035 + index * 0.011;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = gain.gain.value * 0.55;
      lfo.connect(lfoGain).connect(gain.gain);
      osc.connect(gain).connect(this.musicGain);
      osc.start();
      lfo.start();
      this.oscillators.push(osc, lfo);
    });

    // 偶尔的远处风铃。
    const chime = () => {
      if (!this.enabled) {
        this.chimeTimer = window.setTimeout(chime, 9000);
        return;
      }
      this.playChime();
      this.chimeTimer = window.setTimeout(chime, 8500 + Math.random() * 10500);
    };
    this.chimeTimer = window.setTimeout(chime, 6500);
  }

  playChime() {
    if (!this.ctx || !this.master || !this.enabled) return;
    const ctx = this.ctx;
    const notes = [587.33, 659.25, 880, 1174.66, 1318.51];
    const base = notes[Math.floor(Math.random() * notes.length)];
    [1, 2.01, 2.99].forEach((multiple, index) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = base * multiple;
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.018 / (index + 1), ctx.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 3.8);
      osc.connect(gain).connect(this.musicGain);
      osc.start();
      osc.stop(ctx.currentTime + 4);
    });
  }

  tone(freq, duration = 0.18, type = 'sine', volume = 0.12, delay = 0, endFreq = null) {
    if (!this.ctx || !this.enabled || !this.sfxGain) return;
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime + delay);
    if (endFreq) osc.frequency.exponentialRampToValueAtTime(endFreq, ctx.currentTime + delay + duration);
    const start = ctx.currentTime + delay;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(gain).connect(this.sfxGain);
    osc.start(start);
    osc.stop(start + duration + 0.02);
  }

  noiseBurst(duration = 0.15, volume = 0.1, filterFreq = 1000, delay = 0) {
    if (!this.ctx || !this.enabled || !this.sfxGain) return;
    const ctx = this.ctx;
    const size = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, size, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < size; i += 1) data[i] = Math.random() * 2 - 1;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = filterFreq;
    filter.Q.value = 0.8;
    const gain = ctx.createGain();
    const start = ctx.currentTime + delay;
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
    source.connect(filter).connect(gain).connect(this.sfxGain);
    source.start(start);
  }

  click() {
    this.tone(620, 0.055, 'sine', 0.055, 0, 780);
  }

  hover() {
    this.tone(880, 0.035, 'sine', 0.018);
  }

  gather() {
    this.noiseBurst(0.13, 0.12, 480);
    this.tone(160, 0.18, 'triangle', 0.1, 0, 90);
    this.tone(520, 0.08, 'sine', 0.035, 0.04, 660);
  }

  harvest() {
    [440, 554, 659].forEach((note, index) => this.tone(note, 0.35, 'sine', 0.07, index * 0.06));
  }

  success() {
    [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((note, index) => {
      this.tone(note, 0.65, 'sine', 0.08, index * 0.085);
    });
    this.tone(261.63, 1.5, 'triangle', 0.04, 0);
  }

  error() {
    this.tone(330, 0.24, 'triangle', 0.075, 0, 260);
    this.tone(220, 0.32, 'sine', 0.055, 0.08, 180);
  }

  place() {
    this.noiseBurst(0.2, 0.12, 340);
    this.tone(98, 0.42, 'triangle', 0.14, 0, 65);
    this.tone(784, 0.16, 'sine', 0.035, 0.08);
  }

  hammer() {
    this.noiseBurst(0.075, 0.16, 2200);
    this.tone(1046.5, 0.15, 'square', 0.025, 0, 780);
    this.tone(220, 0.16, 'triangle', 0.08, 0, 110);
  }

  coin() {
    this.tone(1318.5, 0.18, 'sine', 0.05);
    this.tone(1760, 0.34, 'sine', 0.042, 0.06);
  }

  quest() {
    [392, 523.25, 659.25, 880].forEach((note, index) => this.tone(note, 0.8, 'sine', 0.065, index * 0.11));
  }

  sail() {
    this.noiseBurst(1.8, 0.08, 420);
    [196, 246.94, 293.66].forEach((note, index) => this.tone(note, 1.5, 'sine', 0.04, index * 0.15));
  }

  sleep() {
    [392, 329.63, 261.63].forEach((note, index) => this.tone(note, 1.2, 'sine', 0.055, index * 0.22));
  }

  footstep() {
    if (!this.ctx) return;
    if (this.ctx.currentTime - this.lastFootstep < 0.28) return;
    this.lastFootstep = this.ctx.currentTime;
    this.noiseBurst(0.055, 0.018, 300);
  }

  dispose() {
    if (this.chimeTimer) window.clearTimeout(this.chimeTimer);
    this.oscillators.forEach((osc) => {
      try { osc.stop(); } catch { /* already stopped */ }
    });
    try { this.noiseSource?.stop(); } catch { /* noop */ }
    try { this.ctx?.close(); } catch { /* noop */ }
    this.ctx = null;
  }
}
