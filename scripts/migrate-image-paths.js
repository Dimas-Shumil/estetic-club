'use strict';

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const replacements = [
  ['/site/img/img1aft.jpg', '/site/img/img1aft.webp'],
  ['/site/img/img1bef.jpg', '/site/img/img1bef.webp'],
  ['/site/img/img2aft.jpg', '/site/img/img2aft.webp'],
  ['/site/img/img2bef.jpg', '/site/img/img2bef.webp'],
  ['/site/img/IMG_4749.PNG', '/site/img/img_4749.webp'],
  ['/site/img/IMG_4750.PNG', '/site/img/img_4750.webp'],
  ['/site/img/main-hero-bg.png', '/site/img/main-hero-bg.webp'],
  ['/site/img/main-hero-mob-bg.png', '/site/img/main-hero-mob-bg.webp'],
  ['/site/img/pablito.jpg', '/site/img/pablito.webp'],
  ['/site/img/blog/blog-hero.png', '/site/img/blog/blog-hero.webp'],
  ['/site/img/contacts/contact-hero.png', '/site/img/contacts/contact-hero.webp'],
  [
    '/site/img/contacts/equipment-climazon.png',
    '/site/img/contacts/equipment-climazon.webp',
  ],
  [
    '/site/img/contacts/equipment-dyson.png',
    '/site/img/contacts/equipment-dyson.webp',
  ],
  [
    '/site/img/contacts/equipment-mirror.png',
    '/site/img/contacts/equipment-mirror.webp',
  ],
  [
    '/site/img/contacts/equipment-wash.png',
    '/site/img/contacts/equipment-wash.webp',
  ],
  [
    '/site/img/contacts/services-intro.png',
    '/site/img/contacts/services-intro.webp',
  ],
  [
    '/site/img/contacts/services-intro2.png',
    '/site/img/contacts/services-intro2.webp',
  ],
  [
    '/site/img/contacts/services-intro3.png',
    '/site/img/contacts/services-intro3.webp',
  ],
];

const textColumns = [
  ['BlogPost', 'coverImage'],
  ['Work', 'beforeImage'],
  ['Work', 'afterImage'],
  ['Work', 'heroImage'],
  ['Work', 'experienceImage'],
  ['Work', 'gallery'],
  ['WorkImage', 'imagePath'],
  ['ProductCategory', 'imagePath'],
  ['Brand', 'logoPath'],
  ['ProductImage', 'imagePath'],
  ['OrderItem', 'imagePathSnapshot'],
];

async function migrateImagePaths() {
  let changedRows = 0;

  for (const [table, column] of textColumns) {
    for (const [oldPath, newPath] of replacements) {
      const updated = await prisma.$executeRawUnsafe(
        `UPDATE "${table}" SET "${column}" = REPLACE("${column}", ?, ?) WHERE "${column}" LIKE ?`,
        oldPath,
        newPath,
        `%${oldPath}%`,
      );

      changedRows += Number(updated || 0);
    }
  }

  console.log(`Пути изображений обновлены. Изменено строк: ${changedRows}.`);
}

migrateImagePaths()
  .catch((error) => {
    console.error('Не удалось обновить пути изображений:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
