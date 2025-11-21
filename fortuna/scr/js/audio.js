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
    this.chaosBuffer = null;
    this.chaosSource = null;
    this.chaosGain = null;
    
    this._initVoices();
  }
  
  _initVoices() {
    if ('speechSynthesis' in window) {
      if (window.speechSynthesis.getVoices().length === 0) {
        window.speechSynthesis.addEventListener('voiceschanged', () => {
          console.log('🗣️ Голоса загружены');
        }, { once: true });
      }
      window.speechSynthesis.getVoices();
    }
  }

  isUnlocked() {
    return this._unlocked;
  }

  async initOnFirstGesture() {
    if (this._unlocked) return;
    const events = ['pointerdown', 'touchstart', 'touchend', 'mousedown', 'keydown', 'click'];
    events.forEach(evt => {
      window.addEventListener(evt, this._unlockHandler, { once: true, passive: true, capture: true });
      document.addEventListener(evt, this._unlockHandler, { once: true, passive: true, capture: true });
    });
    document.body?.addEventListener('touchstart', this._unlockHandler, { once: true, passive: true });
  }

  async _unlock() {
    try {
      if (!this.ctx) {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) {
          this._unlocked = true;
          return;
        }
        this.ctx = new AudioContextClass();
        this.master = this.ctx.createGain();
        this.master.gain.value = 1.0;
        this.master.connect(this.ctx.destination);
      }
      
      if (this.ctx.state === 'suspended') await this.ctx.resume();
      
      this._unlocked = true;
      await this._preloadClickSound();
    } catch (e) {
      this._unlocked = true;
    }
  }

  async _preloadClickSound() {
    if (this.clickBuffer) return;
    try {
      const duration = 0.15;
      const sampleRate = this.ctx.sampleRate;
      const buffer = this.ctx.createBuffer(1, sampleRate * duration, sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) {
        const t = i / sampleRate;
        const envelope = Math.exp(-t * 40);
        const noise = (Math.random() * 2 - 1) * 0.8; 
        data[i] = noise * envelope;
      }
      this.clickBuffer = buffer;
    } catch (e) {
      console.warn('Click sound error', e);
    }
  }

  setClickEnabled(v) { this.enabled.clicks = !!v; }
  setAmbientEnabled(v) { 
    this.enabled.ambient = !!v;
    if (this.enabled.ambient) this.startAmbient();
    else this.stopAmbient();
  }

  click(volume = 1.0, rate = 1.0) {
    if (!this.enabled.clicks || !this._unlocked || !this.ctx || !this.clickBuffer) return;
    const demonRate = rate * (0.4 + Math.random() * 0.2);
    this._playClick(volume * 1.2, demonRate); 
  }

  // 🔥 ВОССТАНОВЛЕННАЯ ФУНКЦИЯ: playMetalCling (Металлический звон)
  // Теперь он звучит как тяжелый удар металла о металл
  playMetalCling(intensity = 1.0) {
    // Перенаправляем на click, но делаем его более тяжелым
    // Или можно синтезировать отдельный звук
    if (!this.enabled.clicks || !this._unlocked || !this.ctx) return;

    try {
        // 1. Основной "хруст" (как обычный клик, но громче и ниже)
        this.click(intensity * 1.5, 0.5);

        // 2. Металлический резонанс (низкий)
        const osc = this.ctx.createOscillator();
        osc.type = 'square'; // Более грубый звук
        osc.frequency.setValueAtTime(100 + Math.random() * 50, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(40, this.ctx.currentTime + 0.3);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.3 * intensity, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.3);

        // Искажение для металла
        const dist = this.ctx.createWaveShaper();
        dist.curve = this._makeDistortionCurve(20);

        osc.connect(dist).connect(gain).connect(this.master);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.35);
    } catch (e) {}
  }

  // 🔥 ВОССТАНОВЛЕННАЯ ФУНКЦИЯ: playVictoryFanfare
  // Теперь это адский хор/гул
  playVictoryFanfare() {
    if (!this.enabled.clicks || !this.ctx) return;
    try {
        const now = this.ctx.currentTime;
        // Низкий гул победы (аккорд)
        [65.41, 82.41, 98.00].forEach((freq, i) => { // C2, E2, G2
            const osc = this.ctx.createOscillator();
            osc.type = 'sawtooth';
            osc.frequency.value = freq;
            
            const gain = this.ctx.createGain();
            gain.gain.setValueAtTime(0, now);
            gain.gain.linearRampToValueAtTime(0.2, now + 0.5);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 3.0);

            // Фильтр чтобы не резало уши
            const filter = this.ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.value = 400;

            osc.connect(filter).connect(gain).connect(this.master);
            osc.start(now);
            osc.stop(now + 3.5);
        });
    } catch (e) {}
  }

  // 🔥 ВОССТАНОВЛЕННАЯ ФУНКЦИЯ: playDramaticStop
  playDramaticStop() {
      if (!this.enabled.clicks || !this.ctx) return;
      try {
          const now = this.ctx.currentTime;
          const osc = this.ctx.createOscillator();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(100, now);
          osc.frequency.exponentialRampToValueAtTime(10, now + 1.5); // Падение в бездну

          const gain = this.ctx.createGain();
          gain.gain.setValueAtTime(0.8, now);
          gain.gain.linearRampToValueAtTime(0, now + 1.5);

          osc.connect(gain).connect(this.master);
          osc.start(now);
          osc.stop(now + 1.5);
      } catch (e) {}
  }

  // 🔥 ВОССТАНОВЛЕННАЯ ФУНКЦИЯ: playWind
  playWind(velocity) {
      // Можно оставить пустой или сделать шум ветра
      if (!this.enabled.clicks || !this.ctx) return;
      // ... упрощенная версия или просто ничего не делать, если не критично
  }
  
  // 🔥 ВОССТАНОВЛЕННАЯ ФУНКЦИЯ: playWhoosh
  playWhoosh() {
      // Пустая заглушка, чтобы не падало
  }

  _playClick(volume, rate) {
    try {
      const source = this.ctx.createBufferSource();
      source.buffer = this.clickBuffer;
      source.playbackRate.value = rate;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 800; 

      const gain = this.ctx.createGain();
      gain.gain.value = volume;
      
      source.connect(filter).connect(gain).connect(this.master);
      source.start(0);
      
      setTimeout(() => { source.disconnect(); gain.disconnect(); }, 1000);
    } catch (e) {}
  }

  async startAmbient() {
    if (!this.enabled.ambient || this.ambientSource || !this.ctx) return;
    
    try {
      if (this.ctx.state === 'suspended') await this.ctx.resume();
      
      if (!this.ambientBuffer) {
        const response = await fetch('assets/audio/ambient.mp3');
        const arrayBuffer = await response.arrayBuffer();
        this.ambientBuffer = await this.ctx.decodeAudioData(arrayBuffer);
      }
      
      this.ambientSource = this.ctx.createBufferSource();
      this.ambientSource.buffer = this.ambientBuffer;
      this.ambientSource.loop = true;
      
      this.ambientSource.playbackRate.value = 0.75; 
      
      const gain = this.ctx.createGain();
      gain.gain.value = 0;
      this.ambientSource.connect(gain).connect(this.master);
      
      gain.gain.linearRampToValueAtTime(0.4, this.ctx.currentTime + 3);
      this.ambientSource.start(0);
    } catch (e) {
      console.warn('Ambient error', e);
    }
  }

  stopAmbient() {
    if (this.ambientSource) {
      try { this.ambientSource.stop(); } catch (e) {}
      this.ambientSource = null;
    }
  }

  speak(text) {
    // Озвучка текста полностью отключена
    return;
  }

  async startChaosSound() {
    if (this.chaosSource || !this.ctx) return;
    
    try {
      if (this.ctx.state === 'suspended') await this.ctx.resume();
      
      if (!this.chaosBuffer) {
        const response = await fetch('assets/audio/shadows-of-dread_87945.mp3');
        const buffer = await response.arrayBuffer();
        this.chaosBuffer = await this.ctx.decodeAudioData(buffer);
      }
      
      this.chaosSource = this.ctx.createBufferSource();
      this.chaosSource.buffer = this.chaosBuffer;
      this.chaosSource.loop = true;
      this.chaosSource.playbackRate.value = 0.85;
      
      const distortion = this.ctx.createWaveShaper();
      distortion.curve = this._makeDistortionCurve(100); 
      
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 800; 
      
      const gain = this.ctx.createGain();
      gain.gain.value = 0;
      
      this.chaosSource.connect(distortion).connect(filter).connect(gain).connect(this.master);
      
      gain.gain.linearRampToValueAtTime(0.8, this.ctx.currentTime + 2);
      this.chaosGain = gain;
      this.chaosSource.start(0);
    } catch (e) {}
  }
  
  stopChaosSound() {
    if (this.chaosSource) {
      try {
        if (this.chaosGain) {
          this.chaosGain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 1);
        }
        setTimeout(() => {
          try { this.chaosSource.stop(); } catch (e) {}
          this.chaosSource = null;
        }, 1000);
      } catch (e) {}
    }
  }

  _makeDistortionCurve(amount) {
    const k = typeof amount === 'number' ? amount : 50,
      n_samples = 44100,
      curve = new Float32Array(n_samples),
      deg = Math.PI / 180;
    for (let i = 0; i < n_samples; ++i) {
      let x = i * 2 / n_samples - 1;
      curve[i] = (3 + k) * x * 20 * deg / (Math.PI + k * Math.abs(x));
    }
    return curve;
  }
}

export const audioBus = new AudioBus();
