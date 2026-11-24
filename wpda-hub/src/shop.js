// ================= Shop: price list, order, certificates =================

const WHOLESALE = /^\/wholesale/i.test(location.pathname) || /[?&]wholesale\b/i.test(location.search);
const TIERS = WHOLESALE ? [1, 3, 5, 10] : [1, 3, 5];
const WA_NUMBER = '61468315677';
const ORDER_EMAIL = 'hello@stayoptml.com';
const PAYMENT_NOTE = 'Pay by PayID once we confirm your order. Details come by reply.';
const REPLY_NOTE = 'We reply within 30 minutes, 8am–8pm AEST.';
const SHOP_KEY = 'optml-shop-' + (WHOLESALE ? 'wholesale' : 'retail') + '-v1';
const SHOP_SAVED = ['cart', 'name', 'phone', 'email', 'street', 'suburb', 'region', 'postcode', 'notes', 'code', 'ref', 'sent', 'country', 'nzShip', 'lastOrder'];
const SHOP_BY_SKU = Object.fromEntries(SHOP_PRODUCTS.map(p => [p.sku, p]));
const money = n => '$' + Math.round(n).toLocaleString('en-AU');

// Price list SKU -> WPDA protocol (and which vial size it is)
const SKU_PROTOCOL = {
  RE10: ['reta', 0], RE20: ['reta', 1], RE30: ['reta', 2], TI10: ['tirz', 0], TI20: ['tirz', 1], TI30: ['tirz', 2],
  TE10: ['tesa', 0], SL10: ['slu', 0], BP10: ['bpc', 0], TB10: ['tb', 0], KP10: ['kpv', 0], WO20: ['wolv', 0], BA50: ['bpcarg', 0],
  GH50: ['ghk', 0], GH100: ['ghk', 1], ME10: ['mt2', 0], GL70: ['glow', 0], KL80: ['klow', 0], MO10: ['mots', 0], MO40: ['mots', 1],
  NA1000: ['nad', 0], CJ10: ['cjc', 0], GH10: ['ghrp', 0], SK10: ['selank', 0], SX10: ['semax', 0], KI10: ['kiss', 0], DS10: ['dsip', 0]
};
const PROTOCOL_SKUS = {};
Object.keys(SKU_PROTOCOL).forEach(sku => { const [pid, idx] = SKU_PROTOCOL[sku]; (PROTOCOL_SKUS[pid] = PROTOCOL_SKUS[pid] || [])[idx] = sku; });

function splitName(name) {
  const m = String(name).match(/^(.*?)\s+(\d[\d.,]*\s*(?:mg|mcg|g|iu)\b.*)$/i);
  return m ? [m[1], m[2]] : [name, ''];
}

function defaultShop() {
  return { cart: {}, name: '', phone: '', email: '', street: '', suburb: '', region: '', postcode: '', notes: '', country: 'AU', nzShip: 'standard',
    touched: {}, code: '', codeInput: '', codeOpen: false, codeError: '', ref: makeRef(), sent: false, lastOrder: null, q: '', goal: 'all', copied: false, toast: '' };
}
function loadShop() {
  const sh = defaultShop();
  try { const saved = JSON.parse(localStorage.getItem(SHOP_KEY) || 'null'); if (saved) SHOP_SAVED.forEach(k => { if (saved[k] !== undefined && saved[k] !== null) sh[k] = saved[k]; }); } catch (e) {}
  return sh;
}

// Order maths and the WhatsApp message. The message format is the one the OPTML CRM's "paste web order" reads.
function computeOrder(sh, now) {
  const items = Object.keys(sh.cart).filter(k => sh.cart[k] > 0 && SHOP_BY_SKU[k.split(':')[0]]).map(key => {
    const bits = key.split(':'); const p = SHOP_BY_SKU[bits[0]]; const n = parseInt(bits[1], 10); const qty = sh.cart[key];
    return { key, p, n, qty, amount: (p.prices[n] || 0) * qty, pack: n === 1 ? 'single vial' : n + '-vial pack' };
  }).filter(it => it.p.prices[it.n] && (WHOLESALE || it.n !== 10));
  const subtotal = items.reduce((s, it) => s + it.amount, 0);
  const packCount = items.reduce((s, it) => s + it.qty, 0);
  const codes = parseCodes(DEFAULT_CODES);
  const rule = sh.code && codes[sh.code] ? codes[sh.code] : null;
  let discount = 0, codeNote = '', codeActive = false;
  if (rule) {
    if (subtotal > 0 && subtotal >= rule.min) { discount = rule.fixed ? Math.min(rule.value, subtotal) : Math.round(subtotal * rule.value / 100); codeActive = true; codeNote = sh.code + ' applied: ' + (rule.fixed ? money(rule.value) : rule.value + '%') + ' off'; }
    else codeNote = sh.code + ' works on orders over ' + money(rule.min) + '. Add ' + money(rule.min - subtotal) + ' more.';
  }
  const afterDiscount = Math.max(0, subtotal - discount);
  const nz = sh.country === 'NZ', nzExp = sh.nzShip === 'express';
  const shipFee = nz ? (nzExp ? 25 : 20) : SHIP_FLAT;
  const shipName = nz ? (nzExp ? 'NZ express shipping' : 'NZ standard shipping') : 'Express shipping';
  const freeShip = !nz && afterDiscount >= FREE_SHIP_AT;
  const shipping = items.length && !freeShip ? shipFee : 0;
  const total = afterDiscount + shipping;
  const remaining = Math.max(0, FREE_SHIP_AT - afterDiscount);
  const digits = sh.phone.replace(/\D/g, ''); const emailTrim = sh.email.trim();
  const ok = {
    name: sh.name.trim().length >= 2, phone: digits.length >= 8 && digits.length <= 13, email: !emailTrim || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrim),
    street: sh.street.trim().length >= 4, suburb: sh.suburb.trim().length >= 2, region: (nz ? NZ_REGIONS : STATES).indexOf(sh.region) >= 0, postcode: /^\d{4}$/.test(sh.postcode.trim())
  };
  const msgs = { name: 'Enter your full name', phone: nz ? 'Enter a mobile number, e.g. 021 123 4567' : 'Enter a mobile number, e.g. 0412 345 678', email: "That email doesn't look right",
    street: 'Enter your street address', suburb: 'Enter your suburb', region: nz ? 'Choose a region' : 'Choose a state', postcode: 'Enter a 4-digit postcode' };
  const names = { name: 'name', phone: 'mobile', email: 'email', street: 'street address', suburb: nz ? 'suburb / town' : 'suburb', region: nz ? 'region' : 'state', postcode: 'postcode' };
  const err = {}; Object.keys(ok).forEach(k => { err[k] = sh.touched[k] && !ok[k] ? msgs[k] : ''; });
  const pcState = nz ? '' : stateFromPostcode(sh.postcode.trim());
  const regionWarn = ok.postcode && ok.region && pcState && pcState !== sh.region ? 'Postcode ' + sh.postcode.trim() + ' is usually in ' + pcState + '. Double-check the state.' : '';
  const missing = Object.keys(ok).filter(k => !ok[k]).map(k => names[k]);
  const detailsOk = missing.length === 0 && items.length > 0;
  // message
  const when = new Date(now);
  const stamp = when.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }) + ', ' + when.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' });
  const addr = [sh.street.trim(), [sh.suburb.trim(), sh.region, sh.postcode.trim()].filter(Boolean).join(' '), nz ? 'New Zealand' : 'Australia'].filter(Boolean);
  const W = 26; const FENCE = String.fromCharCode(96, 96, 96);
  const row = (label, value) => { const gap = W - label.length - value.length; return gap >= 1 ? label + ' '.repeat(gap) + value : label + '\n' + ' '.repeat(Math.max(0, W - value.length)) + value; };
  const mono = items.map(it => it.qty + '× ' + it.p.name + '\n' + row('   ' + it.pack, money(it.amount)))
    .concat(['-'.repeat(W), row('Subtotal', money(subtotal))])
    .concat(discount ? [row('Discount · ' + sh.code, '-' + money(discount))] : [])
    .concat([row(nz ? (nzExp ? 'NZ express' : 'NZ standard') : 'Express shipping', freeShip ? 'Free' : money(shipFee)), row('TOTAL', money(total) + ' AUD')])
    .join('\n');
  const lines = ['*optml*', '*' + (WHOLESALE ? 'WHOLESALE ORDER ' : 'ORDER ') + sh.ref + '*', stamp, '', FENCE + mono + FENCE, '', '*Bill to*', sh.name.trim(), sh.phone.trim()]
    .concat(emailTrim ? [emailTrim] : []).concat(['', '*Ship to*']).concat(addr)
    .concat(sh.notes.trim() ? ['Notes: ' + sh.notes.trim()] : [])
    .concat(['', '*Payment*', 'PayID — details sent on confirmation', 'Status: awaiting confirmation', '', '_Sent from the optml price list_']);
  const waText = lines.join('\n');
  const plainText = waText.replace(new RegExp('[*_' + String.fromCharCode(96) + ']', 'g'), '');
  return { items, subtotal, packCount, discount, codeNote, codeActive, rule, afterDiscount, nz, nzExp, shipFee, shipName, freeShip, shipping, total, remaining,
    ok, err, regionWarn, missing, detailsOk, waText, plainText,
    orderHref: 'https://wa.me/' + WA_NUMBER + '?text=' + encodeURIComponent(waText),
    emailHref: 'mailto:' + ORDER_EMAIL + '?subject=' + encodeURIComponent('optml order ' + sh.ref) + '&body=' + encodeURIComponent(plainText) };
}

function tierInfo(p, n, qty) {
  const save = n > 1 ? Math.round((1 - p.prices[n] / (p.prices[1] * n)) * 100) : 0;
  const saveAmt = n > 1 ? p.prices[1] * n - p.prices[n] : 0;
  const wasN = (p.was && p.was[n]) || 0;
  const onSale = wasN > p.prices[n];
  return { n, qty, price: money(p.prices[n]), was: onSale ? money(wasN) : '', label: n === 1 ? '1 vial' : n + ' vials',
    each: n > 1 ? money(Math.round(p.prices[n] / n)) + ' each' : '', saveAmt: saveAmt > 0 ? 'Save ' + money(saveAmt) : '',
    badge: onSale ? '−' + Math.round((1 - p.prices[n] / wasN) * 100) + '%' : (save >= 5 ? 'Save ' + save + '%' : '') };
}

function ShipCountdown() {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const cutoff = new Date(now); cutoff.setHours(14, 0, 0, 0);
  const ms = cutoff - now;
  if (ms <= 0) return html`<span>Same-day dispatch before 2pm. Orders now ship next business day.</span>`;
  const h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000), s = Math.floor((ms % 60000) / 1000);
  return html`<span>Same-day dispatch: order within <b style="font-variant-numeric:tabular-nums">${(h ? h + 'h ' : '') + m + 'm' + (h ? '' : ' ' + s + 's')}</b></span>`;
}

// Offer to turn one or two single vials into a 3-pack when that saves money.
function packOffer(p, cart) {
  const q1 = cart[p.sku + ':1'] || 0;
  if (!p.prices[3] || q1 < 1 || q1 > 2) return null;
  const save = p.prices[1] * 3 - p.prices[3]; const extra = p.prices[3] - p.prices[1] * q1;
  return save > 0 && extra > 0 ? { q1, save, extra } : null;
}
function PackNudge({ p, sh, bump, dark }) {
  const of = packOffer(p, sh.cart);
  if (!of) return null;
  return html`<button type="button" class=${'nudge' + (dark ? ' dark' : '')} onClick=${() => { bump(p.sku + ':1', -of.q1); bump(p.sku + ':3', 1); }}>
    <span><b>Make it a 3-pack</b> for ${money(of.extra)} more</span><i>Save ${money(of.save)}</i></button>`;
}
function bestTier(p) {
  const ts = TIERS.filter(n => n > 1 && p.prices[n]);
  return ts.length ? ts.reduce((a, n) => p.prices[n] / n < p.prices[a] / a ? n : a, ts[0]) : 0;
}

function Tiers({ p, sh, bump, compact }) {
  const tiers = TIERS.filter(n => p.prices[n]); const bestN = compact ? 0 : bestTier(p);
  return html`<div class="tiers" style=${'grid-template-columns:repeat(' + tiers.length + ',minmax(0,1fr))'}>${tiers.map(n => {
    const key = p.sku + ':' + n; const t = tierInfo(p, n, sh.cart[key] || 0);
    return t.qty ? html`<div class="tier on" role="group" aria-label=${t.label + ' of ' + p.name + ', ' + t.qty + ' in your order'}>
        <span class="tl">${t.label}${compact ? '' : ', ' + t.price}</span>
        <span class="stepper"><button type="button" aria-label=${'Remove one ' + t.label + ' of ' + p.name} onClick=${() => bump(key, -1)}>−</button><b>${t.qty}</b><button type="button" aria-label=${'Add another ' + t.label + ' of ' + p.name} onClick=${() => bump(key, 1)}>+</button></span>
      </div>`
      : html`<button type="button" class=${'tier' + (n === bestN ? ' best' : '')} aria-label=${'Add ' + t.label + ' of ' + p.name + ', ' + t.price + (n === bestN ? ', best value' : '')} onClick=${() => bump(key, 1)}>
        ${n === bestN ? html`<span class="tag">Best value</span>` : null}<span class="tl">${t.label}</span><span class="tp">${t.price}</span>
        <span class="tn">${n === 1 ? (t.was ? html`<s>${t.was}</s>` : null) : t.each}</span>
        ${!compact && n > 1 && t.saveAmt ? html`<span class="sv">${t.saveAmt}</span>` : null}
      </button>`;
  })}</div>`;
}

function groupProducts(list) {
  const groups = [], by = {};
  list.forEach(p => { const [base, strength] = splitName(p.name); const k = strength ? base + '|' + p.goal : p.sku;
    if (!by[k]) { by[k] = { key: k, base: strength ? base : p.name, goal: p.goal, items: [] }; groups.push(by[k]); }
    by[k].items.push({ p, strength }); });
  return groups;
}

function ProductCard({ g, cur, sh, onOpen }) {
  const p = cur.p; const coa = COAS[p.sku]; const t1 = tierInfo(p, 1, 0);
  const inOrder = g.items.reduce((a, x) => a + TIERS.reduce((b, n) => b + (sh.cart[x.p.sku + ':' + n] || 0), 0), 0);
  const photo = PRODUCT_PHOTOS[p.sku];
  return html`<article class=${'pcard s-' + g.goal}>
    <div class="pmedia" onClick=${() => onOpen(g.key, p.sku)}>
      ${t1.was ? html`<span class="pflag">${t1.badge}</span>` : null}
      ${photo ? html`<img class="pphoto" src=${photo} alt=${p.name + ' vial'} loading="lazy" />` : html`<img class="pglyph" src=${GOAL_ICONS[g.goal]} alt="" />`}
      <button type="button" class=${'padd' + (inOrder ? ' has' : '')} aria-label=${inOrder ? g.base + ': ' + inOrder + ' in your order. Change packs' : 'Choose a pack of ' + p.name}>${inOrder ? inOrder : '+'}</button>
    </div>
    <div class="pbody">
      <a class="ptitle" href=${'#/p/' + p.sku}>${g.base}${g.items.length === 1 && cur.strength ? ' ' + cur.strength : ''}</a>
      <span class="psub">${coa ? html`<i class="okdot"></i>${coa[0]} pure<a class="coa-btn" href=${COA_BASE + coa[2]} target="_blank" rel="noopener" aria-label=${'Open the certificate of analysis for ' + p.name}>COA<${Icon} name="ext" size=${11} /></a>` : 'Research peptide'}</span>
      ${g.items.length > 1 ? html`<div class="dose-row" role="group" aria-label=${g.base + ' strength'}>${g.items.map(x => html`<button type="button" class="dose-pill" aria-pressed=${String(x.p.sku === p.sku)} aria-label=${g.base + ' ' + x.strength + ': choose a pack'} onClick=${() => onOpen(g.key, x.p.sku)}>${x.strength}</button>`)}</div>` : null}
      <button type="button" class="pbuy" aria-label=${'Add ' + p.name + ' to cart, from ' + t1.price + '. Choose a pack'} onClick=${() => onOpen(g.key, p.sku)}><span>Add to cart</span><b>${t1.price}</b></button>
    </div>
  </article>`;
}

// Bottom sheet opened by a card's + button: pick a pack for the chosen strength.
function QuickAdd({ g, cur, setPick, sh, bump, o, onClose }) {
  useEffect(() => {
    const k = e => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', k);
    const prev = document.body.style.overflow; document.body.style.overflow = 'hidden';
    const el = document.querySelector('.qa'); if (el) el.focus();
    return () => { document.removeEventListener('keydown', k); document.body.style.overflow = prev; };
  }, []);
  const p = cur.p; const coa = COAS[p.sku];
  return html`<div class="qa-back" onClick=${e => { if (e.target === e.currentTarget) onClose(); }}>
    <div class="qa" role="dialog" aria-modal="true" aria-label=${'Add ' + p.name + ' to your order'} tabindex="-1">
      <div class="qa-head"><img class=${PRODUCT_PHOTOS[p.sku] ? 'ph' : ''} src=${PRODUCT_PHOTOS[p.sku] || GOAL_ICONS[g.goal]} alt="" />
        <div class="grow"><h2>${g.base}${g.items.length === 1 && cur.strength ? ' ' + cur.strength : ''}</h2><div class="psub">${coa ? html`<i class="okdot"></i>${coa[0]} pure<a class="coa-btn" href=${COA_BASE + coa[2]} target="_blank" rel="noopener" aria-label="Open the certificate of analysis">COA<${Icon} name="ext" size=${11} /></a>` : GOAL_LABELS[g.goal]}</div></div>
        <button type="button" class="qa-x" aria-label="Close" onClick=${onClose}>×</button></div>
      ${g.items.length > 1 ? html`<div class="dose-row" role="group" aria-label=${g.base + ' strength'}>${g.items.map(x => html`<button type="button" class="dose-pill lg" aria-pressed=${String(x.p.sku === p.sku)} onClick=${() => setPick(g.key, x.p.sku)}>${x.strength}</button>`)}</div>` : null}
      <${Tiers} p=${p} sh=${sh} bump=${bump} />
      <${PackNudge} p=${p} sh=${sh} bump=${bump} />
      <p class="qa-note"><img src="assets/features/auto.svg" alt="" />Bac water comes free in the box with every vial.</p>
      <div class="qa-foot"><a class="btn outline" href=${'#/p/' + p.sku}>How to use</a>
        ${o.packCount ? html`<a class="btn" href="#/order">View order, ${money(o.total)}</a>` : html`<button type="button" class="btn" onClick=${onClose}>Done</button>`}</div>
    </div>
  </div>`;
}

function TopSellers({ groups, current, pick, sh, onOpen }) {
  const ref = useRef(null);
  const [edge, setEdge] = useState({ start: true, end: false });
  const sync = () => { const el = ref.current; if (el) setEdge({ start: el.scrollLeft < 8, end: el.scrollLeft + el.clientWidth > el.scrollWidth - 8 }); };
  useEffect(() => { sync(); window.addEventListener('resize', sync); return () => window.removeEventListener('resize', sync); }, []);
  const step = dir => { const el = ref.current; if (!el) return; const card = el.querySelector('.pcard'); const w = card ? card.getBoundingClientRect().width + 14 : 240;
    el.scrollBy({ left: dir * w * Math.max(1, Math.floor(el.clientWidth / w)), behavior: 'smooth' }); };
  const items = TOP_SELLERS.map(sku => { const g = groups.find(x => x.items.some(i => i.p.sku === sku)); return g ? { g, top: g.items.find(i => i.p.sku === sku) } : null; }).filter(Boolean);
  if (!items.length) return null;
  return html`<section class="tsell" aria-labelledby="h-top">
    <div class="tsell-head"><h2 id="h-top">Top sellers</h2>
      <div class="tsell-nav"><button type="button" aria-label="Previous top sellers" disabled=${edge.start} onClick=${() => step(-1)}><${Icon} name="back" size=${18} /></button><button type="button" aria-label="More top sellers" disabled=${edge.end} onClick=${() => step(1)}><${Icon} name="arrow" size=${18} /></button></div></div>
    <div class="tsell-track" ref=${ref} onScroll=${sync}>
      ${items.map(x => { const cur = pick[x.g.key] ? current(x.g) : x.top;
        return html`<${ProductCard} key=${x.g.key} g=${x.g} cur=${cur} sh=${sh} onOpen=${onOpen} />`; })}
    </div>
  </section>`;
}

function ShopSection({ sh, setSh, bump, o }) {
  const [pick, setPickRaw] = useState({});
  const [quick, setQuick] = useState(null);
  const setPick = (key, sku) => setPickRaw(s => Object.assign({}, s, { [key]: sku }));
  const q = sh.q.trim().toLowerCase();
  const list = SHOP_PRODUCTS.filter(p => (sh.goal === 'all' || p.goal === sh.goal) && (!q || (p.name + ' ' + p.sku + ' ' + GOAL_LABELS[p.goal] + ' ' + (INFO[p.sku] || '')).toLowerCase().includes(q)));
  const groups = groupProducts(list);
  const inCart = sku => TIERS.some(n => sh.cart[sku + ':' + n] > 0);
  const current = g => g.items.find(x => x.p.sku === pick[g.key]) || g.items.find(x => inCart(x.p.sku)) || g.items[0];
  const allGroups = groupProducts(SHOP_PRODUCTS);
  const qg = quick ? allGroups.find(g => g.key === quick) : null;
  const browsing = !q && sh.goal === 'all';
  const open = (key, sku) => { if (sku) setPick(key, sku); setQuick(key); };
  return html`<section id="shop" aria-labelledby="h-shop"><div class="wrap">
    ${browsing ? html`<${TopSellers} groups=${allGroups} current=${current} pick=${pick} sh=${sh} onOpen=${open} />` : null}
    <h2 id="h-shop" class=${browsing ? 'allhead' : 'sr'}>${WHOLESALE ? 'Wholesale price list' : 'All products'}</h2>
    <div class="finder">
      <label class="field"><span class="sr">Search the price list</span><input class="input" type="search" placeholder="Search — reta, bpc, ghk…" value=${sh.q} onInput=${e => setSh({ q: e.target.value })} /></label>
      <div class="sticky-filters">
        <div class="scrollx" role="group" aria-label="Filter by goal">
          <button type="button" class="pill" aria-pressed=${String(sh.goal === 'all')} onClick=${() => setSh({ goal: 'all' })}>All</button>
          ${GOALS.map(g => html`<button type="button" class="pill" aria-pressed=${String(sh.goal === g)} onClick=${() => setSh({ goal: sh.goal === g ? 'all' : g })}><img src=${GOAL_ICONS[g]} alt="" />${GOAL_LABELS[g]}</button>`)}
        </div>
      </div>
    </div>
    <p class="taphint"><span aria-hidden="true">+</span>Tap a product to choose 1, 3 or 5 vials.</p>
    <div class="pgrid">
      ${groups.map(g => html`<${ProductCard} key=${g.key} g=${g} cur=${current(g)} sh=${sh} onOpen=${open} />`)}
    </div>
    ${list.length === 0 ? html`<div class="empty" style="margin-top:12px">Nothing matches "${sh.q.trim()}". Try a compound name or clear the search.</div>` : null}
    <p class="listnote">Prices in AUD${WHOLESALE ? '; 10-vial rates are wholesale only' : ''}. Express shipping is $15 in Australia and free over $200. New Zealand from $20.</p>
    ${qg ? html`<${QuickAdd} g=${qg} cur=${current(qg)} setPick=${setPick} sh=${sh} bump=${bump} o=${o} onClose=${() => setQuick(null)} />` : null}
  </div></section>`;
}

function OrderSection({ sh, setSh, bump, o, onSent, planReady }) {
  const field = k => e => { const v = e.target.value; setSh(prev => { const next = { [k]: v, sent: false }; if (k === 'postcode' && prev.country !== 'NZ' && /^\d{4}$/.test(v) && !prev.region) { const s = stateFromPostcode(v); if (s) next.region = s; } return next; }); };
  const blur = k => () => setSh(prev => ({ touched: Object.assign({}, prev.touched, { [k]: true }) }));
  const stage = sh.sent && o.items.length ? 4 : !o.items.length ? 1 : o.detailsOk ? 3 : 2;
  const applyCode = () => { const c = sh.codeInput.trim().toUpperCase(); if (!c) return; const codes = parseCodes(DEFAULT_CODES); if (codes[c]) setSh({ code: c, codeError: '', codeOpen: false, codeInput: '' }); else setSh({ codeError: "That code isn't valid. Check the spelling and try again." }); };
  const copy = () => { const done = () => { setSh({ copied: true }); setTimeout(() => setSh({ copied: false }), 2000); }; if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(o.plainText).then(done, done); else done(); };
  const send = () => { onSent(o.items); };
  const lastItems = sh.lastOrder && sh.lastOrder.cart ? Object.keys(sh.lastOrder.cart).map(k => { const b = k.split(':'); const p = SHOP_BY_SKU[b[0]]; const n = parseInt(b[1], 10); return p && p.prices[n] ? { key: k, qty: sh.lastOrder.cart[k], p, n } : null; }).filter(Boolean) : [];
  const inp = (k, label, extra = {}) => html`<label class="field"><span>${label}</span><input class="input" style=${o.err[k] ? 'border-color:var(--bad)' : ''} value=${sh[k]} onInput=${field(k)} onBlur=${blur(k)} aria-invalid=${o.err[k] ? 'true' : 'false'} ...${extra} />${o.err[k] ? html`<small>${o.err[k]}</small>` : null}</label>`;
  return html`<div class="wrap page narrow" id="order">
    <div class="orderbox">
      <div class="row g12 wrapx" style="justify-content:space-between;align-items:flex-end"><div><div class="ref">${WHOLESALE ? 'Wholesale order ' : 'Order '}${sh.ref}</div><h2 id="h-order" style="margin-top:6px">${stage === 4 ? 'Order sent' : 'Your order'}</h2></div>
        <ol class="ostep" aria-label="Order progress">${['Build', 'Details', 'Send'].map((l, i) => html`<li class=${i + 1 < stage ? 'done' : i + 1 === stage ? 'now' : ''}><span>${i + 1 < stage ? '✓' : i + 1}</span>${l}</li>`)}</ol></div>

      ${!o.items.length && !sh.sent ? html`<div class="oempty"><p>Tap any price in the list to add a pack. Tap again for more, minus to take one off.</p>
        ${lastItems.length ? html`<button type="button" class="btn on-dark sm" onClick=${() => { const c = {}; lastItems.forEach(it => { c[it.key] = it.qty; }); setSh({ cart: c, sent: false }); }}>Order again: ${lastItems.slice(0, 2).map(it => it.qty + '× ' + it.p.name).join(', ')}${lastItems.length > 2 ? ' + more' : ''}</button>` : html`<a class="btn on-dark sm" href="#/">Browse the price list</a>`}</div>` : null}

      ${sh.sent && o.items.length ? html`<div class="osent">
        <p>Your order is in WhatsApp. We confirm stock and send payment details by reply. ${REPLY_NOTE}</p>
        <div class="row g8 wrapx"><a class="btn sm on-dark-outline" href=${o.orderHref} target="_blank" rel="noopener">Didn't open? Resend on WhatsApp</a>
          <button type="button" class="btn sm on-dark-outline" onClick=${() => setSh({ cart: {}, sent: false, code: '', codeInput: '', ref: makeRef() })}>Start a new order</button></div>
        ${planReady ? html`<div class="guidecard"><b style="font-size:20px;letter-spacing:-.02em;color:var(--ink)">Your guide is ready</b>
          <p class="small">Exact units to draw for each compound, how to mix it with the bac water in the box, where to inject, and a daily tracker. Save it as a PDF to keep.</p>
          <div class="row g8 wrapx"><a class="btn sm" href="#/plan">Open my tracker</a><button type="button" class="btn sm outline" onClick=${() => window.print()}>Save my guide as PDF</button></div></div>` : null}
      </div>` : null}

      ${o.items.length ? html`<div class="olines">${o.items.map(it => html`<div class="oline"><b class="on">${it.p.name}</b><b class="op">${money(it.amount)}</b><span class="ok">${it.pack}</span>
          <span class="stepper dark"><button type="button" aria-label=${'One less ' + it.p.name + ' ' + it.pack} onClick=${() => bump(it.key, -1)}>−</button><b>${it.qty}</b><button type="button" aria-label=${'One more ' + it.p.name + ' ' + it.pack} onClick=${() => bump(it.key, 1)}>+</button></span>
          ${it.key.split(':')[1] === '1' && !sh.sent ? html`<${PackNudge} p=${it.p} sh=${sh} bump=${bump} dark />` : null}</div>`)}</div>
        ${!o.nz ? html`<div class="shipbar"><div class="tiny">${o.freeShip ? 'Free express shipping unlocked' : 'Add ' + money(o.remaining) + ' more for free express shipping'}</div><div class="bar"><i style=${'width:' + Math.min(100, Math.round(o.afterDiscount / FREE_SHIP_AT * 100)) + '%'}></i></div></div>` : null}
        <div class="otot">
          <div><span>Subtotal (AUD)</span><b>${money(o.subtotal)}</b></div>
          ${o.discount ? html`<div><span>Discount · ${sh.code}</span><b>−${money(o.discount)}</b></div>` : null}
          <div><span>${o.shipName}</span><b>${o.freeShip ? 'Free' : money(o.shipFee)}</b></div>
          <div class="grand"><span>Total</span><b>${money(o.total)} AUD</b></div>
        </div>
        <div>${sh.code ? html`<div class="row g8 wrapx tiny"><span>${o.codeNote}</span><button type="button" class="btn sm on-dark-outline" onClick=${() => setSh({ code: '', codeOpen: false, codeError: '' })}>Remove code</button></div>`
          : sh.codeOpen ? html`<div class="row g8"><label class="grow"><span class="sr">Discount code</span><input class="input" placeholder="Discount code" value=${sh.codeInput} onInput=${e => setSh({ codeInput: e.target.value.toUpperCase(), codeError: '' })} onKeyDown=${e => { if (e.key === 'Enter') { e.preventDefault(); applyCode(); } }} /></label><button type="button" class="btn on-dark sm" onClick=${applyCode}>Apply</button></div>${sh.codeError ? html`<div class="tiny" style="color:#fff;font-weight:600;margin-top:6px">${sh.codeError}</div>` : null}`
          : html`<button type="button" class="linkbtn" onClick=${() => setSh({ codeOpen: true, codeError: '' })}>Have a discount code?</button>`}</div>
        ${planReady && !sh.sent ? html`<a class="planlink" href="#/plan"><${Icon} name="plan" size=${18} /><span>The guide for these is ready in <b>My plan</b></span><${Icon} name="chev" size=${16} /></a>` : null}
      ` : null}

    </div>
    ${o.items.length && !sh.sent ? html`<div class="odetails">
        <div class="row g12 wrapx" style="justify-content:space-between"><h2 style="font-size:24px;letter-spacing:-.03em">Your details</h2>
          <div class="seg" role="group" aria-label="Shipping country"><button type="button" aria-pressed=${String(!o.nz)} onClick=${() => setSh(p => p.country === 'NZ' ? { country: 'AU', region: '' } : {})}>Australia</button><button type="button" aria-pressed=${String(o.nz)} onClick=${() => setSh(p => p.country !== 'NZ' ? { country: 'NZ', region: '' } : {})}>New Zealand</button></div></div>
        <div class="fgrid light">
          ${inp('name', 'Full name', { autocomplete: 'name' })}
          ${inp('phone', 'Mobile', { autocomplete: 'tel', inputmode: 'tel' })}
          ${inp('email', 'Email (optional)', { autocomplete: 'email', inputmode: 'email' })}
        </div>
        <div class="fgrid light">
          ${inp('street', 'Street address', { autocomplete: 'street-address' })}
          ${inp('suburb', o.nz ? 'Suburb / town' : 'Suburb', { autocomplete: 'address-level2' })}
          <label class="field"><span>${o.nz ? 'Region' : 'State'}</span><select class="select" style=${o.err.region ? 'border-color:var(--bad)' : ''} value=${sh.region} onChange=${field('region')} onBlur=${blur('region')}><option value="">Choose…</option>${(o.nz ? NZ_REGIONS : STATES).map(r => html`<option value=${r}>${r}</option>`)}</select>${o.err.region ? html`<small>${o.err.region}</small>` : null}</label>
          ${inp('postcode', 'Postcode', { autocomplete: 'postal-code', inputmode: 'numeric' })}
        </div>
        ${o.regionWarn ? html`<div class="warn">${o.regionWarn}</div>` : null}
        ${o.nz ? html`<div class="seg" role="group" aria-label="NZ shipping"><button type="button" aria-pressed=${String(!o.nzExp)} onClick=${() => setSh({ nzShip: 'standard' })}>Standard · $20</button><button type="button" aria-pressed=${String(o.nzExp)} onClick=${() => setSh({ nzShip: 'express' })}>Express · $25</button></div>` : null}
        <label class="field"><span>Delivery notes (optional)</span><textarea class="textarea" value=${sh.notes} onInput=${field('notes')}></textarea></label>
        <div class="stack g8">
          ${o.detailsOk ? html`<a class="btn block" href=${o.orderHref} target="_blank" rel="noopener" onClick=${send}>Send order on WhatsApp</a>`
            : html`<button type="button" class="btn block" disabled>Send order on WhatsApp</button><div class="small" style="color:var(--ink);font-weight:600">Still needed: ${o.missing.join(', ')}</div>`}
          <div class="row g8 wrapx"><a class=${'btn sm outline' + (o.detailsOk ? '' : ' disabled')} href=${o.detailsOk ? o.emailHref : null} aria-disabled=${String(!o.detailsOk)} onClick=${o.detailsOk ? send : null}>Email instead</a><button type="button" class="btn sm outline" onClick=${copy}>${sh.copied ? 'Copied' : 'Copy order'}</button></div>
          <p class="tiny muted">Opens WhatsApp with your order filled in. Nothing is charged here: ${PAYMENT_NOTE} ${REPLY_NOTE}</p>
        </div>
      </div>` : null}

  </div>`;
}

function CartBar({ sh, o }) {
  if (!o.items.length) return null;
  return html`<div class="tray screen" role="region" aria-label="Your order"><span>${o.packCount} pack${o.packCount === 1 ? '' : 's'} · ${money(o.total)} AUD${sh.sent ? ' · sent' : ''}</span>
    ${o.detailsOk && !sh.sent ? html`<a class="btn sm on-dark" href="#/order">Review and send</a>` : html`<a class="btn sm on-dark" href="#/order">View order</a>`}</div>`;
}

function CoaSection({ goal }) {
  const [all, setAll] = useState(false);
  const withCoa = SHOP_PRODUCTS.filter(p => COAS[p.sku]);
  const shown = all ? withCoa : withCoa.slice(0, 8);
  const purities = withCoa.map(p => parseFloat(COAS[p.sku][0]));
  const pending = SHOP_PRODUCTS.filter(p => !COAS[p.sku]).map(p => p.name);
  return html`<div class="wrap page" id="coa">
    <div class="page-head"><h1>Every batch, independently tested.</h1>
      <p class="lead">${withCoa.length} compounds with batch certificates, purity ${Math.min.apply(null, purities).toFixed(2)}–${Math.max.apply(null, purities).toFixed(2)}%. Identity confirmed by HPLC-MS. Tap one to open the PDF.</p></div>
    <div class="coagrid">${shown.map(p => html`<a class="coacard" href=${COA_BASE + COAS[p.sku][2]} target="_blank" rel="noopener"><img src=${GOAL_ICONS[p.goal]} alt="" /><div class="grow"><b>${p.name}</b><div class="tiny muted">Tested ${COAS[p.sku][1]}</div></div><span class="pur">${COAS[p.sku][0]}</span></a>`)}</div>
    <div class="row g8 wrapx" style="margin-top:12px"><button type="button" class="btn sm outline" onClick=${() => setAll(!all)}>${all ? 'Show fewer' : 'Show all ' + withCoa.length + ' certificates'}</button>
      ${pending.length ? html`<a class="btn sm ghost" href=${'https://wa.me/' + WA_NUMBER + '?text=' + encodeURIComponent('Hi, could you please send the latest COA' + (pending.length > 1 ? 's' : '') + ' for ' + pending.join(', ') + '?')} target="_blank" rel="noopener">Request the other ${pending.length} on WhatsApp</a>` : null}</div>
  </div>`;
}
