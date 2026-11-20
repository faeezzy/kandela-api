-- Skema Kandela untuk Supabase Postgres.
-- Jalankan sekali di Supabase Dashboard > SQL Editor (aman dijalankan ulang).
-- Semua tulisan dari aplikasi lewat service role di Vercel; RLS membatasi akses langsung dari klien.

-- ---------- tabel ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default 'Pemain',
  avatar_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.progress (
  user_id uuid primary key references auth.users (id) on delete cascade,
  xp int not null default 0 check (xp >= 0),
  streak int not null default 0 check (streak >= 0),
  last_day date,
  imported boolean not null default false, -- impor progres tamu hanya sekali
  updated_at timestamptz not null default now()
);

create table if not exists public.attempts (
  id bigserial primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  scenario_id text not null unique,
  dir text not null check (dir in ('beli', 'tahan', 'jual')),
  sl real not null check (sl between 0.5 and 5),
  tp real not null check (tp between 0.5 and 10),
  risk real not null check (risk between 0.5 and 5),
  total int not null,
  disc int not null,
  rr_score int not null,
  tech int not null,
  r real not null,
  created_at timestamptz not null default now()
);
create index if not exists attempts_user_created on public.attempts (user_id, created_at desc);

-- Token skenario yang sudah dipakai (tamu maupun login). Tidak menyimpan data pribadi.
create table if not exists public.used_tokens (
  id text primary key,
  used_at timestamptz not null default now()
);

-- ---------- Row Level Security ----------
alter table public.profiles enable row level security;
alter table public.progress enable row level security;
alter table public.attempts enable row level security;
alter table public.used_tokens enable row level security; -- tanpa policy: hanya service role

drop policy if exists "profil sendiri: baca" on public.profiles;
create policy "profil sendiri: baca" on public.profiles for select to authenticated using (auth.uid() = id);
drop policy if exists "profil sendiri: ubah" on public.profiles;
create policy "profil sendiri: ubah" on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "progres sendiri: baca" on public.progress;
create policy "progres sendiri: baca" on public.progress for select to authenticated using (auth.uid() = user_id);

drop policy if exists "latihan sendiri: baca" on public.attempts;
create policy "latihan sendiri: baca" on public.attempts for select to authenticated using (auth.uid() = user_id);
-- Tidak ada policy insert/update/delete untuk klien: skor hanya boleh ditulis server.

-- ---------- papan skor ----------
-- View ini sengaja berjalan dengan hak pemiliknya supaya bisa merata-rata semua pengguna,
-- tapi HANYA mengekspos display_name, level, dan rata-rata. Tidak ada email atau id.
drop view if exists public.leaderboard;
create view public.leaderboard as
select
  p.display_name,
  1 + floor(coalesce(pr.xp, 0) / 120.0)::int as level,
  round(avg(a.total))::int as avg_score
from public.attempts a
join public.profiles p on p.id = a.user_id
left join public.progress pr on pr.user_id = a.user_id
group by a.user_id, p.display_name, pr.xp
having count(*) >= 3
order by avg_score desc, level desc
limit 20;

revoke all on public.leaderboard from public;
grant select on public.leaderboard to anon, authenticated, service_role;

-- ---------- fungsi submit: satu transaksi ----------
-- Pakai token -> simpan attempt -> perbarui XP dan streak. Gagal di langkah mana pun = semua dibatalkan.
-- Pemakaian ganda token memicu unique_violation (23505).
create or replace function public.kandela_submit(
  p_user uuid, p_scenario text, p_dir text, p_sl real, p_tp real, p_risk real,
  p_total int, p_disc int, p_rr int, p_tech int, p_r real, p_xp int
) returns setof public.progress
language plpgsql security definer set search_path = public as $$
declare
  v_today date := (now() at time zone 'Asia/Jakarta')::date;
begin
  insert into used_tokens (id) values (p_scenario);
  if p_user is null then
    return; -- tamu: cukup tandai token terpakai
  end if;

  insert into attempts (user_id, scenario_id, dir, sl, tp, risk, total, disc, rr_score, tech, r)
  values (p_user, p_scenario, p_dir, p_sl, p_tp, p_risk, p_total, p_disc, p_rr, p_tech, p_r);

  return query
  insert into progress as pr (user_id, xp, streak, last_day, updated_at)
  values (p_user, p_xp, 1, v_today, now())
  on conflict (user_id) do update set
    xp = pr.xp + excluded.xp,
    streak = case
      when pr.last_day = v_today then greatest(pr.streak, 1)
      when pr.last_day = v_today - 1 then pr.streak + 1
      else 1 end,
    last_day = v_today,
    updated_at = now()
  returning pr.*;
end $$;

revoke all on function public.kandela_submit(uuid, text, text, real, real, real, int, int, int, int, real, int) from public, anon, authenticated;
grant execute on function public.kandela_submit(uuid, text, text, real, real, real, int, int, int, int, real, int) to service_role;

-- Bersihkan token lama sesekali (opsional, token kedaluwarsa setelah 15 menit):
-- delete from public.used_tokens where used_at < now() - interval '2 days';
