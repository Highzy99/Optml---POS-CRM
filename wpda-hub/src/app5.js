// ================= Daily tracker, hero, box section, header, footer, root =================

const ROTATION = ['Abdomen 1', 'Abdomen 2', 'Abdomen 3', 'Abdomen 4', 'Abdomen 5', 'Abdomen 6', 'Abdomen 7', 'Abdomen 8', 'Left flank', 'Right flank', 'Left thigh', 'Right thigh'];
const BUCKET_ORDER = ['am', 'ampm', 'pre', 'any', 'pm', 'weekly'];
const trackKey = id => 'wpda-track-' + id;
function loadTrack(id) { try { const t = JSON.parse(localStorage.getItem(trackKey(id))); if (t && t.logs) return t; } catch (e) {} return { logs: {}, mixed: {}, rot: 0, notes: {} }; }

function dosesOn(items, start, date) {
  const di = daysBetween(start, date);
  if (di < 0) return [];
  const wk = Math.floor(di / 7) + 1, dow = di % 7;
  const out = [];
  items.forEach(it => {
    const w = it.week(wk);
    if (!w || w.days.indexOf(dow) === -1) return;
    const n = w.perDay || 1;
    for (let s = 0; s < n; s++) {
      out.push({ id: it.key + ':' + s, it, w, slot: n > 1 ? (s ? 'Evening' : 'Morning') : it.whenLabel, bucket: n > 1 ? (s ? 'pm' : 'am') : it.when, units: unitsOf(w.draw) });
    }
  });
  return out.sort((a, b) => BUCKET_ORDER.indexOf(a.bucket) - BUCKET_ORDER.indexOf(b.bucket));
}

function Ring({ done, total }) {
  const r = 36, C = 2 * Math.PI * r, pct = total ? done / total : 0;
  return html`<div style="position:relative;width:96px;height:96px;flex:none" role="img" aria-label=${done + ' of ' + total + ' doses done today'}>
    <svg viewBox="0 0 84 84" style="width:100%;height:100%;transform:rotate(-90deg)"><circle cx="42" cy="42" r=${r} fill="none" stroke="rgba(34,35,38,.12)" stroke-width="7" /><circle cx="42" cy="42" r=${r} fill="none" stroke="#222326" stroke-width="7" stroke-linecap="round" stroke-dasharray=${(C * pct).toFixed(1) + ' ' + C.toFixed(1)} /></svg>
    <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;line-height:1"><b style="font-size:22px;color:var(--ink);font-variant-numeric:tabular-nums">${done}<span style="font-size:13px;color:var(--n600)">/${total}</span></b><span style="font-size:10px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--n600);margin-top:3px">done</span></div>
  </div>`;
}

function Tracker({ st, set, items, onReorder }) {
  const [tr, setTr] = useState(() => loadTrack(st.planId));
  const [dayOff, setDayOff] = useState(0);
  useEffect(() => { setTr(loadTrack(st.planId)); }, [st.planId]);
  const saveTr = next => { setTr(next); try { localStorage.setItem(trackKey(st.planId), JSON.stringify(next)); } catch (e) {} };
  const start = parseDay(st.start);
  const t0 = today0();
  if (!start) {
    return html`<div><div class="banner">
      <div class="eyebrow">${st.client ? st.client.trim().split(/\s+/)[0] + "'s protocol" : 'Your protocol'}</div><h2 id="h-today" style="font-size:28px">Ready when you are</h2>
      <p class="small">Set a start date and this becomes a daily tracker: what to take today, what to draw, where to inject next and when to reorder.</p>
      <div class="row g8 wrapx"><button type="button" class="btn" onClick=${() => set({ start: isoDay(t0) })}>Start today</button>
        <label class="row g8"><span class="small" style="font-weight:600;color:var(--ink)">or pick a date</span><input class="input" style="width:auto" type="date" value=${st.start} onInput=${e => set({ start: e.target.value })} /></label></div>
    </div></div>`;
  }
  const day = addDays(t0, dayOff);
  const dk = isoDay(day);
  const di = daysBetween(start, day);
  const wk = Math.floor(Math.max(0, di) / 7) + 1;
  const doses = dosesOn(items, start, day);
  const logs = tr.logs[dk] || {};
  const done = doses.filter(d => logs[d.id]).length;
  const next = doses.find(d => !logs[d.id]);
  const suggested = ROTATION[(tr.rot || 0) % ROTATION.length];
  const log = d => {
    const L = Object.assign({}, tr.logs);
    const dayLogs = Object.assign({}, L[dk] || {});
    if (dayLogs[d.id]) { delete dayLogs[d.id]; L[dk] = dayLogs; saveTr(Object.assign({}, tr, { logs: L })); return; }
    dayLogs[d.id] = { site: d.oral || d.it.oral ? 'Oral' : suggested, amt: d.w.perAmt || 0, t: Date.now() };
    L[dk] = dayLogs;
    saveTr(Object.assign({}, tr, { logs: L, rot: d.it.oral ? tr.rot : (tr.rot || 0) + 1 }));
  };
  const setSite = (d, site) => { const L = Object.assign({}, tr.logs); L[dk] = Object.assign({}, L[dk], { [d.id]: Object.assign({}, L[dk][d.id], { site }) }); saveTr(Object.assign({}, tr, { logs: L })); };
  const strip = Array.from({ length: 7 }, (_, i) => { const d = addDays(t0, i - 3); const k = isoDay(d); const ds = dosesOn(items, start, d); const n = ds.filter(x => (tr.logs[k] || {})[x.id]).length; return { d, k, off: i - 3, total: ds.length, n }; });
  // Vial supply per injectable item
  const supply = items.filter(it => !it.oral).map(it => {
    const vialAmt = it.kind === 'listed' ? (vialStrength(it.p, it.sizeIdx || 0) || {}).v : num(it.model.vial);
    const mixedOn = tr.mixed[it.key] || st.start;
    let used = 0;
    Object.keys(tr.logs).forEach(k => { if (k >= mixedOn) Object.keys(tr.logs[k]).forEach(id => { if (id.split(':')[0] === it.key) used += tr.logs[k][id].amt || 0; }); });
    const w = it.week(wk);
    const per = w && w.perAmt;
    const left = vialAmt > 0 && per > 0 ? Math.max(0, Math.floor((vialAmt - used) / per + 1e-9)) : null;
    const age = daysBetween(parseDay(mixedOn), t0);
    return { it, vialAmt, used, left, age, pct: vialAmt > 0 ? Math.max(0, Math.min(1, 1 - used / vialAmt)) : 0, low: (left !== null && left <= 3) || age > 28 };
  });
  return html`<div>
    <div class="page-head"><div class="eyebrow">${st.client ? st.client.trim().split(/\s+/)[0] + "'s protocol" : 'Your protocol'}</div><h1 id="h-today">${di < 0 ? 'Starts ' + fmtDay(start) : dayOff === 0 ? 'Today' : fmtDay(day)}</h1>
      <p class="muted">${di < 0 ? 'Your plan starts in ' + (-di) + ' day' + (-di === 1 ? '' : 's') + '. Mix your vials the day before.' : 'Week ' + wk + ' · day ' + (di + 1) + '. Tick each dose as you take it.'}</p></div>
    <div class="banner" style="gap:16px">
      <div class="row g16"><${Ring} done=${done} total=${doses.length} />
        <div class="grow">${next ? html`<div class="lbl">Up next</div><div style="font-size:21px;font-weight:700;color:var(--ink);line-height:1.2">${next.it.name}</div><div class="small">${next.slot} · ${next.w.dose}${next.units !== null ? ' · draw ' + String(next.w.draw).split(' · ')[0] : ''}</div>${!next.it.oral ? html`<div class="tiny muted" style="margin-top:2px">Inject at: <b style="color:var(--ink)">${suggested}</b></div>` : null}`
          : html`<div class="lbl">${fmtDay(day)}</div><div style="font-size:21px;font-weight:700;color:var(--ink)">${doses.length ? 'All done' : 'Rest day'}</div><div class="small">${doses.length ? 'Every dose for the day is ticked off.' : 'Nothing scheduled. Keep vials in the fridge.'}</div>`}</div></div>
      <div class="row g4" role="group" aria-label="Choose a day">${strip.map(s => html`<button type="button" onClick=${() => setDayOff(s.off)} aria-pressed=${String(s.off === dayOff)} aria-label=${fmtDay(s.d) + ', ' + s.n + ' of ' + s.total + ' done'}
        style=${'flex:1 1 0;min-width:36px;min-height:58px;border-radius:14px;border:1px solid ' + (s.off === dayOff ? 'var(--ink)' : 'rgba(34,35,38,.12)') + ';background:' + (s.off === dayOff ? 'var(--ink)' : 'rgba(255,255,255,.7)') + ';color:' + (s.off === dayOff ? '#fff' : 'var(--ink)') + ';display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;cursor:pointer;font-size:11px;font-weight:600'}>
        <span>${DOW[s.d.getDay()]}</span><b style="font-size:16px;font-variant-numeric:tabular-nums">${s.d.getDate()}</b>
        <i style=${'width:6px;height:6px;border-radius:50%;background:' + (!s.total ? 'transparent' : s.n === s.total ? 'var(--ok)' : s.n ? '#ff7848' : (s.off === dayOff ? 'rgba(255,255,255,.5)' : 'var(--n300)'))}></i></button>`)}</div>
    </div>
    <div class="stack g8" style="margin-top:12px">
      ${doses.map(d => { const l = logs[d.id]; return html`<div class="card" style=${'padding:12px 14px;display:flex;gap:12px;align-items:center;' + (l ? 'background:var(--paper);border-color:var(--paper)' : '')}>
        <button type="button" onClick=${() => log(d)} aria-pressed=${String(!!l)} aria-label=${(l ? 'Undo ' : 'Log ') + d.it.name + ' ' + d.slot}
          style=${'width:40px;height:40px;flex:none;border-radius:12px;border:2px solid ' + (l ? 'var(--ink)' : 'var(--n300)') + ';background:' + (l ? 'var(--ink)' : '#fff') + ';color:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer'}>${l ? html`<${Icon} name="check" size=${20} />` : null}</button>
        <div class="grow"><div style="font-weight:700;color:var(--ink)">${d.it.name}</div><div class="tiny muted">${d.slot} · ${d.w.dose}${d.units !== null ? ' · ' + d.w.draw : d.it.oral ? ' · ' + d.w.draw : ''}</div>
          ${l && !d.it.oral ? html`<label class="row g6 tiny" style="margin-top:4px"><span>Site</span><select class="select" style="min-height:32px;padding:2px 30px 2px 10px;font-size:13px;width:auto" value=${l.site} onChange=${e => setSite(d, e.target.value)}>${ROTATION.map(r => html`<option value=${r}>${r}</option>`)}</select></label>` : null}</div>
        ${d.units !== null ? html`<div style="width:96px;flex:none"><${Syringe} units=${d.units} small /></div>` : null}
      </div>`; })}
      ${!doses.length && di >= 0 ? html`<div class="empty">No doses scheduled on ${fmtDay(day)}.</div>` : null}
    </div>
    ${supply.length ? html`<h3 style="font-size:20px;margin:26px 0 10px">Vials</h3>
      <div class="cgrid">${supply.map(s => html`<div class="card" style="padding:14px 16px;display:flex;flex-direction:column;gap:8px">
        <div class="row g8"><b class="grow" style="color:var(--ink)">${s.it.name}</b><span class="tiny muted">${s.left !== null ? '≈ ' + s.left + ' dose' + (s.left === 1 ? '' : 's') + ' left' : ''}</span></div>
        <div style="height:8px;border-radius:999px;background:var(--sunken);overflow:hidden"><div style=${'height:100%;border-radius:999px;width:' + Math.round(s.pct * 100) + '%;background:' + (s.low ? 'var(--bad)' : 'var(--ink)')}></div></div>
        <div class="tiny muted">Mixed ${s.age <= 0 ? 'today' : s.age + ' day' + (s.age === 1 ? '' : 's') + ' ago'} · use within 4 weeks of mixing</div>
        ${s.low ? html`<div class="warn tiny">${s.age > 28 ? 'This vial has been mixed for over four weeks. Start a fresh one.' : 'Running low. Reorder now so you do not miss a dose.'}</div>` : null}
        <div class="row g8 wrapx"><button type="button" class="btn sm outline" onClick=${() => saveTr(Object.assign({}, tr, { mixed: Object.assign({}, tr.mixed, { [s.it.key]: dk }) }))}>I mixed a new vial</button>
          ${s.it.p && PROTOCOL_SKUS[s.it.p.id] ? html`<button type="button" class="btn sm soft" onClick=${() => onReorder(PROTOCOL_SKUS[s.it.p.id][s.it.sizeIdx || 0] || PROTOCOL_SKUS[s.it.p.id].filter(Boolean)[0])}>Reorder</button>` : null}</div>
      </div>`)}</div>` : null}
    <label class="field" style="margin-top:20px"><span>How do you feel? (energy, sleep, appetite, side effects)</span><textarea class="textarea" placeholder="Saved on this device with the day's doses." value=${(tr.notes || {})[dk] || ''} onInput=${e => saveTr(Object.assign({}, tr, { notes: Object.assign({}, tr.notes, { [dk]: e.target.value }) }))}></textarea></label>
  </div>`;
}


// ---------- Routing ----------
function parseRoute() {
  const h = location.hash || '';
  if (h.startsWith('#/p/')) { const parts = h.slice(4).split('/'); return { page: 'product', sku: decodeURIComponent(parts[0]).toUpperCase(), tab: parts[1] || '' }; }
  if (h.startsWith('#/guide')) return { page: 'guide', chapter: h.split('/')[2] || 'mix' };
  const m = h.match(/^#\/(order|plan|build|coa)$/);
  if (m) return { page: m[1] };
  return { page: 'shop' };
}

function ShopHero() {
  return html`<section class="shero"><div class="wrap">
    <div class="shero-grid">
      <div class="stack g12">
        <div class="eyebrow">${WHOLESALE ? 'optml wholesale' : 'optml price list'}</div>
        <h1>Research-grade peptides, properly tested.</h1>
        <p class="lead">${WHOLESALE ? 'Your confirmed wholesale rates. Add what you need and send it as one order on WhatsApp.' : 'Free bac water, a batch-matched certificate and a step-by-step guide with every vial.'}</p>
        <div class="scrollx"><span class="chip soft">Free bac water in every box</span><span class="chip soft">98%+ purity</span><span class="chip soft">Free shipping over $200</span></div>
        <div class="tiny muted"><${ShipCountdown} /></div>
      </div>
      <figure class="shero-img"><img src="assets/brand/hero-vials-web.jpg" alt="optml vials with printed labels, batch numbers and QR codes" fetchpriority="high" /></figure>
    </div>
  </div></section>`;
}

function HowItWorks() {
  const steps = [['Order', 'Tap packs, then send your order on WhatsApp. We confirm and send payment details.'], ['Unbox', 'Your vial arrives with a free vial of bac water to mix it.'], ['Follow your guide', 'Your plan appears under My plan: exact draws, sites and a daily tracker.']];
  return html`<section class="wrap" aria-label="How it works" style="margin-top:18px"><div class="hiw">${steps.map((x, i) => html`<div class="hiw-step"><span class="n">${i + 1}</span><div><b>${x[0]}</b><p class="tiny muted">${x[1]}</p></div></div>`)}</div></section>`;
}

function BoxStrip() {
  return html`<section class="wrap" aria-label="What arrives" style="margin-top:22px"><div class="boxstrip">
    <figure><img src="assets/brand/box-insert.jpg" alt="Open optml box with a vial of Bacteriostatic Water beside a vial of Wolverine Stack" loading="lazy" /></figure>
    <div class="stack g8" style="justify-content:center"><div class="lbl">In every box</div><b style="font-size:19px;color:var(--ink);line-height:1.25">Your vial, plus the bac water to mix it. Free.</b>
      <p class="small muted">Most people expect to buy bacteriostatic water separately. With optml it's already in the box, with a fitted insert and fridge-ready labels.</p></div>
  </div></section>`;
}

function Header({ route, count, total, planCount }) {
  const cur = p => (route.page === p || (p === 'shop' && route.page === 'product')) ? 'page' : null;
  return html`<header class="top screen"><div class="wrap inner">
    <a href="#/" aria-label="optml price list home" style="justify-self:start;display:flex;align-items:center;gap:10px;text-decoration:none"><img class="logo" src="assets/brand/optml-wordmark-dark.svg" alt="optml" style="height:22px" /></a>
    <a class="btn sm plan" href="#/order" aria-label=${'Order, ' + count + ' packs'}>${count ? money(total) : 'Order'} <span class="count">${count}</span></a>
    <nav aria-label="Pages" class="desk"><a href="#/" aria-current=${cur('shop')}>Price list</a><a href="#/guide" aria-current=${cur('guide')}>How to use</a><a href="#/plan" aria-current=${cur('plan')}>My plan${planCount ? ' · ' + planCount : ''}</a><a href="#/coa" aria-current=${cur('coa')}>Certificates</a><a href="#/build" aria-current=${cur('build')}>Build a protocol</a></nav>
  </div></header>`;
}

function TabBar({ route, count, planCount }) {
  const tabs = [['shop', '#/', 'Shop', 'shop'], ['guide', '#/guide', 'How to use', 'book'], ['plan', '#/plan', 'My plan', 'plan'], ['order', '#/order', 'Order', 'bag']];
  return html`<nav class="tabbar screen" aria-label="Pages">${tabs.map(t => { const on = route.page === t[0] || (t[0] === 'shop' && route.page === 'product');
    return html`<a href=${t[1]} aria-current=${on ? 'page' : null}><${Icon} name=${t[3]} size=${22} />${t[2]}${t[0] === 'order' && count ? html`<span class="dot">${count}</span>` : t[0] === 'plan' && planCount ? html`<span class="dot soft">${planCount}</span>` : null}</a>`; })}</nav>`;
}

function PlanPage({ st, set, items, onReorder }) {
  if (!items.length) return html`<div class="wrap page"><div class="page-head"><div class="eyebrow">My plan</div><h1>Your guide lives here</h1></div>
    <div class="empty" style="text-align:left;display:flex;flex-direction:column;gap:10px"><b style="color:var(--ink);font-size:17px">Order something and your personal guide appears here automatically.</b>
      <p class="small">Exact units to draw for everything you bought, how to mix it, where to inject, a daily tracker and a PDF to keep.</p>
      <div class="row g8 wrapx"><a class="btn sm" href="#/">Browse the price list</a><a class="btn sm outline" href="#/build">Build a protocol yourself</a></div></div></div>`;
  return html`<div class="wrap page narrow">
    <${Tracker} st=${st} set=${set} items=${items} onReorder=${onReorder} />
    <div class="card" style="padding:16px;margin-top:22px;display:flex;flex-direction:column;gap:10px"><b style="color:var(--ink)">Your plan: ${items.map(i => i.name).join(', ')}</b>
      <div class="row g8 wrapx"><button type="button" class="btn sm" onClick=${() => window.print()}><${Icon} name="print" size=${16} /> Save my guide as PDF</button><a class="btn sm outline" href="#/build">Edit plan</a><a class="btn sm ghost" href="#/guide">How to use</a></div></div>
  </div>`;
}

function Footer() {
  return html`<footer class="foot screen"><div class="wrap" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(min(220px,100%),1fr));gap:28px">
    <div class="stack g12"><img src="assets/brand/optml-wordmark-dark.svg" alt="optml" style="height:22px;width:auto;align-self:flex-start;filter:invert(1)" /><p>Research-grade peptides with free bac water and a batch-matched certificate. Guides by the World Peptide Dosage Association.</p></div>
    <div class="stack g8"><div class="lbl" style="color:rgba(255,255,255,.6)">Contact</div><a href=${'https://wa.me/' + WA_NUMBER} target="_blank" rel="noopener">WhatsApp</a><a href=${'mailto:' + CONTACT}>${CONTACT}</a></div>
    <div class="stack g8"><div class="lbl" style="color:rgba(255,255,255,.6)">Pages</div><a href="#/">Price list</a><a href="#/guide">How to use</a><a href="#/coa">Certificates</a><a href="#/build">Build a protocol</a></div>
    <p class="tiny" style="grid-column:1/-1;border-top:1px solid rgba(255,255,255,.14);padding-top:18px;color:rgba(255,255,255,.6)">Supplied for laboratory research use. ${DISCLAIMER}</p>
  </div></footer>`;
}

function App() {
  const [st, setSt] = useState(loadState);
  const set = patch => setSt(s => Object.assign({}, s, typeof patch === 'function' ? patch(s) : patch));
  const [sh, setShRaw] = useState(loadShop);
  const setSh = patch => setShRaw(s => Object.assign({}, s, typeof patch === 'function' ? patch(s) : patch));
  const [route, setRoute] = useState(parseRoute);
  const [ptab, setPtab] = useState('use');
  const [toast, setToast] = useState('');
  const items = planItems(st);
  const o = computeOrder(sh, Date.now());
  const [hasPrev, setHasPrev] = useState(() => { try { return !!localStorage.getItem('wpda-hub-prev'); } catch (e) { return false; } });

  useEffect(() => {
    const on = () => { setRoute(parseRoute()); setPtab('use'); window.scrollTo({ top: 0, behavior: 'instant' }); };
    window.addEventListener('hashchange', on);
    if (st.shared) {
      try {
        const raw = localStorage.getItem(STORE_KEY);
        if (raw) { const prev = JSON.parse(raw); if (prev.planId && prev.planId !== st.planId && prev.order && prev.order.length) { localStorage.setItem('wpda-hub-prev', raw); setHasPrev(true); } }
      } catch (e) {}
      location.replace('#/plan');
    }
    return () => window.removeEventListener('hashchange', on);
  }, []);
  useEffect(() => { try { const x = {}; PERSIST.forEach(k => { x[k] = st[k]; }); localStorage.setItem(STORE_KEY, JSON.stringify(x)); } catch (e) {} }, PERSIST.map(k => st[k]));
  useEffect(() => { try { const x = {}; SHOP_SAVED.forEach(k => { x[k] = sh[k]; }); localStorage.setItem(SHOP_KEY, JSON.stringify(x)); } catch (e) {} }, SHOP_SAVED.map(k => sh[k]));

  const flash = m => { setToast(m); clearTimeout(window.__tt); window.__tt = setTimeout(() => setToast(''), 1800); };
  const bump = (key, d) => {
    setSh(s => { const cart = Object.assign({}, s.cart); cart[key] = (cart[key] || 0) + d; if (cart[key] <= 0) delete cart[key]; return { cart, sent: false }; });
    if (d > 0) { const b = key.split(':'); const p = SHOP_BY_SKU[b[0]]; if (p) flash('Added ' + p.name + ' · ' + (b[1] === '1' ? '1 vial' : b[1] + ' vials')); }
  };
  const act = {
    add: id => set(s => {
      if (id === 'stack') {
        const ids = ['reta', 'tesa', 'mots', 'klow']; const w = s.bac.stack || BAC_BASE;
        return { order: s.order.concat(ids.filter(x => s.order.indexOf(x) === -1)), sizeIdx: Object.assign({}, s.sizeIdx, { reta: 1 }), bac: Object.assign({}, s.bac, { reta: w, tesa: w, mots: w, klow: w }) };
      }
      return s.order.indexOf(id) > -1 ? { order: s.order.filter(x => x !== id) } : { order: s.order.concat([id]) };
    }),
    remove: key => set(s => { const customs = Object.assign({}, s.customs); delete customs[key]; return { order: s.order.filter(x => x !== key), customs, openItem: s.openItem === key ? null : s.openItem }; }),
    addCustom: () => {
      set(s => { const id = 'x' + s.nextId; return { customs: Object.assign({}, s.customs, { [id]: blankCustom(id) }), order: s.order.concat([id]), nextId: s.nextId + 1, openItem: id }; });
      setTimeout(() => { const el = document.querySelector('.item:last-of-type'); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 60);
    },
    own: (id, on) => set(s => {
      const mode = Object.assign({}, s.mode, { [id]: on ? 'own' : 'std' });
      if (!on || s.own[id]) return { mode };
      const p = PRODUCT[id], idx = s.sizeIdx[id] || 0, vs = vialStrength(p, idx);
      const sch = SCHEDULE_MAP[id] || ['any'];
      let steps = listedSteps(p, idx);
      if (!steps.some(x => parseWeekRange(x.label))) steps = steps.slice(0, 1).map(x => Object.assign({}, x, { weeks: '' }));
      const model = { id, name: p.name, unit: vs && vs.u === 'iu' ? 'iu' : 'mg', vial: vs ? String(vs.v) : '', water: String(listedWater(p, s.bac[id]) || 2), when: sch[0], site: /thigh/i.test(specOf(p, 'Site')) ? SITES[1] : SITES[0], steps: steps.map(x => ({ weeks: x.weeks, weekly: x.weekly, freq: x.freq })) };
      return { mode, own: Object.assign({}, s.own, { [id]: model }) };
    }),
    model: (key, patch) => set(s => s.customs[key] ? { customs: Object.assign({}, s.customs, { [key]: Object.assign({}, s.customs[key], patch) }) } : { own: Object.assign({}, s.own, { [key]: Object.assign({}, s.own[key], patch) }) }),
    clear: () => set({ order: [], customs: {}, own: {}, mode: {}, inotes: {}, client: '', by: '', start: '', notes: '', shared: false, planId: Math.random().toString(36).slice(2, 10) }),
    hasPrev: hasPrev && st.shared,
    restorePrev: () => { try { const prev = JSON.parse(localStorage.getItem('wpda-hub-prev')); localStorage.removeItem('wpda-hub-prev'); setHasPrev(false); set(Object.assign({}, prev, { shared: false })); } catch (e) {} }
  };
  // After an order is sent: build "My plan" from exactly what was ordered.
  const onSent = orderItems => {
    setSh(s => ({ sent: true, lastOrder: { cart: s.cart, ref: s.ref, at: Date.now() } }));
    setTimeout(() => window.scrollTo({ top: 0, behavior: 'instant' }), 30);
    set(s => {
      const order = s.order.slice(); const sizeIdx = Object.assign({}, s.sizeIdx);
      orderItems.forEach(it => { const m = SKU_PROTOCOL[it.p.sku]; if (!m) return; if (order.indexOf(m[0]) === -1) order.push(m[0]); sizeIdx[m[0]] = m[1]; });
      return { order, sizeIdx, client: s.client || sh.name.trim() };
    });
  };
  const reorder = sku => { if (!sku) return; bump(sku + ':1', 1); location.hash = '#/order'; };
  const planReady = o.items.some(it => SKU_PROTOCOL[it.p.sku]);

  let page;
  if (route.page === 'product') page = html`<${ProductPage} sku=${route.sku} st=${st} set=${set} sh=${sh} bump=${bump} tab=${ptab} setTab=${setPtab} flash=${flash} />`;
  else if (route.page === 'order') page = html`<${OrderSection} sh=${sh} setSh=${setSh} bump=${bump} o=${o} onSent=${onSent} planReady=${planReady} />`;
  else if (route.page === 'guide') page = html`<${Guide} st=${st} set=${set} chapter=${route.chapter} />`;
  else if (route.page === 'plan') page = html`<${PlanPage} st=${st} set=${set} items=${items} onReorder=${reorder} />`;
  else if (route.page === 'build') page = html`<${Builder} st=${st} set=${set} items=${items} act=${act} />`;
  else if (route.page === 'coa') page = html`<${CoaSection} />`;
  else page = html`<${ShopHero} /><${ShopSection} sh=${sh} setSh=${setSh} bump=${bump} /><${HowItWorks} /><${BoxStrip} />`;

  return html`<${Header} route=${route} count=${o.packCount} total=${o.total} planCount=${items.length} />
    <main class="screen" id="main">${page}</main>
    <${Doc} st=${Object.assign({}, st, { preview: st.preview && route.page === 'build' })} items=${items} />
    <${Footer} />
    <${TabBar} route=${route} count=${o.packCount} planCount=${items.length} />
    ${toast ? html`<div class="toast screen" role="status">${toast}</div>` : null}`;
}

render(html`<${App} />`, document.getElementById('app'));
