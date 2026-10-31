"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createProductAction, updateProductAction } from "@/app/actions/products";
import { initialProductFormState, type ProductFormState } from "@/lib/product-form-state";
import { InputField, TextareaField, SelectField } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";

const STEPS = ["Informations", "Description", "Tarification", "Téléversement"];
const STEP_SUBTITLES = [
  "Dites-nous en plus sur ce que vous voulez vendre !",
  "Décrivez votre produit à vos clients !",
  "Comment voulez-vous le vendre ?",
  "Téléchargez votre produit",
];

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

function uploadWithProgress(url: string, file: File, onProgress: (progress: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("POST", url);
    request.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    });
    request.addEventListener("error", () =>
      reject(new Error("Erreur réseau pendant le téléversement.")),
    );
    request.addEventListener("load", () => {
      if (request.status >= 200 && request.status < 300) {
        resolve();
        return;
      }
      try {
        const body = JSON.parse(request.responseText) as { error?: string };
        reject(new Error(body.error ?? "Téléversement refusé."));
      } catch {
        reject(new Error("Téléversement refusé."));
      }
    });
    const formData = new FormData();
    formData.set("file", file);
    request.send(formData);
  });
}

function UploadProgress({ label, progress }: { label: string; progress: number }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-4 text-sm">
        <span className="font-medium text-foreground">{label}</span>
        <span className="shrink-0 text-muted-foreground">{progress}%</span>
      </div>
      <div
        className="h-2 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progress}
      >
        <div
          className="h-full rounded-full bg-primary transition-[width]"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

interface ProductFormProps {
  initialProduct?: {
    id?: string;
    title: string;
    slug: string;
    shortDescription: string;
    description: string;
    price: string;
    currency: string;
    categoryId: string;
    thumbnailUrl?: string;
    thumbnailPath: string | null;
    productType?: string;
  };
  categories: { id: string; name: string }[];
}

const PRODUCT_TYPES = [
  {
    value: "DIGITAL",
    label: "Produit numérique",
    description: "Un fichier téléchargeable immédiatement après achat.",
    icon: (
      <svg
        className="h-8 w-8"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
        />
      </svg>
    ),
  },
];

export function ProductForm({ initialProduct, categories }: ProductFormProps) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(
    (previousState: ProductFormState, data: FormData) =>
      data.get("productId")
        ? updateProductAction(previousState, data)
        : createProductAction(previousState, data),
    initialProductFormState,
  );
  const [step, setStep] = useState(1);
  const [productType, setProductType] = useState("DIGITAL");
  const [formValues, setFormValues] = useState({
    title: initialProduct?.title ?? "",
    shortDescription: initialProduct?.shortDescription ?? "",
    description: initialProduct?.description ?? "",
    // La base impose un prix strictement positif, même pour un brouillon.
    // Ce montant technique est remplacé à l'étape de facturation.
    price: initialProduct?.price ?? "0.01",
    currency: initialProduct?.currency ?? "USD",
    categoryId: initialProduct?.categoryId ?? categories[0]?.id ?? "",
  });
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [productFiles, setProductFiles] = useState<File[]>([]);
  const [coverPreviewUrl, setCoverPreviewUrl] = useState<string | null>(null);
  const [coverUploadProgress, setCoverUploadProgress] = useState<number | null>(null);
  const [fileUploadProgress, setFileUploadProgress] = useState<number | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadAttempt, setUploadAttempt] = useState(0);
  const [billingType, setBillingType] = useState<"ONE_TIME" | "OPEN">("ONE_TIME");
  const [promoPrice, setPromoPrice] = useState("");
  const titleInputRef = useRef<HTMLInputElement>(null);
  const hasFinalizedRef = useRef(false);
  const coverPreviewUrlRef = useRef<string | null>(null);
  const coverUploadedRef = useRef(false);
  const uploadedFileIndexesRef = useRef(new Set<number>());

  const productId = state.productId;
  const isEdit = initialProduct !== undefined;
  const isNewProduct = !isEdit;
  const isCreated = state.status === "success" && !!productId && isNewProduct;

  useEffect(() => {
    if (state.status === "error" && state.error) {
      titleInputRef.current?.focus();
    }
  }, [state.status, state.error]);

  useEffect(
    () => () => {
      if (coverPreviewUrlRef.current !== null) URL.revokeObjectURL(coverPreviewUrlRef.current);
    },
    [],
  );

  function selectCoverFile(file: File | null) {
    if (coverPreviewUrlRef.current !== null) URL.revokeObjectURL(coverPreviewUrlRef.current);
    const nextPreviewUrl = file === null ? null : URL.createObjectURL(file);
    coverPreviewUrlRef.current = nextPreviewUrl;
    setCoverPreviewUrl(nextPreviewUrl);
    setCoverFile(file);
  }

  useEffect(() => {
    if (isCreated && step === 4 && productId && !hasFinalizedRef.current) {
      hasFinalizedRef.current = true;
      void (async () => {
        try {
          setUploadError(null);
          if (coverFile && !coverUploadedRef.current) {
            setCoverUploadProgress(0);
            await uploadWithProgress(
              `/api/products/${productId}/cover`,
              coverFile,
              setCoverUploadProgress,
            );
            coverUploadedRef.current = true;
          }
          for (let index = 0; index < productFiles.length; index += 1) {
            const productFile = productFiles[index];
            if (productFile === undefined || uploadedFileIndexesRef.current.has(index)) continue;
            await uploadWithProgress(
              `/api/products/${productId}/files`,
              productFile,
              (progress) => {
                setFileUploadProgress(
                  Math.round(((index + progress / 100) / productFiles.length) * 100),
                );
              },
            );
            uploadedFileIndexesRef.current.add(index);
          }
          setIsPublishing(true);
          const publication = await fetch(`/api/products/${productId}/publish`, { method: "POST" });
          if (!publication.ok) {
            const body = (await publication.json()) as { error?: string };
            throw new Error(body.error ?? "Publication impossible.");
          }
          router.replace("/vendor/catalogue");
        } catch (error) {
          hasFinalizedRef.current = false;
          setIsPublishing(false);
          setUploadError(error instanceof Error ? error.message : "Téléversement impossible.");
        }
      })();
    }
  }, [coverFile, isCreated, productFiles, productId, router, step, uploadAttempt]);

  const isShowCover = true;
  const isShowFile = true;

  return (
    <>
      {isEdit ? (
        <div className="flex w-full max-w-none flex-col gap-6">
          <Alert variant="info">
            <span className="font-semibold">Modification du produit</span>
            <p className="mt-1">Les modifications sont enregistrées immédiatement.</p>
          </Alert>
          <form action={formAction} className="flex w-full max-w-none flex-col gap-6">
            <input type="hidden" name="productId" value={initialProduct.id} />
            <input type="hidden" name="productType" value={productType} />
            <InputField
              ref={titleInputRef}
              label="Nom du produit"
              name="title"
              defaultValue={initialProduct.title}
              required
              maxLength={150}
              error={state.status === "error" && state.error ? { message: state.error } : undefined}
            />
            <TextareaField
              label="Résumé"
              name="shortDescription"
              defaultValue={initialProduct.shortDescription ?? ""}
              maxLength={300}
              rows={2}
            />
            <TextareaField
              label="Description"
              name="description"
              defaultValue={initialProduct.description ?? ""}
              maxLength={5000}
              rows={5}
            />
            <div className="grid grid-cols-2 gap-4">
              <InputField
                label="Prix"
                name="price"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0.01"
                defaultValue={initialProduct.price ?? ""}
                required
                placeholder="0.00"
              />
              <SelectField
                label="Devise"
                name="currency"
                defaultValue={initialProduct.currency ?? "USD"}
                required
                options={[
                  { value: "USD", label: "USD (Dollar américain)" },
                  { value: "CDF", label: "CDF (Franc congolais)" },
                ]}
              />
            </div>
            <SelectField
              label="Catégorie"
              name="categoryId"
              defaultValue={initialProduct.categoryId ?? ""}
              required
              options={categories.map((cat) => ({ value: cat.id, label: cat.name }))}
            />
            {state.status === "error" && state.error && (
              <Alert variant="error">{state.error}</Alert>
            )}
            {state.status === "success" && <Alert variant="success">Produit mis à jour.</Alert>}
            <div className="flex flex-col gap-3">
              <Button type="submit" disabled={pending} size="lg" className="min-h-[48px]">
                {pending ? "Enregistrement…" : "Enregistrer"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
                disabled={pending}
                className="min-h-[48px]"
              >
                Annuler
              </Button>
            </div>
          </form>
        </div>
      ) : (
        <div className="mx-auto flex w-full max-w-[450px] flex-col gap-8 pt-4 sm:pt-8">
          <div>
            <div className="text-center">
              <h1 className="text-3xl font-semibold tracking-[-0.045em] text-foreground">
                Nouveau produit
              </h1>
              <p className="mt-1 text-sm text-foreground">{STEP_SUBTITLES[step - 1]}</p>
            </div>
            <div className="mt-8 flex items-center gap-1" aria-label="Progression de la création">
              {STEPS.map((s, index) => {
                const isCompleted = index + 1 < step;
                const isCurrent = index + 1 === step;
                return (
                  <div
                    key={s}
                    className={`h-1 flex-1 rounded-full ${isCompleted || isCurrent ? "bg-primary" : "bg-border"}`}
                    aria-label={`${s}${isCurrent ? ", étape actuelle" : ""}`}
                  />
                );
              })}
            </div>
          </div>

          <div className="flex flex-col gap-6">
            <input type="hidden" name="productType" value={productType} />

            {step === 1 && (
              <>
                <div className="flex flex-col gap-5">
                  <InputField
                    ref={titleInputRef}
                    label="Nom du produit"
                    name="title"
                    value={formValues.title}
                    onChange={(e) => setFormValues((prev) => ({ ...prev, title: e.target.value }))}
                    required
                    maxLength={150}
                    placeholder="Ex: E-book sur le marketing digital"
                    error={
                      state.status === "error" && state.error ? { message: state.error } : undefined
                    }
                  />
                  <div>
                    <p className="text-sm font-medium text-foreground">Type de produit</p>
                    <div
                      className="mt-2 grid grid-cols-2 gap-4"
                      role="radiogroup"
                      aria-label="Type de produit"
                    >
                      {PRODUCT_TYPES.map((type) => (
                        <button
                          key={type.value}
                          type="button"
                          role="radio"
                          aria-checked={productType === type.value}
                          onClick={() => setProductType(type.value)}
                          className={`flex min-h-[100px] flex-col items-center gap-2 rounded-xl border p-4 text-center transition-colors ${
                            productType === type.value
                              ? "border-primary bg-primary text-white shadow-lg shadow-primary/15"
                              : "border-border bg-card text-foreground hover:border-muted-foreground"
                          }`}
                        >
                          <span
                            className={
                              productType === type.value ? "text-white" : "text-muted-foreground"
                            }
                            aria-hidden="true"
                          >
                            {type.icon}
                          </span>
                          <span className="text-sm font-semibold">{type.label}</span>
                          <span
                            className={`text-xs ${productType === type.value ? "text-white/75" : "text-muted-foreground"}`}
                          >
                            {type.description}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <label
                  htmlFor="initial-cover"
                  className="flex min-h-36 cursor-pointer items-center gap-4 rounded-xl border-2 border-dashed border-border bg-background p-4 text-center transition-colors hover:border-primary hover:bg-primary/[0.02]"
                >
                  {coverPreviewUrl !== null ? (
                    // eslint-disable-next-line @next/next/no-img-element -- aperçu local avant upload
                    <img
                      src={coverPreviewUrl}
                      alt="Aperçu de la couverture"
                      className="h-24 w-24 rounded-lg border border-border object-cover"
                    />
                  ) : (
                    <span className="text-2xl text-primary" aria-hidden="true">
                      ▧
                    </span>
                  )}
                  <span className="flex min-w-0 flex-col">
                    <span className="text-sm font-medium text-foreground">
                      {coverFile
                        ? coverFile.name
                        : "Glissez votre image ici ou cliquez pour l'importer"}
                    </span>
                    <span className="mt-1 text-xs text-muted-foreground">
                      {coverFile
                        ? `${formatFileSize(coverFile.size)} · JPG, PNG ou WebP`
                        : "JPG, PNG ou WebP · 5 Mo maximum"}
                    </span>
                  </span>
                </label>
                <input
                  id="initial-cover"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(event) => selectCoverFile(event.target.files?.[0] ?? null)}
                />

                <Card variant="bordered" className="hidden">
                  <CardContent className="flex flex-col gap-4 rounded-xl p-5 sm:p-7">
                    <div>
                      <p className="text-xs font-semibold tracking-[0.14em] text-primary uppercase">
                        02 · Les détails
                      </p>
                      <h2 className="mt-2 text-xl font-semibold tracking-tight text-foreground">
                        Présentez votre produit
                      </h2>
                      <p className="mt-2 text-sm text-muted-foreground">
                        Ces informations seront affichées sur votre page produit.
                      </p>
                    </div>
                    <InputField
                      ref={titleInputRef}
                      label="Nom du produit"
                      name="title"
                      value={formValues.title}
                      onChange={(e) =>
                        setFormValues((prev) => ({ ...prev, title: e.target.value }))
                      }
                      required
                      maxLength={150}
                      placeholder="Formation AutoCAD pour débutants"
                      description="Choisissez un nom clair qui décrit immédiatement ce que vous vendez."
                      error={
                        state.status === "error" && state.error
                          ? { message: state.error }
                          : undefined
                      }
                    />
                    <TextareaField
                      label="Résumé"
                      name="shortDescription"
                      value={formValues.shortDescription}
                      onChange={(e) =>
                        setFormValues((prev) => ({ ...prev, shortDescription: e.target.value }))
                      }
                      maxLength={300}
                      rows={2}
                      placeholder="Expliquez en quelques mots ce que l'acheteur va obtenir."
                      description="Un résumé court pour donner envie."
                      error={
                        state.status === "error" && state.error
                          ? { message: state.error }
                          : undefined
                      }
                    />
                    <TextareaField
                      label="Description"
                      name="description"
                      value={formValues.description}
                      onChange={(e) =>
                        setFormValues((prev) => ({ ...prev, description: e.target.value }))
                      }
                      maxLength={5000}
                      rows={5}
                      placeholder="Détaillez votre produit..."
                      description="Présentez votre produit et expliquez ce qu'il contient."
                      error={
                        state.status === "error" && state.error
                          ? { message: state.error }
                          : undefined
                      }
                    />
                    <div className="grid grid-cols-2 gap-4">
                      <InputField
                        label="Prix"
                        name="price"
                        type="number"
                        inputMode="decimal"
                        step="0.01"
                        min="0"
                        value={formValues.price}
                        onChange={(e) =>
                          setFormValues((prev) => ({ ...prev, price: e.target.value }))
                        }
                        required
                        placeholder="0.00"
                        description="Le prix en unités locales."
                        error={
                          state.status === "error" && state.error
                            ? { message: state.error }
                            : undefined
                        }
                      />
                      <SelectField
                        label="Devise"
                        name="currency"
                        value={formValues.currency}
                        onChange={(e) =>
                          setFormValues((prev) => ({ ...prev, currency: e.target.value }))
                        }
                        required
                        options={[
                          { value: "USD", label: "USD (Dollar américain)" },
                          { value: "CDF", label: "CDF (Franc congolais)" },
                        ]}
                        description="Choisissez la devise de votre prix."
                        error={
                          state.status === "error" && state.error
                            ? { message: state.error }
                            : undefined
                        }
                      />
                    </div>
                    <SelectField
                      label="Catégorie"
                      name="categoryId"
                      value={formValues.categoryId}
                      onChange={(e) =>
                        setFormValues((prev) => ({ ...prev, categoryId: e.target.value }))
                      }
                      required
                      placeholder="Choisir une catégorie"
                      options={categories.map((cat) => ({ value: cat.id, label: cat.name }))}
                      description="Choisissez la catégorie qui correspond le mieux à votre produit."
                      error={
                        state.status === "error" && state.error
                          ? { message: state.error }
                          : undefined
                      }
                    />
                    {state.status === "error" && state.error && (
                      <Alert variant="error">{state.error}</Alert>
                    )}
                  </CardContent>
                </Card>

                <div className="mt-1 grid grid-cols-2 gap-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => router.push("/vendor/catalogue")}
                    className="min-h-[48px]"
                  >
                    Annuler
                  </Button>
                  <Button
                    type="button"
                    disabled={!coverFile || formValues.title.trim().length < 3}
                    size="lg"
                    className="min-h-[48px]"
                    onClick={() => setStep(2)}
                  >
                    Continuer
                  </Button>
                </div>
              </>
            )}
          </div>

          {step >= 2 && (
            <div className="flex flex-col gap-6">
              {step === 2 && (
                <div className="flex flex-col gap-5">
                  <label
                    className="text-sm font-medium text-foreground"
                    htmlFor="product-description"
                  >
                    Décris-nous ton produit de façon détaillée{" "}
                    <span className="text-destructive">*</span>
                  </label>
                  <div className="overflow-hidden rounded-xl border border-border bg-card">
                    <div className="flex h-13 items-center gap-4 border-b border-border bg-muted px-5 text-lg text-foreground">
                      <span aria-hidden="true">↶</span>
                      <span aria-hidden="true">↷</span>
                      <span aria-hidden="true">B</span>
                      <span aria-hidden="true" className="italic">
                        I
                      </span>
                      <span aria-hidden="true" className="underline">
                        U
                      </span>
                      <span aria-hidden="true">☷</span>
                    </div>
                    <textarea
                      id="product-description"
                      name="description"
                      value={formValues.description}
                      onChange={(event) =>
                        setFormValues((previous) => ({
                          ...previous,
                          description: event.target.value,
                        }))
                      }
                      required
                      maxLength={5000}
                      placeholder="Présentez votre produit avec du texte, des images et des vidéos"
                      className="min-h-72 w-full resize-none bg-background p-5 text-sm text-foreground outline-none placeholder:text-muted-foreground"
                    />
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="flex flex-col gap-5">
                  <label
                    className="flex flex-col gap-2 text-sm font-medium text-foreground"
                    htmlFor="billing-type"
                  >
                    Type de facturation <span className="text-destructive">*</span>
                    <select
                      id="billing-type"
                      value={billingType}
                      onChange={(event) => {
                        const value = event.target.value as "ONE_TIME" | "OPEN";
                        setBillingType(value);
                      }}
                      className="h-12 rounded-xl border border-foreground bg-background px-3 text-sm font-normal outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                    >
                      <option value="ONE_TIME">Prix unique</option>
                      <option value="OPEN">Prix libre</option>
                    </select>
                  </label>
                  <div className="grid grid-cols-[1fr_110px] gap-3">
                    <InputField
                      label={billingType === "OPEN" ? "Prix minimum" : "Prix de vente"}
                      name="price"
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      min="0.01"
                      value={formValues.price}
                      onChange={(event) =>
                        setFormValues((previous) => ({ ...previous, price: event.target.value }))
                      }
                      required
                      placeholder="Entrez le prix de vente"
                    />
                    <SelectField
                      label="Devise"
                      name="currency"
                      value={formValues.currency}
                      onChange={(event) =>
                        setFormValues((previous) => ({
                          ...previous,
                          currency: event.target.value,
                        }))
                      }
                      required
                      options={[
                        { value: "USD", label: "USD" },
                        { value: "CDF", label: "CDF" },
                      ]}
                    />
                  </div>
                  {billingType === "ONE_TIME" && (
                    <div className="grid grid-cols-[1fr_110px] gap-3">
                      <InputField
                        label="Prix de vente avec réduction"
                        name="promoPrice"
                        type="number"
                        inputMode="decimal"
                        step="0.01"
                        min="0"
                        max={formValues.price || undefined}
                        value={promoPrice}
                        onChange={(event) => setPromoPrice(event.target.value)}
                        placeholder="Facultatif"
                        description="Laissez vide si votre produit n'est pas en promotion."
                      />
                      <div className="flex flex-col gap-1.5">
                        <span className="text-sm font-medium text-foreground">Devise</span>
                        <div className="border-input flex h-10 items-center rounded-lg border bg-muted px-3 text-sm text-muted-foreground">
                          {formValues.currency}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {step === 4 && isShowFile && (
                <div className="flex flex-col gap-4">
                  <label className="flex min-h-48 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-border bg-background p-6 text-center transition-colors hover:border-primary hover:bg-primary/[0.02]">
                    <span className="text-2xl text-primary" aria-hidden="true">
                      ⇧
                    </span>
                    <span className="mt-3 text-sm font-medium text-foreground">
                      {productFiles.length > 0
                        ? `${productFiles.length} fichier${productFiles.length > 1 ? "s" : ""} sélectionné${productFiles.length > 1 ? "s" : ""}`
                        : "Glissez vos fichiers ici ou cliquez pour les importer"}
                    </span>
                    <span className="mt-1 text-xs text-muted-foreground">
                      {productFiles.length > 0
                        ? `${productFiles.map((file) => file.name).join(" · ")}`
                        : "Jusqu'à 3 fichiers · PDF, ZIP, DOCX, images · 10 Mo maximum chacun"}
                    </span>
                    <input
                      type="file"
                      multiple
                      className="sr-only"
                      onChange={(event) =>
                        setProductFiles(Array.from(event.target.files ?? []).slice(0, 3))
                      }
                    />
                  </label>
                  <p className="text-center text-xs text-muted-foreground">
                    Le fichier sera remis à l&apos;acheteur après son achat.
                  </p>
                </div>
              )}

              {step === 4 && !isShowFile && productType === "PHYSICAL" && (
                <Card variant="bordered" className="rounded-2xl bg-card p-1 shadow-sm">
                  <CardContent className="flex flex-col gap-3 rounded-xl p-5 sm:p-7">
                    <h2 className="text-lg font-semibold tracking-tight text-foreground">
                      Livraison physique
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      Pour les produits physiques, la livraison sera configurée dans une prochaine
                      étape. Pour le moment, votre brouillon est créé et visible dans votre
                      catalogue.
                    </p>
                    <Alert variant="info">
                      <span className="font-semibold">Prochaine étape</span>
                      <p className="mt-1">
                        La configuration de la livraison sera disponible prochainement.
                      </p>
                    </Alert>
                  </CardContent>
                </Card>
              )}

              {step === 4 && (
                <Card variant="bordered" className="rounded-2xl bg-card p-1 shadow-sm">
                  <CardContent className="flex flex-col gap-3 rounded-xl p-5 sm:p-7">
                    <h2 className="text-lg font-semibold tracking-tight text-foreground">
                      Résumé de votre produit
                    </h2>
                    <div className="flex flex-col gap-2 text-sm">
                      <div>
                        <p className="text-xs font-medium text-muted-foreground">Nom du produit</p>
                        <p className="font-semibold text-foreground">{formValues.title || "—"}</p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-muted-foreground">Type</p>
                        <p className="font-semibold text-foreground">
                          {productType === "SERVICE"
                            ? "Service"
                            : productType === "DIGITAL"
                              ? "Numérique"
                              : "Physique"}
                        </p>
                      </div>
                      {formValues.shortDescription && (
                        <div>
                          <p className="text-xs font-medium text-muted-foreground">Résumé</p>
                          <p className="text-foreground">{formValues.shortDescription}</p>
                        </div>
                      )}
                      {formValues.description && (
                        <div>
                          <p className="text-xs font-medium text-muted-foreground">Description</p>
                          <p className="line-clamp-3 text-foreground">{formValues.description}</p>
                        </div>
                      )}
                      <div>
                        <p className="text-xs font-medium text-muted-foreground">Prix</p>
                        <p className="font-semibold text-foreground">
                          {formValues.price} {formValues.currency}
                        </p>
                      </div>
                      {formValues.categoryId && (
                        <div>
                          <p className="text-xs font-medium text-muted-foreground">Catégorie</p>
                          <p className="text-foreground">
                            {categories.find((c) => c.id === formValues.categoryId)?.name ??
                              formValues.categoryId}
                          </p>
                        </div>
                      )}
                      <div>
                        <p className="text-xs font-medium text-muted-foreground">
                          Image de couverture
                        </p>
                        <p className={isShowCover ? "text-foreground" : "text-emerald-600"}>
                          {isShowCover
                            ? coverFile
                              ? "Prête à être publiée"
                              : "Requise"
                            : "Non requise"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-muted-foreground">
                          Fichier numérique
                        </p>
                        <p className={isShowFile ? "text-foreground" : "text-emerald-600"}>
                          {isShowFile
                            ? productFiles.length > 0
                              ? `${productFiles.length} fichier${productFiles.length > 1 ? "s" : ""} prêt${productFiles.length > 1 ? "s" : ""}`
                              : "Requis"
                            : "Non requis"}
                        </p>
                      </div>
                      <Alert variant="info">
                        <span className="font-semibold">Règles :</span>
                        <p className="mt-1">
                          {productType === "SERVICE"
                            ? "La photo et le fichier sont facultatifs."
                            : productType === "PHYSICAL"
                              ? "Une photo est nécessaire. Aucun fichier numérique n'est requis."
                              : "Une photo et un fichier numérique sont nécessaires."}
                        </p>
                      </Alert>
                    </div>
                  </CardContent>
                </Card>
              )}

              {isCreated &&
                (coverUploadProgress !== null ||
                  fileUploadProgress !== null ||
                  isPublishing ||
                  uploadError !== null) && (
                  <Card variant="bordered" className="rounded-2xl bg-card p-1 shadow-sm">
                    <CardContent className="flex flex-col gap-4 rounded-xl p-5">
                      <div>
                        <h2 className="text-lg font-semibold tracking-tight text-foreground">
                          Téléversement du produit
                        </h2>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Votre produit est en cours de préparation et sera publié automatiquement.
                        </p>
                      </div>
                      {coverUploadProgress !== null && (
                        <UploadProgress
                          label="Image de couverture"
                          progress={coverUploadProgress}
                        />
                      )}
                      {fileUploadProgress !== null && (
                        <UploadProgress label="Fichier produit" progress={fileUploadProgress} />
                      )}
                      {isPublishing && <UploadProgress label="Publication" progress={100} />}
                      {uploadError !== null && (
                        <Alert variant="error">
                          <p>{uploadError}</p>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="mt-3"
                            onClick={() => {
                              setCoverUploadProgress(null);
                              setFileUploadProgress(null);
                              setUploadError(null);
                              setUploadAttempt((attempt) => attempt + 1);
                            }}
                          >
                            Réessayer
                          </Button>
                        </Alert>
                      )}
                    </CardContent>
                  </Card>
                )}

              <div className="flex flex-col-reverse gap-3 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStep(Math.max(1, step - 1))}
                  disabled={pending}
                  className="min-h-[48px] w-full sm:w-auto"
                >
                  ← Précédent
                </Button>
                {step < 4 && (
                  <Button
                    type="button"
                    onClick={() => setStep(step + 1)}
                    className="min-h-[48px] w-full sm:w-auto"
                  >
                    Continuer →
                  </Button>
                )}
                {step === 4 && (
                  <div className="flex w-full flex-col gap-3 sm:w-auto">
                    {state.status === "error" && state.error !== null && (
                      <Alert variant="error" className="sm:max-w-md">
                        {state.error}
                      </Alert>
                    )}
                    <form action={formAction}>
                      <input type="hidden" name="productType" value={productType} />
                      <input type="hidden" name="title" value={formValues.title} />
                      <input
                        type="hidden"
                        name="shortDescription"
                        value={formValues.shortDescription}
                      />
                      <input type="hidden" name="description" value={formValues.description} />
                      <input type="hidden" name="price" value={formValues.price} />
                      <input type="hidden" name="currency" value={formValues.currency} />
                      <input type="hidden" name="categoryId" value={formValues.categoryId} />
                      <Button
                        type="submit"
                        size="lg"
                        disabled={
                          pending || (productType === "DIGITAL" && productFiles.length === 0)
                        }
                        className="min-h-[48px] w-full sm:w-auto"
                      >
                        {pending ? "Création…" : "Créer et publier"}
                      </Button>
                    </form>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
