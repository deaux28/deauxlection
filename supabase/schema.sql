-- Deauxlection schema. Run once in the Supabase SQL editor.

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
