-- Le vendeur peut supprimer uniquement ses produits sans commande associée.
-- Les ventes conservent ainsi leurs snapshots et leurs droits de téléchargement.
create policy "products_delete_own_without_orders_or_admin"
  on public.products for delete
  using (
    public.is_admin()
    or (
      exists (
        select 1
        from public.vendors v
        where v.id = products.vendor_id
          and v.user_id = auth.uid()
          and v.status = 'ACTIVE'
      )
      and not exists (
        select 1
        from public.order_items oi
        where oi.product_id = products.id
      )
    )
  );
