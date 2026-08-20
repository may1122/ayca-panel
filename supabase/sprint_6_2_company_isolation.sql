-- =========================================================
-- AYÇA Insight - Sprint 6.2
-- Company / User Isolation
-- =========================================================

-- ---------------------------------------------------------
-- 1. FILE_UPLOADS
-- ---------------------------------------------------------

alter table public.file_uploads enable row level security;

drop policy if exists file_uploads_select_own_company on public.file_uploads;
create policy file_uploads_select_own_company
on public.file_uploads
for select
using (
  public.is_admin()
  or (
    user_id = auth.uid()
    and company_id in (
      select company_id
      from public.profiles
      where id = auth.uid()
    )
  )
);

drop policy if exists file_uploads_insert_own_company on public.file_uploads;
create policy file_uploads_insert_own_company
on public.file_uploads
for insert
with check (
  user_id = auth.uid()
  and company_id in (
    select company_id
    from public.profiles
    where id = auth.uid()
  )
);

-- ---------------------------------------------------------
-- 2. STORAGE
--
-- Dosya yolu:
-- company_id/inventory/...
-- company_id/sales/...
-- company_id/product/...
-- ---------------------------------------------------------

drop policy if exists pharmacy_files_select_own_company
on storage.objects;

create policy pharmacy_files_select_own_company
on storage.objects
for select
using (
  bucket_id = 'pharmacy-files'
  and (
    public.is_admin()
    or (storage.foldername(name))[1] = (
      select company_id::text
      from public.profiles
      where id = auth.uid()
    )
  )
);

drop policy if exists pharmacy_files_insert_own_company
on storage.objects;

create policy pharmacy_files_insert_own_company
on storage.objects
for insert
with check (
  bucket_id = 'pharmacy-files'
  and (storage.foldername(name))[1] = (
    select company_id::text
    from public.profiles
    where id = auth.uid()
  )
);

-- ---------------------------------------------------------
-- 3. UPDATE / DELETE
-- Kullanıcı kendi şirket klasöründeki dosyaları yönetebilir.
-- ---------------------------------------------------------

drop policy if exists pharmacy_files_update_own_company
on storage.objects;

create policy pharmacy_files_update_own_company
on storage.objects
for update
using (
  bucket_id = 'pharmacy-files'
  and (storage.foldername(name))[1] = (
    select company_id::text
    from public.profiles
    where id = auth.uid()
  )
);

drop policy if exists pharmacy_files_delete_own_company
on storage.objects;

create policy pharmacy_files_delete_own_company
on storage.objects
for delete
using (
  bucket_id = 'pharmacy-files'
  and (
    public.is_admin()
    or (storage.foldername(name))[1] = (
      select company_id::text
      from public.profiles
      where id = auth.uid()
    )
  )
);
