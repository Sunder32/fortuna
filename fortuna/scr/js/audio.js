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
    this.chaosBuffer = null; // 🌀 Буфер для звука хаоса
    this.chaosSource = null; // 🌀 Источник звука хаоса
    this.chaosGain = null; // 🌀 Gain для звука хаоса
    
    // 🗣️ Инициализация голосов для озвучки
    this._initVoices();
  }
  
  // 🗣️ Предзагрузка голосов
  _initVoices() {
    if ('speechSynthesis' in window) {
      // Голоса загружаются асинхронно, поэтому ждём события
      if (window.speechSynthesis.getVoices().length === 0) {
        window.speechSynthesis.addEventListener('voiceschanged', () => {
          console.log('🗣️ Голоса загружены:', window.speechSynthesis.getVoices().length);
        }, { once: true });
      }
      // Принудительная загрузка голосов
      window.speechSynthesis.getVoices();
    }
  }

  isUnlocked() {
    return this._unlocked;
  }

  async initOnFirstGesture() {
    if (this._unlocked) return;
    
    // 🔥 Расширенный список событий для мобильных
    const events = [
      'pointerdown', 'touchstart', 'touchend', 
      'mousedown', 'keydown', 'click'
    ];
    
    events.forEach(evt => {
      window.addEventListener(evt, this._unlockHandler, { 
        once: true, 
        passive: true,
        capture: true  // Перехватываем на фазе захвата
      });
      // Дублируем на document для надёжности
      document.addEventListener(evt, this._unlockHandler, { 
        once: true, 
        passive: true,
        capture: true
      });
    });
    
    // Дополнительно слушаем события на body
    document.body?.addEventListener('touchstart', this._unlockHandler, { 
      once: true, 
      passive: true 
    });
  }

  async _unlock() {
    try {
      if (!this.ctx) {
        // Используем AudioContext с поддержкой префиксов для старых браузеров
        const AudioContextClass = window.AudioContext || 
                                  window.webkitAudioContext || 
                                  window.mozAudioContext;
        if (!AudioContextClass) {
          console.warn('AudioContext не поддерживается');
          this._unlocked = true;
          return;
        }
        
        this.ctx = new AudioContextClass();
        this.master = this.ctx.createGain();
        this.master.gain.value = 1.0;
        this.master.connect(this.ctx.destination);
      }
      
      // 🔥 Принудительное возобновление для мобильных
      if (this.ctx.state === 'suspended') {
        await this.ctx.resume();
      }
      
      // Дополнительная проверка для iOS
      if (this.ctx.state === 'suspended') {
        // Пробуем ещё раз через небольшую задержку
        setTimeout(async () => {
          try {
            await this.ctx.resume();
          } catch (e) {
            console.warn('Не удалось возобновить AudioContext:', e);
          }
        }, 100);
      }
      
      this._unlocked = true;
      await this._preloadClickSound(); // Предзагружаем звук клика
      
      console.log('✅ Audio разблокирован! State:', this.ctx.state);
    } catch (e) {
      console.warn('WebAudio недоступен', e);
      this._unlocked = true;
    }
  }

  async _preloadClickSound() {
    if (this.clickBuffer) return;
    try {
      // Простой синтезированный звук щелчка
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
    if (!this.enabled.clicks) return;
    
    // 🔥 Если аудио ещё не разблокировано, пробуем разблокировать
    if (!this._unlocked) {
      this._unlock();
      return;
    }
    
    if (!this.ctx || !this.clickBuffer) return;
    
    try {
      // Проверяем состояние контекста перед воспроизведением
      if (this.ctx.state === 'suspended') {
        this.ctx.resume().then(() => {
          this._playClick(volume, rate);
        });
      } else {
        this._playClick(volume, rate);
      }
    } catch (e) {
      console.warn('Ошибка воспроизведения звука:', e);
    }
  }

  _playClick(volume, rate) {
    try {
      const source = this.ctx.createBufferSource();
      source.buffer = this.clickBuffer;
      source.playbackRate.value = rate;

      const gain = this.ctx.createGain();
      gain.gain.value = volume;
      
      source.connect(gain).connect(this.master);
      source.start(0);
      
      // Автоматически отключаем через секунду для освобождения памяти
      setTimeout(() => {
        try {
          source.disconnect();
          gain.disconnect();
        } catch (e) {
          // Игнорируем ошибки отключения
        }
      }, 1000);
    } catch (e) {
      console.warn('Ошибка _playClick:', e);
    }
  }

  async startAmbient() {
    if (!this.enabled.ambient || this.ambientSource) return;
    
    // 🔥 Если аудио не разблокировано, пробуем разблокировать
    if (!this._unlocked) {
      await this._unlock();
    }
    
    if (!this.ctx) return;
    
    try {
      // Возобновляем контекст если нужно (для мобильных)
      if (this.ctx.state === 'suspended') {
        await this.ctx.resume();
      }
      
      if (!this.ambientBuffer) {
        console.log('⏳ Загрузка фоновой музыки...');
        const response = await fetch('assets/audio/ambient.mp3');
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const arrayBuffer = await response.arrayBuffer();
        this.ambientBuffer = await this.ctx.decodeAudioData(arrayBuffer);
        console.log('✅ Фоновая музыка загружена!');
      }
      
      this.ambientSource = this.ctx.createBufferSource();
      this.ambientSource.buffer = this.ambientBuffer;
      this.ambientSource.loop = true;
      
      const gain = this.ctx.createGain();
      gain.gain.value = 0;
      this.ambientSource.connect(gain).connect(this.master);
      
      // Плавное нарастание громкости
      gain.gain.linearRampToValueAtTime(0.3, this.ctx.currentTime + 2);
      
      this.ambientSource.start(0);
      console.log('🎵 Фоновая музыка запущена!');
    } catch (e) {
      console.warn('Не удалось запустить фоновый звук:', e);
      this.ambientSource = null;
    }
  }

  stopAmbient() {
    if (this.ambientSource) {
      try {
        this.ambientSource.stop();
      } catch (e) {
        // Ignore errors if already stopped
      }
      this.ambientSource = null;
    }
  }

  // 🌪️ Звук ветра (громкость зависит от скорости колеса)
  playWind(velocity = 0) {
    if (!this.enabled.clicks || !this.ctx) return;
    
    try {
      // Создаём шум ветра
      const duration = 0.3;
      const sampleRate = this.ctx.sampleRate;
      const buffer = this.ctx.createBuffer(1, duration * sampleRate, sampleRate);
      const data = buffer.getChannelData(0);
      
      // Низкочастотный шум с модуляцией
      for (let i = 0; i < data.length; i++) {
        const t = i / sampleRate;
        const freq = 50 + velocity * 20; // Частота растёт со скоростью
        const mod = Math.sin(t * freq * Math.PI * 2);
        const noise = (Math.random() * 2 - 1) * 0.3;
        data[i] = noise * mod * Math.min(velocity / 20, 1); // Громкость от скорости
      }
      
      const source = this.ctx.createBufferSource();
      source.buffer = buffer;
      
      // Фильтр для "воздушности"
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 800 + velocity * 50;
      
      const gain = this.ctx.createGain();
      gain.gain.value = Math.min(velocity / 30, 0.4);
      
      source.connect(filter).connect(gain).connect(this.master);
      source.start();
    } catch (e) {
      console.warn('Ошибка воспроизведения звука ветра:', e);
    }
  }

  // 🔔 Металлический звон (удар о зубец)
  playMetalCling(intensity = 1.0) {
    if (!this.enabled.clicks || !this.ctx) return;
    
    try {
      const now = this.ctx.currentTime;
      
      // Металлический резонанс - несколько частот
      const frequencies = [800, 1200, 1800, 2400];
      
      frequencies.forEach((freq, i) => {
        const osc = this.ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = freq;
        
        const gain = this.ctx.createGain();
        const volume = (0.15 / (i + 1)) * intensity;
        gain.gain.setValueAtTime(volume, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
        
        osc.connect(gain).connect(this.master);
        osc.start(now);
        osc.stop(now + 0.3);
      });
      
      // Добавляем шум для реалистичности
      const duration = 0.15;
      const sampleRate = this.ctx.sampleRate;
      const buffer = this.ctx.createBuffer(1, duration * sampleRate, sampleRate);
      const data = buffer.getChannelData(0);
      
      for (let i = 0; i < data.length; i++) {
        const t = i / sampleRate;
        const envelope = Math.exp(-t * 20);
        const noise = Math.random() * 2 - 1;
        data[i] = noise * envelope * 0.1 * intensity;
      }
      
      const noiseSource = this.ctx.createBufferSource();
      noiseSource.buffer = buffer;
      
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.value = 2000;
      
      noiseSource.connect(filter).connect(this.master);
      noiseSource.start();
    } catch (e) {
      console.warn('Ошибка воспроизведения металлического звона:', e);
    }
  }

  // 🎺 Фанфары победы
  playVictoryFanfare() {
    if (!this.enabled.clicks || !this.ctx) return;
    
    try {
      const now = this.ctx.currentTime;
      
      // Торжественная мелодия (C-E-G-C)
      const notes = [
        { freq: 261.63, time: 0, duration: 0.2 },    // C
        { freq: 329.63, time: 0.15, duration: 0.2 }, // E
        { freq: 392.00, time: 0.3, duration: 0.2 },  // G
        { freq: 523.25, time: 0.45, duration: 0.4 }  // C (выше)
      ];
      
      notes.forEach(note => {
        const osc = this.ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.value = note.freq;
        
        const gain = this.ctx.createGain();
        const startTime = now + note.time;
        const endTime = startTime + note.duration;
        
        gain.gain.setValueAtTime(0, startTime);
        gain.gain.linearRampToValueAtTime(0.2, startTime + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.01, endTime);
        
        osc.connect(gain).connect(this.master);
        osc.start(startTime);
        osc.stop(endTime);
      });
      
      // Добавляем гармоники для богатства
      notes.forEach(note => {
        const osc = this.ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = note.freq * 2; // Октава выше
        
        const gain = this.ctx.createGain();
        const startTime = now + note.time;
        const endTime = startTime + note.duration;
        
        gain.gain.setValueAtTime(0, startTime);
        gain.gain.linearRampToValueAtTime(0.1, startTime + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.01, endTime);
        
        osc.connect(gain).connect(this.master);
        osc.start(startTime);
        osc.stop(endTime);
      });
    } catch (e) {
      console.warn('Ошибка воспроизведения фанфар:', e);
    }
  }

  // 🎭 Драматический звук остановки
  playDramaticStop() {
    if (!this.enabled.clicks || !this.ctx) return;
    
    try {
      const now = this.ctx.currentTime;
      
      // Глубокий бас-удар
      const bass = this.ctx.createOscillator();
      bass.type = 'sine';
      bass.frequency.setValueAtTime(80, now);
      bass.frequency.exponentialRampToValueAtTime(40, now + 0.3);
      
      const bassGain = this.ctx.createGain();
      bassGain.gain.setValueAtTime(0.5, now);
      bassGain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
      
      bass.connect(bassGain).connect(this.master);
      bass.start(now);
      bass.stop(now + 0.5);
      
      // Реверберация
      const duration = 0.8;
      const sampleRate = this.ctx.sampleRate;
      const buffer = this.ctx.createBuffer(1, duration * sampleRate, sampleRate);
      const data = buffer.getChannelData(0);
      
      for (let i = 0; i < data.length; i++) {
        const t = i / sampleRate;
        const envelope = Math.exp(-t * 3);
        const noise = Math.random() * 2 - 1;
        data[i] = noise * envelope * 0.2;
      }
      
      const noiseSource = this.ctx.createBufferSource();
      noiseSource.buffer = buffer;
      
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 200;
      
      noiseSource.connect(filter).connect(this.master);
      noiseSource.start(now + 0.1);
    } catch (e) {
      console.warn('Ошибка воспроизведения драматического звука:', e);
    }
  }

  // 🗣️ Голосовое объявление победителя (Web Speech API)
  speak(text) {
    if (!this.enabled.clicks) return;
    
    try {
      // Проверяем поддержку Speech Synthesis
      if ('speechSynthesis' in window) {
        // Останавливаем предыдущее объявление если есть
        window.speechSynthesis.cancel();
        
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'ru-RU';
        utterance.rate = 0.9; // Немного медленнее для драмы
        utterance.pitch = 0.8; // Немного ниже для серьёзности
        utterance.volume = 0.8;
        
        window.speechSynthesis.speak(utterance);
      }
    } catch (e) {
      console.warn('Ошибка синтеза речи:', e);
    }
  }

  // 🌀 ЗВУК РЕЖИМА ХАОСА - зловещий эмбиент
  async startChaosSound() {
    console.log('🌀 Попытка запустить звук хаоса...');
    
    // Останавливаем если уже играет
    if (this.chaosSource) {
      try {
        this.chaosSource.stop();
      } catch (e) {
        // ignore
      }
      this.chaosSource = null;
      this.chaosGain = null;
    }
    
    // 🔥 Если аудио не разблокировано, пробуем разблокировать
    if (!this._unlocked) {
      console.log('🌀 Аудио не разблокировано, разблокируем...');
      await this._unlock();
    }
    
    if (!this.ctx) {
      console.warn('🌀 AudioContext не создан');
      return;
    }
    
    try {
      // Возобновляем контекст если нужно
      if (this.ctx.state === 'suspended') {
        await this.ctx.resume();
      }
      
      if (!this.chaosBuffer) {
        console.log('🌀 Загрузка звука хаоса...');
        const response = await fetch('assets/audio/shadows-of-dread_87945.mp3');
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const arrayBuffer = await response.arrayBuffer();
        this.chaosBuffer = await this.ctx.decodeAudioData(arrayBuffer);
        console.log('✅ Звук хаоса загружен!');
      }
      
      this.chaosSource = this.ctx.createBufferSource();
      this.chaosSource.buffer = this.chaosBuffer;
      this.chaosSource.loop = true; // 🔥 ЗАЦИКЛИВАЕМ для постоянного ужаса
      
      // 🔥 Добавляем искажение и реверберацию для большего ужаса
      const distortion = this.ctx.createWaveShaper();
      distortion.curve = this._makeDistortionCurve(50);
      
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 1500;
      filter.Q.value = 5;
      
      const gain = this.ctx.createGain();
      gain.gain.value = 0;
      
      // Цепочка эффектов: источник -> искажение -> фильтр -> громкость
      this.chaosSource
        .connect(distortion)
        .connect(filter)
        .connect(gain)
        .connect(this.master);
      
      // Плавное нарастание громкости
      gain.gain.linearRampToValueAtTime(0.7, this.ctx.currentTime + 1.5);
      
      // Сохраняем gain для управления громкостью
      this.chaosGain = gain;
      
      this.chaosSource.start(0);
      
      console.log('✅ Звук хаоса запущен в зацикленном режиме!');
      return true;
    } catch (e) {
      console.error('❌ Не удалось запустить звук хаоса:', e);
      this.chaosSource = null;
      this.chaosGain = null;
      return false;
    }
  }
  
  // Создание кривой искажения для эффекта
  _makeDistortionCurve(amount) {
    const samples = 44100;
    const curve = new Float32Array(samples);
    const deg = Math.PI / 180;
    
    for (let i = 0; i < samples; i++) {
      const x = (i * 2) / samples - 1;
      curve[i] = ((3 + amount) * x * 20 * deg) / (Math.PI + amount * Math.abs(x));
    }
    
    return curve;
  }

  // 🌀 Остановка звука хаоса
  stopChaosSound() {
    if (this.chaosSource) {
      try {
        // Плавное затухание перед остановкой
        if (this.chaosGain) {
          this.chaosGain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 1);
        }
        
        setTimeout(() => {
          if (this.chaosSource) {
            try {
              this.chaosSource.stop();
            } catch (e) {
              // Ignore if already stopped
            }
            this.chaosSource = null;
            this.chaosGain = null;
          }
        }, 1000);
      } catch (e) {
        console.warn('Ошибка остановки звука хаоса:', e);
        this.chaosSource = null;
        this.chaosGain = null;
      }
    }
  }
  
  // 🗣️ ОЗВУЧКА ТЕКСТА (Web Speech API)
  speak(text) {
    if (!text || typeof text !== 'string') return;
    
    // Проверяем поддержку Speech Synthesis API
    if (!('speechSynthesis' in window)) {
      console.warn('Speech Synthesis API не поддерживается');
      return;
    }
    
    try {
      // Останавливаем предыдущую озвучку если есть
      window.speechSynthesis.cancel();
      
      const utterance = new SpeechSynthesisUtterance(text);
      
      // Настройки голоса
      utterance.lang = 'ru-RU'; // Русский язык
      utterance.rate = 1.2; // Скорость (1.2 = быстрее на 20%)
      utterance.pitch = 0.8; // Низкий тон для демоничности
      utterance.volume = 0.9; // Громкость
      
      // Пытаемся найти мужской русский голос
      const voices = window.speechSynthesis.getVoices();
      const russianVoice = voices.find(v => 
        v.lang.startsWith('ru') && v.name.toLowerCase().includes('male')
      ) || voices.find(v => v.lang.startsWith('ru'));
      
      if (russianVoice) {
        utterance.voice = russianVoice;
      }
      
      window.speechSynthesis.speak(utterance);
      
    } catch (e) {
      console.warn('Ошибка озвучки:', e);
    }
  }
}

export const audioBus = new AudioBus();