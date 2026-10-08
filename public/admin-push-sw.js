// Только уведомления. Не перехватываем fetch и не кешируем пользовательские данные.
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
  const requested = String(event.notification.data?.url || '/admin/requests');
  let target = new URL('/admin/requests', self.location.origin);
  try {
    const candidate = new URL(requested, self.location.origin);
    if (candidate.origin === self.location.origin && candidate.pathname.startsWith('/admin/')) {
      target = candidate;
    }
  } catch { /* Ignored */ }
  event.waitUntil((async () => {
    const windows = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    const existing = windows.find((client) => {
      const url = new URL(client.url);
      return url.origin === self.location.origin && url.pathname.startsWith('/admin/');
    });
    if (existing) {
      await existing.navigate(target.href);
      return existing.focus();
    }
    return clients.openWindow(target.href);
  })());
});
