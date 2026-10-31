-- Logos publics de boutique : les écritures passent exclusivement par l'action
-- serveur, qui valide type/taille et génère le chemin Storage.
insert into storage.buckets (id, name, public)
values ('vendor-logos', 'vendor-logos', true)
on conflict (id) do update set public = true;

drop policy if exists "vendor_logos_public_read" on storage.objects;
create policy "vendor_logos_public_read"
  on storage.objects for select
  using (bucket_id = 'vendor-logos');
