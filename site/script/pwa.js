(() => {
  'use strict';
  if (!window.isSecureContext || !('serviceWorker' in navigator) || /^\/admin(?:\/|$)/.test(location.pathname)) return;
  const standalone = window.matchMedia('(display-mode: standalone)');
  const isApp = () => standalone.matches || navigator.standalone === true;
  const read = key => { try { return localStorage.getItem(key); } catch { return null; } };
  const write = (key, value) => { try { localStorage.setItem(key, value); } catch { /* private browsing */ } };
  const snoozeKey = 'etika-pwa-later-until';
  const installedKey = 'etika-pwa-installed';
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  let deferredPrompt = null;
  let banner;
  let observer;
  let dismissed = false;
  const hide = () => {
    banner?.remove(); banner = null; observer?.disconnect();
    document.documentElement.classList.remove('has-pwa-banner');
    document.documentElement.style.removeProperty('--pwa-banner-height');
  };
  const later = () => { write(snoozeKey, String(Date.now() + 2 * 24 * 60 * 60 * 1000)); dismissed = true; hide(); };
  const installed = () => { write(installedKey, '1'); deferredPrompt = null; hide(); };
  function show() {
    if (!document.body || banner || dismissed || isApp() || Date.now() < Number(read(snoozeKey)) || read(installedKey) === '1') return;
    banner = document.createElement('aside');
    banner.className = 'pwa-banner';
    banner.setAttribute('aria-label', 'Установка приложения');
    banner.innerHTML = `<div class="pwa-banner__inner"><img class="pwa-banner__icon" src="/pwa/icon-brown-192.png" alt="" width="48" height="48"><div class="pwa-banner__copy"><strong>Этика волос — всегда рядом</strong><p>Установите приложение для удобной записи к мастеру.</p><p class="pwa-banner__help" hidden role="status"></p></div><div class="pwa-banner__actions"><button type="button" class="pwa-banner__install">Установить</button><button type="button" class="pwa-banner__later">Позже</button></div></div>`;
    document.body.prepend(banner);
    document.documentElement.classList.add('has-pwa-banner');
    const measure = () => document.documentElement.style.setProperty('--pwa-banner-height', `${Math.ceil(banner.getBoundingClientRect().height)}px`);
    if ('ResizeObserver' in window) { observer = new ResizeObserver(measure); observer.observe(banner); }
    measure();
    banner.querySelector('.pwa-banner__later').addEventListener('click', later);
    banner.querySelector('.pwa-banner__install').addEventListener('click', async () => {
      const button = banner.querySelector('.pwa-banner__install');
      const help = banner.querySelector('.pwa-banner__help');
      if (!deferredPrompt) {
        help.textContent = ios
          ? 'В меню браузера нажмите «Поделиться», затем «На экран Домой» и «Добавить». Если пункта нет — откройте сайт в Safari.'
          : 'Откройте меню браузера и выберите «Установить приложение» или «Добавить на главный экран». Если пункта нет — откройте сайт в Chrome или Edge.';
        help.hidden = false; measure(); return;
      }
      const prompt = deferredPrompt; deferredPrompt = null; button.disabled = true;
      try {
        await prompt.prompt();
        const choice = await prompt.userChoice;
        if (choice.outcome === 'dismissed') later();
        else hide();
      } catch {
        help.textContent = 'Откройте меню браузера и выберите «Установить приложение».';
        help.hidden = false;
      } finally { button.disabled = false; }
    });
  }
  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault(); deferredPrompt = event;
    // A fresh install prompt also means a previous installation was removed.
    write(installedKey, ''); show();
  });
  window.addEventListener('appinstalled', installed);
  standalone.addEventListener?.('change', () => { if (isApp()) installed(); });
  window.addEventListener('storage', event => {
    if (event.key === installedKey && event.newValue === '1') hide();
    if (event.key === snoozeKey && Number(event.newValue) > Date.now()) hide();
  });
  if (isApp()) installed();
  navigator.serviceWorker.register('/pwa-sw.js', { scope: '/', updateViaCache: 'none' }).catch(error => console.warn('PWA:', error));
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', show, { once: true });
  else show();
})();
