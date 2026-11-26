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
:root{--ink:#222326;--white:#fff;--paper:#f5f6f7;--sunken:#eceef0;--n200:#e0e2e6;--n300:#cfd2d7;--n500:#7c8089;--n600:#5b5e66;--n700:#3f4147;--ok:#2f8f4e;--ok-soft:#e3f6e8;--bad:#c8433f;--warn-soft:#ffe9dc;--warn-text:#5f240f;--lid-soft:#eef0fc;--lid-ink:#353a96;--font:'Onest',ui-sans-serif,system-ui,-apple-system,'Segoe UI',sans-serif;color-scheme:light}
*{box-sizing:border-box}
html{scroll-behavior:smooth;scroll-padding-top:128px;-webkit-text-size-adjust:100%}
body{margin:0;font-family:var(--font);font-size:16px;line-height:1.55;color:var(--n700);background:#fff;-webkit-font-smoothing:antialiased}
h1,h2,h3,h4{color:var(--ink);margin:0;letter-spacing:-.02em;line-height:1.12;font-weight:700;text-wrap:balance}
p{margin:0;text-wrap:pretty}
a{color:var(--ink)}
b{color:var(--ink);font-weight:700}
button,input{font:inherit;color:inherit}
:focus-visible{outline:2px solid var(--ink);outline-offset:2px}
html:not(.js) .jsonly{display:none!important}
.wrap{max-width:820px;margin:0 auto;padding:0 20px}
.muted{color:var(--n600)}.small{font-size:14px}.tiny{font-size:13px}
.eyebrow{font-size:13px;font-weight:600;color:var(--n600)}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:44px;padding:0 20px;border-radius:999px;border:1px solid var(--ink);background:var(--ink);color:#fff;font-size:15px;font-weight:500;cursor:pointer;text-decoration:none;white-space:nowrap;transition:transform .1s ease,background-color .15s ease}
.btn:hover{background:#34363b}.btn:active{transform:scale(.97)}
.btn.outline{background:#fff;color:var(--ink);border-color:var(--n300)}.btn.outline:hover{background:var(--paper)}
.btn.sm{min-height:36px;padding:0 14px;font-size:14px}
.btn.on-dark{background:#fff;color:var(--ink);border-color:#fff}
.btn.on-dark-outline{background:transparent;color:#fff;border-color:rgba(255,255,255,.45)}

.top{position:sticky;top:0;z-index:40;background:rgba(255,255,255,.97);-webkit-backdrop-filter:saturate(1.4) blur(14px);backdrop-filter:saturate(1.4) blur(14px);border-bottom:1px solid var(--n200)}
.top .inner{display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:60px}
.mark{display:inline-flex;align-items:center;min-height:40px;text-decoration:none;font-size:25px;font-weight:700;letter-spacing:-.05em;color:var(--ink)}
.mark svg{height:24px;width:auto;display:block}
.chips{display:flex;gap:8px;overflow-x:auto;scrollbar-width:none;-webkit-overflow-scrolling:touch;padding:0 20px 10px;margin:0 -20px}
.chips::-webkit-scrollbar{display:none}
.chips a{flex:none;display:inline-flex;align-items:center;gap:8px;min-height:40px;padding:0 15px 0 5px;border-radius:999px;border:1px solid var(--n300);background:#fff;font-size:14.5px;font-weight:500;color:var(--ink);text-decoration:none}
.chips .n{width:30px;height:30px;border-radius:50%;background:var(--paper);display:inline-flex;align-items:center;justify-content:center;font-weight:700;font-size:13.5px}
.chips a[aria-current]{background:var(--ink);color:#fff;border-color:var(--ink)}
.chips a[aria-current] .n{background:#fff;color:var(--ink)}

.hero{border-radius:28px;background:linear-gradient(160deg,var(--paper) 35%,#dce9f8 100%);padding:24px 12px 12px;margin-top:14px}
.hero .copy{padding:0 8px;display:flex;flex-direction:column;gap:10px}
.hero h1{font-size:clamp(36px,10vw,60px);letter-spacing:-.035em;line-height:.98}
.hero .lead{font-size:17px;line-height:1.45;color:var(--n700)}
.cta{display:flex;flex-wrap:wrap;gap:8px}
.hero .cta{margin-top:6px}
.feats{list-style:none;margin:18px 0 0;padding:0;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
.feats li{display:flex;align-items:center;gap:10px;min-height:58px;padding:9px 12px;border-radius:16px;background:rgba(255,255,255,.78);color:var(--n600);font-size:12.5px;line-height:1.3}
.feats span{display:flex;flex-direction:column;min-width:0}
.feats b{font-size:14.5px}
.feats svg{flex:none;color:var(--ink)}

section{padding-top:38px}
.sec-h{display:flex;flex-direction:column;gap:6px;margin-bottom:14px}
.sec-h h2{font-size:clamp(27px,6.8vw,38px);letter-spacing:-.03em;line-height:1.04}
.sec-h p{color:var(--n600);max-width:62ch}
h3.sub{font-size:20px;margin:28px 0 10px}

.rows{border-top:1px solid var(--n200)}
.rowl{display:flex;align-items:center;gap:12px;padding:14px 0;border-bottom:1px solid var(--n200);text-decoration:none;color:var(--n600);font-size:14px;line-height:1.35}
.rowl img,.rowl .av{width:40px;height:40px;flex:none}
.rowl .grow{flex:1;min-width:0;display:flex;flex-direction:column;gap:1px}
.rowl .grow b{font-size:16.5px;letter-spacing:-.01em}
.rowl:hover .grow b{text-decoration:underline;text-underline-offset:3px}
.rowl .draw{flex:none;max-width:40%;text-align:right;font-size:15px;font-weight:700;color:var(--ink)}
.rowl .draw small{display:block;font-size:12px;font-weight:500;color:var(--n600)}
.rowl>svg{flex:none;color:var(--n500)}
.av{border-radius:50%;background:var(--ink);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:15px}

.card{background:#fff;border:1px solid var(--n200);border-radius:20px;padding:6px 16px}
.note{background:var(--paper);border-radius:14px;padding:12px 16px;font-size:14.5px;line-height:1.6;margin-top:12px}
.warn{background:var(--warn-soft);color:var(--warn-text);border-radius:14px;padding:10px 14px;font-size:14px;line-height:1.5;margin-top:10px}
.inbox{display:flex;gap:12px;align-items:flex-start;padding:12px 14px;border-radius:14px;background:var(--lid-soft);color:var(--lid-ink);font-size:14.5px;line-height:1.5;margin-top:12px}
.inbox svg{flex:none;margin-top:1px}.inbox b{color:inherit}

.ck{position:relative;display:flex;gap:12px;align-items:flex-start;padding:11px 0;cursor:pointer;font-size:15px;line-height:1.45}
.ck+.ck{border-top:1px solid var(--n200)}
.ck input,.dose input{position:absolute;inset:0;width:100%;height:100%;margin:0;opacity:0;cursor:pointer}
.bx{width:28px;height:28px;flex:none;border-radius:9px;border:2px solid var(--n300);background:#fff;display:flex;align-items:center;justify-content:center;transition:background-color .15s ease,border-color .15s ease}
.bx::after{content:'';width:7px;height:12px;border:solid #fff;border-width:0 2.5px 2.5px 0;transform:translateY(-1.5px) rotate(45deg);opacity:0}
input:checked+.bx{background:var(--ink);border-color:var(--ink)}
input:checked+.bx::after{opacity:1}
input:focus-visible+.bx{outline:2px solid var(--ink);outline-offset:2px}
.ck input:checked~.tx{color:var(--n500)}
.ckfoot{display:flex;justify-content:flex-end;padding:4px 0 10px}

.sup{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:3px 12px;align-items:start;padding:13px 0;border-bottom:1px solid var(--n200)}
.sup b{font-size:15.5px}
.sup .q{font-size:13.5px;font-weight:600;color:var(--ink);background:var(--paper);border-radius:999px;padding:3px 11px;white-space:nowrap}
.sup p{grid-column:1/-1;font-size:14px;color:var(--n600);line-height:1.5}

.g-restore{--g:#6166cc;--g-ink:#fff}.g-weight{--g:#ff8787;--g-ink:#561213}.g-glow{--g:#ffc3d6;--g-ink:#6d2247}.g-energy{--g:#ff7848;--g-ink:#471808}.g-growth{--g:#92e8a6;--g-ink:#1b3a22}.g-edge{--g:#febffc;--g-ink:#4d2f4c}.g-vitality{--g:#f0ea6a;--g-ink:#383110}.g-sleep{--g:#d0b3ff;--g-ink:#35244f}
.cmp+.cmp{margin-top:36px}
.plid{background:var(--g,var(--ink));color:var(--g-ink,#fff);border-radius:28px;padding:22px 20px 18px;display:flex;flex-direction:column;gap:26px}
.plid h3{color:inherit;font-size:clamp(34px,9.5vw,52px);letter-spacing:-.04em;line-height:.98}
.plid h3 span{display:block;font-weight:400;opacity:.82}
.plid-foot{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.lock{display:inline-flex;align-items:center;gap:6px}
.lock img{width:34px;height:34px;border-radius:50%;box-shadow:0 0 0 2px rgba(255,255,255,.7)}
.lock span,.pchip{display:inline-flex;align-items:center;min-height:34px;padding:0 14px;border-radius:999px;background:rgba(255,255,255,.88);color:var(--ink);font-size:14px;font-weight:600}
.lock span{text-transform:lowercase;font-size:15px}
.pintro{font-size:16px;max-width:62ch;margin-top:16px}
.facts{margin:16px 0 0;border-bottom:1px solid var(--n200)}
.facts div{display:grid;grid-template-columns:112px minmax(0,1fr);gap:12px;align-items:baseline;border-top:1px solid var(--n200);padding:12px 0}
.facts dt{font-size:14px;font-weight:500;color:var(--n600)}
.facts dd{margin:0;font-size:15.5px;font-weight:600;color:var(--ink);line-height:1.3}
h4.h4{font-size:18px;letter-spacing:-.01em;margin:22px 0 10px}
.ladder{display:flex;flex-direction:column;gap:8px}
.rung{display:grid;grid-template-columns:1fr auto;gap:6px 12px;padding:12px 14px;border-radius:14px;background:var(--paper);align-items:center}
.rung .wk{font-size:13px;font-weight:600;color:var(--n600)}
.rung .dose{font-size:15px;font-weight:600;color:var(--ink)}
.rung .extra{font-size:13px;color:var(--n600)}
.rung .draw{text-align:right;font-size:15px;font-weight:700;color:var(--ink);white-space:nowrap}
.rung .draw small{display:block;font-size:12px;font-weight:500;color:var(--n600)}
.rung .syr,.rung .warn{grid-column:1/-1}.rung .warn{margin-top:0}

.syr{display:flex;align-items:center;width:100%}
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
.syr.sm .barrel{height:16px;border-width:1.5px}
.syr.sm .needle{width:12px}.syr.sm .hub{height:9px;width:5px}.syr.sm .flange{height:12px;width:4px}.syr.sm .rod{width:10px;height:3px}.syr.sm .thumb{height:13px;width:3px}
.syr-scale{display:flex;justify-content:space-between;font-size:12px;color:var(--n600);padding:4px 34px 0 30px}
.syrcard{border:1px solid var(--n200);border-radius:20px;padding:18px;display:flex;flex-direction:column;gap:12px}
.syrcard .read{font-size:28px;font-weight:700;color:var(--ink);letter-spacing:-.03em;line-height:1.1}
.syrcard label{display:flex;flex-direction:column;gap:2px;font-size:13px;font-weight:600;color:var(--n600)}
input[type=range]{width:100%;height:34px;margin:0;accent-color:var(--ink)}

.prog{display:flex;align-items:center;gap:12px;margin-bottom:4px;font-size:14px;font-weight:600;color:var(--ink)}
.prog .bar{flex:1;height:8px;border-radius:999px;background:var(--sunken);overflow:hidden}
.prog .bar i{display:block;height:100%;width:0;border-radius:999px;background:var(--ink);transition:width .25s ease}
details.wk{border:1px solid var(--n200);border-radius:20px;margin-top:10px;background:#fff;overflow:hidden}
details.wk summary{list-style:none;cursor:pointer;display:flex;align-items:center;gap:10px;padding:16px 18px;font-size:18px;font-weight:700;color:var(--ink);letter-spacing:-.01em}
summary::-webkit-details-marker{display:none}
details.wk summary .cnt{margin-left:auto;font-size:13px;font-weight:600;letter-spacing:0;color:var(--n600);background:var(--paper);border-radius:999px;padding:4px 11px}
details.wk.done summary .cnt{background:var(--ok-soft);color:#1d5c33}
details.wk summary::after{content:'+';font-size:22px;font-weight:400;line-height:1;color:var(--n600)}
details.wk[open] summary::after{content:'−'}
.day{display:grid;grid-template-columns:52px minmax(0,1fr);gap:10px;align-items:center;padding:10px 14px 10px 18px;border-top:1px solid var(--n200)}
.day .dl{font-size:13px;font-weight:600;color:var(--n600)}
.day .doses{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(230px,100%),1fr));gap:6px}
.day.rest p{font-size:14px;color:var(--n500)}
.dose{position:relative;display:flex;align-items:center;gap:12px;padding:8px 12px 8px 8px;border-radius:14px;border:1px solid var(--n200);background:#fff;cursor:pointer}
.dose .tx{display:flex;flex-direction:column;min-width:0;line-height:1.3}
.dose .tx b{font-size:15px}.dose .tx small{font-size:13px;color:var(--n600)}
.dose .u{margin-left:auto;font-size:14px;font-weight:700;color:var(--ink);white-space:nowrap}
.dose:has(input:checked){background:var(--paper);border-color:var(--paper)}

.steps{display:grid;gap:10px}
.stepc{display:flex;gap:14px;padding:16px;border-radius:20px;border:1px solid var(--n200)}
.stepc .n{width:32px;height:32px;border-radius:50%;background:var(--ink);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14px;flex:none}
.stepc h4{font-size:17px;margin-bottom:4px;letter-spacing:-.01em}
.stepc p{font-size:15px}
.stepc .tip{margin-top:8px;font-size:13px;font-weight:500;color:var(--n600)}
.tcards{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(280px,100%),1fr));gap:10px}
.tcard{padding:18px;border-radius:20px;border:1px solid var(--n200);display:flex;flex-direction:column;gap:8px}
.tcard h4{font-size:17px;letter-spacing:-.01em}
.tcard p{font-size:15px}
.tcard .meta{font-size:13px;font-weight:500;color:var(--n600);background:var(--paper);border-radius:10px;padding:8px 12px;margin-top:auto}
details.faq{border-bottom:1px solid var(--n200)}
details.faq summary{list-style:none;cursor:pointer;padding:18px 0;display:flex;justify-content:space-between;gap:16px;font-size:17px;font-weight:600;color:var(--ink)}
details.faq summary::after{content:'+';font-size:22px;font-weight:400;line-height:1}
details.faq[open] summary::after{content:'−'}
details.faq p{padding:0 0 18px;max-width:70ch}

footer{background:var(--ink);color:rgba(255,255,255,.72);margin-top:56px;padding:40px 0 calc(36px + env(safe-area-inset-bottom));font-size:14.5px}
footer .mark{color:#fff}footer .mark svg{filter:brightness(0) invert(1)}
footer h2{color:#fff;font-size:clamp(24px,6vw,32px);letter-spacing:-.03em;margin:14px 0 6px}
footer .cta{margin:18px 0 0}
footer a{color:#fff}
footer .fine{border-top:1px solid rgba(255,255,255,.14);padding-top:18px;margin-top:26px;font-size:13px;line-height:1.6;color:rgba(255,255,255,.6)}

@media (min-width:640px){
  .hero{padding:36px 16px 16px}.hero .copy{padding:0 18px}
  .feats{grid-template-columns:repeat(4,minmax(0,1fr));margin-top:26px}
  .steps{grid-template-columns:1fr 1fr}
  .facts div{grid-template-columns:170px minmax(0,1fr)}
  .day{grid-template-columns:64px minmax(0,1fr)}
  .plid{padding:30px 30px 24px}
}
@media (min-width:860px){.chips{flex-wrap:wrap;overflow:visible;margin:0;padding:0 0 10px}}
@media print{
  *{-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .top,.cta,.jsonly,.prog{display:none!important}
  body{font-size:13.5px}section{padding-top:24px}
  .stepc,.tcard,.rung,.dose,.day,.plid,.note,.warn,.inbox,.sup,.rowl,.ck,.syrcard,details.faq{break-inside:avoid}
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
  var nav=d.querySelector('.chips');
  if(nav&&'IntersectionObserver' in window){
    var links={};each('a',function(a){links[a.getAttribute('href').slice(1)]=a},nav);
    var io=new IntersectionObserver(function(es){es.forEach(function(e){
      if(!e.isIntersecting)return;var a=links[e.target.id];if(!a)return;
      for(var k in links)links[k].removeAttribute('aria-current');
      a.setAttribute('aria-current','true');
      try{nav.scrollTo({left:a.offsetLeft-(nav.clientWidth-a.offsetWidth)/2,behavior:'smooth'})}catch(x){}
    })},{rootMargin:'-25% 0px -65% 0px'});
    for(var id in links){var s=d.getElementById(id);if(s)io.observe(s)}
  }
})();
`;

function WebCheck({ k, children }) {
  return html`<label class="ck"><input type="checkbox" data-k=${k} /><span class="bx"></span><span class="tx">${children}</span></label>`;
}

function WebDoc({ st, items, link, home, title }) {
  const generated = new Date();
  const sup = supplyPlan(items);
  const inj = items.filter(i => !i.oral);
  const injPerWeek = items.reduce((a, it) => { const w = it.week(1); return a + (it.oral || !w ? 0 : w.days.length * (w.perDay || 1)); }, 0);
  const drawOf = w => w ? (unitsOf(w.draw) !== null ? String(w.draw).split(' · ')[0] : String(w.draw)) : '—';
  const cid = it => 'c-' + String(it.key).replace(/[^a-zA-Z0-9_-]/g, '');
  // Name and strength apart ("Retatrutide" + "20mg"), without repeating a strength the name already carries.
  const parts = it => { const sp = splitName(it.name); const str = sp[1] || (!it.oral && it.vial && it.name.indexOf(it.vial) < 0 ? it.vial : ''); return [sp[1] ? sp[0] : it.name, str]; };
  const day = generated.toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' });
  const nav = [['plan', 'Overview'], ['supplies', 'Supplies'], ['doses', 'Doses'], ['tracker', 'Tracker']].concat(inj.length ? [['mix', 'Mix'], ['inject', 'Inject']] : [], [['store', 'Storage']]);
  const weeks = [1, 2, 3, 4].map(wk => {
    const days = Array.from({ length: 7 }, (_, i) => items.map(it => { const w = it.week(wk); return w && w.days.indexOf(i) > -1 ? { it, w } : null; }).filter(Boolean));
    return { wk, days, n: days.reduce((a, ds) => a + ds.reduce((b, x) => b + (x.w.perDay || 1), 0), 0) };
  });
  const slot = (per, n) => per > 1 ? (per === 2 ? (n === 0 ? 'Morning' : 'Evening') : 'Dose ' + (n + 1)) : '';
  const firstDraws = inj.map(i => i.name + ' ' + drawOf(i.week(1))).join(', ');
  return html`<header class="top"><div class="wrap">
      <div class="inner"><a class="mark" href=${home} aria-label="optml price list"><i data-mark="1"></i></a><a class="btn sm" href=${link}>Open live tracker</a></div>
      <nav class="chips" aria-label="Sections">${nav.map((n, i) => html`<a href=${'#' + n[0]}><span class="n">${i + 1}</span>${n[1]}</a>`)}</nav>
    </div></header>
    <main class="wrap">
    <div class="hero">
      <div class="copy"><div class="eyebrow">Peptide protocol</div><h1>${title}</h1>
        <p class="lead">${st.by ? 'Prepared by ' + st.by + ' · ' : ''}${day}</p>
        <div class="cta"><a class="btn" href="#tracker">Start the tracker</a><button type="button" class="btn outline jsonly" data-print="1"><${Icon} name="print" size=${16} /> Print</button></div></div>
      <ul class="feats">
        <li><${Icon} name="drop" size=${20} /><span><b>${items.length} compound${items.length === 1 ? '' : 's'}</b>In this protocol</span></li>
        <li><${Icon} name="plan" size=${20} /><span><b>${inj.length ? injPerWeek + ' injection' + (injPerWeek === 1 ? '' : 's') : 'Capsules only'}</b>${inj.length ? 'A week to start' : 'No needles'}</span></li>
        <li><${Icon} name="shop" size=${20} /><span><b>${sup.vials ? sup.vials + ' vial' + (sup.vials === 1 ? '' : 's') : 'No vials'}</b>${sup.vials ? 'First four weeks' : 'Nothing to mix'}</span></li>
        <li><${Icon} name="check" size=${20} /><span><b>${weeks[0].n} dose${weeks[0].n === 1 ? '' : 's'}</b>In week one</span></li>
      </ul>
    </div>

    <section id="plan"><div class="sec-h"><h2>At a glance</h2><p>Your first dose of each compound. Tap one for its full plan.</p></div>
      <div class="rows">${items.map(it => { const w = it.week(1); return html`<a class="rowl" href=${'#' + cid(it)}>${it.icon ? html`<img src=${it.icon} alt="" />` : html`<span class="av">${initials(it.name)}</span>`}
        <span class="grow"><b>${parts(it).filter(Boolean).join(' ')}</b><span>${it.oral ? it.vial : (it.water ? 'Mix with ' + trimNum(it.water, 2) + 'ml bac water' : it.sub)}</span><span>${it.freqText}</span></span>
        <span class="draw">${drawOf(w)}<small>${w ? w.dose : ''}</small></span><${Icon} name="chev" size=${18} /></a>`; })}</div>
      ${st.notes ? html`<h3 class="sub">Notes from ${st.by || 'your practitioner'}</h3><div class="note" style="white-space:pre-line;margin-top:0">${st.notes}</div>` : null}
      <h3 class="sub">Your first five steps</h3>
      <div class="card" id="first">
        <${WebCheck} k="s1">Check your supplies against the list below. Bacteriostatic water comes free with every optml vial.<//>
        <${WebCheck} k="s2">${inj.length ? 'Mix each vial with the volume of bac water shown for it, then label it with the date.' : 'Read the dose plan for each compound and note when to take it.'}<//>
        <${WebCheck} k="s3">${inj.length ? 'Learn to read the syringe: 100 units is 1ml, every unit is 0.01ml.' : 'Take capsules with water at the time shown on the plan.'}<//>
        <${WebCheck} k="s4">${inj.length ? 'First injection: ' + firstDraws + '.' : 'Take your first dose and tick it off in the tracker.'}<//>
        <${WebCheck} k="s5">Tick each dose off in the four-week tracker${inj.length ? ' and rotate your injection site every time' : ''}.<//>
      </div>
    </section>

    <section id="supplies"><div class="sec-h"><h2>What you need</h2><p>Quantities cover the first four weeks.</p></div>
      <div class="rows">
        ${sup.lines.map(l => html`<div class="sup"><b>${l.it.name}</b><span class="q">${l.it.oral ? 'One bottle' : l.vials + ' vial' + (l.vials === 1 ? '' : 's')}</span>
          <p>${l.it.oral ? l.it.vial : l.it.vial + ' vial' + (l.it.vialStart ? ' · one vial lasts about ' + weeksText(Math.min(l.it.vialStart, MIXED_WEEKS)) + ' at the starting dose' : '')}${l.sup.count ? html`<br /><b>Full protocol:</b> ${l.sup.line}` : null}</p></div>`)}
        ${sup.vials ? html`<div class="sup"><b>Bacteriostatic water</b><span class="q">${sup.vials} vial${sup.vials === 1 ? '' : 's'}</span><p>Included free with every optml vial. You need ${trimNum(sup.water, 2)}ml in total.</p></div>` : null}
        ${sup.injections ? html`<div class="sup"><b>Insulin syringes</b><span class="q">About ${sup.syringes}</span><p>1ml (100 unit), 31G, 6–8mm. One per injection plus one per vial you mix.</p></div>
        <div class="sup"><b>Alcohol swabs</b><span class="q">About ${sup.swabs}</span><p>One per injection, two per vial you mix.</p></div>
        <div class="sup"><b>Sharps container</b><span class="q">1</span><p>Free from most Australian pharmacies.</p></div>` : null}
      </div>
    </section>

    <section id="doses"><div class="sec-h"><h2>Your dose plan</h2><p>What to take, when, and how far to draw the syringe at each stage.</p></div>
      ${items.map(it => { const ps = protocolSupply(it); return html`<article class=${'cmp' + (it.goal ? ' g-' + it.goal : '')} id=${cid(it)}>
        <div class="plid"><h3>${parts(it)[0]}${parts(it)[1] ? html`<span>${parts(it)[1]}</span>` : null}</h3>
          <div class="plid-foot">${it.goal && GOAL_ICONS[it.goal] ? html`<span class="lock"><img src=${GOAL_ICONS[it.goal]} alt="" /><span>${GOAL_LABELS[it.goal]}</span></span>` : null}<span class="pchip">${it.whenLabel}</span>${it.kind === 'own' || it.kind === 'custom' ? html`<span class="pchip">Custom titration</span>` : null}</div></div>
        ${it.desc ? html`<p class="pintro">${it.desc}</p>` : null}
        <dl class="facts"><div><dt>${it.vialLabel}</dt><dd>${it.vial || '—'}</dd></div>
          ${!it.oral ? html`<div><dt>Bac water</dt><dd>${it.water ? trimNum(it.water, 2) + 'ml' : '—'}</dd></div><div><dt>Once mixed</dt><dd>${it.conc || '—'}</dd></div>` : null}
          <div><dt>How often</dt><dd>${it.freqText}</dd></div><div><dt>When</dt><dd>${it.timing || it.whenLabel}</dd></div><div><dt>Site</dt><dd>${it.site}</dd></div>
          ${it.duration ? html`<div><dt>Duration</dt><dd>${it.duration}</dd></div>` : null}
          ${ps.count ? html`<div><dt>${it.oral ? 'Bottles needed' : 'Vials needed'}</dt><dd>${ps.text}${ps.forText ? ' ' + ps.forText : ''}</dd></div>` : null}</dl>
        ${!it.oral && it.water ? html`<div class="inbox"><${Icon} name="drop" size=${20} /><span><b>To mix:</b> add ${trimNum(it.water, 2)}ml of bac water slowly down the inside wall of the vial. Roll gently, never shake. Date the label and refrigerate at 2–8°C. Use a mixed vial within 4 weeks.</span></div>` : null}
        <h4 class="h4">Dose plan</h4>
        <${Ladder} rows=${it.rows} syringes=${!it.oral} />
        ${st.inotes[it.key] ? html`<div class="note" style="white-space:pre-line"><b>Notes:</b> ${st.inotes[it.key]}</div>` : null}
        ${it.note ? html`<div class="note">${it.note}</div>` : null}
      </article>`; })}
    </section>

    <section id="tracker"><div class="sec-h"><h2>Four-week tracker</h2><p>Tick each dose as you take it. The number on the right is what to draw on a 1ml insulin syringe.</p></div>
      <div class="prog jsonly"><div class="bar"><i data-bar="1"></i></div><span data-prog="1"></span></div>
      ${weeks.map(wkd => html`<details class="wk" open=${wkd.wk === 1}><summary>Week ${wkd.wk}<span class="cnt">${wkd.n} dose${wkd.n === 1 ? '' : 's'}</span></summary>
        ${wkd.days.map((ds, i) => ds.length ? html`<div class="day"><div class="dl">Day ${(wkd.wk - 1) * 7 + i + 1}</div><div class="doses">
          ${ds.map(x => Array.from({ length: x.w.perDay || 1 }, (_, n) => html`<label class="dose"><input type="checkbox" data-k=${'t' + wkd.wk + '-' + i + '-' + cid(x.it) + '-' + n} /><span class="bx"></span>
            <span class="tx"><b>${x.it.name}</b><small>${[slot(x.w.perDay || 1, n), x.w.dose].filter(Boolean).join(' · ')}</small></span><span class="u">${unitsOf(x.w.draw) !== null ? drawOf(x.w) : (x.it.oral ? shortDraw(x.w.draw) : '')}</span></label>`))}
        </div></div>` : html`<div class="day rest"><div class="dl">Day ${(wkd.wk - 1) * 7 + i + 1}</div><p>Rest day</p></div>`)}
      </details>`)}
      <div class="ckfoot jsonly"><button type="button" class="btn sm outline" data-reset="tracker">Clear the tracker</button></div>
    </section>

    ${inj.length ? html`<section id="mix"><div class="sec-h"><h2>How to mix a vial</h2><p>Under five minutes, using the bac water that comes in the box.</p></div>
      <div class="steps">${STEPS.map(s => html`<div class="stepc"><span class="n">${s.n}</span><div><h4>${s.title}</h4><p>${s.body}</p><div class="tip">${s.tip}</div></div></div>`)}</div>
      <h3 class="sub">Reading your syringe</h3>
      <div class="syrcard"><div class="read" data-read="1">20 units = 0.20ml</div>
        <div><div class="syr" role="img" aria-label="Syringe"><span class="needle"></span><span class="hub"></span><span class="barrel"><span class="fill" data-fill="1" style="width:20%"></span><span class="ticks">${Array.from({ length: 10 }, () => html`<span></span>`)}</span></span><span class="flange"></span><span class="rod"></span><span class="thumb"></span></div>
          <div class="syr-scale"><span>0</span><span>25</span><span>50</span><span>75</span><span>100</span></div></div>
        <label class="jsonly">Slide to see where the plunger sits<input type="range" min="0" max="100" step="1" data-range="1" aria-label="Units to draw" /></label>
        <p class="small">A 1ml insulin syringe holds 100 units, so every unit is 0.01ml. "Draw 20 units" means pull the plunger until the top edge of the black stopper sits on the 20 line.</p></div>
    </section>

    <section id="inject"><div class="sec-h"><h2>How to inject</h2><p>Subcutaneous: into the fat just under the skin, not the muscle.</p></div>
      <div class="tcards">${TABS.technique.map(c => html`<div class="tcard"><h4>${c.title}</h4><p>${c.body}</p>${c.meta ? html`<div class="meta">${c.meta}</div>` : null}</div>`)}</div>
      <h3 class="sub">Where to inject and how to rotate</h3>
      <div class="tcards">${['abdomen', 'flank', 'thigh', 'arm'].map(k => html`<div class="tcard"><h4>${SITE_INFO[k].name} · ${SITE_INFO[k].route}</h4><p>${SITE_INFO[k].why}</p><div class="meta">Avoid: ${SITE_INFO[k].avoid}</div></div>`)}</div>
      <div class="note">Treat your abdomen like a clock face around the navel, at least 5cm out. Move one position clockwise every dose: eight positions brings you back to the same spot about once a week.</div>
      <h3 class="sub">Before every injection</h3>
      <div class="card" id="pre">
        <${WebCheck} k="p1">Vial at room temperature for 10–15 minutes.<//>
        <${WebCheck} k="p2">Fresh swab on the stopper, let it dry.<//>
        <${WebCheck} k="p3">New 31G insulin syringe, draw to the units on your plan.<//>
        <${WebCheck} k="p4">Pinch, 45°, inject slowly over 5–10 seconds.<//>
        <${WebCheck} k="p5">Next site in your rotation. Sharps straight into the container.<//>
        <div class="ckfoot jsonly"><button type="button" class="btn sm outline" data-reset="pre">Clear for next time</button></div>
      </div>
    </section>` : null}

    <section id="store"><div class="sec-h"><h2>Storage and common questions</h2></div>
      <div class="tcards">${STORAGE.map(c => html`<div class="tcard"><h4>${c.title}</h4><p>${c.body}</p>${c.meta ? html`<div class="meta">${c.meta}</div>` : null}</div>`)}</div>
      ${inj.length ? html`<div style="margin-top:22px;border-top:1px solid var(--n200)">${FAQS.map(f => html`<details class="faq"><summary>${f.q}</summary><p>${f.a}</p></details>`)}</div>` : null}
    </section>
    </main>

    <footer><div class="wrap"><a class="mark" href=${home} aria-label="optml price list"><i data-mark="1"></i></a>
      <h2>Need more, or have a question?</h2>
      <p>Reorder from the price list, or email <a href=${'mailto:' + CONTACT}>${CONTACT}</a> about your order.</p>
      <div class="cta"><a class="btn on-dark" href=${home}>Open the price list</a><a class="btn on-dark-outline" href=${link}>Open live tracker</a></div>
      <p class="fine">${DISCLAIMER}</p></div></footer>`;
}

function buildWebDoc(st, items) {
  const title = st.client ? 'Protocol for ' + st.client.trim() : 'Your protocol';
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
  const slug = String(st.client || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
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
