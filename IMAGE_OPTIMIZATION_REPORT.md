# Оптимизация изображений — «Культура волос»

Дата: 18 июля 2026 года.

## Результат

- Обработано исходных изображений: **18**.
- Создано WebP-файлов: **54**, включая responsive-варианты.
- Исходный вес каталога `site/img`: **23,29 МиБ**.
- Итоговый вес каталога `site/img`: **2,72 МиБ**.
- Уменьшение физического веса каталога: примерно **88,3%**.
- Полноразмерные WebP-версии весят **1,47 МиБ** против **23,29 МиБ** исходников — примерно **93,7% экономии**.
- Все 54 WebP-файла прошли проверку декодирования.
- Все статические URL WebP, используемые HTML и CSS, проверены через локальный HTTP-сервер: ошибок выдачи нет.
- Синтаксис JavaScript проверен командой `node --check`.

## Что изменено

- Фотографии JPG, JPEG и PNG переведены в WebP.
- Подготовлены варианты шириной 320, 480, 768, 1200 и 1280 пикселей там, где они оправданы.
- В статической HTML-разметке добавлены `width`, `height`, `decoding="async"`, `loading`, `srcset` и `sizes`.
- На каждой странице оставлено не более одного `fetchpriority="high"` для основного LCP-изображения.
- Изображения ниже первого экрана переведены на `loading="lazy"`.
- Главный CSS-фон использует отдельные desktop и mobile WebP-файлы.
- Для CSS hero добавлены preload-ссылки с взаимоисключающими media-условиями.
- Динамические изображения блога, работ, услуг и каталога получают безопасные атрибуты через `site/script/image-performance.js`.
- Пути обновлены в HTML, SCSS, CSS, JavaScript, Prisma schema, seed и локальной базе.
- Добавлена команда `npm run images:migrate-paths` для обновления путей в уже существующей production-базе без изменения её структуры.

## Удалённые исходники

- `site/img/IMG_4749.PNG`
- `site/img/IMG_4750.PNG`
- `site/img/blog/blog-hero.png`
- `site/img/contacts/contact-hero.png`
- `site/img/contacts/equipment-climazon.png`
- `site/img/contacts/equipment-dyson.png`
- `site/img/contacts/equipment-mirror.png`
- `site/img/contacts/equipment-wash.png`
- `site/img/contacts/services-intro.png`
- `site/img/contacts/services-intro2.png`
- `site/img/contacts/services-intro3.png`
- `site/img/img1aft.jpg`
- `site/img/img1bef.jpg`
- `site/img/img2aft.jpg`
- `site/img/img2bef.jpg`
- `site/img/main-hero-bg.png`
- `site/img/main-hero-mob-bg.png`
- `site/img/pablito.jpg`

## Намеренно сохранённые неиспользуемые WebP

Следующие изображения в текущей разметке не используются, но сохранены в оптимизированном формате как проектные материалы:

- `site/img/contacts/services-intro.webp` и responsive-варианты;
- `site/img/contacts/services-intro2.webp` и responsive-варианты.

Их можно удалить отдельным коммитом после подтверждения, что они больше не понадобятся.

## Нерешённые отсутствующие файлы

Оптимизация не создаёт изображения, которых не было в архиве.

### Логотип

Отсутствует:

- `/site/img/logo.png`

Путь оставлен без изменений по согласованию.

### Изображения работ

В seed и локальной базе указаны 14 отсутствующих файлов в `site/img/works/`:

- `total-blond-01-before.webp`, `total-blond-01-after.webp`;
- `shatush-01-before.webp`, `shatush-01-after.webp`;
- `toning-01-before.webp`, `toning-01-after.webp`;
- `gray-hair-01-before.webp`, `gray-hair-01-after.webp`;
- `recovery-01-before.webp`, `recovery-01-after.webp`;
- `care-01-before.webp`, `care-01-after.webp`;
- `reconstruction-01-before.webp`, `reconstruction-01-after.webp`.

Также отсутствуют fallback-файлы:

- `site/img/works/work-before-placeholder.webp`;
- `site/img/works/work-after-placeholder.webp`.

### Другие ранее существовавшие битые подключения

В исходном архиве отсутствовали и не относятся к этапу оптимизации изображений:

- `site/css/catalog-header.css`;
- `site/script/catalog-header.js`.

## Исторические ссылки

Старый путь `blog-hero.png` остаётся только в уже применённой исторической Prisma-миграции. Существующие миграции намеренно не редактировались. Старые пути также содержатся в `scripts/migrate-image-paths.js`, потому что этот файл выполняет их одноразовую замену в существующей базе.

## Команды после обновления production-сервера

```bash
npm install
npx prisma generate
npm run images:migrate-paths
```

После успешной миграции перезапустить процесс приложения через используемый PM2 process name.

## Git-команды

```bash
git status
git add package.json IMAGE_OPTIMIZATION_REPORT.md scripts \
  prisma/schema.prisma prisma/seed.js \
  public routes/admin.routes.js \
  site/img site/styles/main.scss site/css/main.css site/css/main.min.css \
  site/script
git status
git commit -m "perf: optimize images and responsive loading"
git push origin main
```

Перед коммитом `git status` не должен показывать `.env`, `node_modules`, локальные uploads или `prisma/dev.db`.
