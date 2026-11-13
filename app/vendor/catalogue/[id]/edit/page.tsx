import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/profile";
import {
  listCategories,
  getMyProduct,
  type SellerProduct,
  checkProductCompletion,
  listProductFiles,
} from "@/services/products/manage";
import { parseAmountToMinor, ZERO_MINOR, type CurrencyCode } from "@/lib/money";
import { ProductForm } from "@/components/product-form";
import { ProductFileUpload } from "@/components/product-file-upload";
import { CoverImageUpload } from "@/components/cover-image-upload";
import { SubmitProductForm } from "@/components/submit-product-form";
import { notFound, redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";

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

function CompletionSummary({ product }: { product: SellerProduct }) {
  const checks = [
    { label: "Informations", ok: checkProductCompletion(product) },
    ...(product.productType === "PHYSICAL" || product.productType === "DIGITAL"
      ? [{ label: "Couverture", ok: !!product.thumbnailPath }]
      : []),
    ...(product.productType === "DIGITAL"
      ? [{ label: "Fichier numérique", ok: product.hasFile }]
      : []),
  ];

  const allOk = checks.every((c) => c.ok);

  let priceValid = false;
  try {
    priceValid = parseAmountToMinor(product.price, product.currency as CurrencyCode) > ZERO_MINOR;
  } catch {
    /* prix invalide */
  }
  const missing: string[] = [];
  if (!product.title || product.title.length < 3) missing.push("un titre d'au moins 3 caractères");
  if (!product.currency || !["USD", "CDF"].includes(product.currency))
    missing.push("une devise valide (USD ou CDF)");
  if (!product.categoryId) missing.push("une catégorie");
  if (!product.price || !priceValid) missing.push("un prix supérieur à 0");
  if (
    (product.productType === "PHYSICAL" || product.productType === "DIGITAL") &&
    !product.thumbnailPath
  )
    missing.push("une image de couverture");
  if (product.productType === "DIGITAL" && !product.hasFile) missing.push("un fichier numérique");

  return (
    <Card variant="bordered">
      <CardContent className="flex flex-col gap-3 p-4 sm:p-6">
        <h2 className="text-lg font-semibold tracking-tight text-foreground">Votre produit</h2>
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
          <Alert variant="success">
            Tous les champs requis sont remplis. Vous pouvez soumettre à la validation.
          </Alert>
        ) : missing.length > 0 ? (
          <Alert variant="warning">
            Il manque encore :
            <ul className="mt-1 list-inside list-disc">
              {missing.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          </Alert>
        ) : null}
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
      </Alert>
    );
  }
  if (product.status === "PUBLISHED") {
    return (
      <Alert variant="info">
        <span className="font-semibold">Publié</span>
        <p className="mt-1">Votre produit est actuellement visible sur SAVPAY.</p>
      </Alert>
    );
  }
  if (product.status === "ARCHIVED") {
    return (
      <Alert variant="info">
        <span className="font-semibold">Archivé</span>
        <p className="mt-1">Votre produit est archivé.</p>
      </Alert>
    );
  }
  return null;
}

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
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

  const categories = await listCategories(supabase);
  const existingFiles = await listProductFiles(supabase, id);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-4 py-8 lg:px-8 lg:py-10">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-2">
        <div className="flex items-center gap-3">
          <Link href="/vendor/catalogue" className="text-sm text-primary hover:underline">
            ← Retour au catalogue
          </Link>
          <Badge variant={STATUS_VARIANTS[product.status] ?? "secondary"}>
            {STATUS_LABELS[product.status] ?? product.status}
          </Badge>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Modifier : {product.title}
        </h1>
        <div className="flex items-center gap-2">
          <Badge variant="outline">
            {product.productType === "SERVICE"
              ? "Service"
              : product.productType === "DIGITAL"
                ? "Numérique"
                : "Physique"}
          </Badge>
          <Link
            href={`/vendor/catalogue/${id}/preview`}
            className="text-sm text-primary hover:underline"
          >
            👁 Aperçu public
          </Link>
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <ProductStatusBanner product={product} />

        <section className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-7">
          <ProductForm
            initialProduct={{
              id: product.id,
              slug: product.slug,
              title: product.title,
              shortDescription: product.shortDescription ?? "",
              description: product.description ?? "",
              price: product.price,
              currency: product.currency,
              categoryId: product.categoryId ?? "",
              thumbnailUrl: product.thumbnailUrl ?? "",
              thumbnailPath: product.thumbnailPath,
              productType: product.productType,
            }}
            categories={categories}
          />
        </section>

        <section className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-7">
          <h2 className="text-lg font-semibold text-foreground">Médias du produit</h2>
          <div className="mt-5 flex flex-col gap-6">
            <div className="border-b border-border pb-6">
              <h3 className="text-base font-semibold text-foreground">Photo de couverture</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Cette image est affichée dans le catalogue et sur la page du produit.
              </p>
              <div className="mt-4">
                <CoverImageUpload
                  productId={product.id}
                  currentThumbnailPath={product.thumbnailPath}
                  currentThumbnailUrl={product.thumbnailUrl}
                  productStatus={product.status}
                />
              </div>
            </div>
            <div>
              <h3 className="text-base font-semibold text-foreground">Fichier à télécharger</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                C&apos;est le fichier que l&apos;acheteur recevra après le paiement.
              </p>
              <div className="mt-4">
                <ProductFileUpload
                  productId={product.id}
                  productStatus={product.status}
                  existingFiles={existingFiles}
                />
              </div>
            </div>
          </div>
        </section>

        <CompletionSummary product={product} />

        {product.status === "DRAFT" && (
          <section className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-7">
            <SubmitProductForm productId={id} productTitle={product.title} />
          </section>
        )}
      </div>
    </div>
  );
}
