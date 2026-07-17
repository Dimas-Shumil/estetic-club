'use strict';

const path = require('node:path');
const fs = require('node:fs/promises');
const express = require('express');
const sanitizeHtml = require('sanitize-html');
const { z } = require('zod');

const prisma = require('../lib/prisma');
const requireAuth = require('../middleware/require-auth');
const requireRole = require('../middleware/require-role');
const requireCsrf = require('../middleware/require-csrf');
const validateOrigin = require('../middleware/validate-origin');
const { getRequestMetadata } = require('../services/session.service');

const router = express.Router();

const ADMIN_PAGES_DIR = path.join(__dirname, '..', 'admin-pages');
const PRODUCT_UPLOADS_DIR = path.join(__dirname, '..', 'site', 'uploads', 'products');
const PRODUCT_UPLOADS_URL = '/site/uploads/products';

const productIdSchema = z.coerce.number().int().positive();
const orderIdSchema = z.coerce.number().int().positive();
const genericIdSchema = z.coerce.number().int().positive();
const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(2)
  .max(180)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

const listQuerySchema = z
  .object({
    search: z.string().trim().max(120).optional().default(''),
    status: z.enum(['all', 'published', 'draft']).optional().default('all'),
    categoryId: z.coerce.number().int().positive().optional(),
    page: z.coerce.number().int().min(1).max(100000).optional().default(1),
    limit: z.coerce.number().int().min(1).max(50).optional().default(20),
  })
  .strict();

const orderListQuerySchema = z
  .object({
    search: z.string().trim().max(120).optional().default(''),
    status: z
      .enum(['all', 'NEW', 'CONFIRMED', 'ASSEMBLING', 'READY', 'COMPLETED', 'CANCELLED'])
      .optional()
      .default('all'),
    dateFrom: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).optional().default(''),
    dateTo: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).optional().default(''),
    page: z.coerce.number().int().min(1).max(100000).optional().default(1),
    limit: z.coerce.number().int().min(1).max(50).optional().default(20),
  })
  .strict();

const variantSchema = z
  .object({
    id: z.coerce.number().int().positive().optional(),
    name: z.string().trim().min(1).max(120).default('Стандарт'),
    sku: z.string().trim().max(120).optional().default(''),
    price: z.coerce.number().int().min(1).max(100_000_000),
    oldPrice: z.coerce.number().int().min(1).max(100_000_000).nullable().optional(),
    isActive: z.boolean().optional().default(true),
    sortOrder: z.coerce.number().int().min(0).max(100000).optional().default(100),
  })
  .strict()
  .superRefine((data, context) => {
    if (data.oldPrice !== null && data.oldPrice !== undefined && data.oldPrice <= data.price) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['oldPrice'],
        message: 'Старая цена должна быть выше текущей',
      });
    }
  });

const imageSchema = z
  .object({
    id: z.coerce.number().int().positive().optional(),
    imagePath: z
      .string()
      .trim()
      .min(1)
      .max(500)
      .refine(isManagedProductImagePath, {
        message: 'Некорректный путь изображения товара',
      }),
    alt: z.string().trim().max(240).optional().default(''),
    isMain: z.boolean().optional().default(false),
    sortOrder: z.coerce.number().int().min(0).max(100000).optional().default(100),
  })
  .strict();

const productPayloadSchema = z
  .object({
    title: z.string().trim().min(2).max(180),
    slug: slugSchema,
    categoryId: z.coerce.number().int().positive(),
    brandId: z.coerce.number().int().positive().nullable().optional(),
    shortDescription: z.string().trim().max(700).optional().default(''),
    description: z.string().trim().max(50000).optional().default(''),
    badge: z.string().trim().max(80).optional().default(''),
    sku: z.string().trim().max(120).optional().default(''),
    seoTitle: z.string().trim().max(180).optional().default(''),
    seoDescription: z.string().trim().max(320).optional().default(''),
    isPublished: z.boolean().optional().default(false),
    sortOrder: z.coerce.number().int().min(0).max(100000).optional().default(100),
    variants: z.array(variantSchema).min(1).max(60),
    images: z.array(imageSchema).max(40).optional().default([]),
    filterOptionIds: z.array(z.coerce.number().int().positive()).max(120).optional().default([]),
  })
  .strict()
  .superRefine((data, context) => {
    if (!data.isPublished) {
      return;
    }

    if (!data.images.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['images'],
        message: 'Для публикации добавьте хотя бы одно изображение',
      });
    }

    if (!data.variants.some((variant) => variant.isActive)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['variants'],
        message: 'Для публикации нужен хотя бы один активный вариант',
      });
    }
  });

const categoryPayloadSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    slug: slugSchema,
    description: z.string().trim().max(600).optional().default(''),
    imagePath: z.string().trim().max(500).optional().default(''),
    parentId: z.coerce.number().int().positive().nullable().optional(),
    sortOrder: z.coerce.number().int().min(0).max(100000).optional().default(100),
    isPublished: z.boolean().optional().default(true),
  })
  .strict();

const brandPayloadSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    slug: slugSchema,
    logoPath: z.string().trim().max(500).optional().default(''),
    sortOrder: z.coerce.number().int().min(0).max(100000).optional().default(100),
    isPublished: z.boolean().optional().default(true),
  })
  .strict();

const filterOptionPayloadSchema = z
  .object({
    id: z.coerce.number().int().positive().optional(),
    name: z.string().trim().min(1).max(120),
    value: z.string().trim().min(1).max(120),
    sortOrder: z.coerce.number().int().min(0).max(100000).optional().default(100),
    isPublished: z.boolean().optional().default(true),
  })
  .strict();

const filterGroupPayloadSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    slug: slugSchema,
    categoryId: z.coerce.number().int().positive(),
    sortOrder: z.coerce.number().int().min(0).max(100000).optional().default(100),
    isPublished: z.boolean().optional().default(true),
    options: z.array(filterOptionPayloadSchema).max(80).optional().default([]),
  })
  .strict();

const orderUpdateSchema = z
  .object({
    status: z
      .enum(['NEW', 'CONFIRMED', 'ASSEMBLING', 'READY', 'COMPLETED', 'CANCELLED'])
      .optional(),
    internalComment: z.string().trim().max(2000).optional(),
  })
  .strict()
  .refine((data) => data.status !== undefined || data.internalComment !== undefined, {
    message: 'Не переданы данные для обновления заказа',
  });

const productListSelect = {
  id: true,
  slug: true,
  title: true,
  badge: true,
  sku: true,
  isPublished: true,
  sortOrder: true,
  createdAt: true,
  updatedAt: true,
  category: {
    select: {
      id: true,
      name: true,
      slug: true,
    },
  },
  brand: {
    select: {
      id: true,
      name: true,
      slug: true,
    },
  },
  variants: {
    orderBy: [
      {
        sortOrder: 'asc',
      },
      {
        id: 'asc',
      },
    ],
    select: {
      id: true,
      name: true,
      price: true,
      oldPrice: true,
      isActive: true,
    },
  },
  images: {
    orderBy: [
      {
        isMain: 'desc',
      },
      {
        sortOrder: 'asc',
      },
      {
        id: 'asc',
      },
    ],
    take: 1,
    select: {
      id: true,
      imagePath: true,
      alt: true,
      isMain: true,
    },
  },
};

const productDetailInclude = {
  category: true,
  brand: true,
  variants: {
    orderBy: [
      {
        sortOrder: 'asc',
      },
      {
        id: 'asc',
      },
    ],
  },
  images: {
    orderBy: [
      {
        isMain: 'desc',
      },
      {
        sortOrder: 'asc',
      },
      {
        id: 'asc',
      },
    ],
  },
  filterOptions: {
    select: {
      filterOptionId: true,
    },
  },
};

function sendAdminPage(fileName) {
  return function pageHandler(req, res) {
    return res.sendFile(path.join(ADMIN_PAGES_DIR, fileName));
  };
}

function sanitizeProductDescription(value) {
  return sanitizeHtml(String(value || ''), {
    allowedTags: ['p', 'h2', 'h3', 'ul', 'ol', 'li', 'strong', 'em', 'blockquote', 'br'],
    allowedAttributes: {},
  }).trim();
}

function isManagedProductImagePath(imagePath) {
  const value = String(imagePath || '').trim();
  const fileName = path.posix.basename(value);
  const expectedPath = `${PRODUCT_UPLOADS_URL}/${fileName}`;

  return value === expectedPath && /^\d{13}-[a-f0-9]{24}\.webp$/.test(fileName);
}

async function removeManagedProductImage(imagePath) {
  if (!isManagedProductImagePath(imagePath)) {
    return;
  }

  const absolutePath = path.join(PRODUCT_UPLOADS_DIR, path.posix.basename(imagePath));

  try {
    await fs.unlink(absolutePath);
  } catch (error) {
    if (error?.code !== 'ENOENT') {
      throw error;
    }
  }
}

async function removeUnusedManagedProductImages(imagePaths) {
  const uniquePaths = [...new Set(imagePaths.filter(isManagedProductImagePath))];

  for (const imagePath of uniquePaths) {
    try {
      const references = await prisma.productImage.count({
        where: {
          imagePath,
        },
      });

      if (!references) {
        await removeManagedProductImage(imagePath);
      }
    } catch (error) {
      console.error(`Не удалось удалить изображение товара ${imagePath}:`, error);
    }
  }
}

function isUniqueConstraintError(error) {
  return error?.code === 'P2002';
}

function parseDateStart(value) {
  return new Date(`${value}T00:00:00.000+07:00`);
}

function parseDateNextDay(value) {
  const date = parseDateStart(value);
  date.setUTCDate(date.getUTCDate() + 1);
  return date;
}

function normalizeNullableId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function createProductData(data) {
  const requestedMainIndex = data.images.findIndex((image) => image.isMain);
  const mainIndex = requestedMainIndex >= 0 ? requestedMainIndex : 0;

  const images = data.images.map((image, index) => ({
    ...image,
    isMain: index === mainIndex,
  }));

  return {
    title: data.title,
    slug: data.slug,
    categoryId: data.categoryId,
    brandId: normalizeNullableId(data.brandId),
    shortDescription: data.shortDescription,
    description: sanitizeProductDescription(data.description),
    badge: data.badge,
    sku: data.sku,
    seoTitle: data.seoTitle,
    seoDescription: data.seoDescription,
    isPublished: data.isPublished,
    sortOrder: data.sortOrder,
    variants: data.variants,
    images,
    filterOptionIds: [...new Set(data.filterOptionIds)],
  };
}

async function getCategoryAncestorIds(categoryId) {
  const categories = await prisma.productCategory.findMany({
    select: {
      id: true,
      parentId: true,
    },
  });

  const byId = new Map(categories.map((category) => [category.id, category]));
  const result = new Set();
  let current = byId.get(categoryId);

  while (current && !result.has(current.id)) {
    result.add(current.id);
    current = current.parentId ? byId.get(current.parentId) : null;
  }

  return [...result];
}

async function validateProductReferences(data) {
  const category = await prisma.productCategory.findUnique({
    where: {
      id: data.categoryId,
    },
    select: {
      id: true,
    },
  });

  const brand = data.brandId
    ? await prisma.brand.findUnique({
        where: {
          id: data.brandId,
        },
        select: {
          id: true,
        },
      })
    : null;

  if (!category) {
    return 'Категория не найдена';
  }

  if (data.brandId && !brand) {
    return 'Бренд не найден';
  }

  if (data.filterOptionIds.length) {
    const allowedCategoryIds = await getCategoryAncestorIds(data.categoryId);

    const optionCount = await prisma.filterOption.count({
      where: {
        id: {
          in: data.filterOptionIds,
        },
        group: {
          categoryId: {
            in: allowedCategoryIds,
          },
        },
      },
    });

    if (optionCount !== data.filterOptionIds.length) {
      return 'Некоторые параметры фильтра не относятся к категории товара';
    }
  }

  return '';
}

async function writeProductRelations(tx, productId, data, currentProduct = null) {
  const currentVariantIds = new Set((currentProduct?.variants || []).map((item) => item.id));
  const nextVariantIds = new Set(data.variants.map((item) => item.id).filter(Boolean));

  const removedVariantIds = [...currentVariantIds].filter((id) => !nextVariantIds.has(id));

  if (removedVariantIds.length) {
    await tx.productVariant.deleteMany({
      where: {
        productId,
        id: {
          in: removedVariantIds,
        },
      },
    });
  }

  for (const variant of data.variants) {
    if (variant.id && currentVariantIds.has(variant.id)) {
      await tx.productVariant.update({
        where: {
          id: variant.id,
        },
        data: {
          name: variant.name,
          sku: variant.sku,
          price: variant.price,
          oldPrice: variant.oldPrice ?? null,
          isActive: variant.isActive,
          sortOrder: variant.sortOrder,
        },
      });
    } else {
      await tx.productVariant.create({
        data: {
          productId,
          name: variant.name,
          sku: variant.sku,
          price: variant.price,
          oldPrice: variant.oldPrice ?? null,
          isActive: variant.isActive,
          sortOrder: variant.sortOrder,
        },
      });
    }
  }

  const currentImageIds = new Set((currentProduct?.images || []).map((item) => item.id));
  const nextImageIds = new Set(data.images.map((item) => item.id).filter(Boolean));
  const removedImageIds = [...currentImageIds].filter((id) => !nextImageIds.has(id));

  if (removedImageIds.length) {
    await tx.productImage.deleteMany({
      where: {
        productId,
        id: {
          in: removedImageIds,
        },
      },
    });
  }

  for (const image of data.images) {
    if (image.id && currentImageIds.has(image.id)) {
      await tx.productImage.update({
        where: {
          id: image.id,
        },
        data: {
          imagePath: image.imagePath,
          alt: image.alt,
          isMain: image.isMain,
          sortOrder: image.sortOrder,
        },
      });
    } else {
      await tx.productImage.create({
        data: {
          productId,
          imagePath: image.imagePath,
          alt: image.alt,
          isMain: image.isMain,
          sortOrder: image.sortOrder,
        },
      });
    }
  }

  await tx.productFilterOption.deleteMany({
    where: {
      productId,
    },
  });

  if (data.filterOptionIds.length) {
    await tx.productFilterOption.createMany({
      data: data.filterOptionIds.map((filterOptionId) => ({
        productId,
        filterOptionId,
      })),
    });
  }
}

async function writeFilterOptions(tx, groupId, options, currentOptions = []) {
  const currentIds = new Set(currentOptions.map((option) => option.id));
  const nextIds = new Set(options.map((option) => option.id).filter(Boolean));
  const removedIds = [...currentIds].filter((id) => !nextIds.has(id));

  if (removedIds.length) {
    await tx.filterOption.deleteMany({
      where: {
        groupId,
        id: {
          in: removedIds,
        },
      },
    });
  }

  for (const option of options) {
    if (option.id && currentIds.has(option.id)) {
      await tx.filterOption.update({
        where: {
          id: option.id,
        },
        data: {
          name: option.name,
          value: option.value,
          sortOrder: option.sortOrder,
          isPublished: option.isPublished,
        },
      });
    } else {
      await tx.filterOption.create({
        data: {
          groupId,
          name: option.name,
          value: option.value,
          sortOrder: option.sortOrder,
          isPublished: option.isPublished,
        },
      });
    }
  }
}

router.use((req, res, next) => {
  res.set('Cache-Control', 'no-store, private');
  res.set('Pragma', 'no-cache');
  next();
});

router.get('/catalog', requireAuth.page, requireRole.page('OWNER'), sendAdminPage('catalog.html'));
router.get('/catalog/edit', requireAuth.page, requireRole.page('OWNER'), sendAdminPage('product-edit.html'));
router.get('/catalog/settings', requireAuth.page, requireRole.page('OWNER'), sendAdminPage('catalog-settings.html'));
router.get('/orders', requireAuth.page, requireRole.page('OWNER'), sendAdminPage('orders.html'));

router.get('/api/catalog/overview', requireAuth, requireRole('OWNER'), async (req, res, next) => {
  try {
    const [products, published, drafts, categories, brands, newOrders] = await prisma.$transaction([
      prisma.product.count(),
      prisma.product.count({ where: { isPublished: true } }),
      prisma.product.count({ where: { isPublished: false } }),
      prisma.productCategory.count(),
      prisma.brand.count(),
      prisma.order.count({ where: { status: 'NEW' } }),
    ]);

    return res.json({
      counts: {
        products,
        published,
        drafts,
        categories,
        brands,
        newOrders,
      },
    });
  } catch (error) {
    return next(error);
  }
});

router.get('/api/catalog/products', requireAuth, requireRole('OWNER'), async (req, res, next) => {
  try {
    const parsed = listQuerySchema.safeParse(req.query);

    if (!parsed.success) {
      return res.status(400).json({ message: 'Некорректные параметры списка товаров' });
    }

    const { search, status, categoryId, page, limit } = parsed.data;
    const where = {};

    if (status === 'published') where.isPublished = true;
    if (status === 'draft') where.isPublished = false;
    if (categoryId) where.categoryId = categoryId;

    if (search) {
      where.OR = [
        { title: { contains: search } },
        { slug: { contains: search } },
        { sku: { contains: search } },
        { brand: { name: { contains: search } } },
      ];
    }

    const skip = (page - 1) * limit;

    const [products, total, all, published, drafts] = await prisma.$transaction([
      prisma.product.findMany({
        where,
        orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
        skip,
        take: limit,
        select: productListSelect,
      }),
      prisma.product.count({ where }),
      prisma.product.count(),
      prisma.product.count({ where: { isPublished: true } }),
      prisma.product.count({ where: { isPublished: false } }),
    ]);

    return res.json({
      products,
      counts: { all, published, drafts },
      pagination: {
        page,
        limit,
        total,
        pages: Math.max(1, Math.ceil(total / limit)),
      },
    });
  } catch (error) {
    return next(error);
  }
});

router.get('/api/catalog/products/:id', requireAuth, requireRole('OWNER'), async (req, res, next) => {
  try {
    const parsedId = productIdSchema.safeParse(req.params.id);

    if (!parsedId.success) {
      return res.status(400).json({ message: 'Некорректный ID товара' });
    }

    const product = await prisma.product.findUnique({
      where: { id: parsedId.data },
      include: productDetailInclude,
    });

    if (!product) {
      return res.status(404).json({ message: 'Товар не найден' });
    }

    return res.json({
      product: {
        ...product,
        filterOptionIds: product.filterOptions.map((item) => item.filterOptionId),
      },
    });
  } catch (error) {
    return next(error);
  }
});

router.post('/api/catalog/products', validateOrigin, requireAuth, requireRole('OWNER'), requireCsrf, async (req, res, next) => {
  try {
    const parsed = productPayloadSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        message: parsed.error.issues[0]?.message || 'Проверьте данные товара',
      });
    }

    const data = createProductData(parsed.data);
    const referenceError = await validateProductReferences(data);

    if (referenceError) {
      return res.status(400).json({ message: referenceError });
    }

    const metadata = getRequestMetadata(req);

    const product = await prisma.$transaction(async (tx) => {
      const created = await tx.product.create({
        data: {
          title: data.title,
          slug: data.slug,
          categoryId: data.categoryId,
          brandId: data.brandId,
          shortDescription: data.shortDescription,
          description: data.description,
          badge: data.badge,
          sku: data.sku,
          seoTitle: data.seoTitle,
          seoDescription: data.seoDescription,
          isPublished: data.isPublished,
          sortOrder: data.sortOrder,
        },
      });

      await writeProductRelations(tx, created.id, data);

      await tx.adminAuditLog.create({
        data: {
          userId: req.auth.user.id,
          action: 'PRODUCT_CREATED',
          entityType: 'Product',
          entityId: String(created.id),
          details: JSON.stringify({ slug: created.slug, isPublished: created.isPublished }),
          ipAddress: metadata.ipAddress,
          userAgent: metadata.userAgent,
        },
      });

      return tx.product.findUnique({
        where: { id: created.id },
        include: productDetailInclude,
      });
    });

    return res.status(201).json({ product });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return res.status(409).json({ message: 'Товар с таким адресом уже существует' });
    }

    return next(error);
  }
});

router.patch('/api/catalog/products/:id', validateOrigin, requireAuth, requireRole('OWNER'), requireCsrf, async (req, res, next) => {
  try {
    const parsedId = productIdSchema.safeParse(req.params.id);
    const parsed = productPayloadSchema.safeParse(req.body);

    if (!parsedId.success) return res.status(400).json({ message: 'Некорректный ID товара' });
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.issues[0]?.message || 'Проверьте данные товара' });
    }

    const current = await prisma.product.findUnique({
      where: { id: parsedId.data },
      include: {
        variants: true,
        images: true,
      },
    });

    if (!current) return res.status(404).json({ message: 'Товар не найден' });

    const data = createProductData(parsed.data);
    const referenceError = await validateProductReferences(data);

    if (referenceError) return res.status(400).json({ message: referenceError });

    const removedPaths = current.images
      .filter((image) => !data.images.some((nextImage) => nextImage.id === image.id))
      .map((image) => image.imagePath);

    const metadata = getRequestMetadata(req);

    const product = await prisma.$transaction(async (tx) => {
      await tx.product.update({
        where: { id: current.id },
        data: {
          title: data.title,
          slug: data.slug,
          categoryId: data.categoryId,
          brandId: data.brandId,
          shortDescription: data.shortDescription,
          description: data.description,
          badge: data.badge,
          sku: data.sku,
          seoTitle: data.seoTitle,
          seoDescription: data.seoDescription,
          isPublished: data.isPublished,
          sortOrder: data.sortOrder,
        },
      });

      await writeProductRelations(tx, current.id, data, current);

      await tx.adminAuditLog.create({
        data: {
          userId: req.auth.user.id,
          action: 'PRODUCT_UPDATED',
          entityType: 'Product',
          entityId: String(current.id),
          details: JSON.stringify({ slug: data.slug, isPublished: data.isPublished }),
          ipAddress: metadata.ipAddress,
          userAgent: metadata.userAgent,
        },
      });

      return tx.product.findUnique({
        where: { id: current.id },
        include: productDetailInclude,
      });
    });

    removeUnusedManagedProductImages(removedPaths).catch(() => undefined);

    return res.json({ product });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return res.status(409).json({ message: 'Товар с таким адресом уже существует' });
    }

    return next(error);
  }
});

router.delete('/api/catalog/products/:id', validateOrigin, requireAuth, requireRole('OWNER'), requireCsrf, async (req, res, next) => {
  try {
    const parsedId = productIdSchema.safeParse(req.params.id);

    if (!parsedId.success) return res.status(400).json({ message: 'Некорректный ID товара' });

    const product = await prisma.product.findUnique({
      where: { id: parsedId.data },
      include: { images: true },
    });

    if (!product) return res.status(404).json({ message: 'Товар не найден' });

    const metadata = getRequestMetadata(req);

    await prisma.$transaction([
      prisma.adminAuditLog.create({
        data: {
          userId: req.auth.user.id,
          action: 'PRODUCT_DELETED',
          entityType: 'Product',
          entityId: String(product.id),
          details: JSON.stringify({ slug: product.slug, title: product.title }),
          ipAddress: metadata.ipAddress,
          userAgent: metadata.userAgent,
        },
      }),
      prisma.product.delete({ where: { id: product.id } }),
    ]);

    removeUnusedManagedProductImages(product.images.map((image) => image.imagePath)).catch(() => undefined);

    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
});

router.get('/api/catalog/settings', requireAuth, requireRole('OWNER'), async (req, res, next) => {
  try {
    const [categories, brands, filterGroups] = await prisma.$transaction([
      prisma.productCategory.findMany({
        orderBy: [{ parentId: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }],
        include: {
          _count: {
            select: {
              products: true,
              children: true,
            },
          },
        },
      }),
      prisma.brand.findMany({
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        include: {
          _count: {
            select: {
              products: true,
            },
          },
        },
      }),
      prisma.filterGroup.findMany({
        orderBy: [{ categoryId: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }],
        include: {
          category: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
          options: {
            orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
            include: {
              _count: {
                select: {
                  products: true,
                },
              },
            },
          },
        },
      }),
    ]);

    return res.json({ categories, brands, filterGroups });
  } catch (error) {
    return next(error);
  }
});

router.post('/api/catalog/categories', validateOrigin, requireAuth, requireRole('OWNER'), requireCsrf, async (req, res, next) => {
  try {
    const parsed = categoryPayloadSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.issues[0]?.message || 'Проверьте категорию' });

    const category = await prisma.productCategory.create({ data: parsed.data });
    return res.status(201).json({ category });
  } catch (error) {
    if (isUniqueConstraintError(error)) return res.status(409).json({ message: 'Категория с таким адресом уже существует' });
    return next(error);
  }
});

router.patch('/api/catalog/categories/:id', validateOrigin, requireAuth, requireRole('OWNER'), requireCsrf, async (req, res, next) => {
  try {
    const parsedId = genericIdSchema.safeParse(req.params.id);
    const parsed = categoryPayloadSchema.safeParse(req.body);
    if (!parsedId.success || !parsed.success) return res.status(400).json({ message: 'Проверьте данные категории' });
    if (parsed.data.parentId === parsedId.data) return res.status(400).json({ message: 'Категория не может быть родителем самой себя' });

    const category = await prisma.productCategory.update({ where: { id: parsedId.data }, data: parsed.data });
    return res.json({ category });
  } catch (error) {
    if (error?.code === 'P2025') return res.status(404).json({ message: 'Категория не найдена' });
    if (isUniqueConstraintError(error)) return res.status(409).json({ message: 'Категория с таким адресом уже существует' });
    return next(error);
  }
});

router.delete('/api/catalog/categories/:id', validateOrigin, requireAuth, requireRole('OWNER'), requireCsrf, async (req, res, next) => {
  try {
    const parsedId = genericIdSchema.safeParse(req.params.id);
    if (!parsedId.success) return res.status(400).json({ message: 'Некорректный ID категории' });

    const category = await prisma.productCategory.findUnique({
      where: { id: parsedId.data },
      include: { _count: { select: { products: true, children: true, filterGroups: true } } },
    });

    if (!category) return res.status(404).json({ message: 'Категория не найдена' });
    if (category._count.products || category._count.children || category._count.filterGroups) {
      return res.status(409).json({ message: 'Сначала удалите вложенные категории, товары и фильтры' });
    }

    await prisma.productCategory.delete({ where: { id: category.id } });
    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
});

router.post('/api/catalog/brands', validateOrigin, requireAuth, requireRole('OWNER'), requireCsrf, async (req, res, next) => {
  try {
    const parsed = brandPayloadSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Проверьте данные бренда' });
    const brand = await prisma.brand.create({ data: parsed.data });
    return res.status(201).json({ brand });
  } catch (error) {
    if (isUniqueConstraintError(error)) return res.status(409).json({ message: 'Бренд с таким адресом уже существует' });
    return next(error);
  }
});

router.patch('/api/catalog/brands/:id', validateOrigin, requireAuth, requireRole('OWNER'), requireCsrf, async (req, res, next) => {
  try {
    const parsedId = genericIdSchema.safeParse(req.params.id);
    const parsed = brandPayloadSchema.safeParse(req.body);
    if (!parsedId.success || !parsed.success) return res.status(400).json({ message: 'Проверьте данные бренда' });
    const brand = await prisma.brand.update({ where: { id: parsedId.data }, data: parsed.data });
    return res.json({ brand });
  } catch (error) {
    if (error?.code === 'P2025') return res.status(404).json({ message: 'Бренд не найден' });
    if (isUniqueConstraintError(error)) return res.status(409).json({ message: 'Бренд с таким адресом уже существует' });
    return next(error);
  }
});

router.delete('/api/catalog/brands/:id', validateOrigin, requireAuth, requireRole('OWNER'), requireCsrf, async (req, res, next) => {
  try {
    const parsedId = genericIdSchema.safeParse(req.params.id);
    if (!parsedId.success) return res.status(400).json({ message: 'Некорректный ID бренда' });
    await prisma.brand.delete({ where: { id: parsedId.data } });
    return res.status(204).send();
  } catch (error) {
    if (error?.code === 'P2025') return res.status(404).json({ message: 'Бренд не найден' });
    return next(error);
  }
});

router.post('/api/catalog/filter-groups', validateOrigin, requireAuth, requireRole('OWNER'), requireCsrf, async (req, res, next) => {
  try {
    const parsed = filterGroupPayloadSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.issues[0]?.message || 'Проверьте фильтр' });

    const group = await prisma.$transaction(async (tx) => {
      const created = await tx.filterGroup.create({
        data: {
          name: parsed.data.name,
          slug: parsed.data.slug,
          categoryId: parsed.data.categoryId,
          sortOrder: parsed.data.sortOrder,
          isPublished: parsed.data.isPublished,
        },
      });
      await writeFilterOptions(tx, created.id, parsed.data.options);
      return tx.filterGroup.findUnique({ where: { id: created.id }, include: { options: true, category: true } });
    });

    return res.status(201).json({ group });
  } catch (error) {
    if (isUniqueConstraintError(error)) return res.status(409).json({ message: 'Такой фильтр или вариант уже существует' });
    return next(error);
  }
});

router.patch('/api/catalog/filter-groups/:id', validateOrigin, requireAuth, requireRole('OWNER'), requireCsrf, async (req, res, next) => {
  try {
    const parsedId = genericIdSchema.safeParse(req.params.id);
    const parsed = filterGroupPayloadSchema.safeParse(req.body);
    if (!parsedId.success || !parsed.success) return res.status(400).json({ message: 'Проверьте данные фильтра' });

    const current = await prisma.filterGroup.findUnique({ where: { id: parsedId.data }, include: { options: true } });
    if (!current) return res.status(404).json({ message: 'Фильтр не найден' });

    const group = await prisma.$transaction(async (tx) => {
      await tx.filterGroup.update({
        where: { id: current.id },
        data: {
          name: parsed.data.name,
          slug: parsed.data.slug,
          categoryId: parsed.data.categoryId,
          sortOrder: parsed.data.sortOrder,
          isPublished: parsed.data.isPublished,
        },
      });
      await writeFilterOptions(tx, current.id, parsed.data.options, current.options);
      return tx.filterGroup.findUnique({ where: { id: current.id }, include: { options: true, category: true } });
    });

    return res.json({ group });
  } catch (error) {
    if (isUniqueConstraintError(error)) return res.status(409).json({ message: 'Такой фильтр или вариант уже существует' });
    return next(error);
  }
});

router.delete('/api/catalog/filter-groups/:id', validateOrigin, requireAuth, requireRole('OWNER'), requireCsrf, async (req, res, next) => {
  try {
    const parsedId = genericIdSchema.safeParse(req.params.id);
    if (!parsedId.success) return res.status(400).json({ message: 'Некорректный ID фильтра' });
    await prisma.filterGroup.delete({ where: { id: parsedId.data } });
    return res.status(204).send();
  } catch (error) {
    if (error?.code === 'P2025') return res.status(404).json({ message: 'Фильтр не найден' });
    return next(error);
  }
});

router.get('/api/orders', requireAuth, requireRole('OWNER'), async (req, res, next) => {
  try {
    const parsed = orderListQuerySchema.safeParse(req.query);
    if (!parsed.success) return res.status(400).json({ message: 'Некорректные параметры списка заказов' });

    const { search, status, dateFrom, dateTo, page, limit } = parsed.data;
    const where = {};

    if (status !== 'all') where.status = status;
    if (search) {
      where.OR = [
        { publicNumber: { contains: search } },
        { customerName: { contains: search } },
        { phone: { contains: search } },
        { items: { some: { productTitleSnapshot: { contains: search } } } },
      ];
    }
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = parseDateStart(dateFrom);
      if (dateTo) where.createdAt.lt = parseDateNextDay(dateTo);
    }

    const skip = (page - 1) * limit;

    const [orders, total, grouped] = await prisma.$transaction([
      prisma.order.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip,
        take: limit,
        include: { items: true },
      }),
      prisma.order.count({ where }),
      prisma.order.groupBy({ by: ['status'], _count: { _all: true } }),
    ]);

    const counts = { all: 0, NEW: 0, CONFIRMED: 0, ASSEMBLING: 0, READY: 0, COMPLETED: 0, CANCELLED: 0 };
    for (const group of grouped) {
      counts[group.status] = group._count._all;
      counts.all += group._count._all;
    }

    return res.json({
      orders,
      counts,
      pagination: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) },
    });
  } catch (error) {
    return next(error);
  }
});

router.get('/api/orders/:id', requireAuth, requireRole('OWNER'), async (req, res, next) => {
  try {
    const parsedId = orderIdSchema.safeParse(req.params.id);
    if (!parsedId.success) return res.status(400).json({ message: 'Некорректный ID заказа' });
    const order = await prisma.order.findUnique({ where: { id: parsedId.data }, include: { items: true } });
    if (!order) return res.status(404).json({ message: 'Заказ не найден' });
    return res.json({ order });
  } catch (error) {
    return next(error);
  }
});

router.patch('/api/orders/:id', validateOrigin, requireAuth, requireRole('OWNER'), requireCsrf, async (req, res, next) => {
  try {
    const parsedId = orderIdSchema.safeParse(req.params.id);
    const parsed = orderUpdateSchema.safeParse(req.body);
    if (!parsedId.success || !parsed.success) return res.status(400).json({ message: parsed.error?.issues?.[0]?.message || 'Проверьте данные заказа' });

    const current = await prisma.order.findUnique({ where: { id: parsedId.data } });
    if (!current) return res.status(404).json({ message: 'Заказ не найден' });

    const metadata = getRequestMetadata(req);
    const order = await prisma.$transaction(async (tx) => {
      const updated = await tx.order.update({
        where: { id: current.id },
        data: {
          ...(parsed.data.status !== undefined ? { status: parsed.data.status } : {}),
          ...(parsed.data.internalComment !== undefined ? { internalComment: parsed.data.internalComment } : {}),
        },
        include: { items: true },
      });
      await tx.adminAuditLog.create({
        data: {
          userId: req.auth.user.id,
          action: 'ORDER_UPDATED',
          entityType: 'Order',
          entityId: String(current.id),
          details: JSON.stringify({ previousStatus: current.status, nextStatus: updated.status }),
          ipAddress: metadata.ipAddress,
          userAgent: metadata.userAgent,
        },
      });
      return updated;
    });

    return res.json({ order });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
