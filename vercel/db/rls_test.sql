-- Bukti RLS: pengguna A tidak bisa membaca attempts pengguna B.
-- Jalankan di Supabase SQL Editor SETELAH schema.sql. Semua di dalam transaksi lalu di-rollback,
-- jadi tidak meninggalkan data.
begin;

-- dua pengguna palsu
insert into auth.users (id, email, aud, role)
values ('00000000-0000-0000-0000-00000000000a', 'a@contoh.test', 'authenticated', 'authenticated'),
       ('00000000-0000-0000-0000-00000000000b', 'b@contoh.test', 'authenticated', 'authenticated');

select public.kandela_submit('00000000-0000-0000-0000-00000000000b', 'rls-test-b1', 'beli', 2, 4, 2, 80, 100, 100, 60, 1.5, 58);

-- berperan sebagai pengguna A
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);

-- Harus 0: A tidak melihat attempts/progres milik B
select 'attempts milik B terlihat oleh A' as cek, count(*) as harus_0 from public.attempts where user_id = '00000000-0000-0000-0000-00000000000b';
select 'progress milik B terlihat oleh A' as cek, count(*) as harus_0 from public.progress where user_id = '00000000-0000-0000-0000-00000000000b';

-- Harus gagal (permission denied): klien tidak boleh memanggil fungsi submit
-- select public.kandela_submit('00000000-0000-0000-0000-00000000000a', 'x', 'beli', 2, 4, 2, 80, 100, 100, 60, 1.5, 58);

-- Pemakaian ganda token -> error duplicate key (23505). Jalankan sebagai postgres untuk melihatnya:
reset role;
do $$ begin
  perform public.kandela_submit('00000000-0000-0000-0000-00000000000b', 'rls-test-b1', 'beli', 2, 4, 2, 80, 100, 100, 60, 1.5, 58);
  raise exception 'GAGAL: token dipakai dua kali tapi diterima';
exception when unique_violation then
  raise notice 'OK: pemakaian kedua ditolak (unique_violation)';
end $$;

rollback;
