-- Share links: read-only public views of your collection.
-- Run this once in the Supabase SQL editor (it is also included in schema.sql for new projects).

create table if not exists public.shares (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  token        text not null unique check (char_length(token) >= 20),
  title        text not null default 'My collection',
  kinds        text[] not null default array['vinyl', 'book'] check (kinds <@ array['vinyl', 'book', 'quote'] and cardinality(kinds) > 0),
  show_prices  boolean not null default false,
  created_at   timestamptz not null default now()
);

alter table public.shares enable row level security;

drop policy if exists "own shares" on public.shares;
create policy "own shares" on public.shares for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- The only way a visitor reads anything: give a valid token, get back that owner's items of the shared kinds.
-- Prices are removed unless the link includes them. No other table or row is reachable.
create or replace function public.shared_collection(p_token text)
returns json
language sql
stable
security definer
set search_path = public
as $$
  select json_build_object(
    'title', s.title,
    'kinds', s.kinds,
    'items', coalesce((
      select json_agg(json_build_object(
        'id', i.id,
        'kind', i.kind,
        'data', case when s.show_prices then i.data else i.data - 'price' end,
        'cover_path', i.cover_path,
        'created_at', i.created_at,
        'updated_at', i.updated_at
      ) order by i.created_at desc)
      from public.items i
      where i.user_id = s.user_id and i.kind = any (s.kinds)
    ), '[]'::json)
  )
  from public.shares s
  where s.token = p_token and char_length(p_token) >= 20;
$$;

revoke all on function public.shared_collection(text) from public;
grant execute on function public.shared_collection(text) to anon, authenticated;
