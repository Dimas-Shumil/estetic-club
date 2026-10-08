# Этика волос — Web Push (заявки и заказы)

Готовая интеграция для текущей админки. Изначально ориентирована на коммит `12a97ae` с мобильной навигацией.

## Возможности

- Новая заявка после фактического сохранения `Lead`: push OWNER и STAFF, у которых подключено устройство.
- Новый заказ после фактического сохранения `Order`: push только OWNER (сотрудникам заказы недоступны).
- Повторный запрос заказа по `idempotencyKey` не отправляет второй push.
- Ошибки Web Push не отменяют создание заявки/заказа и не блокируют email.
- В админке на всех страницах есть кнопка «Уведомления»: включить, проверить, отключить.
- Push открывает раздел «Заявки» или «Заказы» текущего домена.
- Истёкшие подписки удаляются при ответе push-сервиса `404` / `410`.
- Только авторизованные администраторы, state-changing API защищено Origin и CSRF.

## 1. Компьютер отца (Windows)

1. Распаковать ZIP в `C:\Users\ШУМ\WORKS\estetic-club` **с сохранением структуры папок**.
2. Проверить `git status`: должны появиться изменения backend, админских файлов, `prisma/schema.prisma`, новая миграция, сервис-воркер и PWA-файлы. БД и `.env` не затрагиваем.
3. Выполнить из корня проекта:

```cmd
npm ci
npx prisma validate
node --check server.js
node --check site/script/admin/admin.js
git diff --check
```

4. Для локальной проверки БД (только если `DATABASE_URL` настроена для локальной БД):

```cmd
npx prisma migrate deploy
npx prisma generate
```

5. Коммитить в репозиторий компьютера отца:

```cmd
git add admin-pages package.json package-lock.json prisma/schema.prisma prisma/migrations/20261008143000_add_push_subscriptions public/admin.webmanifest public/admin-push-sw.js public/admin-push-icon-192.png public/admin-push-icon-512.png routes/orders.routes.js routes/push.routes.js services/push.service.js server.js site/css/admin-push.css site/styles/admin/push.scss site/script/admin/admin.js PUSH_SETUP.md
git commit -m "feat: add web push notifications for leads and orders"
git push origin main
```

## 2. Сервер (НЕ выполнять до проверки Git и резервной копии БД)

Сервер проекта: `cv7752329`, путь `/var/www/kultura-volos`, PM2 `kultura-volos`.

```bash
cd /var/www/kultura-volos
git status
```

Перед миграцией проверьте расположение текущего SQLite-файла через `DATABASE_URL` в `.env` **без отправки секретов в чат** и создайте копию работающей БД (при активных WAL-файлах предпочтителен SQLite backup). Не заменять и не удалять БД.

```bash
git pull --ff-only origin main
npm ci --include=dev
npx prisma migrate deploy
npx prisma generate
```

Генерируем **одну отдельную пару VAPID-ключей для «Этики волос»** (один раз; не регенерировать при каждом деплое):

```bash
npx web-push generate-vapid-keys
```

Откройте `.env` сервера (например `nano .env`) и **добавьте реальные значения**, полученные генератором:

```dotenv
VAPID_PUBLIC_KEY=<сгенерированный publicKey>
VAPID_PRIVATE_KEY=<сгенерированный privateKey>
VAPID_SUBJECT=mailto:<контактный-email-администратора>
```

**Не добавлять `.env` и секреты в Git**. После обновления ключей:

```bash
pm2 restart kultura-volos --update-env
pm2 status
pm2 logs kultura-volos --lines 60
```

### Проверка

1. Открыть админку на HTTPS-домене сайта, войти в аккаунт.
2. Нажать «Уведомления» → «Включить на устройстве» → разрешить показ.
3. Нажать «Проверить». Это отправит тестовый push на подписанные устройства именно этого администратора.
4. Проверить реальные сценарии через публичные формы сайта: новую заявку и новый заказ. Push о заказе приходит только OWNER.
5. Для iPhone с iOS 16.4+ сначала через Safari «Поделиться» → «На экран Домой», запустить установленную админку и только там включить уведомления.

**Ограничения:** необходим HTTPS и поддержка Push API в браузере; пользователь должен разрешить уведомления; доставка зависит от push-сервисов Apple/Google/Mozilla и не гарантируется при блокировках сети. При замене VAPID-ключей старые подписки нужно подключить заново.
