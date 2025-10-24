// src/js/utils/toast.js - Toast-уведомления
export class Toast {
  static show(message, type = 'default', duration = 3000) {
    const toast = document.createElement('div');
    toast.className = `toast-notification ${type}`;
    toast.textContent = message;
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');
    
    document.body.appendChild(toast);
    
    // Триггер анимации
    setTimeout(() => toast.classList.add('show'), 10);
    
    // Удаление
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, duration);
    
    return toast;
  }
  
  static success(message, duration = 3000) {
    return this.show(message, 'success', duration);
  }
  
  static error(message, duration = 4000) {
    return this.show(message, 'error', duration);
  }
  
  static warning(message, duration = 3500) {
    return this.show(message, 'warning', duration);
  }
}
