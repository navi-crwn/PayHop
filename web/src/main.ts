import { mount } from 'svelte';
import App from './App.svelte';

const root = document.getElementById('root');
if (!root) throw new Error('missing #root');

import './app.css';
export default mount(App, { target: root });

// Offline: the service worker is written by vite.config.ts at build time (dist/sw.js).
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      /* no service worker (private mode, old browser): the site works online as before */
    });
  });
}
