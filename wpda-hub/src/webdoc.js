// ================= Web guide: the protocol as one self-contained, responsive HTML file =================
// Looks like the site (same type, colours, pills, cards). Nothing is loaded from the internet, so it opens
// anywhere. Ticks and accordions are native controls, so they still work where scripts are switched off
// (mail and file previews); the small script only adds saving, progress and the syringe slider.

const WEB_ASSETS = { font: '', mark: '', ready: false };
let webWarm = null;
function warmWebAssets() {
  if (webWarm) return webWarm;
  const asData = url => fetch(url).then(r => r.ok ? r.blob() : Promise.reject(new Error('missing'))).then(b => new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result)); fr.onerror = rej; fr.readAsDataURL(b); }));
  webWarm = Promise.all([
    asData('assets/fonts/onest.woff2').then(d => { WEB_ASSETS.font = d; }).catch(() => {}),
    fetch('assets/brand/optml-wordmark-dark.svg').then(r => r.ok ? r.text() : '').then(t => { if (/^\s*<svg[\s>]/.test(t) && !/<scr/i.test(t)) WEB_ASSETS.mark = t.trim(); }).catch(() => {})
  ]).then(() => { WEB_ASSETS.ready = true; });
  return webWarm;
}

const WEB_CSS = `
:root{--ink:#222326;--paper:#f5f6f7;--sunken:#eceef0;--n200:#e0e2e6;--n300:#cfd2d7;--n500:#7c8089;--n600:#5b5e66;--n700:#3f4147;--ok-soft:#e3f6e8;--bad:#c8433f;--warn-soft:#ffe9dc;--warn-text:#5f240f;--lid-soft:#eef0fc;--lid-ink:#353a96;--font:'Onest',ui-sans-serif,system-ui,-apple-system,'Segoe UI',sans-serif;color-scheme:light}
*{box-sizing:border-box}
html{scroll-behavior:smooth;scroll-padding-top:84px;-webkit-text-size-adjust:100%}
body{margin:0;font-family:var(--font);font-size:16.5px;line-height:1.6;color:var(--n700);background:#fff;-webkit-font-smoothing:antialiased}
h1,h2,h3,h4{color:var(--ink);margin:0;letter-spacing:-.02em;line-height:1.12;font-weight:700;text-wrap:balance}
p{margin:0;text-wrap:pretty}
a{color:var(--ink)}
b{color:var(--ink);font-weight:700}
button,input{font:inherit;color:inherit}
:focus-visible{outline:2px solid var(--ink);outline-offset:2px}
html:not(.js) .jsonly{display:none!important}
.wrap{max-width:720px;margin:0 auto;padding:0 20px}
.muted{color:var(--n600)}.small{font-size:14.5px}
.lbl{font-size:13px;font-weight:600;color:var(--n600)}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:46px;padding:0 22px;border-radius:999px;border:1px solid var(--ink);background:var(--ink);color:#fff;font-size:15.5px;font-weight:500;cursor:pointer;text-decoration:none;white-space:nowrap;transition:transform .1s ease,background-color .15s ease}
.btn:hover{background:#34363b}.btn:active{transform:scale(.97)}
.btn.outline{background:#fff;color:var(--ink);border-color:var(--n300)}.btn.outline:hover{background:var(--paper)}
.btn.sm{min-height:36px;padding:0 14px;font-size:14px}
.btn.on-dark{background:#fff;color:var(--ink);border-color:#fff}
.btn.on-dark-outline{background:transparent;color:#fff;border-color:rgba(255,255,255,.45)}

.top{position:sticky;top:0;z-index:40;background:rgba(255,255,255,.97);-webkit-backdrop-filter:saturate(1.4) blur(14px);backdrop-filter:saturate(1.4) blur(14px);border-bottom:1px solid var(--n200)}
.top .inner{display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:60px}
.mark{display:inline-flex;align-items:center;min-height:40px;text-decoration:none;font-size:25px;font-weight:700;letter-spacing:-.05em;color:var(--ink)}
.mark svg{height:24px;width:auto;display:block}

.hero{border-radius:28px;background:linear-gradient(160deg,var(--paper) 35%,#dce9f8 100%);padding:28px 18px 18px;margin-top:14px;display:flex;flex-direction:column;gap:12px}
.hero h1{font-size:clamp(38px,10.5vw,60px);letter-spacing:-.04em;line-height:.98}
.hero h1 span{display:block;font-weight:400;opacity:.8}
.hero .lead{font-size:17px;line-height:1.45}
.stats{list-style:none;margin:8px 0 0;padding:0;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
.stats li{display:flex;flex-direction:column;gap:2px;min-width:0;padding:11px 10px 10px 12px;border-radius:16px;background:rgba(255,255,255,.8);font-size:12.5px;line-height:1.3;color:var(--n600);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.stats b{font-size:clamp(16px,4.6vw,20px);letter-spacing:-.02em;line-height:1.15}
.cta{display:flex;flex-wrap:wrap;gap:8px}
.hero .cta{margin-top:6px}

section{padding-top:52px}
.sec-h{margin-bottom:18px}
.sec-h h2{font-size:clamp(28px,7.2vw,38px);letter-spacing:-.03em;line-height:1.04}
.sec-h p{margin-top:8px;color:var(--n600);max-width:56ch}

.cmp+.cmp{margin-top:44px;padding-top:40px;border-top:1px solid var(--n200)}
.g-restore{--gs:#eef0fc}.g-weight{--gs:#ffeded}.g-glow{--gs:#fff1f5}.g-energy{--gs:#ffeee6}.g-growth{--gs:#eafaee}.g-edge{--gs:#fef1fe}.g-vitality{--gs:#fbf9dc}.g-sleep{--gs:#f4eeff}
.cmph{display:flex;align-items:center;gap:14px}
.cmph img,.cmph .av{width:48px;height:48px;flex:none}
.cmph h3{font-size:26px;letter-spacing:-.03em;line-height:1.05}
.cmph h3 span{font-weight:400;opacity:.75}
.cmph p{font-size:14.5px;color:var(--n600);margin-top:2px}
.av{border-radius:50%;background:var(--ink);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:16px}
.intro{margin-top:14px;max-width:60ch}
.first{margin-top:18px;border-radius:22px;background:var(--gs,var(--paper));padding:20px;display:flex;flex-direction:column;gap:16px}
.first .big{display:block;font-size:44px;letter-spacing:-.04em;line-height:1;margin:4px 0 6px}
.first .how{font-size:15.5px;color:var(--n700)}
h4.h4{font-size:18px;letter-spacing:-.01em;margin:28px 0 4px}
.plan{width:100%;border-collapse:collapse;font-size:15.5px}
.plan th{text-align:left;font-size:13px;font-weight:600;color:var(--n600);padding:8px 0;border-bottom:1px solid var(--n200)}
.plan td{padding:13px 0;border-bottom:1px solid var(--n200);vertical-align:top}
.plan td:first-child{color:var(--n600);padding-right:10px;white-space:nowrap}
.plan td:last-child,.plan th:last-child{text-align:right}
.plan td:last-child{white-space:nowrap}
.plan small{display:block;font-size:12.5px;color:var(--n600);font-weight:500}
.plan td.mid{color:var(--ink);font-weight:600;padding-right:10px}
.facts{margin:0;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0 20px}
.facts div{padding:12px 0;border-bottom:1px solid var(--n200)}
.facts dt{font-size:13px;font-weight:600;color:var(--n600)}
.facts dd{margin:2px 0 0;font-size:15.5px;font-weight:600;color:var(--ink);line-height:1.35}
.note{background:var(--paper);border-radius:14px;padding:13px 16px;font-size:15px;line-height:1.6;margin-top:16px}
.warn{background:var(--warn-soft);color:var(--warn-text);border-radius:14px;padding:11px 14px;font-size:14.5px;line-height:1.5;margin-top:12px}
.inbox{display:flex;gap:12px;align-items:flex-start;padding:13px 15px;border-radius:14px;background:var(--lid-soft);color:var(--lid-ink);font-size:15px;line-height:1.5;margin-top:16px}
.inbox svg{flex:none;margin-top:2px}.inbox b{color:inherit}

.syr{display:flex;align-items:center;width:100%;max-width:420px}
.syr .needle{width:22px;height:2px;background:var(--ink);flex:none}
.syr .hub{width:8px;height:14px;background:var(--ink);border-radius:2px 0 0 2px;flex:none}
.syr .barrel{position:relative;flex:1;height:30px;border:2px solid var(--ink);border-radius:3px 7px 7px 3px;background:#fff;overflow:hidden}
.syr .fill{position:absolute;left:0;top:0;bottom:0;background:var(--ink)}
.syr .fill.over{background:var(--bad)}
.syr .ticks{position:absolute;inset:0;display:flex;pointer-events:none}
.syr .ticks span{flex:1;border-right:1px solid rgba(124,128,137,.45)}
.syr .ticks span:nth-child(5){border-right-color:rgba(124,128,137,.9)}
.syr .ticks span:last-child{border-right:0}
.syr .flange{width:6px;height:20px;background:var(--ink);border-radius:0 2px 2px 0;flex:none}
.syr .rod{width:18px;height:5px;background:var(--ink);flex:none}
.syr .thumb{width:5px;height:22px;background:var(--ink);border-radius:2px;flex:none}
.syr-scale{display:flex;justify-content:space-between;max-width:420px;font-size:12px;color:var(--n600);padding:4px 34px 0 30px}

.prog{display:flex;align-items:center;gap:12px;margin-bottom:14px;font-size:14px;font-weight:600;color:var(--ink)}
.prog .bar{flex:1;height:8px;border-radius:999px;background:var(--sunken);overflow:hidden}
.prog .bar i{display:block;height:100%;width:0;border-radius:999px;background:var(--ink);transition:width .25s ease}
.weeks{border-top:1px solid var(--n200)}
summary{list-style:none;cursor:pointer}
summary::-webkit-details-marker{display:none}
details.wk{border-bottom:1px solid var(--n200)}
details.wk summary{display:flex;align-items:center;gap:10px;padding:15px 0;min-height:56px}
.wkn{font-size:17px;font-weight:700;color:var(--ink);letter-spacing:-.01em;flex:none;min-width:74px}
.wks{font-size:14.5px;color:var(--n600);flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cnt{flex:none;font-size:13px;font-weight:600;color:var(--n600);background:var(--paper);border-radius:999px;padding:4px 11px}
details.wk.done .cnt{background:var(--ok-soft);color:#1d5c33}
details.wk summary::after,details.acc summary::after{content:'+';flex:none;width:18px;text-align:center;font-size:22px;font-weight:400;line-height:1;color:var(--n600)}
details.wk[open] summary::after,details.acc[open] summary::after{content:'−'}
.wkb{padding:0 0 18px;display:flex;flex-direction:column;gap:14px}
.tname{display:flex;align-items:baseline;justify-content:space-between;gap:10px;margin-bottom:8px;font-size:14.5px;color:var(--n600)}
.tname b{font-size:15.5px}
.days{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:6px;max-width:420px}
.days+.days{margin-top:6px}
.slot{font-size:12px;font-weight:600;color:var(--n600);margin:8px 0 4px}
.dbox{position:relative;aspect-ratio:1;border-radius:12px;border:1.5px solid var(--n300);background:#fff;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:600;color:var(--n600);cursor:pointer;transition:background-color .15s ease,border-color .15s ease}
.dbox input{position:absolute;inset:0;width:100%;height:100%;margin:0;opacity:0;cursor:pointer}
.dbox i{position:absolute;inset:0;border-radius:10.5px;display:flex;align-items:center;justify-content:center;font-style:normal}
.dbox i::after{content:'';width:7px;height:13px;border:solid #fff;border-width:0 2.5px 2.5px 0;transform:translateY(-1.5px) rotate(45deg);opacity:0}
.dbox input:checked+i{background:var(--ink);box-shadow:0 0 0 1.5px var(--ink)}
.dbox input:checked+i::after{opacity:1}
.dbox input:focus-visible+i{outline:2px solid var(--ink);outline-offset:3px}
.dbox.off{border-style:dashed;border-color:var(--n200);cursor:default;color:var(--n300)}
.foot-row{display:flex;justify-content:flex-end;padding-top:12px}

.sup{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:2px 12px;align-items:baseline;padding:14px 0;border-bottom:1px solid var(--n200)}
.sup:first-child{border-top:1px solid var(--n200)}
.sup b{font-size:16px}
.sup .q{font-size:15.5px;font-weight:700;color:var(--ink);white-space:nowrap}
.sup p{grid-column:1/-1;font-size:14.5px;color:var(--n600);line-height:1.5}

.accs{border-top:1px solid var(--n200)}
details.acc{border-bottom:1px solid var(--n200)}
details.acc summary{display:flex;align-items:center;gap:14px;padding:18px 0}
details.acc summary .t{flex:1;min-width:0;display:flex;flex-direction:column}
details.acc summary .t b{font-size:18px;letter-spacing:-.01em}
details.acc summary .t span{font-size:14px;color:var(--n600)}
.accb{padding:0 0 24px;display:flex;flex-direction:column;gap:18px}
.steps{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:18px}
.steps li{display:flex;gap:14px}
.steps .n{width:30px;height:30px;border-radius:50%;background:var(--ink);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14px;flex:none;margin-top:1px}
.steps h4{font-size:16.5px;letter-spacing:-.01em;margin-bottom:3px}
.steps .tip{margin-top:5px;font-size:13.5px;font-weight:500;color:var(--n600)}
.item h4{font-size:16.5px;letter-spacing:-.01em;margin-bottom:3px}
.item .tip{margin-top:5px;font-size:13.5px;font-weight:500;color:var(--n600)}
.read{font-size:30px;font-weight:700;color:var(--ink);letter-spacing:-.03em;line-height:1.1}
.slide{display:flex;flex-direction:column;gap:2px;font-size:13px;font-weight:600;color:var(--n600);max-width:420px}
input[type=range]{width:100%;height:34px;margin:0;accent-color:var(--ink)}
.ck{position:relative;display:flex;gap:12px;align-items:flex-start;padding:10px 0;cursor:pointer;font-size:15.5px;line-height:1.45}
.ck input{position:absolute;inset:0;width:100%;height:100%;margin:0;opacity:0;cursor:pointer}
.bx{width:26px;height:26px;flex:none;border-radius:8px;border:2px solid var(--n300);background:#fff;display:flex;align-items:center;justify-content:center}
.bx::after{content:'';width:6px;height:11px;border:solid #fff;border-width:0 2.5px 2.5px 0;transform:translateY(-1.5px) rotate(45deg);opacity:0}
.ck input:checked+.bx{background:var(--ink);border-color:var(--ink)}
.ck input:checked+.bx::after{opacity:1}
.ck input:focus-visible+.bx{outline:2px solid var(--ink);outline-offset:2px}
.ck input:checked~.tx{color:var(--n500)}

footer{background:var(--ink);color:rgba(255,255,255,.72);margin-top:64px;padding:40px 0 calc(36px + env(safe-area-inset-bottom));font-size:15px}
footer .mark{color:#fff}footer .mark svg{filter:brightness(0) invert(1)}
footer h2{color:#fff;font-size:clamp(24px,6vw,32px);letter-spacing:-.03em;margin:14px 0 6px}
footer .cta{margin:18px 0 0}
footer a{color:#fff}
footer .fine{border-top:1px solid rgba(255,255,255,.14);padding-top:18px;margin-top:26px;font-size:13px;line-height:1.6;color:rgba(255,255,255,.6)}

@media (min-width:640px){
  .hero{padding:40px 36px 30px}
  .first{flex-direction:row;align-items:center;justify-content:space-between;padding:26px 28px}
  .first .fl{flex:none}.first .fr{flex:1;max-width:400px}
  .facts{grid-template-columns:repeat(3,minmax(0,1fr))}
}
@media print{
  *{-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .top,.cta,.jsonly,.prog{display:none!important}
  body{font-size:13.5px}section{padding-top:26px}
  .first,.steps li,.item,.sup,.ck,.trow,.note,.warn,.inbox,.plan tr{break-inside:avoid}
  footer{background:#fff;color:var(--n600);margin-top:24px;padding:16px 0}footer .mark{color:var(--ink)}footer .mark svg{filter:none}footer h2{display:none}footer .fine{color:var(--n600);border-color:var(--n200)}
}
`;

const WEB_JS = `
(function(){
  var d=document,root=d.documentElement;root.className+=' js';
  var each=function(sel,fn,ctx){Array.prototype.forEach.call((ctx||d).querySelectorAll(sel),fn)};
  var KEY='optml-guide-'+(root.getAttribute('data-id')||''),S={};
  try{S=JSON.parse(localStorage.getItem(KEY)||'{}')||{}}catch(e){S={}}
  var save=function(){try{localStorage.setItem(KEY,JSON.stringify(S))}catch(e){}};
  var count=function(ctx){var n=0,t=0;each('input[data-k]',function(b){t++;if(b.checked)n++},ctx);return[n,t]};
  var prog=function(){
    var tr=d.getElementById('tracker');if(!tr)return;
    var c=count(tr),bar=d.querySelector('[data-bar]'),lab=d.querySelector('[data-prog]');
    if(bar)bar.style.width=(c[1]?c[0]/c[1]*100:0)+'%';
    if(lab)lab.textContent=c[0]+' of '+c[1]+' doses done';
    each('details.wk',function(w){var k=count(w),e=w.querySelector('.cnt'),all=k[1]>0&&k[0]===k[1];if(e&&k[1])e.textContent=all?'Done':k[0]+' of '+k[1];w.classList.toggle('done',all)});
  };
  each('input[data-k]',function(b){
    var k=b.getAttribute('data-k');if(S[k])b.checked=true;
    b.addEventListener('change',function(){if(b.checked)S[k]=1;else delete S[k];save();prog()});
  });
  var opened=false;
  each('details.wk',function(w){var k=count(w),todo=k[1]>0&&k[0]<k[1];w.open=todo&&!opened;if(todo)opened=true});
  if(!opened){var w0=d.querySelector('details.wk');if(w0)w0.open=true}
  prog();
  each('[data-reset]',function(btn){btn.addEventListener('click',function(){each('input[data-k]',function(b){b.checked=false;delete S[b.getAttribute('data-k')]},d.getElementById(btn.getAttribute('data-reset')));save();prog()})});
  var r=d.querySelector('[data-range]');
  if(r){var f=d.querySelector('[data-fill]'),o=d.querySelector('[data-read]'),u=function(){var v=+r.value;f.style.width=Math.max(v>0?1.5:0,v)+'%';o.textContent=v+' units = '+(v/100).toFixed(2)+'ml'};r.addEventListener('input',u);u()}
  each('[data-print]',function(b){b.addEventListener('click',function(){window.print()})});
  var was=[];
  window.addEventListener('beforeprint',function(){was=[];each('details',function(x){was.push([x,x.open]);x.open=true})});
  window.addEventListener('afterprint',function(){was.forEach(function(p){p[0].open=p[1]})});
})();
`;

function WebCheck({ k, children }) {
  return html`<label class="ck"><input type="checkbox" data-k=${k} /><span class="bx"></span><span class="tx">${children}</span></label>`;
}
function WebAcc({ title, hint, children }) {
  return html`<details class="acc"><summary><span class="t"><b>${title}</b>${hint ? html`<span>${hint}</span>` : null}</span></summary><div class="accb">${children}</div></details>`;
}

function WebDoc({ st, items, link, home, title }) {
  const generated = new Date();
  const day = generated.toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' });
  const inj = items.filter(i => !i.oral);
  const drawOf = w => w ? (unitsOf(w.draw) !== null ? String(w.draw).split(' · ')[0] : String(w.draw)) : '—';
  const cid = it => 'c-' + String(it.key).replace(/[^a-zA-Z0-9_-]/g, '');
  // Name and strength apart ("Glow Stack" + "70mg"), without repeating a strength the name already carries.
  const parts = it => { const sp = splitName(it.name); const str = sp[1] || (!it.oral && it.vial && it.name.indexOf(it.vial) < 0 ? it.vial : ''); return [sp[1] ? sp[0] : it.name, str]; };
  const lower = s => String(s || '').replace(/^./, c => c.toLowerCase());

  // The tracker runs the full length of the protocol (the longest compound), between 4 and 16 weeks.
  const sups = items.map(it => protocolSupply(it));
  const lens = sups.map(p => p.dur ? p.dur.max : 0);
  const known = Math.max.apply(null, lens.concat([0]));
  const weeksN = Math.max(4, Math.min(16, known || 4));
  const runsTo = i => sups[i].dur && !sups[i].dur.open ? sups[i].dur.max : weeksN;
  const weeks = Array.from({ length: weeksN }, (_, k) => {
    const wk = k + 1;
    const rows = items.map((it, i) => { const w = wk <= runsTo(i) ? it.week(wk) : null; return w && w.days.length ? { it, w, per: w.perDay || 1 } : null; }).filter(Boolean);
    return { wk, rows, n: rows.reduce((a, r) => a + r.w.days.length * r.per, 0) };
  });
  const totalDoses = weeks.reduce((a, w) => a + w.n, 0);
  const injTotal = weeks.reduce((a, w) => a + w.rows.reduce((b, r) => b + (r.it.oral ? 0 : r.w.days.length * r.per), 0), 0);
  const four = supplyPlan(items);
  // Vials for the whole run where the dose table lets us work it out, otherwise the first four weeks.
  const lines = items.map((it, i) => { const ps = sups[i]; const l4 = four.lines[i];
    return { it, ps, n: ps.count ? ps.count[1] : (it.oral ? 1 : l4.vials), full: !!ps.count }; });
  // Every compound worked out for its full run → totals for the whole protocol; otherwise totals stay at the first four weeks.
  const full = known > 0 && lines.every(l => l.full);
  const vials = full ? lines.reduce((a, l) => a + (l.it.oral ? 0 : l.n), 0) : four.vials;
  const water = full ? lines.reduce((a, l) => a + (l.it.oral ? 0 : l.n * (l.it.water || 0)), 0) : four.water;
  const injSpan = full ? injTotal : four.injections;
  const lineSpan = l => l.full ? (l.ps.dur ? l.ps.dur.max + ' weeks' : 'the full protocol') : 'the first four weeks';
  const slot = (per, n) => per === 2 ? (n === 0 ? 'Morning' : 'Evening') : 'Dose ' + (n + 1);
  const one = items.length === 1 ? items[0] : null;
  const headParts = st.client ? ['Protocol for ' + st.client.trim(), ''] : one ? parts(one) : ['Your protocol', ''];

  return html`<header class="top"><div class="wrap inner"><a class="mark" href=${home} aria-label="optml price list"><i data-mark="1"></i></a><a class="btn sm" href=${link}>Open live tracker</a></div></header>
    <main class="wrap">
    <div class="hero">
      <div class="lbl">${known ? weeksN + '-week protocol' : 'Peptide protocol'}</div>
      <h1>${headParts[0]}${headParts[1] ? html`<span>${headParts[1]}</span>` : null}</h1>
      <p class="lead">${st.by ? 'Prepared by ' + st.by + ' · ' : ''}${day}</p>
      <ul class="stats">
        <li><b>${known ? weeksN + ' weeks' : items.length + (items.length === 1 ? ' compound' : ' compounds')}</b>${known ? 'Full protocol' : 'In this plan'}</li>
        <li><b>${weeks[0].n} dose${weeks[0].n === 1 ? '' : 's'}</b>In week one</li>
        <li><b>${inj.length ? vials + ' vial' + (vials === 1 ? '' : 's') : 'Capsules'}</b>${inj.length ? (full ? 'For ' + weeksN + ' weeks' : 'First 4 weeks') : 'No needles'}</li>
      </ul>
      <div class="cta"><a class="btn" href="#tracker">Start the tracker</a><button type="button" class="btn outline jsonly" data-print="1"><${Icon} name="print" size=${16} /> Print</button></div>
    </div>

    ${st.notes ? html`<section><div class="sec-h"><h2>A note from ${st.by || 'your practitioner'}</h2></div><div class="note" style="white-space:pre-line;margin-top:0">${st.notes}</div></section>` : null}

    <section id="dose"><div class="sec-h"><h2>Your dose</h2><p>What to take, when to take it, and how it steps up.</p></div>
      ${items.map((it, i) => { const ps = sups[i]; const w1 = it.week(1); const u = w1 ? unitsOf(w1.draw) : null; const pp = parts(it);
        return html`<article class=${'cmp' + (it.goal ? ' g-' + it.goal : '')} id=${cid(it)}>
        <div class="cmph">${it.icon ? html`<img src=${it.icon} alt="" />` : html`<span class="av">${initials(it.name)}</span>`}
          <div><h3>${pp[0]}${pp[1] ? html` <span>${pp[1]}</span>` : null}</h3><p>${it.sub}${it.kind === 'own' || it.kind === 'custom' ? ' · custom titration' : ''}</p></div></div>
        ${it.desc ? html`<p class="intro">${it.desc}</p>` : null}
        <div class="first"><div class="fl"><span class="lbl">Start with</span><b class="big">${drawOf(w1)}</b><span class="how">${[w1 ? w1.dose : '', lower(it.freqText)].filter(Boolean).join(' · ')}</span></div>
          ${!it.oral && u !== null ? html`<div class="fr"><${Syringe} units=${u} /><div class="syr-scale"><span>0</span><span>25</span><span>50</span><span>75</span><span>100</span></div></div>` : null}</div>
        <h4 class="h4">Week by week</h4>
        <table class="plan"><thead><tr><th scope="col">Weeks</th><th scope="col">Dose</th><th scope="col">${it.oral ? 'Take' : 'Draw'}</th></tr></thead>
          <tbody>${it.rows.map(r => html`<tr><td>${r.label}</td><td class="mid">${r.dose}${r.extra ? html`<small>${r.extra}</small>` : null}</td><td><b>${r.units !== null ? String(r.draw).split(' · ')[0] : r.draw}</b>${r.units !== null && String(r.draw).split(' · ')[1] ? html`<small>${String(r.draw).split(' · ')[1]}</small>` : null}</td></tr>`)}</tbody></table>
        ${it.rows.some(r => r.warn) ? html`<div class="warn">${it.rows.find(r => r.warn).warn}</div>` : null}
        <h4 class="h4">The details</h4>
        <dl class="facts"><div><dt>${it.vialLabel}</dt><dd>${it.vial || '—'}</dd></div>
          ${!it.oral ? html`<div><dt>Mix with</dt><dd>${it.water ? trimNum(it.water, 2) + 'ml bac water' : '—'}</dd></div><div><dt>Once mixed</dt><dd>${it.conc || '—'}</dd></div>` : null}
          <div><dt>When</dt><dd>${it.timing || it.whenLabel}</dd></div><div><dt>Where</dt><dd>${it.site}</dd></div>
          ${it.duration ? html`<div><dt>For how long</dt><dd>${it.duration}</dd></div>` : null}
          ${ps.count ? html`<div><dt>${it.oral ? 'Bottles needed' : 'Vials needed'}</dt><dd>${ps.text}${ps.forText ? ' ' + ps.forText : ''}</dd></div>` : null}</dl>
        ${!it.oral && it.water ? html`<div class="inbox"><${Icon} name="drop" size=${20} /><span><b>To mix:</b> add ${trimNum(it.water, 2)}ml of bac water slowly down the inside wall of the vial. Roll gently, never shake. Date the label, keep it in the fridge and use it within 4 weeks.</span></div>` : null}
        ${st.inotes[it.key] ? html`<div class="note" style="white-space:pre-line"><b>Note:</b> ${st.inotes[it.key]}</div>` : null}
        ${it.note ? html`<div class="note">${it.note}</div>` : null}
      </article>`; })}
    </section>

    <section id="tracker"><div class="sec-h"><h2>${weeksN}-week tracker</h2><p>Tap a day when the dose is done. ${inj.length ? 'Move to a new injection site each time.' : ''}</p></div>
      <div class="prog jsonly"><div class="bar"><i data-bar="1"></i></div><span data-prog="1"></span></div>
      <div class="weeks">${weeks.map(wkd => html`<details class="wk" open=${wkd.wk === 1}><summary><span class="wkn">Week ${wkd.wk}</span>
          <span class="wks">${wkd.rows.length === 1 ? [wkd.rows[0].w.dose, unitsOf(wkd.rows[0].w.draw) !== null ? 'draw ' + drawOf(wkd.rows[0].w) : (wkd.rows[0].it.oral ? shortDraw(wkd.rows[0].w.draw) : '')].filter(Boolean).join(' · ') : wkd.rows.length ? wkd.rows.length + ' compounds' : 'Nothing scheduled'}</span>
          <span class="cnt">${wkd.n} dose${wkd.n === 1 ? '' : 's'}</span></summary>
        <div class="wkb">${wkd.rows.map(r => html`<div class="trow">
          ${items.length > 1 ? html`<div class="tname"><b>${r.it.name}</b><span>${[r.w.dose, unitsOf(r.w.draw) !== null ? drawOf(r.w) : (r.it.oral ? shortDraw(r.w.draw) : '')].filter(Boolean).join(' · ')}</span></div>` : null}
          ${Array.from({ length: r.per }, (_, n) => html`${r.per > 1 ? html`<div class="slot">${slot(r.per, n)}</div>` : null}<div class="days">
            ${Array.from({ length: 7 }, (_, i) => { const dn = (wkd.wk - 1) * 7 + i + 1; return r.w.days.indexOf(i) > -1
              ? html`<label class="dbox" aria-label=${'Day ' + dn + (r.per > 1 ? ', ' + slot(r.per, n).toLowerCase() : '') + ', ' + r.it.name}>${dn}<input type="checkbox" data-k=${'t' + wkd.wk + '-' + i + '-' + cid(r.it) + '-' + n} /><i></i></label>`
              : html`<span class="dbox off" aria-hidden="true">${dn}</span>`; })}</div>`)}
        </div>`)}</div>
      </details>`)}</div>
      <div class="foot-row jsonly"><button type="button" class="btn sm outline" data-reset="tracker">Clear the tracker</button></div>
    </section>

    <section id="supplies"><div class="sec-h"><h2>What you need</h2><p>${full ? 'Enough for all ' + weeksN + ' weeks.' : 'What to have on hand.'}</p></div>
      <div>
        ${lines.map(l => html`<div class="sup"><b>${l.it.name}</b><span class="q">${l.it.oral ? (l.full ? l.n + ' bottle' + (l.n === 1 ? '' : 's') : 'One bottle') : l.n + ' vial' + (l.n === 1 ? '' : 's')}</span>
          <p>${l.it.oral ? l.it.vial + '.' : l.it.vial + ' vial' + (l.it.vialStart ? '. One lasts about ' + weeksText(Math.min(l.it.vialStart, MIXED_WEEKS)) + ' at the starting dose' + (l.it.vialTop && Math.abs(Math.min(l.it.vialTop, MIXED_WEEKS) - Math.min(l.it.vialStart, MIXED_WEEKS)) > 0.4 ? ', ' + weeksText(Math.min(l.it.vialTop, MIXED_WEEKS)) + ' at the top dose' : '') + '.' : '.')}${full ? '' : ' Enough for ' + lineSpan(l) + '.'}</p></div>`)}
        ${vials ? html`<div class="sup"><b>Bacteriostatic water</b><span class="q">${vials} vial${vials === 1 ? '' : 's'}</span><p>Free with every optml vial. You need ${trimNum(water, 2)}ml${full ? ' in total' : ' for the first four weeks'}.</p></div>` : null}
        ${inj.length ? html`<div class="sup"><b>Insulin syringes</b><span class="q">About ${injSpan + vials}</span><p>1ml (100 unit), 31G, 6–8mm. One for each injection, one for each vial you mix${full ? '' : ', for the first four weeks'}.</p></div>
        <div class="sup"><b>Alcohol swabs</b><span class="q">About ${injSpan + vials * 2}</span><p>One for each injection, two for each vial you mix.</p></div>
        <div class="sup"><b>Sharps container</b><span class="q">1</span><p>Free from most Australian pharmacies.</p></div>` : null}
      </div>
    </section>

    <section id="guide"><div class="sec-h"><h2>How to do it</h2><p>Open what you need. It's all here when you want it.</p></div>
      <div class="accs">
      ${inj.length ? html`
        <${WebAcc} title="Mix a vial" hint="Six steps, under five minutes">
          <ol class="steps">${STEPS.map(s => html`<li><span class="n">${s.n}</span><div><h4>${s.title}</h4><p>${s.body}</p><div class="tip">${s.tip}</div></div></li>`)}</ol><//>
        <${WebAcc} title="Read the syringe" hint="100 units is 1ml">
          <div class="read" data-read="1">20 units = 0.20ml</div>
          <div><div class="syr" role="img" aria-label="Syringe"><span class="needle"></span><span class="hub"></span><span class="barrel"><span class="fill" data-fill="1" style="width:20%"></span><span class="ticks">${Array.from({ length: 10 }, () => html`<span></span>`)}</span></span><span class="flange"></span><span class="rod"></span><span class="thumb"></span></div>
            <div class="syr-scale"><span>0</span><span>25</span><span>50</span><span>75</span><span>100</span></div></div>
          <label class="slide jsonly">Slide to see where the plunger sits<input type="range" min="0" max="100" step="1" data-range="1" aria-label="Units to draw" /></label>
          <p>A 1ml insulin syringe holds 100 units, so every unit is 0.01ml. "Draw 20 units" means pull the plunger until the top edge of the black stopper sits on the 20 line.</p><//>
        <${WebAcc} title="Inject" hint="Into the fat just under the skin">
          ${TABS.technique.map(c => html`<div class="item"><h4>${c.title}</h4><p>${c.body}</p></div>`)}
          <div id="pre"><h4 style="font-size:16.5px;margin-bottom:4px">Before every injection</h4>
            <${WebCheck} k="p1">Vial at room temperature for 10–15 minutes.<//>
            <${WebCheck} k="p2">Fresh swab on the stopper, let it dry.<//>
            <${WebCheck} k="p3">New 31G insulin syringe, draw to the units on your plan.<//>
            <${WebCheck} k="p4">Pinch, 45°, inject slowly over 5–10 seconds.<//>
            <${WebCheck} k="p5">Next site in your rotation. Sharps straight into the container.<//>
            <div class="foot-row jsonly" style="justify-content:flex-start"><button type="button" class="btn sm outline" data-reset="pre">Clear for next time</button></div></div><//>
        <${WebAcc} title="Where to inject" hint="Four sites, and how to rotate">
          ${['abdomen', 'flank', 'thigh', 'arm'].map(k => html`<div class="item"><h4>${SITE_INFO[k].name}</h4><p>${SITE_INFO[k].why}</p><div class="tip">Avoid: ${SITE_INFO[k].avoid}</div></div>`)}
          <div class="note" style="margin-top:0">Treat your abdomen like a clock face around the navel, at least 5cm out. Move one position clockwise every dose: eight positions brings you back to the same spot about once a week.</div><//>` : null}
        <${WebAcc} title="Storage" hint="Fridge, light and travel">
          ${STORAGE.map(c => html`<div class="item"><h4>${c.title}</h4><p>${c.body}</p></div>`)}<//>
        ${inj.length ? html`<${WebAcc} title="Common questions" hint=${FAQS.length + ' quick answers'}>
          ${FAQS.map(f => html`<div class="item"><h4>${f.q}</h4><p>${f.a}</p></div>`)}<//>` : null}
      </div>
    </section>
    </main>

    <footer><div class="wrap"><a class="mark" href=${home} aria-label="optml price list"><i data-mark="1"></i></a>
      <h2>Need more, or have a question?</h2>
      <p>Reorder from the price list, or email <a href=${'mailto:' + CONTACT}>${CONTACT}</a> about your order.</p>
      <div class="cta"><a class="btn on-dark" href=${home}>Open the price list</a><a class="btn on-dark-outline" href=${link}>Open live tracker</a></div>
      <p class="fine">${DISCLAIMER}</p></div></footer>`;
}

function buildWebDoc(st, items) {
  const title = st.client ? 'Protocol for ' + st.client.trim() : (items.length === 1 ? items[0].name + ' protocol' : 'Your protocol');
  const home = location.origin + location.pathname;
  const link = home + '#plan=' + encodePlan(planPayload(Object.assign({}, st, { start: '' })));
  const box = document.createElement('div');
  render(html`<${WebDoc} st=${st} items=${items} link=${link} home=${home} title=${title} />`, box);
  const range = box.querySelector('[data-range]'); if (range) range.setAttribute('value', '20');
  let body = box.innerHTML;
  render(null, box);
  body = body.split('<i data-mark="1"></i>').join(WEB_ASSETS.mark || 'optml');
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const font = WEB_ASSETS.font ? "@font-face{font-family:'Onest';src:url(" + WEB_ASSETS.font + ") format('woff2');font-weight:100 900;font-display:swap}" : '';
  const doc = '<!DOCTYPE html>\n<html lang="en-AU" data-id="g' + Date.now().toString(36) + '">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n<title>' + esc(title) + ' · optml</title>\n<meta name="robots" content="noindex">\n<meta name="theme-color" content="#ffffff">\n<style>' + font + WEB_CSS + '</style>\n</head>\n<body>\n' + body + '\n<scr' + 'ipt>' + WEB_JS + '</scr' + 'ipt>\n</body>\n</html>\n';
  const slug = String(st.client || (items.length === 1 ? items[0].name : '')).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
  return { name: 'optml-protocol' + (slug ? '-' + slug : '') + '.html', html: doc, title };
}

// Share sheet on phones (Mail, WhatsApp, Files…), a plain download everywhere else.
function exportWeb(st, flash) {
  const items = planItems(st);
  if (!items.length) return;
  const say = m => { if (flash) flash(m); };
  const go = () => {
    const out = buildWebDoc(st, items);
    const blob = new Blob([out.html], { type: 'text/html' });
    const download = () => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = out.name; a.style.display = 'none';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      say('Saved ' + out.name);
    };
    let file = null;
    try { file = new File([blob], out.name, { type: 'text/html' }); } catch (e) { file = null; }
    const touch = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    if (touch && file && navigator.canShare && navigator.canShare({ files: [file] })) {
      navigator.share({ files: [file], title: out.title }).catch(err => { if (!err || err.name !== 'AbortError') download(); });
    } else download();
  };
  if (WEB_ASSETS.ready) go(); else warmWebAssets().then(go, go);
}

// Plan state for a hand-picked set of listed protocols (product page, All protocols), leaving My plan alone.
function stForPicks(st, picks) {
  return Object.assign({}, st, { order: picks.map(x => x[0]), customs: {}, own: {}, mode: {}, notes: '', inotes: {}, sizeIdx: Object.assign({}, st.sizeIdx, picks.reduce((a, x) => { a[x[0]] = x[1]; return a; }, {})) });
}
