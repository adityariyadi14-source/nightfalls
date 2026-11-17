import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles.css';

// Offline support: cache the app shell so local pass-and-play works without a connection.
if (import.meta.env.PROD && import.meta.env.VITE_ARTIFACT !== '1' && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
