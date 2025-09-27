class AudioBus {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.enabled = { clicks: true, ambient: false };
    this._unlocked = false;
    this._unlockHandler = this._unlock.bind(this);
    this.ambientSource = null;
    this.ambientBuffer = null;
    this.clickBuffer = null;
  }

  isUnlocked() {
    return this._unlocked;
  }

  async initOnFirstGesture() {
    if (this._unlocked) return;
    ['pointerdown','touchend','keydown'].forEach(evt =>
      window.addEventListener(evt, this._unlockHandler, { once: true, passive: true })
    );
  }

  async _unlock() {
    try {
      if (!this.ctx) {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.master = this.ctx.createGain();
        this.master.gain.value = 1.0;
        this.master.connect(this.ctx.destination);
      }
      if (this.ctx.state === 'suspended') {
        await this.ctx.resume();
      }
      this._unlocked = true;
      this._preloadClickSound();
    } catch (e) {
      console.warn('WebAudio недоступен', e);
      this._unlocked = true;
    }
  }

  async _preloadClickSound() {
    if (this.clickBuffer) return;
    try {
      const duration = 0.1;
      const sampleRate = this.ctx.sampleRate;
      const buffer = this.ctx.createBuffer(1, sampleRate * duration, sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) {
        const t = i / sampleRate;
        const envelope = Math.exp(-t * 50);
        const noise = Math.random() * 2 - 1;
        data[i] = noise * envelope * 0.5;
      }
      this.clickBuffer = buffer;
    } catch (e) {
      console.warn('Не удалось создать звук щелчка:', e);
    }
  }

  setClickEnabled(v) { this.enabled.clicks = !!v; }
  setAmbientEnabled(v) { 
    this.enabled.ambient = !!v;
    if (this.enabled.ambient) {
      this.startAmbient();
    } else {
      this.stopAmbient();
    }
  }

  click(volume = 1.0, rate = 1.0) {
    if (!this.enabled.clicks || !this._unlocked || !this.ctx || !this.clickBuffer) return;
    
    try {
      const source = this.ctx.createBufferSource();
      source.buffer = this.clickBuffer;
      source.playbackRate.value = rate;

      const gain = this.ctx.createGain();
      gain.gain.value = volume;
      
      source.connect(gain).connect(this.master);
      source.start();
    } catch (e) {
      console.warn('Ошибка воспроизведения звука:', e);
    }
  }

  async startAmbient() {
    if (!this.enabled.ambient || !this._unlocked || !this.ctx || this.ambientSource) return;
    try {
      if (!this.ambientBuffer) {
        const response = await fetch('assets/audio/ambient.mp3');
        const arrayBuffer = await response.arrayBuffer();
        this.ambientBuffer = await this.ctx.decodeAudioData(arrayBuffer);
      }
      this.ambientSource = this.ctx.createBufferSource();
      this.ambientSource.buffer = this.ambientBuffer;
      this.ambientSource.loop = true;
      
      const gain = this.ctx.createGain();
      gain.gain.value = 0;
      this.ambientSource.connect(gain).connect(this.master);
      
      gain.gain.linearRampToValueAtTime(0.3, this.ctx.currentTime + 2);
      
      this.ambientSource.start();
    } catch (e) {
      console.warn('Не удалось запустить фоновый звук:', e);
    }
  }

  stopAmbient() {
    if (this.ambientSource) {
      try {
        this.ambientSource.stop();
      } catch (e) {}
      this.ambientSource = null;
    }
  }
}

export const audioBus = new AudioBus();