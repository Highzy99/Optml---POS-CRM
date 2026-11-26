// ================= Shop: price list, order, certificates =================

const WHOLESALE = /^\/wholesale/i.test(location.pathname) || /[?&]wholesale\b/i.test(location.search);
const TIERS = WHOLESALE ? [1, 3, 5, 10] : [1, 3, 5];
const WA_NUMBER = '61468315677';
const ORDER_EMAIL = 'hello@stayoptml.com';
const PAYMENT_NOTE = 'Pay by PayID once we confirm your order. Details come by reply.';
const PAYID = '0408769377';
// Orders go straight into the OPTML POS (Supabase function submit_web_order):
//   stage "started" = the customer has typed a name and mobile at checkout but hasn't confirmed yet (saved quietly as they go,
//                     so a checkout that's abandoned still leaves us their details and cart);
//   stage "placed"  = they pressed Confirm your order (pending payment).
// WhatsApp still carries the whole order at the end, so a failed call never blocks the customer.
const POS_RPC = 'https://suhxeslmyugjedjqwgtz.supabase.co/rest/v1/rpc/submit_web_order';
const POS_KEY = 'sb_publishable_qnqBl5G9ybuh_9n9YpXSPw_kptUSiZi';
function posPayload(sh, o, stage) {
  return { ref: sh.ref, stage: stage || 'placed', wholesale: WHOLESALE, country: o.nz ? 'NZ' : 'AU', nz_ship: sh.nzShip,
    items: o.items.map(it => ({ sku: it.p.sku, name: it.p.name, pack: it.n, qty: it.qty, amount: it.amount })),
    subtotal: o.subtotal, code: o.codeActive ? sh.code : '', discount: o.discount, shipping: o.shipping, total: o.total,
    name: sh.name.trim(), phone: sh.phone.trim(), email: sh.email.trim(), street: sh.street.trim(), suburb: sh.suburb.trim(),
    region: sh.region, postcode: sh.postcode.trim(), notes: sh.notes.trim(), message: o.waText };
}
function postToPos(p, keepalive) {
  try {
    return fetch(POS_RPC, { method: 'POST', keepalive: !!keepalive, headers: { 'Content-Type': 'application/json', apikey: POS_KEY, Authorization: 'Bearer ' + POS_KEY }, body: JSON.stringify({ p }) })
      .then(r => r.ok ? r.json() : null).catch(() => null);
  } catch (e) { return Promise.resolve(null); }
}
const REPLY_NOTE = 'We reply within 30 minutes, 8am–8pm AEST.';
const SHOP_KEY = 'optml-shop-' + (WHOLESALE ? 'wholesale' : 'retail') + '-v1';
const SHOP_SAVED = ['cart', 'name', 'phone', 'email', 'street', 'suburb', 'region', 'postcode', 'notes', 'code', 'ref', 'sent', 'country', 'nzShip', 'lastOrder', 'placed', 'proof', 'done'];
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
  // a finished order clears after 12 hours, an unpaid placed one after 3 days, so the next visit starts a fresh order
  const age = sh.lastOrder && sh.lastOrder.at ? Date.now() - sh.lastOrder.at : 0;
  if ((sh.done && age > 12 * 3600e3) || (sh.placed && !sh.done && age > 72 * 3600e3) || (sh.sent && !sh.placed && age > 12 * 3600e3))
    Object.assign(sh, { cart: {}, sent: false, code: '', ref: makeRef(), placed: null, proof: null, done: false });
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
      <span class="psub">${coa ? html`<a class="pur-btn" href=${COA_BASE + coa[2]} target="_blank" rel="noopener" aria-label=${coa[0] + ' pure. Open the certificate of analysis for ' + p.name}><i class="okdot"></i>${coa[0]} pure<${Icon} name="ext" size=${12} /></a>` : 'Research peptide'}</span>
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
        <div class="grow"><h2>${g.base}${g.items.length === 1 && cur.strength ? ' ' + cur.strength : ''}</h2><div class="psub">${coa ? html`<a class="pur-btn" href=${COA_BASE + coa[2]} target="_blank" rel="noopener" aria-label=${coa[0] + ' pure. Open the certificate of analysis'}><i class="okdot"></i>${coa[0]} pure<${Icon} name="ext" size=${12} /></a>` : GOAL_LABELS[g.goal]}</div></div>
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

function copyPay(v, k, setSh) {
  const done = () => { setSh({ copiedPay: k }); setTimeout(() => setSh({ copiedPay: '' }), 1800); };
  try { if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(v).then(done, done); else done(); } catch (e) { done(); }
}
const fmtPayId = v => String(v).replace(/^(\d{4})(\d{3})(\d{3})$/, '$1 $2 $3');
// a finished order (sent to WhatsApp) means the next thing added starts a fresh order with a new reference
function freshOrder(s) { return s.done ? { ref: makeRef(), placed: null, proof: null, done: false, code: '', codeInput: '' } : {}; }
// phone screenshots are shrunk to a JPEG (~200 KB) before upload
function shrinkImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file); const img = new Image();
    img.onload = () => {
      const k = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight)); const w = Math.round(img.naturalWidth * k), h = Math.round(img.naturalHeight * k);
      const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); g.drawImage(img, 0, 0, w, h); URL.revokeObjectURL(url);
      let q = 0.82, d = c.toDataURL('image/jpeg', q); while (d.length > 2400000 && q > 0.35) { q -= 0.15; d = c.toDataURL('image/jpeg', q); } resolve(d);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("We couldn't read that file. Upload a screenshot or photo (PNG or JPG).")); };
    img.src = url;
  });
}
function uploadProof(id, token, image) {
  return fetch(POS_RPC.replace('submit_web_order', 'attach_payment_proof'), { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: POS_KEY, Authorization: 'Bearer ' + POS_KEY }, body: JSON.stringify({ p_id: id, p_token: token, p_image: image }) })
    .then(r => r.ok ? r.json() : null).then(j => !!(j && j.ok)).catch(() => false);
}

// Order flow: #/order cart → #/checkout summary + details → Confirm your order (saved in the POS as pending payment) → #/pay PayID, screenshot, WhatsApp
function OrderSteps({ step }) {
  return html`<ol class="ostep" aria-label="Order progress">${['Cart', 'Checkout', 'Pay'].map((l, i) => html`<li class=${i + 1 < step ? 'done' : i + 1 === step ? 'now' : ''}><span>${i + 1 < step ? '✓' : i + 1}</span>${l}</li>`)}</ol>`;
}
function OrderHead({ refNo, step, title }) {
  return html`<div class="row g12 wrapx" style="justify-content:space-between;align-items:flex-end"><div><div class="ref">${WHOLESALE ? 'Wholesale order ' : 'Order '}${refNo}</div><h2 id="h-order" style="margin-top:6px">${title}</h2></div><${OrderSteps} step=${step} /></div>`;
}
function OrderTotals({ o, sh }) {
  return html`<div class="otot">
    <div><span>Subtotal (AUD)</span><b>${money(o.subtotal)}</b></div>
    ${o.discount ? html`<div><span>Discount · ${sh.code}</span><b>−${money(o.discount)}</b></div>` : null}
    <div><span>${o.shipName}</span><b>${o.freeShip ? 'Free' : money(o.shipFee)}</b></div>
    <div class="grand"><span>Total</span><b>${money(o.total)} AUD</b></div></div>`;
}
const emptyCart = (sh, setSh, lastItems) => html`<div class="oempty"><p>Tap any price in the list to add a pack. Tap again for more, minus to take one off.</p>
  ${lastItems.length ? html`<button type="button" class="btn on-dark sm" onClick=${() => { const c = {}; lastItems.forEach(it => { c[it.key] = it.qty; }); setSh(s => Object.assign(freshOrder(s), { cart: c, sent: false })); }}>Order again: ${lastItems.slice(0, 2).map(it => it.qty + '× ' + it.p.name).join(', ')}${lastItems.length > 2 ? ' + more' : ''}</button>` : html`<a class="btn on-dark sm" href="#/">Browse the price list</a>`}</div>`;

// 1 · Cart
function OrderSection({ sh, setSh, bump, o, planReady }) {
  const applyCode = () => { const c = sh.codeInput.trim().toUpperCase(); if (!c) return; const codes = parseCodes(DEFAULT_CODES); if (codes[c]) setSh({ code: c, codeError: '', codeOpen: false, codeInput: '' }); else setSh({ codeError: "That code isn't valid. Check the spelling and try again." }); };
  const lastItems = sh.lastOrder && sh.lastOrder.cart ? Object.keys(sh.lastOrder.cart).map(k => { const b = k.split(':'); const p = SHOP_BY_SKU[b[0]]; const n = parseInt(b[1], 10); return p && p.prices[n] ? { key: k, qty: sh.lastOrder.cart[k], p, n } : null; }).filter(Boolean) : [];
  const waiting = sh.placed && !sh.done;
  return html`<div class="wrap page narrow" id="order">
    <div class="orderbox">
      <${OrderHead} refNo=${sh.ref} step=${1} title="Your cart" />
      ${waiting ? html`<a class="planlink" href="#/pay"><${Icon} name="bag" size=${18} /><span>Order ${sh.placed.ref} is placed and waiting for payment. <b>Go to payment</b></span><${Icon} name="chev" size=${16} /></a>` : null}
      ${sh.done && !o.items.length ? html`<a class="planlink" href="#/pay"><${Icon} name="check" size=${18} /><span>Order ${sh.placed ? sh.placed.ref : ''} is with us. We'll confirm on WhatsApp.</span><${Icon} name="chev" size=${16} /></a>` : null}
      ${!o.items.length ? emptyCart(sh, setSh, lastItems) : html`
        <div class="olines">${o.items.map(it => html`<div class="oline"><b class="on">${it.p.name}</b><b class="op">${money(it.amount)}</b><span class="ok">${it.pack}</span>
          <span class="stepper dark"><button type="button" aria-label=${'One less ' + it.p.name + ' ' + it.pack} onClick=${() => bump(it.key, -1)}>−</button><b>${it.qty}</b><button type="button" aria-label=${'One more ' + it.p.name + ' ' + it.pack} onClick=${() => bump(it.key, 1)}>+</button></span>
          ${it.key.split(':')[1] === '1' ? html`<${PackNudge} p=${it.p} sh=${sh} bump=${bump} dark />` : null}</div>`)}</div>
        ${!o.nz ? html`<div class="shipbar"><div class="tiny">${o.freeShip ? 'Free express shipping unlocked' : 'Add ' + money(o.remaining) + ' more for free express shipping'}</div><div class="bar"><i style=${'width:' + Math.min(100, Math.round(o.afterDiscount / FREE_SHIP_AT * 100)) + '%'}></i></div></div>` : null}
        <${OrderTotals} o=${o} sh=${sh} />
        <div>${sh.code ? html`<div class="row g8 wrapx tiny"><span>${o.codeNote}</span><button type="button" class="btn sm on-dark-outline" onClick=${() => setSh({ code: '', codeOpen: false, codeError: '' })}>Remove code</button></div>`
          : sh.codeOpen ? html`<div class="row g8"><label class="grow"><span class="sr">Discount code</span><input class="input" placeholder="Discount code" value=${sh.codeInput} onInput=${e => setSh({ codeInput: e.target.value.toUpperCase(), codeError: '' })} onKeyDown=${e => { if (e.key === 'Enter') { e.preventDefault(); applyCode(); } }} /></label><button type="button" class="btn on-dark sm" onClick=${applyCode}>Apply</button></div>${sh.codeError ? html`<div class="tiny" style="color:#fff;font-weight:600;margin-top:6px">${sh.codeError}</div>` : null}`
          : html`<button type="button" class="linkbtn" onClick=${() => setSh({ codeOpen: true, codeError: '' })}>Have a discount code?</button>`}</div>
        <a class="btn on-dark block" href="#/checkout">${waiting ? 'Update order and checkout' : 'Checkout'} · ${money(o.total)} AUD</a>
        ${planReady ? html`<a class="planlink" href="#/plan"><${Icon} name="plan" size=${18} /><span>The guide for these is ready in <b>My plan</b></span><${Icon} name="chev" size=${16} /></a>` : null}`}
    </div>
  </div>`;
}

// 2 · Checkout: order summary + details → Confirm your order
function CheckoutPage({ sh, setSh, o, onSent }) {
  const field = k => e => { const v = e.target.value; setSh(prev => { const next = { [k]: v }; if (k === 'postcode' && prev.country !== 'NZ' && /^\d{4}$/.test(v) && !prev.region) { const s = stateFromPostcode(v); if (s) next.region = s; } return next; }); };
  const blur = k => () => setSh(prev => ({ touched: Object.assign({}, prev.touched, { [k]: true }) }));
  const inp = (k, label, extra = {}) => html`<label class="field"><span>${label}</span><input class="input" id=${'f-' + k} style=${o.err[k] ? 'border-color:var(--bad)' : ''} value=${sh[k]} onInput=${field(k)} onBlur=${blur(k)} aria-invalid=${o.err[k] ? 'true' : 'false'} ...${extra} />${o.err[k] ? html`<small>${o.err[k]}</small>` : null}</label>`;
  // Save the checkout to the POS as "started" once there's a name and a mobile, and again whenever it changes, so an
  // order that never gets confirmed still reaches us. Sent a moment after typing stops, and when the page is left.
  const draftSig = o.items.length && o.ok.name && o.ok.phone && !sh.placed ? JSON.stringify([sh.ref, o.items.map(it => [it.key, it.qty]), sh.name.trim(), sh.phone.trim(), sh.email.trim(), sh.street.trim(), sh.suburb.trim(), sh.region, sh.postcode.trim(), sh.notes.trim(), sh.country, sh.nzShip, o.codeActive ? sh.code : '']) : '';
  const live = useRef(null); live.current = { sh, o, sig: draftSig };
  const draft = useRef({ sent: '', stop: false });
  const saveDraft = keep => { const c = live.current, d = draft.current; if (!c.sig || d.stop || c.sig === d.sent) return; d.sent = c.sig; postToPos(posPayload(c.sh, c.o, 'started'), keep); };
  useEffect(() => { if (!draftSig) return; const t = setTimeout(() => saveDraft(false), 1500); return () => clearTimeout(t); }, [draftSig]);
  useEffect(() => {
    const leave = () => saveDraft(true);
    const vis = () => { if (document.visibilityState === 'hidden') leave(); };
    window.addEventListener('pagehide', leave); document.addEventListener('visibilitychange', vis);
    return () => { window.removeEventListener('pagehide', leave); document.removeEventListener('visibilitychange', vis); leave(); };
  }, []);
  if (!o.items.length) return html`<div class="wrap page narrow" id="order"><div class="orderbox"><${OrderHead} refNo=${sh.ref} step=${2} title="Checkout" /><div class="oempty"><p>Your cart is empty.</p><a class="btn on-dark sm" href="#/">Browse the price list</a></div></div></div>`;
  const place = async () => {
    if (sh.busy) return;
    if (!o.detailsOk) {
      setSh({ touched: { name: true, phone: true, email: true, street: true, suburb: true, region: true, postcode: true } });
      // take them to the first thing that's missing instead of leaving them at the button
      const first = ['name', 'phone', 'email', 'street', 'suburb', 'region', 'postcode'].find(k => !o.ok[k]);
      const el = first && document.getElementById('f-' + first);
      if (el) { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); try { el.focus({ preventScroll: true }); } catch (e) {} }
      return;
    }
    draft.current.stop = true;
    setSh({ busy: true, placeError: '' });
    const payload = posPayload(sh, o, 'placed');
    const r = await postToPos(payload);
    if (r && !r.ok && r.error === 'details') { draft.current.stop = false; setSh({ busy: false, placeError: 'Check your name and mobile number, then try again.' }); return; }
    // saved in the POS → pay page. If we couldn't reach it, carry on anyway: the pay page keeps retrying in the background
    // and the WhatsApp message at the end carries the whole order.
    setSh({ busy: false, placed: { id: r && r.ok ? r.id : '', token: r && r.ok ? (r.token || '') : '', ref: sh.ref, total: o.total, payid: (r && r.payid) || PAYID, at: Date.now(), text: o.waText, offline: !(r && r.ok), payload: r ? null : payload }, proof: null, done: false, upState: '', upError: '', upPreview: '' });
    onSent(o.items); location.hash = '#/pay';
  };
  return html`<div class="wrap page narrow" id="order">
    <div class="orderbox">
      <${OrderHead} refNo=${sh.ref} step=${2} title="Checkout" />
      <div class="olines">${o.items.map(it => html`<div class="oline"><b class="on">${it.qty}× ${it.p.name}</b><b class="op">${money(it.amount)}</b><span class="ok">${it.pack}</span></div>`)}</div>
      <${OrderTotals} o=${o} sh=${sh} />
      <a class="linkbtn" href="#/order">Edit cart</a>
    </div>
    <div class="odetails">
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
        <div class="fpair"><label class="field"><span>${o.nz ? 'Region' : 'State'}</span><select class="select" id="f-region" style=${o.err.region ? 'border-color:var(--bad)' : ''} value=${sh.region} onChange=${field('region')} onBlur=${blur('region')}><option value="">Choose…</option>${(o.nz ? NZ_REGIONS : STATES).map(r => html`<option value=${r}>${r}</option>`)}</select>${o.err.region ? html`<small>${o.err.region}</small>` : null}</label>
        ${inp('postcode', 'Postcode', { autocomplete: 'postal-code', inputmode: 'numeric' })}</div>
      </div>
      ${o.regionWarn ? html`<div class="warn">${o.regionWarn}</div>` : null}
      ${o.nz ? html`<div class="seg" role="group" aria-label="NZ shipping"><button type="button" aria-pressed=${String(!o.nzExp)} onClick=${() => setSh({ nzShip: 'standard' })}>Standard · $20</button><button type="button" aria-pressed=${String(o.nzExp)} onClick=${() => setSh({ nzShip: 'express' })}>Express · $25</button></div>` : null}
      <label class="field"><span>Delivery notes (optional)</span><textarea class="textarea" value=${sh.notes} onInput=${field('notes')}></textarea></label>
      <div class="stack g8">
        <button type="button" class="btn block" disabled=${!!sh.busy} onClick=${place}>${sh.busy ? 'Placing your order…' : 'Confirm your order · ' + money(o.total) + ' AUD'}</button>
        ${!o.detailsOk ? html`<div class="small" style="color:var(--ink);font-weight:600">Still needed: ${o.missing.join(', ')}</div>` : null}
        ${sh.placeError ? html`<div class="warn">${sh.placeError}</div>` : null}
        <p class="tiny muted">Next you'll see our PayID details. Nothing is charged on this site. Your details are saved as you fill them in, so we can help finish your order if you get stuck.</p>
      </div>
    </div>
  </div>`;
}

// 3 · Pay: PayID details → payment screenshot → WhatsApp
function PayPage({ sh, setSh, hasPlan }) {
  const pl = sh.placed;
  // The POS couldn't be reached at Confirm: keep trying while this page is open (and as soon as the phone is back online).
  useEffect(() => {
    if (!pl || !pl.offline || !pl.payload) return;
    let dead = false, n = 0, t = null;
    const attempt = async () => {
      if (dead) return;
      const r = await postToPos(pl.payload);
      if (dead) return;
      if (r && r.ok) { setSh(s => s.placed && s.placed.ref === pl.ref ? { placed: Object.assign({}, s.placed, { id: r.id, token: r.token || '', payid: r.payid || s.placed.payid, offline: false, payload: null }) } : {}); return; }
      if (r) { setSh(s => s.placed && s.placed.ref === pl.ref ? { placed: Object.assign({}, s.placed, { payload: null }) } : {}); return; }   // turned down, trying again won't help
      if (++n < 7) t = setTimeout(attempt, Math.min(60000, 4000 * Math.pow(2, n)));
    };
    t = setTimeout(attempt, 3000);
    const online = () => { clearTimeout(t); attempt(); };
    window.addEventListener('online', online);
    return () => { dead = true; clearTimeout(t); window.removeEventListener('online', online); };
  }, [pl && pl.ref, pl && pl.offline]);
  // …and once it's saved, upload the screenshot they'd already chosen.
  useEffect(() => {
    if (!pl || !pl.token || sh.upState !== 'local' || !sh.upPreview) return;
    setSh({ upState: 'busy' });
    uploadProof(pl.id, pl.token, sh.upPreview).then(ok => setSh(ok ? { upState: 'done', proof: { at: Date.now() } } : { upState: 'local' }));
  }, [pl && pl.token]);
  if (!pl) return html`<div class="wrap page narrow" id="order"><div class="orderbox"><${OrderHead} refNo=${sh.ref} step=${3} title="Payment" /><div class="oempty"><p>There's no order waiting for payment.</p><a class="btn on-dark sm" href="#/order">Go to your cart</a></div></div></div>`;
  const payid = pl.payid || PAYID; const proof = !!sh.proof;
  const pick = async e => {
    const f = e.target.files && e.target.files[0]; e.target.value = ''; if (!f) return;
    setSh({ upState: 'busy', upError: '' });
    try {
      const data = await shrinkImage(f); setSh({ upPreview: data });
      if (!pl.token) { setSh({ upState: 'local', proof: null }); return; }
      const ok = await uploadProof(pl.id, pl.token, data);
      setSh(ok ? { upState: 'done', proof: { at: Date.now() } } : { upState: 'error', upError: "The upload didn't go through. Try again, or send the screenshot in WhatsApp." });
    } catch (err) { setSh({ upState: 'error', upError: err.message || "We couldn't read that file." }); }
  };
  const body = String(pl.text || '').replace('PayID — details sent on confirmation\nStatus: awaiting confirmation', proof ? 'PayID — paid, screenshot uploaded ✅' : 'PayID — paying now');
  const waText = (proof ? 'Hi! I\'ve paid for order ' + pl.ref + ' (' + money(pl.total) + ' AUD) and uploaded the payment screenshot ✅' : sh.upState === 'local' ? 'Hi! I\'ve paid for order ' + pl.ref + ' (' + money(pl.total) + ' AUD). Sending the screenshot here 📎' : 'Hi! Here\'s my order ' + pl.ref + ' (' + money(pl.total) + ' AUD).') + '\n\n' + body;
  const waHref = 'https://wa.me/' + WA_NUMBER + '?text=' + encodeURIComponent(waText);
  const finish = () => { setSh({ done: true, cart: {}, code: '', codeInput: '', sent: true }); setTimeout(() => window.scrollTo({ top: 0, behavior: 'instant' }), 60); };
  if (sh.done) return html`<div class="wrap page narrow" id="order"><div class="orderbox">
      <${OrderHead} refNo=${pl.ref} step=${4} title="All done" />
      <div class="osent"><p>${proof ? "We've got your order and payment screenshot. We'll check the payment, confirm on WhatsApp and send it out." : "We've got your order. Once your payment lands we'll confirm on WhatsApp and send it out."} ${REPLY_NOTE}</p>
        <div class="row g8 wrapx"><a class="btn sm on-dark-outline" href=${waHref} target="_blank" rel="noopener">Open WhatsApp again</a><button type="button" class="btn sm on-dark-outline" onClick=${() => { setSh({ cart: {}, sent: false, code: '', codeInput: '', ref: makeRef(), placed: null, proof: null, done: false, upState: '', upPreview: '' }); location.hash = '#/'; }}>Start a new order</button></div>
        ${hasPlan ? html`<div class="guidecard"><b style="font-size:20px;letter-spacing:-.02em;color:var(--ink)">Your guide is ready</b><p class="small">Exact units to draw for each compound, how to mix it with the bac water in the box, where to inject, and a daily tracker.</p><div class="row g8 wrapx"><a class="btn sm" href="#/plan">Open my tracker</a></div></div>` : null}
      </div></div></div>`;
  return html`<div class="wrap page narrow" id="order">
    <div class="orderbox">
      <${OrderHead} refNo=${pl.ref} step=${3} title="Pay by PayID" />
      <p class="paylead">Your order is placed ✓ Pay <b>${money(pl.total)} AUD</b> by PayID, add your payment screenshot, then send it to us on WhatsApp.</p>
      <div class="paybox" aria-label="Payment details">
        <div class="lbl">1 · Pay by PayID</div>
        <div class="payrow"><span>PayID</span><b>${fmtPayId(payid)}</b><button type="button" class="btn sm on-dark-outline" onClick=${() => copyPay(payid, 'PayID', setSh)}>${sh.copiedPay === 'PayID' ? 'Copied' : 'Copy'}</button></div>
        <div class="payrow"><span>Reference</span><b>${pl.ref}</b><button type="button" class="btn sm on-dark-outline" onClick=${() => copyPay(pl.ref, 'ref', setSh)}>${sh.copiedPay === 'ref' ? 'Copied' : 'Copy'}</button></div>
        <div class="payrow"><span>Amount</span><b>${money(pl.total)} AUD</b><button type="button" class="btn sm on-dark-outline" onClick=${() => copyPay(String(Math.round(pl.total)), 'amt', setSh)}>${sh.copiedPay === 'amt' ? 'Copied' : 'Copy'}</button></div>
        <p class="tiny">Put the reference in the payment description so we can match it.</p>
      </div>
      <div class="paybox">
        <div class="lbl">2 · Add your payment screenshot</div>
        ${sh.upPreview ? html`<img class="upthumb" src=${sh.upPreview} alt="Your payment screenshot" />` : null}
        <label class=${'btn block ' + (proof ? 'on-dark-outline' : 'on-dark') + (sh.upState === 'busy' ? ' disabled' : '')}>${sh.upState === 'busy' ? 'Uploading…' : proof || sh.upPreview ? 'Choose a different screenshot' : 'Choose screenshot'}<input type="file" accept="image/*" onChange=${pick} style="display:none" disabled=${sh.upState === 'busy'} /></label>
        ${proof ? html`<div class="tiny" style="font-weight:700">✓ Screenshot received</div>` : null}
        ${sh.upState === 'local' ? html`<div class="tiny">We couldn't save it here. Send this screenshot in WhatsApp after it opens.</div>` : null}
        ${sh.upError ? html`<div class="tiny" style="font-weight:700">${sh.upError}</div>` : null}
      </div>
      <div class="stack g8">
        <div class="lbl" style="font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:rgba(255,255,255,.8)">3 · Send it to us</div>
        <a class=${'btn block ' + (proof || sh.upState === 'local' ? 'on-dark' : 'on-dark-outline')} href=${waHref} target="_blank" rel="noopener" onClick=${finish}>Send to WhatsApp</a>
        ${!proof && sh.upState !== 'local' ? html`<p class="tiny" style="color:rgba(255,255,255,.85)">Add your screenshot first so we can match the payment quickly. Paying later? You can still send the order now.</p>` : null}
      </div>
    </div>
  </div>`;
}

function CartBar({ sh, o }) {
  if (!o.items.length) return null;
  const waiting = sh.placed && !sh.done;
  return html`<div class="tray screen" role="region" aria-label="Your order"><span>${o.packCount} pack${o.packCount === 1 ? '' : 's'} · ${money(o.total)} AUD</span>
    ${waiting ? html`<a class="btn sm on-dark" href="#/pay">Go to payment</a>` : html`<a class="btn sm on-dark" href="#/checkout">Checkout</a>`}</div>`;
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
