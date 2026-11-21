-- Wishlist: records you want are stored in items with data.wish = true.
-- No new table is needed. This only keeps wishlist records out of share links.
-- Run once in the Supabase SQL editor (already included in schema.sql for new projects). Safe to run twice.

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
        and coalesce(i.data->>'wish', 'false') <> 'true'  -- wishlist records aren't shared
    ), '[]'::json)
  )
  from public.shares s
  where s.token = p_token and char_length(p_token) >= 20;
$$;

revoke all on function public.shared_collection(text) from public;
grant execute on function public.shared_collection(text) to anon, authenticated;
