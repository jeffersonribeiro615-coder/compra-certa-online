-- Compra Certa Online: estrutura compatível com app/page.tsx.
-- Pode ser executado mais de uma vez sem apagar produtos existentes.

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  title text,
  price numeric(12,2) not null default 0 check (price >= 0),
  category text not null default 'Outros',
  image_url text,
  affiliate_url text not null default '',
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Atualiza instalações antigas sem remover as colunas ou produtos anteriores.
alter table public.products add column if not exists title text;
alter table public.products add column if not exists price numeric(12,2) not null default 0;
alter table public.products add column if not exists category text not null default 'Outros';
alter table public.products add column if not exists image_url text;
alter table public.products add column if not exists affiliate_url text not null default '';
alter table public.products add column if not exists description text;
alter table public.products add column if not exists is_active boolean not null default true;
alter table public.products add column if not exists created_at timestamptz not null default now();


-- Compatibilidade com instalações antigas que exigiam name e store.
do $
begin
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='products' and column_name='name') then
    execute 'alter table public.products alter column name drop not null';
  end if;
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='products' and column_name='store') then
    execute 'alter table public.products alter column store drop not null';
  end if;
end $;

-- Se a versão antiga usava name/active, copia os dados para os campos atuais.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'products' and column_name = 'name'
  ) then
    execute 'update public.products set title = name where title is null or title = ''''';
  end if;
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'products' and column_name = 'active'
  ) then
    execute 'update public.products set is_active = active where active is not null';
  end if;
end $$;

alter table public.admin_users enable row level security;
alter table public.products enable row level security;

drop policy if exists "Admins can read own admin row" on public.admin_users;
create policy "Admins can read own admin row"
on public.admin_users for select to authenticated
using (user_id = auth.uid());

drop policy if exists "Anyone can read active products" on public.products;
drop policy if exists "Public can read active products" on public.products;
create policy "Public can read active products"
on public.products for select to anon, authenticated
using (is_active = true);

drop policy if exists "Only admins can insert products" on public.products;
create policy "Only admins can insert products"
on public.products for insert to authenticated
with check (exists (
  select 1 from public.admin_users a where a.user_id = auth.uid()
));

drop policy if exists "Only admins can update products" on public.products;
create policy "Only admins can update products"
on public.products for update to authenticated
using (exists (
  select 1 from public.admin_users a where a.user_id = auth.uid()
))
with check (exists (
  select 1 from public.admin_users a where a.user_id = auth.uid()
));

drop policy if exists "Only admins can delete products" on public.products;
create policy "Only admins can delete products"
on public.products for delete to authenticated
using (exists (
  select 1 from public.admin_users a where a.user_id = auth.uid()
));

-- Bucket público para exibir as fotos dos produtos.
insert into storage.buckets (id, name, public)
values ('produtos', 'produtos', true)
on conflict (id) do update set public = true;

drop policy if exists "Public can view product images" on storage.objects;
create policy "Public can view product images"
on storage.objects for select
using (bucket_id = 'produtos');

drop policy if exists "Admins can upload product images" on storage.objects;
create policy "Admins can upload product images"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'produtos'
  and exists (select 1 from public.admin_users a where a.user_id = auth.uid())
);

drop policy if exists "Admins can update product images" on storage.objects;
create policy "Admins can update product images"
on storage.objects for update to authenticated
using (
  bucket_id = 'produtos'
  and exists (select 1 from public.admin_users a where a.user_id = auth.uid())
)
with check (
  bucket_id = 'produtos'
  and exists (select 1 from public.admin_users a where a.user_id = auth.uid())
);

-- Depois de criar seu usuário em Authentication > Users, copie o UUID dele
-- e execute no SQL Editor, substituindo COLE_O_UUID:
-- insert into public.admin_users (user_id) values ('COLE_O_UUID');
