"use client";

import React from "react";
import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createProductAction, updateProductAction } from "@/app/actions/products";
import { initialProductFormState } from "@/lib/product-form-state";
import { InputField, TextareaField, SelectField } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { CoverImageUpload } from "@/components/cover-image-upload";
import { ProductFileUpload } from "@/components/product-file-upload";

const STEPS = ["Type & infos", "Photo", "Fichier", "Résumé"];

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
    value: "PHYSICAL",
    label: "Produit physique",
    description: "Un objet tangible que vous expédierez à l'acheteur.",
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
          d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
        />
      </svg>
    ),
  },
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
  {
    value: "SERVICE",
    label: "Service",
    description: "Une prestation ou une compétence que vous offrez.",
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
          d="M13 10V3L4 14h7v7l9-11h-7z"
        />
      </svg>
    ),
  },
];

export function ProductForm({ initialProduct, categories }: ProductFormProps) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(
    initialProduct ? updateProductAction : createProductAction,
    initialProductFormState,
  );
  const [step, setStep] = useState(1);
  const [productType, setProductType] = useState(initialProduct?.productType ?? "PHYSICAL");
  const [formValues, setFormValues] = useState({
    title: initialProduct?.title ?? "",
    shortDescription: initialProduct?.shortDescription ?? "",
    description: initialProduct?.description ?? "",
    price: initialProduct?.price ?? "",
    currency: initialProduct?.currency ?? "USD",
    categoryId: initialProduct?.categoryId ?? "",
  });
  const titleInputRef = useRef<HTMLInputElement>(null);

  const productId = state.productId;
  const isEdit = initialProduct !== undefined;
  const isNewProduct = !isEdit;
  const isCreated = state.status === "success" && !!productId && isNewProduct;

  useEffect(() => {
    if (state.status === "error" && state.error) {
      titleInputRef.current?.focus();
    }
  }, [state.status, state.error]);

  useEffect(() => {
    if (isCreated && step === 1) {
      const id = setTimeout(() => setStep(2), 0);
      return () => clearTimeout(id);
    }
  }, [isCreated, step]);

  const isShowCover = productType === "PHYSICAL" || productType === "DIGITAL";
  const isShowFile = productType === "DIGITAL" || productType === "SERVICE";

  return (
    <>
      {isEdit ? (
        <div className="flex max-w-2xl flex-col gap-6">
          <Alert variant="info">
            <span className="font-semibold">Modification du produit</span>
            <p className="mt-1">Les modifications sont enregistrées comme brouillon.</p>
          </Alert>
          <form action={formAction} className="flex max-w-2xl flex-col gap-6">
            <input type="hidden" name="productId" value={initialProduct.id} />
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
                min="0"
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
                {pending ? "Mise à jour en cours…" : "Mettre à jour"}
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
        <div className="flex max-w-2xl flex-col gap-6">
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted-foreground uppercase">
              Étape {step} sur {STEPS.length}
            </span>
            <div
              className="flex items-center gap-1 overflow-x-auto"
              aria-label="Progression de la création"
            >
              {STEPS.map((s, index) => {
                const isCompleted = index + 1 < step;
                const isCurrent = index + 1 === step;
                return (
                  <React.Fragment key={s}>
                    <div className="flex flex-col items-center gap-1">
                      <span
                        className={`inline-flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold ${
                          isCompleted
                            ? "bg-primary text-primary-foreground"
                            : isCurrent
                              ? "bg-primary/20 text-primary"
                              : "bg-muted text-muted-foreground"
                        }`}
                        aria-hidden="true"
                      >
                        {isCompleted ? "✓" : index + 1}
                      </span>
                      <span
                        className={`hidden text-xs sm:inline ${isCompleted || isCurrent ? "font-medium text-foreground" : "text-muted-foreground"}`}
                      >
                        {s}
                      </span>
                    </div>
                    {index < STEPS.length - 1 && (
                      <div
                        className={`h-px w-8 sm:w-12 ${isCompleted ? "bg-primary" : "bg-border"}`}
                        aria-hidden="true"
                      />
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          </div>

          <form action={formAction} className="flex flex-col gap-6">
            <input type="hidden" name="productType" value={productType} />

            {step === 1 && (
              <>
                <Card variant="bordered">
                  <CardContent className="flex flex-col gap-3 p-4 sm:p-6">
                    <h2 className="text-lg font-semibold tracking-tight text-foreground">
                      Type de produit
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      Choisissez le type de produit que vous vendez. Cette étape aide à adapter le
                      parcours de création.
                    </p>
                    <div
                      className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-3"
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
                          className={`flex min-h-[100px] flex-col items-center gap-2 rounded-xl border-2 p-4 text-center transition-colors ${
                            productType === type.value
                              ? "border-primary bg-primary/5 text-primary"
                              : "border-border bg-card text-foreground hover:border-muted-foreground"
                          }`}
                        >
                          <span
                            className={
                              productType === type.value ? "text-primary" : "text-muted-foreground"
                            }
                            aria-hidden="true"
                          >
                            {type.icon}
                          </span>
                          <span className="text-sm font-semibold">{type.label}</span>
                          <span className="text-xs text-muted-foreground">{type.description}</span>
                        </button>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card variant="bordered">
                  <CardContent className="flex flex-col gap-3 p-4 sm:p-6">
                    <h2 className="text-lg font-semibold tracking-tight text-foreground">
                      Informations du produit
                    </h2>
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

                <div className="flex flex-col gap-3">
                  <Button type="submit" disabled={pending} size="lg" className="min-h-[48px]">
                    {pending ? "Création en cours…" : "Créer mon brouillon"}
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    Votre produit sera créé comme brouillon. Vous pourrez ajouter la photo et le
                    fichier ensuite.
                  </p>
                </div>
              </>
            )}
          </form>

          {step >= 2 && productId && (
            <div className="flex flex-col gap-6">
              {step === 2 && isShowCover && (
                <Card variant="bordered">
                  <CardContent className="flex flex-col gap-3 p-4 sm:p-6">
                    <h2 className="text-lg font-semibold tracking-tight text-foreground">
                      Image de couverture
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      {productType === "PHYSICAL" || productType === "DIGITAL"
                        ? "Ajoutez une image qui présente clairement votre produit. Formats acceptés : JPG, PNG, WebP — taille maximale : 5 Mo."
                        : "Ajoutez une image pour présenter votre service. Optionnel mais recommandé. JPG, PNG, WebP — max 5 Mo."}
                    </p>
                    <CoverImageUpload
                      productId={productId}
                      currentThumbnailPath={null}
                      currentThumbnailUrl={null}
                      productStatus="DRAFT"
                    />
                  </CardContent>
                </Card>
              )}

              {step === 2 && !isShowCover && productType === "SERVICE" && (
                <Card variant="bordered">
                  <CardContent className="flex flex-col gap-3 p-4 sm:p-6">
                    <h2 className="text-lg font-semibold tracking-tight text-foreground">
                      Image de couverture (optionnel)
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      Ajoutez une image pour présenter votre service. Optionnel mais recommandé.
                      JPG, PNG, WebP — max 5 Mo.
                    </p>
                    <CoverImageUpload
                      productId={productId}
                      currentThumbnailPath={null}
                      currentThumbnailUrl={null}
                      productStatus="DRAFT"
                    />
                  </CardContent>
                </Card>
              )}

              {step === 3 && isShowFile && (
                <Card variant="bordered">
                  <CardContent className="flex flex-col gap-3 p-4 sm:p-6">
                    <h2 className="text-lg font-semibold tracking-tight text-foreground">
                      Fichier numérique
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      {productType === "DIGITAL"
                        ? "Le fichier que l'acheteur recevra après son achat. Formats acceptés : PDF, ZIP, DOCX, DOC, TXT, CSV, XLS, XLSX, images (JPG, PNG, WebP, GIF). Taille maximale : 10 Mo. Obligatoire pour les produits numériques."
                        : "Ajoutez un fichier lié à votre service (optionnel). Formats acceptés : PDF, ZIP, DOCX, images. Taille maximale : 10 Mo."}
                    </p>
                    <ProductFileUpload
                      productId={productId}
                      productStatus="DRAFT"
                      existingFiles={[]}
                    />
                  </CardContent>
                </Card>
              )}

              {step === 3 && !isShowFile && productType === "PHYSICAL" && (
                <Card variant="bordered">
                  <CardContent className="flex flex-col gap-3 p-4 sm:p-6">
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
                <Card variant="bordered">
                  <CardContent className="flex flex-col gap-3 p-4 sm:p-6">
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
                          {isShowCover ? "Ajoutée" : "Non requise (optionnelle)"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-muted-foreground">
                          Fichier numérique
                        </p>
                        <p className={isShowFile ? "text-foreground" : "text-emerald-600"}>
                          {isShowFile ? "Ajouté" : "Non requis"}
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

              <div className="flex flex-col gap-3">
                {step < 4 && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setStep(step + 1)}
                    className="min-h-[48px] w-full sm:w-auto"
                  >
                    Suivant
                  </Button>
                )}
                {step === 4 && (
                  <Button
                    type="button"
                    size="lg"
                    onClick={() => router.push(`/vendor/catalogue/${productId}/edit`)}
                    className="min-h-[48px] w-full sm:w-auto"
                  >
                    Voir mon produit dans le catalogue
                  </Button>
                )}
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStep(1)}
                  disabled={pending}
                  className="min-h-[48px] w-full sm:w-auto"
                >
                  Retour aux informations
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
