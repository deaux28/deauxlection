-- Deauxlection schema. Run once in the Supabase SQL editor for a new project.
-- Already set up? Run only the files in supabase/migrations/ you haven't run yet.

create table if not exists public.items (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind        text not null check (kind in ('vinyl', 'book', 'quote')),
  data        jsonb not null default '{}'::jsonb,
  cover_path  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists items_user_kind_idx on public.items (user_id, kind, created_at desc);

alter table public.items enable row level security;

drop policy if exists "own items: read"   on public.items;
drop policy if exists "own items: insert" on public.items;
drop policy if exists "own items: update" on public.items;
drop policy if exists "own items: delete" on public.items;

create policy "own items: read"   on public.items for select to authenticated using (user_id = auth.uid());
create policy "own items: insert" on public.items for insert to authenticated with check (user_id = auth.uid());
create policy "own items: update" on public.items for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own items: delete" on public.items for delete to authenticated using (user_id = auth.uid());

-- Cover images. Public read so <img> tags work; writes limited to the owner's own folder.
insert into storage.buckets (id, name, public)
values ('covers', 'covers', true)
on conflict (id) do nothing;

drop policy if exists "covers: owner insert" on storage.objects;
drop policy if exists "covers: owner update" on storage.objects;
drop policy if exists "covers: owner delete" on storage.objects;

create policy "covers: owner insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'covers' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "covers: owner update" on storage.objects for update to authenticated
  using (bucket_id = 'covers' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "covers: owner delete" on storage.objects for delete to authenticated
  using (bucket_id = 'covers' and (storage.foldername(name))[1] = auth.uid()::text);


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
