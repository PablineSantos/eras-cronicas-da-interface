import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Dev: HMR parcial duplica singletons (EventBus, EraManager, windowStore) e deixa
// Phaser e React dessincronizados (ex.: pop-up sólido mas invisível). Recarrega tudo.
if (import.meta.hot) {
  import.meta.hot.on('vite:beforeUpdate', () => window.location.reload());
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
