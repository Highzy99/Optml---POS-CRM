// ================= Body map, guide, calculator, supplies, FAQ =================

const SITE_INFO = {
  abdomen: {
    name: 'Abdomen', route: 'SubQ', tag: 'Best all-round site', angle: '45° into a pinch (90° if you have more than 5cm to pinch)', needle: '29–31G · 6–8mm insulin syringe',
    why: 'The most consistent absorption of any SubQ site, easy to reach and easy to see. This is the default for almost every compound here.',
    how: ['Stay at least 5cm (two finger widths) away from the navel.', 'Pinch a 2–3cm fold between thumb and forefinger.', 'Insert in one smooth motion, release the pinch, press slowly over 5–10 seconds.', 'Move one clock position each dose (see the rotation clock).'],
    avoid: 'The 5cm circle around the navel, scars, stretch marks, bruises and the waistband line.', compounds: 'Retatrutide, Tirzepatide, Tesamorelin, MOTS-c, CJC/Ipamorelin, BPC-157 and nearly all daily peptides.'
  },
  flank: {
    name: 'Love handles (flanks)', route: 'SubQ', tag: 'Great backup to the abdomen', angle: '45° into a pinch', needle: '29–31G · 6–8mm insulin syringe',
    why: 'Usually a generous fat layer and less sensitive than the front of the abdomen. Useful when the abdomen is lean or needs a rest.',
    how: ['Use the soft area above the hip bone and below the ribs.', 'Pinch, insert at 45°, inject slowly.', 'Alternate sides each time you use it.'],
    avoid: 'Directly over the hip bone or ribs, and anywhere a belt or waistband rubs.', compounds: 'Any SubQ compound. A common choice for weekly incretin doses.'
  },
  thigh: {
    name: 'Outer thigh', route: 'SubQ or IM', tag: 'Easy to reach seated', angle: 'SubQ: 45° into a pinch · IM: 90°, skin taut', needle: 'SubQ 31G · 8mm · IM 25–27G · 25mm',
    why: 'The front-outer third of the thigh, a hand-width below the hip and a hand-width above the knee. Slightly slower SubQ absorption than the abdomen.',
    how: ['Sit down and relax the leg completely.', 'For SubQ, pinch the outer front of the thigh and inject at 45°.', 'For IM (vastus lateralis), spread the skin taut and go in at 90°.'],
    avoid: 'The inner thigh, the area just above the knee, and anywhere with visible veins.', compounds: 'Any SubQ compound when you want to rest the abdomen. IM only when a protocol calls for it.'
  },
  arm: {
    name: 'Back of upper arm', route: 'SubQ', tag: 'Best with a helper', angle: '45° into a pinch', needle: '29–31G · 6–8mm insulin syringe',
    why: 'The fatty area at the back of the arm, halfway between shoulder and elbow. Hard to pinch yourself, so it works best if someone else injects.',
    how: ['Rest the arm on a chair back or doorframe so the muscle relaxes.', 'Pinch the fat at the back of the arm, not the muscle.', 'Inject at 45° and release slowly.'],
    avoid: 'The elbow, the shoulder joint and the inner arm.', compounds: 'Any SubQ compound. Handy for a fourth site in a big rotation.'
  },
  deltoid: {
    name: 'Deltoid (shoulder)', route: 'IM', tag: 'Small-volume IM only', angle: '90°, skin taut', needle: '25–27G · 16–25mm',
    why: 'The thick part of the shoulder muscle, two to three finger widths below the bony point of the shoulder. Keep volumes to 1ml or less.',
    how: ['Let the arm hang loose and relaxed.', 'Find the bony point of the shoulder and measure three finger widths down.', 'Insert at 90° in one motion and inject slowly.'],
    avoid: 'Too high (into the joint) or too low (near the nerve that runs down the arm).', compounds: 'Only for protocols that call for intramuscular delivery. Standard peptides are SubQ.'
  },
  glute: {
    name: 'Glute (upper outer)', route: 'IM', tag: 'Largest IM site', angle: '90°, muscle relaxed', needle: '25–27G · 25–38mm',
    why: 'The upper outer quarter of the buttock holds larger volumes comfortably. Hard to reach on your own.',
    how: ['Split each buttock into four quarters. Use only the upper outer quarter.', 'Lean on a bench so the muscle is relaxed.', 'Insert at 90° and inject slowly.'],
    avoid: 'The lower and inner quarters, where the sciatic nerve runs.', compounds: 'IM-only protocols. Not needed for standard SubQ peptides.'
  }
};
const SITE_ORDER = ['abdomen', 'flank', 'thigh', 'arm', 'deltoid', 'glute'];

const SKIN = 'url(#skinG)', SKIN_EDGE = '#cdd1d8';
function Figure({ back }) {
  const limb = (x1, y1, x2, y2, w) => html`<line x1=${x1} y1=${y1} x2=${x2} y2=${y2} stroke=${SKIN} stroke-width=${w} stroke-linecap="round" />`;
  return html`<g aria-hidden="true">
    <defs><linearGradient id="skinG" gradientUnits="userSpaceOnUse" x1="40" y1="0" x2="210" y2="520"><stop offset="0" stop-color="#eef0f4" /><stop offset=".55" stop-color="#e3e6eb" /><stop offset="1" stop-color="#d9dde3" /></linearGradient></defs>
    ${limb(66, 116, 46, 214, 30)}${limb(174, 116, 194, 214, 30)}
    ${limb(46, 214, 36, 304, 24)}${limb(194, 214, 204, 304, 24)}
    <circle cx="33" cy="322" r="13" fill=${SKIN} /><circle cx="207" cy="322" r="13" fill=${SKIN} />
    ${limb(98, 300, 94, 408, 48)}${limb(142, 300, 146, 408, 48)}
    ${limb(94, 408, 96, 492, 34)}${limb(146, 408, 144, 492, 34)}
    <ellipse cx="94" cy="506" rx="20" ry="9" fill=${SKIN} /><ellipse cx="146" cy="506" rx="20" ry="9" fill=${SKIN} />
    <path d="M64 108 Q120 92 176 108 Q190 116 186 140 L170 236 Q168 258 176 290 Q178 318 150 324 L90 324 Q62 318 64 290 Q72 258 70 236 L54 140 Q50 116 64 108 Z" fill=${SKIN} />
    <rect x="106" y="78" width="28" height="30" rx="12" fill=${SKIN} />
    <ellipse cx="120" cy="50" rx="28" ry="33" fill=${SKIN} />
    ${back ? html`<path d="M120 112 L120 300" stroke=${SKIN_EDGE} stroke-width="2" /><path d="M96 296 Q120 312 144 296" stroke=${SKIN_EDGE} stroke-width="2" fill="none" />`
      : html`<circle cx="120" cy="236" r="3.5" fill=${SKIN_EDGE} /><path d="M88 150 Q104 160 118 152 M122 152 Q136 160 152 150" stroke=${SKIN_EDGE} stroke-width="2" fill="none" />`}
  </g>`;
}

const ZONES = {
  front: [
    { id: 'abdomen', shapes: [['e', 120, 236, 38, 26]], label: [120, 236] },
    { id: 'flank', shapes: [['e', 78, 244, 9, 24], ['e', 162, 244, 9, 24]], label: [162, 244] },
    { id: 'thigh', shapes: [['e', 86, 360, 15, 36], ['e', 154, 360, 15, 36]], label: [154, 360] },
    { id: 'deltoid', shapes: [['e', 64, 124, 13, 15], ['e', 176, 124, 13, 15]], label: [176, 124] }
  ],
  back: [
    { id: 'arm', shapes: [['e', 52, 172, 11, 24], ['e', 188, 172, 11, 24]], label: [188, 172] },
    { id: 'flank', shapes: [['e', 80, 250, 11, 22], ['e', 160, 250, 11, 22]], label: [160, 250] },
    { id: 'glute', shapes: [['e', 98, 296, 17, 15], ['e', 142, 296, 17, 15]], label: [142, 296] },
    { id: 'deltoid', shapes: [['e', 64, 124, 13, 15], ['e', 176, 124, 13, 15]], label: [176, 124] }
  ]
};

function BodyMap({ st, set, bare }) {
  const sel = st.site;
  const zones = ZONES[st.view];
  const info = SITE_INFO[sel];
  const pick = id => set({ site: id });
  const ordinal = id => SITE_ORDER.indexOf(id) + 1;
  const body = html`
    <div class="panel" style="padding:clamp(16px,4vw,28px);display:grid;grid-template-columns:repeat(auto-fit,minmax(min(300px,100%),1fr));gap:24px;align-items:start">
      <div class="stack g12" style="align-items:center">
        <div class="seg" role="group" aria-label="Body view"><button type="button" aria-pressed=${String(st.view === 'front')} onClick=${() => set({ view: 'front', site: st.view === 'front' ? sel : 'abdomen' })}>Front</button><button type="button" aria-pressed=${String(st.view === 'back')} onClick=${() => set({ view: 'back', site: st.view === 'back' ? sel : 'arm' })}>Back</button></div>
        <svg viewBox="0 0 240 520" style="width:min(260px, 52vw);height:auto;display:block" role="group" aria-label=${'Body map, ' + st.view + ' view'}>
          <${Figure} back=${st.view === 'back'} />
          ${zones.map(z => { const on = z.id === sel; const info2 = SITE_INFO[z.id];
            return html`<g role="button" tabindex="0" aria-pressed=${String(on)} aria-label=${info2.name + ', ' + info2.route} style="cursor:pointer;outline:none"
              onClick=${() => pick(z.id)} onKeyDown=${e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(z.id); } }}>
              ${z.shapes.map(s => html`<ellipse cx=${s[1]} cy=${s[2]} rx=${s[3] + 6} ry=${s[4] + 6} fill="transparent" />`)}
              ${z.shapes.map(s => html`<ellipse cx=${s[1]} cy=${s[2]} rx=${s[3]} ry=${s[4]} fill=${on ? '#222326' : info2.route === 'IM' ? 'rgba(31,76,187,.22)' : 'rgba(47,143,78,.25)'} stroke=${on ? '#222326' : info2.route === 'IM' ? '#1f4cbb' : '#2f8f4e'} stroke-width="1.5" stroke-dasharray=${info2.route === 'IM' ? '4 3' : ''} />`)}
              <circle cx=${z.label[0] + (z.label[0] > 150 ? 22 : 0)} cy=${z.label[1] - (z.label[0] > 150 ? 0 : 0)} r="10" fill=${on ? '#ffffff' : '#222326'} stroke="#222326" stroke-width="1.5" />
              <text x=${z.label[0] + (z.label[0] > 150 ? 22 : 0)} y=${z.label[1] + 4} text-anchor="middle" style=${'font:700 11px Onest,sans-serif;fill:' + (on ? '#222326' : '#fff')}>${ordinal(z.id)}</text>
            </g>`; })}
          ${st.view === 'front' && sel === 'abdomen' ? html`<circle cx="120" cy="236" r="13" fill="none" stroke="#c8433f" stroke-width="1.5" stroke-dasharray="3 3" />` : null}
        </svg>
        <div class="row g16 wrapx tiny" style="justify-content:center">
          <span class="row g6"><span style="width:14px;height:14px;border-radius:50%;background:rgba(47,143,78,.25);border:1.5px solid #2f8f4e"></span>SubQ</span>
          <span class="row g6"><span style="width:14px;height:14px;border-radius:50%;background:rgba(31,76,187,.22);border:1.5px dashed #1f4cbb"></span>IM</span>
          ${st.view === 'front' ? html`<span class="row g6"><span style="width:14px;height:14px;border-radius:50%;border:1.5px dashed #c8433f"></span>Keep clear of the navel</span>` : null}
        </div>
        <div class="pills" style="justify-content:center" role="group" aria-label="All sites">
          ${SITE_ORDER.map(id => html`<button type="button" class="pill" style="min-height:36px;font-size:13px" aria-pressed=${String(sel === id)} onClick=${() => set({ site: id, view: ZONES.front.some(z => z.id === id) ? (st.view === 'back' && ZONES.back.some(z => z.id === id) ? 'back' : 'front') : 'back' })}>${ordinal(id)} · ${SITE_INFO[id].name}</button>`)}
        </div>
      </div>
      <div class="card" style="padding:clamp(18px,4vw,24px);display:flex;flex-direction:column;gap:14px" aria-live="polite">
        <div class="row g8 wrapx"><span class=${'chip ' + (info.route === 'IM' ? '' : 'dark')} style=${info.route === 'IM' ? 'background:var(--info-soft);color:var(--info)' : ''}>${info.route}</span><span class="tiny muted">${info.tag}</span></div>
        <h3 style="font-size:26px">${info.name}</h3>
        <p>${info.why}</p>
        <dl class="facts4" style="grid-template-columns:1fr 1fr;margin:0"><div class="fact"><dt>Angle</dt><dd>${info.angle}</dd></div><div class="fact"><dt>Needle</dt><dd>${info.needle}</dd></div></dl>
        <div class="stack g8"><div class="lbl">How to</div><ol style="margin:0;padding-left:20px;display:flex;flex-direction:column;gap:6px">${info.how.map(h => html`<li>${h}</li>`)}</ol></div>
        <div class="warn"><b>Avoid:</b> ${info.avoid}</div>
        <div class="small"><b style="color:var(--ink)">Used for:</b> ${info.compounds}</div>
      </div>
    </div>
    <div class="visual">
      <div class="stack g10"><div class="lbl">Rotation</div><h3>Treat your abdomen like a clock face.</h3>
        <p>Start at position one and move one place clockwise every dose. Eight positions brings you back to the same spot about once a week, long enough for the tissue to recover and never long enough to build scarring. Add the flanks and thighs when you inject more than once a day.</p></div>
      <svg viewBox="0 0 220 220" style="width:100%;max-width:240px;height:auto;display:block;justify-self:center" role="img" aria-label="Eight injection positions around the navel, numbered clockwise">
        <circle cx="110" cy="110" r="96" fill="#fff" stroke="#e0e2e6" stroke-width="2" /><circle cx="110" cy="110" r="66" fill="none" stroke="#cfd2d7" stroke-width="1.5" stroke-dasharray="5 6" />
        <circle cx="110" cy="110" r="22" fill="none" stroke="#c8433f" stroke-width="1.5" stroke-dasharray="3 3" /><circle cx="110" cy="110" r="6" fill="#e0e2e6" />
        ${[[110, 44], [157, 63], [176, 110], [157, 157], [110, 176], [63, 157], [44, 110], [63, 63]].map((c, i) => html`<circle cx=${c[0]} cy=${c[1]} r="16" fill="#222326" /><text x=${c[0]} y=${c[1] + 5} text-anchor="middle" style="font:600 14px Onest,sans-serif;fill:#fff">${i + 1}</text>`)}
      </svg>
    </div>`;
  if (bare) return body;
  return html`<section class="blk" id="sites"><div class="wrap">${body}</div></section>`;
}

// ---------- Guide ----------

const CHAPTERS = [
  { key: 'mix', title: 'Mix', h: 'Mix a vial', p: 'Under five minutes, using the bac water that comes in the box.' },
  { key: 'measure', title: 'Measure', h: 'Read the syringe and calculate a dose', p: 'One unit on an insulin syringe is 0.01ml. The calculator turns any vial and dose into units.' },
  { key: 'inject', title: 'Inject', h: 'Inject cleanly and calmly', p: 'Nearly every compound here goes just under the skin (subcutaneous), not into muscle.' },
  { key: 'sites', title: 'Sites', h: 'Where to inject', p: 'Tap a highlighted area for the angle, the needle and what to avoid.' },
  { key: 'store', title: 'Store', h: 'Storage and sharps', p: 'Heat, light and freeze-thaw cycles degrade peptides. Sharps never go in the bin.' },
  { key: 'faq', title: 'FAQ', h: 'Supplies and common questions', p: 'What you need on hand, and the questions people ask most.' }
];

function Calculator({ st, set }) {
  const c = st.calc;
  const up = patch => set(s => ({ calc: Object.assign({}, s.calc, patch) }));
  const strength = num(c.strength), water = num(c.water), dose = num(c.dose);
  const valid = strength > 0 && water > 0 && dose > 0;
  const conc = valid ? strength / water : 0;
  const units = valid ? dose / conc * 100 : null;
  return html`<div class="calc" id="calc">
    <div class="stack g16">
      <div><h3 style="font-size:24px">Dose calculator</h3><p class="small muted" style="margin-top:4px">Enter the vial strength, the water you added and your dose. Use the same unit (mg or IU) for strength and dose.</p></div>
      <label class="field"><span>Vial strength (mg or IU)</span><input class="input" inputmode="decimal" value=${c.strength} onInput=${e => up({ strength: e.target.value })} placeholder="10" /></label>
      <div class="field"><span>Bac water added (ml)</span>
        <div class="row g8 wrapx">${BAC_OPTIONS.map(v => html`<button type="button" class="pill" aria-pressed=${String(num(c.water) === v)} onClick=${() => up({ water: String(v) })}>${v}ml</button>`)}
          <input class="input" style="width:110px" inputmode="decimal" aria-label="Other water volume in ml" value=${c.water} onInput=${e => up({ water: e.target.value })} /></div></div>
      <label class="field"><span>Your dose (mg or IU)</span><input class="input" inputmode="decimal" value=${c.dose} onInput=${e => up({ dose: e.target.value })} placeholder="0.25" /><small>Working in mcg? Divide by 1,000: 250mcg is 0.25mg.</small></label>
    </div>
    <div class="out">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:18px">
        <div><div class="lbl">Units to draw</div><div class="big">${valid ? fmtUnits(units) : '—'}</div></div>
        <div><div class="lbl">Volume</div><div class="big">${valid ? fmtMl(parseFloat(fmtUnits(units)) / 100) + 'ml' : '—'}</div></div>
        <div><div class="lbl">Concentration</div><div style="font-size:17px;font-weight:600;color:var(--ink)">${valid ? trimNum(conc, 3) + ' per ml' : '—'}</div></div>
        <div><div class="lbl">Doses per vial</div><div style="font-size:17px;font-weight:600;color:var(--ink)">${valid ? Math.floor(strength / dose + 1e-9) : '—'}</div></div>
      </div>
      <div><${Syringe} units=${units} /><div class="syr-scale"><span>0</span><span>25</span><span>50</span><span>75</span><span>100</span></div></div>
      <div class=${valid && units > 100 ? 'warn' : 'small muted'}>${valid ? (units > 100 ? 'That is more than one full 1ml syringe. Split it into two draws or use less bac water.' : units < 2 ? 'That is a tiny draw and hard to measure accurately. Add more bac water so each dose is bigger.' : 'Draw to the ' + fmtUnits(units) + ' unit mark on a 1ml (100 unit) insulin syringe.') : 'Enter all three values to see the units to draw.'}</div>
    </div>
  </div>`;
}

function GlassVisual() {
  const vial = (good) => html`<svg viewBox="0 0 92 136" style="width:84px;height:124px;display:block" aria-hidden="true">
    <rect x="32" y="2" width="28" height="14" rx="3" fill="#cfd2d7" /><path d="M15,16 L15,120 Q15,131 26,131 L66,131 Q77,131 77,120 L77,16" fill="#fff" stroke="#222326" stroke-width="2" stroke-linejoin="round" />
    <path d="M20,104 L72,104 L72,120 Q72,126 66,126 L26,126 Q20,126 20,120 Z" fill="#e0e2e6" />
    ${good ? html`<path d="M24,40 C21,62 21,84 23,100" fill="none" stroke="#2f8f4e" stroke-width="3" stroke-linecap="round" /><line x1="46" y1="8" x2="26" y2="38" stroke="#222326" stroke-width="3" stroke-linecap="round" />`
      : html`<line x1="46" y1="40" x2="46" y2="100" stroke="#c8433f" stroke-width="3" stroke-linecap="round" /><line x1="46" y1="8" x2="46" y2="38" stroke="#222326" stroke-width="3" stroke-linecap="round" />`}</svg>`;
  return html`<div class="visual">
    <div class="stack g10"><div class="lbl">Step 4, up close</div><h3>Aim at the glass, not the powder.</h3>
      <p>A stream landing directly on the powder can shear the peptide. Tilt the vial and let the water run down the inside wall. It reaches the powder gently and dissolves on its own.</p></div>
    <div class="row g32" style="justify-content:center">
      <div class="stack g8" style="align-items:center">${vial(true)}<b style="color:var(--ok);font-size:14px">Down the wall</b></div>
      <div class="stack g8" style="align-items:center">${vial(false)}<b style="color:var(--bad);font-size:14px">Onto the powder</b></div></div>
  </div>`;
}

function SyringeReading() {
  return html`<div class="visual">
    <div class="stack g10"><div class="lbl">Reading the barrel</div><h3>100 units is 1ml. Every unit is 0.01ml.</h3>
      <p>Protocols on this site always say units, because that is what is printed on an insulin syringe. "Draw 20 units" means pull the plunger until the top edge of the black stopper sits on the 20 line, which is 0.2ml.</p></div>
    <div class="stack g8"><${Syringe} units=${20} /><div class="syr-scale"><span>0</span><span>25</span><span>50</span><span>75</span><span>100</span></div>
      <div class="row g8 wrapx tiny"><span class="note" style="padding:6px 12px">10 units = 0.10ml</span><span class="note" style="padding:6px 12px">25 units = 0.25ml</span><span class="note" style="padding:6px 12px">50 units = 0.50ml</span></div></div>
  </div>`;
}

function AngleVisual() {
  return html`<div class="visual">
    <div class="stack g10"><div class="lbl">Angle and depth</div><h3>45° stays under the skin. 90° goes into muscle.</h3>
      <p>Pinching a fold of skin lifts the fat layer away from the muscle underneath, which is what makes a 45° SubQ injection land where it should. Use a fresh 31G needle every time.</p></div>
    <svg viewBox="0 0 320 190" style="width:100%;max-width:360px;height:auto;display:block;justify-self:center" role="img" aria-label="SubQ needle at 45 degrees stops in the fat layer; IM needle at 90 degrees reaches the muscle">
      <rect x="0" y="34" width="320" height="26" rx="4" fill="#cfd2d7" /><rect x="0" y="60" width="320" height="66" fill="#eceef0" /><rect x="0" y="126" width="320" height="52" rx="4" fill="#e0e2e6" />
      <line x1="34" y1="12" x2="106" y2="96" stroke="#222326" stroke-width="4" stroke-linecap="round" /><circle cx="106" cy="96" r="5" fill="#2f8f4e" />
      <line x1="232" y1="12" x2="232" y2="152" stroke="#222326" stroke-width="4" stroke-linecap="round" /><circle cx="232" cy="152" r="5" fill="#1f4cbb" />
      <text x="8" y="26" style="font:600 11px Onest,sans-serif;fill:#5b5e66;letter-spacing:.08em">SKIN</text><text x="8" y="78" style="font:600 11px Onest,sans-serif;fill:#5b5e66;letter-spacing:.08em">FAT</text><text x="8" y="144" style="font:600 11px Onest,sans-serif;fill:#5b5e66;letter-spacing:.08em">MUSCLE</text>
      <text x="112" y="114" style="font:600 13px Onest,sans-serif;fill:#222326">45° SubQ</text><text x="244" y="170" style="font:600 13px Onest,sans-serif;fill:#222326">90° IM</text>
    </svg>
  </div>`;
}

function NeedleVisual() {
  const rows = [['25G', 20, '0.50mm'], ['27G', 16, '0.40mm'], ['29G', 13, '0.33mm'], ['31G', 10, '0.25mm']];
  return html`<div class="visual">
    <div class="stack g10"><div class="lbl">Gauge, to scale</div><h3>The higher the number, the thinner the needle.</h3>
      <p>These bars are the real outer diameters at 40× magnification. A 31G needle is half the width of a 25G, which is the whole difference between a pinch and a jab.</p></div>
    <div class="stack g12">${rows.map(r => html`<div class="row g12"><b style="width:40px;color:var(--ink)">${r[0]}</b><span style=${'flex:1;height:' + r[1] + 'px;border-radius:999px;background:var(--ink)'}></span><span class="tiny muted" style="width:52px;text-align:right">${r[2]}</span></div>`)}
      <div class="note tiny">31G × 8mm is the default for every SubQ protocol on this site.</div></div>
  </div>`;
}

function TCards({ items }) {
  return html`<div class="tcards">${items.map(c => html`<div class="tcard"><h4>${c.title}</h4><p class="small">${c.body}</p>${c.meta ? html`<div class="meta">${c.meta}</div>` : null}</div>`)}</div>`;
}

function Guide({ st, set, chapter }) {
  const ci = Math.max(0, CHAPTERS.findIndex(c => c.key === chapter));
  const ch = CHAPTERS[ci];
  const go = i => { location.hash = '#/guide/' + CHAPTERS[i].key; };
  useEffect(() => { const el = document.querySelector('.chap-nav [aria-current="step"]'); if (el && el.scrollIntoView) el.scrollIntoView({ inline: 'center', block: 'nearest' }); }, [ci]);
  return html`<div class="wrap page">
    <div class="page-head"><h1>Get it right the first time</h1></div>
    <div class="chap-nav" role="tablist" aria-label="Guide chapters">${CHAPTERS.map((c, i) => html`<button type="button" role="tab" aria-selected=${String(i === ci)} aria-current=${i === ci ? 'step' : null} onClick=${() => go(i)}><span class="n">${i + 1}</span>${c.title}</button>`)}</div>
    <div class="progress" aria-hidden="true"><div style=${'width:' + ((ci + 1) / CHAPTERS.length * 100) + '%'}></div></div>
    <div role="tabpanel" aria-label=${ch.title}>
      <h3 style="font-size:clamp(24px,5vw,30px)">${ch.h}</h3><p class="muted" style="margin:6px 0 16px;max-width:62ch">${ch.p}</p>
      ${ch.key === 'mix' ? html`<div class="steps">${STEPS.map(s => html`<div class="stepc"><span class="n">${s.n}</span><div><h4>${s.title}</h4><p class="small">${s.body}</p><div class="tip">${s.tip}</div></div></div>`)}</div><${GlassVisual} />` : null}
      ${ch.key === 'measure' ? html`<${SyringeReading} /><${Calculator} st=${st} set=${set} />` : null}
      ${ch.key === 'inject' ? html`<${AngleVisual} /><${TCards} items=${TABS.technique} /><${NeedleVisual} /><${TCards} items=${TABS.types} />` : null}
      ${ch.key === 'sites' ? html`<${BodyMap} st=${st} set=${set} bare />` : null}
      ${ch.key === 'store' ? html`<${TCards} items=${STORAGE} />` : null}
      ${ch.key === 'faq' ? html`<${SuppliesFaq} bare />` : null}
    </div>
    <div class="chap-foot">
      <button type="button" class="btn outline" disabled=${ci === 0} onClick=${() => go(ci - 1)}><${Icon} name="back" size=${16} /> Back</button>
      ${ci < CHAPTERS.length - 1 ? html`<button type="button" class="btn" onClick=${() => go(ci + 1)}>Next: ${CHAPTERS[ci + 1].title} <${Icon} name="arrow" size=${16} /></button>`
        : html`<a class="btn" href="#/">Back to the price list</a>`}
    </div>
  </div>`;
}

function SuppliesFaq({ bare }) {
  return html`<div>
    <div class="tcards" style="margin-top:0">${SUPPLIES.map(s => html`<div class="tcard"><div class="lbl">${s.spec}</div><h4>${s.title}</h4><p class="small">${s.body}</p>${s.href ? html`<a class="small" style="font-weight:600;margin-top:auto" href=${s.href} target="_blank" rel="noopener">${s.linkLabel}</a>` : null}</div>`)}</div>
    <div style="margin-top:28px;border-top:1px solid var(--n200)">${FAQS.map(f => html`<details class="faq"><summary>${f.q}</summary><p>${f.a}</p></details>`)}</div>
  </div>`;
}
