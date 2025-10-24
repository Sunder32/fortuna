import React, { useState } from 'react';
import ClickSpark from './ClickSpark';
import AnimatedList from './AnimatedList';

// Пример использования компонентов для Адского Колеса Судьбы

function HellWheelExample() {
  const [items, setItems] = useState([
    'Алиса',
    'Боб',
    'Кэрол',
    'Дэвид',
    'Ева',
    'Фрэнк',
    'Грейс',
    'Генри'
  ]);

  const handleItemSelect = (item, index) => {
    console.log(`Выбран сектор: ${item} (индекс: ${index})`);
  };

  return (
    <div style={{ 
      padding: '40px',
      background: 'linear-gradient(180deg, #1a0a0a 0%, #0a0101 100%)',
      minHeight: '100vh',
      fontFamily: 'Arial, sans-serif'
    }}>
      <h1 style={{ 
        color: '#ff6b45', 
        textAlign: 'center',
        marginBottom: '40px',
        textShadow: '0 0 20px rgba(255, 107, 69, 0.6)'
      }}>
        🔥 Адское Колесо Судьбы
      </h1>

      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: '1fr 1fr',
        gap: '40px',
        maxWidth: '1200px',
        margin: '0 auto'
      }}>
        {/* Анимированный список */}
        <div>
          <h2 style={{ 
            color: '#ffaa66', 
            marginBottom: '20px',
            fontSize: '1.2em'
          }}>
            📜 Секторы судьбы
          </h2>
          <AnimatedList
            items={items}
            onItemSelect={handleItemSelect}
            showGradients={true}
            enableArrowNavigation={true}
            displayScrollbar={true}
          />
        </div>

        {/* Кнопки с ClickSpark */}
        <div>
          <h2 style={{ 
            color: '#ffaa66', 
            marginBottom: '20px',
            fontSize: '1.2em'
          }}>
            ⚡ Кнопки с эффектом искр
          </h2>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Кнопка вращения */}
            <ClickSpark
              sparkColor='#ff6b45'
              sparkSize={12}
              sparkRadius={25}
              sparkCount={10}
              duration={600}
              extraScale={1.5}
            >
              <button style={{
                width: '100%',
                padding: '16px 32px',
                fontSize: '1.2em',
                fontWeight: 'bold',
                color: '#ffe8d3',
                background: 'linear-gradient(135deg, #ff6b45 0%, #c53030 100%)',
                border: '2px solid #ff8844',
                borderRadius: '12px',
                cursor: 'pointer',
                boxShadow: '0 4px 20px rgba(255, 107, 69, 0.4)',
                transition: 'all 0.2s ease',
                textShadow: '0 2px 4px rgba(0, 0, 0, 0.5)'
              }}
              onMouseEnter={e => {
                e.target.style.transform = 'scale(1.05)';
                e.target.style.boxShadow = '0 6px 30px rgba(255, 107, 69, 0.6)';
              }}
              onMouseLeave={e => {
                e.target.style.transform = 'scale(1)';
                e.target.style.boxShadow = '0 4px 20px rgba(255, 107, 69, 0.4)';
              }}
              >
                🔥 ПРИЗВАТЬ ВРАЩЕНИЕ
              </button>
            </ClickSpark>

            {/* Кнопка добавления */}
            <ClickSpark
              sparkColor='#ffaa66'
              sparkSize={10}
              sparkRadius={20}
              sparkCount={8}
              duration={500}
            >
              <button style={{
                width: '100%',
                padding: '12px 24px',
                fontSize: '1em',
                color: '#ffe8d3',
                background: 'linear-gradient(135deg, #3a1010 0%, #2a0808 100%)',
                border: '1px solid rgba(255, 107, 69, 0.4)',
                borderRadius: '10px',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={e => {
                e.target.style.background = 'linear-gradient(135deg, #4a1515 0%, #3a0a0a 100%)';
                e.target.style.borderColor = 'rgba(255, 107, 69, 0.6)';
              }}
              onMouseLeave={e => {
                e.target.style.background = 'linear-gradient(135deg, #3a1010 0%, #2a0808 100%)';
                e.target.style.borderColor = 'rgba(255, 107, 69, 0.4)';
              }}
              >
                ✍️ Добавить сектор
              </button>
            </ClickSpark>

            {/* Кнопка экспорта */}
            <ClickSpark
              sparkColor='#ffc99d'
              sparkSize={8}
              sparkRadius={18}
              sparkCount={6}
              duration={400}
            >
              <button style={{
                width: '100%',
                padding: '12px 24px',
                fontSize: '1em',
                color: '#ffe8d3',
                background: 'linear-gradient(135deg, #3a1010 0%, #2a0808 100%)',
                border: '1px solid rgba(255, 107, 69, 0.4)',
                borderRadius: '10px',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={e => {
                e.target.style.background = 'linear-gradient(135deg, #4a1515 0%, #3a0a0a 100%)';
                e.target.style.borderColor = 'rgba(255, 107, 69, 0.6)';
              }}
              onMouseLeave={e => {
                e.target.style.background = 'linear-gradient(135deg, #3a1010 0%, #2a0808 100%)';
                e.target.style.borderColor = 'rgba(255, 107, 69, 0.4)';
              }}
              >
                📥 Экспорт
              </button>
            </ClickSpark>
          </div>

          {/* Инструкция */}
          <div style={{
            marginTop: '30px',
            padding: '20px',
            background: 'rgba(42, 10, 10, 0.6)',
            border: '1px solid rgba(255, 107, 69, 0.3)',
            borderRadius: '12px',
            color: '#ffd4b3',
            fontSize: '0.9em',
            lineHeight: '1.6'
          }}>
            <h3 style={{ color: '#ff8844', marginTop: 0 }}>💡 Как использовать:</h3>
            <ul style={{ paddingLeft: '20px' }}>
              <li><strong>Клик по кнопкам</strong> — искры вылетают из точки клика</li>
              <li><strong>↑ ↓</strong> — навигация по списку с клавиатуры</li>
              <li><strong>Enter</strong> — выбрать сектор</li>
              <li><strong>Hover</strong> — огненное свечение слева</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

export default HellWheelExample;
