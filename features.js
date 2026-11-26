/* ============================================================
   OPTML CRM — features.js  (loaded after app.js)
   Owner intelligence layer:
     Radar ....... who's due to reorder, who's slipping, one-tap WhatsApp nudges (one by one queue)
     Customer 360  rhythm, next order date, profit from them, "Repeat last order"
     Health ...... sales pace, run-out dates, restock planner in 10-packs, dead stock, stock-take shrinkage
     Money ....... monthly P&L, business expenses, take-home profit, target + pace, unpaid chasing
     Activity .... who did what (database audit log)
     Search ...... one box for customers, sales, tracking numbers and products
     Pulse ....... Home card: month so far + what to chase today
   Every owner screen is guarded by App.ownerOnly() and marked .owner-only.
   ============================================================ */
'use strict';

// ---------- shared helpers ----------
const dBetween=(a,b)=>Math.round((new Date(b+'T00:00:00')-new Date(a+'T00:00:00'))/864e5);
const agoTxt=n=>n<=0?'today':n===1?'yesterday':n+'d ago';
const inTxt=n=>n<=0?'today':n===1?'tomorrow':'in '+n+'d';
const plural=(n,w)=>n+' '+w+(n===1?'':'s');
// most vials of any one product in a sale (products in one order are used side by side, so this sets how long it lasts)
const vialsMax=s=>{ const m={}; (s.items||[]).forEach(i=>{ const k=i.product_id||i.name; m[k]=(m[k]||0)+(+i.pack_qty||1)*(+i.count||1); }); return Math.max(0,...Object.values(m)); };
const monthName=m=>new Date(m+'-01T00:00:00').toLocaleDateString('en-AU',{month:'long',year:'numeric'});

// Sheets opened later always sit on top (a customer opened from Insights or Radar used to open underneath it)
Sheet.z=0;
Sheet.open=function(id){ const e=$(id); if(!e) return; if(!document.querySelector('.sheet.on,.drawer-bg.on')) this.z=0; this.z=Math.min(this.z+1,290); e.style.zIndex=String((e.classList.contains('drawer-bg')?500:100)+this.z); e.classList.add('on'); };

const mk={
  sheet(id,title,extra=''){ if(!$(id)) document.body.insertAdjacentHTML('beforeend',`<div class="sheet" id="${id}"><div class="sheet-h"><button class="iconb" onclick="Sheet.close('${id}')">×</button><h2>${title}</h2>${extra}</div><div class="sheet-b" id="${id}-b" style="padding-bottom:40px"></div></div>`); return $(id+'-b'); },
  drawer(id,html){ if($(id)) return; document.body.insertAdjacentHTML('beforeend',`<div class="drawer-bg" id="${id}"><div class="drawer"><div class="grab"></div>${html}</div></div>`); const d=$(id); d.addEventListener('click',e=>{ if(e.target===d) d.classList.remove('on'); }); },
};

// ---------- settings for this layer (Settings → Insights & nudges) ----------
const INTEL_DEFAULTS={
  cycle_days:30, lead_days:14, target_days:45, month_target:0, payid:'0408769377',
  nudge_template:"Hey {first_name}! 😊 Just checking in — how are you going with your {product}? You'd be getting close to running low, want me to put another one aside for you? 📦",
  winback_template:"Hey {first_name}! Hope you've been well 😊 It's been a little while — if you need a restock of your {product} or anything else, just let me know and I'll get it sorted for you 🙌",
  prospect_template:"Hey {first_name}! 😊 Just a heads up — we're fully stocked at the moment. If you've got any questions or want the price list, just let me know 🙌",
  remind_template:"Hey {first_name}! Just a friendly reminder about your order #{sale_no} — {total} 😊\n\nPayID: {payid}\n\nAs soon as it comes through I'll get it packed and sent 📦",
  web_template:"Hey {first_name}! Thanks for your order {ref} 😊\n\n{items}\n\nTotal: {total}\n\nPayID: {payid}\nReference: {ref}\n\nAs soon as payment comes through I'll get it packed and sent 📦",
  web_paid_template:"Thanks {first_name}! Payment received for {ref} 🙌\n\n{items}\n\nI'll get it packed and sent out, and you'll get your tracking as soon as it's dropped at the post office 📦",
  web_left_template:"Hey {first_name}! I saw you started an order on the price list 😊\n\n{items}\n\nTotal: {total}\n\nWant me to lock it in for you? Happy to answer any questions too.",
};
const Intel={
  cfg(){ const o={...INTEL_DEFAULTS}; Object.entries(Store.get('intel')||{}).forEach(([k,v])=>{ if(v!==''&&v!=null) o[k]=v; }); ['cycle_days','lead_days','target_days','month_target'].forEach(k=>o[k]=+o[k]||0); o.cycle_days=o.cycle_days||30; o.lead_days=o.lead_days||14; o.target_days=o.target_days||45; return o; },
  live(){ return Store.cache.sales.filter(s=>s.status!=='Cancelled'); },
  fill(t,v){ return String(t||'').replace(/\{(\w+)\}/g,(m,k)=>v[k]!=null?String(v[k]):m); },
};

// ---------- who's who (owner reads the team list) ----------
const Who={ map:{}, me:null,
  async load(){ if(Store.mode!=='cloud'||App.courier) return; try{ const {data:{session}}=await Store.sb.auth.getSession(); this.me=session&&session.user?session.user.id:null; const {data}=await Store.sb.from('app_users').select('user_id,name,email'); (data||[]).forEach(u=>{ const n=(u.name||(u.email||'').split('@')[0]||'').trim(); this.map[u.user_id]=n?n.charAt(0).toUpperCase()+n.slice(1):'Someone'; }); }catch(e){} },
  name(id){ if(!id) return ''; if(id===this.me) return 'You'; return this.map[id]||''; },
};

// ============================================================
// REORDER RADAR
// ============================================================
const Radar={
  seg:'due', queue:null, qi:0, cur:null,
  hasCol(){ return Store.mode==='local'||Store.cache.customers.some(c=>Object.prototype.hasOwnProperty.call(c,'last_contacted_at')); },
  ls(){ try{ return JSON.parse(localStorage.getItem('optml_contacted')||'{}'); }catch(e){ return {}; } },
  byCust(){ const m={}; Intel.live().forEach(s=>{ if(s.customer_id) (m[s.customer_id]=m[s.customer_id]||[]).push(s); }); Object.values(m).forEach(L=>L.sort((a,b)=>a.date<b.date?-1:a.date>b.date?1:0)); return m; },
  // everything we can say about one customer's buying rhythm
  profile(c,m){
    const cfg=Intel.cfg(); const S=(m||this.byCust())[c.id]||[]; const t=today();
    const last=[c.last_seen,S.length?S[S.length-1].date:null].filter(Boolean).sort().pop()||null;
    const orders=Math.max(+c.order_count||0,S.length);
    const first=[localDay(c.created_at),S.length?S[0].date:null].filter(Boolean).sort()[0]||last;
    let interval=null, basis='';
    const dates=[...new Set(S.map(s=>s.date))];
    if(dates.length>=2){ const g=[]; for(let i=1;i<dates.length;i++) g.push(dBetween(dates[i-1],dates[i])); g.sort((a,b)=>a-b); interval=g[Math.floor(g.length/2)]; basis='how often they order'; }
    else if(orders>=2&&first&&last&&last>first){ interval=Math.round(dBetween(first,last)/(orders-1)); basis='their order history'; }
    const lastSale=S[S.length-1]||null; const v=lastSale?vialsMax(lastSale):0;
    if(!interval||interval<7){ interval=Math.min(120,cfg.cycle_days*Math.max(1,v||1)); basis=v?`${plural(v,'vial')} last order × ${cfg.cycle_days} days`:`a typical ${cfg.cycle_days}-day cycle`; }
    interval=Math.max(7,Math.min(180,interval));
    const next=last?addDays(interval,last):null; const du=next?dBetween(t,next):null;
    let st='ok'; if(!orders||!last) st='never'; else if(du>7) st='ok'; else if(du>0) st='soon'; else if(du>=-21) st='due'; else if(du>=-75) st='slipping'; else st='lapsed';
    const ca=c.last_contacted_at||this.ls()[c.id]||null; const cDays=ca?dBetween(localDay(ca),t):null;
    const nudged=!!ca&&(!last||localDay(ca)>=last)&&cDays<10;
    const fc={}; S.forEach(s=>(s.items||[]).forEach(i=>fc[i.name]=(fc[i.name]||0)+(+i.pack_qty||1)*(+i.count||1))); const fav=Object.entries(fc).sort((a,b)=>b[1]-a[1]);
    const appRev=sum(S,s=>+s.total); const spent=Math.max(+c.total_spent||0,appRev);
    const aov=S.length?appRev/S.length:(orders&&spent?spent/orders:0);
    return {c,S,last,orders,first,interval,basis,next,du,st,ca,cDays,nudged,spent,aov,fav,top:fav[0]?fav[0][0]:'',lastSale,profit:App.courier?0:sum(S,s=>Profit.of(s).net)};
  },
  all(){ const m=this.byCust(); return Store.cache.customers.map(c=>this.profile(c,m)); },
  inSeg(p,k){ return k==='due'?['soon','due'].includes(p.st):k==='vip'?p.orders>0:p.st===k; },
  sorted(L,k){ if(k==='vip') return [...L].sort((a,b)=>b.spent-a.spent).slice(0,30); const n=p=>p.nudged?1:0; return [...L].sort((a,b)=>n(a)-n(b)||(k==='never'?(a.c.name||'').localeCompare(b.c.name||''):(a.du??0)-(b.du??0))); },
  tag(p){ return ({soon:['amber','due '+inTxt(p.du)],due:['red',p.du===0?'due today':'due '+agoTxt(-p.du)],slipping:['red',(-p.du)+'d overdue'],lapsed:['gray','lapsed'],never:['gray','never ordered'],ok:['go','next '+fmtDate(p.next)]})[p.st]; },
  open(seg){ if(!App.ownerOnly()) return; if(seg) this.seg=seg; mk.sheet('sh-radar','Reorder <em>radar</em>'); Sheet.open('sh-radar'); this.render(); },
  render(){
    const b=$('sh-radar-b'); if(!b) return; const all=this.all(); const cnt=k=>all.filter(p=>this.inSeg(p,k)).length;
    const L=this.sorted(all.filter(p=>this.inSeg(p,this.seg)),this.seg); const due=all.filter(p=>this.inSeg(p,'due'));
    const worth=sum(due,p=>p.aov); const ready=L.filter(p=>p.c.phone&&!p.nudged&&this.seg!=='vip');
    b.innerHTML=`<div class="strip"><div class="s"><div class="k">Due now</div><div class="v ${due.length?'amber':''}">${due.length}</div><div class="d">~${money(worth)} if all reorder</div></div><div class="s"><div class="k">Slipping</div><div class="v ${cnt('slipping')?'red':''}">${cnt('slipping')}</div><div class="d">3–10 wks late</div></div><div class="s"><div class="k">Lapsed</div><div class="v">${cnt('lapsed')}</div><div class="d">${cnt('never')} never ordered</div></div></div>
      <div class="seg scroll" style="margin-bottom:12px">${[['due','Due now'],['slipping','Slipping'],['lapsed','Lapsed'],['never','Never ordered'],['vip','Best']].map(([k,l])=>`<button class="${this.seg===k?'on':''}" onclick="Radar.seg='${k}';Radar.render()">${l} <b>${k==='vip'?Math.min(30,cnt(k)):cnt(k)}</b></button>`).join('')}</div>
      ${ready.length?`<button class="btn go block" style="margin-bottom:12px" onclick="Radar.startQueue()">Message ${ready.length} ${ready.length===1?'person':'people'} — one tap each</button>`:''}
      <div class="card">${L.map(p=>this.row(p)).join('')||`<div class="empty"><div class="big">✓</div>${this.seg==='due'?'Nobody is due right now':'Nobody here'}</div>`}</div>
      <div class="hint" style="margin-top:12px">Next order = last order + their usual gap (once they've ordered twice), otherwise vials in their last order × ${Intel.cfg().cycle_days} days. Anyone you message drops to the bottom for 10 days. Change the numbers and messages in Settings → Insights &amp; nudges.</div>`;
  },
  row(p){ const c=p.c; const [tc,tt]=this.tag(p);
    return `<div class="row"><div class="av" onclick="Cust.detail('${c.id}')">${esc((c.name||'?')[0].toUpperCase())}</div><div class="m tap" onclick="Cust.detail('${c.id}')"><div class="t">${esc(c.name)}<span class="tag ${tc}">${esc(tt)}</span>${p.nudged?`<span class="tag blue">messaged ${agoTxt(p.cDays)}</span>`:''}</div><div class="u">${p.last?`last ${fmtDate(p.last)} · every ~${p.interval}d`:'no orders yet'}${p.top?' · '+esc(p.top):''}</div><div class="w"><span>${plural(p.orders,'order')}</span>${p.spent?`<span>${money(p.spent)}</span>`:''}${c.phone?'':'<span>no phone</span>'}</div></div><div class="e">${c.phone?`<button class="btn xs ${p.nudged?'':'go'}" onclick="Radar.nudge('${c.id}')">Message</button>`:''}${p.lastSale?`<button class="btn xs" onclick="Radar.repeat('${p.lastSale.id}')">Repeat</button>`:''}</div></div>`; },
  msgFor(p){ const cfg=Intel.cfg(); const t=p.st==='never'?cfg.prospect_template:['slipping','lapsed'].includes(p.st)?cfg.winback_template:cfg.nudge_template;
    return Intel.fill(t,{first_name:firstName(p.c.name),name:p.c.name||'',product:p.top||'order',last_date:p.last?fmtDate(p.last):'',payid:cfg.payid}); },
  drawer(){ mk.drawer('dr-nudge',`<h3 id="nd-title">Message</h3><div class="hint" id="nd-sub" style="margin-top:-6px"></div><div class="f"><textarea class="in" id="nd-text" rows="7" style="font-size:14px"></textarea></div><div class="actions" style="margin-bottom:8px"><button class="btn go block" onclick="Radar.send()">Send on WhatsApp</button></div><div class="actions"><button class="btn" id="nd-skip" onclick="Radar.skip()">Close</button><button class="btn" onclick="Radar.copy()">Copy</button><button class="btn ink" onclick="Radar.done()">Mark messaged</button></div><div class="hint" id="nd-queue" style="text-align:center"></div>`); },
  nudge(id){ if(!App.ownerOnly()) return; this.queue=null; this.show(id); },
  show(id){ const c=Store.cache.customers.find(x=>x.id===id); if(!c) return; const p=this.profile(c); this.cur=p; this.drawer();
    $('nd-title').textContent=c.name; $('nd-sub').textContent=`${this.tag(p)[1]}${p.last?' · last order '+fmtDate(p.last):''}${p.nudged?' · messaged '+agoTxt(p.cDays):''} · ${c.phone||'no phone'}`;
    $('nd-text').value=this.msgFor(p); $('nd-skip').textContent=this.queue?'Skip':'Close';
    $('nd-queue').textContent=this.queue?`${this.qi+1} of ${this.queue.length}`:''; Sheet.open('dr-nudge'); },
  async mark(id){ const iso=new Date().toISOString(); const m=this.ls(); m[id]=iso; try{ localStorage.setItem('optml_contacted',JSON.stringify(m)); }catch(e){} const c=Store.cache.customers.find(x=>x.id===id); if(c&&this.hasCol()){ c.last_contacted_at=iso; try{ await Store.upsert('customers',{id,last_contacted_at:iso}); }catch(e){} } },
  send(){ const p=this.cur; if(!p) return; if(WA.open(p.c.phone,$('nd-text').value)) { this.mark(p.c.id); this.advance(); } },
  done(){ const p=this.cur; if(!p) return; this.mark(p.c.id); toast('Marked as messaged'); this.advance(); },
  copy(){ copyText($('nd-text').value).then(ok=>toast(ok?'Copied':'Couldn’t copy — select the text instead',ok?'ok':'err')); },
  skip(){ this.advance(); },
  advance(){ if(this.queue&&this.qi<this.queue.length-1){ this.qi++; this.show(this.queue[this.qi]); } else { if(this.queue) toast('All done ✓'); this.queue=null; Sheet.close('dr-nudge'); } if($('sh-radar')&&$('sh-radar').classList.contains('on')) this.render(); if(Nav.cur==='home') Pulse.render(); if(Nav.cur==='customers') Cust.render(); },
  startQueue(){ const L=this.sorted(this.all().filter(p=>this.inSeg(p,this.seg)),this.seg).filter(p=>p.c.phone&&!p.nudged); if(!L.length) return; this.queue=L.map(p=>p.c.id); this.qi=0; this.show(this.queue[0]); },
  // load a past order into a new sale at today's prices
  repeat(saleId){ const s=Store.cache.sales.find(x=>x.id===saleId); if(!s) return;
    ['sh-radar','sh-cust','sh-sale','sh-search'].forEach(id=>$(id)&&Sheet.close(id)); Sell.reset(); Sell.open(); const warn=[];
    (s.items||[]).forEach(i=>{ const q=+i.pack_qty||1, n=+i.count||1;
      if(i.product_id){ const p=Store.cache.products.find(x=>x.id===i.product_id); if(!p){ warn.push(i.name+' (no longer listed)'); return; }
        const ix=[1,3,5,10].indexOf(q); const pr=ix>=0?[p.sell1,p.sell3,p.sell5,p.sell10][ix]:null; const ex=Sell.cart.find(c=>c.product_id===p.id&&c.pack_qty===q);
        if(ex) ex.count+=n; else Sell.cart.push({product_id:p.id,name:p.name,sku:p.sku,pack_qty:q,count:n,price:+pr||+i.price||0,bac_size:p.bac_size||'3ml'});
        if((+p.stock||0)<q*n) warn.push(p.name+(App.courier?' (low stock)':` (${+p.stock||0} in stock)`)); }
      else Sell.cart.push({product_id:null,name:i.name,sku:'',pack_qty:1,count:n,price:+i.price||0,custom:true}); });
    Sell.autoBac(); Sell.renderCart(); if(s.customer_id&&Store.cache.customers.find(c=>c.id===s.customer_id)) Sell.fillCustomer(s.customer_id);
    toast(warn.length?'Loaded — check: '+warn.join(', '):'Last order loaded at today’s prices',warn.length?'err':'ok',4500); },
};

// ============================================================
// STOCK HEALTH & RESTOCK PLANNER
// ============================================================
const Health={
  pace(){ const L=Intel.live(); const t=today(); const v={}, last={}; if(!L.length) return {v,win:30,last};
    const first=L.map(s=>s.date).sort()[0]; const win=Math.max(7,Math.min(30,dBetween(first,t)+1)); const from=addDays(-(win-1));
    const b3=Store.cache.products.find(p=>p.sku==='BW03'), b10=Store.cache.products.find(p=>p.sku==='BW10');
    L.forEach(s=>{ const add=(pid,n)=>{ if(!pid||!n) return; if(s.date>=from) v[pid]=(v[pid]||0)+n; if(!last[pid]||s.date>last[pid]) last[pid]=s.date; };
      (s.items||[]).forEach(i=>add(i.product_id,(+i.pack_qty||1)*(+i.count||1))); if(b3) add(b3.id,+s.bac3||0); if(b10) add(b10.id,+s.bac10||0); });
    return {v,win,last}; },
  rows(){ const {v,win,last}=this.pace(); const cfg=Intel.cfg(); const fx=Profit.cfg().fx;
    return Store.cache.products.filter(p=>!p.hidden&&!p.soon).map(p=>{ const sold=v[p.id]||0, perDay=sold/win, inc=Inv.incoming(p.id), stock=+p.stock||0;
      const cover=perDay?Math.floor((Math.max(0,stock)+inc)/perDay):null; const runout=perDay?addDays(Math.max(0,Math.floor(Math.max(0,stock)/perDay))):null;
      let sug=Math.max(0,Math.ceil(perDay*(cfg.lead_days+cfg.target_days))-Math.max(0,stock)-inc); if(sug>0) sug=Math.ceil(sug/10)*10;
      return {p,sold,perDay,perWeek:perDay*7,inc,stock,cover,runout,sug,valAUD:Math.max(0,stock)*(+p.cost||0)*fx,lastSold:last[p.id]||null,urgent:perDay>0&&cover!==null&&cover<cfg.lead_days+7}; }); },
  go(){ if(!App.ownerOnly()) return; ['sh-search','sh-radar','sh-money'].forEach(id=>$(id)&&Sheet.close(id)); Nav.go('stock'); Inv.view('health'); },
  render(){
    const el=$('stock-health'); if(!el) return; const R=this.rows(); const {win}=this.pace(); const cfg=Intel.cfg(); const fx=Profit.cfg().fx;
    const order=R.filter(r=>r.sug>0).sort((a,b)=>(a.cover??-1)-(b.cover??-1)); const urgent=R.filter(r=>r.urgent);
    const slow=R.filter(r=>r.stock>0&&r.sold===0).sort((a,b)=>b.valAUD-a.valAUD); const total=sum(R,r=>r.valAUD), slowVal=sum(slow,r=>r.valAUD);
    const sugUSD=sum(order,r=>r.sug*(+r.p.cost||0)); const neg=R.filter(r=>r.stock<0);
    const col=r=>r.cover===null?'var(--ink-4)':r.cover<cfg.lead_days+7?'var(--red)':r.cover<cfg.lead_days+cfg.target_days?'var(--amber)':'var(--go)';
    const takes=(Store.cache.stocktakes||[]).filter(t=>['applied','applying'].includes(t.status)).map(t=>{ const rows=Take.rows(t); const short=sum(rows.filter(r=>r.diff<0),r=>-r.diff), over=sum(rows.filter(r=>r.diff>0),r=>r.diff); return {t,short,over,usd:sum(rows,r=>r.diff*r.cost)}; });
    el.innerHTML=`<div class="strip"><div class="s"><div class="k">Stock at cost</div><div class="v">${money(total)}</div><div class="d">A$ · ${sum(R,r=>Math.max(0,r.stock))} vials</div></div><div class="s"><div class="k">Running out</div><div class="v ${urgent.length?'red':''}">${urgent.length}</div><div class="d">before a reorder lands</div></div><div class="s"><div class="k">Not selling</div><div class="v ${slow.length?'amber':''}">${slow.length}</div><div class="d">${money(slowVal)} tied up</div></div></div>
      ${neg.length?`<div class="note red" style="margin-bottom:12px"><b>Below zero:</b> ${neg.map(r=>esc(r.p.name)+' ('+r.stock+')').join(', ')} — more was sold than the app had. Do a stock count to fix it.</div>`:''}
      <div class="sec" style="margin-top:0">Order now <small>${order.length?plural(order.length,'product')+' · ~US$'+Math.round(sugUSD).toLocaleString():'nothing needed'}</small></div>
      <div class="card">${order.map(r=>`<div class="row tap" onclick="Inv.openEdit('${r.p.id}')"><div class="m"><div class="t">${esc(r.p.name)}${r.urgent?'<span class="tag red">urgent</span>':''}</div><div class="u">${r.stock} in stock${r.inc?' +'+r.inc+' coming':''} · ${r.perWeek.toFixed(1)}/wk · ${r.stock<=0?'out now':'runs out ~'+fmtDate(r.runout)}</div></div><div class="e"><span class="amt" style="color:var(--blue)">+${r.sug}</span><span class="hint" style="margin:0">${r.cover===null?'':r.cover+'d left'}</span></div></div>`).join('')||'<div class="empty"><div class="big">✓</div>Everything covers the next '+(cfg.lead_days+cfg.target_days)+' days</div>'}</div>
      ${order.length?`<div class="actions" style="margin:10px 0 0"><button class="btn go" onclick="Health.toPO()">Create incoming order</button><button class="btn" onclick="Health.copyList()">Copy supplier list</button></div>`:''}
      <div class="sec">All products <small>days left · ${win}-day pace</small></div>
      <div class="card">${[...R].sort((a,b)=>(a.cover??1e9)-(b.cover??1e9)||b.valAUD-a.valAUD).map(r=>`<div class="row tap" onclick="Inv.openEdit('${r.p.id}')"><div class="m"><div class="t">${esc(r.p.name)}</div><div class="u">${r.stock} in stock${r.inc?' +'+r.inc+' coming':''} · ${r.sold?r.perWeek.toFixed(1)+'/wk':'no sales in '+win+'d'}${r.lastSold?' · last sold '+fmtDate(r.lastSold):''}</div></div><div class="e"><span class="amt" style="color:${col(r)}">${r.cover===null?'—':r.cover+'d'}</span><span class="hint" style="margin:0">${money(r.valAUD)}</span></div></div>`).join('')}</div>
      ${slow.length?`<div class="sec">Not selling <small>no sales in ${win} days</small></div><div class="card">${slow.map(r=>`<div class="row"><div class="m"><div class="t">${esc(r.p.name)}</div><div class="u">${r.stock} on the shelf · ${r.lastSold?'last sold '+fmtDate(r.lastSold):'not sold since the app started'}</div></div><div class="e"><span class="amt" style="color:var(--amber)">${money(r.valAUD)}</span></div></div>`).join('')}</div><div class="hint">Ideas: bundle it into a stack, offer it in a reorder message, or stop reordering it.</div>`:''}
      <div class="sec">Stock counts <small>missing vs the app</small></div>
      <div class="card">${takes.map(x=>`<div class="row tap" onclick="Take.open();Take.review('${x.t.id}')"><div class="m"><div class="t">${new Date(x.t.submitted_at||x.t.created_at).toLocaleDateString('en-AU',{day:'numeric',month:'short'})} · ${esc(x.t.counted_by||'courier')}</div><div class="u">${x.short} short · ${x.over} extra</div></div><div class="e"><span class="amt" style="color:${x.usd<0?'var(--red)':'var(--go)'}">${x.usd<0?'−':'+'}A$${Math.abs(Math.round(x.usd*fx))}</span><span class="hint" style="margin:0">at cost</span></div></div>`).join('')||'<div class="empty">No counts applied yet</div>'}</div>
      <div class="hint" style="margin-top:12px">Suggestions cover ${cfg.lead_days} days for the supplier to deliver plus ${cfg.target_days} days on the shelf, rounded up to 10-packs, minus what's already coming. Change these in Settings → Insights &amp; nudges.</div>`;
    const n=$('health-n'); if(n) n.textContent=urgent.length;
  },
  toPO(){ if(!App.ownerOnly()) return; const order=this.rows().filter(r=>r.sug>0); if(!order.length){ toast('Nothing to order right now'); return; } PO.open(); PO.lines=order.map(r=>({product_id:r.p.id,qty:r.sug,unit_cost:+r.p.cost||'',currency:'USD',cost_auto:true})); PO.renderLines(); toast('Suggested order loaded — adjust and save'); },
  copyList(){ const order=this.rows().filter(r=>r.sug>0).sort((a,b)=>a.p.name.localeCompare(b.p.name)); copyText(order.map(r=>`${r.p.supplier_sku||r.p.sku} — ${r.p.name} × ${r.sug}`).join('\n')).then(ok=>toast(ok?'Supplier list copied':'Couldn’t copy',ok?'ok':'err')); },
};

// ============================================================
// MONEY — monthly P&L, business expenses, unpaid orders
// ============================================================
const EXP_CATS=['Ads & marketing','Software & apps','Phone & internet','Supplies','Bank & fees','Travel','Wages','Other'];
const Money={
  m:null,
  range(m){ const [y,mo]=m.split('-').map(Number); const dim=new Date(y,mo,0).getDate(); return [m+'-01',m+'-'+String(dim).padStart(2,'0'),dim]; },
  addM(m,d){ const [y,mo]=m.split('-').map(Number); const x=new Date(y,mo-1+d,1); return `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}`; },
  month(m){ const [f,t,dim]=this.range(m); const S=Intel.live().filter(s=>s.date>=f&&s.date<=t); const P=Profit.sumOf(S); const E=(Store.cache.expenses||[]).filter(e=>e.date>=f&&e.date<=t); const exp=sum(E,e=>+e.amount);
    return {m,f,t,dim,S,E,P,rev:sum(S,s=>+s.total),disc:sum(S,s=>+s.discount||0),exp,take:Math.round((P.net-exp)*100)/100}; },
  open(){ if(!App.ownerOnly()) return; this.m=this.m||today().slice(0,7); mk.sheet('sh-money','<em>Money</em>'); Sheet.open('sh-money'); this.render(); },
  shift(d){ const n=this.addM(this.m,d); if(n>today().slice(0,7)) return; this.m=n; this.render(); },
  unpaid(){ return Store.cache.sales.filter(s=>s.status!=='Cancelled'&&!s.paid_at).sort((a,b)=>a.date<b.date?-1:1); },
  render(){
    const b=$('sh-money-b'); if(!b) return; const cfg=Intel.cfg(); const fx=Profit.cfg().fx; const pc=Profit.cfg();
    const M=this.month(this.m), PM=this.month(this.addM(this.m,-1)); const isCur=this.m===today().slice(0,7);
    const day=isCur?+today().slice(8,10):M.dim; const left=M.dim-day; const proj=isCur?M.rev/day*M.dim:M.rev; const projTake=isCur?M.P.net/day*M.dim-M.exp:M.take;
    const tgt=cfg.month_target; const pct=tgt?Math.min(100,Math.round(M.rev/tgt*100)):0;
    const byPay={}; M.S.forEach(s=>{ if(s.payment==='Split') (s.split_payments||[]).forEach(p=>byPay[p.method]=(byPay[p.method]||0)+ +p.amount); else byPay[s.payment||'—']=(byPay[s.payment||'—']||0)+ +s.total; });
    const U=this.unpaid(); const uTot=sum(U,s=>+s.total);
    const stockVal=sum(Store.cache.products.filter(p=>!p.hidden),p=>Math.max(0,+p.stock||0)*(+p.cost||0))*fx; const owed=Courier.totals().balance;
    const byCat={}; M.E.forEach(e=>byCat[e.category||'Other']=(byCat[e.category||'Other']||0)+ +e.amount);
    const six=Array.from({length:6},(_,i)=>this.month(this.addM(this.m,i-5))); const smax=Math.max(1,...six.map(x=>x.rev));
    const tl=(k,v,st='')=>`<div class="tl ${st}"><span class="k">${k}</span><span class="v">${v}</span></div>`;
    const EX=Store.cache.expenses;
    b.innerHTML=`<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px"><button class="btn sm" onclick="Money.shift(-1)">‹</button><b style="font-family:var(--serif);font-size:22px;font-weight:400">${monthName(this.m)}</b><button class="btn sm" onclick="Money.shift(1)" ${isCur?'disabled':''}>›</button></div>
      <div class="strip c2"><div class="s"><div class="k">Revenue</div><div class="v">${money(M.rev)}</div><div class="d">${plural(M.S.length,'order')}${Insights.delta(M.rev,PM.rev)}</div></div><div class="s"><div class="k">Take-home</div><div class="v ${M.take>=0?'go':'red'}">${money(M.take)}</div><div class="d">${M.rev?Math.round(M.take/M.rev*100):0}% of revenue${Insights.delta(M.take,PM.take)}</div></div></div>
      ${isCur?`<div class="card" style="margin-bottom:12px"><div class="pad">${tgt?`${tl('Target '+money(tgt),pct+'%')}<div class="hbar" style="padding:2px 0 8px"><div class="b"><i style="width:${pct}%"></i></div></div>`:''}${tl('On pace for',money(proj))}${tl('Take-home on pace for',`<span style="color:var(--go)">${money(projTake)}</span>`)}<div class="hint" style="margin:6px 0 0">Day ${day} of ${M.dim}. ${tgt?(M.rev>=tgt?'Target hit ✓':`${money(tgt-M.rev)} to go${left>0?` — about ${money((tgt-M.rev)/left)} a day`:''}`):'Set a monthly target in Settings → Insights &amp; nudges.'}</div></div></div>`:''}
      <div class="sec" style="margin-top:0">Profit &amp; loss</div>
      <div class="card"><div class="pad">${tl('Revenue',money(M.rev))}${M.disc?tl('<span style="color:var(--ink-3)">incl. discounts given</span>',`<span style="color:var(--ink-3)">${money(M.disc)}</span>`):''}${tl(`Product cost <span class="mono" style="font-size:11px;color:var(--ink-3)">USD × ${pc.fx}</span>`,'−'+money(M.P.cogs))}${tl('Gross profit',money(M.P.gross))}${tl('Postage + boxes',`−${money(M.P.ship+M.P.pack)}`)}${tl(`Courier ${pc.pct}%`,'−'+money(M.P.courier))}${tl('Profit from orders',money(M.P.net),'big')}${tl('Business expenses','−'+money(M.exp))}${tl('Take-home',`<span style="color:${M.take>=0?'var(--go)':'var(--red)'}">${money(M.take)}</span>`,'big')}</div></div>
      <div class="sec">Business expenses <a class="act owner-only" onclick="Money.openExp()">+ Add</a></div>
      ${EX===null||EX===undefined?'<div class="note">Expenses switch on after the database update.</div>':`${Object.keys(byCat).length?`<div class="card" style="margin-bottom:8px"><div class="pad" style="padding-top:6px;padding-bottom:6px">${Object.entries(byCat).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`<div class="hbar"><span class="l">${esc(k)}</span><div class="b"><i style="width:${Math.round(v/Math.max(1,M.exp)*100)}%"></i></div><span class="v">${money(v)}</span></div>`).join('')}</div></div>`:''}<div class="card">${[...M.E].sort((a,b)=>b.date>a.date?1:-1).map(e=>`<div class="row"><div class="m"><div class="t">${esc(e.note||e.category)}<span class="tag gray">${esc(e.category||'Other')}</span></div><div class="u">${fmtDateFull(e.date)}${e.method?' · '+esc(e.method):''}</div></div><div class="e"><span class="amt">${money(e.amount)}</span><button class="btn xs ghost" style="color:var(--red)" onclick="Money.delExp('${e.id}')">remove</button></div></div>`).join('')||'<div class="empty">No expenses this month — add ads, subscriptions, your phone…</div>'}</div>`}
      <div class="sec">Waiting on payment <small>${U.length?money(uTot):''}</small></div>
      <div class="card">${U.map(s=>{ const d=dBetween(s.date,today()); const c=s.customer||{}; return `<div class="row"><div class="m tap" onclick="Sales.detail('${s.id}')"><div class="t">${esc(c.name||'Walk-in')}<span class="id">#${s.sale_no}</span>${d>=3?`<span class="tag red">${d}d</span>`:`<span class="tag amber">${agoTxt(d)}</span>`}</div><div class="u">${money(s.total)} · ${esc(s.status)}</div></div><div class="e">${c.phone?`<button class="btn xs go" onclick="Money.remind('${s.id}')">Remind</button>`:''}<button class="btn xs" onclick="Sales.markPaid('${s.id}').then(()=>Money.render())">Paid</button></div></div>`; }).join('')||'<div class="empty"><div class="big">✓</div>Everyone has paid</div>'}</div>
      <div class="sec">How you got paid</div>
      <div class="card"><div class="pad">${Object.entries(byPay).sort((a,b)=>b[1]-a[1]).map(([k,v])=>tl(esc(k),money(v))).join('')||'<div class="empty">—</div>'}</div></div>
      <div class="sec">Where the money is <small>right now</small></div>
      <div class="card"><div class="pad">${tl('Stock on hand (at cost)',money(stockVal))}${tl('Owed to you by customers',money(uTot))}${tl(owed<0?'Courier credit':'You owe the courier',(owed<0?'+':'−')+money(Math.abs(owed)))}</div></div>
      <div class="sec">Last 6 months <small>revenue · take-home</small></div>
      <div class="card"><div class="pad" style="padding-top:6px;padding-bottom:6px">${six.map(x=>`<div class="hbar"><span class="l" style="flex-basis:22%">${new Date(x.m+'-01T00:00:00').toLocaleDateString('en-AU',{month:'short'})}</span><div class="b"><i style="width:${Math.round(x.rev/smax*100)}%"></i></div><span class="v" style="min-width:110px">${money(x.rev)} · <span style="color:var(--go)">${money(x.take)}</span></span></div>`).join('')}</div></div>
      <div class="hint" style="margin-top:12px">Take-home = order profit (after product cost, $${pc.postage} postage + $${pc.packaging} box per posted order and the courier's share) minus the business expenses you log here.</div>`;
  },
  remind(id){ const s=Store.cache.sales.find(x=>x.id===id); if(!s) return; const c=s.customer||{}; const cfg=Intel.cfg(); WA.open(c.phone,Intel.fill(cfg.remind_template,{first_name:firstName(c.name),name:c.name||'',sale_no:s.sale_no,total:money(s.total),payid:cfg.payid})); },
  openExp(){ if(!App.ownerOnly()) return; if(!Array.isArray(Store.cache.expenses)){ toast('Expenses switch on after the database update','err',4000); return; }
    mk.drawer('dr-exp',`<h3>Business expense</h3><div class="hint" style="margin-top:-6px">Running costs — ads, subscriptions, your phone. Stock, postage and boxes are already counted on every order, so don't add those.</div><div class="g2"><div class="f"><label>Amount $</label><input class="in" id="ex-amount" type="number" inputmode="decimal" step="0.01" placeholder="0.00"></div><div class="f"><label>Date</label><input class="in" id="ex-date" type="date"></div></div><div class="g2"><div class="f"><label>Category</label><select class="in" id="ex-cat">${EXP_CATS.map(c=>`<option>${esc(c)}</option>`).join('')}</select></div><div class="f"><label>Paid with</label><select class="in" id="ex-method"><option>Card</option><option>Bank</option><option>Cash</option><option>BKP</option><option>KJ</option></select></div></div><div class="f"><label>What for</label><input class="in" id="ex-note" placeholder="e.g. Meta ads"></div><div class="actions"><button class="btn" onclick="Sheet.close('dr-exp')">Cancel</button><button class="btn ink" onclick="Money.saveExp()">Add</button></div>`);
    $('ex-amount').value=''; $('ex-note').value=''; const t=today(); $('ex-date').value=this.m&&this.m!==t.slice(0,7)?this.range(this.m)[1]:t; Sheet.open('dr-exp'); setTimeout(()=>$('ex-amount').focus(),150); },
  async saveExp(){ if(this._busy) return; const amt=Math.round((+$('ex-amount').value||0)*100)/100; if(amt<=0){ toast('Enter the amount','err'); return; } this._busy=true;
    try{ await Store.upsert('expenses',{id:uid('ex'),date:$('ex-date').value||today(),amount:amt,category:$('ex-cat').value,note:$('ex-note').value.trim(),method:$('ex-method').value,created_at:new Date().toISOString()}); Sheet.close('dr-exp'); toast(money(amt)+' expense added'); this.render(); if(Nav.cur==='home') Pulse.render(); }catch(e){} finally{ this._busy=false; } },
  async delExp(id){ const e=(Store.cache.expenses||[]).find(x=>x.id===id); if(!e||!confirm(`Remove the ${money(e.amount)} expense?`)) return; await Store.remove('expenses',id); this.render(); },
};

// ============================================================
// ACTIVITY — who did what (database audit log)
// ============================================================
const Activity={
  f:'all', who:'', rows:null,
  async open(){ if(!App.ownerOnly()) return; mk.sheet('sh-activity','Activity <em>log</em>','<button class="btn ghost sm" onclick="Activity.open()">Refresh</button>'); Sheet.open('sh-activity'); $('sh-activity-b').innerHTML='<div class="empty">Loading…</div>'; await this.load(); this.render(); },
  async load(){ if(Store.mode!=='cloud'){ this.rows=false; return; } await Who.load(); const {data,error}=await Store.sb.from('audit_log').select('*').order('at',{ascending:false}).limit(400); this.rows=error?false:(data||[]); },
  name(r){ if(!r.actor) return r.tbl==='stocktakes'?'Count link':'System'; return Who.name(r.actor)||'Removed login'; },
  describe(r){
    const ch=r.changes||{}; const nv=k=>Array.isArray(ch[k])?ch[k][1]:undefined, ov=k=>Array.isArray(ch[k])?ch[k][0]:undefined; const has=k=>Object.prototype.hasOwnProperty.call(ch,k);
    const P=id=>Store.cache.products.find(p=>p.id===id), S=id=>Store.cache.sales.find(s=>s.id===id), C=id=>Store.cache.customers.find(c=>c.id===id);
    switch(r.tbl){
      case 'sales': { const s=r.action==='update'?(S(r.row_id)||{}):ch; const no='#'+(s.sale_no??'?'); const who=(s.customer||{}).name||'Walk-in';
        if(r.action==='insert') return ['sales',`New sale ${no} · ${who} · ${money(ch.total)}`];
        if(r.action==='delete') return ['sales',`Deleted sale ${no} · ${who} · ${money(ch.total)}`];
        const p=[]; if(has('status')) p.push(`${ov('status')} → ${nv('status')}`); if(has('tracking')&&nv('tracking')) p.push('tracking '+nv('tracking')); if(has('paid_at')&&!has('status')) p.push(nv('paid_at')?'marked paid':'payment removed'); if(has('courier_paid_at')) p.push(nv('courier_paid_at')?'courier paid':'courier payment undone'); if(has('items')) p.push('items changed'); if(has('total')) p.push(`total ${money(ov('total'))} → ${money(nv('total'))}`); if(has('fulfilment')) p.push('now '+nv('fulfilment')); if(has('customer')) p.push('customer details edited'); if(has('notes')) p.push('notes edited'); if(has('courier_sent_at')) p.push('sent to courier'); if(has('customer_notified_at')&&nv('customer_notified_at')) p.push('customer messaged');
        return p.length?['sales',`Sale ${no} · ${who}: ${p.join(', ')}`]:null; }
      case 'products': { const pr=P(r.row_id)||ch; const n=pr.name||ch.name||'Product';
        if(r.action!=='update') return ['stock',`${r.action==='insert'?'Added':'Deleted'} product ${n}`];
        const p=[]; if(has('stock')){ const d=(+nv('stock'))-(+ov('stock')); p.push(`stock ${ov('stock')} → ${nv('stock')} (${d>0?'+':''}${d})`); } if(has('cost')) p.push(`cost US$${ov('cost')??'—'} → US$${nv('cost')??'—'}`);
        [['sell1','single'],['sell3','3-pack'],['sell5','5-pack'],['sell10','10-pack']].forEach(([k,l])=>{ if(has(k)) p.push(`${l} $${ov(k)??'—'} → $${nv(k)??'—'}`); }); if(has('hidden')) p.push(nv('hidden')?'hidden':'shown'); if(has('name')) p.push('renamed from '+ov('name')); if(has('reorder')) p.push('min '+nv('reorder'));
        return ['stock',`${n}: ${p.join(', ')||Object.keys(ch).join(', ')+' edited'}`]; }
      case 'customers': { const c=C(r.row_id)||ch; if(r.action==='insert') return ['customers',`New customer ${c.name||ch.name||''}`]; if(r.action==='delete') return ['customers',`Deleted customer ${ch.name||''}`];
        const k=Object.keys(ch).filter(x=>!['order_count','total_spent','last_seen','last_contacted_at'].includes(x)); if(has('last_contacted_at')&&!k.length) return ['customers',`Messaged ${c.name||''}`]; return k.length?['customers',`${c.name||''}: ${k.join(', ')} edited`]:null; }
      case 'courier_payments': { const x=ch; if(r.action==='insert') return ['money',x.kind==='expense'?`Courier expense +${money(x.amount)} · ${x.note||'postage'}`:`Paid courier ${money(x.amount)}${x.method?' ('+x.method+')':''} · ${plural((x.sale_ids||[]).length,'order')}`]; if(r.action==='delete') return ['money',`Undid courier ${x.kind==='expense'?'expense':'payment'} ${money(x.amount)}`]; return null; }
      case 'purchase_orders': { const o=r.action==='update'?(Store.cache.purchase_orders.find(x=>x.id===r.row_id)||{}):ch; const n=(P(o.product_id)||{}).name||'product';
        if(r.action==='insert') return ['stock',`Incoming order: ${n} × ${ch.qty}`]; if(r.action==='delete') return ['stock',`Removed incoming record (${n})`]; return has('status')?['stock',`Incoming ${n} × ${o.qty??''} → ${nv('status')}`]:null; }
      case 'stocktakes': { if(r.action==='insert') return ['stock','Started a stock count']; if(!has('status')) return null; const st=nv('status'); return st==='applying'?null:['stock',st==='submitted'?`Stock count submitted${nv('counted_by')?' by '+nv('counted_by'):''}`:st==='applied'?'Stock count applied to stock':'Stock count '+st]; }
      case 'expenses': return ['money',`${r.action==='delete'?'Removed expense':'Expense'} ${money(ch.amount)} · ${ch.category||''}${ch.note?' · '+ch.note:''}`];
    } return null; },
  render(){
    const b=$('sh-activity-b'); if(!b) return;
    if(this.rows===false){ b.innerHTML='<div class="note">The activity log switches on after the database update. Until then, stock changes are under Stock → Movements.</div>'; return; }
    const D=(this.rows||[]).map(r=>{ const d=this.describe(r); return d?{r,area:d[0],text:d[1],who:this.name(r)}:null; }).filter(Boolean);
    const people=[...new Set(D.map(x=>x.who))]; const L=D.filter(x=>(this.f==='all'||x.area===this.f)&&(!this.who||x.who===this.who));
    const groups={}; L.forEach(x=>{ const k=localDay(x.r.at); (groups[k]=groups[k]||[]).push(x); });
    const ic={sales:['$','blue'],stock:['±','amber'],customers:['☺','go'],money:['↗','violet']};
    b.innerHTML=`<div class="seg scroll" style="margin-bottom:10px">${[['all','All'],['sales','Sales'],['stock','Stock'],['customers','Customers'],['money','Money']].map(([k,l])=>`<button class="${this.f===k?'on':''}" onclick="Activity.f='${k}';Activity.render()">${l}</button>`).join('')}</div>
      ${people.length>1?`<div class="chips" style="margin-bottom:12px"><button class="chip ${this.who?'':'on'}" onclick="Activity.who='';Activity.render()">Everyone</button>${people.map(p=>`<button class="chip ${this.who===p?'on':''}" data-p="${esc(p)}" onclick="Activity.who=this.dataset.p;Activity.render()">${esc(p)}</button>`).join('')}</div>`:''}
      ${Object.keys(groups).sort().reverse().map(d=>`<div class="cat-h">${d===today()?'Today':fmtDateFull(d)} <small>${groups[d].length}</small></div><div class="card" style="margin-bottom:10px">${groups[d].map(x=>{ const [i,c]=ic[x.area]||['·','gray']; return `<div class="row"><div class="av" style="background:var(--paper-3);color:var(--${c});font-family:var(--mono)">${i}</div><div class="m"><div class="t" style="white-space:normal;font-weight:400">${esc(x.text)}</div><div class="w"><span>${esc(x.who)}</span><span>${new Date(x.r.at).toLocaleTimeString('en-AU',{hour:'numeric',minute:'2-digit'})}</span></div></div></div>`; }).join('')}</div>`).join('')||'<div class="empty">Nothing logged yet — everything from now on shows up here</div>'}
      <div class="hint">Shows the last 400 changes, newest first. Recorded by the database, so it can't be edited from the app.</div>`;
  },
};

// ============================================================
// SEARCH — customers, sales (#number, tracking, items), products
// ============================================================
const Search={
  open(){ mk.sheet('sh-search','<input class="in" id="gs-q" placeholder="Search people, orders, tracking, products" autocomplete="off" oninput="Search.run()" style="min-height:40px;font-family:var(--sans);font-size:16px">'); Sheet.open('sh-search'); this.run(); setTimeout(()=>$('gs-q').focus(),120); },
  run(){ const b=$('sh-search-b'); const q=($('gs-q').value||'').trim().toLowerCase(); if(!q){ b.innerHTML='<div class="empty">Type a name, phone, order number (#38), tracking number or product</div>'; return; }
    const dq=q.replace(/\D/g,''); const no=/^#?\d{1,5}$/.test(q)?+dq:null;
    const C=Store.cache.customers.filter(c=>[c.name,c.email,c.city,c.notes,c.tags].some(v=>(v||'').toLowerCase().includes(q))||(dq.length>=4&&(c.phone||'').replace(/\D/g,'').includes(dq))).slice(0,8);
    const S=Store.cache.sales.filter(s=>no!==null?s.sale_no===no:JSON.stringify([s.customer,s.items,s.tracking,s.notes]).toLowerCase().includes(q)).slice(0,10);
    const P=App.courier?[]:Store.cache.products.filter(p=>[p.name,p.sku,p.supplier_sku,p.category].some(v=>(v||'').toLowerCase().includes(q))).slice(0,8);
    b.innerHTML=`${S.length?`<div class="sec" style="margin-top:0">Orders <small>${S.length}</small></div><div class="card">${S.map(s=>Sales.row(s)).join('')}</div>`:''}
      ${C.length?`<div class="sec">People <small>${C.length}</small></div><div class="card">${C.map(c=>`<div class="row tap" onclick="Cust.detail('${c.id}')"><div class="av">${esc((c.name||'?')[0].toUpperCase())}</div><div class="m"><div class="t">${esc(c.name)}</div><div class="u">${esc([c.phone,c.city].filter(Boolean).join(' · '))}</div><div class="w"><span>${plural(+c.order_count||0,'order')}</span><span>${c.last_seen?'last '+fmtDate(c.last_seen):'no orders'}</span></div></div><span class="chev">›</span></div>`).join('')}</div>`:''}
      ${P.length?`<div class="sec">Products <small>${P.length}</small></div><div class="card">${P.map(p=>`<div class="row tap" onclick="Inv.openEdit('${p.id}')"><div class="m"><div class="t">${esc(p.name)}${p.hidden?' <span class="tag gray">hidden</span>':''}</div><div class="u">${esc(p.sku||'')} · ${p.sell1?'$'+p.sell1:'no price'}</div></div><div class="e"><span class="amt">${p.stock}</span><span class="hint" style="margin:0">in stock</span></div></div>`).join('')}</div>`:''}
      ${!S.length&&!C.length&&!P.length?'<div class="empty">No match</div>':''}`; },
};

// ============================================================
// PULSE — Home card: month so far + what to chase
// ============================================================
const Pulse={
  render(){ const el=$('home-pulse'); if(!el) return; if(App.courier){ el.innerHTML=''; return; }
    const cfg=Intel.cfg(); const M=Money.month(today().slice(0,7)); const day=+today().slice(8,10); const proj=M.rev/Math.max(1,day)*M.dim; const tgt=cfg.month_target; const pct=tgt?Math.min(100,Math.round(M.rev/tgt*100)):0;
    const R=Radar.all(); const due=R.filter(p=>Radar.inSeg(p,'due')&&!p.nudged&&p.c.phone).length; const slip=R.filter(p=>p.st==='slipping'&&!p.nudged&&p.c.phone).length;
    const H=Health.rows(); const urgent=H.filter(r=>r.urgent).length; const slow=H.filter(r=>r.stock>0&&r.sold===0); const U=Money.unpaid();
    const chip=(t,on,cls='')=>`<button class="chip ${cls}" onclick="${on}">${t}</button>`;
    const chips=[due?chip(`🔁 ${due} due to reorder`,"Radar.open('due')",'on'):'',slip?chip(`⏳ ${slip} slipping`,"Radar.open('slipping')"):'',urgent?chip(`📦 ${urgent} running out`,'Health.go()'):'',U.length?chip(`💸 ${money(sum(U,s=>+s.total))} unpaid`,'Money.open()'):'',slow.length?chip(`💤 ${money(sum(slow,r=>r.valAUD))} not selling`,'Health.go()'):''].filter(Boolean);
    el.innerHTML=`<div class="card tap" onclick="Money.open()" style="cursor:pointer;margin-bottom:12px"><div class="pad"><div style="display:flex;justify-content:space-between;align-items:baseline"><span class="lab" style="margin:0">${new Date().toLocaleDateString('en-AU',{month:'long'})} so far</span><span style="color:var(--go);font-size:12px;font-weight:500">Money ›</span></div>
      <div style="display:flex;gap:18px;align-items:flex-end;margin-top:6px;flex-wrap:wrap"><div><div class="mono" style="font-size:24px;font-weight:600;line-height:1.1">${money(M.rev)}</div><div class="hint" style="margin:2px 0 0">revenue · on pace for ${money(proj)}</div></div><div><div class="mono" style="font-size:24px;font-weight:600;line-height:1.1;color:${M.take>=0?'var(--go)':'var(--red)'}">${money(M.take)}</div><div class="hint" style="margin:2px 0 0">take-home</div></div></div>
      ${tgt?`<div class="hbar" style="padding:10px 0 0"><div class="b"><i style="width:${pct}%"></i></div><span class="v">${pct}% of ${money(tgt)}</span></div>`:''}</div></div>
      <div class="chips" style="margin-bottom:12px">${chips.join('')||'<span class="hint" style="margin:0">✓ Nobody to chase, nothing running out</span>'}</div>`; },
};

// ============================================================
// MOUNT — add the new pieces to the existing screens
// ============================================================
const IntelUI={
  mount(){
    // Home pulse (owner) right under the numbers strip
    $('home-strip')?.insertAdjacentHTML('afterend','<div id="home-pulse" class="owner-only"></div>');
    // People: radar banner
    $('cust-strip')?.insertAdjacentHTML('afterend','<div id="cust-radar" class="owner-only"></div>');
    // Stock: Health tab
    const seg=$('stock-seg'); if(seg){ seg.insertAdjacentHTML('beforeend','<button data-v="health" onclick="Inv.view(\'health\')">Health <b id="health-n">0</b></button>'); seg.classList.add('scroll'); }
    $('stock-mov')?.insertAdjacentHTML('afterend','<div id="stock-health" style="display:none;margin-top:12px"></div>');
    // More: new reports at the top
    const menu=document.querySelector('#sc-more .menu-list'); const item=(on,ic,t,u)=>`<div class="row tap owner-only" onclick="${on}"><div class="ic">${ic}</div><div class="m"><div class="t">${t}</div><div class="u">${u}</div></div><span class="chev">›</span></div>`;
    if(menu) menu.insertAdjacentHTML('afterbegin',item("Money.open()",'$','Money','Monthly profit &amp; loss, expenses, take-home, unpaid orders')+item("Radar.open()",'↻','Reorder radar','Who’s due, who’s slipping — message them in one tap')+item("Health.go()",'▦','Stock health','Run-out dates, what to order, what’s not selling')+item("Activity.open()",'≡','Activity log','Who did what, and when'));
    // Search button beside ⋯
    document.body.insertAdjacentHTML('beforeend',`<button id="search-btn" onclick="Search.open()" aria-label="Search" style="position:fixed;top:calc(10px + var(--safe-t));right:58px;z-index:80;width:38px;height:38px;border-radius:50%;border:1px solid var(--rule-2);background:rgba(255,255,255,.85);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);display:none;align-items:center;justify-content:center;color:var(--ink-2)"><svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg></button>`);
    document.querySelectorAll('.topbar,.sh').forEach(e=>e.style.paddingRight='96px');
    // Settings section
    const sb=document.querySelector('#sh-settings .sheet-b'); const ta=(id,l,r)=>`<div class="f"><label>${l}</label><textarea class="in" id="${id}" rows="${r}" style="font-size:13px"></textarea></div>`; const nf=(id,l,ph)=>`<div class="f"><label>${l}</label><input class="in" id="${id}" type="number" inputmode="decimal" placeholder="${ph}"></div>`;
    if(sb) sb.insertAdjacentHTML('beforeend',`<div class="sec owner-only">Insights &amp; nudges</div><div class="card owner-only"><div class="pad">
      <div class="g2">${nf('st-in-target','Monthly revenue target $','e.g. 8000')}<div class="f"><label>Your PayID</label><input class="in" id="st-in-payid" inputmode="tel"></div></div>
      <div class="g3">${nf('st-in-cycle','Days 1 vial lasts','30')}${nf('st-in-lead','Supplier days','14')}${nf('st-in-tgt','Shelf days','45')}</div>
      <div class="hint" style="margin-top:0">Radar: once someone has ordered twice it uses their own gap; before that it guesses days per vial × vials in their last order. Restock: covers the supplier's delivery time plus the days you want on the shelf, in 10-packs.</div>
      ${ta('st-in-nudge','Reorder nudge (due now)',4)}${ta('st-in-winback','Win-back (slipping / lapsed)',4)}${ta('st-in-prospect','Never ordered',3)}${ta('st-in-remind','Payment reminder',4)}${ta('st-in-web','Web order reply — not paid yet',5)}${ta('st-in-webpaid','Web order reply — screenshot received',4)}${ta('st-in-webleft','Web order follow-up — left at checkout',4)}
      <div class="hint">Tags: {first_name} {name} {product} {last_date} · payment reminder also {sale_no} {total} {payid} · web order reply {ref} {items} {total} {payid}</div></div></div>`);
  },
  fillSettings(){ const c=Intel.cfg(); const set=(id,v)=>{ const e=$(id); if(e) e.value=v??''; }; set('st-in-target',c.month_target||''); set('st-in-payid',c.payid); set('st-in-cycle',c.cycle_days); set('st-in-lead',c.lead_days); set('st-in-tgt',c.target_days); set('st-in-nudge',c.nudge_template); set('st-in-winback',c.winback_template); set('st-in-prospect',c.prospect_template); set('st-in-remind',c.remind_template); set('st-in-web',c.web_template); set('st-in-webpaid',c.web_paid_template); set('st-in-webleft',c.web_left_template); },
  async saveSettings(){ if(!$('st-in-cycle')) return; const g=id=>$(id).value; const n=(id,old)=>{ const v=g(id).trim(); return v===''||isNaN(+v)?old:+v; }; const c=Intel.cfg();
    await Store.setSetting('intel',{month_target:n('st-in-target',0),payid:g('st-in-payid').trim(),cycle_days:n('st-in-cycle',c.cycle_days),lead_days:n('st-in-lead',c.lead_days),target_days:n('st-in-tgt',c.target_days),nudge_template:g('st-in-nudge'),winback_template:g('st-in-winback'),prospect_template:g('st-in-prospect'),remind_template:g('st-in-remind'),...($('st-in-web')?{web_template:g('st-in-web'),web_paid_template:g('st-in-webpaid')}:{}),...($('st-in-webleft')?{web_left_template:g('st-in-webleft')}:{})}); },
  radarBanner(){ const el=$('cust-radar'); if(!el) return; if(App.courier){ el.innerHTML=''; return; } const R=Radar.all(); const due=R.filter(p=>Radar.inSeg(p,'due')).length, slip=R.filter(p=>p.st==='slipping').length, lap=R.filter(p=>p.st==='lapsed').length;
    el.innerHTML=`<div class="card tap" onclick="Radar.open()" style="cursor:pointer;margin-bottom:12px"><div class="pad" style="display:flex;align-items:center;gap:12px"><div class="ic" style="width:38px;height:38px;border-radius:12px;background:var(--go-soft);color:var(--go);display:flex;align-items:center;justify-content:center;font-size:18px">↻</div><div style="flex:1;min-width:0"><div style="font-weight:500">Reorder radar</div><div class="hint" style="margin:2px 0 0">${due?`<b style="color:var(--amber)">${due} due now</b>`:'Nobody due'} · ${slip} slipping · ${lap} lapsed</div></div><span class="chev">›</span></div></div>`; },
};

// ============================================================
// HOOKS into app.js
// ============================================================
(()=>{
  IntelUI.mount();
  // expenses come with everything else (null = table not there yet)
  const _load=Store.loadAll.bind(Store);
  Store.loadAll=async function(){ await _load(); if(this.mode==='cloud'){ try{ const {data,error}=await this.pageAll(()=>this.sb.from('expenses').select('*').order('date',{ascending:false})); this.cache.expenses=error?null:(data||[]); }catch(e){ this.cache.expenses=null; } } else if(!Array.isArray(this.cache.expenses)) this.cache.expenses=[]; };
  const _start=App.start.bind(App);
  App.start=async function(){ await _start(); const sbtn=$('search-btn'); if(sbtn) sbtn.style.display='flex'; Who.load().then(()=>{ if(Nav.cur==='stock'&&Inv.v==='mov') Mov.render(); }); };
  const _home=Home.render.bind(Home); Home.render=function(){ _home(); try{ Pulse.render(); }catch(e){ console.error('pulse',e); } };
  const _cr=Cust.render.bind(Cust); Cust.render=function(){ _cr(); try{ IntelUI.radarBanner(); }catch(e){ console.error('radar',e); } };
  // customer 360: rhythm, next order, profit, repeat last order
  const _cd=Cust.detail.bind(Cust);
  Cust.detail=function(id){ _cd(id); const c=Store.cache.customers.find(x=>x.id===id); if(!c) return; const p=Radar.profile(c); const [tc,tt]=Radar.tag(p);
    const row=(k,v)=>`<div class="tl"><span class="k">${k}</span><span class="v" style="font-family:var(--sans);font-weight:500;text-align:right">${v}</span></div>`;
    const html=`<div class="card" style="margin-bottom:12px"><div class="pad">
      ${row('Status',`<span class="tag ${tc}">${esc(tt)}</span>`)}${p.first?row('Customer since',fmtDateFull(p.first)):''}${p.orders?row('Orders every',`~${p.interval} days<small style="display:block;font-size:11px;color:var(--ink-3);font-weight:400">from ${esc(p.basis)}</small>`):''}${p.next?row('Next order',`${fmtDate(p.next)} · ${p.du>=0?inTxt(p.du):agoTxt(-p.du)}`):''}
      ${App.courier?'':`${p.S.length?row('Avg order',money(p.aov))+row('Profit from them',`<span style="color:var(--go)">${money(p.profit)}</span><small style="display:block;font-size:11px;color:var(--ink-3);font-weight:400">${plural(p.S.length,'app order')}</small>`):''}${p.ca?row('Last messaged',agoTxt(p.cDays)):''}`}
      <div class="actions" style="margin-top:8px">${p.lastSale?`<button class="btn go" onclick="Radar.repeat('${p.lastSale.id}')">Repeat last order</button>`:''}${c.phone&&!App.courier?`<button class="btn" onclick="Radar.nudge('${c.id}')">${p.st==='never'?'Send intro':['slipping','lapsed'].includes(p.st)?'Win-back message':'Reorder message'}</button>`:''}</div></div></div>`;
    const b=$('cd-body'); const strip=b.querySelector('.strip'); if(strip) strip.insertAdjacentHTML('afterend',html); else b.insertAdjacentHTML('afterbegin',html); };
  // Stock → Health tab
  const _iv=Inv.view.bind(Inv);
  Inv.view=function(v){ const h=$('stock-health'); if(v==='health'){ if(!App.ownerOnly()) return; this.v='health'; $$('#stock-seg button').forEach(b=>b.classList.toggle('on',b.dataset.v==='health')); ['inv','po','mov'].forEach(k=>$('stock-'+k).style.display='none'); if(h) h.style.display='block'; Health.render(); Nav.badges(); return; } if(h) h.style.display='none'; _iv(v); };
  const _ira=Inv.renderAll.bind(Inv); Inv.renderAll=function(){ if(this.v==='health'){ Health.render(); Nav.badges(); return; } _ira(); try{ const n=$('health-n'); if(n&&!App.courier) n.textContent=Health.rows().filter(r=>r.urgent).length; }catch(e){} };
  // Settings
  const _so=Settings.open.bind(Settings); Settings.open=function(){ _so(); IntelUI.fillSettings(); };
  const _ss=Settings.save.bind(Settings); Settings.save=async function(){ await IntelUI.saveSettings(); await _ss(); };
})();

// ============================================================
// WEB ORDERS — orders sent from the price list (stayoptml.vercel.app) arrive in the web_orders table
// Reply with PayID → Make sale (loads it into Sell, awaiting payment) → marked done automatically
// ============================================================
const WebOrders={
  seen:null,
  open(){ return (Store.cache.web_orders||[]).filter(w=>['new','changed'].includes(w.status)).sort((a,b)=>(b.updated_at||'')>(a.updated_at||'')?1:-1); },
  find(id){ return (Store.cache.web_orders||[]).find(w=>w.id===id); },
  itemsText(w,sep){ return (w.items||[]).map(i=>`${i.qty}× ${i.name}${+i.pack>1?` (${i.pack}-pack)`:''}`).join(sep||', '); },
  stockWarn(w){ const need={}; (w.items||[]).forEach(i=>{ if(i.product_id) need[i.product_id]=(need[i.product_id]||0)+(+i.pack||1)*(+i.qty||1); });
    return Object.entries(need).map(([id,n])=>{ const p=Store.cache.products.find(x=>x.id===id); return p&&n>(+p.stock||0)?`${p.name}: need ${n}, have ${+p.stock||0}`:null; }).filter(Boolean); },
  ago(iso){ const m=Math.round((Date.now()-new Date(iso))/6e4); return m<1?'just now':m<60?m+'m ago':m<1440?Math.round(m/60)+'h ago':Math.round(m/1440)+'d ago'; },
  // checkouts where the customer typed their details but never pressed Confirm: shown once they've been quiet for 15 minutes, for two weeks
  left(){ const now=Date.now(); return (Store.cache.web_orders||[]).filter(w=>{ if(w.status!=='started') return false; const age=now-new Date(w.updated_at||w.created_at); return age>15*6e4&&age<14*864e5; }).sort((a,b)=>(b.updated_at||'')>(a.updated_at||'')?1:-1); },
  html(){ if(App.courier) return ''; const L=this.open(), A=this.left(); if(!L.length&&!A.length) return '';
    return (L.length?`<div class="sec" style="margin-top:0">Web orders <small>${L.length} waiting</small></div><div class="card" style="margin-bottom:12px">${L.map(w=>this.row(w)).join('')}</div>`:'')
      +(A.length?`<div class="sec" style="margin-top:0">Left at checkout <small>${A.length} didn't finish</small></div><div class="card" style="margin-bottom:12px">${A.map(w=>this.rowLeft(w)).join('')}</div>`:''); },
  rowLeft(w){ const addr=[w.street,w.suburb,w.region,w.postcode].filter(Boolean).join(', ');
    return `<div class="row" style="align-items:flex-start"><div class="m"><div class="t" style="white-space:normal">${esc(w.name||'Someone')}<span class="id">${esc(w.id)}</span><span class="tag amber">didn't confirm</span>${w.replied_at?`<span class="tag blue">followed up ${this.ago(w.replied_at)}</span>`:''}</div>
      <div class="u" style="white-space:normal">${esc(this.itemsText(w))}</div>
      <div class="w"><span>${money(w.total)}</span><span>${this.ago(w.updated_at||w.created_at)}</span><span>${esc(w.phone||'')}</span></div>
      <div class="hint" style="margin:4px 0 0">${addr?esc(addr):'No address yet'}${w.email?' · '+esc(w.email):''}</div>
      <div class="actions" style="margin-top:8px"><button class="btn sm ${w.replied_at?'':'go'}" onclick="WebOrders.follow(${jsq(w.id)})">Follow up</button><button class="btn sm" onclick="WebOrders.toSale(${jsq(w.id)})">Make sale</button><button class="btn sm ghost" onclick="WebOrders.dismiss(${jsq(w.id)})">Dismiss</button></div></div></div>`; },
  follow(id){ if(!App.ownerOnly()) return; const w=this.find(id); if(!w) return; const cfg=Intel.cfg();
    const text=Intel.fill(cfg.web_left_template,{first_name:firstName(w.name),name:w.name||'',ref:w.ref,items:this.itemsText(w,'\n'),total:money(w.total),payid:cfg.payid});
    if(WA.open(w.phone,text)){ w.replied_at=new Date().toISOString(); Store.upsert('web_orders',{id:w.id,replied_at:w.replied_at}).catch(()=>{}); this.render(); } },
  row(w){ const warn=this.stockWarn(w); const sale=w.sale_id&&Store.cache.sales.find(s=>s.id===w.sale_id);
    return `<div class="row" style="align-items:flex-start"><div class="m"><div class="t" style="white-space:normal">${esc(w.name||'Web order')}<span class="id">${esc(w.id)}</span>${w.status==='changed'?`<span class="tag amber">changed after sale${sale?' #'+sale.sale_no:''}</span>`:w.revisions>1?`<span class="tag blue">updated ×${w.revisions-1}</span>`:''}${w.proof_at?`<span class="tag go">screenshot ✓ ${this.ago(w.proof_at)}</span>`:w.status!=='changed'?'<span class="tag amber">pending payment</span>':''}${w.wholesale?'<span class="tag violet">wholesale</span>':''}${w.replied_at?`<span class="tag blue">replied ${this.ago(w.replied_at)}</span>`:''}</div>
      <div class="u" style="white-space:normal">${esc(this.itemsText(w))}</div>
      <div class="w"><span>${money(w.total)}</span><span>${this.ago(w.updated_at||w.created_at)}</span>${w.suburb||w.region?`<span>${esc([w.suburb,w.region].filter(Boolean).join(' '))}</span>`:''}</div>
      ${w.price_ok===false?`<div class="hint" style="margin:4px 0 0;color:var(--red)">⚠ ${esc(w.price_note||'Prices differ from your list')}</div>`:''}
      ${warn.length?`<div class="hint" style="margin:4px 0 0;color:var(--amber)">Low stock — ${esc(warn.join(' · '))}</div>`:''}
      <div class="actions" style="margin-top:8px">${w.proof_at?`<button class="btn sm go" onclick="WebOrders.proofs(${jsq(w.id)})">View screenshot</button>`:''}<button class="btn sm ${w.proof_at?'':'go'}" onclick="WebOrders.reply(${jsq(w.id)})">${w.proof_at?'Reply':'Reply with PayID'}</button><button class="btn sm" onclick="WebOrders.toSale(${jsq(w.id)})">Make sale</button><button class="btn sm ghost" onclick="WebOrders.dismiss(${jsq(w.id)})">Dismiss</button></div></div></div>`; },
  render(){ const h=this.html(); ['home-web','sales-web'].forEach(id=>{ const el=$(id); if(el) el.innerHTML=h; }); },
  reply(id){ if(!App.ownerOnly()) return; const w=this.find(id); if(!w) return; const cfg=Intel.cfg();
    const text=Intel.fill(w.proof_at?cfg.web_paid_template:cfg.web_template,{first_name:firstName(w.name),name:w.name||'',ref:w.ref,items:this.itemsText(w,'\n'),total:money(w.total),payid:cfg.payid});
    if(WA.open(w.phone,text)){ w.replied_at=new Date().toISOString(); Store.upsert('web_orders',{id:w.id,replied_at:w.replied_at}).catch(()=>{}); this.render(); } },
  toSale(id){ if(!App.ownerOnly()) return; const w=this.find(id); if(!w) return;
    if(w.status==='changed'&&w.sale_id){ const s=Store.cache.sales.find(x=>x.id===w.sale_id); if(s&&!confirm(`You already made sale #${s.sale_no} from this order, and the customer has changed it since.\n\nOK = make a new sale from the updated order (then cancel #${s.sale_no} so stock isn't taken twice)\nCancel = leave it`)) return; }
    Sell.reset(); Sell.open(); Sell.parseOrder(w.message||''); Sell.paidNow(false); Sell.webOrderId=w.id; toast(w.proof_at?`${w.id} loaded — screenshot attached. Switch to Paid once it's in your bank`:`${w.id} loaded as awaiting payment — check it, then go`,'ok',4500); },
  async proofs(id){ if(!App.ownerOnly()) return; const w=this.find(id); mk.sheet('sh-proof','Payment <em>screenshot</em>'); Sheet.open('sh-proof'); const b=$('sh-proof-b'); b.innerHTML='<div class="empty">Loading…</div>';
    let rows=[]; if(Store.mode==='cloud'){ const {data,error}=await Store.sb.from('web_order_proofs').select('id,image,created_at').eq('order_id',id).order('created_at'); if(error){ b.innerHTML=`<div class="note">${esc(error.message)}</div>`; return; } rows=data||[]; } else rows=(Store.cache.web_order_proofs||[]).filter(x=>x.order_id===id);
    b.innerHTML=`<div class="hint" style="margin-top:0">${esc(w?w.name+' · '+w.id+' · '+money(w.total):id)}. Check it matches your bank before marking it paid.</div>`+(rows.map(r=>`<div class="card" style="margin-bottom:12px;overflow:hidden"><img src="${esc(r.image)}" alt="Payment screenshot" style="display:block;width:100%;height:auto"><div class="hint" style="margin:8px 12px">${new Date(r.created_at).toLocaleString('en-AU',{day:'numeric',month:'short',hour:'numeric',minute:'2-digit'})}</div></div>`).join('')||'<div class="empty">No screenshot found</div>'); },
  async dismiss(id){ if(!App.ownerOnly()) return; const w=this.find(id); if(!w||!confirm(`Dismiss ${w.id} from ${w.name||'this customer'}? It comes back if they resend it.`)) return; w.status='dismissed'; try{ await Store.upsert('web_orders',{id:w.id,status:'dismissed'}); }catch(e){} this.render(); },
};
(()=>{
  $('home-strip')?.insertAdjacentHTML('beforebegin','<div id="home-web" class="owner-only"></div>');
  $('sales-seg')?.insertAdjacentHTML('beforebegin','<div id="sales-web" class="owner-only"></div>');
  const _load=Store.loadAll.bind(Store);
  Store.loadAll=async function(){ await _load();
    if(this.mode==='cloud'){ try{ const {data,error}=await this.sb.from('web_orders').select('*').order('updated_at',{ascending:false}).limit(200); this.cache.web_orders=error?null:(data||[]); }catch(e){ this.cache.web_orders=null; } }
    else if(!Array.isArray(this.cache.web_orders)) this.cache.web_orders=[];
    // ping when one arrives or changes while the app is open
    const L=WebOrders.open(); const sig=Object.fromEntries(L.map(w=>[w.id,w.updated_at]));
    if(WebOrders.seen&&!App.courier){ const fresh=L.filter(w=>WebOrders.seen[w.id]!==w.updated_at); if(fresh.length){ toast(fresh.length===1?`🛒 ${fresh[0].status==='changed'||WebOrders.seen[fresh[0].id]?'Order changed':'New web order'}: ${fresh[0].name}`:`🛒 ${fresh.length} web orders need you`,'ok',5000); try{ navigator.vibrate&&navigator.vibrate(80); }catch(e){} } }
    WebOrders.seen=sig; };
  const _hr=Home.render.bind(Home); Home.render=function(){ _hr(); try{ WebOrders.render(); }catch(e){ console.error('web orders',e); } };
  const _sr=Sales.render.bind(Sales); Sales.render=function(){ _sr(); try{ WebOrders.render(); }catch(e){ console.error('web orders',e); } };
  // a sale made from a web order (from the card, or by pasting the same message) marks it done
  const _reset=Sell.reset.bind(Sell); Sell.reset=function(){ _reset(); this.webOrderId=null; };
  const _complete=Sell.complete.bind(Sell);
  Sell.complete=async function(){ const ref=this.orderRef, wid=this.webOrderId; const n0=Store.cache.sales.length; await _complete();
    if(Store.cache.sales.length<=n0) return;
    const w=(wid&&WebOrders.find(wid))||(ref&&WebOrders.open().find(x=>x.ref===ref)); if(!w) return;
    const sale=[...Store.cache.sales].sort((a,b)=>(b.created_at||'')>(a.created_at||'')?1:-1)[0];
    w.status='accepted'; w.sale_id=sale?sale.id:null; try{ await Store.upsert('web_orders',{id:w.id,status:'accepted',sale_id:w.sale_id}); }catch(e){} WebOrders.render(); };
})();
