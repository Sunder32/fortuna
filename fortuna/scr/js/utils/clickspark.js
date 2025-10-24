/**
 * ClickSpark - Эффект искр при клике
 * Портирован из React компонента для vanilla JS
 * @see https://reactbits.dev/animations/click-spark
 */

export class ClickSpark {
  constructor(element, options = {}) {
    this.element = element;
    this.options = {
      sparkColor: options.sparkColor || '#ff6b45', // Адский оранжевый
      sparkSize: options.sparkSize || 10,
      sparkRadius: options.sparkRadius || 20,
      sparkCount: options.sparkCount || 8,
      duration: options.duration || 500,
      easing: options.easing || 'ease-out',
      extraScale: options.extraScale || 1.3
    };

    this.canvas = null;
    this.ctx = null;
    this.sparks = [];
    this.animationId = null;

    this._init();
  }

  _init() {
    // Создаём canvas
    this.canvas = document.createElement('canvas');
    this.canvas.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 9999;
    `;
    
    // Убеждаемся, что родитель имеет position: relative/absolute/fixed
    const position = getComputedStyle(this.element).position;
    if (position === 'static') {
      this.element.style.position = 'relative';
    }
    
    // ИСПРАВЛЕНИЕ: убедимся, что элемент существует
    if (!this.element.parentNode) {
      console.warn('ClickSpark: element is not attached to DOM');
      return;
    }
    
    this.element.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d');

    // Устанавливаем размер canvas
    this._resizeCanvas();

    // Обработчики
    this._clickHandler = this._handleClick.bind(this);
    this._resizeHandler = this._resizeCanvas.bind(this);
    
    this.element.addEventListener('click', this._clickHandler);
    window.addEventListener('resize', this._resizeHandler);

    // Запускаем анимацию
    this._animate();
  }

  _resizeCanvas() {
    if (!this.canvas) return;
    
    const rect = this.element.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.canvas.style.width = rect.width + 'px';
    this.canvas.style.height = rect.height + 'px';
    
    // ИСПРАВЛЕНИЕ: пересоздаём контекст после изменения размера
    this.ctx = this.canvas.getContext('2d');
    this.ctx.scale(dpr, dpr);
  }

  _easeFunc(t) {
    switch (this.options.easing) {
      case 'linear':
        return t;
      case 'ease-in':
        return t * t;
      case 'ease-in-out':
        return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
      default: // ease-out
        return t * (2 - t);
    }
  }

  _handleClick(e) {
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const now = performance.now();

    // Создаём новые искры
    for (let i = 0; i < this.options.sparkCount; i++) {
      this.sparks.push({
        x,
        y,
        angle: (2 * Math.PI * i) / this.options.sparkCount,
        startTime: now
      });
    }
  }

  _animate() {
    const now = performance.now();
    const dpr = window.devicePixelRatio || 1;
    
    // Очищаем canvas
    this.ctx.clearRect(0, 0, this.canvas.width / dpr, this.canvas.height / dpr);

    // Рисуем и фильтруем искры
    this.sparks = this.sparks.filter(spark => {
      const elapsed = now - spark.startTime;
      
      if (elapsed >= this.options.duration) {
        return false;
      }

      const progress = elapsed / this.options.duration;
      const eased = this._easeFunc(progress);

      const distance = eased * this.options.sparkRadius * this.options.extraScale;
      const lineLength = this.options.sparkSize * (1 - eased);

      const x1 = spark.x + distance * Math.cos(spark.angle);
      const y1 = spark.y + distance * Math.sin(spark.angle);
      const x2 = spark.x + (distance + lineLength) * Math.cos(spark.angle);
      const y2 = spark.y + (distance + lineLength) * Math.sin(spark.angle);

      // Рисуем линию
      this.ctx.strokeStyle = this.options.sparkColor;
      this.ctx.lineWidth = 2;
      this.ctx.shadowColor = this.options.sparkColor;
      this.ctx.shadowBlur = 8;
      this.ctx.beginPath();
      this.ctx.moveTo(x1, y1);
      this.ctx.lineTo(x2, y2);
      this.ctx.stroke();

      return true;
    });

    this.animationId = requestAnimationFrame(() => this._animate());
  }

  destroy() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
    
    if (this._clickHandler) {
      this.element.removeEventListener('click', this._clickHandler);
    }
    
    if (this._resizeHandler) {
      window.removeEventListener('resize', this._resizeHandler);
    }
    
    if (this.canvas && this.canvas.parentNode) {
      this.canvas.parentNode.removeChild(this.canvas);
    }
    
    this.canvas = null;
    this.ctx = null;
    this.sparks = [];
  }
}
