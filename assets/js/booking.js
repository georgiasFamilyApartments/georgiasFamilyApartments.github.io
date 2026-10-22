// Availability calendar + booking request form.
// Booked nights come from /assets/data/availability.json, which a GitHub Action
// refreshes from the Booking.com / Airbnb calendar feeds (see tools/sync_availability.py).
(() => {
  const cfgEl = document.getElementById('booking-config');
  if (!cfgEl) return;
  const cfg = JSON.parse(cfgEl.textContent);
  const T = cfg.t;
  const fill = (s, n) => s.replace('%N', n);
  const icon = name => `<svg class="i" aria-hidden="true"><use href="/assets/img/icons.svg#${name}"/></svg>`;

  // ── Dates as local 'YYYY-MM-DD' strings (no time-zone surprises) ──────────
  const pad = n => String(n).padStart(2, '0');
  const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parse = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return iso(d); };
  const nights = (a, b) => Math.round((parse(b) - parse(a)) / 864e5);
  const isISO = s => /^\d{4}-\d{2}-\d{2}$/.test(s || '');
  const today = iso(new Date());
  const fmtLong = new Intl.DateTimeFormat(cfg.lang, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  const fmtShort = new Intl.DateTimeFormat(cfg.lang, { day: 'numeric', month: 'short' });
  const fmtMonth = new Intl.DateTimeFormat(cfg.lang, { month: 'long', year: 'numeric' });
  const fmtAria = new Intl.DateTimeFormat(cfg.lang, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const weekdays = [...Array(7)].map((_, i) => new Intl.DateTimeFormat(cfg.lang, { weekday: 'short' }).format(new Date(2024, 0, 1 + i)));

  // ── Availability ──────────────────────────────────────────────────────────
  let availability = null;
  const loaded = fetch(cfg.availabilityUrl, { cache: 'no-cache' })
    .then(r => (r.ok ? r.json() : null))
    .catch(() => null)
    .then(data => { availability = data; });

  function bookedNights(apt) {
    const set = new Set();
    for (const [start, end] of availability?.apartments?.[apt] || []) {
      for (let d = start; d < end; d = addDays(d, 1)) set.add(d);
    }
    return set;
  }

  // ── Range calendar ────────────────────────────────────────────────────────
  class RangeCalendar {
    constructor(root, { apt = '', onChange = () => {} } = {}) {
      this.root = root;
      this.onChange = onChange;
      this.booked = new Set();
      this.checkIn = null;
      this.checkOut = null;
      this.offset = 0; // months after the current month
      this.apt = apt;
      root.classList.add('cal');
      root.innerHTML = `
        <div class="cal-head">
          <button type="button" class="cal-nav" data-dir="-1" aria-label="${T.cal.prev}">${icon('left')}</button>
          <button type="button" class="cal-nav" data-dir="1" aria-label="${T.cal.next}">${icon('right')}</button>
        </div>
        <div class="cal-months"></div>
        <div class="cal-foot">
          <ul class="cal-legend plain">
            <li><i></i>${T.cal.available}</li>
            <li><i class="lg-booked"></i>${T.cal.booked}</li>
            <li><i class="lg-selected"></i>${T.cal.selected}</li>
          </ul>
          <button type="button" class="cal-clear" hidden>${T.cal.clear}</button>
        </div>
        <p class="cal-status" aria-live="polite"></p>`;
      this.monthsEl = root.querySelector('.cal-months');
      this.statusEl = root.querySelector('.cal-status');
      this.clearBtn = root.querySelector('.cal-clear');

      root.querySelectorAll('.cal-nav').forEach(b => b.addEventListener('click', () => {
        this.offset = Math.max(0, Math.min(18, this.offset + Number(b.dataset.dir)));
        this.render();
      }));
      this.clearBtn.addEventListener('click', () => this.setRange(null, null));
      this.monthsEl.addEventListener('click', e => {
        const b = e.target.closest('.cal-day');
        if (b && !b.disabled) this.pick(b.dataset.date);
      });
      this.monthsEl.addEventListener('pointerover', e => {
        const b = e.target.closest('.cal-day');
        if (b) this.preview(b.dataset.date);
      });
      this.monthsEl.addEventListener('pointerleave', () => this.preview(null));

      this.months = 1;
      new ResizeObserver(() => {
        const m = root.clientWidth >= 580 ? 2 : 1;
        if (m !== this.months) { this.months = m; this.render(); }
      }).observe(root);
      this.render();
    }

    setApartment(apt) {
      this.apt = apt;
      this.booked = apt ? bookedNights(apt) : new Set();
      if (this.checkIn && !this.isFreeRange(this.checkIn, this.checkOut || addDays(this.checkIn, 1))) {
        this.setRange(null, null);
      } else {
        this.render();
      }
    }

    setRange(checkIn, checkOut) {
      this.checkIn = checkIn;
      this.checkOut = checkOut;
      this.render();
      this.onChange(checkIn, checkOut);
    }

    showMonthOf(date) {
      const d = parse(date), now = new Date();
      this.offset = Math.max(0, (d.getFullYear() - now.getFullYear()) * 12 + d.getMonth() - now.getMonth());
      this.render();
    }

    isFreeRange(a, b) {
      for (let d = a; d < b; d = addDays(d, 1)) if (this.booked.has(d)) return false;
      return true;
    }

    validCheckOut(d) {
      return this.checkIn && d > this.checkIn && nights(this.checkIn, d) >= cfg.minNights && this.isFreeRange(this.checkIn, d);
    }

    get picking() { return Boolean(this.checkIn && !this.checkOut); }

    pick(d) {
      if (this.picking && this.validCheckOut(d)) return this.setRange(this.checkIn, d);
      if (this.picking && d > this.checkIn && this.isFreeRange(this.checkIn, d)) {
        this.statusEl.textContent = fill(T.cal.min_nights, cfg.minNights);
        return;
      }
      if (!this.booked.has(d)) this.setRange(d, null);
    }

    preview(hover) {
      const show = this.picking && hover && this.validCheckOut(hover);
      this.monthsEl.querySelectorAll('.cal-day').forEach(b => {
        const d = b.dataset.date;
        b.classList.toggle('is-preview', Boolean(show && d > this.checkIn && d <= hover));
      });
    }

    render() {
      this.root.style.setProperty('--months', this.months);
      const now = new Date();
      const first = new Date(now.getFullYear(), now.getMonth() + this.offset, 1);
      let html = '';
      for (let m = 0; m < this.months; m++) {
        const start = new Date(first.getFullYear(), first.getMonth() + m, 1);
        const daysIn = new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate();
        const lead = (start.getDay() + 6) % 7; // weeks start on Monday
        html += `<div class="cal-month"><h3>${fmtMonth.format(start)}</h3><div class="cal-grid">`;
        html += weekdays.map(w => `<span class="cal-wd">${w}</span>`).join('');
        html += '<span></span>'.repeat(lead);
        for (let day = 1; day <= daysIn; day++) {
          const d = iso(new Date(start.getFullYear(), start.getMonth(), day));
          const past = d < today;
          const booked = this.booked.has(d);
          const validOut = this.picking && this.validCheckOut(d);
          const selectable = !past && (validOut || !booked);
          const cls = ['cal-day'];
          if (past) cls.push('is-past');
          if (booked && !validOut) cls.push('is-booked');
          if (d === today) cls.push('is-today');
          if (d === this.checkIn) cls.push('is-start', this.checkOut ? '' : 'is-only');
          if (d === this.checkOut) cls.push('is-end');
          if (this.checkIn && this.checkOut && d > this.checkIn && d < this.checkOut) cls.push('is-range');
          const label = fmtAria.format(parse(d)) + (booked ? ` — ${T.cal.booked}` : '');
          html += `<button type="button" class="${cls.join(' ').trim()}" data-date="${d}" aria-label="${label}"` +
            `${d === this.checkIn || d === this.checkOut ? ' aria-pressed="true"' : ''}${selectable ? '' : ' disabled'}>${day}</button>`;
        }
        html += '</div></div>';
      }
      this.monthsEl.innerHTML = html;
      const [prev, next] = this.root.querySelectorAll('.cal-nav');
      prev.disabled = this.offset === 0;
      next.disabled = this.offset >= 18;
      this.clearBtn.hidden = !this.checkIn;
      this.statusEl.textContent = this.status();
    }

    status() {
      if (!this.checkIn) return T.cal.pick_in;
      if (!this.checkOut) return `${fmtShort.format(parse(this.checkIn))} → ${T.cal.pick_out}`;
      const n = nights(this.checkIn, this.checkOut);
      return `${fmtShort.format(parse(this.checkIn))} – ${fmtShort.format(parse(this.checkOut))} · ${n === 1 ? T.cal.nights_one : fill(T.cal.nights, n)}`;
    }
  }

  // ── Apartment page: calendar + "request these dates" link ─────────────────
  const aptCalEl = document.querySelector('[data-calendar][data-apt]');
  if (aptCalEl) {
    const link = document.querySelector('[data-request]');
    const base = link.getAttribute('href');
    const cal = new RangeCalendar(aptCalEl, {
      onChange(a, b) {
        link.href = a && b ? `${base}&in=${a}&out=${b}` : base;
      },
    });
    cal.root.classList.add('is-waiting');
    loaded.then(() => { cal.root.classList.remove('is-waiting'); cal.setApartment(aptCalEl.dataset.apt); });
  }

  // ── Booking page ──────────────────────────────────────────────────────────
  const form = document.getElementById('book-form');
  if (!form) return;
  const $ = sel => document.querySelector(sel);
  const sum = key => document.querySelector(`[data-sum="${key}"]`);
  const status = form.querySelector('.form-status');
  const submitBtn = form.querySelector('[type="submit"]');
  const params = new URLSearchParams(location.search);

  const cal = new RangeCalendar(form.querySelector('[data-calendar]'), { onChange: updateSummary });

  const apt = () => form.elements.apartment.value;
  const guests = () => Number(form.elements.adults.value) + Number(form.elements.children.value);

  function climateFee(a, b) {
    let total = 0;
    for (let d = a; d < b; d = addDays(d, 1)) {
      const m = parse(d).getMonth(); // April (3) – October (9) is high season
      total += m >= 3 && m <= 9 ? cfg.feeSummer : cfg.feeWinter;
    }
    return total;
  }

  function guestText() {
    const c = Number(form.elements.children.value);
    return `${T.adults}: ${form.elements.adults.value}` + (c ? ` · ${T.children}: ${c}` : '');
  }

  function updateSummary() {
    const a = cfg.apartments[apt()];
    sum('apartment').textContent = a ? a.name : '—';
    sum('in').textContent = cal.checkIn ? fmtLong.format(parse(cal.checkIn)) : '—';
    sum('out').textContent = cal.checkOut ? fmtLong.format(parse(cal.checkOut)) : '—';
    sum('guests').textContent = guestText();
    const n = cal.checkIn && cal.checkOut ? nights(cal.checkIn, cal.checkOut) : 0;
    sum('nights').textContent = n ? (n === 1 ? T.cal.nights_one : fill(T.cal.nights, n)) : '';
    const fee = n ? climateFee(cal.checkIn, cal.checkOut) : 0;
    sum('fee').hidden = !fee;
    sum('fee').textContent = fee ? `${T.feeNote} €${fee}` : '';
    const tooMany = a && guests() > a.guests;
    sum('warn').hidden = !tooMany;
    sum('warn').textContent = tooMany ? fill(T.tooMany, a.guests) : '';
    const wa = $('[data-whatsapp]');
    if (wa) wa.href = `https://wa.me/${cfg.phone.replace('+', '')}?text=${encodeURIComponent(messageText(false))}`;
  }

  function messageText(full = true) {
    const f = form.elements;
    const a = cfg.apartments[apt()];
    const lines = [
      `Booking request — ${a ? a.nameEn : '?'}`,
      `Check-in: ${cal.checkIn || '?'}`,
      `Check-out: ${cal.checkOut || '?'}` + (cal.checkIn && cal.checkOut ? ` (${nights(cal.checkIn, cal.checkOut)} nights)` : ''),
      `Guests: ${f.adults.value} adults, ${f.children.value} children`,
    ];
    if (full) {
      lines.push(
        `Name: ${f.first_name.value} ${f.last_name.value}`,
        `Email: ${f.email.value}`,
        `Phone: ${f.phone.value}`,
        `Country: ${f.country.value}`,
        `Arrival time: ${f.arrival_time.value || '-'}`,
        `Language: ${cfg.lang}`,
        '',
        f.message.value || '',
      );
    }
    return lines.join('\n').trim();
  }

  form.addEventListener('change', e => {
    if (e.target.name === 'apartment') {
      cal.setApartment(apt());
      cal.root.classList.remove('is-waiting');
    }
    updateSummary();
  });

  form.addEventListener('submit', async e => {
    e.preventDefault();
    status.className = 'form-status';
    status.textContent = '';
    form.classList.add('was-validated');
    const a = cfg.apartments[apt()];
    if (!a) {
      form.querySelector('.apt-pick').scrollIntoView({ block: 'center' });
      return;
    }
    if (!cal.checkIn || !cal.checkOut) {
      status.classList.add('is-error');
      status.textContent = T.noDates;
      cal.root.scrollIntoView({ block: 'center' });
      return;
    }
    if (guests() > a.guests) {
      status.classList.add('is-error');
      status.textContent = fill(T.tooMany, a.guests);
      return;
    }
    if (!form.reportValidity()) return;
    if (form.elements.botcheck.checked) return;

    const f = form.elements;
    const subject = `Booking request: ${a.nameEn}, ${cal.checkIn} → ${cal.checkOut} (${f.first_name.value} ${f.last_name.value})`;

    if (!cfg.web3formsKey) {
      // No form service configured yet: hand the request to the guest's email app.
      status.textContent = T.mailFallback;
      location.href = `mailto:${cfg.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(messageText())}`;
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = T.sending;
    try {
      const res = await fetch('https://api.web3forms.com/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          access_key: cfg.web3formsKey,
          subject,
          from_name: "Georgia's Family Apartments website",
          replyto: f.email.value,
          apartment: a.nameEn,
          check_in: cal.checkIn,
          check_out: cal.checkOut,
          nights: nights(cal.checkIn, cal.checkOut),
          adults: f.adults.value,
          children: f.children.value,
          name: `${f.first_name.value} ${f.last_name.value}`,
          email: f.email.value,
          phone: f.phone.value,
          country: f.country.value,
          arrival_time: f.arrival_time.value || '-',
          message: f.message.value || '-',
          language: cfg.lang,
        }),
      });
      const out = await res.json().catch(() => ({}));
      if (!res.ok || out.success === false) throw new Error(out.message || res.status);
      $('[data-book]').hidden = true;
      const ok = $('[data-success]');
      ok.hidden = false;
      ok.focus();
      ok.scrollIntoView({ block: 'center' });
    } catch (err) {
      status.classList.add('is-error');
      status.textContent = T.error;
      submitBtn.disabled = false;
      submitBtn.textContent = T.submit;
    }
  });

  // Pre-fill from the URL (?apt=natural&in=2026-11-02&out=2026-11-06&adults=2)
  const pApt = params.get('apt');
  if (cfg.apartments[pApt]) form.querySelector(`input[name="apartment"][value="${pApt}"]`).checked = true;
  ['adults', 'children'].forEach(k => {
    const v = params.get(k);
    if (v && [...form.elements[k].options].some(o => o.value === v)) form.elements[k].value = v;
  });
  if (!apt()) cal.root.classList.add('is-waiting');
  loaded.then(() => {
    if (apt()) cal.setApartment(apt());
    const pin = params.get('in'), pout = params.get('out');
    if (isISO(pin) && pin >= today) {
      cal.showMonthOf(pin);
      if (isISO(pout) && pout > pin && cal.isFreeRange(pin, pout)) cal.setRange(pin, pout);
      else if (!cal.booked.has(pin)) cal.setRange(pin, null);
    }
    updateSummary();
  });
  updateSummary();
})();
