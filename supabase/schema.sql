-- Execute este arquivo no SQL Editor do seu projeto Supabase.
create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  price numeric(12,2) not null check (price >= 0),
  store text not null check (store in ('Mercado Livre','Shopee')),
  category text not null default 'Outros',
  image_url text,
  affiliate_url text not null,
  description text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.admin_users enable row level security;
alter table public.products enable row level security;

drop policy if exists "Admins can read own admin row" on public.admin_users;
create policy "Admins can read own admin row"
on public.admin_users for select to authenticated
using (user_id = auth.uid());

drop policy if exists "Anyone can read active products" on public.products;
create policy "Anyone can read active products"
on public.products for select to anon, authenticated
using (active = true);

drop policy if exists "Only admins can insert products" on public.products;
create policy "Only admins can insert products"
on public.products for insert to authenticated
with check (exists (select 1 from public.admin_users a where a.user_id = auth.uid()));

drop policy if exists "Only admins can update products" on public.products;
create policy "Only admins can update products"
on public.products for update to authenticated
using (exists (select 1 from public.admin_users a where a.user_id = auth.uid()))
with check (exists (select 1 from public.admin_users a where a.user_id = auth.uid()));

drop policy if exists "Only admins can delete products" on public.products;
create policy "Only admins can delete products"
on public.products for delete to authenticated
using (exists (select 1 from public.admin_users a where a.user_id = auth.uid()));

-- Depois de criar seu usuário em Authentication > Users, copie o UUID dele
-- e execute esta linha substituindo COLE_O_UUID:
-- insert into public.admin_users (user_id) values ('COLE_O_UUID');
