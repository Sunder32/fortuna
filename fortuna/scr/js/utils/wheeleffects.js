// 🔥 Визуальные эффекты для колеса
import * as THREE from 'three';

/**
 * 🔥 Огненный след за указателем
 */
export class FireTrail {
  constructor(scene, pointerGroup) {
    this.scene = scene;
    this.pointerGroup = pointerGroup;
    this.particles = [];
    this.maxParticles = 50;
    this.enabled = false;
    
    // Создаём систему частиц
    this._createParticleSystem();
  }
  
  _createParticleSystem() {
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(this.maxParticles * 3);
    const colors = new Float32Array(this.maxParticles * 3);
    const sizes = new Float32Array(this.maxParticles);
    const alphas = new Float32Array(this.maxParticles);
    
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    geometry.setAttribute('alpha', new THREE.BufferAttribute(alphas, 1));
    
    // Создаём текстуру огня
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    
    const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
    gradient.addColorStop(0.2, 'rgba(255, 200, 100, 0.9)');
    gradient.addColorStop(0.4, 'rgba(255, 100, 50, 0.7)');
    gradient.addColorStop(0.7, 'rgba(255, 50, 20, 0.4)');
    gradient.addColorStop(1, 'rgba(100, 20, 0, 0)');
    
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 64, 64);
    
    const texture = new THREE.CanvasTexture(canvas);
    
    const material = new THREE.ShaderMaterial({
      uniforms: {
        pointTexture: { value: texture },
        time: { value: 0 }
      },
      vertexShader: `
        attribute float size;
        attribute float alpha;
        attribute vec3 color;
        varying vec3 vColor;
        varying float vAlpha;
        
        void main() {
          vColor = color;
          vAlpha = alpha;
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = size * (300.0 / -mvPosition.z);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        uniform sampler2D pointTexture;
        varying vec3 vColor;
        varying float vAlpha;
        
        void main() {
          vec4 texColor = texture2D(pointTexture, gl_PointCoord);
          gl_FragColor = vec4(vColor, texColor.a * vAlpha);
        }
      `,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true
    });
    
    this.particleSystem = new THREE.Points(geometry, material);
    this.scene.add(this.particleSystem);
    
    // Инициализируем частицы
    for (let i = 0; i < this.maxParticles; i++) {
      this.particles.push({
        life: 0,
        maxLife: 0
      });
    }
  }
  
  start() {
    this.enabled = true;
    this.currentParticle = 0;
  }
  
  stop() {
    this.enabled = false;
  }
  
  update(dt, velocity) {
    if (!this.particleSystem) return;
    
    const positions = this.particleSystem.geometry.attributes.position.array;
    const colors = this.particleSystem.geometry.attributes.color.array;
    const sizes = this.particleSystem.geometry.attributes.size.array;
    const alphas = this.particleSystem.geometry.attributes.alpha.array;
    
    // Обновляем существующие частицы
    for (let i = 0; i < this.maxParticles; i++) {
      const particle = this.particles[i];
      
      if (particle.life > 0) {
        particle.life -= dt;
        
        const t = 1 - (particle.life / particle.maxLife);
        
        // Затухание
        alphas[i] = Math.max(0, 1 - t);
        
        // Уменьшение размера
        sizes[i] = (1 - t * 0.5) * 0.3;
        
        // Изменение цвета (от белого к красному)
        if (t < 0.3) {
          colors[i * 3] = 1.0;
          colors[i * 3 + 1] = 1.0;
          colors[i * 3 + 2] = 1.0;
        } else if (t < 0.6) {
          colors[i * 3] = 1.0;
          colors[i * 3 + 1] = 0.6;
          colors[i * 3 + 2] = 0.2;
        } else {
          colors[i * 3] = 1.0;
          colors[i * 3 + 1] = 0.2;
          colors[i * 3 + 2] = 0.0;
        }
        
        // Движение вверх и в сторону
        positions[i * 3 + 1] += dt * 0.5;
        positions[i * 3 + 2] += dt * 0.2;
      } else {
        alphas[i] = 0;
      }
    }
    
    // Создаём новые частицы если колесо вращается быстро
    if (this.enabled && Math.abs(velocity) > 2) {
      const spawnRate = Math.min(5, Math.abs(velocity) / 2);
      
      for (let s = 0; s < spawnRate * dt * 60; s++) {
        const i = this.currentParticle % this.maxParticles;
        
        // Позиция кончика указателя
        const tipPos = new THREE.Vector3(0, -1.2, 0);
        tipPos.applyQuaternion(this.pointerGroup.quaternion);
        tipPos.add(this.pointerGroup.position);
        
        // Добавляем разброс
        positions[i * 3] = tipPos.x + (Math.random() - 0.5) * 0.2;
        positions[i * 3 + 1] = tipPos.y + (Math.random() - 0.5) * 0.2;
        positions[i * 3 + 2] = tipPos.z + (Math.random() - 0.5) * 0.1;
        
        this.particles[i].life = 0.3 + Math.random() * 0.3;
        this.particles[i].maxLife = this.particles[i].life;
        
        sizes[i] = 0.3;
        alphas[i] = 1;
        
        this.currentParticle++;
      }
    }
    
    this.particleSystem.geometry.attributes.position.needsUpdate = true;
    this.particleSystem.geometry.attributes.color.needsUpdate = true;
    this.particleSystem.geometry.attributes.size.needsUpdate = true;
    this.particleSystem.geometry.attributes.alpha.needsUpdate = true;
  }
}

/**
 * ⚡ Молнии при быстром вращении
 */
export class Lightning {
  constructor(scene, wheelRoot) {
    this.scene = scene;
    this.wheelRoot = wheelRoot;
    this.bolts = [];
    this.maxBolts = 5;
    
    for (let i = 0; i < this.maxBolts; i++) {
      const geometry = new THREE.BufferGeometry();
      const positions = new Float32Array(20 * 3); // 20 точек на молнию
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      
      const material = new THREE.LineBasicMaterial({
        color: 0x88ccff,
        opacity: 0,
        transparent: true,
        blending: THREE.AdditiveBlending
      });
      
      const bolt = new THREE.Line(geometry, material);
      bolt.visible = false;
      this.scene.add(bolt);
      
      this.bolts.push({
        mesh: bolt,
        life: 0
      });
    }
    
    this.currentBolt = 0;
  }
  
  spawn(velocity) {
    if (Math.abs(velocity) < 15) return; // Только при очень быстром вращении
    
    const bolt = this.bolts[this.currentBolt % this.maxBolts];
    this.currentBolt++;
    
    // Генерируем случайную молнию между секторами
    const angle1 = Math.random() * Math.PI * 2;
    const angle2 = angle1 + (Math.random() - 0.5) * Math.PI * 0.5;
    const radius = 4 + Math.random() * 2;
    
    const start = new THREE.Vector3(
      Math.cos(angle1) * radius,
      Math.sin(angle1) * radius,
      0
    );
    
    const end = new THREE.Vector3(
      Math.cos(angle2) * radius,
      Math.sin(angle2) * radius,
      0
    );
    
    // Генерируем ломаную линию
    const positions = bolt.mesh.geometry.attributes.position.array;
    const segments = 10;
    
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const offset = (Math.random() - 0.5) * 0.5 * (1 - Math.abs(t - 0.5) * 2);
      
      positions[i * 3] = start.x + (end.x - start.x) * t + offset;
      positions[i * 3 + 1] = start.y + (end.y - start.y) * t + offset;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 0.3;
    }
    
    bolt.mesh.geometry.attributes.position.needsUpdate = true;
    bolt.mesh.material.opacity = 0.8 + Math.random() * 0.2;
    bolt.mesh.visible = true;
    bolt.life = 0.1 + Math.random() * 0.1;
  }
  
  update(dt, velocity) {
    // Обновляем существующие молнии
    this.bolts.forEach(bolt => {
      if (bolt.life > 0) {
        bolt.life -= dt;
        bolt.mesh.material.opacity = bolt.life / 0.2;
        
        if (bolt.life <= 0) {
          bolt.mesh.visible = false;
        }
      }
    });
    
    // Создаём новые молнии
    if (Math.abs(velocity) > 15 && Math.random() < 0.1) {
      this.spawn(velocity);
    }
  }
}

/**
 * 🌟 Комета при критическом моменте
 */
export class Comet {
  constructor(scene) {
    this.scene = scene;
    this.active = false;
    
    // Создаём комету
    const headGeo = new THREE.SphereGeometry(0.3, 16, 16);
    const headMat = new THREE.MeshBasicMaterial({
      color: 0xffffaa,
      transparent: true
    });
    this.head = new THREE.Mesh(headGeo, headMat);
    
    // Хвост кометы
    const tailGeo = new THREE.BufferGeometry();
    const tailPos = new Float32Array(50 * 3);
    tailGeo.setAttribute('position', new THREE.BufferAttribute(tailPos, 3));
    
    const tailMat = new THREE.LineBasicMaterial({
      color: 0xffaa44,
      opacity: 0.6,
      transparent: true,
      blending: THREE.AdditiveBlending
    });
    
    this.tail = new THREE.Line(tailGeo, tailMat);
    
    this.group = new THREE.Group();
    this.group.add(this.head);
    this.group.add(this.tail);
    this.scene.add(this.group);
    this.group.visible = false;
  }
  
  trigger() {
    this.active = true;
    this.group.visible = true;
    this.progress = 0;
    
    // Случайная траектория
    this.startPos = new THREE.Vector3(
      -15 + Math.random() * 5,
      10 + Math.random() * 5,
      -5
    );
    
    this.endPos = new THREE.Vector3(
      10 + Math.random() * 5,
      -10 + Math.random() * 5,
      5
    );
    
    this.group.position.copy(this.startPos);
  }
  
  update(dt) {
    if (!this.active) return;
    
    this.progress += dt * 2; // 0.5 секунды на пролёт
    
    if (this.progress >= 1) {
      this.active = false;
      this.group.visible = false;
      return;
    }
    
    // Интерполяция позиции
    this.group.position.lerpVectors(this.startPos, this.endPos, this.progress);
    
    // Обновляем хвост
    const tailPos = this.tail.geometry.attributes.position.array;
    const direction = new THREE.Vector3().subVectors(this.endPos, this.startPos).normalize();
    
    for (let i = 0; i < 50; i++) {
      const offset = i * 0.1;
      const pos = new THREE.Vector3().lerpVectors(this.startPos, this.endPos, this.progress - offset * 0.02);
      
      tailPos[i * 3] = pos.x;
      tailPos[i * 3 + 1] = pos.y;
      tailPos[i * 3 + 2] = pos.z;
    }
    
    this.tail.geometry.attributes.position.needsUpdate = true;
    
    // Затухание
    const fadeStart = 0.7;
    if (this.progress > fadeStart) {
      const fadeProgress = (this.progress - fadeStart) / (1 - fadeStart);
      this.head.material.opacity = 1 - fadeProgress;
      this.tail.material.opacity = 0.6 * (1 - fadeProgress);
    }
  }
}

/**
 * 💫 Падающие звёзды для параллакса
 */
export class FallingStars {
  constructor(scene) {
    this.scene = scene;
    this.stars = [];
    this.starCount = 20;
    
    for (let i = 0; i < this.starCount; i++) {
      const geometry = new THREE.BufferGeometry();
      const positions = new Float32Array(10 * 3);
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      
      const material = new THREE.LineBasicMaterial({
        color: 0xffffaa,
        opacity: 0,
        transparent: true,
        blending: THREE.AdditiveBlending
      });
      
      const star = new THREE.Line(geometry, material);
      this.scene.add(star);
      
      this.stars.push({
        mesh: star,
        life: 0,
        speed: 0
      });
    }
  }
  
  update(dt) {
    // Обновляем существующие звёзды
    this.stars.forEach(star => {
      if (star.life > 0) {
        star.life -= dt;
        star.mesh.material.opacity = Math.min(1, star.life * 3) * 0.6;
        
        // Движение вниз
        star.mesh.position.y -= dt * star.speed;
        star.mesh.position.x += dt * star.speed * 0.3;
        
        if (star.life <= 0 || star.mesh.position.y < -15) {
          star.mesh.material.opacity = 0;
          star.life = 0;
        }
      }
    });
    
    // Создаём новые звёзды
    if (Math.random() < 0.02) { // 2% шанс каждый кадр
      const availableStar = this.stars.find(s => s.life <= 0);
      if (availableStar) {
        this._spawnStar(availableStar);
      }
    }
  }
  
  _spawnStar(star) {
    star.life = 1 + Math.random() * 2;
    star.speed = 5 + Math.random() * 10;
    
    const startX = -20 + Math.random() * 40;
    const startY = 15 + Math.random() * 5;
    const startZ = -10 + Math.random() * 20;
    
    star.mesh.position.set(startX, startY, startZ);
    star.mesh.material.opacity = 0.6;
    
    // Создаём линию-след
    const positions = star.mesh.geometry.attributes.position.array;
    const trailLength = 0.5 + Math.random() * 1;
    
    for (let i = 0; i < 10; i++) {
      const t = i / 9;
      positions[i * 3] = -t * trailLength;
      positions[i * 3 + 1] = t * trailLength * 0.3;
      positions[i * 3 + 2] = 0;
    }
    
    star.mesh.geometry.attributes.position.needsUpdate = true;
  }
}
