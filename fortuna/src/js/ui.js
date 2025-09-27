export class UI {
  constructor({ listEl, inputEl, addBtn, clearBtn, spinBtn, sectorsCountEl, onChange }) {
    this.listEl  = listEl;
    this.inputEl = inputEl;
    this.addBtn  = addBtn;
    this.clearBtn= clearBtn;
    this.spinBtn = spinBtn;
    this.sectorsCountEl = sectorsCountEl;
    this.onChange= onChange;

    this.MAX = 24;
    this.items = [];
    this.isSpinning = false;

    this.add = this.add.bind(this);
    this.clear = this.clear.bind(this);
    this.onKey = this.onKey.bind(this);

    addBtn?.addEventListener('click', this.add);
    clearBtn?.addEventListener('click', this.clear);
    inputEl?.addEventListener('keydown', this.onKey);
    inputEl?.addEventListener('input', () => this.updateButtons());

    this.updateButtons();
  }

  setInitial(arr) {
    this.items = sanitizeArray(arr).slice(0, this.MAX);
    this.render();
  }
  
  setSpinning(spinning) {
    this.isSpinning = spinning;
    this.updateButtons();
    this.render();
  }

  onKey(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      this.add();
    }
  }

  add() {
    if (this.isSpinning) return;
    
    const v = norm(this.inputEl?.value || '');
    if (!v) return;
    if (this.items.length >= this.MAX) return;
    this.items.push(v);
    this.inputEl.value = '';
    this.render();
    this.persist();
  }

  clear() {
    if (this.isSpinning) return;
    
    this.items = [];
    this.render();
    this.persist();
    this.inputEl?.focus();
  }

  removeAt(idx) {
    if (this.isSpinning) return;
    
    this.items.splice(idx, 1);
    this.render();
    this.persist();
  }

  render() {
    this.listEl.innerHTML = '';

    if (!this.items.length) {
      this.updateButtons();
      return;
    }

    this.items.forEach((txt, i) => {
      const li = document.createElement('li');
      li.className = 'sector-row';
      li.draggable = !this.isSpinning;
      li.dataset.index = i;

      if (!this.isSpinning) {
        li.addEventListener('dragstart', (e) => {
          e.dataTransfer.setData('text/plain', String(i));
          li.classList.add('dragging');
        });
        li.addEventListener('dragend', () => li.classList.remove('dragging'));
        li.addEventListener('dragover', (e) => { e.preventDefault(); li.classList.add('dragover'); });
        li.addEventListener('dragleave', () => li.classList.remove('dragover'));
        li.addEventListener('drop', (e) => {
          e.preventDefault();
          li.classList.remove('dragover');
          const from = Number(e.dataTransfer.getData('text/plain'));
          const to   = Number(li.dataset.index);
          if (Number.isFinite(from) && Number.isFinite(to) && from !== to) {
            this.reorder(from, to);
          }
        });
      }

      const label = document.createElement('div');
      label.className = 'sector-title';
      label.textContent = txt;

      const kill = document.createElement('button');
      kill.className = 'kill';
      kill.type = 'button';
      kill.title = this.isSpinning ? 'Нельзя удалять во время вращения' : 'Удалить';
      kill.setAttribute('aria-label', `Удалить «${txt}»`);
      kill.innerHTML = '✖';
      kill.disabled = this.isSpinning;
      kill.style.opacity = this.isSpinning ? '0.3' : '1';
      kill.style.cursor = this.isSpinning ? 'not-allowed' : 'pointer';
      kill.addEventListener('click', () => this.removeAt(i));

      li.append(label, kill);
      this.listEl.appendChild(li);
    });

    this.updateButtons();
  }

  reorder(from, to) {
    if (this.isSpinning) return;
    
    const arr = this.items.slice();
    const [moved] = arr.splice(from, 1);
    arr.splice(to, 0, moved);
    this.items = arr;
    this.render();
    this.persist();
  }

  updateButtons() {
    const hasInput = !!norm(this.inputEl?.value || '');
    const hasItems = this.items.length > 0;

    if (this.addBtn) {
      this.addBtn.disabled = !hasInput || this.items.length >= this.MAX || this.isSpinning;
      this.addBtn.title = this.isSpinning ? 'Нельзя добавлять во время вращения' : 'Добавить вариант';
    }
    
    if (this.clearBtn) {
      this.clearBtn.disabled = !hasItems || this.isSpinning;
      this.clearBtn.title = this.isSpinning ? 'Нельзя очищать во время вращения' : 'Очистить все';
    }
    
    if (this.spinBtn) {
      this.spinBtn.disabled = this.items.length < 2;
    }

    if (this.sectorsCountEl) {
      this.sectorsCountEl.textContent = this.items.length;
    }
    
    if (this.inputEl) {
      this.inputEl.disabled = this.isSpinning;
      this.inputEl.placeholder = this.isSpinning ? 
        'Дождитесь остановки колеса...' : 
        'Добавить сектор (например, Клык)';
    }
  }

  notify() {
    this.onChange?.(this.items.slice());
  }

  persist() {
    try { 
      localStorage.setItem('hellwheel.labels', JSON.stringify(this.items)); 
      this.notify();
    } catch {}
  }
}

function norm(s) {
  return String(s)
    .replace(/\s+/g, ' ')
    .replace(/<[^>]+>/g, '')
    .trim()
    .slice(0, 28);
}

function sanitizeArray(arr) {
  if (!Array.isArray(arr)) return [];
  const out = [];
  for (const v of arr) {
    const t = norm(v);
    if (t) out.push(t);
  }
  return out;
}