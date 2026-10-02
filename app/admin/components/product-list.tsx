"use client";

/* eslint-disable @next/next/no-img-element -- Les URLs de couverture peuvent être signées et éphémères. */

import { useActionState, useTransition, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Alert } from "@/components/ui/alert";
import { EmptyState } from "@/components/ui/empty-state";
import { approveProductAction, rejectProductAction } from "@/app/actions/products";
import { type ProductFormState } from "@/lib/product-form-state";

interface ProductRow {
  id: string;
  title: string;
  slug: string;
  status: string;
  price: string;
  currency: string;
  thumbnailUrl: string | null;
  shortDescription: string | null;
  createdAt: string;
  category: { name: string; slug: string }[] | null;
  vendor: { store_name: string; slug: string }[] | null;
}

interface ProductListProps {
  products: ProductRow[];
}

const initialFormState: ProductFormState = { status: "idle", error: null, productId: null };

export function ProductList({ products }: ProductListProps) {
  const router = useRouter();
  const [approveState, approveFormAction, approvePending] = useActionState(
    async (prevState: ProductFormState, formData: FormData) => {
      const result = await approveProductAction(prevState, formData);
      return result;
    },
    initialFormState,
  );

  const [rejectState, rejectFormAction, rejectPending] = useActionState(
    async (prevState: ProductFormState, formData: FormData) => {
      const result = await rejectProductAction(prevState, formData);
      return result;
    },
    initialFormState,
  );

  const [modalOpen, setModalOpen] = useState(false);
  const [rejectingProductId, setRejectingProductId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const handleApproveSuccess = () => {
    startTransition(() => {
      router.refresh();
    });
  };

  const handleRejectSuccess = () => {
    startTransition(() => {
      setModalOpen(false);
      setRejectingProductId(null);
    });
    startTransition(() => {
      router.refresh();
    });
  };

  useEffect(() => {
    if (approveState.status === "success") {
      handleApproveSuccess();
    }
    if (rejectState.status === "success") {
      handleRejectSuccess();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [approveState.status, rejectState.status]);

  const STATUS_LABELS: Record<string, string> = {
    DRAFT: "Brouillon",
    PENDING_REVIEW: "En cours de vérification",
    PUBLISHED: "Publié",
    REJECTED: "Modifications demandées",
    ARCHIVED: "Archivé",
  };

  const STATUS_VARIANTS: Record<
    string,
    "secondary" | "warning" | "success" | "destructive" | "outline"
  > = {
    DRAFT: "secondary",
    PENDING_REVIEW: "warning",
    PUBLISHED: "success",
    REJECTED: "destructive",
    ARCHIVED: "outline",
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("fr-FR", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const isPending = approvePending || rejectPending;

  if (products.length === 0) {
    return (
      <EmptyState
        icon={
          <span className="text-3xl" aria-hidden>
            🎉
          </span>
        }
        title="Tout est à jour"
        description="Il n'y a actuellement aucun produit en attente de vérification."
      />
    );
  }

  return (
    <>
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="hidden overflow-x-auto md:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Produit</TableHead>
                <TableHead>Vendeur</TableHead>
                <TableHead>Catégorie</TableHead>
                <TableHead>Prix</TableHead>
                <TableHead>Soumis le</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((product) => (
                <TableRow key={product.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      {product.thumbnailUrl && (
                        <img
                          src={product.thumbnailUrl}
                          alt={product.title}
                          className="h-10 w-10 rounded-lg object-cover"
                        />
                      )}
                      <span className="font-medium text-foreground">{product.title}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-muted-foreground">
                      {product.vendor?.[0]?.store_name ?? "—"}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="text-muted-foreground">
                      {product.category?.[0]?.name ?? "—"}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="text-foreground">
                      {product.price} {product.currency}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="text-muted-foreground">{formatDate(product.createdAt)}</span>
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANTS[product.status] ?? "secondary"}>
                      {STATUS_LABELS[product.status] ?? product.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <form action={approveFormAction} className="inline">
                        <input type="hidden" name="productId" value={product.id} />
                        <Button variant="success" size="sm" type="submit" disabled={isPending}>
                          {isPending ? "Envoi…" : "Approuver"}
                        </Button>
                      </form>
                      <Button
                        variant="destructive"
                        size="sm"
                        type="button"
                        onClick={() => {
                          setRejectingProductId(product.id);
                          setModalOpen(true);
                        }}
                      >
                        Refuser
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="flex flex-col gap-3 p-4 md:hidden">
          {products.map((product) => (
            <div key={product.id} className="rounded-lg border border-border p-4">
              <div className="flex items-start gap-3">
                {product.thumbnailUrl && (
                  <img
                    src={product.thumbnailUrl}
                    alt={product.title}
                    className="h-16 w-16 shrink-0 rounded-lg object-cover"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <h3 className="font-medium text-foreground">{product.title}</h3>
                  <p className="text-sm text-muted-foreground">
                    {product.vendor?.[0]?.store_name ?? "—"}
                  </p>
                  <div className="mt-1 flex items-center gap-2">
                    <Badge variant={STATUS_VARIANTS[product.status] ?? "secondary"}>
                      {STATUS_LABELS[product.status] ?? product.status}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {product.price} {product.currency}
                    </span>
                  </div>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <form action={approveFormAction} className="inline">
                  <input type="hidden" name="productId" value={product.id} />
                  <Button variant="success" size="sm" type="submit" disabled={isPending}>
                    {isPending ? "Envoi…" : "Approuver"}
                  </Button>
                </form>
                <Button
                  variant="destructive"
                  size="sm"
                  type="button"
                  onClick={() => {
                    setRejectingProductId(product.id);
                    setModalOpen(true);
                  }}
                >
                  Refuser
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <Modal
        open={modalOpen}
        onOpenChange={setModalOpen}
        title="Refuser ce produit"
        description="Indiquez au vendeur ce qu'il doit modifier avant de soumettre à nouveau son produit."
        size="sm"
        actions={
          <>
            <Button variant="outline" type="button" onClick={() => setModalOpen(false)}>
              Annuler
            </Button>
            <form action={rejectFormAction}>
              <input type="hidden" name="productId" value={rejectingProductId ?? ""} />
              <Button variant="destructive" size="sm" type="submit" disabled={isPending}>
                {isPending ? "Envoi…" : "Confirmer le refus"}
              </Button>
            </form>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          {rejectState.status === "error" && rejectState.error && (
            <Alert variant="error" title="Erreur">
              {rejectState.error}
            </Alert>
          )}
          {approveState.status === "success" && (
            <Alert variant="success" title="Succès">
              Produit publié avec succès.
            </Alert>
          )}
          {rejectState.status === "success" && (
            <Alert variant="success" title="Succès">
              Le produit a été refusé. Le vendeur peut maintenant le modifier.
            </Alert>
          )}
          <div>
            <label
              htmlFor="rejectionReason"
              className="mb-1 block text-sm font-medium text-foreground"
            >
              Motif du refus
            </label>
            <textarea
              id="rejectionReason"
              name="rejectionReason"
              placeholder="Exemple : Le prix est trop élevé, le fichier est manquant..."
              className="border-input w-full rounded-lg border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              rows={4}
              required
              minLength={5}
              maxLength={500}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Le motif doit contenir au moins 5 caractères.
          </p>
        </div>
      </Modal>
    </>
  );
}
