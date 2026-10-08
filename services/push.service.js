'use strict';

const webpush = require('web-push');
const prisma = require('../lib/prisma');

function pushConfigured() {
  return Boolean(
    process.env.VAPID_PUBLIC_KEY &&
      process.env.VAPID_PRIVATE_KEY &&
      process.env.VAPID_SUBJECT,
  );
}

if (pushConfigured()) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT,
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY,
  );
}

async function send(subscriptions, payload) {
  const results = await Promise.allSettled(
    subscriptions.map(async (subscription) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: { p256dh: subscription.p256dh, auth: subscription.auth },
          },
          JSON.stringify(payload),
          { TTL: 3600, timeout: 7000 },
        );
        return true;
      } catch (error) {
        if (error.statusCode === 404 || error.statusCode === 410) {
          await prisma.pushSubscription.deleteMany({
            where: { id: subscription.id },
          });
        } else {
          console.error('Этика волос · ошибка Web Push:', error.message);
        }
        return false;
      }
    }),
  );
  return {
    sent: results.filter((item) => item.status === 'fulfilled' && item.value).length,
  };
}

async function sendNewLeadNotification(lead) {
  if (!pushConfigured()) return { sent: 0, disabled: true };
  const subscriptions = await prisma.pushSubscription.findMany({
    where: { admin: { is: { isActive: true } } },
  });
  return send(subscriptions, {
    title: `Этика волос · Новая заявка №${lead.id}`,
    body: `${lead.name} · ${lead.service || 'Запись в салон'} · ${lead.phone}`.slice(0, 220),
    url: '/admin/requests',
    tag: `etika-lead-${lead.id}`,
  });
}

async function sendNewOrderNotification(order) {
  if (!pushConfigured()) return { sent: 0, disabled: true };
  const subscriptions = await prisma.pushSubscription.findMany({
    where: { admin: { is: { isActive: true, role: 'OWNER' } } },
  });
  return send(subscriptions, {
    title: `Этика волос · Новый заказ ${order.publicNumber}`,
    body: `${order.customerName} · ${(order.total / 100).toLocaleString('ru-RU')} ₽`.slice(0, 220),
    url: '/admin/orders',
    tag: `etika-order-${order.id}`,
  });
}

async function sendTestNotification(adminId) {
  if (!pushConfigured()) return { sent: 0, disabled: true };
  const subscriptions = await prisma.pushSubscription.findMany({
    where: { adminId, admin: { is: { isActive: true } } },
  });
  return send(subscriptions, {
    title: 'Этика волос · Проверка уведомлений',
    body: 'Всё работает! Теперь новые заявки и доступные вам заказы будут приходить сюда.',
    url: '/admin/requests',
    tag: `etika-test-${Date.now()}`,
  });
}

module.exports = {
  pushConfigured,
  sendNewLeadNotification,
  sendNewOrderNotification,
  sendTestNotification,
};
