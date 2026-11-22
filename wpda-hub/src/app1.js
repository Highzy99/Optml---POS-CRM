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

const PERSIST = ['sizeIdx', 'bac', 'order', 'customs', 'own', 'mode', 'nextId', 'client', 'by', 'start', 'notes', 'inotes', 'planId'];

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
    close: 'M6 6l12 12M18 6L6 18', plus: 'M12 5v14M5 12h14', check: 'M5 12.5l4.5 4.5L19 7', arrow: 'M5 12h14M13 6l6 6-6 6',
    search: 'M11 4a7 7 0 1 0 0 14a7 7 0 0 0 0-14zM20 20l-4-4', link: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
    print: 'M7 9V4h10v5M7 17H5a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-2M7 14h10v6H7z', trash: 'M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12',
    back: 'M19 12H5M11 6l-6 6 6 6', ext: 'M14 5h5v5M19 5l-8 8M18 14v5H5V6h5', eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
    body: 'M12 3a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM8 9h8l-1 6h-2l-1 6-1-6H9z', drop: 'M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z'
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

// ---------- Catalogue ----------

function Catalogue({ st, set, add }) {
  const q = st.query.trim().toLowerCase();
  const list = PRODUCTS.filter(p => (st.goal === 'all' || p.goal === st.goal) && (!q || (p.name + ' ' + p.sub + ' ' + p.desc + ' ' + p.goal).toLowerCase().includes(q)));
  return html`<section class="blk" id="compounds" aria-labelledby="h-compounds"><div class="wrap">
    <div class="sec-head"><div class="eyebrow">The range</div><h2 id="h-compounds">Find your compound</h2>
      <p class="lead">Every card shows the starting dose and exactly what to draw. Open one for the full ladder, mixing volume and timing.</p></div>
    <div class="stack g12">
      <label class="field" style="max-width:460px"><span class="sr">Search compounds</span>
        <input class="input" type="search" placeholder="Search compounds, goals or blends" value=${st.query} onInput=${e => set({ query: e.target.value })} /></label>
      <div class="scrollx" role="group" aria-label="Filter by goal">
        <button type="button" class="pill" aria-pressed=${String(st.goal === 'all')} onClick=${() => set({ goal: 'all' })}>All</button>
        ${GOALS.map(g => html`<button type="button" class="pill" aria-pressed=${String(st.goal === g)} onClick=${() => set({ goal: st.goal === g ? 'all' : g })}><img src=${GOAL_ICONS[g]} alt="" />${GOAL_LABELS[g]}</button>`)}
      </div>
      <div class="tiny muted">${list.length === PRODUCTS.length ? PRODUCTS.length + ' compounds in the optml range' : list.length + ' of ' + PRODUCTS.length + ' compounds'}</div>
    </div>
    <div class="cgrid" style="margin-top:16px">
      ${list.map(p => { const it = listedItem(p, Object.assign({}, st, { mode: {} })); const w1 = it.week(1); const added = st.order.indexOf(p.id) > -1;
        return html`<article class="ccard" style=${'--tint:' + GOAL_TINT[p.goal]}>
          <div class="stage"><img src=${GOAL_ICONS[p.goal]} alt="" /><div class="grow"><div class="row g8 wrapx"><span class="chip">${GOAL_LABELS[p.goal]}</span>${p.badge ? html`<span class="chip dark">${p.badge}</span>` : null}</div></div></div>
          <div class="body">
            <div><h3>${p.name}</h3><div class="small muted">${p.sub}</div></div>
            <div class="startline"><span class="muted">Starts</span><b>${w1.dose}</b><span class="muted">·</span><b>${it.oral ? w1.draw : 'draw ' + String(w1.draw).split(' · ')[0]}</b></div>
            <div class="acts">
              <button type="button" class="btn sm" onClick=${() => set({ sheet: p.id })}>View protocol</button>
              <button type="button" class=${'btn sm ' + (added ? 'soft' : 'outline')} aria-pressed=${String(added)} onClick=${() => add(p.id)}>${added ? html`<${Icon} name="check" size=${16} /> In plan` : html`<${Icon} name="plus" size=${16} /> Add`}</button>
            </div>
          </div></article>`; })}
    </div>
    ${list.length === 0 ? html`<div class="empty" style="margin-top:12px">Nothing matches that search. Try a goal or a shorter name, or add it as a custom compound in the builder.</div>` : null}
    <div class="feature">
      <div class="row g8 wrapx"><span class="chip">${STACK.badge}</span></div>
      <h3>${STACK.name}</h3>
      <div style="color:rgba(255,255,255,.66)">${STACK.sub}</div>
      <p style="max-width:62ch">${STACK.desc}</p>
      <dl class="facts" style="margin:0">${STACK.specs.map(s => html`<div><dt>${s[0]}</dt><dd>${s[1]}</dd></div>`)}</dl>
      <div class="row g8 wrapx"><button type="button" class="btn on-dark" onClick=${() => set({ sheet: 'stack' })}>View full protocol</button>
        <button type="button" class="btn on-dark-outline" onClick=${() => add('stack')}>Add all four to my plan</button></div>
    </div>
  </div></section>`;
}

// ---------- Compound sheet ----------

function useSheetBehaviour(open, close) {
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    document.body.classList.add('lock');
    const prev = document.activeElement;
    setTimeout(() => ref.current && ref.current.focus(), 30);
    const onKey = e => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey);
    return () => { document.body.classList.remove('lock'); window.removeEventListener('keydown', onKey); prev && prev.focus && prev.focus(); };
  }, [open]);
  return ref;
}

function Sheet({ st, set, add, goSite }) {
  const id = st.sheet;
  const close = () => set({ sheet: null });
  const ref = useSheetBehaviour(!!id, close);
  if (!id) return null;
  const isStack = id === 'stack';
  const p = PRODUCT[id];
  return html`<div class="scrim" onClick=${e => { if (e.target === e.currentTarget) close(); }}>
    <div class="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title">
      <div class="shead"><button type="button" class="iconbtn sm" ref=${ref} aria-label="Close" onClick=${close}><${Icon} name="close" size=${18} /></button>
        <strong id="sheet-title" class="grow" style="color:var(--ink);font-size:17px">${isStack ? STACK.name : p.name}</strong>
        ${!isStack && st.order.indexOf(id) > -1 ? html`<span class="chip" style="background:var(--paper)">In your plan</span>` : null}</div>
      ${isStack ? html`<${StackBody} st=${st} set=${set} add=${add} />` : html`<${CompoundBody} p=${p} st=${st} set=${set} add=${add} goSite=${goSite} />`}
    </div></div>`;
}

function CompoundBody({ p, st, set, add, goSite }) {
  const it = listedItem(p, Object.assign({}, st, { mode: {} }));
  const added = st.order.indexOf(p.id) > -1;
  const facts = [['How often', it.freqText], ['When', it.timing || it.whenLabel], ['Site', it.site], ['Duration', it.duration]];
  const others = it.specs.filter(s => ['Frequency', 'Timing', 'Site', 'Duration', 'Reconstitution'].indexOf(s[0]) === -1);
  const first = it.rows[0];
  return html`<div class="sbody">
    <div class="stage" style=${'--tint:' + GOAL_TINT[p.goal]}><img src=${GOAL_ICONS[p.goal]} alt="" />
      <div class="stack g6"><div class="row g8 wrapx"><span class="chip">${GOAL_LABELS[p.goal]}</span>${p.badge ? html`<span class="chip dark">${p.badge}</span>` : null}</div>
      <div class="small" style="color:var(--n700)">${p.sub}</div></div></div>
    <p>${p.desc}</p>
    <dl class="facts4" style="margin:0">${facts.map(f => html`<div class="fact"><dt>${f[0]}</dt><dd>${f[1] || '—'}</dd></div>`)}</dl>
    ${others.length ? html`<div class="row g8 wrapx">${others.map(s => html`<span class="tiny" style="background:var(--paper);border-radius:999px;padding:6px 12px"><b style="color:var(--ink)">${s[0]}:</b> ${s[1]}</span>`)}</div>` : null}
    ${!it.oral ? html`<div class="setup">
      <div class="lbl">Your setup</div>
      ${p.sizes ? html`<div class="stack g8"><div class="small" style="font-weight:600;color:var(--ink)">Vial size</div>
        <${Pills} label="Vial size" value=${it.sizeIdx} options=${p.sizes.map((s, i) => ({ v: i, label: s }))} onPick=${i => set(s => ({ sizeIdx: Object.assign({}, s.sizeIdx, { [p.id]: i }) }))} /></div>` : null}
      ${it.bacOk ? html`<div class="stack g8"><div class="small" style="font-weight:600;color:var(--ink)">Bac water added</div>
        <${Pills} label="Bac water" value=${it.bac} options=${BAC_OPTIONS.map(v => ({ v, label: v + 'ml' }))} onPick=${v => set(s => ({ bac: Object.assign({}, s.bac, { [p.id]: v }) }))} /></div>` : null}
      <div class="okbox">${it.vial} vial + ${trimNum(it.water || 0, 2)}ml water = <b>${it.conc}</b></div>
      <div class="stack g8"><div class="small" style="font-weight:600;color:var(--ink)">Your first dose: draw to ${String(first.draw).split(' · ')[0]}</div>
        <${Syringe} units=${first.units} /><div class="syr-scale"><span>0</span><span>25</span><span>50</span><span>75</span><span>100</span></div></div>
    </div>` : null}
    <div class="stack g10"><div class="lbl">Dose ladder</div><${Ladder} rows=${it.rows} syringes=${!it.oral} /></div>
    ${!it.oral ? html`<div class="panel" style="padding:18px;display:grid;grid-template-columns:repeat(auto-fit,minmax(min(220px,100%),1fr));gap:16px;align-items:center">
      <${BoxArt} goal=${p.goal} name=${p.name} compact />
      <div class="stack g8"><div class="lbl">What arrives</div><h3 style="font-size:19px">${p.name} with free bac water</h3>
        <p class="small">Your vial ships in an optml presentation box with its own vial of bacteriostatic water, so you can mix it the day it arrives. Nothing extra to buy.</p></div></div>` : null}
    ${p.stacks && p.stacks.length ? html`<div class="stack g8"><div class="lbl">Commonly stacked with</div><div class="row g8 wrapx">${p.stacks.map(s => html`<span class="tiny" style="background:var(--paper);border-radius:999px;padding:6px 12px;color:var(--ink);font-weight:500">${s}</span>`)}</div></div>` : null}
    ${p.note ? html`<div class="note">${p.note}</div>` : null}
    <div class="row g8 wrapx">
      <button type="button" class=${'btn ' + (added ? 'soft' : '')} onClick=${() => add(p.id)}>${added ? 'Remove from my plan' : html`<${Icon} name="plus" size=${16} /> Add to my plan`}</button>
      ${!it.oral ? html`<button type="button" class="btn outline" onClick=${() => goSite(/thigh/i.test(it.site) ? 'thigh' : 'abdomen')}><${Icon} name="body" size=${16} /> Where to inject</button>` : null}
      ${p.url ? html`<a class="btn ghost" href=${p.url} target="_blank" rel="noopener">Buy at optml <${Icon} name="ext" size=${16} /></a>` : null}
    </div>
    <p class="tiny muted">${DISCLAIMER}</p>
  </div>`;
}

function StackBody({ st, set, add }) {
  const w = st.bac.stack || BAC_BASE;
  const phases = STACK.phases.map(ph => Object.assign({ title: ph.title }, scaleTable(ph, w, '')));
  return html`<div class="sbody">
    <p>${STACK.desc}</p>
    <dl class="facts4" style="margin:0">${STACK.specs.map(s => html`<div class="fact"><dt>${s[0]}</dt><dd>${scaleSpec(s[0], s[1], w)}</dd></div>`)}</dl>
    <div class="setup"><div class="lbl">Bac water added to each vial</div>
      <${Pills} label="Bac water" value=${w} options=${BAC_OPTIONS.map(v => ({ v, label: v + 'ml' }))} onPick=${v => set(s => ({ bac: Object.assign({}, s.bac, { stack: v }) }))} /></div>
    ${phases.map(ph => html`<div class="stack g8"><h3 style="font-size:17px">${ph.title}</h3>
      <div class="tblwrap"><table class="tbl"><thead><tr>${ph.headers.map(h => html`<th scope="col">${h}</th>`)}</tr></thead>
      <tbody>${ph.rows.map(r => html`<tr>${r.map(c => html`<td>${c}</td>`)}</tr>`)}</tbody></table></div></div>`)}
    <div class="stack g8"><div class="lbl">Daily schedule</div>${STACK.schedule.map(s => html`<div class="note"><b style="color:var(--ink)">${s.when}</b> · ${s.what}</div>`)}</div>
    <div class="note">${STACK.note}</div>
    <div><button type="button" class="btn" onClick=${() => { add('stack'); set({ sheet: null }); }}>Add all four to my plan</button></div>
  </div>`;
}
