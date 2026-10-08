'use strict';

const express = require('express');
const { z } = require('zod');
const prisma = require('../lib/prisma');
const requireAuth = require('../middleware/require-auth');
const requireCsrf = require('../middleware/require-csrf');
const validateOrigin = require('../middleware/validate-origin');
const { pushConfigured, sendTestNotification } = require('../services/push.service');

const router = express.Router();
router.use((_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});
router.use(requireAuth);

const endpointSchema = z.string().url().max(3000).refine((value) => {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password;
  } catch {
    return false;
  }
});

const subscriptionSchema = z.object({
  endpoint: endpointSchema,
  keys: z.object({
    p256dh: z.string().min(40).max(400).regex(/^[A-Za-z0-9_-]+$/),
    auth: z.string().min(8).max(200).regex(/^[A-Za-z0-9_-]+$/),
  }).strict(),
}).strict();

router.get('/status', async (req, res, next) => {
  try {
    return res.json({
      configured: pushConfigured(),
      publicKey: pushConfigured() ? process.env.VAPID_PUBLIC_KEY : null,
      subscriptions: await prisma.pushSubscription.count({
        where: { adminId: req.auth.user.id },
      }),
    });
  } catch (error) { return next(error); }
});

router.post('/subscribe', validateOrigin, requireCsrf, async (req, res, next) => {
  try {
    if (!pushConfigured()) {
      return res.status(503).json({ message: 'Web Push ещё не настроен на сервере.' });
    }
    const parsed = subscriptionSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: 'Некорректная Push-подписка.' });
    }
    const { endpoint, keys } = parsed.data;
    await prisma.pushSubscription.upsert({
      where: { endpoint },
      create: {
        adminId: req.auth.user.id,
        endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
        userAgent: String(req.get('user-agent') || '').slice(0, 500),
      },
      update: {
        adminId: req.auth.user.id,
        p256dh: keys.p256dh,
        auth: keys.auth,
        userAgent: String(req.get('user-agent') || '').slice(0, 500),
      },
    });
    return res.status(201).json({ ok: true });
  } catch (error) { return next(error); }
});

router.delete('/subscribe', validateOrigin, requireCsrf, async (req, res, next) => {
  try {
    const parsed = z.object({ endpoint: endpointSchema }).strict().safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: 'Некорректная подписка.' });
    }
    await prisma.pushSubscription.deleteMany({
      where: { adminId: req.auth.user.id, endpoint: parsed.data.endpoint },
    });
    return res.status(204).send();
  } catch (error) { return next(error); }
});

router.post('/test', validateOrigin, requireCsrf, async (req, res, next) => {
  try {
    if (!pushConfigured()) {
      return res.status(503).json({ message: 'Добавьте VAPID-ключи в .env сервера.' });
    }
    const result = await sendTestNotification(req.auth.user.id);
    if (!result.sent) {
      return res.status(409).json({ message: 'Подписки не найдены или доставка не удалась.' });
    }
    return res.json({ ok: true, sent: result.sent });
  } catch (error) { return next(error); }
});

module.exports = router;
