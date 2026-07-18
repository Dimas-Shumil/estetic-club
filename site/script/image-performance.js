'use strict';

(() => {
  const staticImages = {
    '/site/img/img1aft.webp': { width: 1170, height: 1308, variants: [480, 768] },
    '/site/img/img1bef.webp': { width: 1170, height: 1269, variants: [480, 768] },
    '/site/img/img2aft.webp': { width: 1170, height: 1390, variants: [480, 768] },
    '/site/img/img2bef.webp': { width: 1170, height: 1282, variants: [480, 768] },
    '/site/img/img_4749.webp': { width: 1170, height: 2046, variants: [480, 768] },
    '/site/img/img_4750.webp': { width: 1170, height: 2205, variants: [480, 768] },
    '/site/img/main-hero-bg.webp': { width: 1672, height: 941, variants: [768, 1280] },
    '/site/img/main-hero-mob-bg.webp': { width: 941, height: 1672, variants: [480, 768] },
    '/site/img/pablito.webp': { width: 640, height: 640, variants: [320] },
    '/site/img/blog/blog-hero.webp': { width: 1672, height: 941, variants: [768, 1280] },
    '/site/img/contacts/contact-hero.webp': { width: 1024, height: 1133, variants: [480, 768] },
    '/site/img/contacts/equipment-climazon.webp': { width: 1122, height: 1402, variants: [480, 768] },
    '/site/img/contacts/equipment-dyson.webp': { width: 1122, height: 1402, variants: [480, 768] },
    '/site/img/contacts/equipment-mirror.webp': { width: 1122, height: 1402, variants: [480, 768] },
    '/site/img/contacts/equipment-wash.webp': { width: 1420, height: 1108, variants: [480, 768, 1200] },
    '/site/img/contacts/services-intro.webp': { width: 1122, height: 1402, variants: [480, 768] },
    '/site/img/contacts/services-intro2.webp': { width: 1124, height: 1399, variants: [480, 768] },
    '/site/img/contacts/services-intro3.webp': { width: 1092, height: 1441, variants: [480, 768] },
  };

  function escapeAttribute(value) {
    return String(value ?? '').replace(/[&<>"']/g, (character) => {
      const entities = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;',
      };

      return entities[character];
    });
  }

  function normalize(src) {
    const value = String(src || '').trim();
    return value;
  }

  function getMeta(src) {
    return staticImages[normalize(src)] || null;
  }

  function getSrcset(src) {
    const normalizedSrc = normalize(src);
    const meta = getMeta(normalizedSrc);

    if (!meta) return '';

    const base = normalizedSrc.slice(0, -5);
    const variants = meta.variants.map((width) => `${base}-${width}.webp ${width}w`);

    variants.push(`${normalizedSrc} ${meta.width}w`);
    return variants.join(', ');
  }

  function getDimensions(src, fallbackWidth, fallbackHeight) {
    const meta = getMeta(src);

    if (meta) {
      return { width: meta.width, height: meta.height };
    }

    if (fallbackWidth && fallbackHeight) {
      return { width: fallbackWidth, height: fallbackHeight };
    }

    return null;
  }

  function attrs(src, options = {}) {
    const normalizedSrc = normalize(src);
    const meta = getMeta(normalizedSrc);
    const dimensions = getDimensions(
      normalizedSrc,
      options.fallbackWidth,
      options.fallbackHeight,
    );
    const attributes = [
      `src="${escapeAttribute(normalizedSrc)}"`,
      `decoding="async"`,
    ];

    if (options.loading) {
      attributes.push(`loading="${escapeAttribute(options.loading)}"`);
    }

    if (options.fetchpriority) {
      attributes.push(`fetchpriority="${escapeAttribute(options.fetchpriority)}"`);
    }

    if (dimensions) {
      attributes.push(`width="${dimensions.width}"`, `height="${dimensions.height}"`);
    }

    if (meta) {
      attributes.push(`srcset="${escapeAttribute(getSrcset(normalizedSrc))}"`);

      if (options.sizes) {
        attributes.push(`sizes="${escapeAttribute(options.sizes)}"`);
      }
    }

    return attributes.join(' ');
  }

  function apply(image, src, options = {}) {
    if (!image || !src) return;

    const normalizedSrc = normalize(src);
    const meta = getMeta(normalizedSrc);
    const dimensions = getDimensions(
      normalizedSrc,
      options.fallbackWidth,
      options.fallbackHeight,
    );

    image.src = normalizedSrc;
    image.decoding = 'async';

    if (options.loading) {
      image.loading = options.loading;
    }

    if (options.fetchpriority) {
      image.setAttribute('fetchpriority', options.fetchpriority);
    } else {
      image.removeAttribute('fetchpriority');
    }

    if (dimensions) {
      image.width = dimensions.width;
      image.height = dimensions.height;
    } else {
      image.removeAttribute('width');
      image.removeAttribute('height');
    }

    if (meta) {
      image.srcset = getSrcset(normalizedSrc);

      if (options.sizes) {
        image.sizes = options.sizes;
      } else {
        image.removeAttribute('sizes');
      }
    } else {
      image.removeAttribute('srcset');
      image.removeAttribute('sizes');
    }
  }

  window.KulturaImage = {
    apply,
    attrs,
    getMeta,
    getSrcset,
    normalize,
  };
})();
