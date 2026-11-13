import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/profile";
import { getMyProduct } from "@/services/products/manage";
import { parseAmountToMinor, ZERO_MINOR, type CurrencyCode } from "@/lib/money";
import { formatPrice } from "@/components/marketplace/format";
import { notFound, redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";

/* eslint-disable @next/next/no-img-element -- L'aperçu accepte une URL signée temporaire. */
import { SubmitProductForm } from "@/components/submit-product-form";
import type { SellerProduct } from "@/services/products/manage";

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Brouillon",
  PENDING_REVIEW: "En cours de vérification",
  PUBLISHED: "Publié",
  REJECTED: "Modifications demandées",
  ARCHIVED: "Archivé",
};

const STATUS_VARIANTS: Record<
  string,
  "secondary" | "warning" | "default" | "destructive" | "outline"
> = {
  DRAFT: "secondary",
  PENDING_REVIEW: "warning",
  PUBLISHED: "default",
  REJECTED: "destructive",
  ARCHIVED: "outline",
};

function PreviewCover({
  thumbnailUrl,
  productStatus,
}: {
  thumbnailUrl: string | null;
  productStatus: string;
}) {
  const editable = productStatus === "DRAFT" || productStatus === "REJECTED";
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-xl font-semibold tracking-tight text-foreground">Couverture</h2>
      {thumbnailUrl ? (
        <img
          src={thumbnailUrl}
          alt="Aperçu du produit"
          className="h-64 w-full rounded-lg border object-cover"
        />
      ) : (
        <div className="flex h-64 w-full items-center justify-center rounded-lg border border-dashed border-muted-foreground/30 bg-muted">
          <div className="flex flex-col items-center gap-2">
            <span className="text-4xl" aria-hidden="true">
              🖼
            </span>
            <span className="text-sm text-muted-foreground">Aucune couverture</span>
          </div>
        </div>
      )}
      {!editable && (
        <Alert variant="info">
          <span className="font-semibold">
            {productStatus === "PENDING_REVIEW"
              ? "Produit en cours de vérification"
              : productStatus === "PUBLISHED"
                ? "Produit publié"
                : "Produit archivé"}
          </span>
          <p className="mt-1">
            {productStatus === "PENDING_REVIEW"
              ? "La couverture ne peut pas être modifiée pour le moment."
              : productStatus === "PUBLISHED"
                ? "Votre produit est visible sur SAVPAY."
                : "Ce produit est archivé."}
          </p>
        </Alert>
      )}
    </section>
  );
}

function PreviewInfo({ product }: { product: SellerProduct }) {
  const typeLabel =
    product.productType === "SERVICE"
      ? "Service"
      : product.productType === "DIGITAL"
        ? "Numérique"
        : "Physique";
  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-xl font-semibold tracking-tight text-foreground">Informations</h2>
      <div className="flex flex-col gap-2">
        <div>
          <p className="text-xs font-medium text-muted-foreground">Type</p>
          <p className="text-sm font-semibold text-foreground">{typeLabel}</p>
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground">Nom du produit</p>
          <p className="text-lg font-semibold text-foreground">{product.title}</p>
        </div>
        {product.shortDescription && (
          <div>
            <p className="text-xs font-medium text-muted-foreground">Résumé</p>
            <p className="text-sm text-foreground">{product.shortDescription}</p>
          </div>
        )}
        <div>
          <p className="text-xs font-medium text-muted-foreground">Catégorie</p>
          <p className="text-sm text-foreground">{product.categoryName ?? "Non sélectionnée"}</p>
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground">Prix</p>
          <p className="text-lg font-bold text-foreground">
            {formatPrice(product.price, product.currency)}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground">Devise</p>
          <p className="text-sm text-foreground">{product.currency}</p>
        </div>
        {product.description && (
          <div>
            <p className="text-xs font-medium text-muted-foreground">Description</p>
            <p className="text-sm whitespace-pre-wrap text-foreground">{product.description}</p>
          </div>
        )}
        {!product.description && (
          <div>
            <p className="text-xs font-medium text-muted-foreground">Description</p>
            <p className="text-sm text-destructive">Non renseignée</p>
          </div>
        )}
      </div>
    </section>
  );
}

function PreviewChecklist({ product }: { product: SellerProduct }) {
  const checks = [
    { label: "Nom du produit", ok: !!(product.title && product.title.length >= 3) },
    { label: "Catégorie", ok: !!product.categoryId },
    {
      label: "Prix valide",
      ok: (() => {
        try {
          return parseAmountToMinor(product.price, product.currency as CurrencyCode) > ZERO_MINOR;
        } catch {
          return false;
        }
      })(),
    },
    { label: "Devise", ok: ["USD", "CDF"].includes(product.currency) },
    ...(product.productType === "PHYSICAL" || product.productType === "DIGITAL"
      ? [{ label: "Couverture", ok: !!product.thumbnailPath }]
      : []),
    ...(product.productType === "DIGITAL"
      ? [{ label: "Fichier numérique", ok: product.hasFile }]
      : []),
  ];
  const allOk = checks.every((c) => c.ok);

  return (
    <Card variant="bordered">
      <CardContent className="flex flex-col gap-3 p-4">
        <h2 className="text-lg font-semibold tracking-tight text-foreground">
          Vérification finale
        </h2>
        <div className="flex flex-col gap-2">
          {checks.map((c) => (
            <div key={c.label} className="flex items-center gap-2 text-sm">
              <span
                className={c.ok ? "text-emerald-600" : "text-muted-foreground"}
                aria-hidden="true"
              >
                {c.ok ? "✓" : "⚠"}
              </span>
              <span className={c.ok ? "text-foreground" : "text-muted-foreground"}>{c.label}</span>
            </div>
          ))}
        </div>
        {allOk ? (
          <Alert variant="success">Votre produit est prêt à être envoyé en vérification.</Alert>
        ) : (
          <Alert variant="warning">
            <span className="font-semibold">Votre produit n&apos;est pas encore prêt.</span>
            <p className="mt-1">Complétez les éléments manquants avant de l&apos;envoyer.</p>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}

function ProductStatusBanner({ product }: { product: SellerProduct }) {
  if (product.status === "PENDING_REVIEW") {
    return (
      <Alert variant="info">
        <span className="font-semibold">Produit en cours de vérification</span>
        <p className="mt-1">
          Votre produit a bien été envoyé. Notre équipe vérifie actuellement les informations avant
          sa publication.
        </p>
      </Alert>
    );
  }
  if (product.status === "REJECTED") {
    return (
      <Alert variant="warning">
        <span className="font-semibold">Modifications demandées</span>
        <p className="mt-1">Corrigez les points signalés puis soumettez à nouveau.</p>
        {product.rejectionReason && (
          <div className="mt-2 rounded-lg bg-background px-3 py-2 text-sm">
            <p className="text-xs font-medium text-muted-foreground">Retour de l&apos;équipe :</p>
            <p className="mt-1 text-foreground">{product.rejectionReason}</p>
          </div>
        )}
      </Alert>
    );
  }
  if (product.status === "PUBLISHED") {
    return (
      <Alert variant="info">
        <span className="font-semibold">Produit publié</span>
        <p className="mt-1">Votre produit est actuellement disponible sur SAVPAY.</p>
      </Alert>
    );
  }
  if (product.status === "ARCHIVED") {
    return (
      <Alert variant="info">
        <span className="font-semibold">Produit archivé</span>
        <p className="mt-1">Votre produit est archivé.</p>
      </Alert>
    );
  }
  return null;
}

export default async function PreviewProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const current = await getCurrentProfile();

  if (current.kind !== "ok" || current.profile.status !== "ACTIVE") {
    redirect("/vendor");
  }

  const supabase = await createSupabaseServerClient();
  const { data: vendor } = await supabase
    .from("vendors")
    .select("id")
    .eq("user_id", current.profile.id)
    .eq("status", "ACTIVE")
    .maybeSingle();
  if (vendor === null) {
    notFound();
  }
  const product = await getMyProduct(supabase, id, vendor.id);
  if (product === null) {
    notFound();
  }

  let thumbnailUrl: string | null = product.thumbnailUrl;
  if (!thumbnailUrl && product.thumbnailPath) {
    try {
      const res = await fetch(`/api/products/${id}/cover`);
      if (res.ok) {
        const data = await res.json();
        thumbnailUrl = data.thumbnailUrl ?? null;
      }
    } catch {
      // fallback
    }
  }

  const canSubmit = product.status === "DRAFT" || product.status === "REJECTED";

  return (
    <div className="mx-auto flex max-w-5xl flex-1 flex-col gap-6 px-4 py-6 lg:px-6 lg:py-8">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <Link
            href={`/vendor/catalogue/${id}/edit`}
            className="text-sm text-primary hover:underline"
          >
            ← Retour à l&apos;édition
          </Link>
          <Badge variant="secondary">Prévisualisation</Badge>
          <Badge variant={STATUS_VARIANTS[product.status] ?? "secondary"}>
            {STATUS_LABELS[product.status] ?? product.status}
          </Badge>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Aperçu de votre produit
        </h1>
      </div>

      <ProductStatusBanner product={product} />

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-4">
          <PreviewCover thumbnailUrl={thumbnailUrl} productStatus={product.status} />
          <PreviewInfo product={product} />
        </div>

        <div className="flex flex-col gap-4">
          <PreviewChecklist product={product} />

          {canSubmit && (
            <SubmitProductForm
              productId={id}
              productTitle={product.title}
            />
          )}

          {!canSubmit && product.status === "PENDING_REVIEW" && (
            <Alert variant="info">
              <span className="font-semibold">En attente de validation</span>
              <p className="mt-1">Aucune action requise pour le moment.</p>
            </Alert>
          )}

          {!canSubmit && product.status === "PUBLISHED" && (
            <Button asChild className="w-full" size="lg">
              <a href={`/produit/${encodeURIComponent(product.slug)}`}>Voir le produit</a>
            </Button>
          )}

          {!canSubmit && product.status === "ARCHIVED" && (
            <Alert variant="info">
              <span className="font-semibold">Archivé</span>
              <p className="mt-1">Aucune action disponible.</p>
            </Alert>
          )}
        </div>
      </div>
    </div>
  );
}
