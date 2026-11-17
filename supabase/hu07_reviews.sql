-- HU-07: opiniones y testimonios de servicios en Reservia
-- Ejecutar en Supabase SQL Editor sobre la base de datos existente.
-- No elimina ni modifica reservas ni perfiles.

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null unique references public.appointments(id) on delete cascade,
  service_id uuid not null references public.services(id) on delete cascade,
  client_id uuid not null references public.profiles(id) on delete cascade,
  client_name text not null,
  rating int not null check (rating between 1 and 5),
  comment text not null check (char_length(trim(comment)) between 5 and 1000),
  created_at timestamptz not null default now()
);

create index if not exists idx_reviews_service_created
  on public.reviews(service_id, created_at desc);

alter table public.reviews enable row level security;

drop policy if exists "Opiniones visibles publicamente" on public.reviews;
create policy "Opiniones visibles publicamente"
  on public.reviews for select using (true);

drop policy if exists "Clientes califican sus reservas completadas" on public.reviews;
create policy "Clientes califican sus reservas completadas"
  on public.reviews for insert
  to authenticated
  with check (
    auth.uid() = client_id
    and exists (
      select 1
      from public.appointments a
      where a.id = reviews.appointment_id
        and a.service_id = reviews.service_id
        and a.client_id = auth.uid()
        and a.status <> 'CANCELLED'
        and (a.date + a.time + a.duration_minutes * interval '1 minute') <= now()
    )
  );

create or replace function public.refresh_service_review_stats()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_service_id uuid;
begin
  target_service_id := coalesce(new.service_id, old.service_id);

  update public.services s
  set
    review_count = stats.total_reviews,
    rating = case
      when stats.total_reviews = 0 then 0.0
      else round(stats.average_rating, 1)
    end
  from (
    select count(*)::int as total_reviews, coalesce(avg(rating), 0)::numeric as average_rating
    from public.reviews
    where service_id = target_service_id
  ) stats
  where s.id = target_service_id;

  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_refresh_service_review_stats on public.reviews;
create trigger trg_refresh_service_review_stats
after insert or update or delete on public.reviews
for each row execute function public.refresh_service_review_stats();

-- Recalcular los valores actuales sin inventar opiniones.
update public.services s
set
  review_count = stats.total_reviews,
  rating = case when stats.total_reviews = 0 then 0.0 else round(stats.average_rating, 1) end
from (
  select service_id, count(*)::int as total_reviews, avg(rating)::numeric as average_rating
  from public.reviews
  group by service_id
) stats
where s.id = stats.service_id;

update public.services s
set rating = 0.0, review_count = 0
where not exists (select 1 from public.reviews r where r.service_id = s.id);

grant select on public.reviews to anon, authenticated;
grant insert on public.reviews to authenticated;

notify pgrst, 'reload schema';
