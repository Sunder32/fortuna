/**
 * AnimatedList - Анимированный список с градиентами и клавиатурной навигацией
 * Портирован из React компонента для vanilla JS
 * @see https://reactbits.dev/components/animated-list
 */

export class AnimatedList {
  constructor(element, options = {}) {
    this.element = element;
    this.options = {
      showGradients: options.showGradients !== false,
      enableArrowNavigation: options.enableArrowNavigation !== false,
      displayScrollbar: options.displayScrollbar !== false,
      onItemSelect: options.onItemSelect || null,
      initialSelectedIndex: options.initialSelectedIndex || -1
    };

    this.selectedIndex = this.options.initialSelectedIndex;
    this.keyboardNav = false;
    this.topGradient = null;
    this.bottomGradient = null;

    this._init();
  }

  _init() {
    // Добавляем wrapper
    if (!this.element.classList.contains('sectors-list-wrapper')) {
      const wrapper = document.createElement('div');
      wrapper.className = 'sectors-list-wrapper';
      this.element.parentNode.insertBefore(wrapper, this.element);
      wrapper.appendChild(this.element);
      this.wrapper = wrapper;
    } else {
      this.wrapper = this.element;
      this.element = this.element.querySelector('.sectors-list') || this.element.children[0];
    }

    // Добавляем классы
    this.element.classList.add('sectors-list');
    if (!this.options.displayScrollbar) {
      this.element.classList.add('hide-scrollbar');
    }

    // Создаём градиенты
    if (this.options.showGradients) {
      this._createGradients();
    }

    // Обработчики
    this.element.addEventListener('scroll', this._handleScroll.bind(this));
    
    if (this.options.enableArrowNavigation) {
      window.addEventListener('keydown', this._handleKeyDown.bind(this));
    }

    // Добавляем обработчики на существующие элементы
    this._attachItemHandlers();

    // Инициализируем градиенты
    this._updateGradients();
  }

  _createGradients() {
    this.topGradient = document.createElement('div');
    this.topGradient.className = 'scroll-gradient-top';
    this.topGradient.style.opacity = '0';

    this.bottomGradient = document.createElement('div');
    this.bottomGradient.className = 'scroll-gradient-bottom';
    this.bottomGradient.style.opacity = '1';

    this.wrapper.appendChild(this.topGradient);
    this.wrapper.appendChild(this.bottomGradient);
  }

  _handleScroll(e) {
    if (!this.options.showGradients) return;
    this._updateGradients();
  }

  _updateGradients() {
    if (!this.topGradient || !this.bottomGradient) return;

    const { scrollTop, scrollHeight, clientHeight } = this.element;

    // Top gradient
    const topOpacity = Math.min(scrollTop / 50, 1);
    this.topGradient.style.opacity = topOpacity;

    // Bottom gradient
    const bottomDistance = scrollHeight - (scrollTop + clientHeight);
    const bottomOpacity = scrollHeight <= clientHeight ? 0 : Math.min(bottomDistance / 50, 1);
    this.bottomGradient.style.opacity = bottomOpacity;
  }

  _handleKeyDown(e) {
    const items = Array.from(this.element.querySelectorAll('.sector-item:not(.removing)'));
    
    if (e.key === 'ArrowDown' || (e.key === 'Tab' && !e.shiftKey)) {
      e.preventDefault();
      this.keyboardNav = true;
      this.selectedIndex = Math.min(this.selectedIndex + 1, items.length - 1);
      this._updateSelection();
      this._scrollToSelected();
    } else if (e.key === 'ArrowUp' || (e.key === 'Tab' && e.shiftKey)) {
      e.preventDefault();
      this.keyboardNav = true;
      this.selectedIndex = Math.max(this.selectedIndex - 1, 0);
      this._updateSelection();
      this._scrollToSelected();
    } else if (e.key === 'Enter') {
      if (this.selectedIndex >= 0 && this.selectedIndex < items.length) {
        e.preventDefault();
        const selectedItem = items[this.selectedIndex];
        if (this.options.onItemSelect) {
          const index = parseInt(selectedItem.dataset.index);
          this.options.onItemSelect(selectedItem, index);
        }
      }
    }
  }

  _updateSelection() {
    const items = Array.from(this.element.querySelectorAll('.sector-item:not(.removing)'));
    items.forEach((item, index) => {
      if (index === this.selectedIndex) {
        item.classList.add('selected');
      } else {
        item.classList.remove('selected');
      }
    });
  }

  _scrollToSelected() {
    if (!this.keyboardNav || this.selectedIndex < 0) return;

    const items = Array.from(this.element.querySelectorAll('.sector-item:not(.removing)'));
    const selectedItem = items[this.selectedIndex];
    
    if (selectedItem) {
      const extraMargin = 50;
      const containerScrollTop = this.element.scrollTop;
      const containerHeight = this.element.clientHeight;
      const itemTop = selectedItem.offsetTop;
      const itemBottom = itemTop + selectedItem.offsetHeight;

      if (itemTop < containerScrollTop + extraMargin) {
        this.element.scrollTo({ 
          top: itemTop - extraMargin, 
          behavior: 'smooth' 
        });
      } else if (itemBottom > containerScrollTop + containerHeight - extraMargin) {
        this.element.scrollTo({
          top: itemBottom - containerHeight + extraMargin,
          behavior: 'smooth'
        });
      }
    }

    this.keyboardNav = false;
  }

  _attachItemHandlers() {
    const items = Array.from(this.element.querySelectorAll('.sector-item'));
    items.forEach((item, index) => {
      item.dataset.index = index;
      
      item.addEventListener('mouseenter', () => {
        this.selectedIndex = index;
        this._updateSelection();
      });

      item.addEventListener('click', () => {
        this.selectedIndex = index;
        this._updateSelection();
        if (this.options.onItemSelect) {
          this.options.onItemSelect(item, index);
        }
      });
    });
  }

  // Публичные методы
  refresh() {
    this._attachItemHandlers();
    this._updateGradients();
    this._updateSelection();
  }

  setSelectedIndex(index) {
    this.selectedIndex = index;
    this._updateSelection();
    this._scrollToSelected();
  }

  destroy() {
    if (this.options.enableArrowNavigation) {
      window.removeEventListener('keydown', this._handleKeyDown.bind(this));
    }
    
    if (this.topGradient) {
      this.topGradient.remove();
    }
    if (this.bottomGradient) {
      this.bottomGradient.remove();
    }
  }
}
