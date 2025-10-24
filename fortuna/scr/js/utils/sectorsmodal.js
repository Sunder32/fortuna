/**
 * SectorsModal - Модальное окно для отображения списка секторов
 * Красивое окно с улучшенной читаемостью и кнопками управления
 */

export class SectorsModal {
  constructor(options = {}) {
    this.items = options.items || [];
    this.onEdit = options.onEdit || (() => {});
    this.onDelete = options.onDelete || (() => {});
    this.onClose = options.onClose || (() => {});
    
    this.overlay = null;
    this.modal = null;
    this.isOpen = false;
    
    this._createModal();
  }
  
  _createModal() {
    // Создаём overlay
    this.overlay = document.createElement('div');
    this.overlay.className = 'sectors-modal-overlay';
    
    // Создаём модалку
    this.modal = document.createElement('div');
    this.modal.className = 'sectors-modal';
    
    this.overlay.appendChild(this.modal);
    document.body.appendChild(this.overlay);
    
    // Закрытие по клику на overlay
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) {
        this.close();
      }
    });
    
    // Закрытие по ESC
    this._escapeHandler = (e) => {
      if (e.key === 'Escape' && this.isOpen) {
        this.close();
      }
    };
    document.addEventListener('keydown', this._escapeHandler);
  }
  
  open(items) {
    if (items) {
      this.items = items;
    }
    
    this._render();
    this.overlay.classList.add('active');
    this.isOpen = true;
    
    // Блокируем скролл body
    document.body.style.overflow = 'hidden';
  }
  
  close() {
    this.overlay.classList.remove('active');
    this.isOpen = false;
    
    // Восстанавливаем скролл body
    document.body.style.overflow = '';
    
    this.onClose();
  }
  
  _render() {
    const maxLimit = 24;
    const count = this.items.length;
    
    this.modal.innerHTML = `
      <div class="sectors-modal-header">
        <div class="sectors-modal-title">Секторы судьбы</div>
        <button class="sectors-modal-close" aria-label="Закрыть">×</button>
      </div>
      
      <div class="sectors-modal-stats">
        <span class="sectors-modal-count">Записано: ${count}</span>
        <span class="sectors-modal-limit">Лимит: ${maxLimit}</span>
      </div>
      
      <div class="sectors-modal-body">
        ${this._renderList()}
      </div>
    `;
    
    // Обработчик закрытия
    this.modal.querySelector('.sectors-modal-close').addEventListener('click', () => {
      this.close();
    });
    
    // Обработчики кнопок редактирования и удаления
    this.modal.querySelectorAll('.sectors-modal-item-btn.edit').forEach((btn, index) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.onEdit(index, this.items[index]);
      });
    });
    
    this.modal.querySelectorAll('.sectors-modal-item-btn.delete').forEach((btn, index) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        
        // Анимация удаления
        const item = btn.closest('.sectors-modal-item');
        item.style.animation = 'itemFadeOut 0.3s ease forwards';
        
        setTimeout(() => {
          this.onDelete(index, this.items[index]);
        }, 300);
      });
    });
  }
  
  _renderList() {
    if (this.items.length === 0) {
      return '<div class="sectors-modal-empty">Список пуст</div>';
    }
    
    return `
      <ul class="sectors-modal-list">
        ${this.items.map((item, index) => `
          <li class="sectors-modal-item">
            <div class="sectors-modal-item-content">
              <div class="sectors-modal-item-number">${index + 1}</div>
              <div class="sectors-modal-item-title">${this._escapeHtml(item)}</div>
            </div>
            <div class="sectors-modal-item-actions">
              <button class="sectors-modal-item-btn edit" title="Редактировать" aria-label="Редактировать ${this._escapeHtml(item)}">
                &#9998;
              </button>
              <button class="sectors-modal-item-btn delete" title="Удалить" aria-label="Удалить ${this._escapeHtml(item)}">
                &times;
              </button>
            </div>
          </li>
        `).join('')}
      </ul>
    `;
  }
  
  _escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
  
  update(items) {
    this.items = items;
    if (this.isOpen) {
      this._render();
    }
  }
  
  destroy() {
    document.removeEventListener('keydown', this._escapeHandler);
    
    if (this.overlay && this.overlay.parentNode) {
      this.overlay.parentNode.removeChild(this.overlay);
    }
    
    this.overlay = null;
    this.modal = null;
    this.items = [];
  }
}

// Дополнительная анимация для удаления
const style = document.createElement('style');
style.textContent = `
  @keyframes itemFadeOut {
    from {
      opacity: 1;
      transform: translateX(0) scale(1);
      max-height: 100px;
      margin-bottom: 12px;
    }
    to {
      opacity: 0;
      transform: translateX(60px) scale(0.8);
      max-height: 0;
      margin-bottom: 0;
      padding-top: 0;
      padding-bottom: 0;
    }
  }
`;
document.head.appendChild(style);
