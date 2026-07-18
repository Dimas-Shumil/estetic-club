'use strict';

document.addEventListener('DOMContentLoaded', () => {
  initHeader();
  initSmoothAnchorScroll();
  initServicesBackground();
  initServiceModal();
  initServicesReveal();
});

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const lerp = (start, end, progress) => start + (end - start) * progress;

const mixColor = (from, to, progress) =>
  from.map((channel, index) => Math.round(lerp(channel, to[index], progress)));

// хедер

function initHeader() {
  const header = document.querySelector('[data-header]');
  const burger = document.querySelector('[data-burger]');
  const mobileMenu = document.querySelector('[data-mobile-menu]');

  if (!header || !burger || !mobileMenu) return;

  let lastScrollY = window.scrollY;
  let isTicking = false;
  let touchStartY = 0;

  function updateHeader() {
    const currentScrollY = window.scrollY;
    const isScrolled = currentScrollY > 24;
    const isScrollingDown = currentScrollY > lastScrollY;
    const isMenuOpen = header.classList.contains('is-menu-open');

    header.classList.toggle('is-scrolled', isScrolled);

    if (currentScrollY > 140 && isScrollingDown && !isMenuOpen) {
      header.classList.add('is-hidden');
    } else {
      header.classList.remove('is-hidden');
    }

    lastScrollY = currentScrollY;
    isTicking = false;
  }

  function requestHeaderUpdate() {
    if (isTicking) return;

    window.requestAnimationFrame(updateHeader);
    isTicking = true;
  }

  function openMobileMenu() {
    header.classList.add('is-menu-open');
    document.body.classList.add('is-lock');

    burger.setAttribute('aria-expanded', 'true');
    burger.setAttribute('aria-label', 'Закрыть меню');

    header.classList.remove('is-hidden');
  }

  function closeMobileMenu() {
    header.classList.remove('is-menu-open');
    document.body.classList.remove('is-lock');

    burger.setAttribute('aria-expanded', 'false');
    burger.setAttribute('aria-label', 'Открыть меню');
  }

  function toggleMobileMenu() {
    const isOpen = header.classList.contains('is-menu-open');

    if (isOpen) {
      closeMobileMenu();
    } else {
      openMobileMenu();
    }
  }

  function closeMenuAfterScrollIntent() {
    if (!header.classList.contains('is-menu-open')) return;

    closeMobileMenu();

    if (window.scrollY > 140) {
      header.classList.add('is-hidden');
    }
  }

  burger.addEventListener('click', toggleMobileMenu);

  mobileMenu.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', closeMobileMenu);
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeMobileMenu();
    }
  });

  window.addEventListener('scroll', requestHeaderUpdate, {
    passive: true,
  });

  window.addEventListener('wheel', closeMenuAfterScrollIntent, {
    passive: true,
  });

  document.addEventListener(
    'touchstart',
    (event) => {
      if (!header.classList.contains('is-menu-open')) return;
      if (event.target.closest('[data-burger]')) return;

      touchStartY = event.touches[0].clientY;
    },
    {
      passive: true,
    }
  );

  document.addEventListener(
    'touchmove',
    (event) => {
      if (!header.classList.contains('is-menu-open')) return;
      if (event.target.closest('[data-burger]')) return;

      const currentY = event.touches[0].clientY;
      const diff = Math.abs(currentY - touchStartY);

      if (diff > 12) {
        closeMenuAfterScrollIntent();
      }
    },
    {
      passive: true,
    }
  );

  updateHeader();
}

// скролл

function initSmoothAnchorScroll() {
  const header = document.querySelector('[data-header]');
  const prefersReducedMotion = window.matchMedia(
    '(prefers-reduced-motion: reduce)'
  ).matches;

  const getHeaderOffset = () => {
    if (!header) return 24;

    const headerHeight = header.getBoundingClientRect().height;

    return headerHeight + 28;
  };

  const closeMobileMenu = () => {
    if (!header) return;

    const burger = header.querySelector('[data-burger]');

    header.classList.remove('is-menu-open');
    document.body.classList.remove('is-lock');

    if (burger) {
      burger.setAttribute('aria-expanded', 'false');
      burger.setAttribute('aria-label', 'Открыть меню');
    }
  };

  const scrollToTarget = (target, shouldUpdateHash = true) => {
    if (!target) return;

    const targetTop =
      target.getBoundingClientRect().top +
      window.pageYOffset -
      getHeaderOffset();

    closeMobileMenu();

    window.scrollTo({
      top: Math.max(targetTop, 0),
      behavior: prefersReducedMotion ? 'auto' : 'smooth',
    });

    if (shouldUpdateHash && target.id) {
      window.history.pushState(null, '', `#${target.id}`);
    }
  };

  document.addEventListener('click', (event) => {
    const link = event.target.closest('a[href]');

    if (!link) return;

    const href = link.getAttribute('href');

    if (!href || href === '#') return;

    let url;

    try {
      url = new URL(href, window.location.href);
    } catch {
      return;
    }

    if (!url.hash) return;

    const isSamePage =
      url.origin === window.location.origin &&
      url.pathname === window.location.pathname;

    if (!isSamePage) return;

    const targetId = decodeURIComponent(url.hash.slice(1));
    const target = document.getElementById(targetId);

    if (!target) return;

    event.preventDefault();

    scrollToTarget(target);
  });

  if (window.location.hash) {
    const targetId = decodeURIComponent(window.location.hash.slice(1));
    const target = document.getElementById(targetId);

    if (!target) return;

    window.setTimeout(() => {
      scrollToTarget(target, false);
    }, 120);
  }
}

// услуги

const servicesData = {
  airtouch: {
    number: '01',
    eyebrow: 'Сложное окрашивание',
    title: 'AirTouch',
    description:
      'Воздушная техника осветления с мягкой растяжкой цвета. Позволяет получить объёмный оттенок без резкой границы у корней.',
    duration: '5–8 часов',
    price: 'от 15 000 ₽',
    image: '/site/img/img1aft.jpg',
    benefits: [
      'мягкий и естественный блонд',
      'плавное и аккуратное отрастание',
      'визуальный объём и игру оттенков',
      'длительный результат без частой коррекции',
    ],
  },

  shatush: {
    number: '02',
    eyebrow: 'Сложное окрашивание',
    title: 'Шатуш',
    description:
      'Свободная техника окрашивания с эффектом естественно выгоревших прядей. Создаёт мягкие блики и сохраняет глубину натурального цвета.',
    duration: '4–6 часов',
    price: 'от 12 000 ₽',
    image: '/site/img/img2aft.jpg',
    benefits: [
      'добавить волосам солнечные блики',
      'освежить образ без резкой смены цвета',
      'сохранить натуральный оттенок у корней',
      'получить мягкий рельеф и глубину',
    ],
  },

  highlights: {
    number: '03',
    eyebrow: 'Осветление прядей',
    title: 'Мелирование волос',
    description:
      'Деликатное осветление отдельных прядей для создания рельефа, движения и визуального объёма. Рисунок подбирается индивидуально.',
    duration: '4–6 часов',
    price: 'от 10 000 ₽',
    image: '/site/img/img1bef.jpg',
    benefits: [
      'сделать цвет более рельефным',
      'мягко перейти к более светлому образу',
      'добавить объём тонким волосам',
      'освежить оттенок без полного окрашивания',
    ],
  },

  'total-blonde': {
    number: '04',
    eyebrow: 'Полное осветление',
    title: 'Тотал блонд',
    description:
      'Полное осветление и создание чистого светлого оттенка. Формула и домашний уход подбираются с учётом состояния волос.',
    duration: '5–8 часов',
    price: 'от 14 000 ₽',
    image: '/site/img/img2bef.jpg',
    benefits: [
      'получить выразительный светлый образ',
      'скорректировать нежелательный оттенок',
      'добиться чистого и равномерного цвета',
      'сохранить максимально возможное качество волос',
    ],
  },

  toning: {
    number: '05',
    eyebrow: 'Коррекция оттенка',
    title: 'Тонирование волос',
    description:
      'Мягкая коррекция оттенка, которая возвращает цвету глубину, блеск и ухоженный вид без радикального изменения образа.',
    duration: '2–3 часа',
    price: 'от 7 000 ₽',
    image: '/site/img/IMG_4750.PNG',
    benefits: [
      'обновить потускневший цвет',
      'нейтрализовать нежелательный оттенок',
      'добавить волосам блеск и плотность',
      'поддержать результат сложного окрашивания',
    ],
  },

  reconstruction: {
    number: '06',
    eyebrow: 'Выпрямление',
    title: 'Реконструкция волос',
    description:
      'Процедура для гладкости, плотности и дисциплины волос. Состав подбирается после диагностики с учётом структуры и желаемого результата.',
    duration: '3–5 часов',
    price: 'от 8 000 ₽',
    image: '/site/img/IMG_4749.PNG',
    benefits: [
      'уменьшить пушистость и пористость',
      'облегчить ежедневную укладку',
      'получить гладкость и зеркальный блеск',
      'сделать полотно волос более дисциплинированным',
    ],
  },

  care: {
    number: '07',
    eyebrow: 'Восстановление',
    title: 'Индивидуальный уход для волос',
    description:
      'Персональная программа восстановления, составленная после диагностики. Помогает вернуть волосам мягкость, эластичность и ухоженный вид.',
    duration: '1,5–3 часа',
    price: 'от 5 000 ₽',
    image: '/site/img/IMG_4750.PNG',
    benefits: [
      'восстановить волосы после окрашивания',
      'уменьшить сухость и ломкость',
      'вернуть мягкость и эластичность',
      'подобрать профессиональный домашний уход',
    ],
  },
};

// переход фона

function initServicesBackground() {
  const flow = document.querySelector('[data-services-flow]');
  const catalog = document.querySelector('.services-catalog');

  if (!flow || !catalog) return;

  const darkColor = [47, 35, 26];
  const lightColor = [251, 247, 240];

  let isTicking = false;

  function update() {
    const rect = catalog.getBoundingClientRect();
    const start = window.innerHeight * 0.92;
    const end = window.innerHeight * 0.3;
    const progress = clamp((start - rect.top) / (start - end), 0, 1);

    const [red, green, blue] = mixColor(
      darkColor,
      lightColor,
      progress
    );

    const [textRed, textGreen, textBlue] = mixColor(
      [255, 247, 239],
      [47, 35, 26],
      progress
    );

    const [mutedRed, mutedGreen, mutedBlue] = mixColor(
      [232, 215, 195],
      [91, 69, 52],
      progress
    );

    flow.style.setProperty(
      '--services-bg',
      `rgb(${red}, ${green}, ${blue})`
    );

    flow.style.setProperty(
      '--services-copy',
      `rgb(${textRed}, ${textGreen}, ${textBlue})`
    );

    flow.style.setProperty(
      '--services-copy-muted',
      `rgb(${mutedRed}, ${mutedGreen}, ${mutedBlue})`
    );

    isTicking = false;
  }

  function requestUpdate() {
    if (isTicking) return;

    isTicking = true;
    window.requestAnimationFrame(update);
  }

  update();

  window.addEventListener('scroll', requestUpdate, {
    passive: true,
  });

  window.addEventListener('resize', requestUpdate);
}

// попап услуг

function initServiceModal() {
  const modal = document.querySelector('[data-service-modal]');

  if (!modal) return;

  const dialog = modal.querySelector('.service-modal__dialog');
  const image = modal.querySelector('[data-modal-image]');
  const number = modal.querySelector('[data-modal-number]');
  const eyebrow = modal.querySelector('[data-modal-eyebrow]');
  const title = modal.querySelector('[data-modal-title]');
  const description = modal.querySelector('[data-modal-description]');
  const duration = modal.querySelector('[data-modal-duration]');
  const price = modal.querySelector('[data-modal-price]');
  const benefits = modal.querySelector('[data-modal-benefits]');
  const bookButton = modal.querySelector('[data-modal-book]');

  let lastFocusedElement = null;

  function getFocusableElements() {
    return [
      ...dialog.querySelectorAll(
        'a[href], button:not([disabled])'
      ),
    ];
  }

  function openModal(key, trigger) {
    const service = servicesData[key];

    if (!service) return;

    lastFocusedElement = trigger;

    image.src = service.image;
    image.alt = service.title;
    number.textContent = service.number;
    eyebrow.textContent = service.eyebrow;
    title.textContent = service.title;
    description.textContent = service.description;
    duration.textContent = service.duration;
    price.textContent = service.price;

    benefits.innerHTML = service.benefits
      .map((benefit) => `<li>${benefit}</li>`)
      .join('');

    bookButton.setAttribute(
      'aria-label',
      `Записаться на услугу ${service.title}`
    );

    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');

    document.body.classList.add('is-service-modal-open');

    window.requestAnimationFrame(() => {
      const closeButton = modal.querySelector(
        '[data-service-close]'
      );

      if (closeButton) {
        closeButton.focus();
      }
    });
  }

  function closeModal() {
    if (!modal.classList.contains('is-open')) return;

    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');

    document.body.classList.remove('is-service-modal-open');

    if (lastFocusedElement) {
      lastFocusedElement.focus();
    }
  }

  document.addEventListener('click', (event) => {
    const openButton = event.target.closest(
      '[data-service-open]'
    );

    const closeButton = event.target.closest(
      '[data-service-close]'
    );

    if (openButton) {
      openModal(
        openButton.dataset.serviceOpen,
        openButton
      );
    }

    if (closeButton) {
      closeModal();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (!modal.classList.contains('is-open')) return;

    if (event.key === 'Escape') {
      closeModal();
      return;
    }

    if (event.key !== 'Tab') return;

    const focusableElements = getFocusableElements();
    const firstElement = focusableElements[0];
    const lastElement =
      focusableElements[focusableElements.length - 1];

    if (!firstElement || !lastElement) return;

    if (
      event.shiftKey &&
      document.activeElement === firstElement
    ) {
      event.preventDefault();
      lastElement.focus();
    } else if (
      !event.shiftKey &&
      document.activeElement === lastElement
    ) {
      event.preventDefault();
      firstElement.focus();
    }
  });
}

// появление блоков

function initServicesReveal() {
  const elements = document.querySelectorAll(
    '[data-services-reveal]'
  );

  if (!elements.length) return;

  const prefersReducedMotion = window.matchMedia(
    '(prefers-reduced-motion: reduce)'
  ).matches;

  if (prefersReducedMotion) {
    elements.forEach((element) => {
      element.classList.add('is-visible');
    });

    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;

        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    },
    {
      threshold: 0.12,
    }
  );

  elements.forEach((element) => {
    observer.observe(element);
  });
}
