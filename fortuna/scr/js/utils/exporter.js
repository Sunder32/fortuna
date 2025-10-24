export class Exporter {
  static exportAsJSON(items, filename = 'wheel-sectors.json') {
    const data = {
      version: '1.0',
      exportDate: new Date().toISOString(),
      sectors: items,
      count: items.length
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    this._download(blob, filename);
  }

  static exportAsText(items, filename = 'wheel-sectors.txt') {
    const text = items.join('\n');
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    this._download(blob, filename);
  }

  static exportAsCSV(items, filename = 'wheel-sectors.csv') {
    const csv = 'Number,Sector\n' + items.map((item, i) => `${i + 1},"${item.replace(/"/g, '""')}"`).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    this._download(blob, filename);
  }

  static exportAsHTML(items, filename = 'wheel-sectors.html') {
    const html = `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Секторы колеса - ${new Date().toLocaleDateString()}</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 800px; margin: 40px auto; padding: 20px; background: #1a1a1a; color: #fff; }
    h1 { color: #ff6b45; }
    ul { list-style: none; padding: 0; }
    li { padding: 12px 20px; margin: 8px 0; background: #2a2a2a; border-left: 4px solid #ff6b45; border-radius: 4px; }
    .count { color: #999; font-size: 14px; }
  </style>
</head>
<body>
  <h1>🎡 Секторы колеса</h1>
  <p class="count">Всего секторов: ${items.length} | Экспорт: ${new Date().toLocaleString()}</p>
  <ul>
${items.map((item, i) => `    <li>${i + 1}. ${this._escapeHtml(item)}</li>`).join('\n')}
  </ul>
</body>
</html>`;
    
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    this._download(blob, filename);
  }

  static exportAsMarkdown(items, filename = 'wheel-sectors.md') {
    const md = `# 🎡 Секторы колеса

**Экспорт:** ${new Date().toLocaleString()}  
**Всего секторов:** ${items.length}

## Список секторов

${items.map((item, i) => `${i + 1}. ${item}`).join('\n')}
`;
    
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    this._download(blob, filename);
  }

  static exportAsXML(items, filename = 'wheel-sectors.xml') {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<wheelSectors>
  <meta>
    <exportDate>${new Date().toISOString()}</exportDate>
    <count>${items.length}</count>
  </meta>
  <sectors>
${items.map((item, i) => `    <sector id="${i + 1}">${this._escapeXml(item)}</sector>`).join('\n')}
  </sectors>
</wheelSectors>`;
    
    const blob = new Blob([xml], { type: 'application/xml;charset=utf-8' });
    this._download(blob, filename);
  }

  static async importFromFile(file) {
    return new Promise((resolve, reject) => {
      const ext = file.name.split('.').pop().toLowerCase();
      
      // ✅ ИЗОБРАЖЕНИЯ (OCR) - обработка отдельно
      if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'].includes(ext)) {
        this._importFromImage(file).then(resolve).catch(reject);
        return;
      }
      
      // ✅ EXCEL - обработка отдельно
      if (['xlsx', 'xls'].includes(ext)) {
        this._importFromExcel(file).then(resolve).catch(reject);
        return;
      }
      
      // ✅ WORD - обработка отдельно
      if (['docx', 'doc'].includes(ext)) {
        this._importFromWord(file).then(resolve).catch(reject);
        return;
      }
      
      // Текстовые форматы
      const reader = new FileReader();
      
      reader.onload = (e) => {
        try {
          const content = e.target.result;
          let items = [];
          
          switch (ext) {
            case 'json':
              const json = JSON.parse(content);
              items = Array.isArray(json) ? json : (json.sectors || []);
              break;
              
            case 'txt':
            case 'md':
              items = content.split('\n')
                .map(line => line.replace(/^\d+\.\s*/, '').trim())
                .filter(line => line && !line.startsWith('#') && !line.startsWith('**'));
              break;
              
            case 'csv':
              items = content.split('\n')
                .slice(1)
                .map(line => {
                  const match = line.match(/^\d+,"?(.+?)"?$/);
                  return match ? match[1].replace(/""/g, '"') : null;
                })
                .filter(Boolean);
              break;
              
            case 'xml':
              const parser = new DOMParser();
              const xmlDoc = parser.parseFromString(content, 'text/xml');
              const sectors = xmlDoc.querySelectorAll('sector');
              items = Array.from(sectors).map(s => s.textContent);
              break;
              
            default:
              items = content.split('\n').map(l => l.trim()).filter(Boolean);
          }
          
          items = items.filter(item => typeof item === 'string' && item.trim());
          resolve(items);
        } catch (err) {
          reject(new Error(`Ошибка парсинга файла: ${err.message}`));
        }
      };
      
      reader.onerror = () => reject(new Error('Ошибка чтения файла'));
      reader.readAsText(file, 'UTF-8');
    });
  }

  // ✅ OCR - распознавание текста из изображений
  static async _importFromImage(file) {
    try {
      // Проверка наличия Tesseract.js
      if (typeof Tesseract === 'undefined') {
        throw new Error('OCR библиотека не загружена. Установите Tesseract.js');
      }

      const { data: { text } } = await Tesseract.recognize(file, 'rus+eng', {
        logger: m => console.log(m)
      });

      // Парсинг распознанного текста
      const items = text.split('\n')
        .map(line => line.replace(/^\d+[\.\)]\s*/, '').trim())
        .filter(line => line && line.length > 1 && line.length < 200);

      if (items.length === 0) {
        throw new Error('На изображении не найден текст');
      }

      return items;
    } catch (err) {
      throw new Error(`Ошибка OCR: ${err.message}`);
    }
  }

  // ✅ EXCEL - импорт из .xlsx, .xls
  static async _importFromExcel(file) {
    try {
      // Проверка наличия библиотеки XLSX
      if (typeof XLSX === 'undefined') {
        throw new Error('Excel библиотека не загружена. Установите SheetJS');
      }

      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      
      // Читаем первый лист
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });
      
      // Извлекаем текст из первой колонки (пропускаем пустые строки)
      const items = rows
        .map(row => String(row[0] || '').trim())
        .filter(item => item && item.length > 0 && item.length < 200);

      if (items.length === 0) {
        throw new Error('Excel файл пуст или не содержит данных в первой колонке');
      }

      return items;
    } catch (err) {
      throw new Error(`Ошибка чтения Excel: ${err.message}`);
    }
  }

  // ✅ WORD - импорт из .docx, .doc
  static async _importFromWord(file) {
    try {
      // Проверка наличия библиотеки Mammoth
      if (typeof mammoth === 'undefined') {
        throw new Error('Word библиотека не загружена. Установите Mammoth.js');
      }

      const arrayBuffer = await file.arrayBuffer();
      const result = await mammoth.extractRawText({ arrayBuffer });
      
      // Парсинг текста
      const items = result.value.split('\n')
        .map(line => line.replace(/^\d+[\.\)]\s*/, '').trim())
        .filter(line => line && line.length > 0 && line.length < 200);

      if (items.length === 0) {
        throw new Error('Word документ пуст');
      }

      return items;
    } catch (err) {
      throw new Error(`Ошибка чтения Word: ${err.message}`);
    }
  }

  static _download(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
  }

  static _escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  static _escapeXml(text) {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
}
