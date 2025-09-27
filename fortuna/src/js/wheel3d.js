import * as THREE from 'three';

const TAU = Math.PI * 2;
const MAX_LABELS = 24;
const SEGMENT_COLORS = [0xff6b45, 0xd9443f, 0xff8938, 0xc53030, 0xffa250, 0xd33234, 0xff7844, 0xe14b3a];

class SpinPhysics {
  constructor() {
    this.angle = 0;
    this.vel = 0;
    this.friction = 0.993;
    this.minSpeed = 0.0001;
    this.maxSpeed = 28;
    this.lastToothHit = -1;
    this.toothCooldown = 0;
  }
  
  addImpulse(delta) {
    this.vel = THREE.MathUtils.clamp(this.vel + delta, -this.maxSpeed, this.maxSpeed);
  }
  
  step(dt) {
    this.angle = (this.angle + this.vel * dt) % TAU;
    if (this.angle < 0) this.angle += TAU;
    this.vel *= Math.pow(this.friction, dt * 60);
    if (this.toothCooldown > 0) this.toothCooldown -= dt;
    if (Math.abs(this.vel) < this.minSpeed) this.vel = 0;
  }
}

export class HellWheel3D {
  constructor(container, options = {}) {
    this.container = container;
    this.onHit = options.onHit || null;
    this.onResult = options.onResult || null;

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
    this.pointerTimeout = null;
    this.initialized = false;
    
    this.victoryEffects = [];
    this.fireRing = null;
    this.retryUsed = false;  // Флаг для отслеживания использования перекрута
    
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
    this.initialized = true;
    this.modalButtonsEnabled = true; 
  }
  
  setModalButtonsEnabled(enabled) {
    this.modalButtonsEnabled = enabled;
    if (this.victoryModal) {
      const rejectBtn = this.victoryModal.querySelector('#modalReject');
      const retryBtn = this.victoryModal.querySelector('#modalRetry');
      
      if (!enabled) {
        rejectBtn.style.display = 'none';
        retryBtn.style.display = 'none';
      } else {
        // Показываем кнопки только если перекрут еще не использовался
        if (this.rejectionCount === 0 && !this.retryUsed) {
          rejectBtn.style.display = 'block';
          retryBtn.style.display = 'none';
        } else {
          rejectBtn.style.display = 'none';
          retryBtn.style.display = 'none';
        }
      }
    }
  }

  // Метод для сброса флага перекрута (вызывается только при нажатии кнопки "Призвать вращение")
  resetRetryFlag() {
    this.retryUsed = false;
  }

  spin(strength = 1) {
    if (this.segmentCount < 2 || this.isSpinning) return;

    if (this.victoryModal && this.victoryModal.classList.contains('active')) {
      this.victoryModal.classList.remove('active');
    }
    
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
    
    this._clearVictoryEffects();
    
    this.physics.vel = 0;
    const spinForce = (20 + Math.random() * 15) * strength;
    const direction = Math.random() < 0.5 ? 1 : -1;
    this.physics.addImpulse(spinForce * direction);
    
    this.isSpinning = true;
    this.activeIndex = -1;
    
    if (this.pointerGroup) {
      this.pointerGroup.rotation.z = 0;
    }
  }

  setLabels(arr) {
    const cleaned = Array.isArray(arr) ? arr.filter(Boolean).slice(0, MAX_LABELS) : [];
    const labelsChanged = JSON.stringify(this.labels) !== JSON.stringify(cleaned);
    
    if (!labelsChanged && this.initialized) return;
    
    if (!cleaned.length) {
      this.segmentCount = 0;
      this.labels = [];
      this.activeIndex = -1;
      this.physics.angle = 0;
      this.physics.vel = 0;
      this._rebuildSectors();
      return;
    }

    const currentAngle = this.physics.angle;
    const currentActiveIndex = this.activeIndex;
    
    this.segmentCount = cleaned.length;
    this.labels = cleaned;
    
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
    this.scene.background = new THREE.Color(0x060103);
    this.scene.fog = new THREE.FogExp2(0x050002, 0.045);

    this.camera = new THREE.PerspectiveCamera(40, w / h, 0.1, 80);
    this.camera.position.set(0.65, 1.8, 12.8);
    this.camera.lookAt(0, 0.35, 0);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(2.2, window.devicePixelRatio || 1));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setSize(w, h, false);
    slot.appendChild(this.renderer.domElement);

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

    this.scene.add(new THREE.PointLight(0x863030, 0.9, 32, 2.6).position.set(3.2, -3.6, 3.8));
    this.scene.add(new THREE.PointLight(0xff9b60, 0.55, 40, 1.8).position.set(-2.4, 6.6, -3.5));

    // Используем обычный рендеринг без post-processing эффектов

    this._createParticles();
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

  _buildWheel() {
    this.root = new THREE.Group();
    this.scene.add(this.root);

    const R = this.outerRadius;
    const r = this.innerRadius;
    const h = this.bodyHeight;

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

    const shell = new THREE.Mesh(
      new THREE.LatheGeometry(shellProfile, 240),
      new THREE.MeshStandardMaterial({ color: 0x3a0d0d, metalness: 0.82, roughness: 0.46, emissive: 0x0c0101 })
    );
    shell.rotation.x = Math.PI / 2;
    shell.castShadow = true;
    shell.receiveShadow = true;
    this.root.add(shell);

    const facePlate = new THREE.Mesh(
      new THREE.CircleGeometry(R - 0.48, 180),
      new THREE.MeshStandardMaterial({ color: 0x190303, metalness: 0.38, roughness: 0.78, emissive: 0x050000 })
    );
    facePlate.position.z = h * 0.42;
    facePlate.receiveShadow = true;
    this.root.add(facePlate);

    const brassRing = new THREE.Mesh(
      new THREE.RingGeometry(r - 0.08, r + 0.32, 180),
      new THREE.MeshStandardMaterial({ color: 0xffb77f, metalness: 0.92, roughness: 0.24, emissive: 0x3e1002, side: THREE.DoubleSide })
    );
    brassRing.position.z = h * 0.45;
    this.root.add(brassRing);

    const hubGem = new THREE.Mesh(
      new THREE.SphereGeometry(r * 0.7, 64, 32),
      new THREE.MeshStandardMaterial({ color: 0x7a1616, metalness: 0.74, roughness: 0.36, emissive: 0x2d0505 })
    );
    hubGem.scale.set(1, 1, 0.56);
    hubGem.position.z = h * 0.63;
    hubGem.castShadow = true;
    this.root.add(hubGem);

    this.segmentGroup = new THREE.Group();
    this.segmentGroup.position.z = h * 0.32;
    this.root.add(this.segmentGroup);

    this.dividerGroup = new THREE.Group();
    this.dividerGroup.position.z = this.segmentGroup.position.z + this.segmentHeight / 2 + 0.12;
    this.root.add(this.dividerGroup);

    this.labelGroup = new THREE.Group();
    this.labelGroup.position.z = this.dividerGroup.position.z + 0.48;
    this.root.add(this.labelGroup);

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

    this.pointerGroup = new THREE.Group();
    this.pointerGroup.position.set(0, R + 0.62, this.dividerGroup.position.z + 0.12);
    this.scene.add(this.pointerGroup);

    const pointerTip = new THREE.Mesh(
      new THREE.ConeGeometry(0.3, 0.72, 32),
      new THREE.MeshStandardMaterial({ color: 0xffe3a1, metalness: 0.82, roughness: 0.26, emissive: 0x5c2200 })
    );
    pointerTip.position.y = -1.2;
    pointerTip.rotation.x = Math.PI;
    pointerTip.castShadow = true;
    this.pointerGroup.add(pointerTip);

    const pointerRod = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.08, 1.5, 16),
      new THREE.MeshStandardMaterial({ color: 0xffc080, metalness: 0.7, roughness: 0.3, emissive: 0x3c1800 })
    );
    pointerRod.position.y = -0.4;
    pointerRod.castShadow = true;
    this.pointerGroup.add(pointerRod);

    this._rebuildSectors();
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
    this.anchorOffset = Math.PI / 2 - this.segmentAngle / 2;

    for (let i = 0; i < N; i++) {
      const start = this.anchorOffset + i * this.segmentAngle;
      const end = start + this.segmentAngle;
      const color = SEGMENT_COLORS[i % SEGMENT_COLORS.length];
      
      const segment = this._createSegmentMesh(start, end, color);
      segment.userData.index = i;
      this.segmentGroup.add(segment);

      const fullText = this.labels[i] || `Вариант ${i + 1}`;
      const labelText = fullText.length > 7 ? fullText.substring(0, 7) + '...' : fullText;
      const label = this._createLabelSprite(labelText);
      const mid = start + this.segmentAngle / 2;
      label.position.set(Math.cos(mid) * (this.labelRadius - 0.1), Math.sin(mid) * (this.labelRadius - 0.1), 0);
      label.userData.baseScale = { x: label.scale.x, y: label.scale.y };
      label.userData.index = i;
      this.labelGroup.add(label);

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
      bevelThickness: 0.16,
      bevelSize: 0.12,
      bevelSegments: 4,
      curveSegments: 64
    });
    geometry.translate(0, 0, -this.segmentHeight / 2);

    const baseColor = new THREE.Color(hexColor).offsetHSL(0, -0.05, -0.05);
    const material = new THREE.MeshStandardMaterial({
      color: baseColor.clone(),
      roughness: 0.42,
      metalness: 0.7,
      emissive: baseColor.clone().multiplyScalar(0.2),
      emissiveIntensity: 1.1,
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
    const cone = new THREE.Mesh(
      new THREE.ConeGeometry(size, height, 12),
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        metalness: 0.2,
        roughness: 0.35,
        emissive: 0x333333,
        emissiveIntensity: 0.3
      })
    );
    
    const r = this.outerRadius - 0.3;
    cone.position.set(Math.cos(angle) * r, Math.sin(angle) * r, 0);
    cone.lookAt(0, 0, 0);
    cone.castShadow = true;
    
    return cone;
  }

  _createLabelSprite(text) {
    const size = 1024;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');
    
    const fontSize = Math.floor(size / 5);
    ctx.font = `bold ${fontSize}px Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    const centerX = size / 2;
    const centerY = size / 2;
    
    const metrics = ctx.measureText(text);
    const textWidth = metrics.width;
    const textHeight = fontSize * 1.4;
    
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(centerX - textWidth / 2 - 20, centerY - textHeight / 2, textWidth + 40, textHeight);
    
    // Убираем черную обводку, оставляем только красную
    ctx.strokeStyle = '#ff4422';
    ctx.lineWidth = fontSize / 12;
    ctx.strokeText(text, centerX, centerY);
    
    ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
    ctx.shadowBlur = fontSize / 10;
    ctx.shadowOffsetX = fontSize / 30;
    ctx.shadowOffsetY = fontSize / 30;
    
    ctx.fillStyle = '#ffffff';
    ctx.fillText(text, centerX, centerY);

    const texture = new THREE.CanvasTexture(canvas);
    texture.anisotropy = 16;
    
    const material = new THREE.SpriteMaterial({ 
      map: texture, 
      transparent: true, 
      depthTest: false, 
      depthWrite: false, 
      opacity: 0.95
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
        <button class="victory-modal-reject" id="modalReject">Отвергнуть приговор</button>
        <button class="victory-modal-close" id="modalClose">Принять судьбу</button>
        <button class="victory-modal-retry" id="modalRetry" style="display: none;">Испытать судьбу вновь</button>
      </div>
    `;
    
    document.body.appendChild(modal);
    this.victoryModal = modal;
    this.rejectionCount = 0;
    
    const closeBtn = modal.querySelector('#modalClose');
    const rejectBtn = modal.querySelector('#modalReject');
    const retryBtn = modal.querySelector('#modalRetry');
    const backdrop = modal.querySelector('.victory-modal-backdrop');
    
    const closeModal = () => {
      modal.classList.remove('active');
      this.rejectionCount = 0; 
      retryBtn.style.display = 'none'; 
      // Не сбрасываем состояние rejectBtn автоматически - это должно зависеть от retryUsed
      setTimeout(() => {
        this._clearVictoryEffects();
      }, 1000);
    };
    
    const rejectFate = () => {
      this.rejectionCount++;
      
      if (this.rejectionCount === 1) {
        const phraseEl = modal.querySelector('#modalPhrase');
        phraseEl.textContent = "Ты осмелился усомниться в решении преисподней? Демоны предлагают последний шанс...";
        phraseEl.style.color = '#ff6644';
        
        rejectBtn.style.display = 'none';
        retryBtn.style.display = 'block';
        
        modal.querySelector('.victory-modal-content').style.animation = 'shake 0.5s';
        setTimeout(() => {
          modal.querySelector('.victory-modal-content').style.animation = '';
        }, 500);
      }
    };
    
    const retrySpain = () => {
      // Помечаем что перекрут был использован
      this.retryUsed = true;
      modal.classList.remove('active');
      this.rejectionCount = 0;
      setTimeout(() => {
        this.spin();
      }, 500);
    };
    
    closeBtn.addEventListener('click', closeModal);
    rejectBtn.addEventListener('click', rejectFate);
    retryBtn.addEventListener('click', retrySpain);
    backdrop.addEventListener('click', closeModal);
  }
  
  _showVictoryModal(label) {
    if (!this.victoryModal) return;
    
    const rejectBtn = this.victoryModal.querySelector('#modalReject');
    const retryBtn = this.victoryModal.querySelector('#modalRetry');
    const phraseEl = this.victoryModal.querySelector('#modalPhrase');
    
    // Показываем кнопки только если включено "Искушение судьбой" и перекрут еще не использовался
    if (this.modalButtonsEnabled && !this.retryUsed) {
      rejectBtn.style.display = 'block';
      retryBtn.style.display = 'none';
    } else {
      rejectBtn.style.display = 'none';
      retryBtn.style.display = 'none';
    }
    
    this.rejectionCount = 0;
    phraseEl.style.color = '#d4b896'; 
    
    const randomPhrase = this.hellPhrases[Math.floor(Math.random() * this.hellPhrases.length)];
    
    const retryTexts = [
      "Испытать судьбу вновь",
      "Бросить вызов року",
      "Переиграть с демонами", 
      "Искусить судьбу снова",
      "Ещё один раунд в аду",
      "Перезапустить колесо",
      "Попытать удачу вновь"
    ];
    const randomRetryText = retryTexts[Math.floor(Math.random() * retryTexts.length)];
    
    const rejectTexts = [
      "Отвергнуть приговор",
      "Усомниться в вердикте",
      "Оспорить решение",
      "Отказаться от судьбы",
      "Не принять волю ада"
    ];
    const randomRejectText = rejectTexts[Math.floor(Math.random() * rejectTexts.length)];
    
    const resultEl = this.victoryModal.querySelector('#modalResult');
    
    resultEl.textContent = label;
    phraseEl.textContent = randomPhrase;
    retryBtn.textContent = randomRetryText;
    rejectBtn.textContent = randomRejectText;

    setTimeout(() => {
      this.victoryModal.classList.add('active');
    }, 1500);
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

    this._createVictoryEffects(index);
    
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
    
    // Bloom эффект удален для лучшей четкости
    
    this._createScreenFlash();

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
    if (this.fireRing) {
      this.scene.remove(this.fireRing);
      if (this.fireRing.geometry) this.fireRing.geometry.dispose();
      if (this.fireRing.material) this.fireRing.material.dispose();
      this.fireRing = null;
    }
    
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
    if (this.fireRing) {
      this.fireRing.rotation.z += dt * 0.5;
      this.fireRing.material.emissiveIntensity = 2 + Math.sin(Date.now() * 0.005) * 0.5;
    }
    
    this.victoryEffects = this.victoryEffects.filter(effect => {
      if (effect.type === 'ray') {
        effect.mesh.material.opacity = effect.baseOpacity * (0.5 + Math.sin(Date.now() * 0.01) * 0.5);
        effect.mesh.scale.y = 1 + Math.sin(Date.now() * 0.005) * 0.2;
        return true;
      } else if (effect.velocities) {
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

  _animate() {
    const clock = new THREE.Clock();
    const animate = () => {
      const dt = Math.min(0.033, clock.getDelta());
      this._updatePhysics(dt);
      this._updateParticles(dt);
      this._updateVictoryEffects(dt);
      this.renderer.render(this.scene, this.camera);
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
        positions[i * 3 + 1] = 15;
      }
    }

    this.particles.geometry.attributes.position.needsUpdate = true;
  }

  _updatePhysics(dt) {
    const count = this.segmentCount;
    
    if (count <= 1) {
      this.physics.step(dt);
      this.root.rotation.z = this.physics.angle;
      
      if (Math.abs(this.physics.vel) < 0.01 && this.isSpinning) {
        const label = this.labels.length ? this.labels[0] : "Вариант 1";
        if (this.onResult) this.onResult(label);
        this._highlightSector(0);
        this.isSpinning = false;
        this.activeIndex = 0;
      }
      return;
    }
    
    const segmentAngle = TAU / count;
    const prevAngle = this.physics.angle;
    
    this.physics.step(dt);
    
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
          
          if (velocity > 8) {
            this.physics.vel *= (1 - (0.06 + Math.random() * 0.03) * dampingMultiplier);
            this._bouncePointer();
            if (this.onHit) this.onHit(0.9);
          } else if (velocity > 4) {
            this.physics.vel *= (1 - (0.10 + Math.random() * 0.05) * dampingMultiplier);
            this._bouncePointer();
            if (this.onHit) this.onHit(0.7);
          } else if (velocity > 2) {
            this.physics.vel *= (1 - (0.18 + Math.random() * 0.07) * dampingMultiplier);
            this._bouncePointer();
            if (this.onHit) this.onHit(0.5);
          } else if (velocity > 0.8) {
            this.physics.vel *= (1 - (0.25 + Math.random() * 0.10) * dampingMultiplier);
            this._bouncePointer();
            if (this.onHit) this.onHit(0.3);
          } else if (velocity > 0.3) {
            if (Math.random() < 0.5) {
              this.physics.vel = (this.physics.vel > 0 ? -1 : 1) * (-0.15 - Math.random() * 0.1);
            } else {
              this.physics.vel += (this.physics.vel > 0 ? 1 : -1) * (0.3 + Math.random() * 0.15);
            }
            this._bouncePointer();
            if (this.onHit) this.onHit(0.2);
          } else {
            this.physics.vel = (this.physics.vel > 0 ? -1 : 1) * (-0.1 - Math.random() * 0.05);
            if (this.onHit) this.onHit(0.1);
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

    if (Math.abs(this.physics.vel) < 0.01 && this.isSpinning) {
      const idx = this._indexFromAngle(this.physics.angle);
      const label = this.labels[idx] || `Вариант ${idx + 1}`;
      
      if (this.onResult) this.onResult(label);
      this._highlightSector(idx);
      this._showVictoryModal(label);
      this.isSpinning = false;
      this.activeIndex = idx;
    }
  }
}

if (typeof window !== 'undefined') {
  window.HellWheel3D = HellWheel3D;
}