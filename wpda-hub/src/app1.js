// ================= App: shared helpers, state, catalogue, compound sheet =================
const { html, render, useState, useEffect, useRef } = htmPreact;

const STORE_KEY = 'wpda-hub-v1';
const LOG_KEY = 'wpda-log-v1';
const SHOP_URL = 'https://stayoptml.com/shop/';
const CONTACT = 'hello@stayoptml.com';
const DISCLAIMER = 'Reference material for research use. Nothing here is medical advice or a prescription. Protocols should be reviewed with a qualified healthcare professional before anything is administered.';
const PRODUCT = Object.fromEntries(PRODUCTS.map(p => [p.id, p]));
const STACK = STACKS[0];

const today0 = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
const isoDay = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const parseDay = s => { if (!s) return null; const [y, m, d] = s.split('-').map(Number); if (!y) return null; return new Date(y, m - 1, d); };
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const daysBetween = (a, b) => Math.round((b - a) / 86400000);
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const fmtDay = d => DOW[d.getDay()] + ' ' + d.getDate() + ' ' + d.toLocaleDateString('en-AU', { month: 'short' });
const fmtLong = d => d.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const initials = s => { const w = String(s || '').trim().split(/\s+/).filter(x => /^[A-Za-z]/.test(x)); if (!w.length) return '?'; return (w.length > 1 ? w[0][0] + w[1][0] : w[0].slice(0, 2)).replace(/^./, c => c.toUpperCase()); };
const unitsOf = draw => { const m = String(draw).match(/^([\d.]+)/); return m && /units?/.test(draw) ? parseFloat(m[1]) : null; };
const shortDraw = draw => { const u = unitsOf(draw); if (u === null) return String(draw).replace(/ capsules?/, ' cap').replace(' daily', ''); const m = String(draw).match(/^([\d.]+(?:[–-][\d.]+)?)/); return (m ? m[1] : u) + 'u'; };

function blankCustom(id) {
  return { id, name: '', unit: 'mg', vial: '10', water: '2', when: 'any', site: SITES[0], steps: [{ weeks: '4', weekly: '', freq: '1' }] };
}

function defaultState() {
  return {
    query: '', goal: 'all', sheet: null, sizeIdx: {}, bac: {}, chapter: 0, site: 'abdomen', view: 'front',
    calc: { strength: '10', water: '2', dose: '0.25' },
    order: [], customs: {}, own: {}, mode: {}, nextId: 1,
    client: '', by: '', start: '', notes: '', inotes: {}, openItem: null, preview: false, shared: false, planId: ''
  };
}

const PERSIST = ['sizeIdx', 'bac', 'order', 'customs', 'own', 'mode', 'nextId', 'client', 'by', 'start', 'notes', 'inotes', 'planId', 'cartAdded'];

function planPayload(st) {
  return {
    v: 2, id: st.planId, n: st.client, b: st.by, d: st.start, t: st.notes, o: st.inotes,
    i: st.order.map(k => st.customs[k] ? ['c', st.customs[k]] : [k, st.sizeIdx[k] || 0, st.bac[k] || 2, st.mode[k] === 'own' ? st.own[k] : 0])
  };
}

function stateFromPayload(p) {
  const s = { order: [], customs: {}, own: {}, mode: {}, sizeIdx: {}, bac: {}, client: p.n || '', by: p.b || '', start: p.d || '', notes: p.t || '', inotes: p.o || {}, planId: p.id || '' };
  let next = 1;
  (p.i || []).forEach(e => {
    if (e[0] === 'c' && e[1]) { const m = e[1]; s.customs[m.id] = m; s.order.push(m.id); next = Math.max(next, (parseInt(String(m.id).slice(1), 10) || 0) + 1); return; }
    const [id, idx, bac, own] = e;
    if (!PRODUCT[id]) return;
    s.order.push(id); s.sizeIdx[id] = idx || 0; s.bac[id] = bac || 2;
    if (own) { s.own[id] = own; s.mode[id] = 'own'; }
  });
  s.nextId = next;
  return s;
}

function legacyFromHash(h) {
  const params = new URLSearchParams(h);
  const p = params.get('p');
  if (!p) return null;
  const s = { order: [], sizeIdx: {}, bac: {}, client: params.get('n') || '' };
  p.split(',').forEach(tok => {
    const b = tok.split(':');
    if (!PRODUCT[b[0]]) return;
    s.order.push(b[0]);
    if (b[1]) s.sizeIdx[b[0]] = parseInt(b[1], 10) || 0;
    const w = parseInt(b[2], 10); if (BAC_OPTIONS.indexOf(w) > -1) s.bac[b[0]] = w;
  });
  return s.order.length ? s : null;
}

function loadState() {
  const st = defaultState();
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) { const saved = JSON.parse(raw); PERSIST.forEach(k => { if (saved[k] !== undefined) st[k] = saved[k]; }); }
  } catch (e) {}
  try {
    const h = (location.hash || '').replace(/^#/, '');
    if (h.startsWith('plan=')) { Object.assign(st, stateFromPayload(decodePlan(h.slice(5))), { shared: true }); }
    else { const leg = legacyFromHash(h); if (leg) Object.assign(st, defaultState(), leg, { shared: true }); }
  } catch (e) {}
  if (!st.planId) st.planId = Math.random().toString(36).slice(2, 10);
  return st;
}

// ---------- Plan items: listed, own titration, or custom ----------

function view(p, st) {
  const idx = st.sizeIdx[p.id] || 0;
  const raw = p.tables[Math.min(idx, p.tables.length - 1)];
  const can = bacEligible(p.specs);
  const w = can ? (st.bac[p.id] || BAC_BASE) : BAC_BASE;
  const vialSpec = p.sizes ? p.sizes[Math.min(idx, p.sizes.length - 1)] : specOf(p, 'Vial');
  return { idx, can, w, t: scaleTable(raw, w, vialSpec), specs: p.specs.map(s => [s[0], scaleSpec(s[0], s[1], w)]) };
}

function customItem(key, m, p) {
  const L = computeLadder(m);
  const first = L.rows[0];
  const freqs = [...new Set(L.rows.map(r => r.freq.v))];
  const name = p ? p.name : (m.name || 'Custom compound');
  return {
    key, kind: p ? 'own' : 'custom', p, model: m, ladder: L,
    name, sub: p ? p.sub : 'Custom compound', goal: p ? p.goal : 'custom', icon: p ? GOAL_ICONS[p.goal] : null,
    desc: p ? p.desc : '', oral: false,
    vialLabel: 'Vial', vial: L.vial ? fmtAmt(L.vial, L.unit) : '—', water: L.water, conc: L.conc,
    when: m.when || 'any', whenLabel: WHEN_LABEL[m.when] || 'Any time',
    freqText: first ? first.freq.label + (freqs.length > 1 ? ', changing by phase' : '') : '—',
    site: m.site || SITES[0], duration: L.totalWeeks ? L.totalWeeks + ' weeks' : (p ? specOf(p, 'Duration') : 'Ongoing'),
    headers: ['Weeks', 'Weekly dose', 'Per injection', 'How often', 'Draw'],
    tableRows: L.rows.map(r => [r.label, r.weeklyText, r.perText, r.freq.label, r.draw]),
    rows: L.rows.map(r => ({ label: r.label, dose: r.weeklyText, extra: r.perText + ' per injection · ' + r.freq.label.toLowerCase(), draw: r.draw, units: r.units, warn: r.warn })),
    note: p ? (p.note || '') : '',
    prep: L.water ? 'Add ' + trimNum(L.water, 2) + 'ml bac water' : '',
    vialStart: L.vialStart, vialTop: L.vialTop, vialsNeeded: L.vialsNeeded,
    week: wk => {
      const r = rowForWeekCustom(L, wk);
      if (!r) return null;
      return { dose: r.perText, weeklyText: r.weeklyText, draw: r.draw, weekly: r.weekly, perAmt: r.per, days: r.freq.days, perDay: r.freq.perDay || 1, n: r.freq.n };
    }
  };
}

function listedItem(p, st) {
  if (st.mode[p.id] === 'own' && st.own[p.id]) return customItem(p.id, st.own[p.id], p);
  const v = view(p, st);
  const oral = isOral(p);
  const vs = vialStrength(p, v.idx);
  const water = oral ? null : listedWater(p, st.bac[p.id]);
  const sch = SCHEDULE_MAP[p.id] || ['any', 'See protocol card', [0, 1, 2, 3, 4, 5, 6]];
  const steps = oral ? [] : listedSteps(p, v.idx);
  const weeklyHead = /weekly/i.test(v.t.headers[1] || '');
  const rows = v.t.rows.map(r => {
    const draw = r[r.length - 1];
    const units = unitsOf(draw);
    let warn = '';
    if (units !== null && units > 100) warn = 'More than one 1ml syringe. Split into two draws, use less bac water or a stronger vial.';
    return { label: r[0], dose: r[1] + (weeklyHead ? ' / week' : ''), extra: r.slice(2, -1).join(' · '), draw, units, warn };
  });
  const st0 = steps[0], stN = steps[steps.length - 1];
  const vw = s => s && vs && num(s.weekly) > 0 && s.unit === vs.u ? vs.v / num(s.weekly) : null;
  return {
    key: p.id, kind: 'listed', p, name: p.name, sub: p.sub, goal: p.goal, icon: GOAL_ICONS[p.goal], desc: p.desc, oral,
    vialLabel: oral ? 'Form' : 'Vial', vial: oral ? (specOf(p, 'Strength') || specOf(p, 'Form')) : (vs ? fmtAmt(vs.v, vs.u) : ''),
    water, conc: oral ? '' : concText(vs, water),
    when: sch[0], whenLabel: WHEN_LABEL[sch[0]] || 'Any time', freqText: sch[1],
    site: oral ? 'Oral' : (specOf(p, 'Site') || 'SubQ · abdomen'), timing: specOf(p, 'Timing'), duration: specOf(p, 'Duration'),
    headers: v.t.headers, tableRows: v.t.rows, rows, note: p.note || '', specs: v.specs,
    prep: oral ? 'No mixing — ' + (specOf(p, 'Form') || 'oral').toLowerCase() : (water ? 'Add ' + trimNum(water, 2) + 'ml bac water' : ''),
    vialStart: vw(st0), vialTop: vw(stN), vialsNeeded: null, sizeIdx: v.idx, bacOk: v.can, bac: v.w,
    week: wk => {
      const ri = rowIndexForWeek(v.t.rows, wk);
      const r = v.t.rows[ri];
      const s = steps[ri];
      const f = s ? FREQ[s.freq] : null;
      const days = f ? f.days : sch[2];
      const d = rowDose(r);
      const dose = d ? d.vals.map(x => fmtAmt(x, d.u)).join('–') : r[1];
      const perAmt = d && vs && d.u === vs.u ? d.vals[0] : null;
      return { dose, weeklyText: r[1], draw: r[r.length - 1], weekly: s ? num(s.weekly) : null, unit: s ? s.unit : null, perAmt, days, perDay: f ? (f.perDay || 1) : (sch[0] === 'ampm' ? 2 : 1), n: f ? f.n : days.length };
    }
  };
}

function planItems(st) {
  return st.order.map(k => st.customs[k] ? customItem(k, st.customs[k], null) : (PRODUCT[k] ? listedItem(PRODUCT[k], st) : null)).filter(Boolean);
}

// ---------- Small UI atoms ----------

function Icon({ name, size = 20 }) {
  const P = {
    close: 'M6 6l12 12M18 6L6 18', plus: 'M12 5v14M5 12h14', check: 'M5 12.5l4.5 4.5L19 7', arrow: 'M5 12h14M13 6l6 6-6 6', chev: 'M9.5 6.5L15 12l-5.5 5.5',
    search: 'M11 4a7 7 0 1 0 0 14a7 7 0 0 0 0-14zM20 20l-4-4', link: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
    print: 'M7 9V4h10v5M7 17H5a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-2M7 14h10v6H7z', trash: 'M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12',
    back: 'M19 12H5M11 6l-6 6 6 6', ext: 'M14 5h5v5M19 5l-8 8M18 14v5H5V6h5', eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
    body: 'M12 3a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM8 9h8l-1 6h-2l-1 6-1-6H9z', drop: 'M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z',
    shop: 'M4 7h16l-1.5 12a2 2 0 0 1-2 1.8H7.5a2 2 0 0 1-2-1.8zM9 7V6a3 3 0 0 1 6 0v1', book: 'M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zM4 19V5M8 7h7', plan: 'M7 3v3M17 3v3M4 8h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zM9 14l2 2 4-4', bag: 'M3 4h2l2.4 11.2a1 1 0 0 0 1 .8h9.2a1 1 0 0 0 1-.8L20 8H6M9 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2zM17 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2z'
  };
  return html`<svg width=${size} height=${size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d=${P[name]} /></svg>`;
}

function Syringe({ units, small }) {
  const u = units === null || units === undefined ? 0 : units;
  const pct = Math.max(u > 0 ? 1.5 : 0, Math.min(100, u));
  const label = units === null || units === undefined ? 'Syringe' : 'Syringe filled to ' + fmtUnits(u) + ' of 100 units';
  return html`<div class=${'syr' + (small ? ' sm' : '')} role="img" aria-label=${label}>
    <span class="needle"></span><span class="hub"></span>
    <span class="barrel"><span class=${'fill' + (u > 100 ? ' over' : '')} style=${'width:' + pct + '%'}></span>
      <span class="ticks">${Array.from({ length: 10 }, () => html`<span></span>`)}</span></span>
    <span class="flange"></span><span class="rod"></span><span class="thumb"></span>
  </div>`;
}

function Ladder({ rows, syringes = true }) {
  return html`<div class="ladder">${rows.map(r => html`<div class="rung">
    <div><div class="wk">${/^\d/.test(r.label) ? 'Weeks ' + r.label : r.label}</div><div class="dose">${r.dose}</div>${r.extra ? html`<div class="extra">${r.extra}</div>` : null}</div>
    <div class="draw">${r.units !== null ? html`${String(r.draw).split(' · ')[0]}<small>${String(r.draw).split(' · ')[1] || ''}</small>` : r.draw}</div>
    ${syringes && r.units !== null ? html`<${Syringe} units=${r.units} small />` : null}
    ${r.warn ? html`<div class="warn">${r.warn}</div>` : null}
  </div>`)}</div>`;
}

function Pills({ options, value, onPick, label }) {
  return html`<div class="pills" role="group" aria-label=${label}>${options.map(o => html`<button type="button" class="pill" aria-pressed=${String(o.v === value)} onClick=${() => onPick(o.v)}>${o.label}</button>`)}</div>`;
}

// ---------- Product page: buy at the top, how-to below in tabs ----------

function ProductPage({ sku, st, set, sh, bump, tab, setTab, flash, exportPdf }) {
  const sp = SHOP_BY_SKU[sku];
  if (!sp) return html`<div class="wrap page narrow"><a class="back" href="#/">Price list</a><div class="empty" style="margin-top:16px">That product isn't on the price list.</div></div>`;
  const map = SKU_PROTOCOL[sku];
  const p = map ? PRODUCT[map[0]] : null;
  const idx = map ? map[1] : 0;
  const it = p ? listedItem(p, Object.assign({}, st, { mode: {}, sizeIdx: Object.assign({}, st.sizeIdx, { [p.id]: idx }) })) : null;
  const [base, strength] = splitName(sp.name);
  const coa = COAS[sku];
  const sizes = p && PROTOCOL_SKUS[p.id] ? PROTOCOL_SKUS[p.id].filter(Boolean) : [];
  const first = it ? it.rows[0] : null;
  const facts = it ? [['How often', it.freqText], ['When', it.timing || it.whenLabel], ['Site', it.site], ['Duration', it.duration]] : [];
  const bac = sp.sku === 'NA1000' ? '10ml' : (it && it.oral ? '' : '3ml');
  const t = tab || 'use';
  return html`<div class="wrap page narrow">
    <a class="back" href="#/"><${Icon} name="back" size=${18} /> Price list</a>
    <div class=${'plid g-' + sp.goal}>
      <div class="plid-top">
        <h1>${base}${strength ? html`<span>${strength}</span>` : null}</h1>
        ${sizes.length > 1 ? html`<nav class="strengths" aria-label="Vial strength">${sizes.map(s => html`<a href=${'#/p/' + s} aria-current=${s === sku ? 'page' : null}>${splitName(SHOP_BY_SKU[s].name)[1] || s}</a>`)}</nav>` : null}
      </div>
      <div class="plid-foot"><span class="lock"><img src=${GOAL_ICONS[sp.goal]} alt="" /><span>${GOAL_LABELS[sp.goal]}</span></span>
        ${coa ? html`<a class="plid-chip" href=${COA_BASE + coa[2]} target="_blank" rel="noopener" aria-label=${coa[0] + ' pure, open the certificate of analysis'}>${coa[0]} pure<${Icon} name="ext" size=${14} /></a>` : null}</div>
    </div>
    <div style="margin-top:12px"><${Tiers} p=${sp} sh=${sh} bump=${bump} /></div>
    ${bac ? html`<div class="inbox" style="margin-top:10px"><${Icon} name="drop" size=${20} /><span>Comes with a <b>free ${bac} vial of bac water</b> to mix it. Nothing extra to buy.</span></div>` : null}
    ${INFO[sku] ? html`<p class="pintro" style="margin-top:16px">${INFO[sku]}</p>` : null}
    ${it ? html`
      <div class="seg full" role="tablist" aria-label="Product information" style="margin-top:20px">
        <button type="button" role="tab" aria-selected=${String(t === 'use')} aria-pressed=${String(t === 'use')} onClick=${() => setTab('use')}>How to use</button>
        ${!it.oral ? html`<button type="button" role="tab" aria-selected=${String(t === 'mix')} aria-pressed=${String(t === 'mix')} onClick=${() => setTab('mix')}>Mix and draw</button>` : null}
        <button type="button" role="tab" aria-selected=${String(t === 'about')} aria-pressed=${String(t === 'about')} onClick=${() => setTab('about')}>About</button>
      </div>
      <div role="tabpanel" class="stack g16" style="margin-top:16px">
        ${t === 'use' ? html`
          <dl class="facts4" style="margin:0">${facts.map(f => html`<div class="fact"><dt>${f[0]}</dt><dd>${f[1] || '—'}</dd></div>`)}</dl>
          <div class="stack g8"><h2 style="font-size:19px;letter-spacing:-.02em">Dose by week${it.bacOk ? html` <span class="muted" style="font-weight:500;font-size:14px">mixed with ${trimNum(it.water, 2)}ml bac water</span>` : ''}</h2><${Ladder} rows=${it.rows} syringes=${!it.oral} /></div>
          ${p.note ? html`<div class="note">${p.note}</div>` : null}
          <div class="row g8 wrapx">${st.order.indexOf(p.id) > -1 ? html`<a class="btn soft" href="#/plan"><${Icon} name="check" size=${16} /> In My plan</a>`
            : html`<button type="button" class="btn" onClick=${() => { set(s => ({ order: s.order.concat([p.id]), sizeIdx: Object.assign({}, s.sizeIdx, { [p.id]: idx }) })); flash && flash(p.name + ' added to My plan'); }}><${Icon} name="plus" size=${16} /> Add to My plan</button>`}
            ${!it.oral ? html`<a class="btn outline" href="#/guide/sites"><${Icon} name="body" size=${16} /> Where to inject</a>` : null}
            ${exportPdf ? html`<button type="button" class="btn outline" onClick=${() => exportPdf([[p.id, idx]])}><${Icon} name="print" size=${16} /> Save as PDF</button>` : null}</div>` : null}
        ${t === 'mix' && !it.oral ? html`
          ${it.bacOk ? html`<div class="stack g8"><div class="small" style="font-weight:600;color:var(--ink)">How much bac water are you adding?</div>
            <${Pills} label="Bac water" value=${it.bac} options=${BAC_OPTIONS.map(v => ({ v, label: v + 'ml' }))} onPick=${v => set(s => ({ bac: Object.assign({}, s.bac, { [p.id]: v }) }))} /></div>` : null}
          <div class="inbox"><${Icon} name="drop" size=${20} /><span>${it.vial} vial + ${trimNum(it.water || 0, 2)}ml water = <b>${it.conc}</b></span></div>
          ${first && first.units !== null ? html`<div class="stack g8"><div class="small" style="font-weight:600;color:var(--ink)">First dose: draw to ${String(first.draw).split(' · ')[0]}</div><${Syringe} units=${first.units} /><div class="syr-scale"><span>0</span><span>25</span><span>50</span><span>75</span><span>100</span></div></div>` : null}
          <ol class="mixsteps">${[['Warm up', 'Vial and bac water out of the fridge for 10–15 minutes.'], ['Swab', 'Fresh alcohol swab on both stoppers. Let them dry.'], ['Add the water', 'Draw ' + trimNum(it.water || 2, 2) + 'ml of bac water and run it slowly down the inside wall of the vial.'], ['Roll, never shake', 'Roll gently until clear. Label with the date and refrigerate at 2–8°C.']].map((x, i) => html`<li><span class="n">${i + 1}</span><div><b>${x[0]}</b><p class="small">${x[1]}</p></div></li>`)}</ol>
          <a class="btn outline" href="#/guide/measure">Open the dose calculator</a>` : null}
        ${t === 'about' ? html`
          <p>${p.desc}</p>
          <div class="row g8 wrapx">${it.specs.filter(s => ['Frequency', 'Timing', 'Site', 'Duration'].indexOf(s[0]) === -1).map(s => html`<span class="tiny" style="background:var(--paper);border-radius:999px;padding:6px 12px"><b style="color:var(--ink)">${s[0]}:</b> ${s[1]}</span>`)}</div>
          ${p.stacks && p.stacks.length ? html`<div class="stack g8"><div class="lbl">Commonly stacked with</div><div class="row g8 wrapx">${p.stacks.map(x => html`<span class="tiny" style="background:var(--paper);border-radius:999px;padding:6px 12px;color:var(--ink);font-weight:500">${x}</span>`)}</div></div>` : null}
          <div class="note"><b style="color:var(--ink)">Storage:</b> ${SHOP_STORAGE}</div>
          ${coa ? html`<a class="btn outline" href=${COA_BASE + coa[2]} target="_blank" rel="noopener">Certificate of analysis · ${coa[0]} · tested ${coa[1]}</a>` : null}
          <p class="tiny muted">${DISCLAIMER}</p>` : null}
      </div>` : null}
  </div>`;
}
