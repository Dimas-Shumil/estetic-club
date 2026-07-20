(() => {
  const body = document.body;

  if (!body || document.querySelector('.mobile-call-fab')) return;

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

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');

  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', 'M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.12.9.33 1.78.62 2.63a2 2 0 0 1-.45 2.11L8 9.73a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.85.29 1.73.5 2.63.62A2 2 0 0 1 22 16.92z');
  svg.appendChild(path);
  callButton.appendChild(svg);
  body.appendChild(callButton);

  const footer = document.querySelector('footer');

  if (footer && 'IntersectionObserver' in window) {
    const footerObserver = new IntersectionObserver((entries) => {
      const isFooterVisible = entries.some((entry) => entry.isIntersecting);
      callButton.classList.toggle('mobile-call-fab--hidden', isFooterVisible);
    }, { threshold: 0.01 });

    footerObserver.observe(footer);
  }
})();
