import { HellWheel3D } from './wheel3d.js';
import { UI } from './ui.js';
import { audioBus } from './audio.js';
import { debounce } from './utils/debounce.js';
import { confetti } from './utils/confetti.js';

const DEFAULT_LABELS = ['Вариант 1', 'Вариант 2', 'Вариант 3', 'Вариант 4', 
                        'Вариант 5', 'Вариант 6', 'Вариант 7', 'Вариант 8'];

// DOM элементы
const mount = document.getElementById('threeMount');
const resultEl = document.getElementById('resultValue');
const spinBtn = document.getElementById('spinBtn');
const listEl = document.getElementById('sectorsList');
const inputEl = document.getElementById('sectorInput');
const addBtn = document.getElementById('addBtn');
const clearBtn = document.getElementById('clearBtn');
const cbClicks = document.getElementById('clickSoundChk');
const cbAmbient = document.getElementById('bgSoundChk');
const cbFate = document.getElementById('fateChk');
const cbElimination = document.getElementById('eliminationChk');
const cbChaos = document.getElementById('chaosChk');
const sectorsCountEl = document.getElementById('sectorsCount');

// Инициализация аудио
audioBus.initOnFirstGesture();

// 🔥 Добавляем принудительную разблокировку при первом клике ANYWHERE
let audioUnlocked = false;
const unlockAudio = async () => {
  if (audioUnlocked) return;
  audioUnlocked = true;
  
  console.log('🎵 Попытка разблокировать аудио...');
  await audioBus._unlock();
  
  // Показываем toast о разблокировке
  if (audioBus.isUnlocked()) {
    console.log('✅ Аудио разблокировано!');
  }
};

// Слушаем первое взаимодействие на всём документе
['click', 'touchstart', 'keydown'].forEach(eventType => {
  document.addEventListener(eventType, unlockAudio, { once: true, passive: true });
});

// Загрузка сохраненных меток
const saved = (() => {
  try { 
    const data = localStorage.getItem('hellwheel.labels');
    return data ? JSON.parse(data) : [];
  } catch { 
    return []; 
  }
})();

const initialLabels = saved.length ? saved : DEFAULT_LABELS;

// Создание колеса
const wheel = new HellWheel3D(mount, {
  audioBus: audioBus, // 🔊 Передаём аудио систему
  onHit: (strength) => {
    // 🔔 Металлический звон вместо простого клика
    audioBus.playMetalCling(strength);
  },
  onResult: (label) => {
    resultEl.textContent = label || '—';
    ui.setSpinning(false);
    
    if (label) {
      // 🎺 Фанфары победы
      setTimeout(() => {
        audioBus.playVictoryFanfare();
        confetti.launch(150);
      }, 300);
      
      // 🗣️ Голосовое объявление через 1 секунду
      setTimeout(() => {
        audioBus.speak(`Судьба выбрала: ${label}`);
      }, 1000);
    }
  }
});

// Устанавливаем начальные метки
wheel.setLabels(initialLabels);

// Создание UI  
const ui = new UI({
  listEl, inputEl, addBtn, clearBtn, spinBtn, sectorsCountEl,
  checkboxes: { clicks: cbClicks, ambient: cbAmbient, fate: cbFate },
  onChange: (arr) => {
    if (wheel.isSpinning) return;
    
    wheel.setLabels(arr);
    localStorage.setItem('hellwheel.labels', JSON.stringify(arr));
    
    if (!arr || arr.length === 0) {
      resultEl.textContent = '—';
    }
  }
});

// Передаём ссылку на ui в колесо для управления чекбоксом fate
wheel.setUI(ui);

// 🔄 Передаём ссылку на колесо в UI для синхронизации
ui.setWheel(wheel);

// Устанавливаем начальное состояние UI
ui.setInitial(initialLabels);

// 🌀 Обработчик чекбокса режима хаоса
cbChaos?.addEventListener('change', (e) => {
  if (e.target.checked) {
    // Включаем звук хаоса при активации режима
    audioBus.startChaosSound();
  } else {
    // Останавливаем звук хаоса при выключении
    audioBus.stopChaosSound();
  }
});

// Обработчик кнопки вращения
spinBtn?.addEventListener('click', (e) => {
  e.preventDefault();
  if (wheel.isSpinning || ui.items.length < 2) return;

  ui.setSpinning(true);
  
  // 🌀 Проверяем режим хаоса
  const isChaosMode = cbChaos?.checked || false;
  
  // 🌀 Запускаем звук хаоса при вращении, если режим активен
  if (isChaosMode) {
    audioBus.startChaosSound();
  }
  
  wheel.spin(1, isChaosMode);
});

// Обработчик клавиатуры - вращение на пробел
window.addEventListener('keydown', (e) => {
  const activeTag = document.activeElement?.tagName;
  const isInputFocused = ['INPUT', 'TEXTAREA'].includes(activeTag);
  
  // ✅ ПРОБЕЛ - вращение
  if (e.code === 'Space' && !isInputFocused) {
    if (!wheel.isSpinning && ui.items.length >= 2) {
      e.preventDefault();
      ui.setSpinning(true);
      
      // 🌀 Проверяем режим хаоса
      const isChaosMode = cbChaos?.checked || false;
      
      // 🌀 Запускаем звук хаоса при вращении, если режим активен
      if (isChaosMode) {
        audioBus.startChaosSound();
      }
      
      wheel.spin(1, isChaosMode);
    }
  }
  
  // ✅ ESC - закрыть модальное окно
  if (e.code === 'Escape') {
    const modal = document.querySelector('.victory-modal.active');
    if (modal) {
      e.preventDefault();
      const rejectBtn = modal.querySelector('.btn-reject');
      if (rejectBtn) rejectBtn.click();
    }
  }
  
  // ✅ DELETE - удалить выбранный сектор
  if (e.code === 'Delete' && !isInputFocused) {
    const selected = listEl.querySelector('.sector-item.selected');
    if (selected) {
      e.preventDefault();
      const deleteBtn = selected.querySelector('.delete-btn');
      if (deleteBtn) deleteBtn.click();
    }
  }
  
  // ✅ CTRL+A - выбрать все секторы
  if (e.ctrlKey && e.code === 'KeyA' && !isInputFocused) {
    e.preventDefault();
    const items = listEl.querySelectorAll('.sector-item');
    items.forEach(item => item.classList.add('selected'));
  }
});

// Обработчик изменения размера окна с debounce
const debouncedResize = debounce(() => wheel.resize(), 150);
window.addEventListener('resize', debouncedResize, { passive: true });

// Загрузка сохранённых настроек из localStorage
const savedSettings = (() => {
  try {
    const data = localStorage.getItem('hellwheel.settings');
    return data ? JSON.parse(data) : {};
  } catch {
    return {};
  }
})();

// Настройки звука и режимов
if (cbClicks) {
  cbClicks.checked = savedSettings.clicks !== undefined ? savedSettings.clicks : true;
  audioBus.setClickEnabled(cbClicks.checked);
  cbClicks.addEventListener('change', (e) => {
    audioBus.setClickEnabled(e.target.checked);
    saveSettings();
  });
}

if (cbAmbient) {
  cbAmbient.checked = savedSettings.ambient !== undefined ? savedSettings.ambient : false;
  audioBus.setAmbientEnabled(cbAmbient.checked);
  cbAmbient.addEventListener('change', async (e) => {
    // 🔥 Принудительно разблокируем аудио при включении музыки
    if (e.target.checked && !audioBus.isUnlocked()) {
      console.log('🎵 Разблокировка аудио для фоновой музыки...');
      await audioBus._unlock();
    }
    
    audioBus.setAmbientEnabled(e.target.checked);
    saveSettings();
    
    // Показываем подсказку на мобильных
    if (e.target.checked && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) {
      console.log('📱 Мобильное устройство обнаружено - музыка должна запуститься');
    }
  });
}

if (cbFate) {
  cbFate.checked = savedSettings.fate !== undefined ? savedSettings.fate : false;
  wheel.setFateTemptation(cbFate.checked);
  cbFate.addEventListener('change', (e) => {
    wheel.setFateTemptation(e.target.checked);
    saveSettings();
  });
}

if (cbElimination) {
  cbElimination.checked = savedSettings.elimination !== undefined ? savedSettings.elimination : false;
  ui.setEliminationMode(cbElimination.checked);
  cbElimination.addEventListener('change', (e) => {
    ui.setEliminationMode(e.target.checked);
    saveSettings();
  });
}

// Функция сохранения настроек
function saveSettings() {
  try {
    const settings = {
      clicks: cbClicks?.checked ?? true,
      ambient: cbAmbient?.checked ?? false,
      fate: cbFate?.checked ?? false,
      elimination: cbElimination?.checked ?? false
    };
    localStorage.setItem('hellwheel.settings', JSON.stringify(settings));
  } catch (e) {
    console.warn('Не удалось сохранить настройки:', e);
  }
}

// 🔥 Подсказка для мобильных устройств о звуке
if (/iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) {
  const hasSeenHint = localStorage.getItem('hellwheel.audioHintShown');
  if (!hasSeenHint) {
    // Показываем подсказку через 2 секунды после загрузки
    setTimeout(() => {
      const Toast = window.Toast || class {
        static show(msg) { console.log(msg); }
      };
      Toast.show('💡 Коснитесь экрана для активации звука', 3000);
      localStorage.setItem('hellwheel.audioHintShown', 'true');
    }, 2000);
  }
}

// Делаем колесо доступным глобально для отладки
window.wheel = wheel;