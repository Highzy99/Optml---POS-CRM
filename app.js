/* ============================================================
   OPTML CRM v2 — app.js
   Engine (Store · Telegram · Data · parser) carried from tested v1.
   All UI rebuilt: Nav · Home · Sell · Sales · Inv · PO · Mov · Cust · Settings · Reports
   ============================================================ */
'use strict';
// ============================================================
// UTIL
// ============================================================
const $ = id => document.getElementById(id);
const $$ = sel => Array.from(document.querySelectorAll(sel));
const uid = (p='') => p + Date.now().toString(36) + Math.random().toString(36).slice(2,7);
const today = () => { const d=new Date(); d.setMinutes(d.getMinutes()-d.getTimezoneOffset()); return d.toISOString().slice(0,10); };
const addDays = (n, from) => { const d = from ? new Date(from) : new Date(); d.setDate(d.getDate()+n); d.setMinutes(d.getMinutes()-d.getTimezoneOffset()); return d.toISOString().slice(0,10); };
const money = n => { const v=Math.round((+n||0)*100)/100; const whole=Math.abs(v-Math.round(v))<0.005; return (v<0?'−':'')+'$'+Math.abs(v).toLocaleString('en-AU',{minimumFractionDigits:whole?0:2,maximumFractionDigits:2}); };
const esc = s => String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const sum = (arr, f) => arr.reduce((a,x)=>a+(+f(x)||0),0);
const firstName = n => (n||'').trim().split(/\s+/)[0] || 'there';
const fmtDate = d => d ? new Date(d+'T00:00:00').toLocaleDateString('en-AU',{day:'numeric',month:'short'}) : '—';
const fmtDateFull = d => d ? new Date(d+'T00:00:00').toLocaleDateString('en-AU',{day:'numeric',month:'short',year:'numeric'}) : '—';

let toastTimer;
function toast(msg, kind='ok', ms=2600){
  const t=$('toast'); t.textContent=msg; t.className='show '+kind;
  clearTimeout(toastTimer); toastTimer=setTimeout(()=>t.className='',ms);
}
async function copyText(s){
  try{ await navigator.clipboard.writeText(s); return true; }
  catch(e){ const ta=document.createElement('textarea'); ta.value=s; ta.style.cssText='position:fixed;opacity:0'; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); return true; }
}
function stockStatus(p){ if(p.soon) return 'soon'; if(p.stock<=0) return 'out'; if(p.stock<=p.reorder) return 'low'; return 'ok'; }

// ============================================================
// STORE  — single interface; Supabase or localStorage behind it
// ============================================================
const Store = {
  mode: 'local', sb: null,
  cache: { products:[], customers:[], sales:[], purchase_orders:[], movements:[], courier_payments:[], settings:{} },
  LS_KEY: 'optml_crm_v1',

  async init(){
    let conn = JSON.parse(localStorage.getItem('optml_conn')||'null');
    if(!conn && !localStorage.getItem('optml_skip_setup') && window.DEFAULT_CONN_OK!==false) conn = DEFAULT_CONN;
    if(conn && conn.url && conn.key && window.supabase){
      this.sb = window.supabase.createClient(conn.url, conn.key);
      this.mode = 'cloud';
    } else { this.mode='local'; }
  },

  // ---- load everything into cache ----
  async loadAll(){
    if(this.mode==='cloud'){
      const [p,c,s,po,m,st,cp] = await Promise.all([
        this.sb.from('products').select('*').order('category').order('name'),
        this.sb.from('customers').select('*').order('name'),
        this.sb.from('sales').select('*').order('created_at',{ascending:false}),
        this.sb.from('purchase_orders').select('*').order('created_at',{ascending:false}),
        this.sb.from('movements').select('*').order('created_at',{ascending:false}).limit(500),
        this.sb.from('settings').select('*'),
        this.sb.from('courier_payments').select('*').order('date',{ascending:false}),
      ]);
      for(const r of [p,c,s,po,m,st]) if(r.error) throw r.error;
      this.cache.courier_payments = cp.error?[]:(cp.data||[]);
      this.cache.products = p.data||[]; this.cache.customers=c.data||[]; this.cache.sales=s.data||[];
      this.cache.purchase_orders=po.data||[]; this.cache.movements=m.data||[];
      this.cache.settings = Object.fromEntries((st.data||[]).map(r=>[r.key, r.value]));
    } else {
      const raw = JSON.parse(localStorage.getItem(this.LS_KEY)||'null');
      if(raw) this.cache = {...this.cache, ...raw}; if(!this.cache.courier_payments) this.cache.courier_payments=[];
      if(!this.cache.products.length) this.cache.products = SEED_PRODUCTS.map(p=>({...p}));
      this.cache.products.forEach(p=>{ if(p.hidden===undefined) p.hidden=HIDDEN_DEFAULT.has(p.id); p.launch=!p.hidden; if(p.sell5===undefined&&PRICES[p.sku]){ const pr=PRICES[p.sku]; p.sell1=pr[0]; p.sell3=pr[1]; p.sell5=pr[2]; if(pr[3]!=null) p.sell10=pr[3]; } if(LEGACY_CAT[p.category]) p.category=LEGACY_CAT[p.category]; const s=SUPPLIER_COST[p.id]; if(s&&!p.supplier_sku){ p.supplier_sku=s[0]; if(!p.cost) p.cost=s[1]; } });
      this.cache.settings = {...DEFAULT_SETTINGS, ...(this.cache.settings||{})};
      this.persistLocal();
    }
    if(!this.cache.settings.shipping) this.cache.settings.shipping = DEFAULT_SETTINGS.shipping;
    if(!this.cache.settings.courier_template) this.cache.settings.courier_template = DEFAULT_SETTINGS.courier_template;
    if(!this.cache.settings.dispatch_template) this.cache.settings.dispatch_template = DEFAULT_SETTINGS.dispatch_template;
  },
  persistLocal(){ if(this.mode==='local') localStorage.setItem(this.LS_KEY, JSON.stringify(this.cache)); },

  // ---- generic upsert / delete ----
  async upsert(table, row){
    const list = this.cache[table]; const i = list.findIndex(x=>x.id===row.id);
    if(i>=0) list[i] = {...list[i], ...row}; else list.unshift(row);
    if(this.mode==='cloud'){ const {error} = await this.sb.from(table).upsert(row); if(error){ toast('Save failed: '+error.message,'err',4000); throw error; } }
    else this.persistLocal();
    return row;
  },
  async remove(table, id){
    this.cache[table] = this.cache[table].filter(x=>x.id!==id);
    if(this.mode==='cloud'){ const {error}=await this.sb.from(table).delete().eq('id',id); if(error){ toast('Delete failed','err'); throw error; } }
    else this.persistLocal();
  },
  async setSetting(key, value){
    this.cache.settings[key]=value;
    if(this.mode==='cloud'){ const {error}=await this.sb.from('settings').upsert({key,value}); if(error) toast('Settings save failed','err'); }
    else this.persistLocal();
  },
  get(k){ return this.cache.settings[k]; },

  // ---- movements helper ----
  async logMove(product, type, qty, note){
    await this.upsert('movements', { id:uid('m'), product_id:product.id, product_name:product.name, sku:product.sku, type, qty, note:note||'', date:today(), created_at:new Date().toISOString() });
  },
  async adjustStock(product, delta, type, note){
    product.stock = Math.max(0, (product.stock||0) + delta);
    await this.upsert('products', {id:product.id, stock:product.stock});
    await this.logMove(product, type, delta, note);
  },
};

const DEFAULT_SETTINGS = {
  shipping: {flat:15, free_over:200},
  profit: {fx:1.55, courier_pct:25},
  quote_template: "Hi {first_name}! Here's your OPTML quote 😊\n\n{items}\n{bac}\nSubtotal {subtotal}\n{discount}Shipping {shipping}\nTotal {total}\n\nPay by cash, BKP or KJ — reply here and I'll get it packed and sent today 📦",
  whatsapp: {mode:'app', phone_id:'', token:'', dispatch_template:'', lang:'en', courier:''},
  courier_template: "📦 NEW ORDER #{sale_no}\n\n👤 {name}\n📱 {phone}\n📍 {address}\n\n{items}\n{bac}\n\n💬 {notes}",
  dispatch_template: "Hi {first_name}! Your order has been dispatched and dropped to the post office 😊\n\nYou'll receive a notification once it's been scanned into the network. If you have any questions don't hesitate to reach out 😊 📦\n\nTrack here 👉 https://auspost.com.au/mypost/track/#/details/{tracking}",
  telegram: {token:'', chat:''},
};


// ---- OPTML goal categories (brand colour system) ----
const GOALS = {
  Weight:{slug:'weight',desc:'Metabolic & body composition'},Energy:{slug:'energy',desc:'Cellular energy & mitochondrial'},Restore:{slug:'restore',desc:'Tissue repair & recovery'},
  Growth:{slug:'growth',desc:'Growth hormone signalling'},Edge:{slug:'edge',desc:'Cognitive & neurological'},Vitality:{slug:'vitality',desc:'Hormonal & reproductive'},
  Sleep:{slug:'sleep',desc:'Deeper rest'},Immunity:{slug:'immunity',desc:'Daily defence'},Glow:{slug:'glow',desc:'Dermatology, pigmentation & skin'},Essentials:{slug:'essentials',desc:'Reconstitution supplies'},
};
const GOAL_ORDER=Object.keys(GOALS);
const goalSlug=c=>(GOALS[c]||{}).slug||'essentials';
const goalBadge=c=>{ const g=GOALS[c]; return g&&g.slug!=='essentials'?`<img class="goal-badge" src="${(window.GOAL_BADGE||{})[g.slug+'-cont']||(ASSET+'goals/'+g.slug+'-cont.svg')}" alt="">`:''; };
const LEGACY_CAT={'Weight & Burn':'Weight','Repair & Recovery':'Restore','Performance & Build':'Growth','Skin & Glow':'Glow','Supplies':'Essentials'};
const ASSET = window.OPTML_ASSET_BASE || 'assets/';
const pimg=(sku,cls='')=>{ const src=(window.PRODUCT_IMG&&window.PRODUCT_IMG[sku])||(ASSET+'products/'+sku+'.jpg'); return `<img class="${cls}" src="${src}" alt="" loading="lazy" onerror="this.style.visibility='hidden'">`; };
const ICON={
  rocket:'<svg viewBox="0 0 24 24"><path d="M5 16c-1 1-1.5 4-1.5 4s3-.5 4-1.5M14.5 3.5c3-1 6 2 5 5-1.5 4.5-6 8.5-8.5 9.5L7 14c1-2.5 5-7 7.5-10.5z"/><circle cx="14.5" cy="9.5" r="1.5"/><path d="M7 14l-3-1 3-3M11 18l1 3 3-3"/></svg>',
  send:'<svg viewBox="0 0 24 24"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4z"/></svg>',
  box:'<svg viewBox="0 0 24 24"><path d="M21 8l-9-5-9 5v8l9 5 9-5zM3 8l9 5 9-5M12 13v8"/></svg>',
  clock:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  truck:'<svg viewBox="0 0 24 24"><path d="M1 5h13v11H1zM14 9h5l3 3v4h-8z"/><circle cx="5" cy="18" r="2"/><circle cx="18" cy="18" r="2"/></svg>',
};
const SUPPLIER_COST = {p01:['RT10',7],p02:['RT20',9.8],p03:['RT30',14],p04:['TR10',4.3],p05:['TR20',6.3],p06:['TR30',7.7],p07:['CGL5',8.8],p08:['CGL10',14.5],p09:['TSM10',15],p10:['10AD',15],p11:['50AM',9],p13:['MS10',5],p14:['MS40',15],p15:['NJ500',7],p16:['NJ1000',10],p17:['2S10',6.5],p18:['2S50',27],p19:['BC10',6],p20:['RA10',4.8],p21:['KPV10',4.8],p22:['BT10',12],p23:['BB20',14.5],p24:['BBG70',16.3],p25:['Klow',18],p27:['CP10',7.5],p28:['G610',4.6],p29:['SMO10',12],p30:['IG1',17],p31:['SK10',5.5],p32:['XA10',5.5],p33:['VIP10',12],p35:['KS10',7],p36:['P41',5],p37:['G10K',11],p38:['G75',5],p39:['DS10',5.8],p40:['TA10',14],p41:['LL37',6.5],p42:['CU',3.2],p43:['CU100',4.5],p44:['MT1',4],p45:['ML10',4],p46:['ET10',4.6],p47:['ET50',12],p48:['NP810',4],p49:['F410',21],p50:['BA3',1],p51:['BA10',1.4]}; // HXTNT price list (Oct 2026) — USD per vial (kit of 10 ÷ 10)
const HIDDEN_DEFAULT = new Set(["p11", "p10", "p08", "p07", "p15", "p17", "p18", "p20", "p30", "p29", "p33", "p36", "p34", "p38", "p41", "p40", "p44", "p49", "p48"]);
// Current prices (AUD): retail single / 3 / 5 vials from otpml-pricelist, 10-vial wholesale from optml-wholesale-catalogue
const PRICES = {RE10:[149,402,649,799],RE20:[239,645,999,1199],RE30:[299,807,1249,1499],GH50:[59,149,219,389],GH100:[79,209,299,539],ME10:[79,209,299,489],WO20:[129,348,549,739],GL70:[149,402,633,889],KL80:[179,483,739,989],MO10:[69,179,249,389],MO40:[209,564,839,1089],TE10:[149,402,649,889],BA50:[89,240,369,439],BP10:[69,179,249,489],CJ10:[129,348,509,null],DS10:[89,240,399,539],GH10:[59,159,259,439],KI10:[89,240,399,589],KP10:[89,239,349,439],NA10:[169,456,749,939],SK10:[79,209,319,439],SL10:[89,219,359,589],SX10:[79,209,319,439],TB10:[119,319,479,699],TI10:[119,319,479,589],TI20:[179,479,719,879],TI30:[219,589,879,1089]};
const SEED_PRODUCTS = (()=>{
  const mk=(id,name,sku,cat,s1,s3,s10,bac='3ml',soon=false)=>({id,name,sku,category:cat,stock:0,reorder:5,cost:0,sell1:s1,sell3:s3,sell5:null,sell10:s10,launch:false,soon,bac_size:bac});
  return [
    mk('p01','Retatrutide 10mg','RE10','Weight',180,500,1100),mk('p02','Retatrutide 20mg','RE20','Weight',320,800,1500),mk('p03','Retatrutide 30mg','RE30','Weight',400,1000,1750),
    mk('p04','Tirzepatide 10mg','TI10','Weight',150,400,750),mk('p05','Tirzepatide 20mg','TI20','Weight',250,680,1125),mk('p06','Tirzepatide 30mg','TI30','Weight',320,800,1500),
    mk('p07','Cagrilintide 5mg','CA05','Weight',140,320,700),mk('p08','Cagrilintide 10mg','CA10','Weight',0,0,0),mk('p09','Tesamorelin 10mg','TE10','Weight',180,432,900),
    mk('p10','AOD-9604 10mg','AO10','Weight',120,288,600),mk('p11','5-Amino-1MQ 50mg','AM50','Weight',110,264,550),mk('p12','SLU-PP-332 1mg caps','SL10','Weight',120,300,0,'none'),
    mk('p13','MOTS-c 10mg','MO10','Energy',90,216,450),mk('p14','MOTS-c 40mg','MO40','Energy',250,600,1250),mk('p15','NAD+ 500mg','NA50','Energy',0,0,0,'10ml'),mk('p16','NAD+ 1000mg','NA10','Energy',180,432,900,'10ml'),
    mk('p17','SS-31 10mg','SS10','Energy',0,0,0),mk('p18','SS-31 50mg','SS50','Energy',0,0,0),
    mk('p19','BPC-157 10mg','BP10','Restore',90,220,500),mk('p20','ARA-290 10mg','AR10','Restore',0,0,0),mk('p21','KPV 10mg','KP10','Restore',90,216,450),
    mk('p22','TB-500 10mg','TB10','Restore',130,312,650),mk('p23','Wolverine Stack 20mg','WO20','Restore',160,432,900),mk('p24','Glow Stack 70mg','GL70','Restore',180,470,900),
    mk('p25','Klow Stack 80mg','KL80','Restore',200,500,1000),mk('p26','BPC-157 Arginate 500mcg caps','BA50','Restore',0,0,0,'none'),
    mk('p27','CJC / Ipamorelin 5mg/5mg','CJ10','Growth',150,360,750),mk('p28','GHRP-6 10mg','GH10','Growth',0,0,0),mk('p29','Sermorelin 10mg','SR10','Growth',0,0,0),mk('p30','IGF-1 LR3 1mg','IG01','Growth',180,432,900),
    mk('p31','Selank 10mg','SK10','Edge',80,192,400),mk('p32','Semax 10mg','SX10','Edge',100,240,500),mk('p33','VIP 10mg','VI10','Edge',0,0,0),
    mk('p34','Testagen 20mg','TS20','Vitality',170,408,850),mk('p35','Kisspeptin 10mg','KI10','Vitality',100,432,900),mk('p36','PT-141 10mg','PT10','Vitality',0,0,0),mk('p37','HCG 10,000iu','HC10','Vitality',180,432,900),mk('p38','HMG 75iu','HM75','Vitality',80,240,500),
    mk('p39','DSIP 10mg','DS10','Sleep',110,264,550),
    mk('p40','Thymosin Alpha-1 10mg','TH10','Immunity',0,0,0,'3ml',true),mk('p41','LL-37 5mg','LL05','Immunity',0,0,0,'3ml',true),
    mk('p42','GHK-Cu 50mg','GH50','Glow',100,240,500),mk('p43','GHK-Cu 100mg','GH100','Glow',0,0,0),mk('p44','Melanotan I 10mg','M110','Glow',0,0,0),mk('p45','Melanotan II 10mg','ME10','Glow',100,240,500),
    mk('p46','Epithalon 10mg','EP10','Glow',0,0,0),mk('p47','Epithalon 50mg','EP50','Glow',0,0,0),mk('p48','SNAP-8 10mg','SN10','Glow',80,192,400),mk('p49','FOXO1-DRI 10mg','FO10','Glow',0,0,0),
    mk('p50','Bacteriostatic Water 3ml','BW03','Essentials',15,35,100,'none'),mk('p51','Bacteriostatic Water 10ml','BW10','Essentials',30,70,150,'none'),
  ].map(p=>{ const s=SUPPLIER_COST[p.id]; const q=s?{...p,supplier_sku:s[0],cost:s[1]}:{...p}; q.hidden=HIDDEN_DEFAULT.has(p.id); q.launch=!q.hidden; const pr=PRICES[q.sku]; if(pr){ q.sell1=pr[0]; q.sell3=pr[1]; q.sell5=pr[2]; if(pr[3]!=null) q.sell10=pr[3]; } return q; });
})();

// ============================================================
// TELEGRAM
// ============================================================
const Telegram = {
  async send(text, cfg){
    cfg = cfg || Store.get('telegram') || {};
    if(!cfg.token || !cfg.chat) return false;
    try{
      const r=await fetch(`https://api.telegram.org/bot${cfg.token}/sendMessage`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({chat_id:cfg.chat,text,disable_web_page_preview:true})});
      const j=await r.json(); return !!j.ok;
    }catch(e){ console.error(e); return false; }
  },
  courierMessage(sale){
    const c=sale.customer||{};
    const addr=[c.address,c.city,c.state,c.postcode].filter(Boolean).join(', ');
    const items=(sale.items||[]).map(i=>`• ${i.name} ×${i.count}${i.pack_qty>1?' ('+i.pack_qty+'-pack)':''}`).join('\n') || '• (no products)';
    const bac=[sale.bac3?`${sale.bac3}× Bac Water 3ml`:'', sale.bac10?`${sale.bac10}× Bac Water 10ml`:''].filter(Boolean).join('\n');
    const tpl=Store.get('courier_template')||DEFAULT_SETTINGS.courier_template;
    return tpl.replace('{sale_no}',sale.sale_no||sale.id.slice(-5).toUpperCase()).replace('{name}',c.name||'—').replace('{phone}',c.phone||'—').replace('{address}',addr||'—')
      .replace('{items}',items).replace('{bac}',bac).replace('{notes}',sale.notes||'—').replace('{total}',money(sale.total)).replace(/\n{3,}/g,'\n\n').trim();
  },
  async sendOrder(sale){
    const ok=await this.send(this.courierMessage(sale));
    if(ok){ sale.courier_sent_at=new Date().toISOString(); if(sale.status==='Paid') sale.status='Sent to Courier'; await Store.upsert('sales',{id:sale.id,courier_sent_at:sale.courier_sent_at,status:sale.status}); }
    return ok;
  },
};



// ============================================================
// DATA — backup / restore
// ============================================================
const Data = {
  exportJSON(){
    const blob=new Blob([JSON.stringify({exported:new Date().toISOString(),...Store.cache},null,2)],{type:'application/json'});
    const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=`optml-backup-${today()}.json`; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),5000); toast('Backup downloaded');
  },
  async importJSON(input){
    const f=input.files[0]; if(!f) return; input.value='';
    try{
      const d=JSON.parse(await f.text());
      if(!d.skus && !d.products){ toast('Not a valid backup','err'); return; }
      // accept old stocktake format too
      const products=(d.products||d.skus||[]).map(p=>({id:p.id,name:p.name,sku:p.sku||p.skuCode||'',category:p.category||p.cat||'Uncategorised',stock:+p.stock||0,reorder:+p.reorder||5,cost:+p.cost||0,sell1:+p.sell1||0,sell3:+p.sell3||0,sell5:+p.sell5||null,sell10:+p.sell10||0,launch:!!p.launch,soon:!!p.soon,bac_size:p.bac_size||(/NAD/i.test(p.name)?'10ml':/water|caps/i.test(p.name)?'none':'3ml')}));
      const customers=(d.customers||[]).map(c=>({id:c.id,name:c.name||'',phone:c.phone||'',email:c.email||'',address:c.address||'',city:c.city||'',state:c.state||'',postcode:c.postcode||'',notes:c.notes||'',tags:c.tags||'',source:c.source||'',order_count:+c.order_count||+c.orderCount||0,total_spent:+c.total_spent||0,last_seen:c.last_seen||c.lastSeen||null,created_at:c.created_at||c.created||new Date().toISOString()}));
      const sales=(d.sales||[]).map(s=>({id:s.id,sale_no:s.sale_no||null,date:s.date,customer_id:s.customer_id||null,customer:s.customer||{},items:(s.items||[]).map(i=>({product_id:i.product_id||i.skuId,name:i.name,sku:i.sku||i.skuCode,pack_qty:i.pack_qty||i.packQty||1,count:i.count||1,price:+i.price||0})),bac3:+s.bac3||0,bac10:+s.bac10||0,manual_amount:+s.manual_amount||0,subtotal:+s.subtotal||0,discount:+s.discount||0,shipping:+s.shipping||0,total:+s.total||0,payment:s.payment||'Cash',split_payments:s.split_payments||s.splitPayments||[],fulfilment:s.fulfilment||'Shipped',status:s.status||'Delivered',tracking:s.tracking||'',notes:s.notes||'',created_at:s.created_at||new Date(s.date||today()).toISOString()}));
      const orders=(d.purchase_orders||d.orders||[]).map(o=>({id:o.id,product_id:o.product_id||o.skuId,qty:+o.qty||0,ref:o.ref||'',supplier:o.supplier||o.supplierName||'',order_date:o.order_date||o.orderDate||null,eta:o.eta||null,delivery:o.delivery||(typeof o.supplier==='object'?o.supplier:{}),status:o.status||'pending',arrived_date:o.arrived_date||o.arrivedDate||null,created_at:o.created_at||new Date().toISOString()}));
      const movements=(d.movements||[]).map(m=>({id:m.id,product_id:m.product_id||m.skuId,product_name:m.product_name||m.skuName,sku:m.sku||m.skuCode,type:m.type,qty:+m.qty||0,note:m.note||'',date:m.date,created_at:m.created_at||new Date(m.date||today()).toISOString()}));
      if(!confirm(`Restore ${products.length} products, ${sales.length} sales, ${customers.length} customers, ${orders.length} orders?\n\nThis MERGES by id (existing rows with same id are overwritten).`)) return;
      UI.sync('','Restoring…');
      const chunk=async(t,rows)=>{ for(let i=0;i<rows.length;i+=200){ const c=rows.slice(i,i+200); if(Store.mode==='cloud'){ const {error}=await Store.sb.from(t).upsert(c); if(error) throw error; } } };
      if(Store.mode==='cloud'){ await chunk('products',products); await chunk('customers',customers); await chunk('sales',sales); await chunk('purchase_orders',orders); await chunk('movements',movements); if(d.courier_payments) await chunk('courier_payments',d.courier_payments); if(d.settings) for(const [k,v] of Object.entries(d.settings)) await Store.setSetting(k,v); }
      else { const merge=(a,b)=>{ const m=new Map(a.map(x=>[x.id,x])); b.forEach(x=>m.set(x.id,{...(m.get(x.id)||{}),...x})); return [...m.values()]; }; Store.cache.courier_payments=merge(Store.cache.courier_payments||[],d.courier_payments||[]); Store.cache.products=merge(Store.cache.products,products); Store.cache.customers=merge(Store.cache.customers,customers); Store.cache.sales=merge(Store.cache.sales,sales); Store.cache.purchase_orders=merge(Store.cache.purchase_orders,orders); Store.cache.movements=merge(Store.cache.movements,movements); Store.cache.settings={...Store.cache.settings,...(d.settings||{})}; Store.persistLocal(); }
      await App.reload(); toast('Restored ✓','ok',4000);
    }catch(e){ console.error(e); toast('Restore failed: '+e.message,'err',5000); UI.sync('err','Error'); }
  },
};


// ============================================================
// AUTH
// ============================================================
const DEFAULT_CONN = {url:'https://suhxeslmyugjedjqwgtz.supabase.co', key:'sb_publishable_qnqBl5G9ybuh_9n9YpXSPw_kptUSiZi'};
const Auth = {
  showSetup(fromApp){
    const c=JSON.parse(localStorage.getItem('optml_conn')||'null')||DEFAULT_CONN; $('s-url').value=c.url||''; $('s-key').value=c.key||'';
    if(fromApp){ $('auth').classList.add('on'); $('app').classList.remove('on'); $('nav').classList.remove('on'); }
    $('auth-login').style.display='none'; $('auth-setup').style.display='block'; $('auth-sub').textContent='Connect to Supabase';
  },
  showLogin(){ $('auth-login').style.display='block'; $('auth-setup').style.display='none'; $('auth-sub').textContent='Sign in to continue'; },
  saveConn(){ const url=$('s-url').value.trim().replace(/\/$/,''), key=$('s-key').value.trim(); if(!url||!key){ toast('Both fields required','err'); return; } localStorage.setItem('optml_conn',JSON.stringify({url,key})); localStorage.removeItem('optml_skip_setup'); location.reload(); },
  connectCloud(){ localStorage.removeItem('optml_skip_setup'); localStorage.setItem('optml_conn',JSON.stringify(DEFAULT_CONN)); location.reload(); },
  useLocal(){ localStorage.removeItem('optml_conn'); localStorage.setItem('optml_skip_setup','1'); location.reload(); },
  async login(){ $('auth-err').style.display='none'; const {error}=await Store.sb.auth.signInWithPassword({email:$('a-email').value.trim(),password:$('a-pass').value}); if(error){ $('auth-err').textContent=error.message; $('auth-err').style.display='block'; return; } await App.start(); },
  async logout(){ if(!confirm('Sign out?')) return; if(Store.sb) await Store.sb.auth.signOut(); location.reload(); },
};

// ============================================================
// NAV / SHEET
// ============================================================
const Nav = {
  cur:'home',
  go(s){
    this.cur=s; $$('.screen').forEach(e=>e.classList.toggle('on',e.id==='sc-'+s)); $$('.nb').forEach(b=>b.classList.toggle('on',b.dataset.s===s));
    $('more-btn').style.display = s==='more'?'none':'flex';
    window.scrollTo({top:0});
    ({home:()=>Home.render(),sales:()=>Sales.render(),stock:()=>Inv.renderAll(),customers:()=>Cust.render(),more:()=>Settings.moreInfo()}[s]||(()=>{}))();
  },
  badges(){
    const S=Store.cache.sales; const open=S.filter(s=>['New','Paid','Sent to Courier'].includes(s.status)).length;
    const low=Store.cache.products.filter(p=>!p.soon&&!p.hidden&&p.stock<=p.reorder).length;
    const set=(id,n)=>{ const e=$(id); if(!e) return; e.textContent=n; e.style.display=n?'flex':'none'; };
    set('dot-home',open); set('dot-sales',open); set('dot-stock',low);
    const po=$('po-n'); if(po) po.textContent=Store.cache.purchase_orders.filter(o=>o.status==='pending').length;
  },
  sync(state,txt){ [['sync','sync-t'],['sync-home','sync-home-t']].forEach(([a,b])=>{ const s=$(a); if(!s) return; s.className='sync '+state; $(b).textContent=txt; }); },
};
const Sheet = { open(id){ $(id).classList.add('on'); }, close(id){ $(id).classList.remove('on'); } };
$$('.drawer-bg').forEach(d=>d.addEventListener('click',e=>{ if(e.target===d) d.classList.remove('on'); }));
document.addEventListener('click',e=>{ if(!e.target.closest('#c-sugg')&&!e.target.closest('#c-search')) $('c-sugg')?.classList.remove('on'); });


// ============================================================
// WHATSAPP — open-app deep links (wa.me) or Meta Cloud API
// ============================================================
const WA = {
  num(phone){ let d=(phone||'').replace(/\D/g,''); if(!d) return ''; if(d.startsWith('0')) d='61'+d.slice(1); else if(d.startsWith('610')) d='61'+d.slice(3); else if(d.length<=9) d='61'+d; return d; },
  link(phone,text){ return `https://wa.me/${this.num(phone)}${text?'?text='+encodeURIComponent(text):''}`; },
  open(phone,text){ const n=this.num(phone); if(!n){ toast('No phone number on this customer','err'); return false; } const a=document.createElement('a'); a.href=this.link(phone,text); a.target='_blank'; a.rel='noopener'; document.body.appendChild(a); a.click(); a.remove(); return true; },
  cfg(){ return Store.get('whatsapp')||{}; },
  apiReady(){ const c=this.cfg(); return c.mode==='api'&&c.phone_id&&c.token; },
  async api(body){ const c=this.cfg(); const r=await fetch(`https://graph.facebook.com/v21.0/${c.phone_id}/messages`,{method:'POST',headers:{'Authorization':'Bearer '+c.token,'Content-Type':'application/json'},body:JSON.stringify({messaging_product:'whatsapp',recipient_type:'individual',...body})}); const j=await r.json().catch(()=>({})); if(!r.ok||j.error) throw new Error((j.error&&j.error.message)||('HTTP '+r.status)); return j; },
  sendText(phone,text){ return this.api({to:this.num(phone),type:'text',text:{preview_url:true,body:text}}); },
  sendTemplate(phone,name,lang,params){ return this.api({to:this.num(phone),type:'template',template:{name,language:{code:lang||'en'},components:[{type:'body',parameters:params.map(t=>({type:'text',text:String(t)}))}]}}); },
  // dispatch: API template if configured, else open the app with the message prefilled
  async dispatch(sale,tracking){
    const c=sale.customer||{}; const text=Sales.dispatchMessage(sale,tracking);
    if(this.apiReady()&&this.cfg().dispatch_template){
      try{ await this.sendTemplate(c.phone,this.cfg().dispatch_template,this.cfg().lang||'en',[firstName(c.name)||'there',tracking]); return 'api'; }
      catch(e){ console.warn('WA api',e); toast('WhatsApp API failed ('+e.message+') — opening WhatsApp instead','err',4000); }
    }
    return this.open(c.phone,text)?'app':null;
  },
};

// ============================================================
// PROFIT (supplier cost USD → AUD, courier takes % of gross profit on shipped orders)
// ============================================================
const Profit = {
  cfg(){ const p=Store.get('profit')||{}; return {fx:+p.fx||1.55, pct:p.courier_pct===undefined||p.courier_pct===''?25:+p.courier_pct}; },
  costUSD(it){ if(it.cost_usd!==undefined&&it.cost_usd!==null) return +it.cost_usd; const p=Store.cache.products.find(x=>x.id===it.product_id); return p?(+p.cost||0):0; },
  of(sale){
    const {fx,pct}=this.cfg(); const items=sale.items||[];
    let usd=sum(items,i=>this.costUSD(i)*i.pack_qty*i.count);
    const b3=Store.cache.products.find(p=>p.sku==='BW03'), b10=Store.cache.products.find(p=>p.sku==='BW10');
    usd+=(sale.bac3||0)*(sale.bac3_cost_usd??(b3?+b3.cost||0:0))+(sale.bac10||0)*(sale.bac10_cost_usd??(b10?+b10.cost||0:0));
    const cogs=Math.round(usd*fx*100)/100; const gross=Math.round((+sale.total-cogs)*100)/100;
    const courier=sale.fulfilment==='Shipped'&&gross>0?Math.round(gross*pct/100*100)/100:0;
    return {cogs,gross,courier,net:Math.round((gross-courier)*100)/100,pct,fx,known:items.every(i=>this.costUSD(i)>0)};
  },
  sumOf(sales){ const t={cogs:0,gross:0,courier:0,net:0}; sales.forEach(s=>{ const p=this.of(s); t.cogs+=p.cogs; t.gross+=p.gross; t.courier+=p.courier; t.net+=p.net; }); return t; },
};


// ============================================================
// INSIGHTS (analytics)
// ============================================================
const Insights = {
  r:'30',
  open(){ Sheet.open('sh-insights'); this.render(); },
  set(r){ this.r=r; this.render(); },
  range(){ const t=today(); if(this.r==='7') return [addDays(-6),t,addDays(-13),addDays(-7)]; if(this.r==='30') return [addDays(-29),t,addDays(-59),addDays(-30)]; if(this.r==='90') return [addDays(-89),t,addDays(-179),addDays(-90)]; return ['0000-00-00',t,null,null]; },
  delta(a,b){ if(b===null||b===undefined||!b) return ''; const d=Math.round((a-b)/b*100); return `<span class="d ${d>=0?'up':'down'}" style="font-size:11px;margin-left:4px">${d>=0?'▲':'▼'}${Math.abs(d)}%</span>`; },
  render(){
    const [from,to,pf,pt]=this.range(); const all=Store.cache.sales.filter(s=>s.status!=='Cancelled');
    const S=all.filter(s=>s.date>=from&&s.date<=to), Pv=pf?all.filter(s=>s.date>=pf&&s.date<=pt):[];
    const rev=sum(S,s=>s.total), prevRev=sum(Pv,s=>s.total); const P=Profit.sumOf(S), PP=Profit.sumOf(Pv); const pc=Profit.cfg();
    const units=sum(S,s=>sum(s.items||[],i=>i.pack_qty*i.count)); const aov=S.length?rev/S.length:0, paov=Pv.length?sum(Pv,s=>s.total)/Pv.length:0;
    const custIds=new Set(S.map(s=>s.customer_id).filter(Boolean)); const repeat=[...custIds].filter(id=>all.filter(s=>s.customer_id===id&&s.date<=to).length>1).length;
    const newCust=Store.cache.customers.filter(c=>(c.created_at||'').slice(0,10)>=from&&(c.created_at||'').slice(0,10)<=to).length;
    // dispatch speed: paid → dispatched
    const sp=S.filter(s=>s.paid_at&&s.dispatched_at).map(s=>(new Date(s.dispatched_at)-new Date(s.paid_at))/36e5); const avgH=sp.length?sum(sp,x=>x)/sp.length:null;
    // trend: by day (≤31 days) or by week
    const days=Math.max(1,Math.round((new Date(to)-new Date(from==='0000-00-00'?(all[all.length-1]||{}).date||to:from))/864e5)+1);
    const buckets={}; const keyOf=d=>days<=31?d:(()=>{ const x=new Date(d); x.setDate(x.getDate()-((x.getDay()+6)%7)); return x.toISOString().slice(0,10); })();
    const start=from==='0000-00-00'?((all[all.length-1]||{}).date||to):from; for(let d=new Date(start);d<=new Date(to);d.setDate(d.getDate()+1)){ const k=keyOf(d.toISOString().slice(0,10)); buckets[k]=buckets[k]||{rev:0,net:0,n:0}; }
    S.forEach(s=>{ const k=keyOf(s.date); buckets[k]=buckets[k]||{rev:0,net:0,n:0}; buckets[k].rev+=+s.total; buckets[k].net+=Profit.of(s).net; buckets[k].n++; });
    const keys=Object.keys(buckets).sort(); const max=Math.max(1,...keys.map(k=>buckets[k].rev)); const W=600,H=120,bw=W/Math.max(1,keys.length);
    const trend=`<svg class="chart" viewBox="0 0 ${W} ${H+22}" preserveAspectRatio="none">${keys.map((k,i)=>{ const b=buckets[k]; const h=Math.max(2,b.rev/max*(H-6)), hn=Math.max(0,b.net/max*(H-6)); return `<rect class="bar ${b.rev?'':'dim'}" x="${i*bw+2}" y="${H-h}" width="${Math.max(2,bw-4)}" height="${h}" rx="2" opacity=".35"/><rect class="bar" x="${i*bw+2}" y="${H-hn}" width="${Math.max(2,bw-4)}" height="${hn}" rx="2"/>`; }).join('')}${keys.map((k,i)=>(keys.length>14&&i%Math.ceil(keys.length/7))?'':`<text x="${i*bw+bw/2}" y="${H+16}" text-anchor="middle">${fmtDate(k).split(' ')[0]}${days>31?' '+fmtDate(k).split(' ')[1]:''}</text>`).join('')}</svg><div class="legend" style="margin-top:6px"><span><i style="background:var(--go);opacity:.35"></i>Revenue</span><span><i style="background:var(--go)"></i>Net profit</span></div>`;
    // top products
    const byP={}; S.forEach(s=>(s.items||[]).forEach(i=>{ byP[i.name]=byP[i.name]||{r:0,u:0,c:0}; byP[i.name].r+=i.price*i.count; byP[i.name].u+=i.pack_qty*i.count; byP[i.name].c+=Profit.costUSD(i)*i.pack_qty*i.count*pc.fx; }));
    const top=Object.entries(byP).sort((a,b)=>b[1].r-a[1].r).slice(0,8); const tmax=Math.max(1,...top.map(x=>x[1].r));
    const topH=top.map(([n,v])=>`<div class="hbar"><span class="l">${esc(n)}</span><div class="b"><i style="width:${Math.round(v.r/tmax*100)}%"></i></div><span class="v">${money(v.r)}<small style="display:block;font-size:10px;color:var(--ink-3)">${v.u} vials · ${v.r?Math.round((v.r-v.c)/v.r*100):0}% gm</small></span></div>`).join('')||'<div class="empty">No sales in range</div>';
    // goal mix
    const byG={}; S.forEach(s=>(s.items||[]).forEach(i=>{ const p=Store.cache.products.find(x=>x.id===i.product_id); const g=p?p.category:'Other'; byG[g]=(byG[g]||0)+i.price*i.count; })); const gtot=sum(Object.values(byG),x=>x)||1;
    const GC={Weight:'#ff8787',Energy:'#ff7848',Restore:'#1f4cbb',Growth:'#92e8a6',Edge:'#febffc',Vitality:'#f0ea6a',Sleep:'#d0b3ff',Immunity:'#aeda51',Glow:'#ffc3d6',Essentials:'#cfd2d7',Other:'#cfd2d7'};
    const gs=Object.entries(byG).sort((a,b)=>b[1]-a[1]);
    const goalMix=gs.length?`<div class="stack">${gs.map(([g,v])=>`<i style="width:${Math.max(1,v/gtot*100)}%;background:${GC[g]||'#ccc'}"></i>`).join('')}</div><div class="legend">${gs.map(([g,v])=>`<span><i style="background:${GC[g]||'#ccc'}"></i>${esc(g)} ${Math.round(v/gtot*100)}%</span>`).join('')}</div>`:'<div class="empty">—</div>';
    // payment mix
    const byPay={}; S.forEach(s=>{ if(s.payment==='Split') (s.split_payments||[]).forEach(p=>byPay[p.method]=(byPay[p.method]||0)+ +p.amount); else byPay[s.payment]=(byPay[s.payment]||0)+ +s.total; }); const ptot=sum(Object.values(byPay),x=>x)||1; const PC={Cash:'#141412',BKP:'#0E6F62',KJ:'#5744C2'};
    const payMix=`<div class="stack">${Object.entries(byPay).map(([k,v])=>`<i style="width:${Math.max(1,v/ptot*100)}%;background:${PC[k]||'#999'}"></i>`).join('')}</div><div class="legend">${Object.entries(byPay).map(([k,v])=>`<span><i style="background:${PC[k]||'#999'}"></i>${k} ${money(v)} (${Math.round(v/ptot*100)}%)</span>`).join('')||'—'}</div>`;
    // day of week
    const dow=[0,0,0,0,0,0,0]; S.forEach(s=>{ dow[(new Date(s.date).getDay()+6)%7]+=+s.total; }); const dmax=Math.max(1,...dow);
    const dowH=`<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:6px;align-items:end;height:70px">${dow.map(v=>`<div style="background:${v===dmax&&v?'var(--go)':'var(--rule-2)'};height:${Math.max(3,v/dmax*100)}%;border-radius:4px"></div>`).join('')}</div><div style="display:grid;grid-template-columns:repeat(7,1fr);gap:6px;margin-top:4px" class="mono">${['M','T','W','T','F','S','S'].map(d=>`<div style="text-align:center;font-size:10px;color:var(--ink-3)">${d}</div>`).join('')}</div>`;
    // top customers
    const byC={}; S.forEach(s=>{ if(!s.customer_id) return; byC[s.customer_id]=byC[s.customer_id]||{r:0,n:0}; byC[s.customer_id].r+=+s.total; byC[s.customer_id].n++; });
    const topC=Object.entries(byC).sort((a,b)=>b[1].r-a[1].r).slice(0,5).map(([id,v])=>{ const c=Store.cache.customers.find(x=>x.id===id)||{name:'?'}; return `<div class="row tap" onclick="Cust.detail('${id}')"><div class="av">${esc((c.name||'?')[0].toUpperCase())}</div><div class="m"><div class="t">${esc(c.name)}</div><div class="u">${v.n} order${v.n!==1?'s':''}</div></div><div class="e"><span class="amt">${money(v.r)}</span></div></div>`; }).join('')||'<div class="empty">—</div>';
    // stock cover: velocity over last 30d → days of cover for launch products
    const v30={}; all.filter(s=>s.date>=addDays(-29)).forEach(s=>(s.items||[]).forEach(i=>v30[i.product_id]=(v30[i.product_id]||0)+i.pack_qty*i.count));
    const cover=Store.cache.products.filter(p=>!p.soon&&!p.hidden).map(p=>{ const perDay=(v30[p.id]||0)/30; const inc=Inv.incoming(p.id); return {p,perDay,days:perDay?Math.round((p.stock+inc)/perDay):null,inc}; }).sort((a,b)=>(a.days??9999)-(b.days??9999)).slice(0,8);
    const coverH=cover.map(r=>`<div class="row"><div class="m"><div class="t">${esc(r.p.name)}</div><div class="u">${r.p.stock} in stock${r.inc?' +'+r.inc+' incoming':''} · ${(r.perDay*7).toFixed(1)} vials/wk</div></div><div class="e"><span class="amt" style="color:${r.days===null?'var(--ink-4)':r.days<14?'var(--red)':r.days<30?'var(--amber)':'var(--go)'}">${r.days===null?'—':r.days+'d'}</span><span class="hint" style="margin:0">cover</span></div></div>`).join('')||'<div class="empty">No sales velocity yet</div>';
    const stockVal=sum(Store.cache.products.filter(p=>!p.hidden),p=>p.stock*(+p.cost||0))*pc.fx;
    $('ins-body').innerHTML=`
      <div class="seg" style="margin-bottom:14px">${[['7','7 days'],['30','30 days'],['90','90 days'],['all','All time']].map(([k,l])=>`<button class="${this.r===k?'on':''}" onclick="Insights.set('${k}')">${l}</button>`).join('')}</div>
      <div class="strip c2"><div class="s"><div class="k">Revenue</div><div class="v">${money(rev)}</div><div class="d">${S.length} orders${this.delta(rev,prevRev)}</div></div><div class="s"><div class="k">Net profit</div><div class="v go">${money(P.net)}</div><div class="d">${rev?Math.round(P.net/rev*100):0}% margin${this.delta(P.net,PP.net)}</div></div></div>
      <div class="card"><div class="pad"><div class="tl"><span class="k">Revenue</span><span class="v">${money(rev)}</span></div><div class="tl"><span class="k">Product cost <span class="mono" style="font-size:11px;color:var(--ink-3)">USD × ${pc.fx}</span></span><span class="v">−${money(P.cogs)}</span></div><div class="tl"><span class="k">Gross profit</span><span class="v">${money(P.gross)}</span></div><div class="tl"><span class="k">Courier ${pc.pct}% of gross (shipped)</span><span class="v">−${money(P.courier)}</span></div><div class="tl big"><span class="k">Net profit</span><span class="v" style="color:var(--go)">${money(P.net)}</span></div></div></div>
      <div class="strip"><div class="s"><div class="k">Avg order</div><div class="v">${money(aov)}</div><div class="d">${this.delta(aov,paov)||'&nbsp;'}</div></div><div class="s"><div class="k">Vials</div><div class="v">${units}</div><div class="d">${S.length?(units/S.length).toFixed(1):0} / order</div></div><div class="s"><div class="k">Dispatch</div><div class="v">${avgH===null?'—':avgH<48?Math.round(avgH)+'h':(avgH/24).toFixed(1)+'d'}</div><div class="d">paid → sent</div></div></div>
      <div class="sec">Trend <small>${days<=31?'per day':'per week'}</small></div><div class="card"><div class="pad" style="padding-bottom:10px">${trend}</div></div>
      <div class="sec">Top products <small>revenue · gross margin</small></div><div class="card"><div class="pad" style="padding-top:6px;padding-bottom:6px">${topH}</div></div>
      <div class="sec">Sales by goal</div><div class="card"><div class="pad">${goalMix}</div></div>
      <div class="sec">Payment mix</div><div class="card"><div class="pad">${payMix}</div></div>
      <div class="sec">Best days <small>revenue by weekday</small></div><div class="card"><div class="pad">${dowH}</div></div>
      <div class="sec">Customers</div><div class="strip"><div class="s"><div class="k">Buying</div><div class="v">${custIds.size}</div><div class="d">in range</div></div><div class="s"><div class="k">Repeat</div><div class="v">${custIds.size?Math.round(repeat/custIds.size*100):0}%</div><div class="d">${repeat} returning</div></div><div class="s"><div class="k">New</div><div class="v">${newCust}</div><div class="d">first order</div></div></div>
      <div class="card">${topC}</div>
      <div class="sec">Stock cover <small>at last-30-day pace</small></div><div class="card">${coverH}</div>
      <div class="note" style="margin-top:12px">Stock on hand is worth ${money(stockVal)} at supplier cost (USD × ${pc.fx}). Change the rate or courier share under Settings.</div>`;
  },
};


// ============================================================
// COURIER PAYMENTS — tracks the courier's share of profit (accrues when an order is dispatched)
// ============================================================
const Courier = {
  owedSales(){ return Store.cache.sales.filter(s=>s.fulfilment==='Shipped'&&['Dispatched','Delivered'].includes(s.status)&&Profit.of(s).courier>0); },
  unpaid(){ return this.owedSales().filter(s=>!s.courier_paid_at).sort((a,b)=>a.date<b.date?-1:1); },
  totals(){
    const owed=this.owedSales(); const accrued=sum(owed,s=>Profit.of(s).courier); const paid=sum(Store.cache.courier_payments,p=>+p.amount||0);
    const unpaid=this.unpaid(); const balance=Math.round((accrued-paid)*100)/100;
    const t=today(), w=addDays(-6), m=t.slice(0,8)+'01';
    return {accrued:Math.round(accrued*100)/100,paid:Math.round(paid*100)/100,balance,unpaidN:unpaid.length,week:sum(owed.filter(s=>s.date>=w),s=>Profit.of(s).courier),month:sum(owed.filter(s=>s.date>=m),s=>Profit.of(s).courier),oldest:unpaid[0]?unpaid[0].date:null};
  },
  open(){ Sheet.open('sh-courier'); this.render(); },
  render(){
    const T=this.totals(); const U=this.unpaid(); const P=[...Store.cache.courier_payments].sort((a,b)=>(b.date+b.created_at)>(a.date+a.created_at)?1:-1); const pc=Profit.cfg(); const wa=WA.cfg();
    const days=T.oldest?Math.round((new Date(today())-new Date(T.oldest))/864e5):0;
    $('co-body').innerHTML=`
      <div class="strip"><div class="s"><div class="k">${T.balance<0?'Courier credit':'Owed now'}</div><div class="v ${T.balance>0?'amber':'go'}">${money(Math.abs(T.balance))}</div><div class="d">${T.unpaidN} order${T.unpaidN!==1?'s':''}${days>7?' · oldest '+days+'d':''}</div></div><div class="s"><div class="k">This month</div><div class="v">${money(T.month)}</div><div class="d">earned</div></div><div class="s"><div class="k">Paid to date</div><div class="v">${money(T.paid)}</div><div class="d">of ${money(T.accrued)}</div></div></div>
      <div class="actions" style="margin-bottom:14px"><button class="btn go" onclick="Courier.openPay()" ${T.balance<=0?'disabled':''}>Record payment${T.balance>0?' · '+money(T.balance):''}</button><button class="btn" onclick="Reports.courier()">Statement</button>${WA.num(wa.courier)?`<button class="btn" onclick="Courier.waStatement()">Send on WhatsApp</button>`:''}</div>
      <div class="note" style="margin-bottom:14px">Courier earns <b>${pc.pct}%</b> of gross profit on every shipped order, counted once it's dispatched. Change the rate under Settings → Profit.</div>
      <div class="sec" style="margin-top:0">Unpaid orders <small>${U.length}</small></div>
      <div class="card">${U.map(s=>{ const p=Profit.of(s); return `<div class="row tap" onclick="Sales.detail('${s.id}')"><div class="m"><div class="t">${esc((s.customer||{}).name||'Walk-in')}<span class="id">#${s.sale_no}</span></div><div class="u">${(s.items||[]).map(i=>i.name+' ×'+i.count).join(', ')}</div><div class="w"><span>${fmtDate(s.date)}</span><span>sale ${money(s.total)}</span><span>gross ${money(p.gross)}</span></div></div><div class="e"><span class="amt" style="color:var(--amber)">${money(p.courier)}</span><span class="hint" style="margin:0">${pc.pct}%</span></div></div>`; }).join('')||'<div class="empty"><div class="big">✓</div>All settled</div>'}</div>
      <div class="sec">Payments</div>
      <div class="card">${P.map(p=>`<div class="row"><div class="m"><div class="t">${money(p.amount)}<span class="tag gray">${esc(p.method||'')}</span></div><div class="u">${esc(p.note||'')}${(p.sale_ids||[]).length?` · ${p.sale_ids.length} order${p.sale_ids.length>1?'s':''}`:''}</div><div class="w"><span>${fmtDateFull(p.date)}</span></div></div><div class="e"><button class="btn xs ghost" style="color:var(--red)" onclick="Courier.del('${p.id}')">Undo</button></div></div>`).join('')||'<div class="empty">No payments recorded yet</div>'}</div>`;
  },
  openPay(){ const T=this.totals(); $('cp-amount').value=T.balance>0?T.balance:''; $('cp-date').value=today(); $('cp-method').value='BKP'; $('cp-note').value=''; this.payPreview(); Sheet.open('dr-cpay'); },
  payPreview(){ const amt=+$('cp-amount').value||0; const U=this.unpaid(); const credit=Math.max(0,Math.round((sum(Store.cache.courier_payments,p=>+p.amount||0)-sum(this.owedSales().filter(s=>s.courier_paid_at),s=>Profit.of(s).courier))*100)/100); let left=amt+credit, n=0; for(const s of U){ const c=Profit.of(s).courier; if(c<=left+0.005){ left-=c; n++; } else break; } $('cp-preview').textContent=amt?`Settles ${n} order${n!==1?'s':''}${credit?` (incl. ${money(credit)} existing credit)`:''}${left>0.005?` · ${money(left)} left over, carried as credit`:''}`:''; },
  async save(){
    const amt=Math.round((+$('cp-amount').value||0)*100)/100; if(amt<=0){ toast('Enter an amount','err'); return; }
    const U=this.unpaid(); const ids=[]; const credit=Math.max(0,Math.round((sum(Store.cache.courier_payments,p=>+p.amount||0)-sum(this.owedSales().filter(s=>s.courier_paid_at),s=>Profit.of(s).courier))*100)/100); let left=amt+credit; const now=new Date().toISOString(); const id=uid('cp');
    for(const s of U){ const c=Profit.of(s).courier; if(c<=left+0.005){ left-=c; s.courier_paid_at=now; s.courier_payment_id=id; ids.push(s.id); await Store.upsert('sales',{id:s.id,courier_paid_at:now,courier_payment_id:id}); } else break; }
    await Store.upsert('courier_payments',{id,date:$('cp-date').value||today(),amount:amt,method:$('cp-method').value,note:$('cp-note').value.trim(),sale_ids:ids,created_at:now});
    Sheet.close('dr-cpay'); toast(`${money(amt)} paid to courier · ${ids.length} order${ids.length!==1?'s':''} settled`); this.render(); Nav.badges();
  },
  async del(id){ const p=Store.cache.courier_payments.find(x=>x.id===id); if(!p||!confirm(`Undo the ${money(p.amount)} payment? Its orders go back to unpaid.`)) return; for(const sid of (p.sale_ids||[])){ const s=Store.cache.sales.find(x=>x.id===sid); if(s){ s.courier_paid_at=null; s.courier_payment_id=null; await Store.upsert('sales',{id:sid,courier_paid_at:null,courier_payment_id:null}); } } await Store.remove('courier_payments',id); toast('Payment removed'); this.render(); Nav.badges(); },
  statementText(){ const U=this.unpaid(); const T=this.totals(); const pc=Profit.cfg(); return `Courier statement — ${fmtDateFull(today())}\n\n${U.map(s=>`#${s.sale_no} ${fmtDate(s.date)} ${(s.customer||{}).name||'Walk-in'} — ${money(Profit.of(s).courier)}`).join('\n')||'No unpaid orders'}\n\nTotal owed: ${money(T.balance)} (${pc.pct}% of gross profit, ${U.length} orders)`; },
  waStatement(){ WA.open(WA.cfg().courier,this.statementText()); },
};

// ============================================================
// SETTINGS
// ============================================================
const Settings = {
  open(){
    const tg=Store.get('telegram')||{}; $('st-tg-token').value=tg.token||''; $('st-tg-chat').value=tg.chat||'';
    $('st-courier-tpl').value=Store.get('courier_template')||''; $('st-dispatch-tpl').value=Store.get('dispatch_template')||''; $('st-quote-tpl').value=Store.get('quote_template')||DEFAULT_SETTINGS.quote_template;
    const sh=Store.get('shipping')||{}; $('st-ship-flat').value=sh.flat??15; $('st-ship-free').value=sh.free_over??200; const pf=Store.get('profit')||{}; $('st-fx').value=pf.fx??1.55; $('st-courier-pct').value=pf.courier_pct??25;
    const wa=Store.get('whatsapp')||{}; this.waMode(wa.mode||'app'); $('st-wa-phone-id').value=wa.phone_id||''; $('st-wa-token').value=wa.token||''; $('st-wa-tpl').value=wa.dispatch_template||''; $('st-wa-lang').value=wa.lang||'en'; $('st-wa-courier').value=wa.courier||''; $('st-wa-test').value=wa.test||'';
    $('tg-status').textContent=(tg.token&&tg.chat)?'connected':'not set'; Sheet.open('sh-settings');
  },
  moreInfo(){ const tg=Store.get('telegram')||{}; $('more-tg').textContent=(tg.token&&tg.chat)?'Telegram connected':'Telegram not set'; const c=JSON.parse(localStorage.getItem('optml_conn')||'{}'); $('more-conn').textContent=Store.mode==='cloud'?('Supabase · '+(c.url||'').replace('https://','')):'This device only — no cloud sync'; },
  async save(){
    await Store.setSetting('telegram',{token:$('st-tg-token').value.trim(),chat:$('st-tg-chat').value.trim()});
    await Store.setSetting('courier_template',$('st-courier-tpl').value); await Store.setSetting('dispatch_template',$('st-dispatch-tpl').value); await Store.setSetting('quote_template',$('st-quote-tpl').value);
    await Store.setSetting('shipping',{flat:+$('st-ship-flat').value||0,free_over:+$('st-ship-free').value||0});
    await Store.setSetting('profit',{fx:+$('st-fx').value||1.55,courier_pct:+$('st-courier-pct').value||0});
    await Store.setSetting('whatsapp',{mode:this._waMode||'app',phone_id:$('st-wa-phone-id').value.trim(),token:$('st-wa-token').value.trim(),dispatch_template:$('st-wa-tpl').value.trim(),lang:$('st-wa-lang').value.trim()||'en',courier:$('st-wa-courier').value.trim(),test:$('st-wa-test').value.trim()});
    Sell.applyShipping(); Sheet.close('sh-settings'); this.moreInfo(); toast('Settings saved');
  },
  waMode(m){ this._waMode=m; $$('#wa-mode button').forEach(b=>b.classList.toggle('on',b.dataset.m===m)); $('wa-api-wrap').style.display=m==='api'?'block':'none'; $('wa-app-help').style.display=m==='api'?'none':'block'; $('wa-status').textContent=m==='api'?'Business API':'opens app'; },
  async testWa(){ const phone=$('st-wa-test').value.trim(); if(!phone){ toast('Enter your number first','err'); return; } const c={phone_id:$('st-wa-phone-id').value.trim(),token:$('st-wa-token').value.trim(),dispatch_template:$('st-wa-tpl').value.trim(),lang:$('st-wa-lang').value.trim()||'en',mode:'api'}; Store.cache.settings.whatsapp={...(Store.get('whatsapp')||{}),...c}; try{ if(c.dispatch_template) await WA.sendTemplate(phone,c.dispatch_template,c.lang,['Test','AP0000000000']); else await WA.sendText(phone,'OPTML CRM connected ✓'); toast('Sent — check WhatsApp'); }catch(e){ toast('WhatsApp API: '+e.message,'err',6000); } },
  async findChat(){
    const token=$('st-tg-token').value.trim(); if(!token){ toast('Enter bot token first','err'); return; }
    try{ const r=await fetch(`https://api.telegram.org/bot${token}/getUpdates`); const j=await r.json(); if(!j.ok) throw new Error(j.description);
      const chats=[...new Map((j.result||[]).map(u=>{ const c=(u.message||u.channel_post||u.my_chat_member||{}).chat; return c?[c.id,c]:null; }).filter(Boolean)).values()];
      if(!chats.length){ toast('No messages yet — send one in the chat first','err',4000); return; }
      const c=chats[chats.length-1]; $('st-tg-chat').value=c.id; toast('Found: '+(c.title||c.first_name||c.id));
    }catch(e){ toast('Telegram: '+e.message,'err',4000); }
  },
  async testTg(){ const ok=await Telegram.send('✅ OPTML connected — courier notifications will arrive here.',{token:$('st-tg-token').value.trim(),chat:$('st-tg-chat').value.trim()}); toast(ok?'Test sent':'Failed — check token & chat ID',ok?'ok':'err'); },
};

// ============================================================
// HOME
// ============================================================
const Home = {
  r:'7',
  filtered(){ const S=Store.cache.sales.filter(s=>s.status!=='Cancelled'); if(this.r==='all') return S; const from=this.r==='today'?today():addDays(-(+this.r)+1); return S.filter(s=>s.date>=from); },
  render(){
    const h=new Date().getHours(); $('greet').textContent=h<12?'morning':h<17?'afternoon':'evening';
    $('home-date').textContent=new Date().toLocaleDateString('en-AU',{weekday:'short',day:'numeric',month:'short'});
    const S=Store.cache.sales.filter(s=>s.status!=='Cancelled'); const t=today(); const dow=(new Date(t).getDay()+6)%7; const w=addDays(-dow); // Monday of this week
    const todayS=S.filter(s=>s.date===t), weekS=S.filter(s=>s.date>=w), prevW=S.filter(s=>s.date>=addDays(-dow-7)&&s.date<=addDays(-7));
    const rev=sum(weekS,s=>s.total), prev=sum(prevW,s=>s.total); const d=prev?Math.round((rev-prev)/prev*100):null;
    const open=S.filter(s=>['New','Paid','Sent to Courier'].includes(s.status)).length;
    $('home-strip').innerHTML=`<div class="s"><div class="k">Today</div><div class="v go">${money(sum(todayS,s=>s.total))}</div><div class="d">${money(Profit.sumOf(todayS).net)} net</div></div><div class="s"><div class="k">This week</div><div class="v">${money(rev)}</div><div class="d ${d===null?'':d>=0?'up':'down'}">${money(Profit.sumOf(weekS).net)} net${d!==null?` · ${d>=0?'▲':'▼'}${Math.abs(d)}%`:''}</div></div><div class="s"><div class="k">To dispatch</div><div class="v ${open?'amber':''}">${open}</div><div class="d">open</div></div>`;
    const lb=$('local-banner'); if(lb) lb.style.display=Store.mode==='local'?'block':'none';
    this.spark(S);
    // attention
    const att=[];
    const sku=s=>((s.items||[])[0]||{}).sku;
    S.filter(s=>s.status==='Paid'&&s.fulfilment==='Shipped'&&!s.courier_sent_at).forEach(s=>att.push({k:`Send to courier · #${s.sale_no}`,sku:sku(s),ic:ICON.send,c:'violet',t:`${(s.customer||{}).name||'Walk-in'}`,u:(s.items||[]).map(i=>i.name+' ×'+i.count).join(', '),a:`<button class="btn xs go" onclick="Sales.resend('${s.id}')">Send to courier</button><button class="btn xs" onclick="Sales.detail('${s.id}')">Open</button>`}));
    S.filter(s=>s.status==='Sent to Courier').forEach(s=>att.push({k:`With courier · #${s.sale_no}`,sku:sku(s),ic:ICON.box,c:'blue',t:`${(s.customer||{}).name||'Walk-in'}`,u:'Waiting on a tracking number',a:`<button class="btn xs ink" onclick="Sales.openDispatch('${s.id}')">Add tracking</button>`}));
    S.filter(s=>s.status==='New').forEach(s=>att.push({k:`Awaiting payment · #${s.sale_no}`,sku:sku(s),ic:ICON.clock,c:'amber',t:`${(s.customer||{}).name||'Walk-in'}`,u:money(s.total)+' by '+s.payment,a:`<button class="btn xs go" onclick="Sales.markPaid('${s.id}')">Mark paid</button><button class="btn xs" onclick="Sales.detail('${s.id}')">Open</button>`}));
    const low=Store.cache.products.filter(p=>!p.soon&&!p.hidden&&p.stock<=p.reorder);
    if(low.length) att.push({k:'Reorder',sku:low[0].sku,ic:ICON.rocket,c:low.some(p=>p.stock<=0)?'red':'amber',t:`${low.length} product${low.length>1?'s':''} below minimum`,u:low.slice(0,4).map(p=>p.name+' ('+p.stock+')').join(', ')+(low.length>4?'…':''),a:`<button class="btn xs" onclick="Reports.launch()">Reorder report</button>`});
    const od=Store.cache.purchase_orders.filter(o=>o.status==='pending'&&o.eta&&o.eta<t);
    const CT=Courier.totals(); if(CT.balance>0&&CT.oldest&&CT.oldest<=addDays(-7)) att.push({k:'Courier owed',ic:ICON.truck,c:'amber',t:`${money(CT.balance)} owed to courier`,u:`${CT.unpaidN} dispatched order${CT.unpaidN!==1?'s':''} unpaid · oldest ${fmtDate(CT.oldest)}`,a:`<button class="btn xs go" onclick="Courier.open()">Open tracker</button>`});
    if(od.length) att.push({k:'Incoming',ic:ICON.truck,c:'amber',t:`${od.length} incoming order${od.length>1?'s':''} overdue`,u:od.map(o=>(Store.cache.products.find(p=>p.id===o.product_id)||{}).name).filter(Boolean).slice(0,3).join(', '),a:`<button class="btn xs" onclick="Nav.go('stock');Inv.view('po')">View</button>`});
    $('att-count').textContent=att.length?att.length+' items':''; 
    $('att-list').innerHTML=att.length?att.map(a=>`<div class="att"><div class="ic ${a.c}">${a.ic}</div><div class="m"><div class="t">${esc(a.k)} — ${esc(a.t)}</div><div class="u">${esc(a.u)}</div><div class="a">${a.a}</div></div></div>`).join(''):'<div class="empty"><div class="big">✓</div>Nothing needs attention</div>';
    $('home-recent').innerHTML=S.slice(0,5).map(s=>Sales.row(s)).join('')||'<div class="empty">No sales yet</div>';
    Nav.badges();
  },
  spark(S){
    const days=Array.from({length:14},(_,i)=>addDays(-13+i)); const by=Object.fromEntries(days.map(d=>[d,0])); S.forEach(s=>{ if(by[s.date]!==undefined) by[s.date]+=+s.total; });
    const vals=days.map(d=>by[d]); const max=Math.max(1,...vals); const W=600,H=110,pad=4,bw=W/14;
    $('spark-total').textContent=money(sum(vals,v=>v));
    $('spark').innerHTML=`<svg class="chart" viewBox="0 0 ${W} ${H+22}" preserveAspectRatio="none">${vals.map((v,i)=>{ const h=Math.max(2,v/max*(H-pad)); return `<rect class="bar ${v?'':'dim'}" x="${i*bw+3}" y="${H-h}" width="${bw-6}" height="${h}" rx="3"/>`; }).join('')}${days.map((d,i)=>i%2?'':`<text x="${i*bw+bw/2}" y="${H+16}" text-anchor="middle">${fmtDate(d).split(' ')[0]}</text>`).join('')}</svg>`;
  },
};

// ============================================================
// SELL (stepped)
// ============================================================
const Sell = {
  s:1, cart:[], bac:{bac3:0,bac10:0}, shipMode:'free', discMode:'none', payment:'Cash', splits:[], fulfilment:'Shipped', paidNow:true, customerId:null, packP:null, packI:null,
  open(){ Sheet.open('sh-sell'); this.applyShipping(); this.render(); setTimeout(()=>$('sell-q').focus(),200); },
  close(){ if(this.cart.length&&!confirm('Discard this sale?')) return; this.reset(); Sheet.close('sh-sell'); },
  applyShipping(){ const sh=Store.get('shipping')||{flat:15,free_over:200}; $('ship-flat').textContent=sh.flat; $('free-over').textContent=sh.free_over; },
  render(){ this.renderCart(); this.search(); this.recent(); this.foot(); },
  step(d){
    if(d>0&&this.s===1&&!this.cart.length&&!(+$('manual-amt').value)){ if(!confirm('No items — continue with an empty sale?')) return; }
    if(d>0&&this.s===3){ this.complete(); return; }
    this.s=Math.min(3,Math.max(1,this.s+d)); 
    $$('#sell-steps .st').forEach((e,i)=>{ e.className='st'+(i+1<this.s?' done':i+1===this.s?' on':''); });
    [1,2,3].forEach(n=>$('sell-'+n).style.display=n===this.s?'block':'none');
    $('sell-back').style.display=this.s>1?'inline-flex':'none';
    $('sell-next').textContent=this.s===3?'Complete sale':'Next'; $('sell-next').className='btn '+(this.s===3?'go':'ink');
    if(this.s===3) this.review(); this.foot(); $('.sheet-b')&&$$('#sh-sell .sheet-b')[0].scrollTo({top:0});
  },
  foot(){ const t=this.totals(); $('sell-foot-v').textContent=money(t.total); $('sell-foot-k').textContent=this.s===3?'Total':this.cart.length?`${sum(this.cart,c=>c.count)} item${sum(this.cart,c=>c.count)!==1?'s':''}`:'Cart total'; },

  // step 1
  search(){
    const q=$('sell-q').value.trim().toLowerCase(); const box=$('sell-results');
    if(!q){ box.innerHTML=''; return; }
    const L=Store.cache.products.filter(p=>!p.soon&&!p.hidden&&p.category!=='Essentials'&&(p.name.toLowerCase().includes(q)||(p.sku||'').toLowerCase().includes(q))).slice(0,9);
    box.innerHTML=L.length?`<div class="tiles">${L.map(p=>{ const st=stockStatus(p); return `<button class="tile ${st==='out'?'out':''}" onclick="Sell.openPack('${p.id}')"><div class="n">${esc(p.name)}</div><div class="s">${esc(p.sku||'')}</div><div class="p">${p.sell1?'$'+p.sell1:'no price'}${p.sell3?' · 3pk $'+p.sell3:''}</div><div class="q ${st}">${p.stock} in stock</div></button>`; }).join('')}</div>`:'<div class="empty">No match</div>';
  },
  openPack(id){
    const p=Store.cache.products.find(x=>x.id===id); this.packP=p; this.packI=null; $('pack-title').innerHTML=`${goalBadge(p.category)}${esc(p.name)}`;
    const o=[['Single',1,p.sell1],['3 pack',3,p.sell3],['5 pack',5,p.sell5],['10 · wholesale',10,p.sell10]];
    $('pack-grid').innerHTML=o.map(([l,q,pr],i)=>{ const off=!pr||p.stock<q; const sv=q>1&&p.sell1?Math.round((1-pr/(p.sell1*q))*100):0; return `<button class="pack ${off?'off':''}" id="pk${i}" onclick="Sell.selPack(${i})"><div class="l">${l}</div><div class="p">${pr?'$'+pr:'—'}</div><div class="s">${off?(p.stock<q?'need '+q:'n/a'):(sv>0?'save '+sv+'%':'')}</div></button>`; }).join('');
    Sheet.open('dr-pack'); const f=o.findIndex(([,q,pr])=>pr&&p.stock>=q); if(f>=0) this.selPack(f);
  },
  selPack(i){ this.packI=i; [0,1,2,3].forEach(j=>$('pk'+j)&&$('pk'+j).classList.toggle('on',j===i)); },
  addPack(){
    if(this.packI===null) return; const p=this.packP, q=[1,3,5,10][this.packI], pr=[p.sell1,p.sell3,p.sell5,p.sell10][this.packI];
    const ex=this.cart.find(c=>c.product_id===p.id&&c.pack_qty===q); if(ex) ex.count++; else this.cart.push({product_id:p.id,name:p.name,sku:p.sku,pack_qty:q,count:1,price:pr,bac_size:p.bac_size||'3ml'});
    this.autoBac(); Sheet.close('dr-pack'); $('sell-q').value=''; this.search(); this.renderCart(); toast(`Added ${p.name}`);
  },
  autoBac(){ let a=0,b=0; this.cart.forEach(c=>{ const n=c.pack_qty*c.count; if(c.bac_size==='10ml') b+=n; else if(c.bac_size==='3ml') a+=n; }); this.bac={bac3:a,bac10:b}; $('bac3').textContent=a; $('bac10').textContent=b; },
  bacAdj(k,d){ this.bac[k]=Math.max(0,this.bac[k]+d); $(k).textContent=this.bac[k]; },
  qty(i,d){ this.cart[i].count=Math.max(1,this.cart[i].count+d); this.autoBac(); this.renderCart(); },
  rm(i){ this.cart.splice(i,1); this.autoBac(); this.renderCart(); },
  renderCart(){
    $('cart-lines').innerHTML=this.cart.length?this.cart.map((c,i)=>`<div class="cl"><div class="n"><b>${esc(c.name)}</b><small>${esc(c.sku||'')} · ${c.pack_qty===1?'single':c.pack_qty+'-pack'} · ${money(c.price)}</small></div><div class="qty"><button onclick="Sell.qty(${i},-1)">−</button><b>${c.count}</b><button onclick="Sell.qty(${i},1)">+</button></div><span class="amt">${money(c.price*c.count)}</span><button class="x" onclick="Sell.rm(${i})">×</button></div>`).join(''):'<div class="empty">Search above to add products</div>';
    const n=sum(this.cart,c=>c.count); $('cart-n').textContent=n?n+' item'+(n!==1?'s':''):'';
    const b3=Store.cache.products.find(p=>p.sku==='BW03'),b10=Store.cache.products.find(p=>p.sku==='BW10'); $('bac-stock').textContent=`${b3?b3.stock:'—'} × 3ml · ${b10?b10.stock:'—'} × 10ml in stock`;
    this.calc();
  },

  // step 2
  fulfil(f){ this.fulfilment=f; $('ful-ship').classList.toggle('on',f==='Shipped'); $('ful-self').classList.toggle('on',f==='Self'); $('ful-walk').classList.toggle('on',f==='Walk-in'); $('ful-hint').textContent=f==='Shipped'?'Courier gets the Telegram order when paid and earns their share of profit.':f==='Self'?'You post it yourself — nothing goes to the courier, no courier share, you still get the tracking & dispatch message.':'Handed over in person — no shipping, no courier.'; $('ps-paid').textContent=f==='Shipped'?'Paid — notify courier':'Paid'; },
  recent(){ const R=[...Store.cache.customers].sort((a,b)=>(b.last_seen||'')>(a.last_seen||'')?1:-1).slice(0,5); $('recent-cust').innerHTML=R.map(c=>`<button class="chip" onclick="Sell.fillCustomer('${c.id}')">${esc(firstName(c.name))} ${esc((c.name||'').split(' ').slice(1).join(' ').slice(0,1))}.</button>`).join(''); },
  suggest(){
    const q=$('c-search').value.trim().toLowerCase(); const el=$('c-sugg'); if(!q){ el.classList.remove('on'); return; }
    const m=Store.cache.customers.filter(c=>(c.name||'').toLowerCase().includes(q)||(c.phone||'').includes(q)||(c.email||'').toLowerCase().includes(q)).slice(0,6);
    el.innerHTML=m.length?m.map(c=>`<div class="row tap" onclick="Sell.fillCustomer('${c.id}')"><div class="av">${esc((c.name||'?')[0].toUpperCase())}</div><div class="m"><div class="t">${esc(c.name)}</div><div class="u">${esc([c.phone,c.city].filter(Boolean).join(' · '))}</div></div><div class="e"><span class="mono" style="font-size:12px;color:var(--go)">${money(c.total_spent||0)}</span><span class="hint" style="margin:0">${c.order_count||0} orders</span></div></div>`).join(''):'<div class="row"><div class="u">No match — new customer will be created</div></div>';
    el.classList.add('on');
  },
  fillCustomer(id){ const c=Store.cache.customers.find(x=>x.id===id); if(!c) return; ['name','phone','email','address','city','state','postcode','tags','source'].forEach(k=>{ const e=$('c-'+k); if(e) e.value=c[k]||''; }); $('c-search').value=''; $('c-sugg').classList.remove('on'); this.customerId=c.id; toast(c.name); },
  clearCustomer(){ ['search','name','phone','email','address','city','state','postcode','notes','tags','source'].forEach(k=>{ const e=$('c-'+k); if(e) e.value=''; }); this.customerId=null; },
  togglePaste(){ const w=$('paste-wrap'); const o=w.style.display==='none'; w.style.display=o?'block':'none'; $('paste-btn').classList.toggle('on',o); if(o){ $('paste-box').value=''; $('paste-box').focus(); } },
parsePaste(text){
    if(!text||text.trim().length<3) return;
    const lines=text.split(/\n/).map(l=>l.trim()).filter(Boolean);
    const full=lines.join(' ');
    const phoneRe=/(?:\+?61\s?|0)4\d{2}[\s-]?\d{3}[\s-]?\d{3}|(?:\+?61\s?|0)[2378][\s-]?\d{4}[\s-]?\d{4}/;
    const emailRe=/[\w.+-]+@[\w-]+\.[\w.]+/;
    const stateRe=/\b(NSW|VIC|QLD|SA|WA|TAS|NT|ACT)\b/i;
    const pcRe=/\b(\d{4})\b/;
    const street=/\b(road|rd|street|st|avenue|ave|drive|dr|close|cl|way|crescent|cres|place|pl|court|ct|lane|ln|boulevard|blvd|terrace|tce|parade|pde|circuit|cct|highway|hwy|esplanade|esp|grove|gr|rise|loop|walk)\b/i;
    let name='',phone='',email='',address='',city='',state='',pc='';
    const pm=full.match(phoneRe); if(pm) phone=pm[0].replace(/[\s-]/g,'');
    const em=full.match(emailRe); if(em) email=em[0];
    for(const l of lines){ if(l.match(phoneRe)||l.match(emailRe)||/^\d/.test(l)||l.match(street)) continue; if(!name){ name=l; break; } }
    for(const l of lines){
      if(l===name||l.match(emailRe)) continue; if(l.match(phoneRe)&&!l.match(street)) continue;
      if(/^\d/.test(l)||l.match(street)){
        let s=l.replace(/\b(australia|au)\b/ig,'').trim();
        const stm=s.match(stateRe); if(stm){ state=stm[1].toUpperCase(); s=s.replace(stateRe,''); }
        const pcm=s.match(pcRe); if(pcm){ pc=pcm[1]; s=s.replace(pcRe,''); }
        s=s.replace(/,/g,' ').replace(/\s{2,}/g,' ').trim();
        const am=s.match(new RegExp('^(.+?\\b(?:'+street.source.slice(3,-3)+')\\b\\.?)\\s+(.+)$','i'));
        if(am){ address=am[1].trim(); city=am[2].trim(); } else address=s;
        break;
      }
    }
    if(!city){ for(const l of lines){ if(l!==name&&l!==address&&!l.match(phoneRe)&&!l.match(emailRe)&&!/^\d/.test(l)&&l.length<30){ const stm=l.match(stateRe); if(stm){state=stm[1].toUpperCase();} const pcm=l.match(pcRe); if(pcm) pc=pcm[1]; const c=l.replace(stateRe,'').replace(pcRe,'').replace(/,/g,'').trim(); if(c&&c!==name) city=c; break; } } }
    const set=(k,v)=>{ if(v) $('c-'+k).value=v; };
    set('name',name); set('phone',phone); set('email',email); set('address',address); set('city',city); set('state',state); set('postcode',pc);
    const n=[name,phone,email,address,city,pc].filter(Boolean).length; $('paste-status').textContent=`✓ ${n} field${n!==1?'s':''} detected — check below`;
    this.customerId=null;
    // check existing by phone
    if(phone){ const ex=Store.cache.customers.find(c=>c.phone===phone); if(ex){ this.customerId=ex.id; $('paste-status').textContent+=' · matched existing customer'; this.customerId=ex.id; } }
  },

  // ---- quote (copy or WhatsApp) ----
  quoteText(){
    const t=this.totals(); const g=k=>($('c-'+k)?.value||'').trim(); const name=g('name');
    const items=this.cart.map(c=>`• ${c.name}${c.pack_qty>1?' '+c.pack_qty+'-pack':''}${c.count>1?' ×'+c.count:''} — ${money(c.price*c.count)}`).join('\n')+(t.manual?`\n• Custom — ${money(t.manual)}`:'');
    const bac=(this.bac.bac3||this.bac.bac10)?`• Bac water ${[this.bac.bac3?this.bac.bac3+'× 3ml':'',this.bac.bac10?this.bac.bac10+'× 10ml':''].filter(Boolean).join(' + ')} — included\n`:'';
    const tpl=Store.get('quote_template')||DEFAULT_SETTINGS.quote_template;
    return tpl.replace(/{first_name}/g,firstName(name)||'there').replace(/{name}/g,name||'there').replace(/{items}/g,items||'(no items yet)').replace(/{bac}/g,bac).replace(/{subtotal}/g,money(t.sub)).replace(/{discount}/g,t.disc?`Discount −${money(t.disc)}\n`:'').replace(/{shipping}/g,t.ship?money(t.ship):'Free').replace(/{total}/g,money(t.total)).replace(/\n{3,}/g,'\n\n');
  },
  openQuote(){ if(!this.cart.length&&!(+$('manual-amt').value)){ toast('Add items to quote first','err'); return; } $('q-phone').value=($('c-phone').value||'').trim(); $('q-text').value=this.quoteText(); Sheet.open('dr-quote'); },
  copyQuote(){ copyText($('q-text').value); toast('Quote copied'); },
  sendQuote(){ const ph=$('q-phone').value.trim(); if(ph&&!$('c-phone').value) $('c-phone').value=ph; if(WA.open(ph,$('q-text').value)){ Sheet.close('dr-quote'); toast('Opened in WhatsApp'); } },

  // step 3
  review(){
    const t=this.totals();
    const lines=this.cart.map(c=>`<div class="tl"><span class="k">${esc(c.name)} <span class="mono" style="font-size:11px;color:var(--ink-3)">×${c.count}${c.pack_qty>1?' · '+c.pack_qty+'pk':''}</span></span><span class="v">${money(c.price*c.count)}</span></div>`).join('');
    const bac=(this.bac.bac3||this.bac.bac10)?`<div class="tl"><span class="k" style="color:var(--ink-3)">Bac water · ${[this.bac.bac3?this.bac.bac3+'× 3ml':'',this.bac.bac10?this.bac.bac10+'× 10ml':''].filter(Boolean).join(', ')} </span><span class="v" style="color:var(--ink-3)">incl.</span></div>`:'';
    const man=t.manual?`<div class="tl"><span class="k">Manual amount</span><span class="v">${money(t.manual)}</span></div>`:'';
    const cu=$('c-name').value.trim(); const addr=[$('c-address').value,$('c-city').value,$('c-state').value,$('c-postcode').value].map(v=>v.trim()).filter(Boolean).join(', ');
    $('review-lines').innerHTML=`<div style="display:flex;gap:10px;align-items:center;margin-bottom:10px;padding-bottom:10px;border-bottom:1px solid var(--rule)"><div class="av">${esc((cu||'?')[0].toUpperCase())}</div><div style="flex:1;min-width:0"><div style="font-weight:500">${esc(cu||'Walk-in')}</div><div class="hint" style="margin:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(addr||$('c-phone').value||'no address')}</div></div><span class="tag ${this.fulfilment==='Shipped'?'blue':this.fulfilment==='Self'?'violet':'gray'}">${this.fulfilment==='Shipped'?'Courier':this.fulfilment==='Self'?'Posting myself':'Walk-in'}</span></div>${lines||''}${man}${bac}${!lines&&!man?'<div class="empty" style="padding:10px">No items</div>':''}`;
    this.calc();
  },
  ship(m){ this.shipMode=m; $('ship-free').classList.toggle('on',m==='free'); $('ship-paid').classList.toggle('on',m==='paid'); this.calc(); },
  disc(m){ this.discMode=m; ['none','pct','flat'].forEach(k=>$('disc-'+k).classList.toggle('on',k===m)); $('disc-val').style.display=m==='none'?'none':'block'; if(m==='none') $('disc-val').value=''; else $('disc-val').focus(); this.calc(); },
  pay(p){ this.payment=p; $$('#pay-chips .chip').forEach(b=>b.classList.toggle('on',b.dataset.p===p)); $('split-wrap').style.display=p==='Split'?'block':'none'; if(p==='Split'&&!this.splits.length){ this.splits=[{method:'Cash',amount:''},{method:'BKP',amount:''}]; } if(p==='Split') this.renderSplits(); this.calc(); },
  paidNow(v){ this.paidNow=v; $('ps-paid').classList.toggle('on',v); $('ps-wait').classList.toggle('on',!v); },
  addSplit(){ this.splits.push({method:'KJ',amount:''}); this.renderSplits(); },
  renderSplits(){ $('split-rows').innerHTML=this.splits.map((r,i)=>`<div style="display:flex;gap:8px;margin-bottom:8px"><select class="in" style="flex:1;min-height:40px" onchange="Sell.splits[${i}].method=this.value">${['Cash','BKP','KJ'].map(m=>`<option ${r.method===m?'selected':''}>${m}</option>`).join('')}</select><input class="in" type="number" inputmode="decimal" placeholder="$" value="${r.amount}" style="width:100px;min-height:40px;text-align:right" oninput="Sell.splits[${i}].amount=this.value;Sell.calc()"><button class="iconb" onclick="Sell.splits.splice(${i},1);Sell.renderSplits()">×</button></div>`).join(''); this.calc(); },
  totals(){
    const sh=Store.get('shipping')||{flat:15,free_over:200}; const manual=+($('manual-amt')?.value||0); const sub=sum(this.cart,c=>c.price*c.count)+manual;
    const freeAuto=sub>=sh.free_over&&sub>0; const ship=(!freeAuto&&this.shipMode==='paid')?sh.flat:0;
    let disc=0; if(this.discMode!=='none'){ const v=+($('disc-val')?.value||0); disc=this.discMode==='pct'?Math.round(sub*Math.min(v,100)/100):Math.min(v,sub); }
    return {sub,ship,disc,total:Math.max(0,sub-disc+ship),manual,freeAuto};
  },
  calc(){
    const t=this.totals(); $('t-sub').textContent=money(t.sub); $('t-ship').textContent=t.ship?money(t.ship):'Free'; $('t-total').textContent=money(t.total);
    $('free-note').style.display=t.freeAuto?'inline':'none'; $('ship-paid').style.opacity=t.freeAuto?.4:1; $('ship-paid').disabled=t.freeAuto;
    $('t-disc-line').style.display=t.disc?'flex':'none'; $('t-disc').textContent='−'+money(t.disc);
    if(this.payment==='Split'){ const rem=Math.round((t.total-sum(this.splits,s=>s.amount))*100)/100; const b=$('split-bal'); b.style.color=rem===0?'var(--go)':rem>0?'var(--amber)':'var(--red)'; b.textContent=rem===0?'✓ allocated':rem>0?money(rem)+' remaining':money(-rem)+' over'; }
    this.foot();
  },
  async complete(){
    const t=this.totals(); const g=k=>($('c-'+k)?.value||'').trim();
    const cust={name:g('name'),phone:g('phone'),email:g('email'),address:g('address'),city:g('city'),state:g('state').toUpperCase(),postcode:g('postcode')}; const notes=g('notes');
    if(this.payment==='Split'&&Math.round((sum(this.splits,s=>s.amount)-t.total)*100)!==0){ toast('Split must equal total','err'); return; }
    $('sell-next').disabled=true;
    try{
      let customerId=this.customerId;
      if(cust.name||cust.phone){
        let c=customerId?Store.cache.customers.find(x=>x.id===customerId):(cust.phone?Store.cache.customers.find(x=>x.phone===cust.phone):null);
        if(!c) c={id:uid('c'),...cust,tags:'',source:'',notes:'',order_count:0,total_spent:0,created_at:new Date().toISOString()};
        Object.keys(cust).forEach(k=>{ if(cust[k]) c[k]=cust[k]; }); if(g('tags')) c.tags=g('tags'); if(g('source')) c.source=g('source');
        c.order_count=(c.order_count||0)+1; c.total_spent=(+c.total_spent||0)+t.total; c.last_seen=today(); await Store.upsert('customers',c); customerId=c.id;
      }
      const status=this.paidNow?'Paid':'New';
      const sale={id:uid('s'),date:today(),customer_id:customerId,customer:cust,items:this.cart.map(c=>{ const p=Store.cache.products.find(x=>x.id===c.product_id); return {product_id:c.product_id,name:c.name,sku:c.sku,pack_qty:c.pack_qty,count:c.count,price:c.price,cost_usd:p?(+p.cost||0):0}; }),bac3:this.bac.bac3,bac10:this.bac.bac10,bac3_cost_usd:(Store.cache.products.find(p=>p.sku==='BW03')||{}).cost||0,bac10_cost_usd:(Store.cache.products.find(p=>p.sku==='BW10')||{}).cost||0,manual_amount:t.manual,subtotal:t.sub,discount:t.disc,shipping:t.ship,total:t.total,payment:this.payment,split_payments:this.payment==='Split'?this.splits.filter(s=>s.amount).map(s=>({method:s.method,amount:+s.amount})):[],fulfilment:this.fulfilment,status,tracking:'',notes,created_at:new Date().toISOString()};
      if(Store.mode==='local') sale.sale_no=Math.max(0,...Store.cache.sales.map(s=>+s.sale_no||0))+1;
      await Store.upsert('sales',sale);
      if(Store.mode==='cloud'){ const {data}=await Store.sb.from('sales').select('sale_no').eq('id',sale.id).single(); if(data){ sale.sale_no=data.sale_no; const i=Store.cache.sales.findIndex(x=>x.id===sale.id); if(i>=0) Store.cache.sales[i].sale_no=data.sale_no; } }
      for(const c of this.cart){ const p=Store.cache.products.find(x=>x.id===c.product_id); if(p) await Store.adjustStock(p,-(c.pack_qty*c.count),'sale',`#${sale.sale_no} ${cust.name||'Walk-in'}`); }
      const b3=Store.cache.products.find(p=>p.sku==='BW03'),b10=Store.cache.products.find(p=>p.sku==='BW10'); if(this.bac.bac3&&b3) await Store.adjustStock(b3,-this.bac.bac3,'sale',`#${sale.sale_no}`); if(this.bac.bac10&&b10) await Store.adjustStock(b10,-this.bac.bac10,'sale',`#${sale.sale_no}`);
      let msg=`Sale #${sale.sale_no} saved`; if(status==='Paid'&&this.fulfilment==='Shipped'){ const ok=await Telegram.sendOrder(sale); msg+=ok?' · courier notified ✓':' · courier NOT sent (set up Telegram)'; }
      this.reset(); Sheet.close('sh-sell'); toast(msg,'ok',4000); Nav.go('sales'); Sales.detail(sale.id);
    }catch(e){ console.error(e); toast('Failed: '+e.message,'err',5000); }
    $('sell-next').disabled=false;
  },
  reset(keepOpen){
    this.cart=[]; this.bac={bac3:0,bac10:0}; this.splits=[]; this.customerId=null; this.s=1;
    ['bac3','bac10'].forEach(k=>$(k).textContent='0'); $('manual-amt').value=''; $('sell-q').value=''; $('sell-results').innerHTML='';
    this.ship('free'); this.disc('none'); this.pay('Cash'); this.fulfil('Shipped'); this.paidNow(true); this.clearCustomer(); if($('paste-wrap').style.display!=='none') this.togglePaste();
    $$('#sell-steps .st').forEach((e,i)=>e.className='st'+(i===0?' on':'')); [1,2,3].forEach(n=>$('sell-'+n).style.display=n===1?'block':'none'); $('sell-back').style.display='none'; $('sell-next').textContent='Next'; $('sell-next').className='btn ink';
    this.renderCart(); this.foot(); if(keepOpen) toast('Cleared');
  },
};

// ============================================================
// SALES
// ============================================================
const STATUSES=['New','Paid','Sent to Courier','Dispatched','Delivered','Cancelled'];
const statusTag=s=>({'New':'amber','Paid':'go','Sent to Courier':'violet','Dispatched':'blue','Delivered':'gray','Cancelled':'red'}[s]||'gray');
const Sales = {
  f:'open', cur:null,
  row(s){
    const c=s.customer||{}; const items=(s.items||[]).map(i=>`${i.name}${i.pack_qty>1?' '+i.pack_qty+'pk':''} ×${i.count}`).join(', ')||(s.manual_amount?'Manual amount':'No items');
    return `<div class="row tap" onclick="Sales.detail('${s.id}')"><div class="m"><div class="t">${esc(c.name||'Walk-in')}<span class="id">#${s.sale_no}</span><span class="tag ${statusTag(s.status)}">${s.status}</span></div><div class="u">${esc(items)}</div><div class="w"><span>${fmtDate(s.date)}</span><span>${esc(s.payment)}</span><span>${s.fulfilment==='Walk-in'?'Walk-in':(s.fulfilment==='Self'?'Self · ':'')+esc(c.city||'Shipped')}</span>${s.tracking?`<span>▣ ${esc(s.tracking)}</span>`:''}</div></div><div class="e"><span class="amt">${money(s.total)}</span><span class="chev">›</span></div></div>`;
  },
  render(){
    const all=Store.cache.sales; const n=k=>all.filter(s=>k==='open'?['New','Paid','Sent to Courier'].includes(s.status):k==='disp'?s.status==='Dispatched':k==='done'?s.status==='Delivered':true).length;
    $('sales-seg').innerHTML=[['open','To dispatch'],['disp','Dispatched'],['done','Delivered'],['all','All']].map(([k,l])=>`<button class="${this.f===k?'on':''}" onclick="Sales.filter('${k}')">${l} <b>${n(k)}</b></button>`).join('');
    const q=$('sales-q').value.trim().toLowerCase();
    let L=all.filter(s=>this.f==='open'?['New','Paid','Sent to Courier'].includes(s.status):this.f==='disp'?s.status==='Dispatched':this.f==='done'?s.status==='Delivered':true);
    if(q) L=L.filter(s=>JSON.stringify([s.sale_no,s.customer,s.items,s.tracking,s.payment,s.notes]).toLowerCase().includes(q));
    // group by date
    const groups={}; L.forEach(s=>{ (groups[s.date]=groups[s.date]||[]).push(s); });
    $('sales-list').innerHTML=Object.keys(groups).sort().reverse().map(d=>`<div class="cat-h">${d===today()?'Today':fmtDateFull(d)} <small>${groups[d].length} · ${money(sum(groups[d].filter(s=>s.status!=='Cancelled'),s=>s.total))}</small></div>${groups[d].map(s=>this.row(s)).join('')}`).join('')||`<div class="empty"><div class="big">${this.f==='open'?'✓':'—'}</div>${this.f==='open'?'Nothing to dispatch':'No sales here'}</div>`;
    Nav.badges();
  },
  filter(k){ this.f=k; this.render(); },
  detail(id){
    const s=Store.cache.sales.find(x=>x.id===id); if(!s) return; this.cur=s; const c=s.customer||{};
    $('sd-title').textContent='Sale #'+s.sale_no;
    const flow=s.fulfilment==='Shipped'?['New','Paid','Sent to Courier','Dispatched','Delivered']:s.fulfilment==='Self'?['New','Paid','Dispatched','Delivered']:['New','Paid','Delivered']; const idx=flow.indexOf(s.status);
    const when={New:s.created_at,Paid:s.paid_at||(idx>=1?s.created_at:null),'Sent to Courier':s.courier_sent_at,Dispatched:s.dispatched_at,Delivered:s.delivered_at};
    const tl=s.status==='Cancelled'?`<div class="note red">Cancelled</div>`:`<div class="tline">${flow.map((st,i)=>`<div class="tl-s ${i<idx?'done':i===idx?'now':''}">${st}${when[st]&&i<=idx?`<small>${new Date(when[st]).toLocaleString('en-AU',{day:'numeric',month:'short',hour:'numeric',minute:'2-digit'})}</small>`:''}</div>`).join('')}</div>`;
    const addr=[c.address,c.city,c.state,c.postcode].filter(Boolean).join(', ');
    const items=(s.items||[]).map(i=>`<div class="tl"><span class="k">${esc(i.name)} <span class="mono" style="font-size:11px;color:var(--ink-3)">×${i.count}${i.pack_qty>1?' · '+i.pack_qty+'pk':''}</span></span><span class="v">${money(i.price*i.count)}</span></div>`).join('');
    const bac=(s.bac3||s.bac10)?`<div class="tl"><span class="k" style="color:var(--ink-3)">Bac water · ${[s.bac3?s.bac3+'× 3ml':'',s.bac10?s.bac10+'× 10ml':''].filter(Boolean).join(', ')}</span><span class="v" style="color:var(--ink-3)">incl.</span></div>`:'';
    const pay=s.payment==='Split'?'Split: '+(s.split_payments||[]).map(p=>p.method+' '+money(p.amount)).join(' + '):s.payment;
    const actions=[];
    if(s.status==='New') actions.push(`<button class="btn go" onclick="Sales.markPaid('${s.id}')">Mark paid${s.fulfilment==='Shipped'?' & send to courier':''}</button>`);
    if(s.fulfilment==='Shipped'&&['Paid','Sent to Courier','Dispatched'].includes(s.status)) actions.push(`<button class="btn ${s.status==='Paid'?'go':''}" onclick="Sales.resend('${s.id}')">${s.courier_sent_at?'Resend to courier':'Send to courier'}</button>`);
    if(['Paid','Sent to Courier','Dispatched'].includes(s.status)&&['Shipped','Self'].includes(s.fulfilment)) actions.push(`<button class="btn ink" onclick="Sales.openDispatch('${s.id}')">${s.status==='Dispatched'?'Dispatch message':'Add tracking & dispatch'}</button>`);
    if(['Dispatched','Paid','Sent to Courier'].includes(s.status)) actions.push(`<button class="btn" onclick="Sales.setStatus('${s.id}','Delivered')">Mark delivered</button>`);
    actions.push(`<button class="btn" onclick="Sales.copyCourier('${s.id}')">Copy courier text</button>`);
    if(c.phone) actions.push(`<button class="btn" onclick="WA.open('${esc(c.phone)}','')">WhatsApp</button><a class="btn" href="sms:${esc(c.phone)}">SMS</a><a class="btn" href="tel:${esc(c.phone)}">Call</a>`);
    if((WA.cfg().courier||'')&&s.fulfilment==='Shipped') actions.push(`<button class="btn" onclick="WA.open('${esc(WA.cfg().courier)}',Telegram.courierMessage(Store.cache.sales.find(x=>x.id==='${s.id}')))">Courier on WhatsApp</button>`);
    $('sd-body').innerHTML=`
      <div class="card" style="margin-bottom:12px"><div class="pad" style="display:flex;gap:12px;align-items:center"><div class="av" style="width:44px;height:44px;font-size:18px">${esc((c.name||'W')[0].toUpperCase())}</div><div style="flex:1;min-width:0"><div style="font-size:17px;font-weight:500">${esc(c.name||'Walk-in')}</div><div class="hint" style="margin:2px 0 0">${esc(addr||'No address')}</div>${c.phone?`<div class="hint mono" style="margin:0">${esc(c.phone)}</div>`:''}</div>${s.customer_id?`<button class="iconb" onclick="Cust.detail('${s.customer_id}')">›</button>`:''}</div></div>
      <div class="card" style="margin-bottom:12px"><div class="pad">${tl}
        <div class="g2"><div class="f"><label>Status</label><select class="in" onchange="Sales.setStatus('${s.id}',this.value)">${STATUSES.map(st=>`<option ${st===s.status?'selected':''}>${st}</option>`).join('')}</select></div><div class="f"><label>Fulfilment</label><select class="in" onchange="Sales.setFulfilment('${s.id}',this.value)">${[['Shipped','Courier'],['Self','Posting myself'],['Walk-in','Walk-in']].map(([v,l])=>`<option value="${v}" ${v===s.fulfilment?'selected':''}>${l}</option>`).join('')}</select></div></div>
        <div class="actions" style="margin-top:4px">${actions.join('')}</div></div></div>
      <div class="card" style="margin-bottom:12px"><div class="pad">${items}${s.manual_amount?`<div class="tl"><span class="k">Manual amount</span><span class="v">${money(s.manual_amount)}</span></div>`:''}${bac}
        <div class="tl" style="border-top:1px solid var(--rule);margin-top:6px"><span class="k">Subtotal</span><span class="v">${money(s.subtotal)}</span></div>${s.discount?`<div class="tl"><span class="k">Discount</span><span class="v">−${money(s.discount)}</span></div>`:''}<div class="tl"><span class="k">Shipping</span><span class="v">${s.shipping?money(s.shipping):'Free'}</span></div><div class="tl big"><span class="k">Total</span><span class="v">${money(s.total)}</span></div></div></div>
      ${(()=>{ const p=Profit.of(s); return `<div class="card" style="margin-bottom:12px"><div class="pad"><div class="lab">Profit</div><div class="tl"><span class="k">Product cost <span class="mono" style="font-size:11px;color:var(--ink-3)">@ ${p.fx} AUD/USD</span></span><span class="v">−${money(p.cogs)}</span></div><div class="tl"><span class="k">Gross profit</span><span class="v">${money(p.gross)}</span></div>${p.courier?`<div class="tl"><span class="k">Courier ${p.pct}%${s.courier_paid_at?' <span class="tag go">paid</span>':['Dispatched','Delivered'].includes(s.status)?' <span class="tag amber">owed</span>':''}</span><span class="v">−${money(p.courier)}</span></div>`:s.fulfilment!=='Shipped'?`<div class="tl"><span class="k" style="color:var(--ink-3)">No courier share (${s.fulfilment==='Self'?'posted yourself':'walk-in'})</span><span class="v"></span></div>`:''}<div class="tl big"><span class="k">Net profit</span><span class="v" style="color:${p.net>=0?'var(--go)':'var(--red)'}">${money(p.net)}</span></div>${p.known?'':'<div class="hint">Some items have no supplier cost — set it on the product to make this accurate.</div>'}</div></div>`; })()}
      <div class="card"><div class="pad"><div class="tl"><span class="k">Date</span><span class="v">${fmtDateFull(s.date)}</span></div><div class="tl"><span class="k">Payment</span><span class="v" style="font-family:var(--sans);font-weight:400">${esc(pay)}</span></div><div class="tl"><span class="k">Fulfilment</span><span class="v" style="font-family:var(--sans);font-weight:400">${s.fulfilment==='Shipped'?'Courier':s.fulfilment==='Self'?'Posting myself':'Walk-in'}</span></div><div class="tl"><span class="k">Tracking</span><span class="v">${esc(s.tracking||'—')}</span></div>${s.customer_notified_at?`<div class="tl"><span class="k">Customer messaged</span><span class="v" style="font-size:12px">${new Date(s.customer_notified_at).toLocaleString('en-AU',{day:'numeric',month:'short',hour:'numeric',minute:'2-digit'})} · WhatsApp</span></div>`:''}${s.courier_sent_at?`<div class="tl"><span class="k">Courier notified</span><span class="v" style="font-size:12px">${new Date(s.courier_sent_at).toLocaleString('en-AU',{day:'numeric',month:'short',hour:'numeric',minute:'2-digit'})}</span></div>`:''}
        <div class="f" style="margin-top:8px"><label>Notes</label><textarea class="in" rows="2" onblur="Sales.saveNotes('${s.id}',this.value)">${esc(s.notes||'')}</textarea></div></div></div>`;
    Sheet.open('sh-sale');
  },
  async setFulfilment(id,f){ const s=Store.cache.sales.find(x=>x.id===id); if(!s||s.fulfilment===f) return; if(s.courier_paid_at&&f!=='Shipped'&&!confirm('This order is already in a courier payment. Change anyway?')) return; s.fulfilment=f; if(f!=='Shipped'&&s.status==='Sent to Courier') s.status='Paid'; await Store.upsert('sales',s); toast('#'+s.sale_no+' → '+(f==='Shipped'?'courier':f==='Self'?'posting myself':'walk-in')); this.refresh(id); },
  async saveNotes(id,v){ const s=Store.cache.sales.find(x=>x.id===id); if(s&&s.notes!==v){ s.notes=v; await Store.upsert('sales',s); } },
  async setStatus(id,st){ const s=Store.cache.sales.find(x=>x.id===id); if(!s) return; s.status=st; const k={Paid:'paid_at',Dispatched:'dispatched_at',Delivered:'delivered_at'}[st]; if(k&&!s[k]) s[k]=new Date().toISOString(); await Store.upsert('sales',s); toast('#'+s.sale_no+' → '+st); this.refresh(id); },
  async markPaid(id){ const s=Store.cache.sales.find(x=>x.id===id); if(!s) return; s.status='Paid'; s.paid_at=new Date().toISOString(); await Store.upsert('sales',s); let m='Marked paid'; if(s.fulfilment==='Shipped'){ const ok=await Telegram.sendOrder(s); m+=ok?' · courier notified ✓':' · courier not sent'; } toast(m,'ok',3500); this.refresh(id); },
  async resend(id){ const s=Store.cache.sales.find(x=>x.id===id); if(!s) return; const ok=await Telegram.sendOrder(s); toast(ok?'Sent to courier ✓':'Telegram failed — check Settings',ok?'ok':'err',3500); this.refresh(id); },
  copyCourier(id){ const s=Store.cache.sales.find(x=>x.id===id); copyText(Telegram.courierMessage(s)); toast('Courier text copied'); },
  refresh(id){ if($('sh-sale').classList.contains('on')&&this.cur&&this.cur.id===id) this.detail(id); if(Nav.cur==='sales') this.render(); if(Nav.cur==='home') Home.render(); Nav.badges(); },
  async delCurrent(){ const s=this.cur; if(!s||!confirm(`Delete sale #${s.sale_no}? Stock is NOT restored automatically.`)) return; await Store.remove('sales',s.id); Sheet.close('sh-sale'); toast('Sale deleted'); this.render(); Home.render(); },
  // dispatch
  openDispatch(id){ const s=Store.cache.sales.find(x=>x.id===id); if(!s) return; this.cur=s; $('dp-tracking').value=s.tracking||''; $('dp-scan-status').style.display='none'; this.dispatchPreview(); const ph=(s.customer||{}).phone; $('dp-wa').disabled=!WA.num(ph); $('dp-wa-hint').textContent=!WA.num(ph)?'No phone number on this sale — copy the message instead.':(WA.apiReady()?'Sends automatically via the WhatsApp Business API to '+ph:'Opens WhatsApp to '+ph+' with the message ready — press send there.'); Sheet.open('dr-dispatch'); },
  async waDispatch(){ const s=this.cur; const tr=$('dp-tracking').value.trim(); if(!tr){ toast('Enter the tracking number','err'); return; } s.tracking=tr; if(['Paid','Sent to Courier','New'].includes(s.status)){ s.status='Dispatched'; s.dispatched_at=new Date().toISOString(); } await Store.upsert('sales',s); const how=await WA.dispatch(s,tr); if(how){ s.customer_notified_at=new Date().toISOString(); s.customer_notified_via='whatsapp'; await Store.upsert('sales',s); } Sheet.close('dr-dispatch'); toast(how==='api'?'Sent on WhatsApp · #'+s.sale_no+' dispatched':'#'+s.sale_no+' dispatched — send it in WhatsApp'); this.refresh(s.id); },
  dispatchMessage(s,tr){ const c=s.customer||{}; const t=Store.get('dispatch_template')||DEFAULT_SETTINGS.dispatch_template; return t.replace(/{first_name}/g,firstName(c.name)||'there').replace(/{name}/g,c.name||'').replace(/{tracking}/g,tr||'').replace(/{sale_no}/g,s.sale_no); },
  dispatchPreview(){ if(!this.cur) return; $('dp-preview').textContent=this.dispatchMessage(this.cur,$('dp-tracking').value.trim()||'[tracking]'); },
  async copyDispatch(){ const s=this.cur; const tr=$('dp-tracking').value.trim(); if(!tr){ toast('Enter the tracking number','err'); return; } s.tracking=tr; if(['Paid','Sent to Courier','New'].includes(s.status)){ s.status='Dispatched'; s.dispatched_at=new Date().toISOString(); } await Store.upsert('sales',s); copyText(this.dispatchMessage(s,tr)); Sheet.close('dr-dispatch'); toast('Copied · #'+s.sale_no+' dispatched'); this.refresh(s.id); },
  scanTracking(){
    const inp=document.createElement('input'); inp.type='file'; inp.accept='image/*';
    inp.onchange=async()=>{ const f=inp.files[0]; if(!f) return; const st=$('dp-scan-status'); st.style.display='block'; st.textContent='Reading barcode…';
      try{ if(!('BarcodeDetector' in window)) throw new Error('This browser cannot read barcodes — type it instead'); const bmp=await createImageBitmap(f); const det=new BarcodeDetector({formats:['code_128','code_39','ean_13','qr_code','itf','codabar']}); const codes=await det.detect(bmp); if(!codes.length) throw new Error('No barcode found — try a closer, sharper photo'); const best=codes.map(c=>c.rawValue).sort((a,b)=>b.length-a.length)[0]; $('dp-tracking').value=best; this.dispatchPreview(); st.textContent='✓ Read: '+best; }
      catch(e){ st.textContent=e.message; } };
    inp.click();
  },
};

// ============================================================
// INVENTORY / PO / MOVEMENTS
// ============================================================
const Inv = {
  v:'inv', cur:null, showHidden:false,
  view(v){ this.v=v; $$('#stock-seg button').forEach(b=>b.classList.toggle('on',b.dataset.v===v)); ['inv','po','mov'].forEach(k=>$('stock-'+k).style.display=k===v?'block':'none'); this.renderAll(); },
  renderAll(){ if(this.v==='inv') this.render(); else if(this.v==='po') PO.render(); else Mov.render(); Nav.badges(); },
  incoming(pid){ return sum(Store.cache.purchase_orders.filter(o=>o.product_id===pid&&o.status==='pending'),o=>o.qty); },
  render(){
    const P=Store.cache.products; const cats=[...new Set(P.map(p=>p.category))].sort();
    const sel=$('inv-cat'); const cur=sel.value; cats.sort((x,y)=>(GOAL_ORDER.indexOf(x)+1||99)-(GOAL_ORDER.indexOf(y)+1||99)); sel.innerHTML=`<option value="">All</option>`+cats.map(c=>`<option ${c===cur?'selected':''}>${esc(c)}</option>`).join(''); $('cat-list').innerHTML=cats.map(c=>`<option value="${esc(c)}">`).join('');
    const V=P.filter(p=>!p.hidden); const units=sum(V,p=>p.stock), val=sum(V,p=>p.stock*(+p.cost||0)), low=V.filter(p=>!p.soon&&p.stock<=p.reorder), launchLow=low, out=V.filter(p=>!p.soon&&p.stock<=0).length;
    $('inv-strip').innerHTML=`<div class="s"><div class="k">Units</div><div class="v">${units}</div><div class="d">${V.length} products</div></div><div class="s"><div class="k">Stock cost</div><div class="v">US$${Math.round(val).toLocaleString()}</div><div class="d">at supplier cost</div></div><div class="s"><div class="k">Low / out</div><div class="v ${out?'red':low.length?'amber':''}">${low.length}</div><div class="d">${out} out</div></div>`;
    $('inv-alert').innerHTML=launchLow.length?`<div class="note ${launchLow.some(p=>p.stock<=0)?'red':'amber'}" style="margin-bottom:12px"><b>${launchLow.length} product${launchLow.length>1?'s need':' needs'} reordering</b> — ${launchLow.slice(0,3).map(p=>p.name).join(', ')}${launchLow.length>3?'…':''}. <a href="#" onclick="Reports.launch();return false" style="color:inherit;font-weight:500">Reorder report →</a></div>`:'';
    const q=$('inv-q').value.trim().toLowerCase(); const cat=sel.value;
    const hiddenN=P.filter(p=>p.hidden).length;
    let L=P.filter(p=>(this.showHidden||!p.hidden||(q&&(p.name.toLowerCase().includes(q)||(p.sku||'').toLowerCase().includes(q))))&&(!cat||p.category===cat)&&(!q||p.name.toLowerCase().includes(q)||(p.sku||'').toLowerCase().includes(q)));
    const groups={}; L.forEach(p=>(groups[p.category]=groups[p.category]||[]).push(p));
    $('inv-list').innerHTML=Object.keys(groups).sort((x,y)=>(GOAL_ORDER.indexOf(x)+1||99)-(GOAL_ORDER.indexOf(y)+1||99)||x.localeCompare(y)).map(c=>`<div class="cat-h"><span class="cn">${goalBadge(c)}${esc(c)}</span><small>${groups[c].length}</small></div>${groups[c].sort((a,b)=>a.name.localeCompare(b.name)).map(p=>this.row(p)).join('')}`).join('')||'<div class="empty">No products</div>';
  },
  row(p){ const st=p.soon?'':stockStatus(p); const inc=this.incoming(p.id); const pct=p.reorder?Math.min(100,Math.round(p.stock/(p.reorder*2)*100)):(p.stock>0?100:0);
    return `<div class="inv"><div class="rk" onclick="Inv.openEdit('${p.id}')">${goalBadge(p.category)||'<span class="goal-badge" style="background:var(--paper-3)"></span>'}</div><div class="m" onclick="Inv.openEdit('${p.id}')"><div class="n">${esc(p.name)}${p.soon?' <span class="tag gray">soon</span>':''}${p.hidden?' <span class="tag gray">hidden</span>':''}</div><div class="s"><span class="sku">${esc(p.sku||'')}</span>${p.supplier_sku?`<span>${esc(p.supplier_sku)}</span>`:''}<span>min ${p.reorder}</span>${inc?`<span style="color:var(--blue)">+${inc} incoming</span>`:''}${p.sell1?`<span>$${p.sell1}</span>`:''}</div></div><div class="stk" onclick="Inv.openEdit('${p.id}')"><div class="st ${st}">${p.stock}</div><div class="bar"><i class="${st}" style="width:${pct}%"></i></div></div><div class="ctr"><button onclick="Inv.quick('${p.id}',-1)">−</button><button onclick="Inv.quick('${p.id}',1)">+</button></div></div>`; },
  goal(c){ $('inv-cat').value=c; this.render(); },
  async quick(id,d){ const p=Store.cache.products.find(x=>x.id===id); if(p.stock+d<0) return; await Store.adjustStock(p,d,d>0?'in':'out','quick count'); this.render(); },
  openEdit(id){
    const p=id?Store.cache.products.find(x=>x.id===id):null; this.cur=p;
    $('prod-title').textContent=p?'Edit product':'New product'; $('p-del').style.display=p?'inline-flex':'none';
    $('p-name').value=p?.name||''; $('p-sku').value=p?.sku||''; $('p-cat').value=p?.category||''; $('p-stock').value=p?p.stock:0; $('p-reorder').value=p?p.reorder:5; $('p-sell1').value=p?.sell1||''; $('p-sell3').value=p?.sell3||''; $('p-sell5').value=p?.sell5||''; $('p-sell10').value=p?.sell10||''; $('p-cost').value=p?.cost||''; $('p-supsku').value=p?.supplier_sku||''; $('p-bac').value=p?.bac_size||'3ml';
    $('p-soon').classList.toggle('on',!!p?.soon); $('p-hidden').classList.toggle('on',!!p?.hidden);
    const cats=[...new Set(Store.cache.products.map(x=>x.category))].sort(); $('cat-list').innerHTML=cats.map(c=>`<option value="${esc(c)}">`).join('');
    Sheet.open('dr-prod');
  },
  async save(){
    const name=$('p-name').value.trim(); if(!name){ toast('Name required','err'); return; }
    const p=this.cur||{id:uid('p'),stock:0,created_at:new Date().toISOString()}; const oldStock=this.cur?+this.cur.stock:null;
    Object.assign(p,{name,sku:$('p-sku').value.trim().toUpperCase(),category:$('p-cat').value.trim()||'Other',stock:+$('p-stock').value||0,reorder:+$('p-reorder').value||0,sell1:+$('p-sell1').value||null,sell3:+$('p-sell3').value||null,sell5:+$('p-sell5').value||null,sell10:+$('p-sell10').value||null,cost:+$('p-cost').value||null,supplier_sku:$('p-supsku').value.trim(),bac_size:$('p-bac').value,launch:true,soon:$('p-soon').classList.contains('on'),hidden:$('p-hidden').classList.contains('on')});
    await Store.upsert('products',p); if(oldStock!==null&&oldStock!==p.stock) await Store.logMove(p,'adj',p.stock-oldStock,'manual edit');
    Sheet.close('dr-prod'); toast('Saved'); this.render(); Nav.badges();
  },
  async del(){ if(!this.cur||!confirm('Delete '+this.cur.name+'?')) return; await Store.remove('products',this.cur.id); Sheet.close('dr-prod'); toast('Deleted'); this.render(); },
};

const PO = {
  lines:[], cur:null,
  render(){
    const O=Store.cache.purchase_orders; const pend=O.filter(o=>o.status==='pending'), arr=O.filter(o=>o.status==='arrived'); const t=today(); const od=pend.filter(o=>o.eta&&o.eta<t);
    $('po-strip').innerHTML=`<div class="s"><div class="k">Pending</div><div class="v ${od.length?'amber':''}">${pend.length}</div><div class="d">${od.length} overdue</div></div><div class="s"><div class="k">Units coming</div><div class="v">${sum(pend,o=>o.qty)}</div><div class="d">across ${new Set(pend.map(o=>o.ref||o.id)).size} orders</div></div><div class="s"><div class="k">Arrived</div><div class="v">${arr.length}</div><div class="d">all time</div></div>`;
    const name=o=>(Store.cache.products.find(p=>p.id===o.product_id)||{}).name||'?';
    const row=o=>`<div class="row"><div class="m"><div class="t">${esc(name(o))}${o.status==='pending'&&o.eta&&o.eta<t?'<span class="tag amber">overdue</span>':''}</div><div class="u">${esc([o.supplier,o.ref].filter(Boolean).join(' · ')||'—')}</div><div class="w"><span>ordered ${fmtDate(o.order_date)}</span><span>${o.status==='arrived'?'arrived '+fmtDate(o.arrived_date):'ETA '+fmtDate(o.eta)}</span></div></div><div class="e"><span class="amt">+${o.qty}</span>${o.status==='pending'?`<button class="btn xs go" onclick="PO.arrive('${o.id}')">Arrived</button>`:`<button class="btn xs ghost" onclick="PO.del('${o.id}')">remove</button>`}</div></div>`;
    $('po-pending').innerHTML=pend.sort((a,b)=>(a.eta||'')<(b.eta||'')?-1:1).map(row).join('')||'<div class="empty">Nothing incoming</div>';
    $('po-arrived').innerHTML=arr.sort((a,b)=>(b.arrived_date||'')>(a.arrived_date||'')?1:-1).slice(0,30).map(row).join('')||'<div class="empty">—</div>';
  },
  open(){ this.lines=[]; $('po-supplier').value=''; $('po-ref').value=''; $('po-date').value=today(); $('po-eta').value=addDays(14); ['po-dname','po-dphone','po-demail','po-daddr'].forEach(k=>$(k).value=''); this.addLine(); Sheet.open('dr-po'); },
  addLine(){ this.lines.push({product_id:'',qty:10}); this.renderLines(); },
  renderLines(){ const opts=Store.cache.products.filter(p=>!p.hidden).map(p=>`<option value="${p.id}">${esc(p.name)} (${p.stock})</option>`).join(''); $('po-lines').innerHTML=this.lines.map((l,i)=>`<div style="display:flex;gap:6px"><select class="in" style="flex:1;min-height:40px" onchange="PO.lines[${i}].product_id=this.value"><option value="">Product…</option>${opts}</select><input class="in" type="number" inputmode="numeric" value="${l.qty}" style="width:70px;min-height:40px;text-align:right" oninput="PO.lines[${i}].qty=+this.value"><button class="iconb" onclick="PO.lines.splice(${i},1);PO.renderLines()">×</button></div>`).join(''); this.lines.forEach((l,i)=>{ if(l.product_id) $$('#po-lines select')[i].value=l.product_id; }); },
  async save(){
    const L=this.lines.filter(l=>l.product_id&&l.qty>0); if(!L.length){ toast('Add at least one product','err'); return; }
    const base={supplier:$('po-supplier').value.trim(),ref:$('po-ref').value.trim(),order_date:$('po-date').value||today(),eta:$('po-eta').value||addDays(14),delivery:{name:$('po-dname').value.trim(),phone:$('po-dphone').value.trim(),email:$('po-demail').value.trim(),address:$('po-daddr').value.trim()},status:'pending'};
    for(const l of L) await Store.upsert('purchase_orders',{id:uid('po'),product_id:l.product_id,qty:+l.qty,...base,created_at:new Date().toISOString()});
    Sheet.close('dr-po'); toast(L.length+' line'+(L.length>1?'s':'')+' added to incoming'); this.render(); Nav.badges();
  },
  async arrive(id){ const o=Store.cache.purchase_orders.find(x=>x.id===id); const p=Store.cache.products.find(x=>x.id===o.product_id); if(!confirm(`Mark ${o.qty} × ${p?p.name:'?'} as arrived? Stock will be added.`)) return; o.status='arrived'; o.arrived_date=today(); await Store.upsert('purchase_orders',o); if(p) await Store.adjustStock(p,o.qty,'in','PO '+(o.ref||'')+' arrived'); toast('Stock added ✓'); this.render(); Nav.badges(); },
  async del(id){ if(!confirm('Remove this record?')) return; await Store.remove('purchase_orders',id); this.render(); },
};

const Mov = {
  t:'in',
  render(){ const M=[...Store.cache.movements].sort((a,b)=>(b.date||'')>(a.date||'')?1:-1).slice(0,150); const ic={in:['↑','go'],out:['↓','red'],sale:['$','blue'],adj:['±','amber']};
    $('mov-list').innerHTML=M.map(m=>{ const [i,c]=ic[m.type]||['·','gray']; return `<div class="row"><div class="av" style="background:var(--paper-3);color:var(--${c});font-family:var(--mono)">${i}</div><div class="m"><div class="t">${esc(m.product_name||'')}</div><div class="u">${esc(m.note||m.type)}</div></div><div class="e"><span class="amt" style="color:var(--${c})">${m.qty>0?'+':''}${m.qty}</span><span class="hint mono" style="margin:0;font-size:11px">${new Date(m.date).toLocaleString('en-AU',{day:'numeric',month:'short',hour:'numeric',minute:'2-digit'})}</span></div></div>`; }).join('')||'<div class="empty">No movements yet</div>'; },
  open(){ $('mov-prod').innerHTML=Store.cache.products.filter(p=>!p.hidden).map(p=>`<option value="${p.id}">${esc(p.name)} (${p.stock})</option>`).join(''); $('mov-qty').value=''; $('mov-note').value=''; this.type('in'); Sheet.open('dr-mov'); },
  type(t){ this.t=t; $$('#mov-type button').forEach(b=>b.classList.toggle('on',b.dataset.t===t)); $('mov-qty').placeholder=t==='adj'?'New stock count':'Quantity'; },
  async save(){ const p=Store.cache.products.find(x=>x.id===$('mov-prod').value); const q=+$('mov-qty').value; if(!p||isNaN(q)||$('mov-qty').value===''){ toast('Enter a quantity','err'); return; } const d=this.t==='in'?q:this.t==='out'?-q:q-p.stock; if(p.stock+d<0){ toast('Not enough stock','err'); return; } await Store.adjustStock(p,d,this.t,$('mov-note').value.trim()||(this.t==='adj'?'stock count':'manual')); Sheet.close('dr-mov'); toast(`${p.name}: ${p.stock}`); this.render(); if(Nav.cur==='stock') Nav.badges(); },
};

// ============================================================
// CUSTOMERS
// ============================================================
const Cust = {
  cur:null,
  render(){
    const C=Store.cache.customers; const t30=addDays(-30), t7=addDays(-7);
    const due=C.filter(c=>c.last_seen&&c.last_seen<t30&&(c.order_count||0)>0).length, newC=C.filter(c=>(c.created_at||'')>=t7).length;
    $('cust-strip').innerHTML=`<div class="s"><div class="k">Customers</div><div class="v">${C.length}</div><div class="d">+${newC} this week</div></div><div class="s"><div class="k">Lifetime</div><div class="v go">${money(sum(C,c=>c.total_spent||0))}</div><div class="d">avg ${money(C.length?sum(C,c=>c.total_spent||0)/C.length:0)}</div></div><div class="s"><div class="k">Reorder due</div><div class="v ${due?'amber':''}">${due}</div><div class="d">30+ days</div></div>`;
    const q=$('cust-q').value.trim().toLowerCase();
    const L=C.filter(c=>!q||(c.name||'').toLowerCase().includes(q)||(c.phone||'').includes(q)||(c.email||'').toLowerCase().includes(q)||(c.city||'').toLowerCase().includes(q)).sort((a,b)=>(b.last_seen||'')>(a.last_seen||'')?1:-1);
    $('cust-list').innerHTML=L.map(c=>`<div class="row tap" onclick="Cust.detail('${c.id}')"><div class="av">${esc((c.name||'?')[0].toUpperCase())}</div><div class="m"><div class="t">${esc(c.name)}${c.last_seen&&c.last_seen<t30&&c.order_count?'<span class="tag amber">due</span>':''}${(c.order_count||0)>=5?'<span class="tag violet">VIP</span>':''}</div><div class="u">${esc([c.phone,c.city].filter(Boolean).join(' · ')||c.email||'')}</div><div class="w"><span>${c.order_count||0} order${(c.order_count||0)!==1?'s':''}</span><span>${c.last_seen?'last '+fmtDate(c.last_seen):'no orders'}</span></div></div><div class="e"><span class="amt">${money(c.total_spent||0)}</span><span class="chev">›</span></div></div>`).join('')||'<div class="empty">No customers yet — they appear automatically from sales</div>';
  },
  detail(id){
    const c=Store.cache.customers.find(x=>x.id===id); if(!c) return; this.cur=c; $('cd-title').textContent=c.name; $('cd-edit').onclick=()=>this.openEdit(c.id);
    const S=Store.cache.sales.filter(s=>s.customer_id===c.id).sort((a,b)=>(b.date>a.date?1:-1)); const addr=[c.address,c.city,c.state,c.postcode].filter(Boolean).join(', ');
    const prodCount={}; S.forEach(s=>(s.items||[]).forEach(i=>prodCount[i.name]=(prodCount[i.name]||0)+i.count)); const fav=Object.entries(prodCount).sort((a,b)=>b[1]-a[1]).slice(0,3);
    const tpl=[['Reorder nudge',`Hey ${firstName(c.name)}, just checking in — ready to reorder${fav[0]?' your '+fav[0][0]:''}? Let me know and I'll get it sorted 🙌`],['Thanks',`Hey ${firstName(c.name)}, thanks again for your order! Any questions at all just message me.`],['New stock',`Hey ${firstName(c.name)}, we've just restocked — let me know if you want anything put aside.`]];
    $('cd-body').innerHTML=`
      <div class="strip" style="margin-bottom:12px"><div class="s"><div class="k">Spent</div><div class="v go">${money(c.total_spent||0)}</div></div><div class="s"><div class="k">Orders</div><div class="v">${c.order_count||0}</div></div><div class="s"><div class="k">Last</div><div class="v" style="font-size:16px">${c.last_seen?fmtDate(c.last_seen):'—'}</div></div></div>
      <div class="card" style="margin-bottom:12px"><div class="pad">
        ${c.phone?`<div class="tl"><span class="k">Phone</span><span class="v">${esc(c.phone)}</span></div>`:''}${c.email?`<div class="tl"><span class="k">Email</span><span class="v" style="font-family:var(--sans);font-size:13px">${esc(c.email)}</span></div>`:''}<div class="tl"><span class="k">Address</span><span class="v" style="font-family:var(--sans);font-weight:400;text-align:right;max-width:60%">${esc(addr||'—')}</span></div>${c.tags?`<div class="tl"><span class="k">Tags</span><span class="v" style="font-family:var(--sans)">${esc(c.tags)}</span></div>`:''}${c.source?`<div class="tl"><span class="k">Source</span><span class="v" style="font-family:var(--sans)">${esc(c.source)}</span></div>`:''}${c.notes?`<div class="note" style="margin-top:8px">${esc(c.notes)}</div>`:''}
        <div class="actions" style="margin-top:10px">${c.phone?`<button class="btn go" onclick="WA.open('${esc(c.phone)}','')">WhatsApp</button><a class="btn" href="tel:${esc(c.phone)}">Call</a><a class="btn" href="sms:${esc(c.phone)}">SMS</a>`:''}${c.email?`<a class="btn" href="mailto:${esc(c.email)}">Email</a>`:''}<button class="btn go" onclick="Cust.newSale('${c.id}')">New sale</button></div></div></div>
      ${fav.length?`<div class="sec">Buys most</div><div class="card" style="margin-bottom:12px"><div class="pad" style="padding-top:6px;padding-bottom:6px">${fav.map(([n,q])=>`<div class="hbar"><span class="l">${esc(n)}</span><div class="b"><i style="width:${Math.round(q/fav[0][1]*100)}%"></i></div><span class="v">${q} vials</span></div>`).join('')}</div></div>`:''}
      <div class="sec">Quick messages</div><div class="card" style="margin-bottom:12px">${tpl.map(([l,m])=>`<div class="row"><div class="m"><div class="t">${l}</div><div class="u wrap" style="font-size:12.5px">${esc(m)}</div><div class="actions" style="margin-top:8px"><button class="btn xs go" onclick="WA.open('${esc(c.phone||'')}',${JSON.stringify(m).replace(/"/g,'&quot;')})">Send on WhatsApp</button><button class="btn xs" onclick="copyText(${JSON.stringify(m).replace(/"/g,'&quot;')});toast('Copied')">Copy</button></div></div></div>`).join('')}</div>
      <div class="sec">Orders (${S.length})</div><div class="card">${S.map(s=>Sales.row(s)).join('')||'<div class="empty">No orders</div>'}</div>`;
    Sheet.open('sh-cust');
  },
  newSale(id){ Sheet.close('sh-cust'); Sell.reset(); Sell.open(); Sell.fillCustomer(id); },
  openEdit(id){ const c=id?Store.cache.customers.find(x=>x.id===id):null; this.cur=c; $('cust-title').textContent=c?'Edit customer':'New customer'; $('cu-del').style.display=c?'inline-flex':'none'; ['name','phone','email','address','city','state','postcode','tags','source','notes'].forEach(k=>$('cu-'+k).value=c?.[k]||''); Sheet.open('dr-cust'); },
  async save(){ const name=$('cu-name').value.trim(); if(!name){ toast('Name required','err'); return; } const c=this.cur||{id:uid('c'),order_count:0,total_spent:0,created_at:new Date().toISOString()}; ['name','phone','email','address','city','state','postcode','tags','source','notes'].forEach(k=>c[k]=$('cu-'+k).value.trim()); c.state=c.state.toUpperCase(); await Store.upsert('customers',c); Sheet.close('dr-cust'); toast('Saved'); this.render(); if($('sh-cust').classList.contains('on')) this.detail(c.id); },
  async del(){ if(!this.cur||!confirm('Delete '+this.cur.name+'? Their sales are kept.')) return; await Store.remove('customers',this.cur.id); Sheet.close('dr-cust'); Sheet.close('sh-cust'); toast('Deleted'); this.render(); },
};

// ============================================================
// REPORTS (printable, rendered into #pf iframe)
// ============================================================
const UI = { sync:(s,t)=>Nav.sync(s,t) };
const Reports = {
  css:`*{box-sizing:border-box}body{font-family:-apple-system,Inter,system-ui,sans-serif;color:#141412;margin:0;padding:0 0 60px;background:#fff;font-size:13px}.bar{position:sticky;top:0;background:#141412;color:#fff;display:flex;gap:8px;align-items:center;padding:10px 14px;flex-wrap:wrap}.bar button,.bar a{border:1px solid rgba(255,255,255,.3);background:transparent;color:#fff;border-radius:8px;padding:7px 12px;font-size:13px;text-decoration:none}.bar button.on{background:#fff;color:#141412}.bar .sp{flex:1}.wrap{padding:18px 20px;max-width:900px;margin:0 auto}h1{font-family:Georgia,serif;font-style:italic;font-weight:400;font-size:28px;margin:0 0 2px}h2{font-size:15px;margin:26px 0 8px;padding-bottom:5px;border-bottom:2px solid #141412}.sub{color:#666;font-size:12px;margin-bottom:14px}.kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:8px;margin:12px 0}.k{border:1px solid #ddd;border-radius:10px;padding:10px 12px}.k b{display:block;font-size:20px;font-family:ui-monospace,Menlo,monospace}.k span{font-size:11px;color:#666;text-transform:uppercase;letter-spacing:.05em}table{width:100%;border-collapse:collapse;font-size:12.5px}th{text-align:left;font-size:10.5px;text-transform:uppercase;letter-spacing:.06em;color:#666;padding:6px 8px;border-bottom:1px solid #141412}td{padding:6px 8px;border-bottom:1px solid #eee;vertical-align:top}td.n,th.n{text-align:right;font-family:ui-monospace,Menlo,monospace}tr.hl td{background:#fff6e0}tr.bad td{background:#fde8e6}tr.tot td{font-weight:700;border-top:2px solid #141412}.tag{font-size:10px;padding:2px 6px;border-radius:5px;background:#eee}.foot{color:#999;font-size:11px;margin-top:30px;text-align:center}@media (max-width:700px){table{display:block;overflow-x:auto;white-space:nowrap;-webkit-overflow-scrolling:touch}td,th{padding:6px 6px}}@media print{.bar{display:none}body{padding:0}table{display:table;white-space:normal}}`,
  show(title,sub,body,toolbar=''){
    const html=`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><style>${this.css}</style></head><body><div class="bar"><button onclick="parent.Reports.hide()">‹ Back</button>${toolbar}<span class="sp"></span><button onclick="window.print()">Print / PDF</button></div><div class="wrap"><h1>${esc(title)}</h1><div class="sub">OPTML · ${sub} · generated ${new Date().toLocaleString('en-AU',{day:'numeric',month:'short',year:'numeric',hour:'numeric',minute:'2-digit'})}</div>${body}<div class="foot">OPTML CRM</div></div></body></html>`;
    $('pf-i').srcdoc=html; $('pf').classList.add('on');
  },
  hide(){ $('pf').classList.remove('on'); $('pf-i').srcdoc=''; },
  kpi(arr){ return `<div class="kpis">${arr.map(([l,v])=>`<div class="k"><b>${v}</b><span>${l}</span></div>`).join('')}</div>`; },
  table(h,rows,cls){ return `<table><thead><tr>${h.map(x=>`<th class="${x.startsWith('#')?'n':''}">${x.replace(/^#/,'')}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr class="${(cls&&cls(r))||''}">${r.map((c,i)=>`<td class="${h[i].startsWith('#')?'n':''}">${c}</td>`).join('')}</tr>`).join('')||'<tr><td colspan="'+h.length+'" style="color:#999">Nothing</td></tr>'}</tbody></table>`; },
  rangeOf(r){ const t=today(); if(r==='today') return [t,t,'Today']; if(r==='week') return [addDays(-6),t,'Last 7 days']; if(r==='month') return [t.slice(0,8)+'01',t,'This month']; if(r==='30') return [addDays(-29),t,'Last 30 days']; if(r==='90') return [addDays(-89),t,'Last 90 days']; if(r&&r.includes('|')){ const [a,b]=r.split('|'); return [a,b,fmtDate(a)+' – '+fmtDate(b)]; } return ['0000-00-00',t,'All time']; },
  salesBody(from,to){
    const S=Store.cache.sales.filter(s=>s.date>=from&&s.date<=to&&s.status!=='Cancelled'); const rev=sum(S,s=>s.total), units=sum(S,s=>sum(s.items||[],i=>i.pack_qty*i.count));
    const byPay={}; S.forEach(s=>{ if(s.payment==='Split') (s.split_payments||[]).forEach(p=>byPay[p.method]=(byPay[p.method]||0)+ +p.amount); else byPay[s.payment]=(byPay[s.payment]||0)+s.total; });
    const byProd={}; S.forEach(s=>(s.items||[]).forEach(i=>{ const k=i.name; byProd[k]=byProd[k]||{u:0,r:0,n:0,c:0}; byProd[k].u+=i.pack_qty*i.count; byProd[k].r+=i.price*i.count; byProd[k].n+=i.count; byProd[k].c+=Profit.costUSD(i)*i.pack_qty*i.count*Profit.cfg().fx; }));
    const byDay={}; S.forEach(s=>{ byDay[s.date]=byDay[s.date]||{n:0,r:0}; byDay[s.date].n++; byDay[s.date].r+=s.total; });
    const walk=S.filter(s=>s.fulfilment==='Walk-in').length, self=S.filter(s=>s.fulfilment==='Self').length; const P=Profit.sumOf(S); const pc=Profit.cfg();
    return this.kpi([['Revenue',money(rev)],['Orders',S.length],['Vials sold',units],['Avg order',money(S.length?rev/S.length:0)],['Courier / Self / Walk-in',(S.length-walk-self)+' / '+self+' / '+walk],['Discounts',money(sum(S,s=>s.discount||0))],['Shipping collected',money(sum(S,s=>s.shipping||0))],['Bac water',sum(S,s=>s.bac3||0)+'×3ml · '+sum(S,s=>s.bac10||0)+'×10ml']])
      +`<h2>Profit</h2>`+this.kpi([['Product cost (AUD @ '+pc.fx+')',money(P.cogs)],['Gross profit',money(P.gross)],['Courier '+pc.pct+'%',money(P.courier)],['Net profit',money(P.net)],['Net margin',rev?Math.round(P.net/rev*100)+'%':'—']])
      +`<h2>Payments</h2>`+this.table(['Method','#Orders','#Amount','#Share'],['Cash','BKP','KJ'].map(m=>[m,S.filter(s=>s.payment===m||(s.payment==='Split'&&(s.split_payments||[]).some(p=>p.method===m))).length,money(byPay[m]||0),rev?Math.round((byPay[m]||0)/rev*100)+'%':'—']))
      +`<h2>By product</h2>`+this.table(['Product','#Lines','#Vials','#Revenue','#Cost','#Gross'],Object.entries(byProd).sort((a,b)=>b[1].r-a[1].r).map(([k,v])=>[esc(k),v.n,v.u,money(v.r),money(v.c),money(v.r-v.c)]))
      +`<h2>By day</h2>`+this.table(['Date','#Orders','#Revenue'],Object.keys(byDay).sort().reverse().map(d=>[fmtDateFull(d),byDay[d].n,money(byDay[d].r)]))
      +`<h2>Orders</h2>`+this.table(['#','Date','Customer','Items','Pay','Status','#Total','#Net'],S.sort((a,b)=>b.date>a.date?1:-1).map(s=>[s.sale_no,fmtDate(s.date),esc((s.customer||{}).name||'Walk-in'),esc((s.items||[]).map(i=>i.name+' ×'+(i.pack_qty*i.count)).join(', ')||(s.manual_amount?'manual':'')),esc(s.payment),`<span class="tag">${s.status}</span>`,money(s.total),money(Profit.of(s).net)]));
  },
  sales(r='week'){
    const [from,to,label]=this.rangeOf(r);
    const tb=[['today','Today'],['week','7 days'],['month','Month'],['30','30 days'],['90','90 days'],['all','All']].map(([k,l])=>`<button class="${k===r?'on':''}" onclick="parent.Reports.sales('${k}')">${l}</button>`).join('')+`<button onclick="var a=prompt('From (YYYY-MM-DD)','${from==='0000-00-00'?addDays(-30):from}');var b=a&&prompt('To (YYYY-MM-DD)','${to}');if(a&&b)parent.Reports.sales(a+'|'+b)">Custom…</button>`;
    this.show('Sales report',label,this.salesBody(from,to),tb);
  },
  launchBody(){
    const P=Store.cache.products.filter(p=>!p.hidden&&!p.soon); const rows=P.map(p=>{ const inc=Inv.incoming(p.id); const deficit=Math.max(0,p.reorder-(p.stock+inc)); const packs=Math.ceil(deficit/10); return {p,inc,deficit,packs}; });
    const totalPacks=sum(rows,r=>r.packs), cost=sum(rows,r=>r.packs*10*(+r.p.cost||0));
    return this.kpi([['Products',P.length],['Need ordering',rows.filter(r=>r.packs).length],['10-packs to order',totalPacks],['Vials to order',totalPacks*10],['Est. cost USD',cost?'US'+money(cost):'—']])
      +`<h2>Supplier order — 10-packs</h2><p style="color:#666;font-size:12px;margin:0 0 8px">Deficit = reorder minimum − (stock + incoming). Supplier sells in 10-packs, so packs = deficit ÷ 10 rounded up. Kit price = HXTNT list, USD, 1–9 kit tier.</p>`
      +this.table(['Product','Supplier code','#Stock','#Incoming','#Min','#Deficit','#10-packs','#Kit USD','#Cost USD'],rows.sort((a,b)=>b.packs-a.packs||a.p.name.localeCompare(b.p.name)).map(r=>[esc(r.p.name),esc(r.p.supplier_sku||r.p.sku||''),r.p.stock,r.inc||'—',r.p.reorder,r.deficit||'—',r.packs?`<b>${r.packs}</b>`:'—',r.p.cost?'$'+(r.p.cost*10):'—',r.packs&&r.p.cost?'$'+(r.packs*10*r.p.cost):'—']).concat([[`<b>Total</b>`,'','','','','',`<b>${totalPacks}</b>`,'',`<b>${cost?'US$'+cost:'—'}</b>`]]),r=>r[0].startsWith('<b>Total')?'tot':(r[6]!=='—'?'hl':''));
  },
  launch(){ this.show('Reorder report','supplier order sheet',this.launchBody()); },
  inventoryBody(){
    const P=Store.cache.products.filter(p=>!p.hidden).sort((a,b)=>a.category.localeCompare(b.category)||a.name.localeCompare(b.name));
    return this.kpi([['Products',P.length],['Units',sum(P,p=>p.stock)],['Stock cost USD','US'+money(sum(P,p=>p.stock*(+p.cost||0)))],['Retail value AUD',money(sum(P,p=>p.stock*(+p.sell1||0)))],['Low',P.filter(p=>!p.soon&&p.stock<=p.reorder&&p.stock>0).length],['Out',P.filter(p=>!p.soon&&p.stock<=0).length]])
      +`<h2>Stock on hand</h2>`+this.table(['','Product','SKU','Supplier','Category','#Stock','#Incoming','#Min','Status','#Sell AUD','#Cost USD'],P.map(p=>['',esc(p.name),esc(p.sku||''),esc(p.supplier_sku||''),esc(p.category),p.stock,Inv.incoming(p.id)||'—',p.reorder,p.soon?'soon':stockStatus(p),p.sell1?'$'+p.sell1:'—',p.cost?'$'+p.cost:'—']),r=>r[8]==='out'?'bad':r[8]==='low'?'hl':'');
  },
  inventory(){ this.show('Inventory','stock on hand',this.inventoryBody()); },
  ordersBody(){ const O=Store.cache.purchase_orders; const name=o=>esc((Store.cache.products.find(p=>p.id===o.product_id)||{}).name||'?'); const t=today();
    return `<h2>Pending</h2>`+this.table(['Product','#Qty','Supplier','Ref','Ordered','ETA'],O.filter(o=>o.status==='pending').sort((a,b)=>(a.eta||'')<(b.eta||'')?-1:1).map(o=>[name(o),o.qty,esc(o.supplier||''),esc(o.ref||''),fmtDate(o.order_date),fmtDate(o.eta)+(o.eta<t?' ⚠ overdue':'')]),r=>r[5].includes('overdue')?'hl':'')
      +`<h2>Arrived</h2>`+this.table(['Product','#Qty','Supplier','Ref','Ordered','Arrived'],O.filter(o=>o.status==='arrived').sort((a,b)=>(b.arrived_date||'')>(a.arrived_date||'')?1:-1).map(o=>[name(o),o.qty,esc(o.supplier||''),esc(o.ref||''),fmtDate(o.order_date),fmtDate(o.arrived_date)])); },
  orders(){ this.show('Incoming orders','purchase orders',this.ordersBody()); },
  movementsBody(){ const M=[...Store.cache.movements].sort((a,b)=>(b.created_at||b.date)>(a.created_at||a.date)?1:-1).slice(0,500); return this.table(['When','Product','Type','#Qty','Note'],M.map(m=>[new Date(m.created_at||m.date).toLocaleString('en-AU',{day:'numeric',month:'short',hour:'numeric',minute:'2-digit'}),esc(m.product_name||''),m.type,(m.qty>0?'+':'')+m.qty,esc(m.note||'')])); },
  movements(){ this.show('Stock movements','last 500',this.movementsBody()); },
  customersBody(){ const C=[...Store.cache.customers].sort((a,b)=>(b.total_spent||0)-(a.total_spent||0)); const t30=addDays(-30);
    return this.kpi([['Customers',C.length],['Lifetime revenue',money(sum(C,c=>c.total_spent||0))],['Repeat (2+)',C.filter(c=>(c.order_count||0)>=2).length],['Reorder due',C.filter(c=>c.last_seen&&c.last_seen<t30&&c.order_count).length]])
      +this.table(['Customer','Phone','City','#Orders','#Spent','Last order'],C.map(c=>[esc(c.name),esc(c.phone||''),esc([c.city,c.state].filter(Boolean).join(' ')),c.order_count||0,money(c.total_spent||0),c.last_seen?fmtDate(c.last_seen):'—']),r=>''); },
  customers(){ this.show('Customers','ranked by spend',this.customersBody()); },
  courier(){
    const T=Courier.totals(); const U=Courier.unpaid(); const pc=Profit.cfg(); const P=[...Store.cache.courier_payments].sort((a,b)=>b.date>a.date?1:-1);
    const all=Courier.owedSales().sort((a,b)=>b.date>a.date?1:-1);
    this.show('Courier statement',`${pc.pct}% of gross profit on shipped orders`,this.kpi([['Owed now',money(T.balance)],['Unpaid orders',U.length],['Earned this month',money(T.month)],['Paid to date',money(T.paid)],['Earned to date',money(T.accrued)]])
      +`<h2>Unpaid orders</h2>`+this.table(['#','Date','Customer','#Sale','#Gross profit','#Courier share'],U.map(s=>{ const p=Profit.of(s); return [s.sale_no,fmtDate(s.date),esc((s.customer||{}).name||'Walk-in'),money(s.total),money(p.gross),money(p.courier)]; }).concat(U.length?[['<b>Total</b>','','','','',`<b>${money(T.balance)}</b>`]]:[]),r=>r[0]==='<b>Total</b>'?'tot':'')
      +`<h2>Payments</h2>`+this.table(['Date','#Amount','Method','Note','#Orders'],P.map(p=>[fmtDateFull(p.date),money(p.amount),esc(p.method||''),esc(p.note||''),(p.sale_ids||[]).length]))
      +`<h2>All dispatched orders</h2>`+this.table(['#','Date','Customer','#Sale','#Courier share','Paid'],all.map(s=>[s.sale_no,fmtDate(s.date),esc((s.customer||{}).name||'Walk-in'),money(s.total),money(Profit.of(s).courier),s.courier_paid_at?fmtDate(s.courier_paid_at.slice(0,10)):'—'])));
  },
  full(){ const [f,t]=this.rangeOf('30'); this.show('Full business report','everything',`<h2 style="margin-top:10px">Sales — last 30 days</h2>`+this.salesBody(f,t)+`<h2>Launch & reorder</h2>`+this.launchBody()+`<h2>Inventory</h2>`+this.inventoryBody()+`<h2>Incoming orders</h2>`+this.ordersBody()+`<h2>Customers</h2>`+this.customersBody()); },
};

// ============================================================
// APP BOOT
// ============================================================
const App = {
  async boot(){
    const conn=JSON.parse(localStorage.getItem('optml_conn')||'null'); const skip=localStorage.getItem('optml_skip_setup');
    await Store.init();
    if(Store.mode==='cloud'){
      const {data:{session}}=await Store.sb.auth.getSession();
      if(session){ await this.start(); return; }
      $('auth').classList.add('on'); Auth.showLogin(); return;
    }
    if(skip){ Store.mode='local'; await this.start(); return; }
    $('auth').classList.add('on');
    if(!window.supabase){ Auth.showSetup(); $('auth-sub').textContent="Couldn't reach the sync service — check your internet, or continue on this device only"; return; }
    Auth.showLogin();
  },
  async start(){
    try{ await Store.loadAll(); }catch(e){ console.error(e); $('auth').classList.add('on'); Auth.showLogin(); $('auth-err').textContent='Could not load data: '+e.message+' — check the connection settings or run the SQL schema.'; $('auth-err').style.display='block'; return; }
    $('auth').classList.remove('on'); $('app').classList.add('on'); $('nav').classList.add('on');
    Nav.sync(Store.mode==='cloud'?'ok':'local',Store.mode==='cloud'?'Synced':'Local');
    Sell.applyShipping(); Nav.go('home'); this.realtime();
  },
  async reload(){ await Store.loadAll(); Nav.go(Nav.cur); },
  async refresh(){ if(Store.mode!=='cloud'||this._busy) return; this._busy=true; try{ await Store.loadAll(); Nav.go(Nav.cur); Nav.sync('ok','Synced'); }catch(e){ Nav.sync('err','Offline'); } this._busy=false; },
  realtime(){
    if(Store.mode!=='cloud'||this._rt) return; this._rt=true;
    const bump=()=>{ clearTimeout(this._t); this._t=setTimeout(()=>this.refresh(),600); };
    try{ Store.sb.channel('optml').on('postgres_changes',{event:'*',schema:'public'},bump).subscribe(st=>{ if(st==='SUBSCRIBED') Nav.sync('ok','Live'); }); }catch(e){ console.warn('realtime',e); }
    // belt and braces: refresh when the app comes back to the foreground, and every 60s while open
    document.addEventListener('visibilitychange',()=>{ if(document.visibilityState==='visible') this.refresh(); });
    window.addEventListener('focus',()=>this.refresh());
    setInterval(()=>{ if(document.visibilityState==='visible') this.refresh(); },60000);
  },
};
window.addEventListener('DOMContentLoaded',()=>App.boot());
