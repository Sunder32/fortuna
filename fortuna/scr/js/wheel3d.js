// src/js/wheel3d.js - Оптимизированная версия с эффектами
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { FireTrail, Lightning, Comet, FallingStars } from './utils/wheeleffects.js';

const TAU = Math.PI * 2;
const MAX_LABELS = 24;
// 🔥 ЯРКИЕ КРАСНО-ОРАНЖЕВЫЕ ЦВЕТА (как на скриншоте)
const SEGMENT_COLORS = [
  0xff4422,  // Ярко-красно-оранжевый
  0xcc3311,  // Темно-красный
  0xff6633,  // Оранжевый
  0xaa2200,  // Темно-бордовый
  0xff7744,  // Светло-оранжевый
  0xbb2211,  // Красновато-коричневый
  0xff5522,  // Красно-оранжевый
  0x991100   // Темно-бордовый
];

class SpinPhysics {
  constructor() {
    this.angle = 0;
    this.vel = 0;
    this.baseFriction = 0.993; // Базовое трение
    this.minSpeed = 0.0001;
    this.maxSpeed = 60; // 🔥 Увеличено для ЭКСТРЕМАЛЬНОГО режима хаоса!
    this.lastToothHit = -1;
    this.toothCooldown = 0;
    this.sectorCount = 8; // Для адаптивной физики
  }
  
  // ✅ ДИНАМИЧЕСКОЕ ТРЕНИЕ по скорости
  getDynamicFriction(velocity) {
    const absVel = Math.abs(velocity);
    if (absVel > 20) return 0.996;  // Очень слабое на экстремальных скоростях
    if (absVel > 15) return 0.995;  // Слабое на высоких скоростях
    if (absVel > 8) return 0.993;   // Среднее на средних скоростях
    if (absVel > 3) return 0.988;   // Сильное на малых скоростях
    return 0.975;                    // Очень сильное для быстрой остановки
  }
  
  // ✅ АДАПТАЦИЯ под количество секторов
  getSectorMultiplier() {
    // Больше секторов = нужно больше инерции
    return Math.sqrt(this.sectorCount / 8);
  }
  
  setSectorCount(count) {
    this.sectorCount = Math.max(2, count);
  }
  
  addImpulse(delta) {
    this.vel = THREE.MathUtils.clamp(this.vel + delta, -this.maxSpeed, this.maxSpeed);
  }
  
  step(dt) {
    this.angle = (this.angle + this.vel * dt) % TAU;
    if (this.angle < 0) this.angle += TAU;
    
    // Применяем динамическое трение
    const dynamicFriction = this.getDynamicFriction(this.vel);
    this.vel *= Math.pow(dynamicFriction, dt * 60);
    
    if (this.toothCooldown > 0) this.toothCooldown -= dt;
    if (Math.abs(this.vel) < this.minSpeed) this.vel = 0;
  }
}

export class HellWheel3D {
  constructor(container, options = {}) {
    this.container = container;
    this.onHit = options.onHit || null;
    this.onResult = options.onResult || null;
    this.audioBus = options.audioBus || null; // 🔊 Ссылка на аудио систему
    this.ui = null;

    this.labels = [];
    this.segmentCount = 0;
    this.isSpinning = false;
    this.physics = new SpinPhysics();

    this.outerRadius = 4.6;
    this.innerRadius = 2.2;
    this.bodyHeight = 1.0;
    this.segmentHeight = 0.5;
    this.labelRadius = 3.6;

    this.activeIndex = -1;
    this.initialized = false;
    this.pointerAngle = 0;
    this.currentAngle = 0;
    this.pendingResultIndex = -1;
    this.currentPointerIndex = null;
    this._randBuffer = new Uint32Array(1);
    
    // ✅ ИНЕРЦИЯ УКАЗАТЕЛЯ
    this.pointerInertia = 0;
    this.pointerVelocity = 0;
    
    // ✅ СВАЙПЫ ДЛЯ МОБИЛЬНЫХ
    this.touchStartX = 0;
    this.touchStartY = 0;
    this.touchStartTime = 0;
    
    // ✅ СИСТЕМА ИСКР
    this.sparkParticles = [];
    
    // 🌀 РЕЖИМ ХАОСА
    this.chaosMode = false;
    this.chaosEvents = null;
    this.chaosStartTime = null;
    this.chaosPauseEnd = null;
    this.chaosPausedVelocity = 0;
    
    // Для эффектов победы
    this.victoryEffects = [];
    this.fireRing = null;
    
    // Фразы для модального окна
    this.hellPhrases = [
      "Колесо выбрало свою жертву! Пламя ада озарило твой путь.",
      "Демоны аплодируют! Судьба начертана огненными рунами.",
      "Врата преисподней приоткрылись, чтобы указать избранного!",
      "Адское пламя танцует в честь решения судьбы!",
      "Книга проклятых пополнилась новым именем...",
      "Огненные цепи судьбы сомкнулись! Выбор сделан.",
      "Тёмные силы указали перстом на избранника!",
      "Колесо остановилось, но эхо его вращения будет звучать вечно...",
      "Пламенный вердикт вынесен! Да исполнится воля колеса.",
      "Инфернальный механизм выбрал достойного!",
      "Души демонов ликуют - жребий брошен!",
      "Огненная печать поставлена на избранном секторе.",
      "Преисподняя огласила своё решение громом и пламенем!",
      "Раскалённые руны сложились в имя победителя.",
      "Адский совет единогласно указал на избранника!"
    ];

    this._initThree();
    this._buildWheel();
    this._createVictoryModal();
    this.resize();
    this._animate();
    this._playEntranceAnimation(); // 🎬 Эффектное появление колеса
    this.initialized = true;
  }

  spin(strength = 1, chaosMode = false) {
    if (this.segmentCount < 2 || this.isSpinning) return;
    
    // Устанавливаем флаг для возможности отвергнуть приговор при новом вращении
    if (!this.isReSpin) {
      this.canRejectFate = true;
    } else {
      this.canRejectFate = false;
      this.isReSpin = false;
    }
    
    if (this.victoryModal && this.victoryModal.classList.contains('active')) {
      this.victoryModal.classList.remove('active');
    }
    
    this._resetVisualState();
    this._clearVictoryEffects();

    // ПЕРЕМЕШИВАЕМ СЕКТОРА для большей случайности!
    if (!this.originalLabels || this.originalLabels.length === 0) {
      this.originalLabels = [...this.labels];
      console.log('🎲 Сохранены оригинальные метки:', this.originalLabels);
    }
    
    // 🌀 РЕЖИМ ХАОСА - множественные перемешивания
    let shuffled;
    if (chaosMode) {
      const shuffleCount = 2 + Math.floor(this._randomFloat() * 4); // 2-5 раз
      shuffled = [...this.originalLabels];
      for (let i = 0; i < shuffleCount; i++) {
        shuffled = this._shuffleArray(shuffled);
      }
      console.log(`🌀 РЕЖИМ ХАОСА: ${shuffleCount} перемешиваний`);
    } else {
      shuffled = this._shuffleArray(this.originalLabels);
    }
    
    console.log('🎲 Перемешивание:', {
      'до': [...this.labels],
      'после': shuffled
    });
    
    this.labels = shuffled;
    
    // Сбрасываем угол колеса для визуального эффекта
    this.physics.angle = 0;
    if (this.root) {
      this.root.rotation.z = 0;
    }
    
    // Перестраиваем сектора с новым порядком
    this._rebuildSectors();
    
    // ✅ АДАПТАЦИЯ ПОД КОЛИЧЕСТВО СЕКТОРОВ
    this.physics.setSectorCount(this.segmentCount);
    const sectorMultiplier = this.physics.getSectorMultiplier();
    
    this.physics.vel = 0;
    
    // 🌀 РЕЖИМ ХАОСА - случайная сила и направление
    let spinForce;
    let direction;
    
    if (chaosMode) {
      // Экстремальная случайность силы (15-45)
      spinForce = (15 + this._randomFloat() * 30) * strength * sectorMultiplier;
      // Случайное направление с возможностью двойного вращения
      direction = this._randomFloat() < 0.5 ? 1 : -1;
      
      // Сохраняем режим хаоса для дальнейшей обработки в анимации
      this.chaosMode = true;
      this.chaosEvents = this._generateChaosEvents();
      this.chaosWarningShown = false; // 🔥 Сброс флага предупреждения
      
      console.log('🌀 РЕЖИМ ХАОСА: Фаза разгона 2.5 сек, затем', this.chaosEvents.length, 'событий');
    } else {
      spinForce = (22 + this._randomFloat() * 15) * strength * sectorMultiplier;
      direction = this._randomFloat() < 0.5 ? 1 : -1;
      this.chaosMode = false;
      this.chaosEvents = null;
      this.chaosWarningShown = false;
    }
    
    this.physics.addImpulse(spinForce * direction);
    
    // Сброс инерции указателя
    this.pointerInertia = 0;
    this.pointerVelocity = 0;
    
    this.isSpinning = true;
    this.activeIndex = -1;
    
    if (this.pointerGroup) {
      this.pointerGroup.rotation.z = 0;
    }
    
    // 🔥 Активируем огненный шлейф при вращении
    if (this.fireTrail) {
      this.fireTrail.start();
    }
    
    const modeText = chaosMode ? ' [РЕЖИМ ХАОСА]' : '';
    console.log(`🎰 Спин: сила=${spinForce.toFixed(1)}, секторов=${this.segmentCount}${modeText}`);
  }
  
  // 🌀 Генерация случайных событий хаоса
  _generateChaosEvents() {
    const events = [];
    
    // � ФАЗА РАЗГОНА: 2500мс (2.5 секунды) колесо крутится нормально, потом начинается ХАОС!
    const WARMUP_PHASE = 2500;
    
    // �😈 ГАРАНТИРУЕМ МИНИМУМ 5 СОБЫТИЙ КАЖДОГО ТИПА!
    const eventTypes = ['boost', 'brake', 'reverse', 'mega-boost', 'double-reverse', 'hurricane'];
    
    // Добавляем минимум 5 событий каждого типа (БЕЗ ПАУЗЫ!)
    for (const eventType of eventTypes) {
      for (let i = 0; i < 5; i++) {
        // 🔥 ЗАДЕРЖКА: 2500-6500мс (фаза разгона + хаос)
        const delay = WARMUP_PHASE + this._randomFloat() * 4000;
        const event = this._createChaosEvent(eventType, delay);
        if (event) events.push(event);
      }
    }
    
    // 🔥 ПАУЗА ОЧЕНЬ РЕДКО - только 1-2 раза за всё вращение (5% шанс)
    if (this._randomFloat() < 0.05) {
      const pauseCount = Math.floor(this._randomFloat() * 2) + 1; // 1-2 паузы
      for (let i = 0; i < pauseCount; i++) {
        const delay = WARMUP_PHASE + this._randomFloat() * 4000;
        const event = this._createChaosEvent('pause', delay);
        if (event) events.push(event);
      }
    }
    
    // Добавляем ещё 20-40 СЛУЧАЙНЫХ событий для МАКСИМАЛЬНОГО ХАОСА
    const extraCount = 20 + Math.floor(this._randomFloat() * 20);
    for (let i = 0; i < extraCount; i++) {
      // 🔥 ЗАДЕРЖКА: 2300-6000мс (немного раньше для разнообразия)
      const delay = WARMUP_PHASE - 200 + this._randomFloat() * 3700;
      const type = Math.floor(this._randomFloat() * 6); // ТЕПЕРЬ 6 типов (без паузы)
      
      let event = null;
      switch(type) {
        case 0: // Внезапное ускорение
          event = {
            type: 'boost',
            delay: delay,
            strength: 3 + this._randomFloat() * 7, // +3 до +10
            executed: false
          };
          break;
        case 1: // Резкое замедление
          event = {
            type: 'brake',
            delay: delay,
            strength: 0.3 + this._randomFloat() * 0.4, // x0.3 до x0.7
            executed: false
          };
          break;
        case 2: // Смена направления
          event = {
            type: 'reverse',
            delay: delay,
            strength: 0.6 + this._randomFloat() * 0.3, // Сохраняет 60-90% скорости
            executed: false
          };
          break;
        case 3: // 🔥 ЭКСТРЕМАЛЬНОЕ УСКОРЕНИЕ
          event = {
            type: 'mega-boost',
            delay: delay,
            strength: 15 + this._randomFloat() * 25, // +15 до +40!
            executed: false
          };
          break;
        case 4: // 💥 ДВОЙНОЙ РЕВЕРС (смена направления дважды)
          event = {
            type: 'double-reverse',
            delay: delay,
            strength: 0.7 + this._randomFloat() * 0.2,
            executed: false
          };
          break;
        case 5: // 🌪️ УРАГАННОЕ ВРАЩЕНИЕ (случайное направление)
          event = {
            type: 'hurricane',
            delay: delay,
            strength: 20 + this._randomFloat() * 30, // +20 до +50!!!
            executed: false
          };
          break;
        default: // На случай ошибки - дефолтное ускорение
          event = {
            type: 'boost',
            delay: delay,
            strength: 5,
            executed: false
          };
          break;
      }
      
      if (event) {
        events.push(event);
      }
    }
    
    console.log(`😈 ГЕНЕРИРОВАНО ${events.length} СОБЫТИЙ ХАОСА!!!`);
    
    // Сортируем по времени срабатывания
    return events.sort((a, b) => a.delay - b.delay);
  }
  
  // 😈 Создание события хаоса по типу
  _createChaosEvent(typeName, delay) {
    const eventMap = {
      'boost': () => ({
        type: 'boost',
        delay: delay,
        strength: 3 + this._randomFloat() * 7,
        executed: false
      }),
      'brake': () => ({
        type: 'brake',
        delay: delay,
        strength: 0.3 + this._randomFloat() * 0.4,
        executed: false
      }),
      'reverse': () => ({
        type: 'reverse',
        delay: delay,
        strength: 0.6 + this._randomFloat() * 0.3,
        executed: false
      }),
      'pause': () => ({
        type: 'pause',
        delay: delay,
        duration: 50 + this._randomFloat() * 300,
        executed: false
      }),
      'mega-boost': () => ({
        type: 'mega-boost',
        delay: delay,
        strength: 15 + this._randomFloat() * 25,
        executed: false
      }),
      'double-reverse': () => ({
        type: 'double-reverse',
        delay: delay,
        strength: 0.7 + this._randomFloat() * 0.2,
        executed: false
      }),
      'hurricane': () => ({
        type: 'hurricane',
        delay: delay,
        strength: 20 + this._randomFloat() * 30,
        executed: false
      })
    };
    
    return eventMap[typeName] ? eventMap[typeName]() : null;
  }
  _resetVisualState() {
    if (this.segmentGroup) {
      this.segmentGroup.children.forEach((child) => {
        const mat = child.material;
        if (!mat) return;
        const baseColor = child.userData?.baseColor;
        const baseEmissive = child.userData?.baseEmissive;

        if (baseColor) mat.color.copy(baseColor);
        if (baseEmissive) {
          mat.emissive.copy(baseEmissive);
          mat.emissiveIntensity = 1.1;
        }
      });
    }

    if (this.labelGroup) {
      this.labelGroup.children.forEach((sprite) => {
        if (!(sprite instanceof THREE.Sprite)) return;
        const mat = sprite.material;
        const base = sprite.userData?.baseScale;

        if (mat) mat.opacity = 0.95;
        if (base) sprite.scale.set(base.x, base.y, 1);
      });
    }
  }

  setLabels(arr) {
    const cleaned = Array.isArray(arr) ? arr.filter(Boolean).slice(0, MAX_LABELS) : [];
    const labelsChanged = JSON.stringify(this.labels) !== JSON.stringify(cleaned);
    
    if (!labelsChanged && this.initialized) return;
    
    if (!cleaned.length) {
      this.segmentCount = 0;
      this.labels = [];
      this.originalLabels = [];
      this.activeIndex = -1;
      this.physics.angle = 0;
      this.currentAngle = 0;
      this.physics.active = false;
      this.currentPointerIndex = null;
      this._rebuildSectors();
      return;
    }

    const currentAngle = this.currentAngle;
    const currentActiveIndex = this.activeIndex;
    
    this.segmentCount = cleaned.length;
    this.labels = cleaned;
    this.originalLabels = [...cleaned]; // Сохраняем оригинальный порядок
    
    if (!this.isSpinning && this.initialized) {
      this.physics.angle = currentAngle;
      this.activeIndex = currentActiveIndex;
    }
    
    if (this.root && this.initialized) {
      this.root.rotation.z = this.physics.angle;
    }
    
    this._rebuildSectors();
  }

  resize() {
    const rect = this.container.getBoundingClientRect();
    const w = rect.width || 800;
    const h = rect.height || 600;
    
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.composer.setSize(w, h);
  }

  _initThree() {
    const rect = this.container.getBoundingClientRect();
    const w = rect.width || 800;
    const h = rect.height || 600;

    let slot = this.container.querySelector('.wheel-canvas-slot');
    if (!slot) {
      slot = document.createElement('div');
      slot.className = 'wheel-canvas-slot';
      this.container.prepend(slot);
    }

    this.scene = new THREE.Scene();
    
    // 🌌 HDR окружение - адское небо
    const gradientTexture = new THREE.DataTexture(
      new Uint8Array([
        10, 1, 3,    // Низ - тёмно-красный
        20, 5, 5,    // Середина
        40, 10, 10,  // Верх - темнее
      ]),
      1, 3, THREE.RGBFormat
    );
    gradientTexture.needsUpdate = true;
    this.scene.background = gradientTexture;
    this.scene.fog = new THREE.FogExp2(0x0a0103, 0.055); // Усиленный туман

    this.camera = new THREE.PerspectiveCamera(40, w / h, 0.1, 80);
    this.camera.position.set(0.65, 1.8, 12.8);
    this.camera.lookAt(0, 0.35, 0);

    this.renderer = new THREE.WebGLRenderer({ 
      antialias: true, 
      alpha: true,
      powerPreference: 'high-performance' // Оптимизация
    });
    this.renderer.setPixelRatio(Math.min(2.2, window.devicePixelRatio || 1));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0; // Стандартная яркость
    this.renderer.setSize(w, h, false);
    slot.appendChild(this.renderer.domElement);

    // Освещение
    this.scene.add(new THREE.HemisphereLight(0x6b3030, 0x150202, 0.48));
    
    const key = new THREE.DirectionalLight(0xffbf91, 1.42);
    key.position.set(7.5, 9.2, 8.8);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    this.scene.add(key);

    const rim = new THREE.SpotLight(0xff5f3d, 1.18, 36, THREE.MathUtils.degToRad(42), 0.55, 1.4);
    rim.position.set(-6.2, -5.4, 6.1);
    rim.target.position.set(0, 0.3, 0);
    rim.castShadow = true;
    this.scene.add(rim);
    this.scene.add(rim.target);

    const warmLight = new THREE.PointLight(0x863030, 0.9, 32, 2.6);
    warmLight.position.set(3.2, -3.6, 3.8);
    this.scene.add(warmLight);
    const rimLight = new THREE.PointLight(0xff9b60, 0.55, 40, 1.8);
    rimLight.position.set(-2.4, 6.6, -3.5);
    this.scene.add(rimLight);

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    
    // 🔥 BLOOM для свечения (уменьшенная яркость)
    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(w, h), 
      0.5,   // strength - мягкое свечение (было 0.85)
      0.8,   // radius - меньший радиус (было 1.0)
      0.35   // threshold - только самые яркие элементы (было 0.25)
    );
    this.composer.addPass(this.bloomPass);

    this._createParticles();
    this._createStarDust(); // 🌟 Звёздная пыль
    this._createEmbers();   // 🔥 Тлеющие угли
    
    // 🔥 Инициализация визуальных эффектов (сохраняем для использования после _buildWheel)
    this._effectsToInit = { FireTrail, Lightning, Comet, FallingStars };
  }

  _createParticles() {
    const particleCount = 500;
    const positions = new Float32Array(particleCount * 3);
    const velocities = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 20;
      positions[i * 3 + 1] = Math.random() * 15;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 20;

      velocities[i * 3] = (Math.random() - 0.5) * 0.1;
      velocities[i * 3 + 1] = -0.05 - Math.random() * 0.1;
      velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.1;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.particleVelocities = velocities;

    const material = new THREE.PointsMaterial({
      color: 0xff8844,
      size: 0.08,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    });

    this.particles = new THREE.Points(geometry, material);
    this.scene.add(this.particles);
  }

  // 🌟 Звёздная пыль в фоне
  _createStarDust() {
    const starCount = 1000;
    const positions = new Float32Array(starCount * 3);
    const colors = new Float32Array(starCount * 3);
    const sizes = new Float32Array(starCount);

    for (let i = 0; i < starCount; i++) {
      // Равномерное распределение в сфере
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const radius = 30 + Math.random() * 20;

      positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = radius * Math.cos(phi);

      // Огненные цвета для звёзд
      const colorChoice = Math.random();
      if (colorChoice < 0.5) {
        colors[i * 3] = 1.0;     // R - оранжевые
        colors[i * 3 + 1] = 0.6;
        colors[i * 3 + 2] = 0.3;
      } else {
        colors[i * 3] = 1.0;     // R - красные
        colors[i * 3 + 1] = 0.3;
        colors[i * 3 + 2] = 0.2;
      }

      sizes[i] = Math.random() * 2 + 0.5;
    }

    const starGeometry = new THREE.BufferGeometry();
    starGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    starGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    starGeometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

    const starMaterial = new THREE.PointsMaterial({
      size: 0.15,
      vertexColors: true,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    });

    this.starDust = new THREE.Points(starGeometry, starMaterial);
    this.scene.add(this.starDust);
  }

  // 🔥 Тлеющие угли вокруг колеса
  _createEmbers() {
    const emberCount = 80;
    const positions = new Float32Array(emberCount * 3);
    const velocities = new Float32Array(emberCount * 3);
    const sizes = new Float32Array(emberCount);
    const colors = new Float32Array(emberCount * 3);

    for (let i = 0; i < emberCount; i++) {
      // Позиция вокруг колеса
      const angle = Math.random() * Math.PI * 2;
      const radius = 3 + Math.random() * 4;
      const height = (Math.random() - 0.5) * 3;

      positions[i * 3] = Math.cos(angle) * radius;
      positions[i * 3 + 1] = height;
      positions[i * 3 + 2] = Math.sin(angle) * radius;

      // Медленное вращение и подъем
      velocities[i * 3] = (Math.random() - 0.5) * 0.02;
      velocities[i * 3 + 1] = 0.01 + Math.random() * 0.03;
      velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.02;

      // Размер углей
      sizes[i] = 0.08 + Math.random() * 0.15;

      // Огненные цвета (оранжевый/красный)
      if (Math.random() < 0.6) {
        colors[i * 3] = 1.0;
        colors[i * 3 + 1] = 0.4 + Math.random() * 0.3;
        colors[i * 3 + 2] = 0.1;
      } else {
        colors[i * 3] = 1.0;
        colors[i * 3 + 1] = 0.2;
        colors[i * 3 + 2] = 0.05;
      }
    }

    const emberGeometry = new THREE.BufferGeometry();
    emberGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    emberGeometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    emberGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const emberMaterial = new THREE.PointsMaterial({
      size: 0.12,
      vertexColors: true,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
      map: this._createGlowTexture()
    });

    this.embers = new THREE.Points(emberGeometry, emberMaterial);
    this.emberVelocities = velocities;
    this.scene.add(this.embers);
  }

  // Создаем текстуру свечения для углей
  _createGlowTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext('2d');
    
    const gradient = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
    gradient.addColorStop(0.2, 'rgba(255, 200, 100, 0.8)');
    gradient.addColorStop(0.5, 'rgba(255, 100, 50, 0.5)');
    gradient.addColorStop(1, 'rgba(255, 50, 0, 0)');
    
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 32, 32);
    
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
  }

  _buildWheel() {
    this.root = new THREE.Group();
    this.scene.add(this.root);

    const R = this.outerRadius;
    const r = this.innerRadius;
    const h = this.bodyHeight;

    // Корпус колеса
    const shellProfile = [
      new THREE.Vector2(r - 0.45, -h * 0.92),
      new THREE.Vector2(r + 0.04, -h * 0.98),
      new THREE.Vector2(R - 0.95, -h * 0.94),
      new THREE.Vector2(R - 0.6, -h * 0.68),
      new THREE.Vector2(R - 0.18, -h * 0.32),
      new THREE.Vector2(R + 0.18, -h * 0.06),
      new THREE.Vector2(R + 0.28, 0),
      new THREE.Vector2(R + 0.18, h * 0.06),
      new THREE.Vector2(R - 0.18, h * 0.32),
      new THREE.Vector2(R - 0.6, h * 0.68),
      new THREE.Vector2(R - 0.95, h * 0.94),
      new THREE.Vector2(r + 0.04, h * 0.98),
      new THREE.Vector2(r - 0.45, h * 0.92),
      new THREE.Vector2(r - 0.58, 0)
    ];

    // 🎨 PBR-материал для корпуса с улучшенной реалистичностью
    const shellMaterial = new THREE.MeshStandardMaterial({ 
      color: 0x3a0d0d,
      metalness: 0.9,      // Усилен металл
      roughness: 0.35,     // Снижена шероховатость
      emissive: 0x1a0303,  // Усилено свечение
      emissiveIntensity: 0.4,
      envMapIntensity: 1.5 // Отражения окружения
    });
    
    const shell = new THREE.Mesh(
      new THREE.LatheGeometry(shellProfile, 240),
      shellMaterial
    );
    shell.rotation.x = Math.PI / 2;
    shell.castShadow = true;
    shell.receiveShadow = true;
    this.root.add(shell);

    // Декоративные элементы (lip удалён - медное кольцо)
    // const lip = new THREE.Mesh(
    //   new THREE.TorusGeometry(R - 0.22, 0.12, 48, 200),
    //   new THREE.MeshStandardMaterial({ color: 0xffc99d, metalness: 0.85, roughness: 0.18, emissive: 0x3f1102 })
    // );
    // lip.rotation.x = Math.PI / 2;
    // lip.position.z = h * 0.58;
    // lip.castShadow = true;
    // this.root.add(lip);

    const facePlate = new THREE.Mesh(
      new THREE.CircleGeometry(R - 0.48, 180),
      new THREE.MeshStandardMaterial({ color: 0x190303, metalness: 0.38, roughness: 0.78, emissive: 0x050000 })
    );
    facePlate.position.z = h * 0.42;
    facePlate.receiveShadow = true;
    this.root.add(facePlate);

    const brassRing = new THREE.Mesh(
      new THREE.RingGeometry(r - 0.08, r + 0.32, 180),
      new THREE.MeshStandardMaterial({ 
        color: 0xffbb77,       // Золотистый
        metalness: 0.85,       // Металлический
        roughness: 0.25,       // Полу-глянцевый
        emissive: 0x663311,    // Тёплое свечение
        emissiveIntensity: 0.3, // Легкое свечение
        side: THREE.DoubleSide
      })
    );
    brassRing.position.z = h * 0.45;
    this.root.add(brassRing);

    const hubGem = new THREE.Mesh(
      new THREE.SphereGeometry(r * 0.7, 64, 32),
      new THREE.MeshStandardMaterial({ 
        color: 0x991515,       // Тёмно-красный
        metalness: 0.6,        // Умеренный металл
        roughness: 0.4,        // Матовый камень
        emissive: 0x440000,    // Тёмно-красное свечение
        emissiveIntensity: 0.8, // Внутренний огонь
        envMapIntensity: 2.2   // Отражения HDR
      })
    );
    hubGem.scale.set(1, 1, 0.56);
    hubGem.position.z = h * 0.63;
    hubGem.castShadow = true;
    this.root.add(hubGem);

    // Группы для секторов
    this.segmentGroup = new THREE.Group();
    this.segmentGroup.position.z = h * 0.32;
    this.root.add(this.segmentGroup);

    this.dividerGroup = new THREE.Group();
    this.dividerGroup.position.z = this.segmentGroup.position.z + this.segmentHeight / 2 + 0.12;
    this.root.add(this.dividerGroup);

    this.labelGroup = new THREE.Group();
    this.labelGroup.position.z = this.dividerGroup.position.z + 0.48;
    this.root.add(this.labelGroup);

    // Пьедестал
    const pedestal = new THREE.Mesh(
      new THREE.CylinderGeometry(R * 0.58, R * 0.92, 3.2, 64),
      new THREE.MeshStandardMaterial({ color: 0x120101, metalness: 0.26, roughness: 0.94, emissive: 0x030000 })
    );
    pedestal.position.set(0, -R - 1.4, -1.0);
    pedestal.castShadow = true;
    this.scene.add(pedestal);

    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(R * 1.7, 120),
      new THREE.MeshStandardMaterial({ color: 0x080101, metalness: 0.12, roughness: 0.98, emissive: 0x010000 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, -R - 1.9, -1.1);
    floor.receiveShadow = true;
    this.scene.add(floor);

    // Указатель - золотая стрелка
    this.pointerGroup = new THREE.Group();
    this.pointerGroup.position.set(0, R + 0.62, this.dividerGroup.position.z + 0.12);
    this.scene.add(this.pointerGroup);

    const pointerTip = new THREE.Mesh(
      new THREE.ConeGeometry(0.3, 0.72, 32),
      new THREE.MeshStandardMaterial({ 
        color: 0xffcc88,       // Золотистый
        metalness: 0.8,        // Металлический
        roughness: 0.3,        // Полу-глянцевый
        emissive: 0x885533,    // Тёплое свечение
        emissiveIntensity: 0.4 // Легкое свечение
      })
    );
    pointerTip.position.y = -1.2;
    pointerTip.rotation.x = Math.PI;
    pointerTip.castShadow = true;
    this.pointerGroup.add(pointerTip);

    const pointerRod = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.08, 1.5, 16),
      new THREE.MeshStandardMaterial({ 
        color: 0xddaa77,       // Золотисто-коричневый
        metalness: 0.7,        // Металлический
        roughness: 0.35,       // Полу-матовый
        emissive: 0x664422,    // Тёплое свечение
        emissiveIntensity: 0.3 // Легкое свечение
      })
    );
    pointerRod.position.y = -0.4;
    pointerRod.castShadow = true;
    this.pointerGroup.add(pointerRod);

    this.pointerAngle = Math.atan2(this.pointerGroup.position.y, this.pointerGroup.position.x);

    this._setupSwipeHandlers();

    this._rebuildSectors();

    if (!this.isSpinning && this.segmentCount > 0) {
      this.currentPointerIndex = this._indexAtPointer(this.currentAngle);
    }
    
    // 🔥 Создаём визуальные эффекты после построения колеса
    if (this._effectsToInit) {
      this.fireTrail = new this._effectsToInit.FireTrail(this.scene, this.pointerGroup);
      this.lightning = new this._effectsToInit.Lightning(this.scene, this.root);
      this.comet = new this._effectsToInit.Comet(this.scene);
      this.fallingStars = new this._effectsToInit.FallingStars(this.scene);
      delete this._effectsToInit; // Очищаем, больше не нужны
    }
  }

  // 🎬 Эффектная анимация входа колеса
  _playEntranceAnimation() {
    if (!this.root) return;
    
    // Начальное состояние - колесо снизу и невидимо
    this.root.position.y = -15;
    this.root.scale.set(0.3, 0.3, 0.3);
    this.root.rotation.x = Math.PI * 0.3;
    
    if (this.embers) this.embers.visible = false;
    if (this.starDust) this.starDust.visible = false;
    
    // Параметры анимации
    const duration = 2000; // 2 секунды
    const startTime = Date.now();
    
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Плавная кривая easeOutCubic
      const t = 1 - Math.pow(1 - progress, 3);
      
      // Поднятие и масштабирование
      this.root.position.y = -15 + t * 15;
      this.root.scale.set(0.3 + t * 0.7, 0.3 + t * 0.7, 0.3 + t * 0.7);
      
      // Выравнивание вращения
      this.root.rotation.x = Math.PI * 0.3 * (1 - t);
      
      // Небольшое вращение вокруг оси Z для драматизма
      this.root.rotation.z = Math.sin(t * Math.PI * 2) * 0.2 * (1 - t);
      
      // Показываем частицы в середине анимации
      if (progress > 0.5) {
        if (this.embers) this.embers.visible = true;
        if (this.starDust) this.starDust.visible = true;
        if (this.fallingStars) this.fallingStars.active = true;
      }
      
      // Запускаем комету в конце
      if (progress > 0.8 && this.comet && !this._entranceCometFired) {
        this.comet.trigger();
        this._entranceCometFired = true;
      }
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        // Финальное состояние
        this.root.position.y = 0;
        this.root.scale.set(1, 1, 1);
        this.root.rotation.x = 0;
        this.root.rotation.z = 0;
      }
    };
    
    animate();
  }

  _rebuildSectors() {
    this._clearGroup(this.segmentGroup);
    this._clearGroup(this.dividerGroup);
    this._clearGroup(this.labelGroup);

    const N = this.segmentCount;
    if (!N) {
      this.segmentGroup.visible = false;
      this.labelGroup.visible = false;
      this.dividerGroup.visible = false;
      this.pointerGroup.visible = false;
      return;
    }

    this.segmentGroup.visible = true;
    this.labelGroup.visible = true;
    this.dividerGroup.visible = true;
    this.pointerGroup.visible = true;

    this.segmentAngle = TAU / N;
    this.anchorOffset = this.pointerAngle - this.segmentAngle / 2;

    for (let i = 0; i < N; i++) {
      const start = this.anchorOffset + i * this.segmentAngle;
      const end = start + this.segmentAngle;
      const color = SEGMENT_COLORS[i % SEGMENT_COLORS.length];
      
      // Сектор
      const segment = this._createSegmentMesh(start, end, color);
      segment.userData.index = i;
      this.segmentGroup.add(segment);

      // Метка
      const labelText = this.labels[i] || `Вариант ${i + 1}`;
      const label = this._createLabelSprite(labelText);
      const mid = start + this.segmentAngle / 2;
      label.position.set(Math.cos(mid) * (this.labelRadius - 0.1), Math.sin(mid) * (this.labelRadius - 0.1), 0);
      label.userData.baseScale = { x: label.scale.x, y: label.scale.y };
      label.userData.index = i;
      this.labelGroup.add(label);

      // Зубец
      const dividerSize = N <= 3 ? 0.25 : N <= 5 ? 0.2 : 0.15;
      const dividerHeight = N <= 3 ? 0.6 : N <= 5 ? 0.5 : 0.4;
      const divider = this._createDividerMesh(end, dividerSize, dividerHeight);
      divider.userData.index = i;
      divider.userData.angle = end;
      this.dividerGroup.add(divider);
    }
  }

  _createSegmentMesh(start, end, hexColor) {
    const inner = this.innerRadius + 0.38;
    const outer = this.outerRadius - 0.48;

    const shape = new THREE.Shape();
    shape.moveTo(Math.cos(start) * inner, Math.sin(start) * inner);
    shape.absarc(0, 0, outer, start, end, false);
    shape.lineTo(Math.cos(end) * inner, Math.sin(end) * inner);
    shape.absarc(0, 0, inner, end, start, true);
    shape.closePath();

    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth: this.segmentHeight,
      bevelEnabled: true,
      bevelThickness: 0.2,    // Усилен bevel
      bevelSize: 0.15,        // Больше bevel
      bevelSegments: 6,       // Больше сегментов
      curveSegments: 80       // Более плавный
    });
    geometry.translate(0, 0, -this.segmentHeight / 2);

    // 🔥 ЯРКИЕ ЦВЕТА как на скриншоте - матовые, не металлические
    const baseColor = new THREE.Color(hexColor);
    const material = new THREE.MeshStandardMaterial({
      color: baseColor.clone(),
      roughness: 0.65,        // Более матовый (не зеркало)
      metalness: 0.25,        // Менее металлический
      emissive: baseColor.clone().multiplyScalar(0.15), // Легкое свечение
      emissiveIntensity: 0.6, // Умеренное свечение
      side: THREE.DoubleSide
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.baseColor = baseColor;
    mesh.userData.baseEmissive = material.emissive.clone();

    return mesh;
  }

  _createDividerMesh(angle, size = 0.15, height = 0.4) {
    // 🔥 ЗОЛОТЫЕ ЗУБЦЫ как на скриншоте
    const cone = new THREE.Mesh(
      new THREE.ConeGeometry(size, height * 1.1, 12), // Плавные конусы
      new THREE.MeshStandardMaterial({
        color: 0xffcc88,      // Золотистый
        metalness: 0.75,      // Металлический
        roughness: 0.35,      // Полу-глянцевый
        emissive: 0xbb6633,   // Тёплое свечение
        emissiveIntensity: 0.4, // Легкое свечение
        envMapIntensity: 2.5  // Сильные отражения
      })
    );
    
    const r = this.outerRadius - 0.3;
    cone.position.set(Math.cos(angle) * r, Math.sin(angle) * r, 0);
    cone.lookAt(0, 0, 0);
    cone.castShadow = true;
    
    return cone;
  }

  _createLabelSprite(text) {
    // Обрезаем текст до 9 символов + многоточие
    const maxLength = 9;
    if (text.length > maxLength) {
      text = text.substring(0, maxLength) + '...';
    }
    
    const size = 1024;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d', { alpha: true });
    
    const fontSize = 170; // Размер шрифта
    ctx.font = `bold ${fontSize}px Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    const centerX = size / 2;
    const centerY = size / 2;
    
    // Обводка
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = fontSize / 8;
    ctx.strokeText(text, centerX, centerY);
    
    ctx.strokeStyle = '#ff4422';
    ctx.lineWidth = fontSize / 12;
    ctx.strokeText(text, centerX, centerY);
    
    // Текст
    ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
    ctx.shadowBlur = fontSize / 10;
    ctx.shadowOffsetX = fontSize / 30;
    ctx.shadowOffsetY = fontSize / 30;
    
    ctx.fillStyle = '#ffffff';
    ctx.fillText(text, centerX, centerY);

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = false;
    texture.needsUpdate = true;
    
    const material = new THREE.SpriteMaterial({ 
      map: texture, 
      transparent: true, 
      depthTest: false, 
      depthWrite: false, 
      opacity: 1.0
    });
    
    const sprite = new THREE.Sprite(material);
    const baseScale = this.segmentCount <= 8 ? 2.2 : 
                     this.segmentCount <= 12 ? 1.8 : 
                     this.segmentCount <= 16 ? 1.5 : 1.3;
    
    sprite.scale.set(baseScale, baseScale * 0.5, 1);
    
    return sprite;
  }

  _clearGroup(group) {
    if (!group) return;
    while (group.children.length) {
      const child = group.children.pop();
      group.remove(child);
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        if (child.material.map) child.material.map.dispose();
        child.material.dispose();
      }
    }
  }

  _createVictoryModal() {
    // Создаём структуру модального окна
    const modal = document.createElement('div');
    modal.className = 'victory-modal';
    modal.innerHTML = `
      <div class="victory-modal-backdrop"></div>
      <div class="victory-modal-content">
        <div class="victory-modal-decorations"></div>
        <div class="victory-modal-flame"></div>
        <h2 class="victory-modal-title">Вердикт Преисподней</h2>
        <div class="victory-modal-result" id="modalResult">—</div>
        <p class="victory-modal-phrase" id="modalPhrase">—</p>
        <div class="victory-modal-buttons">
          <button class="victory-modal-reject" id="modalReject">Отвергнуть приговор</button>
          <button class="victory-modal-close" id="modalClose">Принять судьбу</button>
        </div>
        <div class="victory-modal-hint">Нажмите ENTER или ESC</div>
      </div>
    `;
    
    document.body.appendChild(modal);
    this.victoryModal = modal;
    this.fateTemptationEnabled = false; // Флаг для режима "Искушение судьбой"
    this.canRejectFate = false; // Можно ли отвергнуть приговор
    this.isReSpin = false; // Является ли текущее вращение перекрутом
    this.pendingEliminationLabel = null; // Временное хранение результата для удаления после принятия
    
    // Обработчик закрытия
    const closeBtn = modal.querySelector('#modalClose');
    const rejectBtn = modal.querySelector('#modalReject');
    const backdrop = modal.querySelector('.victory-modal-backdrop');
    
    const closeModal = () => {
      modal.classList.remove('active');
      this.canRejectFate = false; // Сбрасываем флаг
      
      // ТЕПЕРЬ удаляем сектор если режим исключения включен
      if (this.pendingEliminationLabel && this.ui) {
        this.ui.eliminateSector(this.pendingEliminationLabel);
        this.pendingEliminationLabel = null;
      }
      
      // Дополнительно очищаем эффекты через секунду после закрытия
      setTimeout(() => {
        this._clearVictoryEffects();
      }, 1000);
    };
    
    const rejectFate = () => {
      if (!this.canRejectFate) return;
      
      modal.classList.remove('active');
      this.canRejectFate = false; // Больше нельзя отвергнуть
      
      // НЕ удаляем сектор при перекрутке!
      this.pendingEliminationLabel = null;
      
      // Очищаем эффекты
      setTimeout(() => {
        this._clearVictoryEffects();
      }, 300);
      
      // Блокируем UI перед перекруткой
      if (this.ui && this.ui.setSpinning) {
        this.ui.setSpinning(true);
      }
      
      // Разблокируем чекбокс fate перед перекруткой
      if (this.ui && this.ui.unlockFateCheckbox) {
        this.ui.unlockFateCheckbox();
      }
      
      // Помечаем что следующее вращение - перекрутка
      this.isReSpin = true;
      
      // Запускаем колесо ещё раз через небольшую задержку
      setTimeout(() => {
        this.spin();
      }, 600);
    };
    
    closeBtn.addEventListener('click', closeModal);
    rejectBtn.addEventListener('click', rejectFate);
    backdrop.addEventListener('click', closeModal);
    
    // Обработчик клавиатуры для модального окна
    const handleModalKeydown = (e) => {
      // Если модальное окно не активно, игнорируем
      if (!modal.classList.contains('active')) return;
      
      if (e.key === 'Enter') {
        e.preventDefault();
        // Если кнопка "Отвергнуть приговор" видна и доступна, нажимаем её
        if (rejectBtn.style.display !== 'none' && this.canRejectFate) {
          rejectFate();
        } else {
          // Иначе закрываем модальное окно
          closeModal();
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        closeModal();
      }
    };
    
    window.addEventListener('keydown', handleModalKeydown);
  }
  
  setFateTemptation(enabled) {
    this.fateTemptationEnabled = enabled;
  }
  
  setUI(ui) {
    this.ui = ui;
  }
  

  _showVictoryModal(label) {
    if (!this.victoryModal) return;
    
    // Выбираем случайную фразу
    const randomPhrase = this.hellPhrases[Math.floor(Math.random() * this.hellPhrases.length)];
    
    // Обновляем содержимое
    const resultEl = this.victoryModal.querySelector('#modalResult');
    const phraseEl = this.victoryModal.querySelector('#modalPhrase');
    const rejectBtn = this.victoryModal.querySelector('#modalReject');
    const closeBtn = this.victoryModal.querySelector('#modalClose');
    
    resultEl.textContent = label;
    phraseEl.textContent = randomPhrase;
    
    // Управляем видимостью кнопки "Отвергнуть приговор"
    if (this.fateTemptationEnabled && this.canRejectFate) {
      rejectBtn.style.display = 'inline-block';
      
      // Меняем текст кнопки "Принять" в зависимости от режима исключения
      const isEliminationMode = this.ui && this.ui.eliminationMode;
      if (isEliminationMode) {
        closeBtn.textContent = '✓ Принять и удалить';
        closeBtn.title = 'Сектор будет удалён из списка';
      } else {
        closeBtn.textContent = 'Принять судьбу';
        closeBtn.title = '';
      }
    } else {
      rejectBtn.style.display = 'none';
      closeBtn.textContent = 'Принять судьбу';
      closeBtn.title = '';
    }
    
    // Показываем модальное окно СРАЗУ БЕЗ ЗАДЕРЖКИ для быстрого старта
    this.victoryModal.classList.add('active');
  }

  _highlightSector(index) {
    if (!this.segmentGroup || index < 0 || index >= this.segmentCount) return;
    
    this.segmentGroup.children.forEach((child, idx) => {
      const mat = child.material;
      if (!mat) return;
      const baseColor = child.userData?.baseColor;
      const baseEmissive = child.userData?.baseEmissive;
      
      if (idx === index) {
        mat.color = new THREE.Color(0xff9a62);
        mat.emissive = new THREE.Color(0xff6a42);
        mat.emissiveIntensity = 0.8;
      } else {
        if (baseColor) mat.color.copy(baseColor).multiplyScalar(0.5);
        if (baseEmissive) mat.emissive.copy(baseEmissive).multiplyScalar(0.3);
      }
    });
    
    this.labelGroup?.children.forEach((sprite, idx) => {
      if (!(sprite instanceof THREE.Sprite)) return;
      const mat = sprite.material;
      const base = sprite.userData?.baseScale;
      
      if (idx === index) {
        if (mat) mat.opacity = 1;
        if (base) sprite.scale.set(base.x * 1.3, base.y * 1.3, 1);
      } else {
        if (mat) mat.opacity = 0.4;
        if (base) sprite.scale.set(base.x * 0.8, base.y * 0.8, 1);
      }
    });
    
    // Запускаем эффекты победы
    this._createVictoryEffects(index);
    
    // Пульсация
    let pulseCount = 0;
    const pulseInterval = setInterval(() => {
      pulseCount++;
      if (pulseCount > 6) {
        clearInterval(pulseInterval);
        return;
      }
      
      const sector = this.segmentGroup.children[index];
      if (sector?.material) {
        sector.material.emissiveIntensity = pulseCount % 2 === 0 ? 0.8 : 0.4;
      }
    }, 200);
  }

  _createVictoryEffects(index) {
    // 1. Огненное кольцо вокруг колеса
    const ringGeometry = new THREE.TorusGeometry(this.outerRadius + 0.5, 0.2, 16, 100);
    const ringMaterial = new THREE.MeshStandardMaterial({
      color: 0xff4400,
      emissive: 0xff6600,
      emissiveIntensity: 2,
      transparent: true,
      opacity: 0
    });
    this.fireRing = new THREE.Mesh(ringGeometry, ringMaterial);
    this.fireRing.rotation.x = Math.PI / 2;
    this.fireRing.position.z = this.segmentHeight;
    this.scene.add(this.fireRing);
    
    // Анимация появления кольца
    const ringAnimation = setInterval(() => {
      if (this.fireRing.material.opacity < 0.8) {
        this.fireRing.material.opacity += 0.05;
        this.fireRing.scale.set(
          1 + Math.sin(Date.now() * 0.01) * 0.05,
          1 + Math.sin(Date.now() * 0.01) * 0.05,
          1
        );
      } else {
        clearInterval(ringAnimation);
      }
    }, 30);
    
    // 2. Взрыв частиц
    const particleCount = 100;
    const explosionGeometry = new THREE.BufferGeometry();
    const explosionPositions = new Float32Array(particleCount * 3);
    const explosionVelocities = [];
    
    const sectorAngle = this.anchorOffset + index * this.segmentAngle + this.segmentAngle / 2;
    const centerX = Math.cos(sectorAngle) * this.labelRadius;
    const centerY = Math.sin(sectorAngle) * this.labelRadius;
    
    for (let i = 0; i < particleCount; i++) {
      explosionPositions[i * 3] = centerX;
      explosionPositions[i * 3 + 1] = centerY;
      explosionPositions[i * 3 + 2] = this.segmentHeight;
      
      const angle = Math.random() * TAU;
      const speed = 0.1 + Math.random() * 0.3;
      explosionVelocities.push({
        x: Math.cos(angle) * speed,
        y: Math.sin(angle) * speed,
        z: Math.random() * 0.2
      });
    }
    
    explosionGeometry.setAttribute('position', new THREE.BufferAttribute(explosionPositions, 3));
    
    const explosionMaterial = new THREE.PointsMaterial({
      color: 0xff6600,
      size: 0.3,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      opacity: 1
    });
    
    const explosion = new THREE.Points(explosionGeometry, explosionMaterial);
    this.root.add(explosion);
    this.victoryEffects.push({ mesh: explosion, velocities: explosionVelocities, life: 1.0 });
    
    // 3. Световые лучи
    const rayCount = 8;
    for (let i = 0; i < rayCount; i++) {
      const rayAngle = sectorAngle + (TAU / rayCount) * i;
      const rayGeometry = new THREE.PlaneGeometry(0.1, 8);
      const rayMaterial = new THREE.MeshBasicMaterial({
        color: 0xffaa44,
        transparent: true,
        opacity: 0.6,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending
      });
      
      const ray = new THREE.Mesh(rayGeometry, rayMaterial);
      ray.position.set(
        Math.cos(rayAngle) * (this.outerRadius * 0.7),
        Math.sin(rayAngle) * (this.outerRadius * 0.7),
        this.segmentHeight + 0.5
      );
      ray.rotation.z = rayAngle + Math.PI / 2;
      
      this.root.add(ray);
      this.victoryEffects.push({ 
        mesh: ray, 
        type: 'ray',
        baseOpacity: 0.6,
        angle: rayAngle 
      });
    }
    
    // 4. Увеличение bloom эффекта временно
    const originalBloom = this.bloomPass.strength;
    this.bloomPass.strength = 1.5;
    setTimeout(() => {
      this.bloomPass.strength = originalBloom;
    }, 2000);
    
    // 5. Вспышка на экране
    this._createScreenFlash();
    
    // 6. Дрожание камеры
    this._shakeCamera();
  }
  
  _createScreenFlash() {
    const flash = document.createElement('div');
    flash.style.position = 'fixed';
    flash.style.top = '0';
    flash.style.left = '0';
    flash.style.width = '100%';
    flash.style.height = '100%';
    flash.style.background = 'radial-gradient(circle, rgba(255,200,100,0.4), rgba(255,100,0,0.2), transparent 70%)';
    flash.style.pointerEvents = 'none';
    flash.style.zIndex = '9999';
    flash.style.opacity = '0';
    flash.style.mixBlendMode = 'screen';
    document.body.appendChild(flash);
    
    // Анимация вспышки
    flash.style.transition = 'opacity 0.2s ease-in';
    setTimeout(() => flash.style.opacity = '1', 10);
    setTimeout(() => {
      flash.style.transition = 'opacity 0.8s ease-out';
      flash.style.opacity = '0';
    }, 200);
    setTimeout(() => document.body.removeChild(flash), 1200);
  }
  
  _shakeCamera() {
    const originalPosition = this.camera.position.clone();
    const shakeIntensity = 0.2;
    const shakeDuration = 800;
    const startTime = Date.now();
    
    const shake = () => {
      const elapsed = Date.now() - startTime;
      if (elapsed < shakeDuration) {
        const progress = 1 - (elapsed / shakeDuration);
        this.camera.position.x = originalPosition.x + (Math.random() - 0.5) * shakeIntensity * progress;
        this.camera.position.y = originalPosition.y + (Math.random() - 0.5) * shakeIntensity * progress;
        requestAnimationFrame(shake);
      } else {
        this.camera.position.copy(originalPosition);
      }
    };
    shake();
  }
  
  _clearVictoryEffects() {
    // Удаляем огненное кольцо
    if (this.fireRing) {
      this.scene.remove(this.fireRing);
      if (this.fireRing.geometry) this.fireRing.geometry.dispose();
      if (this.fireRing.material) this.fireRing.material.dispose();
      this.fireRing = null;
    }
    
    // Удаляем все эффекты победы
    this.victoryEffects.forEach(effect => {
      if (effect.mesh.parent) {
        effect.mesh.parent.remove(effect.mesh);
      }
      if (effect.mesh.geometry) effect.mesh.geometry.dispose();
      if (effect.mesh.material) effect.mesh.material.dispose();
    });
    this.victoryEffects = [];
  }
  
  _updateVictoryEffects(dt) {
    // Анимация огненного кольца
    if (this.fireRing) {
      this.fireRing.rotation.z += dt * 0.5;
      this.fireRing.material.emissiveIntensity = 2 + Math.sin(Date.now() * 0.005) * 0.5;
    }
    
    // Обновление эффектов
    this.victoryEffects = this.victoryEffects.filter(effect => {
      if (effect.type === 'ray') {
        // Анимация лучей
        effect.mesh.material.opacity = effect.baseOpacity * (0.5 + Math.sin(Date.now() * 0.01) * 0.5);
        effect.mesh.scale.y = 1 + Math.sin(Date.now() * 0.005) * 0.2;
        return true;
      } else if (effect.velocities) {
        // Анимация взрыва частиц
        const positions = effect.mesh.geometry.attributes.position.array;
        effect.velocities.forEach((vel, i) => {
          positions[i * 3] += vel.x * dt * 60;
          positions[i * 3 + 1] += vel.y * dt * 60;
          positions[i * 3 + 2] += vel.z * dt * 60;
        });
        effect.mesh.geometry.attributes.position.needsUpdate = true;
        
        effect.life -= dt;
        effect.mesh.material.opacity = Math.max(0, effect.life);
        
        if (effect.life <= 0) {
          effect.mesh.parent.remove(effect.mesh);
          if (effect.mesh.geometry) effect.mesh.geometry.dispose();
          if (effect.mesh.material) effect.mesh.material.dispose();
          return false;
        }
      }
      return true;
    });
  }

  _triggerPointerHit(velocity) {
    if (!this.onHit) return;
    const intensity = Math.min(1, Math.abs(velocity) / 12);
    this.onHit(intensity);
  }



  _pickRandomIndex() {
    if (!this.segmentCount) return 0;
    return this._randomInt(0, this.segmentCount);
  }

  _angleForIndex(index) {
    if (!this.segmentCount) return 0;
    const total = this.segmentCount;
    const clamped = ((index % total) + total) % total;
    const centerOffset = this.pointerAngle - this.anchorOffset - (clamped + 0.5) * this.segmentAngle;
    return this._normalizePositive(centerOffset);
  }

  _sectorCenterAngle(index, rotationOffset = 0) {
    return this.anchorOffset + (index + 0.5) * this.segmentAngle + rotationOffset;
  }

  _angularDifference(a, b) {
    const diff = ((a - b + Math.PI) % TAU + TAU) % TAU - Math.PI;
    return diff;
  }

  _indexAtPointer(rotationAngle) {
    if (!this.segmentCount) return 0;
    const pointerWorldAngle = this.pointerAngle;
    let closestIndex = 0;
    let smallest = Infinity;
    for (let i = 0; i < this.segmentCount; i++) {
      const center = this._sectorCenterAngle(i, rotationAngle);
      const diff = Math.abs(this._angularDifference(center, pointerWorldAngle));
      if (diff < smallest) {
        smallest = diff;
        closestIndex = i;
      }
    }
    return closestIndex;
  }

  _indexFromAngle(angle) {
    if (!this.segmentCount) return 0;
    const pointerAngle = Math.PI / 2;
    const normalized = ((pointerAngle - angle - this.anchorOffset) % TAU + TAU) % TAU;
    return Math.floor(normalized / this.segmentAngle) % this.segmentCount;
  }

  _bouncePointer() {
    if (!this.pointerGroup) return;
    if (this.pointerTimeout) clearTimeout(this.pointerTimeout);
    
    const velocity = Math.abs(this.physics.vel);
    const direction = this.physics.vel > 0 ? -1 : 1;
    
    let bounceAngle = 0.15;
    let bounceTime = 120;
    
    if (velocity > 5) {
      bounceAngle = 0.25;
      bounceTime = 80;
    } else if (velocity > 2) {
      bounceAngle = 0.20;
      bounceTime = 100;
    }
    
    this.pointerGroup.rotation.z = bounceAngle * direction;
    
    this.pointerTimeout = setTimeout(() => {
      this.pointerGroup.rotation.z = -bounceAngle * direction * 0.3;
      setTimeout(() => {
        this.pointerGroup.rotation.z = 0;
      }, bounceTime / 2);
    }, bounceTime);
  }

  // ✅ ИНЕРЦИЯ УКАЗАТЕЛЯ - стрелка отстаёт от колеса на высоких скоростях
  _updatePointerInertia(dt) {
    if (!this.pointerGroup || !this.isSpinning) return;
    
    const velocity = this.physics.vel;
    
    // Целевое вращение указателя зависит от скорости колеса
    const targetRotation = -velocity * 0.06; // Отставание пропорционально скорости
    
    // Плавное приближение к целевому значению (easing)
    this.pointerInertia += (targetRotation - this.pointerInertia) * 0.12;
    
    // Применяем инерцию к указателю (НЕ перезаписываем bounce!)
    if (!this.pointerTimeout) {
      this.pointerGroup.rotation.z = this.pointerInertia;
    }
  }

  // ✅ СОЗДАНИЕ ИСКР при ударе о зубец
  _createSparks(position, intensity = 1) {
    if (!this.scene) return;
    
    const sparkCount = Math.floor(8 + intensity * 12); // 8-20 искр
    
    for (let i = 0; i < sparkCount; i++) {
      const geometry = new THREE.SphereGeometry(0.08, 4, 4);
      const material = new THREE.MeshBasicMaterial({
        color: new THREE.Color(1, 0.5 + Math.random() * 0.3, 0), // Оранжевые оттенки
        transparent: true,
        opacity: 1
      });
      
      const spark = new THREE.Mesh(geometry, material);
      spark.position.copy(position);
      
      // Случайное направление вылета
      const angle = Math.random() * Math.PI * 2;
      const speed = (0.3 + Math.random() * 0.6) * intensity;
      const upwardBias = 0.2 + Math.random() * 0.3; // Искры летят больше вверх
      
      const velocity = new THREE.Vector3(
        Math.cos(angle) * speed,
        upwardBias * speed,
        Math.sin(angle) * speed
      );
      
      this.scene.add(spark);
      
      this.sparkParticles.push({
        mesh: spark,
        velocity: velocity,
        life: 0.6 + Math.random() * 0.4, // 0.6-1.0 секунд жизни
        maxLife: 0.6 + Math.random() * 0.4,
        gravity: -1.5 // Гравитация
      });
    }
  }

  // ✅ ОБНОВЛЕНИЕ ИСКР
  _updateSparks(dt) {
    this.sparkParticles = this.sparkParticles.filter(spark => {
      // Физика частицы
      spark.velocity.y += spark.gravity * dt;
      spark.mesh.position.x += spark.velocity.x * dt * 60;
      spark.mesh.position.y += spark.velocity.y * dt * 60;
      spark.mesh.position.z += spark.velocity.z * dt * 60;
      
      // Уменьшение времени жизни
      spark.life -= dt;
      
      // Затухание по мере старения
      const ageRatio = spark.life / spark.maxLife;
      spark.mesh.material.opacity = Math.max(0, ageRatio);
      spark.mesh.scale.setScalar(0.5 + ageRatio * 0.5); // Уменьшаются
      
      // Удаление мёртвых искр
      if (spark.life <= 0) {
        this.scene.remove(spark.mesh);
        spark.mesh.geometry.dispose();
        spark.mesh.material.dispose();
        return false;
      }
      
      return true;
    });
  }



  _computeSpinDelta(currentAngle, targetAngle, direction, strength = 1) {
    const forward = this._normalizePositive(targetAngle - currentAngle) || TAU;
    const backward = this._normalizePositive(currentAngle - targetAngle) || TAU;
    const minimal = direction >= 0 ? forward : -backward;
    const baseTurns = this._randomRange(3.4, 5.6);
    const strengthFactor = 0.85 + Math.min(1.5, Math.max(0.4, strength)) * 0.3;
    const extraTurns = baseTurns * strengthFactor;
    return minimal + direction * extraTurns * TAU;
  }

  _normalizePositive(value) {
    return ((value % TAU) + TAU) % TAU;
  }

  _randomSign() {
    return this._randomFloat() < 0.5 ? -1 : 1;
  }

  _randomRange(min, max) {
    return min + (max - min) * this._randomFloat();
  }

  _randomInt(min, max) {
    if (max <= min) return min;
    const span = max - min;
    if (typeof crypto !== "undefined" && crypto.getRandomValues) {
      crypto.getRandomValues(this._randBuffer);
      return min + (this._randBuffer[0] % span);
    }
    return min + Math.floor(Math.random() * span);
  }

  // ✅ УЛУЧШЕННЫЙ КРИПТОСТОЙКИЙ ГЕНЕРАТОР
  _randomFloat() {
    if (typeof crypto !== "undefined" && crypto.getRandomValues) {
      // Используем 4 байта для максимальной энтропии
      const buffer = new Uint8Array(4);
      crypto.getRandomValues(buffer);
      // Комбинируем 4 байта в одно 32-битное число
      const num = (buffer[0] << 24) | (buffer[1] << 16) | (buffer[2] << 8) | buffer[3];
      return num / 0xFFFFFFFF; // Делим на максимум для получения [0, 1)
    }
    return Math.random();
  }

  _shuffleArray(array) {
    // Алгоритм Фишера-Йетса для перемешивания массива
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = this._randomInt(0, i + 1);
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }


  _animate() {
    const clock = new THREE.Clock();
    const animate = () => {
      const dt = Math.min(0.033, clock.getDelta());
      this._updatePhysics(dt);
      this._updateParticles(dt);
      this._updateEmbers(dt);    // 🔥 Анимация углей
      this._updateStarDust(dt);  // ✨ Вращение звёзд
      this._updateVictoryEffects(dt);
      this._updatePointerInertia(dt); // ✅ Обновление инерции указателя
      
      // 🔥 Обновление визуальных эффектов
      if (this.fireTrail) this.fireTrail.update(dt, Math.abs(this.physics.vel));
      if (this.lightning) this.lightning.update(dt, Math.abs(this.physics.vel));
      if (this.comet) this.comet.update(dt);
      if (this.fallingStars) this.fallingStars.update(dt);
      
      // 🌪️ Звук ветра при высокой скорости (каждые 0.2 секунды)
      if (this.isSpinning && this.audioBus && Math.abs(this.physics.vel) > 3) {
        if (!this._lastWindTime || Date.now() - this._lastWindTime > 200) {
          this.audioBus.playWind(Math.abs(this.physics.vel));
          this._lastWindTime = Date.now();
        }
      }
      
      // 🌀 СЛУЧАЙНЫЕ ЭФФЕКТЫ в режиме хаоса
      if (this.chaosMode && this.isSpinning && this.audioBus) {
        if (!this._lastChaosEffect || Date.now() - this._lastChaosEffect > 800) {
          if (Math.random() < 0.3) {
            // Случайный визуальный глитч
            const glitchType = ['boost', 'brake', 'reverse', 'pause'][Math.floor(Math.random() * 4)];
            this._chaosFlash(glitchType);
          }
          if (Math.random() < 0.2) {
            // Случайная мини-тряска
            this._screenShake();
          }
          this._lastChaosEffect = Date.now();
        }
      }
      
      // Искры убраны для оптимизации
      this.composer.render();
      requestAnimationFrame(animate);
    };
    animate();
  }

  _updateParticles(dt) {
    if (!this.particles) return;

    const positions = this.particles.geometry.attributes.position.array;
    const velocities = this.particleVelocities;

    for (let i = 0; i < positions.length / 3; i++) {
      positions[i * 3] += velocities[i * 3] * dt * 60;
      positions[i * 3 + 1] += velocities[i * 3 + 1] * dt * 60;
      positions[i * 3 + 2] += velocities[i * 3 + 2] * dt * 60;

      if (positions[i * 3 + 1] < -2) {
        positions[i * 3 + 1] = 15; // Reset to top
      }
    }

    this.particles.geometry.attributes.position.needsUpdate = true;
  }

  // 🔥 Анимация тлеющих углей
  _updateEmbers(dt) {
    if (!this.embers) return;

    const positions = this.embers.geometry.attributes.position.array;
    const velocities = this.emberVelocities;
    const sizes = this.embers.geometry.attributes.size.array;

    for (let i = 0; i < positions.length / 3; i++) {
      // Движение углей
      positions[i * 3] += velocities[i * 3] * dt * 60;
      positions[i * 3 + 1] += velocities[i * 3 + 1] * dt * 60;
      positions[i * 3 + 2] += velocities[i * 3 + 2] * dt * 60;

      // Мерцание размера
      sizes[i] *= 1 + Math.sin(Date.now() * 0.003 + i) * 0.02;

      // Сброс высоко поднявшихся углей
      if (positions[i * 3 + 1] > 5) {
        const angle = Math.random() * Math.PI * 2;
        const radius = 3 + Math.random() * 4;
        positions[i * 3] = Math.cos(angle) * radius;
        positions[i * 3 + 1] = -2;
        positions[i * 3 + 2] = Math.sin(angle) * radius;
      }
    }

    this.embers.geometry.attributes.position.needsUpdate = true;
    this.embers.geometry.attributes.size.needsUpdate = true;
  }

  // ✨ Медленное вращение звёздной пыли
  _updateStarDust(dt) {
    if (!this.starDust) return;
    this.starDust.rotation.y += dt * 0.02;
    this.starDust.rotation.x += dt * 0.005;
  }

  _updatePhysics(dt) {
    const count = this.segmentCount;
    
    // 🌀 ОБРАБОТКА СОБЫТИЙ ХАОСА
    if (this.chaosMode && this.chaosEvents && Array.isArray(this.chaosEvents) && this.chaosEvents.length > 0 && this.isSpinning) {
      if (!this.chaosStartTime) {
        this.chaosStartTime = Date.now();
      }
      
      const elapsed = Date.now() - this.chaosStartTime;
      
      // 🔥 ПРЕДУПРЕЖДЕНИЕ О НАЧАЛЕ ХАОСА на 2.3 секунде
      if (!this.chaosWarningShown && elapsed >= 2300) {
        this.chaosWarningShown = true;
        this._showChaosMessage('🌀 НАЧИНАЕТСЯ ХАОС!!! 🌀', true);
        this._chaosFlash('mega');
        this._screenShake();
        /*
        if (this.audioBus) {
          this.audioBus.speak?.('НАЧИНАЕТСЯ ХАОС!');
        }
        */
        console.log('🌀🌀🌀 ФАЗА РАЗГОНА ЗАВЕРШЕНА - НАЧИНАЕТСЯ ХАОС!!!');
      }
      
      for (const event of this.chaosEvents) {
        if (!event || typeof event !== 'object') continue; // Пропускаем некорректные события
        if (!event.executed && elapsed >= event.delay) {
          event.executed = true;
          
          switch(event.type) {
            case 'boost':
              // Внезапное ускорение
              const currentDir = this.physics.vel > 0 ? 1 : -1;
              this.physics.addImpulse(currentDir * event.strength);
              console.log(`🔥 BOOST +${event.strength.toFixed(1)}`);
              this._chaosFlash('boost');
              if (this.audioBus) {
                this.audioBus.playWhoosh?.();
              }
              break;
              
            case 'brake':
              // Резкое замедление
              this.physics.vel *= event.strength;
              console.log(`🛑 BRAKE x${event.strength.toFixed(2)}`);
              this._chaosFlash('brake');
              break;
              
            case 'reverse':
              // Смена направления
              this.physics.vel = -this.physics.vel * event.strength;
              console.log(`🔄 REVERSE`);
              this._chaosFlash('reverse');
              if (this.audioBus) {
                this.audioBus.playMetalCling?.(0.8);
              }
              break;
              
            case 'pause':
              // Пауза
              this.chaosPauseEnd = Date.now() + event.duration;
              this.chaosPausedVelocity = this.physics.vel;
              this.physics.vel = 0;
              console.log(`⏸️ PAUSE ${event.duration}мс`);
              this._chaosFlash('pause');
              break;
              
            case 'mega-boost':
              // 🔥 ЭКСТРЕМАЛЬНОЕ УСКОРЕНИЕ
              const megaDir = this.physics.vel > 0 ? 1 : -1;
              this.physics.addImpulse(megaDir * event.strength);
              console.log(`💥💥💥 MEGA-BOOST +${event.strength.toFixed(1)}!!!`);
              this._chaosFlash('mega');
              if (this.audioBus) {
                this.audioBus.playMetalCling?.(1.5);
                this.audioBus.playWhoosh?.();
              }
              this._screenShake();
              break;
              
            case 'double-reverse':
              // 💥 ДВОЙНОЙ РЕВЕРС
              this.physics.vel = -this.physics.vel * event.strength;
              console.log(`💥 DOUBLE-REVERSE!`);
              setTimeout(() => {
                if (this.isSpinning) {
                  this.physics.vel = -this.physics.vel * 0.8;
                  console.log(`💥💥 DOUBLE-REVERSE - COMPLETE!!!`);
                  this._chaosFlash('reverse');
                }
              }, 150);
              this._chaosFlash('reverse');
              if (this.audioBus) {
                this.audioBus.playMetalCling?.(1.2);
              }
              break;
              
            case 'hurricane':
              // 🌪️ УРАГАННОЕ ВРАЩЕНИЕ
              const hurricaneDir = this._randomFloat() < 0.5 ? 1 : -1;
              this.physics.addImpulse(hurricaneDir * event.strength);
              console.log(`🌪️🌪️🌪️ HURRICANE ${event.strength.toFixed(1)}!!!`);
              this._chaosFlash('mega');
              this._chaosFlash('boost');
              this._screenShake();
              this._screenShake();
              if (this.audioBus) {
                this.audioBus.playMetalCling?.(2.0);
                this.audioBus.playWind?.(50);
              }
              if ('vibrate' in navigator) {
                navigator.vibrate([100, 50, 100, 50, 200]);
              }
              break;
          }
        }
      }
      
      // Возобновление после паузы
      if (this.chaosPauseEnd && Date.now() >= this.chaosPauseEnd) {
        this.physics.vel = this.chaosPausedVelocity;
        this.chaosPauseEnd = null;
        this.chaosPausedVelocity = 0;
        console.log('🌀 ХАОС: Пауза завершена');
      }
    }
    
    if (count <= 1) {
      this.physics.step(dt);
      this.root.rotation.z = this.physics.angle;
      
      if (Math.abs(this.physics.vel) < 0.01 && this.isSpinning) {
        const label = this.labels.length ? this.labels[0] : "Вариант 1";
        this._highlightSector(0);
        this._showVictoryModal(label);
        
        // Сохраняем результат для отложенного удаления
        this.pendingEliminationLabel = label;
        
        // Сбрасываем режим хаоса
        this.chaosMode = false;
        this.chaosEvents = null;
        this.chaosStartTime = null;
        
        // 🌀 Останавливаем звук хаоса
        if (this.audioBus) {
          this.audioBus.stopChaosSound();
        }
        
        if (this.onResult) this.onResult(label);
        this.isSpinning = false;
        this.activeIndex = 0;
        
        // 🎭 Драматический звук остановки
        if (this.audioBus) {
          this.audioBus.playDramaticStop();
        }
        
        // 🔥 Останавливаем огненный шлейф и запускаем комету
        if (this.fireTrail) {
          this.fireTrail.stop();
        }
        if (this.comet) {
          this.comet.trigger();
        }
      }
      return;
    }
    
    const segmentAngle = TAU / count;
    const prevAngle = this.physics.angle;
    
    this.physics.step(dt);
    
    // Проверка столкновения с зубцами (дефлекторами)
    if (Math.abs(this.physics.vel) > 0.01 && this.physics.toothCooldown <= 0) {
      const currentAngle = this.physics.angle;
      const prevNorm = ((prevAngle % TAU) + TAU) % TAU;
      const currNorm = ((currentAngle % TAU) + TAU) % TAU;
      const pointerPos = Math.PI / 2;
      
      for (let i = 0; i < count; i++) {
        const toothStaticAngle = (this.anchorOffset + (i + 1) * segmentAngle) % TAU;
        const prevToothWorldAngle = (toothStaticAngle + prevNorm) % TAU;
        const currToothWorldAngle = (toothStaticAngle + currNorm) % TAU;
        
        let crossed = false;
        
        if (this.physics.vel > 0) {
          crossed = (prevToothWorldAngle < pointerPos && currToothWorldAngle >= pointerPos);
        } else {
          crossed = (prevToothWorldAngle > pointerPos && currToothWorldAngle <= pointerPos);
        }
        
        if (crossed && this.physics.lastToothHit !== i) {
          const velocity = Math.abs(this.physics.vel);
          const dampingMultiplier = count <= 2 ? 2.5 : count <= 3 ? 2.0 : count <= 5 ? 1.5 : 1.0;
          
          // 🎯 НОВАЯ ФИЗИКА ЗУБЦОВ - Реалистичные дефлекторы
          
          if (velocity > 8) {
            // Высокая скорость - СЛАБОЕ замедление (зубец просто скользит)
            this.physics.vel *= (1 - (0.04 + this._randomFloat() * 0.02) * dampingMultiplier);
            this._bouncePointer();
            if (this.onHit) this.onHit(0.9);
            
          } else if (velocity > 4) {
            // Средняя скорость - УМЕРЕННОЕ замедление
            this.physics.vel *= (1 - (0.08 + this._randomFloat() * 0.04) * dampingMultiplier);
            this._bouncePointer();
            if (this.onHit) this.onHit(0.7);
            
          } else if (velocity > 2) {
            // Низкая скорость - ЗАМЕТНОЕ замедление
            this.physics.vel *= (1 - (0.12 + this._randomFloat() * 0.05) * dampingMultiplier);
            this._bouncePointer();
            if (this.onHit) this.onHit(0.5);
            
          } else if (velocity > 0.8) {
            // Очень низкая скорость - СИЛЬНОЕ замедление
            this.physics.vel *= (1 - (0.18 + this._randomFloat() * 0.08) * dampingMultiplier);
            this._bouncePointer();
            if (this.onHit) this.onHit(0.3);
            
          } else if (velocity > 0.3) {
            // 🎲 ДРАМА НА ФИНИШЕ - малые скорости
            const drama = this._randomFloat();
            
            if (drama < 0.15) {
              // 15% шанс - лёгкий ТОЛЧОК ВПЕРЁД (зубец подталкивает!)
              const pushForce = 0.2 + this._randomFloat() * 0.15;
              this.physics.vel += (this.physics.vel > 0 ? 1 : -1) * pushForce;
              this._bouncePointer();
              if (this.onHit) this.onHit(0.25);
              
            } else if (drama < 0.30) {
              // 15% шанс - ОТСКОК НАЗАД (зубец отбрасывает!)
              const bounceStrength = 0.25 + this._randomFloat() * 0.2;
              this.physics.vel = -this.physics.vel * bounceStrength;
              this._bouncePointer();
              if (this.onHit) this.onHit(0.2);
              
            } else {
              // 70% шанс - обычное ЗАМЕДЛЕНИЕ
              this.physics.vel *= (1 - (0.25 + this._randomFloat() * 0.12) * dampingMultiplier);
              this._bouncePointer();
              if (this.onHit) this.onHit(0.2);
            }
            
          } else {
            // 🔥 КРИТИЧЕСКИ МАЛАЯ СКОРОСТЬ - максимальная драма!
            const criticalDrama = this._randomFloat();
            
            if (criticalDrama < 0.10) {
              // 10% шанс - ЧУДО! Зубец даёт последний импульс
              const miraclePush = 0.3 + this._randomFloat() * 0.2;
              this.physics.vel += (this.physics.vel > 0 ? 1 : -1) * miraclePush;
              if (this.onHit) this.onHit(0.15);
              
            } else if (criticalDrama < 0.25) {
              // 15% шанс - отскок назад на последнем издыхании
              const weakBounce = 0.15 + this._randomFloat() * 0.1;
              this.physics.vel = -this.physics.vel * weakBounce;
              if (this.onHit) this.onHit(0.1);
              
            } else {
              // 75% шанс - просто замедление до почти остановки
              this.physics.vel *= (1 - (0.35 + this._randomFloat() * 0.15) * dampingMultiplier);
              if (this.onHit) this.onHit(0.1);
            }
          }
          
          this.physics.lastToothHit = i;
          this.physics.toothCooldown = 0.08;
          break;
        }
      }
    }
    
    if (this.physics.toothCooldown <= 0) {
      this.physics.lastToothHit = -1;
    }

    this.root.rotation.z = this.physics.angle;

    // Проверка остановки
    if (Math.abs(this.physics.vel) < 0.01 && this.isSpinning) {
      const idx = this._indexFromAngle(this.physics.angle);
      const label = this.labels[idx] || `Вариант ${idx + 1}`;
      
      this._highlightSector(idx);
      this._showVictoryModal(label);
      
      // ✅ ВИБРАЦИЯ на результат
      this._triggerHapticFeedback();
      
      // Сохраняем результат для отложенного удаления
      this.pendingEliminationLabel = label;
      
      if (this.onResult) this.onResult(label);
      this.isSpinning = false;
      this.activeIndex = idx;
      
      // 🌀 Останавливаем звук хаоса при остановке колеса
      if (this.audioBus) {
        this.audioBus.stopChaosSound();
      }
      
      // � Сбрасываем режим хаоса
      this.chaosMode = false;
      this.chaosEvents = null;
      this.chaosStartTime = null;
      this.chaosPauseEnd = null;
      this.chaosPausedVelocity = 0;
      
      // �🎭 Драматический звук остановки
      if (this.audioBus) {
        this.audioBus.playDramaticStop();
      }
      
      // 🔥 Останавливаем огненный шлейф и запускаем комету
      if (this.fireTrail) {
        this.fireTrail.stop();
      }
      if (this.comet) {
        this.comet.trigger();
      }
    }
  }

  // ✅ ОБРАБОТКА СВАЙПОВ для мобильных
  _setupSwipeHandlers() {
    if (!this.container) return;

    this.container.addEventListener('touchstart', (e) => {
      if (this.isSpinning || this.segmentCount < 2) return;
      
      const touch = e.touches[0];
      this.touchStartX = touch.clientX;
      this.touchStartY = touch.clientY;
      this.touchStartTime = Date.now();
    }, { passive: true });

    this.container.addEventListener('touchend', (e) => {
      if (this.isSpinning || this.segmentCount < 2) return;
      
      const touch = e.changedTouches[0];
      const deltaX = touch.clientX - this.touchStartX;
      const deltaY = touch.clientY - this.touchStartY;
      const deltaTime = Date.now() - this.touchStartTime;
      
      // Проверка свайпа (минимум 50px, максимум 500ms)
      if (Math.abs(deltaX) > 50 && deltaTime < 500 && Math.abs(deltaY) < 100) {
        const velocity = Math.abs(deltaX) / deltaTime;
        const strength = Math.min(2, velocity * 2);
        
        // Запуск вращения
        this.spin(strength);
      }
    }, { passive: true });
  }

  // ✅ ВИБРАЦИЯ для мобильных устройств
  _triggerHapticFeedback() {
    if ('vibrate' in navigator) {
      // Паттерн: короткая - пауза - длинная - пауза - короткая
      navigator.vibrate([50, 30, 100, 30, 50]);
    }
  }
  
  // 🔥 ВИЗУАЛЬНАЯ ВСПЫШКА при событии хаоса
  _chaosFlash(type) {
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      pointer-events: none;
      z-index: 9999;
      animation: chaosFlash 0.2s ease-out;
    `;
    
    // Разные цвета для разных типов событий
    const colors = {
      'boost': 'radial-gradient(circle, rgba(255, 100, 0, 0.6) 0%, rgba(255, 50, 0, 0.3) 50%, transparent 100%)',
      'brake': 'radial-gradient(circle, rgba(200, 0, 0, 0.7) 0%, rgba(150, 0, 0, 0.4) 50%, transparent 100%)',
      'reverse': 'radial-gradient(circle, rgba(150, 0, 255, 0.6) 0%, rgba(100, 0, 200, 0.4) 50%, transparent 100%)',
      'pause': 'radial-gradient(circle, rgba(0, 0, 0, 0.8) 0%, rgba(50, 0, 50, 0.5) 50%, transparent 100%)',
      'mega': 'radial-gradient(circle, rgba(255, 255, 255, 0.9) 0%, rgba(255, 200, 0, 0.6) 30%, rgba(255, 0, 0, 0.4) 60%, transparent 100%)'
    };
    
    overlay.style.background = colors[type] || colors['boost'];
    
    // 🔥 Добавляем случайные цветные полосы для большего хаоса
    if (Math.random() < 0.3) {
      const strips = document.createElement('div');
      strips.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        pointer-events: none;
        z-index: 9998;
        background: repeating-linear-gradient(
          ${Math.random() * 180}deg,
          transparent,
          transparent 10px,
          rgba(255, 0, 0, 0.3) 10px,
          rgba(255, 0, 0, 0.3) 20px
        );
        animation: chaosFlash 0.2s ease-out;
      `;
      document.body.appendChild(strips);
      setTimeout(() => strips.remove(), 200);
    }
    
    // Добавляем CSS анимацию если её нет
    if (!document.getElementById('chaos-flash-style')) {
      const style = document.createElement('style');
      style.id = 'chaos-flash-style';
      style.textContent = `
        @keyframes chaosFlash {
          0% { opacity: 1; }
          100% { opacity: 0; }
        }
        @keyframes chaosShake {
          0%, 100% { transform: translate(0, 0) rotate(0deg); }
          10% { transform: translate(-20px, -15px) rotate(-3deg) scale(1.02); }
          20% { transform: translate(15px, 20px) rotate(4deg) scale(0.98); }
          30% { transform: translate(-18px, 12px) rotate(-2deg) scale(1.01); }
          40% { transform: translate(22px, -18px) rotate(3deg) scale(0.99); }
          50% { transform: translate(-15px, 5px) rotate(-4deg) scale(1.02); }
          60% { transform: translate(18px, -8px) rotate(3deg) scale(0.98); }
          70% { transform: translate(-12px, -20px) rotate(-2deg) scale(1.01); }
          80% { transform: translate(10px, 15px) rotate(2deg) scale(0.99); }
          90% { transform: translate(-8px, -5px) rotate(-1deg) scale(1.0); }
        }
      `;
      document.head.appendChild(style);
    }
    
    document.body.appendChild(overlay);
    setTimeout(() => overlay.remove(), 200);
  }
  
  // 🔥 ТРЯСКА ЭКРАНА
  _screenShake() {
    const container = this.container;
    if (!container) return;
    
    const intensity = Math.random() * 0.5 + 0.5; // 0.5-1.0
    container.style.animation = `chaosShake 0.3s ease-in-out ${intensity}`;
    setTimeout(() => {
      container.style.animation = '';
    }, 300);
    
    // 🔥 Случайная инверсия цветов для максимального хаоса
    if (Math.random() < 0.15) {
      document.body.style.filter = 'invert(1) hue-rotate(180deg)';
      setTimeout(() => {
        document.body.style.filter = '';
      }, 100);
    }
  }
  
  // 😈 ДЕМОНИЧЕСКИЕ КОММЕНТАРИИ
  _getChaosComment(type) {
    const comments = {
      'boost': [
        'ДЕМОНЫ УСКОРЯЮТ КОЛЕСО!',
        'ПЛАМЯ АДА ТОЛКАЕТ СУДЬБУ!',
        'АДСКАЯ ЭНЕРГИЯ!',
        'СИЛЫ ТЬМЫ ВМЕШИВАЮТСЯ!',
        'ПРЕИСПОДНЯЯ ДАРУЕТ СКОРОСТЬ!',
        'ИНФЕРНАЛЬНЫЙ ИМПУЛЬС!',
        'БЕСЫ РАСКРУЧИВАЮТ МЕХАНИЗМ!'
      ],
      'brake': [
        'ДЕМОНЫ ЗАМЕДЛЯЮТ ХОД!',
        'ТЁМНЫЕ СИЛЫ ТОРМОЗЯТ!',
        'СУДЬБА СОПРОТИВЛЯЕТСЯ!',
        'ПРОКЛЯТЬЕ ЗАМЕДЛЕНИЯ!',
        'ПРЕГРАДА ИЗ ТЕНЕЙ!',
        'АДСКАЯ ТЯЖЕСТЬ!',
        'ЦЕПИ ПРЕИСПОДНЕЙ!'
      ],
      'reverse': [
        'РЕВЕРС! СМЕНА НАПРАВЛЕНИЯ!',
        'ОБРАТНЫЙ ХОД СУДЬБЫ!',
        'ДЕМОНЫ РАЗВЕРНУЛИ КОЛЕСО!',
        'ВСПЯТЬ, МЕХАНИЗМ АДА!',
        'СИЛЫ ХАОСА МЕНЯЮТ ПУТЬ!',
        'ИНФЕРНАЛЬНЫЙ РАЗВОРОТ!',
        'КОЛЕСО ПОВЕРНУЛО ВСПЯТЬ!'
      ],
      'pause': [
        'ВРЕМЯ ЗАМЕРЛО!',
        'ОСТАНОВКА СУДЬБЫ!',
        'ДЕМОНЫ ЗАМОРОЗИЛИ МИГ!',
        'ЗАТИШЬЕ ПЕРЕД БУРЕЙ!',
        'ПРЕИСПОДНЯЯ РАЗДУМЫВАЕТ!',
        'ПАУЗА ХАОСА!',
        'ТЬМА МЕДЛИТ!'
      ],
      'mega': [
        'МОЩЬ ПРЕИСПОДНЕЙ!!!',
        'АДСКИЙ ВИХРЬ СИЛЫ!!!',
        'ЭКСТРЕМАЛЬНАЯ ЭНЕРГИЯ АДА!!!',
        'ИНФЕРНАЛЬНЫЙ ВЗРЫВ!!!',
        'ДЕМОНИЧЕСКИЙ ИМПУЛЬС!!!',
        'СИЛА ТЫСЯЧИ ДЕМОНОВ!!!',
        'УРАГАН ПРЕИСПОДНЕЙ!!!'
      ],
      'double': [
        'ДВОЙНОЙ РЕВЕРС СУДЬБЫ!',
        'ХАОС РАЗВОРАЧИВАЕТ ДВАЖДЫ!',
        'ДЕМОНЫ ИГРАЮТ С НАПРАВЛЕНИЕМ!',
        'ОБРАТНО И СНОВА ОБРАТНО!',
        'ДВОЙНАЯ СМЕНА ПУТИ!',
        'ИНФЕРНАЛЬНЫЙ ТВИСТ!',
        'СУДЬБА НЕ ОПРЕДЕЛИЛАСЬ!'
      ],
      'hurricane': [
        'УРАГАН ХАОСА!!!',
        'ДЕМОНИЧЕСКИЙ СМЕРЧ!!!',
        'ВИХРЬ ПРЕИСПОДНЕЙ!!!',
        'ТОРНАДО СУДЬБЫ!!!',
        'АДСКИЙ ЦИКЛОН!!!',
        'БУРЯ ПРОКЛЯТИЙ!!!',
        'ВРАЩЕНИЕ БЕЗУМИЯ!!!'
      ]
    };
    
    const list = comments[type] || comments['boost'];
    return list[Math.floor(Math.random() * list.length)];
  }
  
  // 😈 ПОКАЗ СООБЩЕНИЯ НА ЭКРАНЕ
  _showChaosMessage(text, big = false) {
    const msg = document.createElement('div');
    msg.textContent = text;
    msg.style.cssText = `
      position: fixed;
      top: ${big ? '25%' : '15%'};
      left: 50%;
      transform: translateX(-50%);
      font-family: 'Cinzel', serif;
      font-size: ${big ? '52px' : '36px'};
      font-weight: 700;
      color: #ff3300;
      text-shadow: 
        0 0 20px rgba(255, 0, 0, 0.9),
        0 0 40px rgba(255, 100, 0, 0.7),
        0 0 60px rgba(255, 0, 0, 0.5),
        3px 3px 10px rgba(0, 0, 0, 0.9);
      pointer-events: none;
      z-index: 10000;
      animation: chaosMessage 2s ease-out;
      text-align: center;
      max-width: 90%;
      letter-spacing: 0.15em;
      text-transform: uppercase;
    `;
    
    // Добавляем анимацию если её нет
    if (!document.getElementById('chaos-message-style')) {
      const style = document.createElement('style');
      style.id = 'chaos-message-style';
      style.textContent = `
        @keyframes chaosMessage {
          0% { 
            opacity: 0; 
            transform: translateX(-50%) scale(0.5) rotate(-10deg);
          }
          15% { 
            opacity: 1; 
            transform: translateX(-50%) scale(1.3) rotate(5deg);
          }
          30% { 
            transform: translateX(-50%) scale(0.95) rotate(-3deg);
          }
          45% { 
            transform: translateX(-50%) scale(1.08) rotate(2deg);
          }
          65% { 
            opacity: 1;
            transform: translateX(-50%) scale(1) rotate(0deg);
          }
          85% {
            opacity: 0.8;
            transform: translateX(-50%) scale(1) rotate(0deg);
          }
          100% { 
            opacity: 0; 
            transform: translateX(-50%) scale(0.7) translateY(-80px);
          }
        }
      `;
      document.head.appendChild(style);
    }
    
    document.body.appendChild(msg);
    setTimeout(() => msg.remove(), 2000);
  }
}


if (typeof window !== 'undefined') {
  window.HellWheel3D = HellWheel3D;
}
