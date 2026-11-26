// ================= Builder: plan details, compound editors, titration, sharing =================

function TitrationEditor({ m, onChange }) {
  const L = computeLadder(m);
  const unitLbl = m.unit === 'iu' ? 'IU' : 'mg';
  const setStep = (i, patch) => onChange({ steps: m.steps.map((s, j) => j === i ? Object.assign({}, s, patch) : s) });
  const addStep = () => { const last = m.steps[m.steps.length - 1] || { weeks: '4', weekly: '', freq: '1' }; onChange({ steps: m.steps.concat([{ weeks: '4', weekly: last.weekly, freq: last.freq }]) }); };
  const delStep = i => onChange({ steps: m.steps.filter((_, j) => j !== i) });
  return html`<div class="stack g10">
    <div class="row g8" style="justify-content:space-between"><div class="lbl">Titration · weekly dose by phase</div><span class="tiny muted">${L.totalWeeks ? L.totalWeeks + ' weeks planned' + (L.vialsNeeded ? ' · ' + L.vialsNeeded + ' vial' + (L.vialsNeeded === 1 ? '' : 's') : '') : 'Last phase ongoing'}</span></div>
    ${m.steps.map((s, i) => { const r = L.rows[i]; return html`<div class="tstep">
      <div class="row g8"><b style="color:var(--ink);font-size:14px">Phase ${i + 1}</b><span class="tiny muted grow">${r ? r.label : ''}</span>
        ${m.steps.length > 1 ? html`<button type="button" class="iconbtn sm" aria-label=${'Remove phase ' + (i + 1)} onClick=${() => delStep(i)}><${Icon} name="close" size=${16} /></button>` : null}</div>
      <div class="tgrid">
        <label class="field"><span>Weeks</span><input class="input" inputmode="numeric" placeholder="Ongoing" value=${s.weeks} onInput=${e => setStep(i, { weeks: e.target.value.replace(/[^\d]/g, '') })} /></label>
        <label class="field"><span>Weekly dose (${unitLbl})</span><input class="input" inputmode="decimal" placeholder=${m.unit === 'iu' ? '1500' : '2'} value=${s.weekly} onInput=${e => setStep(i, { weekly: e.target.value })} /></label>
        <label class="field"><span>How often</span><select class="select" value=${s.freq} onChange=${e => setStep(i, { freq: e.target.value })}>${FREQS.map(f => html`<option value=${f.v}>${f.label}</option>`)}</select></label>
      </div>
      ${r && r.units !== null ? html`<div class="row g12" style="align-items:center"><div class="out grow">${r.perText} per injection · draw <b>${r.draw}</b></div></div><${Syringe} units=${r.units} small />` : html`<div class="tiny muted">Enter a weekly dose to see the draw.</div>`}
      ${r && r.warn ? html`<div class="warn">${r.warn}</div>` : null}
    </div>`; })}
    <div><button type="button" class="btn outline sm" onClick=${addStep}><${Icon} name="plus" size=${16} /> Add phase</button></div>
  </div>`;
}

function ModelFields({ m, onChange, isCustom }) {
  const wNum = num(m.water);
  return html`<div class="stack g16">
    ${isCustom ? html`<label class="field"><span>Compound name</span><input class="input" placeholder="e.g. Ipamorelin 5mg" value=${m.name} onInput=${e => onChange({ name: e.target.value })} /></label>` : null}
    <div class="fgrid">
      <div class="field"><span>Vial strength</span><div class="row g8"><input class="input grow" inputmode="decimal" aria-label="Vial strength" value=${m.vial} onInput=${e => onChange({ vial: e.target.value })} />
        <select class="select" style="width:96px" aria-label="Unit" value=${m.unit} onChange=${e => onChange({ unit: e.target.value })}><option value="mg">mg</option><option value="iu">IU</option></select></div></div>
      <div class="field"><span>Bac water added (ml)</span><div class="row g6 wrapx">${BAC_OPTIONS.map(v => html`<button type="button" class="pill" aria-pressed=${String(wNum === v)} onClick=${() => onChange({ water: String(v) })}>${v}ml</button>`)}
        <input class="input" style="width:84px" inputmode="decimal" aria-label="Other water volume (ml)" value=${m.water} onInput=${e => onChange({ water: e.target.value })} /></div></div>
      <label class="field"><span>Time of day</span><select class="select" value=${m.when} onChange=${e => onChange({ when: e.target.value })}>${WHENS.map(w => html`<option value=${w[0]}>${w[1]}</option>`)}</select></label>
      <label class="field"><span>Injection site</span><select class="select" value=${m.site} onChange=${e => onChange({ site: e.target.value })}>${SITES.map(s => html`<option value=${s}>${s}</option>`)}</select></label>
    </div>
    ${computeLadder(m).conc ? html`<div class="okbox">${fmtAmt(num(m.vial), m.unit === 'iu' ? 'iu' : 'mg')} + ${m.water}ml water = <b>${computeLadder(m).conc}</b></div>` : null}
    <${TitrationEditor} m=${m} onChange=${onChange} />
  </div>`;
}

function ItemEditor({ it, st, set, act }) {
  const open = st.openItem === it.key;
  const p = it.p;
  const w1 = it.week(1) || {};
  const summary = [it.vial && (it.vialLabel === 'Vial' ? it.vial + ' vial' : it.vial), it.water ? trimNum(it.water, 2) + 'ml water' : null, w1.dose && w1.dose !== '—' ? 'starts ' + w1.dose + (unitsOf(w1.draw) !== null ? ' → draw ' + String(w1.draw).split(' · ')[0] : '') : null].filter(Boolean).join(' · ');
  return html`<div class="item" style=${'--tint:' + GOAL_TINT[it.goal]}>
    <div class="ihead">
      ${it.icon ? html`<img src=${it.icon} alt="" />` : html`<span class="av">${initials(it.name)}</span>`}
      <button type="button" class="grow" style="background:none;border:0;padding:0;text-align:left;cursor:pointer;min-width:0" aria-expanded=${String(open)} onClick=${() => set({ openItem: open ? null : it.key })}>
        <div style="font-weight:700;color:var(--ink);font-size:17px">${it.kind === 'custom' ? (it.model.name || 'New custom compound') : it.name}${it.kind === 'own' ? html` <span class="chip" style="font-size:10px;padding:3px 8px;vertical-align:2px">Own titration</span>` : null}</div>
        <div class="tiny muted" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${summary || 'Tap to set up'}</div></button>
      <button type="button" class="iconbtn sm" aria-label=${(open ? 'Collapse ' : 'Edit ') + it.name} onClick=${() => set({ openItem: open ? null : it.key })}><span style=${'display:inline-flex;transform:rotate(' + (open ? 90 : 0) + 'deg);transition:transform .15s'}><${Icon} name="arrow" size=${16} /></span></button>
      <button type="button" class="iconbtn sm" aria-label=${'Remove ' + it.name + ' from the plan'} onClick=${() => act.remove(it.key)}><${Icon} name="trash" size=${16} /></button>
    </div>
    ${open ? html`<div class="ibody">
      ${p && !it.oral ? html`<div class="seg" role="group" aria-label="Dosing"><button type="button" aria-pressed=${String(it.kind !== 'own')} onClick=${() => act.own(p.id, false)}>Standard ladder</button><button type="button" aria-pressed=${String(it.kind === 'own')} onClick=${() => act.own(p.id, true)}>My own titration</button></div>` : null}
      ${it.kind === 'listed' ? html`
        ${p.sizes ? html`<div class="stack g8"><div class="small" style="font-weight:600;color:var(--ink)">Vial size</div><${Pills} label="Vial size" value=${it.sizeIdx} options=${p.sizes.map((s, i) => ({ v: i, label: s }))} onPick=${i => set(s => ({ sizeIdx: Object.assign({}, s.sizeIdx, { [p.id]: i }) }))} /></div>` : null}
        ${it.bacOk ? html`<div class="stack g8"><div class="small" style="font-weight:600;color:var(--ink)">Bac water added</div><${Pills} label="Bac water" value=${it.bac} options=${BAC_OPTIONS.map(v => ({ v, label: v + 'ml' }))} onPick=${v => set(s => ({ bac: Object.assign({}, s.bac, { [p.id]: v }) }))} /></div>` : null}
        ${it.conc ? html`<div class="okbox">${it.vial} + ${trimNum(it.water, 2)}ml water = <b>${it.conc}</b></div>` : null}
        ${protocolSupply(it).durText ? html`<div class="small" style="color:var(--ink);font-weight:600">Full protocol: ${protocolSupply(it).line}</div>` : null}
        <${Ladder} rows=${it.rows} syringes=${!it.oral} />` : null}
      ${it.kind === 'own' ? html`<${ModelFields} m=${it.model} onChange=${patch => act.model(it.key, patch)} />` : null}
      ${it.kind === 'custom' ? html`<${ModelFields} m=${it.model} isCustom onChange=${patch => act.model(it.key, patch)} />` : null}
      <label class="field"><span>Notes for this compound (shown in the export)</span><textarea class="textarea" placeholder="e.g. Take with food if nauseous. Check in after week 4." value=${st.inotes[it.key] || ''} onInput=${e => { const v = e.target.value; set(s => ({ inotes: Object.assign({}, s.inotes, { [it.key]: v }) })); }}></textarea></label>
    </div>` : null}
  </div>`;
}

function planLink(st) {
  return location.origin + location.pathname + '#plan=' + encodePlan(planPayload(st));
}

function Builder({ st, set, items, act }) {
  const [copied, setCopied] = useState('');
  const [confirmClear, setConfirmClear] = useState(false);
  const link = items.length ? planLink(st) : '';
  const injPerWeek = items.reduce((a, it) => { const w = it.week(1); return a + (it.oral || !w ? 0 : w.days.length * (w.perDay || 1)); }, 0);
  const shareText = (st.client ? st.client + ', here' : 'Here') + ' is your protocol' + (st.by ? ' from ' + st.by : '') + '. Open it to see your doses, mixing and injection guide, and a daily tracker:';
  const copy = () => {
    const done = () => { setCopied('Link copied'); setTimeout(() => setCopied(''), 2200); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(link).then(done, () => setCopied('Select and copy the link below'));
    else setCopied('Select and copy the link below');
  };
  const share = () => { if (navigator.share) navigator.share({ title: 'Your protocol · WPDA', text: shareText, url: link }).catch(() => {}); else copy(); };
  return html`<section class="blk" id="build" aria-labelledby="h-build"><div class="wrap">
    <div class="sec-head"><h2 id="h-build">Build a protocol in three steps</h2>
      <p class="lead">Pick from the range or add anything that is not on the list, set weekly doses and titrations, then export a client-ready PDF or send a link with a built-in daily tracker.</p></div>
    ${st.shared ? html`<div class="banner"><b style="color:var(--ink);font-size:17px">${st.client ? 'Protocol for ' + st.client : 'A protocol was shared with you'}${st.by ? ' · prepared by ' + st.by : ''}</b>
      <p class="small">Everything below is your plan. Your daily tracker is at the top of the page, and you can export the full PDF guide any time.</p>
      <div class="row g8 wrapx"><button type="button" class="btn sm" onClick=${() => window.print()}><${Icon} name="print" size=${16} /> Export PDF</button><a class="btn sm outline" href="#/plan">Open my tracker</a>
      ${act.hasPrev ? html`<button type="button" class="btn sm ghost" onClick=${act.restorePrev}>Restore my previous draft</button>` : null}</div></div>` : null}

    <div class="bstep"><span class="n">1</span><div class="stack g12"><div><h3>Who it is for</h3><p class="small muted">Appears on the cover of the PDF and in the shared link.</p></div>
      <div class="fgrid">
        <label class="field"><span>Client name</span><input class="input" autocomplete="off" placeholder="e.g. Sarah M" value=${st.client} onInput=${e => set({ client: e.target.value })} /></label>
        <label class="field"><span>Prepared by</span><input class="input" placeholder="Your name or clinic" value=${st.by} onInput=${e => set({ by: e.target.value })} /></label>
        <label class="field"><span>Start date</span><input class="input" type="date" value=${st.start} onInput=${e => set({ start: e.target.value })} /></label>
      </div>
      <label class="field"><span>Notes for the client</span><textarea class="textarea" placeholder="Goals, check-in dates, bloodwork reminders, anything they should know." value=${st.notes} onInput=${e => set({ notes: e.target.value })}></textarea></label>
    </div></div>

    <div class="bstep"><span class="n">2</span><div class="stack g16"><div><h3>Compounds and doses</h3><p class="small muted">Tap to add from the range. Switch any compound to your own titration, or add one that is not on the list.</p></div>
      <div class="picker" role="group" aria-label="Add compounds from the range">${PRODUCTS.map(p => { const on = st.order.indexOf(p.id) > -1; return html`<button type="button" class="pill" aria-pressed=${String(on)} onClick=${() => act.add(p.id)}><img src=${GOAL_ICONS[p.goal]} alt="" />${p.name}</button>`; })}</div>
      <div class="row g8 wrapx"><button type="button" class="btn outline" onClick=${act.addCustom}><${Icon} name="plus" size=${16} /> Add a compound not on the list</button>
        <button type="button" class="btn ghost" onClick=${() => act.add('stack')}>Add the metabolic recomp stack</button></div>
      ${items.length ? html`<div class="stack g10">${items.map(it => html`<${ItemEditor} key=${it.key} it=${it} st=${st} set=${set} act=${act} />`)}</div>`
        : html`<div class="empty">Nothing in the plan yet. Tap a compound above, add one from the catalogue, or add a custom compound.</div>`}
    </div></div>

    <div class="bstep"><span class="n">3</span><div class="stack g16"><div><h3>Export and share</h3><p class="small muted">The PDF includes the plan, a four-week tracker, a supplies list and the full mixing and injection guide. The link opens this page with the plan loaded and a daily tracker.</p></div>
      ${items.length ? html`<div class="summary"><span>${items.length} compound${items.length === 1 ? '' : 's'}</span><span>${injPerWeek} injection${injPerWeek === 1 ? '' : 's'} a week to start</span>${st.start ? html`<span>Starts ${fmtDay(parseDay(st.start))}</span>` : html`<span style="background:var(--warn-soft);color:var(--warn-text)">Add a start date for a dated tracker</span>`}</div>` : null}
      <div class="row g8 wrapx">
        <button type="button" class="btn" disabled=${!items.length} onClick=${() => window.print()}><${Icon} name="print" size=${16} /> Export PDF</button>
        <button type="button" class="btn outline" disabled=${!items.length} onClick=${share}><${Icon} name="link" size=${16} /> Share link</button>
        <button type="button" class="btn ghost" disabled=${!items.length} onClick=${copy}>${copied || 'Copy link'}</button>
        <button type="button" class="btn ghost" disabled=${!items.length} aria-pressed=${String(st.preview)} onClick=${() => set({ preview: !st.preview })}><${Icon} name="eye" size=${16} /> ${st.preview ? 'Hide preview' : 'Preview document'}</button>
      </div>
      ${items.length ? html`<div class="row g8 wrapx">
        <a class="btn sm soft" href=${'https://wa.me/?text=' + encodeURIComponent(shareText + ' ' + link)} target="_blank" rel="noopener">WhatsApp</a>
        <a class="btn sm soft" href=${'sms:?&body=' + encodeURIComponent(shareText + ' ' + link)}>Text message</a>
        <a class="btn sm soft" href=${'mailto:?subject=' + encodeURIComponent('Your protocol') + '&body=' + encodeURIComponent(shareText + '\n\n' + link)}>Email</a>
      </div>` : null}
      ${copied && copied.startsWith('Select') ? html`<input class="input" readonly value=${link} onFocus=${e => e.target.select()} aria-label="Shareable link" />` : null}
      <p class="tiny muted">On a phone, choose "Save as PDF" in the print screen. Plans save automatically in this browser.</p>
      ${items.length ? html`<div>${confirmClear ? html`<div class="row g8 wrapx"><span class="small">Clear every compound and detail?</span><button type="button" class="btn sm danger outline" onClick=${() => { act.clear(); setConfirmClear(false); }}>Yes, clear the plan</button><button type="button" class="btn sm ghost" onClick=${() => setConfirmClear(false)}>Keep it</button></div>`
        : html`<button type="button" class="btn sm ghost danger" onClick=${() => setConfirmClear(true)}><${Icon} name="trash" size=${16} /> Clear plan</button>`}</div>` : null}
    </div></div>
  </div></section>`;
}
