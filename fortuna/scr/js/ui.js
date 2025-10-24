import { Exporter } from './utils/exporter.js';
import { Toast } from './utils/toast.js';
import { ClickSpark } from './utils/clickspark.js';
import { AnimatedList } from './utils/animatedlist.js';
import { SectorsModal } from './utils/sectorsmodal.js';

export class UI {
  constructor({ listEl, inputEl, addBtn, clearBtn, spinBtn, sectorsCountEl, checkboxes, onChange }) {
    this.listEl  = listEl;
    this.inputEl = inputEl;
    this.addBtn  = addBtn;
    this.clearBtn= clearBtn;
    this.spinBtn = spinBtn;
    this.sectorsCountEl = sectorsCountEl;
    this.checkboxes = checkboxes || {}; // Чекбоксы для блокировки
    this.onChange= onChange;

    this.MAX = 24;
    this.items = [];
    this.isSpinning = false;
    this.eliminationMode = false;
    this._rngBuffer = new Uint32Array(1);

    this.add = this.add.bind(this);
    this.clear = this.clear.bind(this);
    this.onKey = this.onKey.bind(this);
    this.exportData = this.exportData.bind(this);
    this.importData = this.importData.bind(this);

    addBtn?.addEventListener('click', this.add);
    clearBtn?.addEventListener('click', this.clear);
    inputEl?.addEventListener('keydown', this.onKey);
    inputEl?.addEventListener('input', () => this.updateButtons());

    this._setupExportImport();
    this._setupDragDropImport();
    this._initializeAnimations();
    this._setupModal();
    
    this.updateButtons();
  }

  _setupModal() {
    // Убираем модальное окно - теперь используем preview панель
    // Кнопка viewSectorsBtn больше не нужна
  }

  // Обновляем preview панель при изменении списка
  _updatePreview() {
    const previewBody = document.getElementById('sectorsPreview');
    if (!previewBody) return;

    if (this.items.length === 0) {
      previewBody.innerHTML = '<div class="sectors-preview-empty">Список пуст</div>';
      return;
    }

    const html = this.items.map((item, index) => `
      <div class="sectors-preview-item" data-index="${index}">
        <div class="sectors-preview-item-number">${index + 1}</div>
        <div class="sectors-preview-item-text">${this._escapeHtml(item)}</div>
        <div class="sectors-preview-item-actions">
          <button class="preview-btn-edit" data-index="${index}" title="Редактировать" aria-label="Редактировать элемент">✏️</button>
          <button class="preview-btn-delete" data-index="${index}" title="Удалить" aria-label="Удалить элемент">🗑️</button>
        </div>
      </div>
    `).join('');

    previewBody.innerHTML = html;
    
    // Добавляем обработчики событий
    this._attachPreviewHandlers();
  }
  
  _attachPreviewHandlers() {
    const previewBody = document.getElementById('sectorsPreview');
    if (!previewBody) return;
    
    // Обработчики кнопок редактирования
    previewBody.querySelectorAll('.preview-btn-edit').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const index = parseInt(btn.dataset.index);
        this._editItem(index);
      });
    });
    
    // Обработчики кнопок удаления
    previewBody.querySelectorAll('.preview-btn-delete').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const index = parseInt(btn.dataset.index);
        this._deleteItem(index);
      });
    });
  }
  
  _editItem(index) {
    if (index < 0 || index >= this.items.length) return;
    
    const oldValue = this.items[index];
    const newValue = prompt('Редактировать элемент:', oldValue);
    
    if (newValue !== null && newValue.trim() !== '') {
      this.items[index] = newValue.trim();
      this.render();
      this.persist(); // 💾 Сохраняем изменения
      this.wheel?.setLabels(this.items);
      Toast.show('✏️ Элемент изменён', 'success');
    }
  }
  
  _deleteItem(index) {
    if (index < 0 || index >= this.items.length) return;
    
    const item = this.items[index];
    if (confirm(`Удалить "${item}"?`)) {
      this.items.splice(index, 1);
      this.render();
      this.persist(); // 💾 Сохраняем изменения
      this.wheel?.setLabels(this.items);
      Toast.show('🗑️ Элемент удалён', 'success');
    }
  }

  _escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  _initializeAnimations() {
    // ClickSpark эффект для кнопок
    const buttonsToSpark = [
      this.addBtn,
      this.spinBtn,
      document.getElementById('exportBtn'),
      document.getElementById('importBtn')
    ].filter(Boolean);

    this.sparkEffects = buttonsToSpark.map(btn => {
      return new ClickSpark(btn, {
        sparkColor: '#ff6b45',
        sparkSize: 12,
        sparkRadius: 25,
        sparkCount: 10,
        duration: 600,
        extraScale: 1.5
      });
    });

    // AnimatedList для списка секторов - ОТКЛЮЧЁН (используется sectors-preview-panel)
    // if (this.listEl) {
    //   this.animatedList = new AnimatedList(this.listEl, {
    //     showGradients: true,
    //     enableArrowNavigation: true,
    //     displayScrollbar: true,
    //     onItemSelect: (item, index) => {
    //       // Обработка выбора элемента
    //       console.log('Selected:', item.textContent, 'Index:', index);
    //     }
    //   });
    // }
  }

  _setupDragDropImport() {
    if (!this.inputEl) return;

    // === ПОДДЕРЖКА ВСТАВКИ СКРИНШОТОВ CTRL+V ===
    this.inputEl.addEventListener('paste', async (e) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        
        // Проверяем, является ли вставляемый элемент изображением
        if (item.type.indexOf('image') !== -1) {
          e.preventDefault(); // Предотвращаем вставку как текста
          
          const blob = item.getAsFile();
          if (blob) {
            Toast.show('🔍 Распознаём текст на скриншоте...', 'default', 10000);
            
            try {
              const items = await Exporter.importFromFile(blob);
              
              if (!items || items.length === 0) {
                Toast.warning('⚠️ На изображении не найден текст');
                return;
              }

              const trimmed = items.slice(0, this.MAX);
              this.items = trimmed;
              this.render();
              this.persist();
              
              Toast.success(`✅ Распознано ${trimmed.length} ${this._pluralize(trimmed.length)} из скриншота`);
            } catch (err) {
              Toast.error(`❌ Ошибка распознавания: ${err.message}`);
            }
          }
          break;
        }
      }
    });

    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
      this.inputEl.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
      }, false);
    });

    this.inputEl.addEventListener('dragenter', () => {
      this.inputEl.classList.add('drag-over');
    });

    this.inputEl.addEventListener('dragleave', (e) => {
      if (e.target === this.inputEl) {
        this.inputEl.classList.remove('drag-over');
      }
    });

    this.inputEl.addEventListener('drop', async (e) => {
      this.inputEl.classList.remove('drag-over');
      
      const items = e.dataTransfer.items;
      const files = e.dataTransfer.files;
      
      if (items && items.length > 0) {
        const item = items[0];
        
        if (item.kind === 'file') {
          const file = item.getAsFile();
          if (file) {
            await this._handleDroppedFile(file);
          }
        } else if (item.kind === 'string' && item.type === 'text/plain') {
          item.getAsString((text) => {
            if (this.inputEl.value) {
              this.inputEl.value += '\n' + text;
            } else {
              this.inputEl.value = text;
            }
            this.updateButtons();
          });
        }
      } else if (files && files.length > 0) {
        await this._handleDroppedFile(files[0]);
      }
    });
  }

  async _handleDroppedFile(file) {
    if (this.isSpinning) return;

    // ✅ ПРОВЕРКА РАЗМЕРА ФАЙЛА (макс 10MB для изображений, 5MB для остальных)
    const fileExt = '.' + file.name.split('.').pop().toLowerCase();
    const isImage = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'].includes(fileExt);
    const MAX_FILE_SIZE = isImage ? 10 * 1024 * 1024 : 5 * 1024 * 1024;
    
    if (file.size > MAX_FILE_SIZE) {
      Toast.error(`❌ Файл слишком большой! Максимум ${MAX_FILE_SIZE / 1024 / 1024} МБ (текущий: ${(file.size / 1024 / 1024).toFixed(2)} МБ)`);
      return;
    }

    const validExtensions = [
      '.json', '.txt', '.csv', '.html', '.md', '.xml',      // Текстовые
      '.xlsx', '.xls',                                       // Excel
      '.docx', '.doc',                                       // Word
      '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'      // Изображения (OCR)
    ];
    
    if (!validExtensions.includes(fileExt)) {
      Toast.warning(`⚠️ Неподдерживаемый формат: ${fileExt}`);
      return;
    }

    try {
      // ✅ Показываем индикатор для долгих операций (OCR, Excel)
      if (isImage) {
        Toast.show('🔍 Распознаём текст на изображении...', 'default', 10000);
      } else if (['.xlsx', '.xls', '.docx', '.doc'].includes(fileExt)) {
        Toast.show('📄 Читаем документ...', 'default', 5000);
      }
      
      const items = await Exporter.importFromFile(file);
      
      if (!items || items.length === 0) {
        Toast.warning('⚠️ Файл не содержит данных');
        return;
      }

      const trimmed = items.slice(0, this.MAX);
      this.items = trimmed;
      this.render();
      this.persist();
      
      const skipped = items.length - trimmed.length;
      if (skipped > 0) {
        Toast.warning(`✅ Импортировано ${trimmed.length} секторов (${skipped} пропущено)`);
      } else {
        Toast.success(`✅ Импортировано ${trimmed.length} ${this._pluralize(trimmed.length)} из ${file.name}`);
      }
    } catch (err) {
      Toast.error(`❌ Ошибка импорта: ${err.message}`);
    }
  }

  _setupExportImport() {
    const exportBtn = document.getElementById('exportBtn');
    const importBtn = document.getElementById('importBtn');
    const importFile = document.getElementById('importFile');

    if (exportBtn) {
      exportBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.showExportMenu();
      });
    }

    if (importBtn && importFile) {
      importBtn.addEventListener('click', (e) => {
        e.preventDefault();
        importFile.click();
      });
      
      importFile.addEventListener('change', async (e) => {
        const file = e.target.files?.[0];
        if (file) {
          await this.importData(file);
          e.target.value = '';
        }
      });
    }
  }

  showExportMenu() {
    if (this.items.length === 0) {
      this._showNotification('⚠️ Нечего экспортировать');
      return;
    }

    const menu = document.createElement('div');
    menu.className = 'export-menu';
    menu.innerHTML = `
      <div class="export-menu-overlay"></div>
      <div class="export-menu-content">
        <h3>Экспорт секторов</h3>
        <p>Выберите формат файла:</p>
        <div class="export-buttons">
          <button data-format="json">📄 JSON</button>
          <button data-format="txt">📝 Text</button>
          <button data-format="csv">📊 CSV</button>
          <button data-format="html">🌐 HTML</button>
          <button data-format="md">📋 Markdown</button>
          <button data-format="xml">🔖 XML</button>
        </div>
        <button class="export-close">Отмена</button>
      </div>
    `;

    document.body.appendChild(menu);

    menu.querySelectorAll('[data-format]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.exportData(btn.dataset.format);
        document.body.removeChild(menu);
      });
    });

    menu.querySelector('.export-close').addEventListener('click', () => {
      document.body.removeChild(menu);
    });

    menu.querySelector('.export-menu-overlay').addEventListener('click', () => {
      document.body.removeChild(menu);
    });
  }

  exportData(format) {
    const timestamp = new Date().toISOString().slice(0, 10);
    
    switch (format) {
      case 'json':
        Exporter.exportAsJSON(this.items, `wheel-sectors-${timestamp}.json`);
        this._showNotification('✅ Экспорт JSON выполнен');
        break;
      case 'txt':
        Exporter.exportAsText(this.items, `wheel-sectors-${timestamp}.txt`);
        this._showNotification('✅ Экспорт TXT выполнен');
        break;
      case 'csv':
        Exporter.exportAsCSV(this.items, `wheel-sectors-${timestamp}.csv`);
        this._showNotification('✅ Экспорт CSV выполнен');
        break;
      case 'html':
        Exporter.exportAsHTML(this.items, `wheel-sectors-${timestamp}.html`);
        this._showNotification('✅ Экспорт HTML выполнен');
        break;
      case 'md':
        Exporter.exportAsMarkdown(this.items, `wheel-sectors-${timestamp}.md`);
        this._showNotification('✅ Экспорт Markdown выполнен');
        break;
      case 'xml':
        Exporter.exportAsXML(this.items, `wheel-sectors-${timestamp}.xml`);
        this._showNotification('✅ Экспорт XML выполнен');
        break;
    }
  }

  async importData(file) {
    if (this.isSpinning) return;

    try {
      const items = await Exporter.importFromFile(file);
      
      if (!items || items.length === 0) {
        this._showNotification('⚠️ Файл не содержит данных');
        return;
      }

      const trimmed = items.slice(0, this.MAX);
      this.items = trimmed;
      this.render();
      this.persist();
      
      // 🔄 Обновляем колесо после импорта
      if (this.wheel) {
        this.wheel.setLabels(this.items);
      }
      
      const skipped = items.length - trimmed.length;
      if (skipped > 0) {
        this._showNotification(`✅ Импортировано ${trimmed.length} секторов (${skipped} пропущено из-за лимита)`);
      } else {
        this._showNotification(`✅ Импортировано ${trimmed.length} секторов`);
      }
    } catch (err) {
      this._showNotification(`❌ Ошибка импорта: ${err.message}`);
    }
  }

  // ---------- Public API ----------
  setInitial(arr) {
    this.items = sanitizeArray(arr).slice(0, this.MAX);
    this.render();
    // НЕ вызываем onChange при инициализации
  }
  
  // 🔄 Устанавливаем ссылку на колесо для синхронизации
  setWheel(wheel) {
    this.wheel = wheel;
  }
  
  getItems() {
    return this.items.slice();
  }

  shuffleItems() {
    if (this.isSpinning || this.items.length < 2) return;
    const arr = this.items.slice();
    for (let i = arr.length - 1; i > 0; i--) {
      const j = this._randomIndex(i + 1);
      if (j !== i) {
        const tmp = arr[i];
        arr[i] = arr[j];
        arr[j] = tmp;
      }
    }
    this.items = arr;
    this.render();
    this.persist();
  }

  setSpinning(spinning) {
    this.isSpinning = spinning;
    this.updateButtons();
    this.render();
    
    // 🔒 Блокируем ВСЕ чекбоксы во время вращения
    if (this.checkboxes.fate) this.checkboxes.fate.disabled = spinning;
    if (this.checkboxes.clicks) this.checkboxes.clicks.disabled = spinning;
    if (this.checkboxes.ambient) this.checkboxes.ambient.disabled = spinning;
    
    // 🌀 БЛОКИРУЕМ чекбокс ХАОСА во время вращения
    const chaosChk = document.getElementById('chaosChk');
    if (chaosChk) chaosChk.disabled = spinning;
    
    // 🔒 Блокируем чекбокс исключения
    const eliminationChk = document.getElementById('eliminationChk');
    if (eliminationChk) eliminationChk.disabled = spinning;
  }
  
  setEliminationMode(enabled) {
    this.eliminationMode = enabled;
  }
  
  eliminateSector(label) {
    if (!this.eliminationMode || !label) return;
    
    const index = this.items.findIndex(item => item === label);
    if (index === -1) return;
    
    const row = this.listEl.querySelector(`[data-index="${index}"]`);
    if (row) {
      row.classList.add('removing');
      setTimeout(() => {
        this.items.splice(index, 1);
        this.render();
        this.persist();
      }, 350);
    } else {
      this.items.splice(index, 1);
      this.render();
      this.persist();
    }
  }
  
  unlockFateCheckbox() {
    if (this.checkboxes.fate) this.checkboxes.fate.disabled = false;
  }

  // ---------- Handlers ----------
  onKey(e) {
    // Enter - добавить текущий текст как один вариант (даже если многострочный)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      this.addSingle();
    }
  }

  // Добавить текущий текст как один вариант
  addSingle() {
    if (this.isSpinning) return;
    
    const rawValue = this.inputEl?.value || '';
    const v = norm(rawValue);
    if (!v) return;
    
    if (this.items.length >= this.MAX) {
      this._showNotification(`⚠️ Достигнут лимит в ${this.MAX} секторов`);
      return;
    }
    
    this.items.push(v);
    this.inputEl.value = '';
    this.render();
    this.persist();
  }

  // Добавить текст (используется кнопкой "Записать")
  add() {
    if (this.isSpinning) return;
    
    const rawValue = this.inputEl?.value || '';
    if (!rawValue.trim()) return;
    
    // Проверяем наличие переносов строк (для вставки списка)
    const hasMultipleLines = rawValue.includes('\n');
    
    if (hasMultipleLines) {
      // Многострочный ввод - разбиваем по строкам и добавляем каждую как отдельный элемент
      const lines = rawValue.split('\n').map(line => norm(line)).filter(Boolean);
      
      let addedCount = 0;
      for (const line of lines) {
        if (this.items.length >= this.MAX) break;
        this.items.push(line);
        addedCount++;
      }
      
      if (addedCount > 0) {
        this.inputEl.value = '';
        this.render();
        this.persist();
        this._showNotification(`✅ Добавлено ${addedCount} элементов из списка`);
      } else if (this.items.length >= this.MAX) {
        this._showNotification(`⚠️ Достигнут лимит в ${this.MAX} секторов`);
      }
    } else {
      // Однострочный ввод
      this.addSingle();
    }
  }

  clear() {
    if (this.isSpinning) return;
    
    if (this.items.length === 0) return;
    
    const rows = this.listEl.querySelectorAll('.sector-row');
    if (rows.length > 0) {
      rows.forEach((row, i) => {
        setTimeout(() => {
          row.classList.add('removing');
        }, i * 50);
      });
      
      setTimeout(() => {
        this.items = [];
        this.render();
        this.persist();
        this.inputEl?.focus();
      }, rows.length * 50 + 350);
    } else {
      this.items = [];
      this.render();
      this.persist();
      this.inputEl?.focus();
    }
  }

  removeAt(idx) {
    if (this.isSpinning) return;
    
    const row = this.listEl.querySelector(`[data-index="${idx}"]`);
    if (row) {
      row.classList.add('removing');
      setTimeout(() => {
        this.items.splice(idx, 1);
        this.render();
        this.persist();
        // 🔄 Обновляем колесо после удаления
        if (this.wheel) {
          this.wheel.setLabels(this.items);
        }
      }, 350);
    } else {
      this.items.splice(idx, 1);
      this.render();
      this.persist();
      // 🔄 Обновляем колесо после удаления
      if (this.wheel) {
        this.wheel.setLabels(this.items);
      }
    }
  }

  reorder(fromIndex, toIndex) {
    if (this.isSpinning) return;
    if (fromIndex === toIndex) return;
    if (fromIndex < 0 || fromIndex >= this.items.length) return;
    if (toIndex < 0 || toIndex >= this.items.length) return;

    const item = this.items.splice(fromIndex, 1)[0];
    this.items.splice(toIndex, 0, item);
    
    this.render();
    this.persist();
    // 🔄 Обновляем колесо после перестановки
    if (this.wheel) {
      this.wheel.setLabels(this.items);
    }
  }

  // ---------- Render ----------
  render() {
    this.listEl.innerHTML = '';

    if (!this.items.length) {
      // Показываем пустое состояние с анимацией
      const emptyState = document.createElement('div');
      emptyState.className = 'sectors-list-empty';
      emptyState.textContent = 'Записи в манускрипт ещё не начертаны...';
      this.listEl.appendChild(emptyState);
      this.updateButtons();
      this._updatePreview(); // Обновляем preview
      return;
    }

    this.items.forEach((txt, i) => {
      const li = document.createElement('li');
      li.className = 'sector-row sector-item'; // Добавили sector-item для анимаций
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
      label.addEventListener('dblclick', () => this.beginEdit(i, li));

      const actions = document.createElement('div');
      actions.className = 'sector-actions';

      const edit = document.createElement('button');
      edit.className = 'edit';
      edit.type = 'button';
      edit.title = this.isSpinning ? 'Editing disabled while spinning' : 'Edit value';
      edit.setAttribute('aria-label', `Edit <${txt}>`);
      edit.innerHTML = '&#9998;';
      edit.disabled = this.isSpinning;
      edit.style.opacity = this.isSpinning ? '0.3' : '1';
      edit.style.cursor = this.isSpinning ? 'not-allowed' : 'pointer';
      edit.addEventListener('click', () => this.beginEdit(i, li));

      const kill = document.createElement('button');
      kill.className = 'kill';
      kill.type = 'button';
      kill.title = this.isSpinning ? 'Removal disabled while spinning' : 'Remove';
      kill.setAttribute('aria-label', `Remove <${txt}>`);
      kill.innerHTML = '&times;';
      kill.disabled = this.isSpinning;
      kill.style.opacity = this.isSpinning ? '0.3' : '1';
      kill.style.cursor = this.isSpinning ? 'not-allowed' : 'pointer';
      kill.addEventListener('click', () => this.removeAt(i));

      actions.append(edit, kill);
      li.append(label, actions);
      this.listEl.appendChild(li);
    });

    // Обновляем анимированный список после рендера - ОТКЛЮЧЕНО
    // if (this.animatedList) {
    //   this.animatedList.refresh();
    // }

    this.updateButtons();
    this._updatePreview(); // Обновляем preview
  }

  beginEdit(index, li) {
    if (this.isSpinning) return;

    const title = li.querySelector('.sector-title');
    if (!title) return;

    const current = this.items[index] ?? '';
    const input = document.createElement('input');
    input.type = 'text';
    input.value = current;
    input.maxLength = 70;
    input.className = 'sector-edit';

    title.textContent = '';
    title.appendChild(input);
    input.focus();
    input.select();

    let resolved = false;
    const finalize = (commit) => {
      if (resolved) return;
      resolved = true;
      if (commit) {
        const next = norm(input.value);
        if (next) {
          this.items[index] = next;
        } else {
          this.items.splice(index, 1);
        }
        this.render();
        this.persist();
      } else {
        this.render();
      }
    };

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        finalize(true);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        finalize(false);
      }
    });

    input.addEventListener('blur', () => finalize(true));
  }

  // ---------- Helpers ----------
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
      this.spinBtn.disabled = this.items.length < 2 || this.isSpinning;
    }

    // Обновляем счётчик в бейдже кнопки просмотра
    const countBadge = document.getElementById('sectorsCountBadge');
    if (countBadge) {
      countBadge.textContent = this.items.length;
    }
    
    // Старый счётчик (если остался)
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

  // Заменено на Toast.js - старый метод удалён
  _showNotification(message) {
    // Автоопределение типа по emoji
    if (message.startsWith('✅')) {
      Toast.success(message);
    } else if (message.startsWith('❌')) {
      Toast.error(message);
    } else if (message.startsWith('⚠️')) {
      Toast.warning(message);
    } else {
      Toast.show(message);
    }
  }

  _randomIndex(limit) {
    if (limit <= 0) return 0;
    if (typeof window !== 'undefined' && window.crypto?.getRandomValues) {
      window.crypto.getRandomValues(this._rngBuffer);
      return this._rngBuffer[0] % limit;
    }
    return Math.floor(Math.random() * limit);
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

// ---------- Utils ----------
function norm(s) {
  return String(s)
    .replace(/\s+/g, ' ')
    .replace(/<[^>]+>/g, '')
    .trim();
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