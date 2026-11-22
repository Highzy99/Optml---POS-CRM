// ================= Export document (screen preview + print/PDF) =================

function weekDates(st) {
  const s = parseDay(st.start);
  return wk => Array.from({ length: 7 }, (_, i) => s ? addDays(s, (wk - 1) * 7 + i) : null);
}

function supplyPlan(items) {
  // First four weeks: injections, vials, water.
  let injections = 0, vials = 0, water = 0;
  const lines = items.map(it => {
    if (it.oral) return { it, inj: 0, vials: null };
    let inj = 0, amount = 0, amountKnown = true;
    for (let wk = 1; wk <= 4; wk++) {
      const w = it.week(wk);
      if (!w) continue;
      const n = w.days.length * (w.perDay || 1);
      inj += n;
      if (w.weekly > 0) amount += w.weekly; else amountKnown = false;
    }
    const vialAmt = it.kind === 'listed' ? (vialStrength(it.p, it.sizeIdx || 0) || {}).v : num(it.model && it.model.vial);
    const nv = amountKnown && vialAmt > 0 ? Math.max(1, Math.ceil(amount / vialAmt - 1e-9)) : 1;
    injections += inj; vials += nv; water += nv * (it.water || 0);
    return { it, inj, vials: nv };
  });
  return { lines, injections, vials, water, syringes: injections + vials, swabs: injections + vials * 2 };
}

function DocSyringeRow({ label, units }) {
  return html`<div class="stack g4" style="max-width:340px"><div class="tiny" style="font-weight:600;color:var(--ink)">${label}</div><${Syringe} units=${units} /><div class="syr-scale"><span>0</span><span>25</span><span>50</span><span>75</span><span>100</span></div></div>`;
}

function Doc({ st, items }) {
  if (!items.length) return null;
  const generated = new Date();
  const start = parseDay(st.start);
  const dates = weekDates(st);
  const sup = supplyPlan(items);
  const title = st.client ? 'Protocol for ' + st.client : 'Your protocol';
  const groups = WHENS.map(w => ({ key: w[0], label: w[1], items: items.filter(i => i.when === w[0]) })).filter(g => g.items.length);
  const firstDraw = it => { const w = it.week(1); return w ? w.draw : ''; };
  const dayHead = (wk, i) => { const d = dates(wk)[i]; return d ? DOW[d.getDay()] + ' ' + d.getDate() : 'Day ' + ((wk - 1) * 7 + i + 1); };
  return html`<div class=${'doc' + (st.preview ? ' show' : '')} aria-label="Protocol document preview"><div class="wrap"><div class="paper">

    <div class="dpage">
      <div class="cover">
        <div class="row g12" style="justify-content:space-between"><img src="assets/brand/wordmark-dark.svg" alt="World Peptide Dosage Association" style="height:30px;width:auto" /><img src="assets/brand/label-circle.png" alt="" style="width:64px;height:64px" /></div>
        <div class="stack g8"><div class="lbl">Peptide protocol</div><h1>${title}</h1>
          <div class="dmeta">${st.by ? html`<span><b>Prepared by</b> ${st.by}</span>` : null}<span><b>Starts</b> ${start ? fmtLong(start) : 'on the day you choose'}</span><span><b>Created</b> ${fmtLong(generated)}</span></div></div>
      </div>
      <h3 class="dh3">At a glance</h3>
      <div class="tblwrap"><table class="tbl"><thead><tr><th scope="col">Compound</th><th scope="col">Vial and water</th><th scope="col">First dose</th><th scope="col">Draw</th><th scope="col">When</th></tr></thead>
        <tbody>${items.map(it => { const w = it.week(1); return html`<tr><td><b style="color:var(--ink)">${it.name}</b>${it.kind === 'own' ? html`<div class="tiny muted">Custom titration</div>` : null}</td><td>${it.oral ? it.vial : it.vial + (it.water ? ' + ' + trimNum(it.water, 2) + 'ml' : '')}</td><td>${w ? w.dose : '—'}</td><td><b style="color:var(--ink)">${w ? (unitsOf(w.draw) !== null ? String(w.draw).split(' · ')[0] : w.draw) : '—'}</b></td><td>${it.whenLabel}<div class="tiny muted">${it.freqText}</div></td></tr>`; })}</tbody></table></div>
      ${st.notes ? html`<h3 class="dh3">Notes from ${st.by || 'your practitioner'}</h3><div class="note" style="white-space:pre-line">${st.notes}</div>` : null}
      <h3 class="dh3">Your first five steps</h3>
      <ul class="checks">
        <li><span class="box"></span><span>Check your supplies against the next page. Bacteriostatic water comes free with every optml vial.</span></li>
        <li><span class="box"></span><span>Mix each vial with the volume of bac water shown for it (step-by-step guide near the end). Label it with the date.</span></li>
        <li><span class="box"></span><span>Learn to read the syringe: 100 units is 1ml, every unit is 0.01ml.</span></li>
        <li><span class="box"></span><span>First injection: ${items.filter(i => !i.oral).map(i => i.name + ' ' + firstDraw(i).split(' · ')[0]).join(', ') || 'see your plan'}${start ? ' on ' + fmtDay(start) : ''}.</span></li>
        <li><span class="box"></span><span>Tick each dose off in the four-week tracker and rotate your injection site every time.</span></li>
      </ul>
      <p class="dfoot">${DISCLAIMER}</p>
    </div>

    <div class="dpage">
      <h2 class="dh">What you need</h2><p class="dsub">Quantities cover the first four weeks.</p>
      <div class="tblwrap"><table class="tbl"><thead><tr><th scope="col">Item</th><th scope="col">How many</th><th scope="col">Notes</th></tr></thead><tbody>
        ${sup.lines.map(l => html`<tr><td><b style="color:var(--ink)">${l.it.name}</b></td><td>${l.it.oral ? 'One bottle' : l.vials + ' vial' + (l.vials === 1 ? '' : 's')}</td><td>${l.it.oral ? l.it.vial : l.it.vial + ' vial' + (l.it.vialStart ? ' · one vial lasts about ' + weeksText(l.it.vialStart) + ' at the starting dose' : '')}</td></tr>`)}
        ${sup.vials ? html`<tr><td><b style="color:var(--ink)">Bacteriostatic water</b></td><td>${sup.vials} vial${sup.vials === 1 ? '' : 's'}</td><td>Included free with every optml vial. You need ${trimNum(sup.water, 2)}ml in total.</td></tr>` : null}
        ${sup.injections ? html`<tr><td><b style="color:var(--ink)">Insulin syringes</b></td><td>About ${sup.syringes}</td><td>1ml (100 unit), 31G, 6–8mm. One per injection plus one per vial you mix.</td></tr>
        <tr><td><b style="color:var(--ink)">Alcohol swabs</b></td><td>About ${sup.swabs}</td><td>One per injection, two per vial you mix.</td></tr>
        <tr><td><b style="color:var(--ink)">Sharps container</b></td><td>1</td><td>Free from most Australian pharmacies.</td></tr>` : null}
      </tbody></table></div>
      <h3 class="dh3">Your daily rhythm</h3>
      <div class="two">${groups.map(g => html`<div class="mini"><h4>${g.label}</h4>${g.items.map(it => { const w = it.week(1); return html`<p><b style="color:var(--ink)">${it.name}</b> · ${w ? w.dose : ''}${w && unitsOf(w.draw) !== null ? ' · draw ' + String(w.draw).split(' · ')[0] : ''}<br /><span class="muted">${it.freqText}</span></p>`; })}</div>`)}</div>
      <h3 class="dh3">Week one</h3>
      <div class="tblwrap"><table class="tbl track"><thead><tr><th scope="col">Compound</th>${Array.from({ length: 7 }, (_, i) => html`<th scope="col">${dayHead(1, i)}</th>`)}</tr></thead>
        <tbody>${items.map(it => { const w = it.week(1); return html`<tr><td>${it.name}</td>${Array.from({ length: 7 }, (_, i) => w && w.days.indexOf(i) > -1 ? html`<td class="on">${w.perDay > 1 ? 'AM + PM' : '●'}</td>` : html`<td></td>`)}</tr>`; })}</tbody></table></div>
    </div>

    ${items.map(it => { const w1 = it.week(1); return html`<div class="dpage">
      <div class="row g12" style="margin-bottom:6px">${it.icon ? html`<img src=${it.icon} alt="" style="width:44px;height:44px" />` : html`<span class="av" style="width:44px;height:44px">${initials(it.name)}</span>`}
        <div><h2 class="dh" style="margin:0">${it.name}</h2><div class="dsub" style="margin:0">${it.sub}${it.kind === 'own' ? ' · custom titration' : ''}</div></div></div>
      ${it.desc ? html`<p class="small" style="margin:10px 0">${it.desc}</p>` : null}
      <dl class="kv"><div><dt>${it.vialLabel}</dt><dd>${it.vial || '—'}</dd></div>${!it.oral ? html`<div><dt>Bac water</dt><dd>${it.water ? trimNum(it.water, 2) + 'ml' : '—'}</dd></div><div><dt>Strength once mixed</dt><dd>${it.conc || '—'}</dd></div>` : null}
        <div><dt>When</dt><dd>${it.timing || it.whenLabel}</dd></div><div><dt>How often</dt><dd>${it.freqText}</dd></div><div><dt>Site</dt><dd>${it.site}</dd></div>${it.duration ? html`<div><dt>Duration</dt><dd>${it.duration}</dd></div>` : null}</dl>
      ${!it.oral && it.water ? html`<div class="note"><b style="color:var(--ink)">To mix:</b> add ${trimNum(it.water, 2)}ml of bac water slowly down the inside wall of the vial. Roll gently, never shake. Write today's date on the label and refrigerate at 2–8°C.${it.vialStart ? ' One vial lasts about ' + weeksText(it.vialStart) + ' at the starting dose' + (it.vialTop && Math.abs(it.vialTop - it.vialStart) > 0.4 ? ' and ' + weeksText(it.vialTop) + ' at the top dose.' : '.') : ''}</div>` : null}
      <h3 class="dh3">Dose plan</h3>
      <div class="tblwrap"><table class="tbl"><thead><tr>${it.headers.map(h => html`<th scope="col">${h}</th>`)}</tr></thead><tbody>${it.tableRows.map(r => html`<tr>${r.map((c, i) => html`<td>${i === r.length - 1 ? html`<b style="color:var(--ink)">${c}</b>` : c}</td>`)}</tr>`)}</tbody></table></div>
      ${it.rows.some(r => r.warn) ? html`<div class="warn" style="margin-top:10px">${it.rows.find(r => r.warn).warn}</div>` : null}
      ${!it.oral && w1 && unitsOf(w1.draw) !== null ? html`<div style="margin-top:14px"><${DocSyringeRow} label=${'Your first dose: draw to ' + String(w1.draw).split(' · ')[0]} units=${unitsOf(w1.draw)} /></div>` : null}
      ${st.inotes[it.key] ? html`<h3 class="dh3">Notes</h3><div class="note" style="white-space:pre-line">${st.inotes[it.key]}</div>` : null}
      ${it.note ? html`<div class="note" style="margin-top:10px">${it.note}</div>` : null}
    </div>`; })}

    <div class="dpage">
      <h2 class="dh">Four-week tracker</h2><p class="dsub">Tick each dose as you take it. The number is what to draw on a 1ml insulin syringe. Write the site you used underneath if it helps you rotate.</p>
      ${[1, 2, 3, 4].map(wk => html`<div class="wkblock"><h3 class="dh3">Week ${wk}${start ? ' · from ' + fmtDay(dates(wk)[0]) : ''}</h3>
        <div class="tblwrap"><table class="tbl track"><thead><tr><th scope="col">Compound</th>${Array.from({ length: 7 }, (_, i) => html`<th scope="col">${dayHead(wk, i)}</th>`)}</tr></thead>
        <tbody>${items.map(it => { const w = it.week(wk); return html`<tr><td>${it.name}</td>${Array.from({ length: 7 }, (_, i) => w && w.days.indexOf(i) > -1 ? html`<td class="on"><span class="box"></span>${w.perDay > 1 ? html`<span class="box"></span>` : null}${shortDraw(w.draw)}</td>` : html`<td></td>`)}</tr>`; })}</tbody></table></div></div>`)}
    </div>

    <div class="dpage">
      <h2 class="dh">How to mix a vial</h2><p class="dsub">Under five minutes. Do it on a clean, flat surface.</p>
      <div class="stack g8">${STEPS.map(s => html`<div class="stepc"><span class="n">${s.n}</span><div><h4>${s.title}</h4><p class="small">${s.body}</p><div class="tip">${s.tip}</div></div></div>`)}</div>
      <h3 class="dh3">Reading your syringe</h3>
      <div class="two"><div class="mini"><h4>100 units = 1ml</h4><p>Every unit is 0.01ml. "Draw 20 units" means pull the plunger until the top edge of the black stopper sits on the 20 line (0.2ml).</p></div>
        <div class="mini"><${DocSyringeRow} label="Example: 20 units" units=${20} /></div></div>
    </div>

    <div class="dpage">
      <h2 class="dh">How to inject</h2><p class="dsub">Subcutaneous: into the fat just under the skin, not the muscle.</p>
      <div class="two">${TABS.technique.map(c => html`<div class="mini"><h4>${c.title}</h4><p>${c.body}</p></div>`)}</div>
      <h3 class="dh3">Where to inject and how to rotate</h3>
      <div class="two">${['abdomen', 'flank', 'thigh', 'arm'].map(k => html`<div class="mini"><h4>${SITE_INFO[k].name} · ${SITE_INFO[k].route}</h4><p>${SITE_INFO[k].why}</p><p class="muted">Avoid: ${SITE_INFO[k].avoid}</p></div>`)}</div>
      <div class="note" style="margin-top:12px">Treat your abdomen like a clock face around the navel, at least 5cm out. Move one position clockwise every dose: eight positions brings you back to the same spot about once a week.</div>
    </div>

    <div class="dpage">
      <h2 class="dh">Storage, safety and common questions</h2>
      <div class="two">${STORAGE.map(c => html`<div class="mini"><h4>${c.title}</h4><p>${c.body}</p></div>`)}</div>
      <h3 class="dh3">Common questions</h3>
      <div class="two">${FAQS.filter((_, i) => [0, 1, 2, 3, 6].indexOf(i) > -1).map(f => html`<div class="mini"><h4>${f.q}</h4><p>${f.a}</p></div>`)}</div>
      <h3 class="dh3">Before every injection</h3>
      <ul class="checks"><li><span class="box"></span>Vial at room temperature for 10–15 minutes.</li><li><span class="box"></span>Fresh swab on the stopper, let it dry.</li><li><span class="box"></span>New 31G insulin syringe, draw to the units on your plan.</li><li><span class="box"></span>Pinch, 45°, inject slowly over 5–10 seconds.</li><li><span class="box"></span>Next site in your rotation. Sharps straight into the container.</li></ul>
      <p class="dfoot">Questions about your order: ${CONTACT}. ${DISCLAIMER} Generated by the World Peptide Dosage Association protocol hub.</p>
    </div>

  </div></div></div>`;
}
