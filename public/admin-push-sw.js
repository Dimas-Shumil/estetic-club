// Только уведомления. Не перехватываем fetch и не кешируем пользовательские данные.
// Новая версия обработчика кликов должна вступить в силу без закрытия всех вкладок.
self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data?.json() || {}; } catch { /* Некорректный payload */ }
  event.waitUntil(self.registration.showNotification(data.title || 'Этика волос', {
    body: data.body || 'Новое обращение.',
    icon: '/admin-push-icon-192.png',
    badge: '/admin-push-icon-192.png',
    tag: data.tag || `etika-${Date.now()}`,
    renotify: true,
    data: { url: data.url || '/admin/requests' },
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  // Никогда не открываем внешние сайты по данным из push-сообщения.
  const requested = String(event.notification.data?.url || '/admin/requests');
  let target = new URL('/admin/requests', self.location.origin);
  try {
    const candidate = new URL(requested, self.location.origin);
    if (candidate.origin === self.location.origin &&
        candidate.pathname.startsWith('/admin/')) {
      target = candidate;
    }
  } catch { /* Используем безопасный URL по умолчанию */ }

  event.waitUntil((async () => {
    const windowClients = await clients.matchAll({
      type: 'window',
      includeUncontrolled: true,
    });
    const existing = windowClients.find((client) => {
      try {
        const url = new URL(client.url);
        return url.origin === self.location.origin &&
          url.pathname.startsWith('/admin/');
      } catch {
        return false;
      }
    });

    if (existing) {
      try {
        // На desktop сначала активируем вкладку: навигация неактивного
        // клиента в некоторых браузерах может завершиться ошибкой.
        const focused = await existing.focus();
        if (focused && new URL(focused.url).href === target.href) return;
        const navigated = await existing.navigate(target.href);
        if (navigated) {
          await navigated.focus();
          return;
        }
      } catch (error) {
        console.warn('Не удалось открыть существующую вкладку админки:', error);
      }
    }

    // Если вкладка отсутствует или переход не удался, открываем новую.
    const opened = await clients.openWindow(target.href);
    if (opened) await opened.focus();
  })());
});
