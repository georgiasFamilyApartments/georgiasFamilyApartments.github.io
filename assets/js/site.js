// Site-wide behaviour: mobile menu, photo lightbox, click-to-load map, quick search form.
(() => {
  const icon = name => `<svg class="i" aria-hidden="true"><use href="/assets/img/icons.svg#${name}"/></svg>`;

  // Mobile menu
  const toggle = document.querySelector('.nav-toggle');
  const nav = document.getElementById('site-nav');
  if (toggle && nav) {
    const setOpen = open => {
      nav.classList.toggle('open', open);
      toggle.setAttribute('aria-expanded', open);
    };
    toggle.addEventListener('click', () => setOpen(!nav.classList.contains('open')));
    nav.addEventListener('click', e => { if (e.target.closest('a')) setOpen(false); });
  }

  // Lightbox for every [data-gallery] container
  let lb, lbImg, lbCap, lbCount, items = [], index = 0;

  function buildLightbox() {
    lb = document.createElement('dialog');
    lb.className = 'lb';
    lb.innerHTML = `
      <div class="lb-top"><span class="lb-count"></span><button class="lb-close" aria-label="Close">${icon('close')}</button></div>
      <div class="lb-stage">
        <button class="lb-prev" aria-label="Previous">${icon('left')}</button>
        <img alt="">
        <button class="lb-next" aria-label="Next">${icon('right')}</button>
      </div>
      <p class="lb-cap"></p>`;
    document.body.append(lb);
    lbImg = lb.querySelector('img');
    lbCap = lb.querySelector('.lb-cap');
    lbCount = lb.querySelector('.lb-count');
    lb.querySelector('.lb-close').onclick = () => lb.close();
    lb.querySelector('.lb-prev').onclick = () => show(index - 1);
    lb.querySelector('.lb-next').onclick = () => show(index + 1);
    lb.addEventListener('keydown', e => {
      if (e.key === 'ArrowLeft') show(index - 1);
      if (e.key === 'ArrowRight') show(index + 1);
    });
    lb.addEventListener('click', e => { if (e.target === lb || e.target.classList.contains('lb-stage')) lb.close(); });
    let x0 = null;
    lb.addEventListener('touchstart', e => { x0 = e.touches[0].clientX; }, { passive: true });
    lb.addEventListener('touchend', e => {
      if (x0 === null) return;
      const dx = e.changedTouches[0].clientX - x0;
      if (Math.abs(dx) > 40) show(index + (dx < 0 ? 1 : -1));
      x0 = null;
    });
    lb.addEventListener('close', () => { document.body.style.overflow = ''; });
  }

  const srcset = href => {
    const base = href.replace(/-1600\.webp$/, '');
    return `${base}-960.webp 960w, ${base}-1600.webp 1600w`;
  };

  function show(i) {
    index = (i + items.length) % items.length;
    const a = items[index];
    lbImg.srcset = srcset(a.href);
    lbImg.sizes = '100vw';
    lbImg.src = a.href;
    lbImg.alt = a.dataset.caption || '';
    lbCap.textContent = a.dataset.caption || '';
    lbCount.textContent = `${index + 1} / ${items.length}`;
    // Warm up the neighbours so swiping feels instant
    [index + 1, index - 1].forEach(j => {
      const n = items[(j + items.length) % items.length];
      if (n) { const im = new Image(); im.srcset = srcset(n.href); im.sizes = '100vw'; }
    });
  }

  function open(gallery, i) {
    if (!lb) buildLightbox();
    items = [...gallery.querySelectorAll('a[href$=".webp"]')];
    show(i);
    document.body.style.overflow = 'hidden';
    lb.showModal();
  }

  document.addEventListener('click', e => {
    const gallery = e.target.closest('[data-gallery]');
    if (!gallery || typeof HTMLDialogElement !== 'function') return;
    const opener = e.target.closest('[data-open-gallery]');
    const link = e.target.closest('a[href$=".webp"]');
    if (!opener && !link) return;
    e.preventDefault();
    const links = [...gallery.querySelectorAll('a[href$=".webp"]')];
    open(gallery, opener ? 0 : links.indexOf(link));
  });

  // Map: only load Google Maps when the visitor asks for it (faster page, no cookies up front)
  document.querySelectorAll('[data-map]').forEach(map => {
    map.querySelector('button')?.addEventListener('click', () => {
      const frame = document.createElement('iframe');
      frame.src = map.dataset.map;
      frame.title = 'Map';
      frame.loading = 'lazy';
      frame.referrerPolicy = 'no-referrer-when-downgrade';
      map.replaceChildren(frame);
    });
  });

  // Quick search on the home page: no past dates, check-out after check-in
  const quick = document.querySelector('.quick');
  if (quick) {
    const d = new Date();
    const today = new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
    const [inEl, outEl] = [quick.elements.in, quick.elements.out];
    inEl.min = outEl.min = today;
    inEl.addEventListener('change', () => {
      if (!inEl.value) return;
      const next = new Date(inEl.value);
      next.setDate(next.getDate() + 1);
      outEl.min = next.toISOString().slice(0, 10);
      if (!outEl.value || outEl.value <= inEl.value) outEl.value = outEl.min;
    });
    // Don't send empty fields to the booking page
    quick.addEventListener('submit', () => {
      [...quick.elements].forEach(el => { if (el.name && !el.value) el.disabled = true; });
      setTimeout(() => [...quick.elements].forEach(el => { el.disabled = false; }), 0);
    });
  }
})();
