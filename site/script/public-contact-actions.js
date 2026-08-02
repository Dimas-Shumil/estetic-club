(() => {
  const body = document.body;

  if (!body) return;

  const createIcon = (pathData) => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');

    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');

    path.setAttribute('d', pathData);
    svg.appendChild(path);

    return svg;
  };

  document.querySelectorAll('.header__mobile-contact').forEach((contact) => {
    if (contact.querySelector('a[href="/contacts#contact-form"]')) return;

    const bookingButton = document.createElement('a');

    bookingButton.className = 'header__mobile-call';
    bookingButton.href = '/contacts#contact-form';
    bookingButton.setAttribute('aria-label', 'Перейти к форме записи');

    bookingButton.appendChild(
      createIcon(
        'M8 2v3M16 2v3M3 9h18M5 4h14a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM8 14l2.5 2.5L16 11',
      ),
    );

    const bookingText = document.createElement('span');
    bookingText.textContent = 'Записаться';

    bookingButton.appendChild(bookingText);
    contact.appendChild(bookingButton);
  });

  if (document.querySelector('.mobile-call-fab')) return;

  if (document.querySelector('.catalog-mobile-add')) {
    body.classList.add('has-catalog-mobile-bar');
  }

  if (document.querySelector('.product-detail__mobile-bar')) {
    body.classList.add('has-product-mobile-bar');
  }

  const callButton = document.createElement('a');

  callButton.className = 'mobile-call-fab';
  callButton.href = 'tel:+79235853333';
  callButton.setAttribute('aria-label', 'Позвонить в Культуру волос');

  callButton.appendChild(
    createIcon(
      'M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.12.9.33 1.78.62 2.63a2 2 0 0 1-.45 2.11L8 9.73a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.85.29 1.73.5 2.63.62A2 2 0 0 1 22 16.92z',
    ),
  );

  body.appendChild(callButton);

  const bookingButton = document.createElement('a');

  bookingButton.className = 'mobile-call-fab mobile-booking-fab';
  bookingButton.href = '/contacts#contact-form';
  bookingButton.setAttribute('aria-label', 'Перейти к форме записи');

  bookingButton.appendChild(
    createIcon(
      'M8 2v3M16 2v3M3 9h18M5 4h14a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM8 14l2.5 2.5L16 11',
    ),
  );

  body.appendChild(bookingButton);

  const footer = document.querySelector('footer');

  if (footer && 'IntersectionObserver' in window) {
    const footerObserver = new IntersectionObserver(
      (entries) => {
        const isFooterVisible = entries.some((entry) => entry.isIntersecting);

        callButton.classList.toggle('mobile-call-fab--hidden', isFooterVisible);
        bookingButton.classList.toggle(
          'mobile-call-fab--hidden',
          isFooterVisible,
        );
      },
      {
        threshold: 0.01,
      },
    );

    footerObserver.observe(footer);
  }
})();
