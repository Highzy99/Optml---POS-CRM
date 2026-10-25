-- ============================================================
-- OPTML CRM — Supabase Schema
-- Run this once in: Supabase Dashboard → SQL Editor → New query
-- ============================================================

-- PRODUCTS
create table if not exists products (
  id          text primary key,
  name        text not null,
  sku         text,
  category    text,
  stock       integer default 0,
  reorder     integer default 5,
  cost        numeric default 0,         -- USD per vial (supplier kit price ÷ 10)
  supplier_sku text,                     -- supplier catalogue code (HXTNT)
  hidden      boolean default false,     -- hidden from stock list, sell search and reports
  sell1       numeric default 0,
  sell3       numeric default 0,
  sell10      numeric default 0,
  sell5       numeric,                 -- 5-vial pack price (AUD)
  launch      boolean default false,
  soon        boolean default false,
  bac_size    text default '3ml',   -- '3ml' | '10ml' | 'none'
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- CUSTOMERS
create table if not exists customers (
  id          text primary key,
  name        text not null,
  phone       text,
  email       text,
  address     text,
  city        text,
  state       text,
  postcode    text,
  notes       text,
  tags        text,
  source      text,
  order_count integer default 0,
  total_spent numeric default 0,
  last_seen   date,
  created_at  timestamptz default now()
);

-- SALES
create table if not exists sales (
  id             text primary key,
  sale_no        serial,
  date           date not null default current_date,
  customer_id    text references customers(id) on delete set null,
  customer       jsonb,              -- snapshot: name, phone, email, address, city, state, postcode
  items          jsonb default '[]', -- [{product_id, name, sku, pack_qty, count, price}]
  bac3           integer default 0,
  bac10          integer default 0,
  manual_amount  numeric default 0,
  subtotal       numeric default 0,
  discount       numeric default 0,
  shipping       numeric default 0,
  total          numeric default 0,
  payment        text default 'Cash', -- Cash | BKP | KJ | Split
  split_payments jsonb default '[]',
  fulfilment     text default 'Shipped', -- Walk-in | Shipped
  status         text default 'New',     -- New | Paid | Sent to Courier | Dispatched | Delivered | Cancelled
  tracking       text,
  courier_sent_at timestamptz,
  notes          text,
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);

-- PURCHASE ORDERS (incoming stock)
create table if not exists purchase_orders (
  id            text primary key,
  product_id    text references products(id) on delete cascade,
  qty           integer not null,
  ref           text,
  supplier      text,
  order_date    date,
  eta           date,
  delivery      jsonb,  -- {name, phone, email, address}
  status        text default 'pending', -- pending | arrived | cancelled
  arrived_date  date,
  created_at    timestamptz default now()
);

-- STOCK MOVEMENTS
create table if not exists movements (
  id           text primary key,
  product_id   text,
  product_name text,
  sku          text,
  type         text,   -- in | out | adj | arrived | sale
  qty          integer,
  note         text,
  date         date default current_date,
  created_at   timestamptz default now()
);

-- COURIER PAYMENTS (what you've paid the courier against their share of profit)
create table if not exists courier_payments (
  id          text primary key,
  date        date default current_date,
  amount      numeric default 0,
  method      text,
  note        text,
  sale_ids    jsonb default '[]',   -- sales this payment settled
  created_at  timestamptz default now()
);
alter table sales add column if not exists courier_paid_at timestamptz;
alter table sales add column if not exists courier_payment_id text;

-- SETTINGS (single row keyed by name)
create table if not exists settings (
  key   text primary key,
  value jsonb
);

-- ACTIVITY LOG
create table if not exists activity (
  id         bigserial primary key,
  kind       text,
  message    text,
  meta       jsonb,
  created_at timestamptz default now()
);

-- ------------------------------------------------------------
-- INDEXES
-- ------------------------------------------------------------
create index if not exists idx_sales_date      on sales(date desc);
create index if not exists idx_sales_status    on sales(status);
create index if not exists idx_sales_customer  on sales(customer_id);
create index if not exists idx_customers_phone on customers(phone);
create index if not exists idx_po_status       on purchase_orders(status);
create index if not exists idx_movements_date  on movements(date desc);

-- ------------------------------------------------------------
-- ROW LEVEL SECURITY — only logged-in users can read/write
-- ------------------------------------------------------------
alter table products        enable row level security;
alter table customers       enable row level security;
alter table sales           enable row level security;
alter table purchase_orders enable row level security;
alter table movements       enable row level security;
alter table settings        enable row level security;
alter table activity        enable row level security;
alter table courier_payments enable row level security;

do $$
declare t text;
begin
  foreach t in array array['products','customers','sales','purchase_orders','movements','settings','activity','courier_payments'] loop
    execute format('drop policy if exists "auth_all" on %I', t);
    execute format('create policy "auth_all" on %I for all to authenticated using (true) with check (true)', t);
  end loop;
end $$;

-- ------------------------------------------------------------
-- AUTO updated_at
-- ------------------------------------------------------------
create or replace function touch_updated_at() returns trigger as $$
begin new.updated_at = now(); return new; end; $$ language plpgsql;

drop trigger if exists trg_products_touch on products;
create trigger trg_products_touch before update on products for each row execute function touch_updated_at();
drop trigger if exists trg_sales_touch on sales;
create trigger trg_sales_touch before update on sales for each row execute function touch_updated_at();

-- ------------------------------------------------------------
-- SEED: product catalogue (safe to re-run — upserts)
-- ------------------------------------------------------------
insert into products (id,name,sku,category,sell1,sell3,sell10,bac_size,soon) values
 ('p01','Retatrutide 10mg','RE10','Weight',180,500,1100,'3ml',false),
 ('p02','Retatrutide 20mg','RE20','Weight',320,800,1500,'3ml',false),
 ('p03','Retatrutide 30mg','RE30','Weight',400,1000,1750,'3ml',false),
 ('p04','Tirzepatide 10mg','TI10','Weight',150,400,750,'3ml',false),
 ('p05','Tirzepatide 20mg','TI20','Weight',250,680,1125,'3ml',false),
 ('p06','Tirzepatide 30mg','TI30','Weight',320,800,1500,'3ml',false),
 ('p07','Cagrilintide 5mg','CA05','Weight',140,320,700,'3ml',false),
 ('p08','Cagrilintide 10mg','CA10','Weight',0,0,0,'3ml',false),
 ('p09','Tesamorelin 10mg','TE10','Weight',180,432,900,'3ml',false),
 ('p10','AOD-9604 10mg','AO10','Weight',120,288,600,'3ml',false),
 ('p11','5-Amino-1MQ 50mg','AM50','Weight',110,264,550,'3ml',false),
 ('p12','SLU-PP-332 1mg caps','SL10','Weight',120,300,0,'none',false),
 ('p13','MOTS-c 10mg','MO10','Energy',90,216,450,'3ml',false),
 ('p14','MOTS-c 40mg','MO40','Energy',250,600,1250,'3ml',false),
 ('p15','NAD+ 500mg','NA50','Energy',0,0,0,'10ml',false),
 ('p16','NAD+ 1000mg','NA10','Energy',180,432,900,'10ml',false),
 ('p17','SS-31 10mg','SS10','Energy',0,0,0,'3ml',false),
 ('p18','SS-31 50mg','SS50','Energy',0,0,0,'3ml',false),
 ('p19','BPC-157 10mg','BP10','Restore',90,220,500,'3ml',false),
 ('p20','ARA-290 10mg','AR10','Restore',0,0,0,'3ml',false),
 ('p21','KPV 10mg','KP10','Restore',90,216,450,'3ml',false),
 ('p22','TB-500 10mg','TB10','Restore',130,312,650,'3ml',false),
 ('p23','Wolverine Stack 20mg','WO20','Restore',160,432,900,'3ml',false),
 ('p24','Glow Stack 70mg','GL70','Restore',180,470,900,'3ml',false),
 ('p25','Klow Stack 80mg','KL80','Restore',200,500,1000,'3ml',false),
 ('p26','BPC-157 Arginate 500mcg caps','BA50','Restore',0,0,0,'none',false),
 ('p27','CJC / Ipamorelin 5mg/5mg','CJ10','Growth',150,360,750,'3ml',false),
 ('p28','GHRP-6 10mg','GH10','Growth',0,0,0,'3ml',false),
 ('p29','Sermorelin 10mg','SR10','Growth',0,0,0,'3ml',false),
 ('p30','IGF-1 LR3 1mg','IG01','Growth',180,432,900,'3ml',false),
 ('p31','Selank 10mg','SK10','Edge',80,192,400,'3ml',false),
 ('p32','Semax 10mg','SX10','Edge',100,240,500,'3ml',false),
 ('p33','VIP 10mg','VI10','Edge',0,0,0,'3ml',false),
 ('p34','Testagen 20mg','TS20','Vitality',170,408,850,'3ml',false),
 ('p35','Kisspeptin 10mg','KI10','Vitality',100,432,900,'3ml',false),
 ('p36','PT-141 10mg','PT10','Vitality',0,0,0,'3ml',false),
 ('p37','HCG 10,000iu','HC10','Vitality',180,432,900,'3ml',false),
 ('p38','HMG 75iu','HM75','Vitality',80,240,500,'3ml',false),
 ('p39','DSIP 10mg','DS10','Sleep',110,264,550,'3ml',false),
 ('p40','Thymosin Alpha-1 10mg','TH10','Immunity',0,0,0,'3ml',true),
 ('p41','LL-37 5mg','LL05','Immunity',0,0,0,'3ml',true),
 ('p42','GHK-Cu 50mg','GH50','Glow',100,240,500,'3ml',false),
 ('p43','GHK-Cu 100mg','GH100','Glow',0,0,0,'3ml',false),
 ('p44','Melanotan I 10mg','M110','Glow',0,0,0,'3ml',false),
 ('p45','Melanotan II 10mg','ME10','Glow',100,240,500,'3ml',false),
 ('p46','Epithalon 10mg','EP10','Glow',0,0,0,'3ml',false),
 ('p47','Epithalon 50mg','EP50','Glow',0,0,0,'3ml',false),
 ('p48','SNAP-8 10mg','SN10','Glow',80,192,400,'3ml',false),
 ('p49','FOXO1-DRI 10mg','FO10','Glow',0,0,0,'3ml',false),
 ('p50','Bacteriostatic Water 3ml','BW03','Essentials',15,35,100,'none',false),
 ('p51','Bacteriostatic Water 10ml','BW10','Essentials',30,70,150,'none',false)
on conflict (id) do update set
  name=excluded.name, sku=excluded.sku, category=excluded.category,
  sell1=excluded.sell1, sell3=excluded.sell3, sell10=excluded.sell10,
  bac_size=excluded.bac_size, soon=excluded.soon;

-- Rename legacy categories to OPTML goal names (safe to re-run)
update products set category=case category when 'Weight & Burn' then 'Weight' when 'Repair & Recovery' then 'Restore' when 'Performance & Build' then 'Growth' when 'Skin & Glow' then 'Glow' when 'Supplies' then 'Essentials' else category end;

alter table products add column if not exists supplier_sku text;
alter table products add column if not exists hidden boolean default false;
update products set hidden=true where id in ('p11','p10','p08','p07','p15','p17','p18','p20','p30','p29','p33','p36','p34','p38','p41','p40','p44','p49','p48');

-- Supplier codes + cost per vial in USD (HXTNT list, kit of 10 ÷ 10). Safe to re-run.
update products p set supplier_sku=v.s, cost=v.c from (values
 ('p01','RT10',7),
 ('p02','RT20',9.8),
 ('p03','RT30',14),
 ('p04','TR10',4.3),
 ('p05','TR20',6.3),
 ('p06','TR30',7.7),
 ('p07','CGL5',8.8),
 ('p08','CGL10',14.5),
 ('p09','TSM10',15),
 ('p10','10AD',15),
 ('p11','50AM',9),
 ('p13','MS10',5),
 ('p14','MS40',15),
 ('p15','NJ500',7),
 ('p16','NJ1000',10),
 ('p17','2S10',6.5),
 ('p18','2S50',27),
 ('p19','BC10',6),
 ('p20','RA10',4.8),
 ('p21','KPV10',4.8),
 ('p22','BT10',12),
 ('p23','BB20',14.5),
 ('p24','BBG70',16.3),
 ('p25','Klow',18),
 ('p27','CP10',7.5),
 ('p28','G610',4.6),
 ('p29','SMO10',12),
 ('p30','IG1',17),
 ('p31','SK10',5.5),
 ('p32','XA10',5.5),
 ('p33','VIP10',12),
 ('p35','KS10',7),
 ('p36','P41',5),
 ('p37','G10K',11),
 ('p38','G75',5),
 ('p39','DS10',5.8),
 ('p40','TA10',14),
 ('p41','LL37',6.5),
 ('p42','CU',3.2),
 ('p43','CU100',4.5),
 ('p44','MT1',4),
 ('p45','ML10',4),
 ('p46','ET10',4.6),
 ('p47','ET50',12),
 ('p48','NP810',4),
 ('p49','F410',21),
 ('p50','BA3',1),
 ('p51','BA10',1.4)
) as v(id,s,c) where p.id=v.id;

-- Default settings
insert into settings (key, value) values
 ('shipping', '{"flat":15,"free_over":200}'),
 ('profit', '{"fx":1.55,"courier_pct":25}'),
 ('whatsapp', '{"mode":"app","phone_id":"","token":"","dispatch_template":"","lang":"en","courier":""}'),
 ('quote_template', '"Hi {first_name}! Here''s your OPTML quote 😊\n\n{items}\n{bac}\nSubtotal {subtotal}\n{discount}Shipping {shipping}\nTotal {total}\n\nPay by cash, BKP or KJ — reply here and I''ll get it packed and sent today 📦"'),
 ('courier_template', '"📦 NEW ORDER #{sale_no}\n\n👤 {name}\n📱 {phone}\n📍 {address}\n\n{items}\n{bac}\n\n💬 {notes}"'),
 ('dispatch_template', '"Hi {first_name}! Your order has been dispatched and dropped to the post office 😊\n\nYou''ll receive a notification once it''s been scanned into the network. If you have any questions don''t hesitate to reach out 😊 📦\n\nTrack here 👉 https://auspost.com.au/mypost/track/#/details/{tracking}"')
on conflict (key) do nothing;

-- Live sync between devices: publish the tables for Supabase Realtime (safe to re-run)
do $$
declare t text;
begin
  foreach t in array array['products','customers','sales','purchase_orders','movements','settings','courier_payments'] loop
    if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- Every visible product is a launch product
update products set launch = not hidden;

alter table products add column if not exists sell5 numeric;
-- Current prices (AUD): retail 1/3/5 from otpml-pricelist, 10-vial wholesale from optml-wholesale-catalogue. Safe to re-run.
update products p set sell1=v.s1, sell3=v.s3, sell5=v.s5, sell10=coalesce(v.s10,p.sell10) from (values
 ('RE10',149,402,649,799),
 ('RE20',239,645,999,1199),
 ('RE30',299,807,1249,1499),
 ('GH50',59,149,219,389),
 ('GH100',79,209,299,539),
 ('ME10',79,209,299,489),
 ('WO20',129,348,549,739),
 ('GL70',149,402,633,889),
 ('KL80',179,483,739,989),
 ('MO10',69,179,249,389),
 ('MO40',209,564,839,1089),
 ('TE10',149,402,649,889),
 ('BA50',89,240,369,439),
 ('BP10',69,179,249,489),
 ('CJ10',129,348,509,null::numeric),
 ('DS10',89,240,399,539),
 ('GH10',59,159,259,439),
 ('KI10',89,240,399,589),
 ('KP10',89,239,349,439),
 ('NA10',169,456,749,939),
 ('SK10',79,209,319,439),
 ('SL10',89,219,359,589),
 ('SX10',79,209,319,439),
 ('TB10',119,319,479,699),
 ('TI10',119,319,479,589),
 ('TI20',179,479,719,879),
 ('TI30',219,589,879,1089)
) as v(sku,s1,s3,s5,s10) where p.sku=v.sku;
