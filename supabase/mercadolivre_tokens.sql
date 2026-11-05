-- Execute este SQL no Editor SQL do Supabase.
-- Esta tabela guarda os tokens apenas no servidor; nunca exponha a chave service role no navegador.

create table if not exists public.mercadolivre_tokens (
  id integer primary key check (id = 1),
  access_token text not null,
  refresh_token text not null,
  token_type text not null default 'Bearer',
  expires_at timestamptz not null,
  updated_at timestamptz not null default now()
);

alter table public.mercadolivre_tokens enable row level security;

-- Não crie políticas públicas para esta tabela.
-- O servidor acessa usando SUPABASE_SERVICE_ROLE_KEY, guardada nas variáveis privadas do Netlify.
