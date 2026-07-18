import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import AppCloud from './AppCloud';
import './index.css';

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js').catch((error) => {
      console.warn('Không thể đăng ký service worker:', error);
    });
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppCloud />
  </StrictMode>,
);
