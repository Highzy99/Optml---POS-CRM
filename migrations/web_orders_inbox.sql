create extension if not exists pg_net;

-- orders sent from the price list (stayoptml.vercel.app) land here until they're made into a sale
create table if not exists public.web_orders(
  id text primary key,                       -- the order ref (OPT-XXXXX); -2, -3… if a ref is reused for a later order
  ref text not null,
  status text not null default 'new',        -- started (typed their details at checkout, not confirmed yet) | new | changed | accepted | dismissed
  wholesale boolean not null default false,
  name text, phone text, email text, street text, suburb text, region text, postcode text, country text default 'AU',
  notes text, code text,
  items jsonb not null default '[]'::jsonb,  -- [{sku,name,pack,qty,amount,product_id,list_amount}]
  subtotal numeric, discount numeric, shipping numeric, total numeric,   -- what the customer saw
  list_total numeric, price_ok boolean not null default true, price_note text,  -- re-worked from the POS prices
  message text, revisions int not null default 1, sale_id text, replied_at timestamptz,
  upload_token uuid not null default gen_random_uuid(),   -- private key the customer's browser gets back, so only they can attach a screenshot
  proof_at timestamptz, proof_count int not null default 0,
  draft_saves int not null default 0,                     -- how many times a checkout-in-progress was saved before it was confirmed
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
-- (in case an earlier version of this table is already there)
alter table public.web_orders add column if not exists upload_token uuid not null default gen_random_uuid();
alter table public.web_orders add column if not exists proof_at timestamptz;
alter table public.web_orders add column if not exists proof_count int not null default 0;
alter table public.web_orders add column if not exists draft_saves int not null default 0;
create index if not exists web_orders_updated_idx on public.web_orders(updated_at desc);
create index if not exists web_orders_ref_idx on public.web_orders(ref);
alter table public.web_orders enable row level security;
drop policy if exists web_orders_members on public.web_orders;
create policy web_orders_members on public.web_orders for all using ((select public.is_member())) with check ((select public.is_member()));
do $$ begin alter publication supabase_realtime add table public.web_orders; exception when duplicate_object then null; end $$;
drop trigger if exists trg_audit on public.web_orders;
create trigger trg_audit after insert or update or delete on public.web_orders for each row execute function public.audit_trg();

-- the price list calls this (no login). Checks the order, re-prices it from the POS price list, saves it.
-- stage 'started' = saved quietly while the customer fills in the checkout, so an abandoned checkout still leaves their
-- details and cart; stage 'placed' (the default) = they pressed Confirm your order.
create or replace function public.submit_web_order(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_ref text := upper(btrim(coalesce(p->>'ref','')));
  v_draft boolean := coalesce(p->>'stage','') = 'started';
  v_phone_digits text := regexp_replace(coalesce(p->>'phone',''),'\D','','g');
  v_name text := left(btrim(coalesce(p->>'name','')),80);
  v_items jsonb := coalesce(p->'items','[]'::jsonb);
  v_wholesale boolean := coalesce((p->>'wholesale')::boolean,false);
  v_country text := case when upper(coalesce(p->>'country','AU'))='NZ' then 'NZ' else 'AU' end;
  v_code text := upper(left(btrim(coalesce(p->>'code','')),20));
  v_codes jsonb := coalesce((select value from public.settings where key='web_codes'), '{"OPTML10":10,"OPTML20":20,"OPTML25":25,"OPTML50":50}'::jsonb);
  it jsonb; v_out jsonb := '[]'::jsonb; v_sub numeric := 0; v_ok boolean := true; v_note text := '';
  v_pack int; v_qty int; v_line numeric; v_amount numeric; pr record;
  v_pct numeric; v_disc numeric := 0; v_after numeric; v_ship numeric; v_total numeric;
  v_client_total numeric; ex record; v_id text; n int; v_payid text; v_token uuid;
begin
  if v_ref !~ '^OPT-[A-Z0-9]{4,10}$' then return jsonb_build_object('ok',false,'error','bad_ref'); end if;
  if length(v_name) < 2 or length(v_phone_digits) not between 8 and 13 then return jsonb_build_object('ok',false,'error','details'); end if;
  if jsonb_typeof(v_items) <> 'array' or jsonb_array_length(v_items) not between 1 and 40 then return jsonb_build_object('ok',false,'error','items'); end if;
  if length(coalesce(p->>'message','')) > 8000 then return jsonb_build_object('ok',false,'error','too_long'); end if;
  begin v_client_total := round(coalesce((p->>'total')::numeric,0),2); exception when others then return jsonb_build_object('ok',false,'error','total'); end;
  -- flood guard
  select count(*) into n from public.web_orders where created_at > now() - interval '10 minutes';
  if n >= 40 then return jsonb_build_object('ok',false,'error','busy'); end if;

  -- re-price every line from the POS price list
  for it in select value from jsonb_array_elements(v_items) loop
    begin v_pack := coalesce((it->>'pack')::int,1); v_qty := coalesce((it->>'qty')::int,0); v_amount := round(coalesce((it->>'amount')::numeric,0),2);
    exception when others then return jsonb_build_object('ok',false,'error','items'); end;
    if v_pack not in (1,3,5,10) or v_qty not between 1 and 100 then return jsonb_build_object('ok',false,'error','items'); end if;
    select x.id, x.name, case v_pack when 1 then x.sell1 when 3 then x.sell3 when 5 then x.sell5 else x.sell10 end as price into pr
      from public.products x
     where not coalesce(x.hidden,false)
       and (upper(x.sku) = upper(coalesce(it->>'sku','')) or lower(x.name) = lower(coalesce(it->>'name','')))
     order by (upper(x.sku) = upper(coalesce(it->>'sku',''))) desc limit 1;
    if pr.id is null or pr.price is null or (v_pack = 10 and not v_wholesale) then
      v_ok := false; v_line := null; v_note := v_note || coalesce(it->>'name','?') || case when pr.id is null then ' isn''t on your list. ' else ' has no ' || v_pack || '-pack price. ' end;
    else
      v_line := pr.price * v_qty; v_sub := v_sub + v_line;
      if abs(v_line - v_amount) > 0.5 then v_ok := false; v_note := v_note || pr.name || ' was $' || v_amount || ', your list says $' || v_line || '. '; end if;
    end if;
    v_out := v_out || jsonb_build_array(jsonb_build_object('sku',left(coalesce(it->>'sku',''),12),'name',left(coalesce(it->>'name',''),80),'pack',v_pack,'qty',v_qty,'amount',v_amount,'product_id',pr.id,'list_amount',v_line));
  end loop;

  -- discount code, shipping, total (same rules as the price list)
  if v_code <> '' then
    v_pct := (v_codes->>v_code)::numeric;
    if v_pct is null then v_ok := false; v_note := v_note || 'Code ' || v_code || ' isn''t a valid code. ';
    else v_disc := round(v_sub * v_pct / 100); end if;
  end if;
  v_after := greatest(0, v_sub - v_disc);
  v_ship := case when v_country = 'NZ' then (case when p->>'nz_ship' = 'express' then 25 else 20 end) when v_after >= 200 then 0 else 15 end;
  v_total := v_after + v_ship;
  if abs(v_total - v_client_total) > 0.5 then v_ok := false; v_note := v_note || 'Total was $' || v_client_total || ', your prices make it $' || v_total || '. '; end if;

  -- same ref = the customer changed and resent it; a ref reused a day after it was dealt with = a new order
  select * into ex from public.web_orders where ref = v_ref order by created_at desc limit 1;
  if found and not (ex.status in ('accepted','dismissed') and ex.updated_at < now() - interval '24 hours') then
    -- a checkout still being filled in never touches an order that's already placed, or one you've dismissed
    if v_draft and ex.status <> 'started' then return jsonb_build_object('ok',true,'id',ex.id,'ref',v_ref,'kept',true); end if;
    if ex.revisions + ex.draft_saves >= (case when v_draft or ex.status = 'started' then 400 else 50 end) then return jsonb_build_object('ok',false,'error','too_many'); end if;
    v_id := ex.id;
    update public.web_orders set
      status = case when v_draft then 'started' when ex.status = 'accepted' then 'changed' when ex.status in ('dismissed','started') then 'new' else ex.status end,
      wholesale = v_wholesale, name = v_name, phone = left(btrim(p->>'phone'),20), email = left(btrim(coalesce(p->>'email','')),120),
      street = left(btrim(coalesce(p->>'street','')),160), suburb = left(btrim(coalesce(p->>'suburb','')),80), region = left(btrim(coalesce(p->>'region','')),40),
      postcode = left(btrim(coalesce(p->>'postcode','')),10), country = v_country, notes = left(btrim(coalesce(p->>'notes','')),500), code = v_code,
      items = v_out, subtotal = round(coalesce((p->>'subtotal')::numeric,0),2), discount = round(coalesce((p->>'discount')::numeric,0),2),
      shipping = round(coalesce((p->>'shipping')::numeric,0),2), total = v_client_total, list_total = v_total, price_ok = v_ok, price_note = nullif(btrim(v_note),''),
      message = left(coalesce(p->>'message',''),8000),
      revisions = case when v_draft then ex.revisions when ex.status = 'started' then 1 else ex.revisions + 1 end,
      draft_saves = ex.draft_saves + case when v_draft then 1 else 0 end, updated_at = now()
    where id = ex.id
    returning upload_token into v_token;
  else
    v_id := v_ref;
    if found then select count(*) + 1 into n from public.web_orders where ref = v_ref; v_id := v_ref || '-' || n; end if;
    insert into public.web_orders(id, ref, status, wholesale, name, phone, email, street, suburb, region, postcode, country, notes, code, items,
      subtotal, discount, shipping, total, list_total, price_ok, price_note, message)
    values (v_id, v_ref, case when v_draft then 'started' else 'new' end, v_wholesale, v_name, left(btrim(p->>'phone'),20), left(btrim(coalesce(p->>'email','')),120),
      left(btrim(coalesce(p->>'street','')),160), left(btrim(coalesce(p->>'suburb','')),80), left(btrim(coalesce(p->>'region','')),40),
      left(btrim(coalesce(p->>'postcode','')),10), v_country, left(btrim(coalesce(p->>'notes','')),500), v_code, v_out,
      round(coalesce((p->>'subtotal')::numeric,0),2), round(coalesce((p->>'discount')::numeric,0),2), round(coalesce((p->>'shipping')::numeric,0),2),
      v_client_total, v_total, v_ok, nullif(btrim(v_note),''), left(coalesce(p->>'message',''),8000))
    returning upload_token into v_token;
  end if;
  v_payid := coalesce(nullif((select value->>'payid' from public.settings where key='intel'),''), '0408769377');
  return jsonb_build_object('ok',true,'id',v_id,'ref',v_ref,'payid',v_payid,'total',v_total,'price_ok',v_ok,'token',v_token);
end $$;
revoke all on function public.submit_web_order(jsonb) from public;
grant execute on function public.submit_web_order(jsonb) to anon, authenticated;

-- payment screenshots the customer adds on the pay page (shrunk JPEG as a data URL)
create table if not exists public.web_order_proofs(
  id bigint generated always as identity primary key,
  order_id text not null references public.web_orders(id) on delete cascade,
  image text not null,
  created_at timestamptz not null default now()
);
create index if not exists web_order_proofs_order_idx on public.web_order_proofs(order_id);
alter table public.web_order_proofs enable row level security;
drop policy if exists web_order_proofs_members on public.web_order_proofs;
create policy web_order_proofs_members on public.web_order_proofs for all using ((select public.is_member())) with check ((select public.is_member()));

create or replace function public.attach_payment_proof(p_id text, p_token uuid, p_image text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare w record; n int;
begin
  select id, proof_count into w from public.web_orders where id = p_id and upload_token = p_token;
  if not found then return jsonb_build_object('ok',false,'error','not_found'); end if;
  if p_image !~ '^data:image/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$' or length(p_image) > 3000000 then return jsonb_build_object('ok',false,'error','image'); end if;
  select count(*) into n from public.web_order_proofs where order_id = p_id;
  if n >= 5 then return jsonb_build_object('ok',false,'error','too_many'); end if;
  insert into public.web_order_proofs(order_id, image) values (p_id, p_image);
  update public.web_orders set proof_at = now(), proof_count = n + 1, updated_at = now() where id = p_id;
  return jsonb_build_object('ok',true);
end $$;
revoke all on function public.attach_payment_proof(text, uuid, text) from public;
grant execute on function public.attach_payment_proof(text, uuid, text) to anon, authenticated;

-- Telegram alert to your own chat (settings.telegram.alert_chat) for each new or changed web order (not for checkouts still in progress)
create or replace function public.web_order_alert() returns trigger
language plpgsql security definer set search_path = public as $$
declare tg jsonb; v_lines text; v_msg text;
begin
  if TG_OP = 'UPDATE' and NEW.message is not distinct from OLD.message and NEW.proof_at is not distinct from OLD.proof_at and NEW.status is not distinct from OLD.status then return NEW; end if;
  if NEW.status not in ('new','changed') then return NEW; end if;   -- nothing for a checkout that's still being filled in
  select value into tg from public.settings where key = 'telegram';
  if coalesce(tg->>'token','') = '' or coalesce(tg->>'alert_chat','') = '' then return NEW; end if;
  select string_agg((i->>'qty') || '× ' || (i->>'name') || case when (i->>'pack')::int > 1 then ' (' || (i->>'pack') || '-pack)' else '' end, E'\n')
    into v_lines from jsonb_array_elements(NEW.items) i;
  v_msg := case when TG_OP = 'INSERT' or OLD.status in ('started','dismissed') then '🛒 New web order (pending payment) ' when NEW.proof_at is distinct from OLD.proof_at then '💸 Payment screenshot received for ' else '✏️ Web order changed ' end || NEW.id
    || case when NEW.wholesale then ' (wholesale)' else '' end || E'\n'
    || coalesce(NEW.name,'') || ' · ' || coalesce(NEW.phone,'') || E'\n\n' || coalesce(v_lines,'')
    || E'\n\nTotal $' || to_char(NEW.total,'FM999990.00')
    || case when not NEW.price_ok then E'\n⚠️ Check prices: ' || coalesce(NEW.price_note,'') else '' end
    || E'\n\nOpen the POS to reply and make the sale: https://optml-crm.vercel.app';
  perform net.http_post(url := 'https://api.telegram.org/bot' || (tg->>'token') || '/sendMessage',
    body := jsonb_build_object('chat_id', tg->>'alert_chat', 'text', v_msg, 'disable_web_page_preview', true),
    headers := '{"Content-Type":"application/json"}'::jsonb);
  return NEW;
exception when others then return NEW;  -- an alert problem never blocks an order
end $$;
revoke all on function public.web_order_alert() from public, anon, authenticated;
drop trigger if exists trg_web_order_alert on public.web_orders;
create trigger trg_web_order_alert after insert or update on public.web_orders for each row execute function public.web_order_alert();
