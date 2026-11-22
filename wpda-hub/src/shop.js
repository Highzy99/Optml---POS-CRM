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
    sub: n > 1 ? money(Math.round(p.prices[n] / n)) + ' / vial' : 'Single vial',
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

function Tiers({ p, sh, bump, compact }) {
  return html`<div class="tiers" style=${'grid-template-columns:repeat(' + TIERS.length + ',minmax(0,1fr))'}>${TIERS.filter(n => p.prices[n]).map(n => {
    const key = p.sku + ':' + n; const t = tierInfo(p, n, sh.cart[key] || 0);
    return t.qty ? html`<div class="tier on" role="group" aria-label=${t.label + ' of ' + p.name + ', ' + t.qty + ' in order'}>
        <span class="tl">${t.label}</span><span class="tp">${t.price}</span>
        <span class="stepper"><button type="button" aria-label=${'Remove one ' + t.label + ' of ' + p.name} onClick=${() => bump(key, -1)}>−</button><b>${t.qty}</b><button type="button" aria-label=${'Add another ' + t.label + ' of ' + p.name} onClick=${() => bump(key, 1)}>+</button></span>
      </div>`
      : html`<button type="button" class="tier" aria-label=${'Add ' + t.label + ' of ' + p.name + ', ' + t.price} onClick=${() => bump(key, 1)}>
        ${t.badge ? html`<span class="badge">${t.badge}</span>` : null}
        <span class="tl">${t.label}</span><span class="tp">${t.price}</span>${t.was ? html`<s class="tw">${t.was}</s>` : null}${compact ? null : html`<span class="ts">${t.sub}</span>`}
      </button>`;
  })}</div>`;
}

function ShopSection({ sh, setSh, bump }) {
  const q = sh.q.trim().toLowerCase();
  const list = SHOP_PRODUCTS.filter(p => (sh.goal === 'all' || p.goal === sh.goal) && (!q || (p.name + ' ' + p.sku + ' ' + (INFO[p.sku] || '')).toLowerCase().includes(q)));
  return html`<section id="shop" aria-labelledby="h-shop" style="padding-top:8px"><div class="wrap">
    <h2 id="h-shop" class="sr">${WHOLESALE ? 'Wholesale price list' : 'Price list'}</h2>
    <label class="field" style="max-width:460px;margin-top:18px"><span class="sr">Search the price list</span><input class="input" type="search" placeholder="Search compounds" value=${sh.q} onInput=${e => setSh({ q: e.target.value })} /></label>
    <div class="sticky-filters">
      <div class="scrollx" role="group" aria-label="Filter by goal">
        <button type="button" class="pill" aria-pressed=${String(sh.goal === 'all')} onClick=${() => setSh({ goal: 'all' })}>All</button>
        ${GOALS.map(g => html`<button type="button" class="pill" aria-pressed=${String(sh.goal === g)} onClick=${() => setSh({ goal: sh.goal === g ? 'all' : g })}><img src=${GOAL_ICONS[g]} alt="" />${GOAL_LABELS[g]}</button>`)}
      </div>
    </div>
    <div class="plist" style="margin-top:14px">
      ${list.map(p => { const [base, strength] = splitName(p.name); const coa = COAS[p.sku];
        return html`<article class="prow" style=${'--tint:' + GOAL_TINT[p.goal]}>
          <a class="ptop" href=${'#/p/' + p.sku} aria-label=${p.name + ': prices, how to use and certificate'}>
            <img src=${GOAL_ICONS[p.goal]} alt="" />
            <div class="grow"><h3>${base} ${strength ? html`<span class="str">${strength}</span>` : null}</h3>
              <div class="tiny muted">${GOAL_LABELS[p.goal]}${coa ? ' · ' + coa[0] + ' purity' : ''}</div></div>
            <span class="how">How to use <${Icon} name="arrow" size=${14} /></span>
          </a>
          <${Tiers} p=${p} sh=${sh} bump=${bump} compact />
        </article>`; })}
    </div>
    ${list.length === 0 ? html`<div class="empty" style="margin-top:12px">Nothing matches that search.</div>` : null}
    <p class="tiny muted" style="margin-top:14px">Prices in AUD${WHOLESALE ? ' · 10-vial rates are wholesale only' : ''}. Bac water included with every vial. Free express shipping in Australia over $200, New Zealand from $20.</p>
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
  const inp = (k, label, extra = {}) => html`<label class="field"><span>${label}</span><input class="input" style=${o.err[k] ? 'border-color:var(--bad)' : ''} value=${sh[k]} onInput=${field(k)} onBlur=${blur(k)} aria-invalid=${o.err[k] ? 'true' : 'false'} ...${extra} />${o.err[k] ? html`<small style="color:var(--bad)">${o.err[k]}</small>` : null}</label>`;
  return html`<div class="wrap page narrow" id="order">
    <div class="orderbox">
      <div class="row g12 wrapx" style="justify-content:space-between"><div><div class="lbl" style="color:rgba(255,255,255,.6)">${WHOLESALE ? 'Wholesale order' : 'Your order'} · ${sh.ref}</div><h2 id="h-order" style="color:#fff;font-size:clamp(26px,5vw,34px);margin-top:4px">${stage === 4 ? 'Order sent' : 'Your order'}</h2></div>
        <ol class="ostep" aria-label="Order progress">${['Build', 'Details', 'Send'].map((l, i) => html`<li class=${i + 1 < stage ? 'done' : i + 1 === stage ? 'now' : ''}><span>${i + 1 < stage ? '✓' : i + 1}</span>${l}</li>`)}</ol></div>

      ${!o.items.length && !sh.sent ? html`<div class="oempty"><p>Tap any price in the list to add a pack. Tap again for more, minus to take one off.</p>
        ${lastItems.length ? html`<button type="button" class="btn on-dark sm" onClick=${() => { const c = {}; lastItems.forEach(it => { c[it.key] = it.qty; }); setSh({ cart: c, sent: false }); }}>Order again: ${lastItems.slice(0, 2).map(it => it.qty + '× ' + it.p.name).join(', ')}${lastItems.length > 2 ? ' + more' : ''}</button>` : html`<a class="btn on-dark sm" href="#/">Browse the price list</a>`}</div>` : null}

      ${o.items.length ? html`<div class="olines">${o.items.map(it => html`<div class="oline"><div class="grow"><b>${it.p.name}</b><div class="tiny" style="color:rgba(255,255,255,.65)">${it.pack}</div></div>
          <span class="stepper dark"><button type="button" aria-label=${'One less ' + it.p.name + ' ' + it.pack} onClick=${() => bump(it.key, -1)}>−</button><b>${it.qty}</b><button type="button" aria-label=${'One more ' + it.p.name + ' ' + it.pack} onClick=${() => bump(it.key, 1)}>+</button></span>
          <b style="width:72px;text-align:right">${money(it.amount)}</b></div>`)}</div>
        ${!o.nz ? html`<div class="shipbar"><div class="tiny">${o.freeShip ? 'Free express shipping unlocked' : 'Add ' + money(o.remaining) + ' more for free express shipping'}</div><div class="bar"><i style=${'width:' + Math.min(100, Math.round(o.afterDiscount / FREE_SHIP_AT * 100)) + '%'}></i></div></div>` : null}
        <div class="otot">
          <div><span>Subtotal (AUD)</span><b>${money(o.subtotal)}</b></div>
          ${o.discount ? html`<div><span>Discount · ${sh.code}</span><b>−${money(o.discount)}</b></div>` : null}
          <div><span>${o.shipName}</span><b>${o.freeShip ? 'Free' : money(o.shipFee)}</b></div>
          <div class="grand"><span>Total</span><b>${money(o.total)} AUD</b></div>
        </div>
        <div>${sh.code ? html`<div class="row g8 wrapx tiny"><span>${o.codeNote}</span><button type="button" class="btn sm on-dark-outline" onClick=${() => setSh({ code: '', codeOpen: false, codeError: '' })}>Remove code</button></div>`
          : sh.codeOpen ? html`<div class="row g8"><label class="grow"><span class="sr">Discount code</span><input class="input" placeholder="Discount code" value=${sh.codeInput} onInput=${e => setSh({ codeInput: e.target.value.toUpperCase(), codeError: '' })} onKeyDown=${e => { if (e.key === 'Enter') { e.preventDefault(); applyCode(); } }} /></label><button type="button" class="btn on-dark sm" onClick=${applyCode}>Apply</button></div>${sh.codeError ? html`<div class="tiny" style="color:#ffb4b0;margin-top:6px">${sh.codeError}</div>` : null}`
          : html`<button type="button" class="linkbtn" onClick=${() => setSh({ codeOpen: true, codeError: '' })}>Have a discount code?</button>`}</div>
      ` : null}

      ${o.items.length && !sh.sent ? html`<div class="odetails">
        <div class="row g12 wrapx" style="justify-content:space-between"><h3 style="color:#fff;font-size:20px">Your details</h3>
          <div class="seg dark" role="group" aria-label="Shipping country"><button type="button" aria-pressed=${String(!o.nz)} onClick=${() => setSh(p => p.country === 'NZ' ? { country: 'AU', region: '' } : {})}>Australia</button><button type="button" aria-pressed=${String(o.nz)} onClick=${() => setSh(p => p.country !== 'NZ' ? { country: 'NZ', region: '' } : {})}>New Zealand</button></div></div>
        <div class="fgrid light">
          ${inp('name', 'Full name', { autocomplete: 'name' })}
          ${inp('phone', 'Mobile', { autocomplete: 'tel', inputmode: 'tel' })}
          ${inp('email', 'Email (optional)', { autocomplete: 'email', inputmode: 'email' })}
        </div>
        <div class="fgrid light">
          ${inp('street', 'Street address', { autocomplete: 'street-address' })}
          ${inp('suburb', o.nz ? 'Suburb / town' : 'Suburb', { autocomplete: 'address-level2' })}
          <label class="field"><span>${o.nz ? 'Region' : 'State'}</span><select class="select" style=${o.err.region ? 'border-color:var(--bad)' : ''} value=${sh.region} onChange=${field('region')} onBlur=${blur('region')}><option value="">Choose…</option>${(o.nz ? NZ_REGIONS : STATES).map(r => html`<option value=${r}>${r}</option>`)}</select>${o.err.region ? html`<small style="color:var(--bad)">${o.err.region}</small>` : null}</label>
          ${inp('postcode', 'Postcode', { autocomplete: 'postal-code', inputmode: 'numeric' })}
        </div>
        ${o.regionWarn ? html`<div class="warn">${o.regionWarn}</div>` : null}
        ${o.nz ? html`<div class="seg dark" role="group" aria-label="NZ shipping"><button type="button" aria-pressed=${String(!o.nzExp)} onClick=${() => setSh({ nzShip: 'standard' })}>Standard · $20</button><button type="button" aria-pressed=${String(o.nzExp)} onClick=${() => setSh({ nzShip: 'express' })}>Express · $25</button></div>` : null}
        <label class="field"><span>Delivery notes (optional)</span><textarea class="textarea" value=${sh.notes} onInput=${field('notes')}></textarea></label>
        <div class="stack g8">
          ${o.detailsOk ? html`<a class="btn on-dark block" style="min-height:52px;font-size:16px" href=${o.orderHref} target="_blank" rel="noopener" onClick=${send}>Send order on WhatsApp</a>`
            : html`<button type="button" class="btn on-dark block" style="min-height:52px;font-size:16px" disabled>Send order on WhatsApp</button><div class="tiny" style="color:rgba(255,255,255,.75)">Still needed: ${o.missing.join(', ')}</div>`}
          <div class="row g8 wrapx"><a class=${'btn sm on-dark-outline' + (o.detailsOk ? '' : ' disabled')} href=${o.detailsOk ? o.emailHref : null} aria-disabled=${String(!o.detailsOk)} onClick=${o.detailsOk ? send : null}>Email instead</a><button type="button" class="btn sm on-dark-outline" onClick=${copy}>${sh.copied ? 'Copied' : 'Copy order'}</button></div>
          <p class="tiny" style="color:rgba(255,255,255,.7)">Opens WhatsApp with your order filled in. Nothing is charged here: ${PAYMENT_NOTE} ${REPLY_NOTE}</p>
        </div>
      </div>` : null}

      ${sh.sent && o.items.length ? html`<div class="osent">
        <p>Your order is in WhatsApp. We confirm stock and send payment details by reply. ${REPLY_NOTE}</p>
        <div class="row g8 wrapx"><a class="btn sm on-dark-outline" href=${o.orderHref} target="_blank" rel="noopener">Didn't open? Resend on WhatsApp</a>
          <button type="button" class="btn sm on-dark-outline" onClick=${() => setSh({ cart: {}, sent: false, code: '', codeInput: '', ref: makeRef() })}>Start a new order</button></div>
        ${planReady ? html`<div class="guidecard"><div class="lbl">Your how-to guide is ready</div><b style="font-size:19px;color:var(--ink)">Everything you ordered, step by step</b>
          <p class="small">Exact units to draw for each compound, how to mix it with the bac water in the box, where to inject, and a daily tracker. Save it as a PDF to keep.</p>
          <div class="row g8 wrapx"><a class="btn sm" href="#/plan">Open my tracker</a><button type="button" class="btn sm outline" onClick=${() => window.print()}>Save my guide as PDF</button></div></div>` : null}
      </div>` : null}
    </div>
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
    <div class="page-head"><div class="eyebrow">Certificates of analysis</div><h1>Every batch, independently tested.</h1>
      <p class="lead">${withCoa.length} compounds with batch certificates, purity ${Math.min.apply(null, purities).toFixed(2)}–${Math.max.apply(null, purities).toFixed(2)}%. Identity confirmed by HPLC-MS. Tap one to open the PDF.</p></div>
    <div class="coagrid">${shown.map(p => html`<a class="coacard" href=${COA_BASE + COAS[p.sku][2]} target="_blank" rel="noopener"><img src=${GOAL_ICONS[p.goal]} alt="" /><div class="grow"><b>${p.name}</b><div class="tiny muted">Tested ${COAS[p.sku][1]}</div></div><span class="pur">${COAS[p.sku][0]}</span></a>`)}</div>
    <div class="row g8 wrapx" style="margin-top:12px"><button type="button" class="btn sm outline" onClick=${() => setAll(!all)}>${all ? 'Show fewer' : 'Show all ' + withCoa.length + ' certificates'}</button>
      ${pending.length ? html`<a class="btn sm ghost" href=${'https://wa.me/' + WA_NUMBER + '?text=' + encodeURIComponent('Hi, could you please send the latest COA' + (pending.length > 1 ? 's' : '') + ' for ' + pending.join(', ') + '?')} target="_blank" rel="noopener">Request: ${pending.join(', ')}</a>` : null}</div>
  </div>`;
}
