import { HellWheel3D } from './wheel3d.js';
import { UI } from './ui.js';
import { audioBus } from './audio.js';

const DEFAULT_LABELS = ['Вариант 1', 'Вариант 2', 'Вариант 3', 'Вариант 4', 
                        'Вариант 5', 'Вариант 6', 'Вариант 7', 'Вариант 8'];

const mount = document.getElementById('threeMount');
const resultEl = document.getElementById('resultValue');
const spinBtn = document.getElementById('spinBtn');
const listEl = document.getElementById('sectorsList');
const inputEl = document.getElementById('sectorInput');
const addBtn = document.getElementById('addBtn');
const clearBtn = document.getElementById('clearBtn');
const cbClicks = document.getElementById('clickSoundChk');
const cbAmbient = document.getElementById('bgSoundChk');
const sectorsCountEl = document.getElementById('sectorsCount');

audioBus.initOnFirstGesture();

const saved = (() => {
  try { 
    const data = localStorage.getItem('hellwheel.labels');
    return data ? JSON.parse(data) : [];
  } catch { 
    return []; 
  }
})();

const initialLabels = saved.length ? saved : DEFAULT_LABELS;

const wheel = new HellWheel3D(mount, {
  onHit: (strength) => audioBus.click(0.35 + 0.5 * strength, 0.9 + Math.random() * 0.2),
  onResult: (label) => {
    resultEl.textContent = label || '—';
    ui.setSpinning(false);
    spinBtn.disabled = false;
    
    setTimeout(() => {
      const modalButtonsChk = document.getElementById('modalButtonsChk');
      if (modalButtonsChk) {
        modalButtonsChk.disabled = false;
      }
    }, 100);
  }
});

wheel.setLabels(initialLabels);

const ui = new UI({
  listEl, inputEl, addBtn, clearBtn, spinBtn, sectorsCountEl,
  onChange: (arr) => {
    if (wheel.isSpinning) return;
    
    wheel.setLabels(arr);
    localStorage.setItem('hellwheel.labels', JSON.stringify(arr));
    
    if (!arr || arr.length === 0) {
      resultEl.textContent = '—';
    }
  }
});

ui.setInitial(initialLabels);

spinBtn?.addEventListener('click', (e) => {
  e.preventDefault();
  ui.setSpinning(true);
  spinBtn.disabled = true;
  
  // Сбрасываем флаг перекрута только при нажатии кнопки "Призвать вращение"
  wheel.resetRetryFlag();
  
  const modalButtonsChk = document.getElementById('modalButtonsChk');
  if (modalButtonsChk) {
    modalButtonsChk.disabled = true;
  }
  
  wheel.spin();
});

window.addEventListener('resize', () => wheel.resize(), { passive: true });

if (cbClicks) {
  cbClicks.checked = true;
  audioBus.setClickEnabled(true);
  cbClicks.addEventListener('change', (e) => audioBus.setClickEnabled(e.target.checked));
}

if (cbAmbient) {
  cbAmbient.checked = false;
  audioBus.setAmbientEnabled(false);
  cbAmbient.addEventListener('change', (e) => audioBus.setAmbientEnabled(e.target.checked));
}

const modalButtonsChk = document.getElementById('modalButtonsChk');
if (modalButtonsChk) {
  modalButtonsChk.checked = true;
  wheel.setModalButtonsEnabled(true);
  modalButtonsChk.addEventListener('change', (e) => wheel.setModalButtonsEnabled(e.target.checked));
}

window.wheel = wheel;