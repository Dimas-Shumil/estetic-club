'use strict';

const express = require('express');
const { z } = require('zod');

const prisma = require('../lib/prisma');

const router = express.Router();

const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(2)
  .max(180)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

const catalogQuerySchema = z
  .object({
    category: z.string().trim().max(180).optional().default(''),
    search: z.string().trim().max(120).optional().default(''),
    brand: z.string().trim().max(180).optional().default(''),
    filters: z.string().trim().max(1200).optional().default(''),
    minPrice: z.coerce.number().int().min(0).max(100_000_000).optional(),
    maxPrice: z.coerce.number().int().min(0).max(100_000_000).optional(),
    sort: z
      .enum(['default', 'price-asc', 'price-desc', 'newest'])
      .optional()
      .default('default'),
    page: z.coerce.number().int().min(1).max(100000).optional().default(1),
    limit: z.coerce.number().int().min(1).max(60).optional().default(24),
  })
  .strict()
  .superRefine((data, context) => {
    if (
      data.minPrice !== undefined &&
      data.maxPrice !== undefined &&
      data.minPrice > data.maxPrice
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['maxPrice'],
        message: 'Максимальная цена не может быть меньше минимальной',
      });
    }
  });

const cartBodySchema = z
  .object({
    items: z
      .array(
        z
          .object({
            variantId: z.coerce.number().int().positive(),
            quantity: z.coerce.number().int().min(1).max(20),
          })
          .strict(),
      )
      .min(1)
      .max(40),
  })
  .strict();

const publicProductInclude = {
  category: {
    select: {
      id: true,
      name: true,
      slug: true,
      parentId: true,
    },
  },
  brand: {
    select: {
      id: true,
      name: true,
      slug: true,
      logoPath: true,
    },
  },
  variants: {
    where: {
      isActive: true,
    },
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
      sku: true,
      price: true,
      oldPrice: true,
      sortOrder: true,
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
    select: {
      id: true,
      imagePath: true,
      alt: true,
      isMain: true,
      sortOrder: true,
    },
  },
  filterOptions: {
    select: {
      filterOption: {
        select: {
          id: true,
          name: true,
          value: true,
          group: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
        },
      },
    },
  },
};

function setCatalogCache(res, maxAge = 60) {
  res.set(
    'Cache-Control',
    `public, max-age=${maxAge}, stale-while-revalidate=300`,
  );
}

function createCategoryTree(categories) {
  const byId = new Map();
  const roots = [];

  for (const category of categories) {
    byId.set(category.id, {
      ...category,
      children: [],
    });
  }

  for (const category of byId.values()) {
    if (category.parentId && byId.has(category.parentId)) {
      byId.get(category.parentId).children.push(category);
    } else {
      roots.push(category);
    }
  }

  return roots;
}

function parseFilterSelection(value) {
  if (!value) {
    return [];
  }

  return String(value)
    .split('|')
    .map((groupValue) => {
      const [groupIdValue, optionValues] = groupValue.split(':');
      const groupId = Number(groupIdValue);
      const optionIds = String(optionValues || '')
        .split(',')
        .map(Number)
        .filter((id) => Number.isInteger(id) && id > 0);

      if (!Number.isInteger(groupId) || groupId <= 0 || !optionIds.length) {
        return null;
      }

      return {
        groupId,
        optionIds: [...new Set(optionIds)],
      };
    })
    .filter(Boolean)
    .slice(0, 20);
}

async function getCategoryAndDescendantIds(categorySlug) {
  if (!categorySlug) {
    return [];
  }

  const categories = await prisma.productCategory.findMany({
    select: {
      id: true,
      slug: true,
      parentId: true,
    },
  });

  const selected = categories.find((category) => category.slug === categorySlug);

  if (!selected) {
    return null;
  }

  const result = new Set([selected.id]);
  let changed = true;

  while (changed) {
    changed = false;

    for (const category of categories) {
      if (category.parentId && result.has(category.parentId) && !result.has(category.id)) {
        result.add(category.id);
        changed = true;
      }
    }
  }

  return [...result];
}

function createPublicProductResponse(product) {
  const variants = Array.isArray(product.variants) ? product.variants : [];
  const images = Array.isArray(product.images) ? product.images : [];
  const prices = variants.map((variant) => variant.price);

  return {
    id: product.id,
    slug: product.slug,
    title: product.title,
    shortDescription: product.shortDescription,
    description: product.description,
    badge: product.badge,
    sku: product.sku,
    seoTitle: product.seoTitle,
    seoDescription: product.seoDescription,
    category: product.category,
    brand: product.brand,
    variants,
    images,
    mainImage: images[0] || null,
    minPrice: prices.length ? Math.min(...prices) : 0,
    maxPrice: prices.length ? Math.max(...prices) : 0,
    filterOptions: Array.isArray(product.filterOptions)
      ? product.filterOptions.map((item) => item.filterOption)
      : [],
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
  };
}

function createProductWhere({
  categoryIds,
  search,
  brand,
  filterSelection,
  minPrice,
  maxPrice,
}) {
  const where = {
    isPublished: true,
    category: {
      isPublished: true,
    },
    variants: {
      some: {
        isActive: true,
      },
    },
    images: {
      some: {},
    },
  };

  if (Array.isArray(categoryIds) && categoryIds.length) {
    where.categoryId = {
      in: categoryIds,
    };
  }

  if (brand) {
    where.brand = {
      slug: brand,
      isPublished: true,
    };
  }

  const and = [];

  if (search) {
    and.push({
      OR: [
        {
          title: {
            contains: search,
          },
        },
        {
          shortDescription: {
            contains: search,
          },
        },
        {
          sku: {
            contains: search,
          },
        },
        {
          brand: {
            name: {
              contains: search,
            },
          },
        },
      ],
    });
  }

  for (const selection of filterSelection) {
    and.push({
      filterOptions: {
        some: {
          filterOptionId: {
            in: selection.optionIds,
          },
          filterOption: {
            groupId: selection.groupId,
          },
        },
      },
    });
  }

  if (minPrice !== undefined || maxPrice !== undefined) {
    const priceWhere = {
      isActive: true,
    };

    if (minPrice !== undefined) {
      priceWhere.price = {
        ...(priceWhere.price || {}),
        gte: minPrice,
      };
    }

    if (maxPrice !== undefined) {
      priceWhere.price = {
        ...(priceWhere.price || {}),
        lte: maxPrice,
      };
    }

    and.push({
      variants: {
        some: priceWhere,
      },
    });
  }

  if (and.length) {
    where.AND = and;
  }

  return where;
}

function createProductOrderBy(sort) {
  if (sort === 'newest') {
    return [
      {
        createdAt: 'desc',
      },
      {
        id: 'desc',
      },
    ];
  }

  return [
    {
      sortOrder: 'asc',
    },
    {
      createdAt: 'desc',
    },
    {
      id: 'desc',
    },
  ];
}

router.get('/meta', async (req, res, next) => {
  try {
    const categorySlug = String(req.query.category || '').trim();

    const [categories, brands] = await prisma.$transaction([
      prisma.productCategory.findMany({
        where: {
          isPublished: true,
        },
        orderBy: [
          {
            sortOrder: 'asc',
          },
          {
            name: 'asc',
          },
        ],
        select: {
          id: true,
          name: true,
          slug: true,
          description: true,
          imagePath: true,
          parentId: true,
          sortOrder: true,
        },
      }),
      prisma.brand.findMany({
        where: {
          isPublished: true,
          products: {
            some: {
              isPublished: true,
            },
          },
        },
        orderBy: [
          {
            sortOrder: 'asc',
          },
          {
            name: 'asc',
          },
        ],
        select: {
          id: true,
          name: true,
          slug: true,
          logoPath: true,
        },
      }),
    ]);

    let filterGroups = [];

    if (categorySlug) {
      const categoryIds = await getCategoryAndDescendantIds(categorySlug);

      if (categoryIds === null) {
        return res.status(404).json({
          message: 'Категория не найдена',
        });
      }

      filterGroups = await prisma.filterGroup.findMany({
        where: {
          categoryId: {
            in: categoryIds,
          },
          isPublished: true,
        },
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
          slug: true,
          categoryId: true,
          options: {
            where: {
              isPublished: true,
            },
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
              value: true,
            },
          },
        },
      });
    }

    setCatalogCache(res, 120);

    return res.json({
      categories: createCategoryTree(categories),
      brands,
      filterGroups,
    });
  } catch (error) {
    return next(error);
  }
});

router.get('/products', async (req, res, next) => {
  try {
    const parsed = catalogQuerySchema.safeParse(req.query);

    if (!parsed.success) {
      return res.status(400).json({
        message: parsed.error.issues[0]?.message || 'Некорректные параметры каталога',
      });
    }

    const {
      category,
      search,
      brand,
      filters,
      minPrice,
      maxPrice,
      sort,
      page,
      limit,
    } = parsed.data;

    const categoryIds = await getCategoryAndDescendantIds(category);

    if (categoryIds === null) {
      return res.status(404).json({
        message: 'Категория не найдена',
      });
    }

    const filterSelection = parseFilterSelection(filters);

    const where = createProductWhere({
      categoryIds,
      search,
      brand,
      filterSelection,
      minPrice,
      maxPrice,
    });

    const skip = (page - 1) * limit;
    const isPriceSort = sort === 'price-asc' || sort === 'price-desc';

    let normalized = [];
    let total = 0;

    if (isPriceSort) {
      const products = await prisma.product.findMany({
        where,
        orderBy: createProductOrderBy('default'),
        include: publicProductInclude,
      });

      const sortedProducts = products.map(createPublicProductResponse);

      sortedProducts.sort((first, second) => {
        const direction = sort === 'price-asc' ? 1 : -1;
        const priceDifference = (first.minPrice - second.minPrice) * direction;

        if (priceDifference !== 0) {
          return priceDifference;
        }

        return first.id - second.id;
      });

      total = sortedProducts.length;
      normalized = sortedProducts.slice(skip, skip + limit);
    } else {
      const [products, productsTotal] = await prisma.$transaction([
        prisma.product.findMany({
          where,
          orderBy: createProductOrderBy(sort),
          skip,
          take: limit,
          include: publicProductInclude,
        }),
        prisma.product.count({
          where,
        }),
      ]);

      total = productsTotal;
      normalized = products.map(createPublicProductResponse);
    }

    setCatalogCache(res, 30);

    return res.json({
      products: normalized,
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

router.get('/products/:slug', async (req, res, next) => {
  try {
    const parsedSlug = slugSchema.safeParse(req.params.slug);

    if (!parsedSlug.success) {
      return res.status(400).json({
        message: 'Некорректный адрес товара',
      });
    }

    const product = await prisma.product.findFirst({
      where: {
        slug: parsedSlug.data,
        isPublished: true,
        category: {
          isPublished: true,
        },
        variants: {
          some: {
            isActive: true,
          },
        },
        images: {
          some: {},
        },
      },
      include: publicProductInclude,
    });

    if (!product) {
      return res.status(404).json({
        message: 'Товар не найден',
      });
    }

    setCatalogCache(res, 60);

    return res.json({
      product: createPublicProductResponse(product),
    });
  } catch (error) {
    return next(error);
  }
});

router.post('/cart', async (req, res, next) => {
  try {
    const parsed = cartBodySchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        message: 'Проверьте состав корзины',
      });
    }

    const requestedItems = new Map();

    for (const item of parsed.data.items) {
      requestedItems.set(
        item.variantId,
        Math.min((requestedItems.get(item.variantId) || 0) + item.quantity, 20),
      );
    }

    const variantIds = [...requestedItems.keys()];

    const variants = await prisma.productVariant.findMany({
      where: {
        id: {
          in: variantIds,
        },
        isActive: true,
        product: {
          isPublished: true,
          category: {
            isPublished: true,
          },
          images: {
            some: {},
          },
        },
      },
      select: {
        id: true,
        name: true,
        sku: true,
        price: true,
        oldPrice: true,
        product: {
          select: {
            id: true,
            slug: true,
            title: true,
            badge: true,
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
                imagePath: true,
                alt: true,
              },
            },
          },
        },
      },
    });

    const byId = new Map(variants.map((variant) => [variant.id, variant]));
    const items = [];
    let total = 0;

    for (const [variantId, quantity] of requestedItems.entries()) {
      const variant = byId.get(variantId);

      if (!variant) {
        continue;
      }

      const lineTotal = variant.price * quantity;
      total += lineTotal;

      items.push({
        variantId: variant.id,
        variantName: variant.name,
        sku: variant.sku,
        price: variant.price,
        oldPrice: variant.oldPrice,
        quantity,
        lineTotal,
        product: {
          id: variant.product.id,
          slug: variant.product.slug,
          title: variant.product.title,
          badge: variant.product.badge,
          image: variant.product.images[0] || null,
        },
      });
    }

    return res.json({
      items,
      total,
      removedVariantIds: variantIds.filter((id) => !byId.has(id)),
    });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
