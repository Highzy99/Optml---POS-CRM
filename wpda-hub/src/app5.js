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

function Tracker({ st, set, items }) {
  const [tr, setTr] = useState(() => loadTrack(st.planId));
  const [dayOff, setDayOff] = useState(0);
  useEffect(() => { setTr(loadTrack(st.planId)); }, [st.planId]);
  const saveTr = next => { setTr(next); try { localStorage.setItem(trackKey(st.planId), JSON.stringify(next)); } catch (e) {} };
  const start = parseDay(st.start);
  const t0 = today0();
  if (!start) {
    return html`<section class="blk" id="today" aria-labelledby="h-today"><div class="wrap"><div class="banner">
      <div class="eyebrow">Your protocol</div><h2 id="h-today" style="font-size:28px">Ready when you are</h2>
      <p class="small">Set a start date and this becomes a daily tracker: what to take today, what to draw, where to inject next and when to reorder.</p>
      <div class="row g8 wrapx"><button type="button" class="btn" onClick=${() => set({ start: isoDay(t0) })}>Start today</button>
        <label class="row g8"><span class="small" style="font-weight:600;color:var(--ink)">or pick a date</span><input class="input" style="width:auto" type="date" value=${st.start} onInput=${e => set({ start: e.target.value })} /></label></div>
    </div></div></section>`;
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
  return html`<section class="blk" id="today" aria-labelledby="h-today"><div class="wrap">
    <div class="sec-head"><div class="eyebrow">${st.client ? st.client + "'s protocol" : 'Your protocol'}</div><h2 id="h-today">${di < 0 ? 'Starts ' + fmtDay(start) : dayOff === 0 ? 'Today' : fmtDay(day)}</h2>
      <p class="lead">${di < 0 ? 'Your plan starts in ' + (-di) + ' day' + (-di === 1 ? '' : 's') + '. Mix your vials the day before and check your supplies.' : 'Week ' + wk + ' · day ' + (di + 1) + '. Tick each dose as you take it. Your next site is suggested for you.'}</p></div>
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
          ${s.it.p && s.it.p.url ? html`<a class="btn sm soft" href=${s.it.p.url} target="_blank" rel="noopener">Reorder</a>` : html`<a class="btn sm soft" href=${SHOP_URL} target="_blank" rel="noopener">Shop</a>`}</div>
      </div>`)}</div>` : null}
    <label class="field" style="margin-top:20px"><span>How do you feel? (energy, sleep, appetite, side effects)</span><textarea class="textarea" placeholder="Saved on this device with the day's doses." value=${(tr.notes || {})[dk] || ''} onInput=${e => saveTr(Object.assign({}, tr, { notes: Object.assign({}, tr.notes, { [dk]: e.target.value }) }))}></textarea></label>
  </div></section>`;
}

function Hero({ items }) {
  return html`<section class="hero"><div class="wrap">
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(min(340px,100%),1fr));gap:clamp(20px,4vw,40px);align-items:center">
      <div class="stack g16">
        <div class="eyebrow">World Peptide Dosage Association</div>
        <h1>Every protocol, in plain numbers.</h1>
        <p class="lead">Exact units to draw for every compound in the optml range, how to mix and inject, and a builder that turns any plan into a client-ready PDF with a daily tracker.</p>
      </div>
      <figure style="margin:0;position:relative;border-radius:var(--r-xl);overflow:hidden;background:#cfe0f7;aspect-ratio:1400/1128">
        <img src="assets/brand/hero-vials-web.jpg" alt="Three optml vials, each with a printed label, batch number and QR code" style="width:100%;height:100%;object-fit:cover;display:block" fetchpriority="high" />
        <figcaption style="position:absolute;left:14px;bottom:14px;right:14px;display:flex;gap:8px;flex-wrap:wrap"><span class="chip" style="background:rgba(255,255,255,.9)">Free bac water with every vial</span><span class="chip" style="background:rgba(255,255,255,.9)">Batch-numbered</span></figcaption>
      </figure>
    </div>
    <nav class="paths" aria-label="Where to start">
      ${items.length ? html`<a class="path" href="#today" style="background:var(--wash)"><span class="num">★</span><div><h3>Your protocol today</h3><p class="small">What to take, what to draw and where to inject next.</p><span class="go">Open my tracker →</span></div></a>` : null}
      <a class="path" href="#guide"><span class="num">1</span><div><h3>New to this?</h3><p class="small">Mix, measure, inject and store. Four short chapters, five minutes.</p><span class="go">Start the guide →</span></div></a>
      <a class="path" href="#compounds"><span class="num">2</span><div><h3>Know what you're running?</h3><p class="small">Find your compound and see exactly what to draw each week.</p><span class="go">Find a compound →</span></div></a>
      <a class="path" href="#build"><span class="num">3</span><div><h3>Building a plan?</h3><p class="small">Pick compounds or add your own, set titrations, export a PDF.</p><span class="go">Open the builder →</span></div></a>
    </nav>
    <div class="disclaimer"><span style="width:8px;height:8px;border-radius:50%;background:var(--ink);flex:none;margin-top:7px"></span><p>${DISCLAIMER}</p></div>
  </div></section>`;
}

function BoxSection() {
  const points = [
    ['Free bacteriostatic water', 'Every vial ships with its own bac water, so there is nothing extra to source. Most people expect to buy it separately.'],
    ['A presentation box, not a zip bag', 'Each order arrives in a magnetic optml box with a fitted insert that holds the vial and the water upright.'],
    ['Labelled for the fridge', 'Every label carries the compound, storage instructions (2–8°C, protect from light) and a batch number.'],
    ['Made to work with this guide', 'Mix with the water in the box, then use the cards here for exact units and the tracker for every dose.']
  ];
  return html`<section class="blk" id="box" aria-labelledby="h-box"><div class="wrap">
    <div class="sec-head"><div class="eyebrow">In every box</div><h2 id="h-box">What arrives at your door</h2>
      <p class="lead">Your compound and the bacteriostatic water to mix it, together in one box. No hunting for bac water, no guesswork.</p></div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(min(300px,100%),1fr));gap:14px;align-items:stretch">
      <figure style="margin:0;border-radius:var(--r-xl);overflow:hidden;background:#1d1b1c;position:relative"><img src="assets/brand/box-closed.jpg" alt="Closed optml presentation box in blue with the restore goal badge and the words Recovery and Regenerative Research" loading="lazy" style="width:100%;height:100%;object-fit:cover;display:block" /></figure>
      <figure style="margin:0;border-radius:var(--r-xl);overflow:hidden;background:#eef0f6;position:relative"><img src="assets/brand/box-insert.jpg" alt="Open box showing a vial of optml Bacteriostatic Water beside a vial of Wolverine Stack in a white insert" loading="lazy" style="width:100%;height:100%;object-fit:cover;display:block" />
        <figcaption style="position:absolute;left:14px;top:14px"><span class="chip dark">Bac water included free</span></figcaption></figure>
    </div>
    <div class="tcards" style="grid-template-columns:repeat(auto-fit,minmax(min(240px,100%),1fr))">${points.map((p, i) => html`<div class="tcard"><span class="n" style="width:28px;height:28px;border-radius:50%;background:var(--ink);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px">${i + 1}</span><h4>${p[0]}</h4><p class="small">${p[1]}</p></div>`)}</div>
  </div></section>`;
}

function Header({ items }) {
  return html`<header class="top screen"><div class="wrap inner">
    <a href="#" aria-label="WPDA protocol hub, back to top" style="justify-self:start"><img class="logo" src="assets/brand/wordmark-dark.svg" alt="World Peptide Dosage Association" /></a>
    <a class="btn sm plan" href="#build" aria-label=${'My plan, ' + items.length + ' compounds'}>My plan <span class="count">${items.length}</span></a>
    <nav aria-label="Sections">${items.length ? html`<a href="#today">Today</a>` : null}<a href="#compounds">Compounds</a><a href="#sites">Injection sites</a><a href="#guide">Guide</a><a href="#box">In the box</a><a href="#faq">FAQ</a><a href="#build">Build and export</a></nav>
  </div></header>`;
}

function Footer() {
  return html`<footer class="foot screen"><div class="wrap" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(min(240px,100%),1fr));gap:32px">
    <div class="stack g16"><img src="assets/brand/wordmark-light.svg" alt="World Peptide Dosage Association" style="height:32px;width:auto;align-self:flex-start" /><p>Independent dosage and handling reference for research peptides. Not affiliated with any regulatory body.</p></div>
    <div class="stack g8"><div class="lbl" style="color:rgba(255,255,255,.6)">Support</div><a href=${'mailto:' + CONTACT}>${CONTACT}</a><a href="https://stayoptml.com/" target="_blank" rel="noopener">stayoptml.com</a></div>
    <div class="stack g8"><div class="lbl" style="color:rgba(255,255,255,.6)">On this page</div><a href="#compounds">Compounds</a><a href="#sites">Injection sites</a><a href="#guide">Guide</a><a href="#build">Build and export</a></div>
    <p class="tiny" style="grid-column:1/-1;border-top:1px solid rgba(255,255,255,.14);padding-top:20px;color:rgba(255,255,255,.6)">${DISCLAIMER} All compounds referenced are supplied for research use.</p>
  </div></footer>`;
}

function App() {
  const [st, setSt] = useState(loadState);
  const set = patch => setSt(s => Object.assign({}, s, typeof patch === 'function' ? patch(s) : patch));
  const items = planItems(st);
  const [hasPrev, setHasPrev] = useState(() => { try { return !!localStorage.getItem('wpda-hub-prev'); } catch (e) { return false; } });

  useEffect(() => {
    if (st.shared) {
      try {
        const raw = localStorage.getItem(STORE_KEY);
        if (raw) { const prev = JSON.parse(raw); if (prev.planId && prev.planId !== st.planId && prev.order && prev.order.length) { localStorage.setItem('wpda-hub-prev', raw); setHasPrev(true); } }
        history.replaceState(null, '', location.pathname + location.search);
      } catch (e) {}
      setTimeout(() => { const el = document.getElementById('today') || document.getElementById('build'); if (el) el.scrollIntoView({ block: 'start' }); }, 120);
    }
  }, []);
  useEffect(() => {
    try { const o = {}; PERSIST.forEach(k => { o[k] = st[k]; }); localStorage.setItem(STORE_KEY, JSON.stringify(o)); } catch (e) {}
  }, PERSIST.map(k => st[k]));
  useEffect(() => { document.body.classList.toggle('has-tray', items.length > 0); }, [items.length]);
  useEffect(() => { const h = () => set({ sheet: null }); window.addEventListener('beforeprint', h); return () => window.removeEventListener('beforeprint', h); }, []);

  const act = {
    add: id => set(s => {
      if (id === 'stack') {
        const ids = ['reta', 'tesa', 'mots', 'klow'];
        const w = s.bac.stack || BAC_BASE;
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
  const goSite = key => { set({ sheet: null, site: key, view: 'front' }); setTimeout(() => { const el = document.getElementById('sites'); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 80); };

  return html`<${Header} items=${items} />
    <main class="screen" id="main">
      <${Hero} items=${items} />
      ${items.length ? html`<${Tracker} st=${st} set=${set} items=${items} />` : null}
      <${Catalogue} st=${st} set=${set} add=${act.add} />
      <${BoxSection} />
      <${BodyMap} st=${st} set=${set} />
      <${Guide} st=${st} set=${set} />
      <${SuppliesFaq} />
      <${Builder} st=${st} set=${set} items=${items} act=${act} />
    </main>
    <${Doc} st=${st} items=${items} />
    <${Footer} />
    <${Sheet} st=${st} set=${set} add=${act.add} goSite=${goSite} />
    ${items.length ? html`<div class="tray screen" role="region" aria-label="Your plan"><span>${items.length} in your plan · ${items.map(i => i.name).join(', ')}</span><a class="btn sm on-dark" href="#build">Build and export</a></div>` : null}`;
}

render(html`<${App} />`, document.getElementById('app'));
