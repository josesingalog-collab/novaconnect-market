"use client";

/* eslint-disable @next/next/no-img-element -- L'aperçu local peut être une URL blob. */

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";

interface CoverImageUploadProps {
  productId: string;
  currentThumbnailPath: string | null;
  currentThumbnailUrl: string | null;
  productStatus: string;
}

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_SIZE = 5 * 1024 * 1024;

const isEditable = (status: string) =>
  status === "DRAFT" || status === "REJECTED" || status === "PUBLISHED";

export function CoverImageUpload({
  productId,
  currentThumbnailPath,
  currentThumbnailUrl,
  productStatus,
}: CoverImageUploadProps) {
  const router = useRouter();
  const [dragActive, setDragActive] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editable = isEditable(productStatus);

  const handleFile = useCallback(
    (file: File) => {
      setError(null);
      if (!ALLOWED_MIME_TYPES.includes(file.type)) {
        setError("Format non autorisé. JPG, PNG ou WebP uniquement.");
        return;
      }
      if (file.size === 0 || file.size > MAX_SIZE) {
        setError(`Image trop volumineuse (max 5 Mo).`);
        return;
      }

      const url = URL.createObjectURL(file);
      setPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return url;
      });

      const formData = new FormData();
      formData.set("file", file);

      setUploading(true);
      fetch(`/api/products/${productId}/cover`, { method: "POST", body: formData })
        .then((res) => res.json())
        .then((data) => {
          if (data.ok) {
            router.refresh();
          } else {
            setError(data.error ?? "Erreur lors de l&apos;upload.");
            setPreviewUrl(null);
          }
        })
        .catch(() => setError("Erreur réseau."))
        .finally(() => setUploading(false));
    },
    [productId, router],
  );

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
    else if (e.type === "dragleave") setDragActive(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);
      const file = e.dataTransfer.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  const handleRemove = useCallback(() => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setError(null);
    fetch(`/api/products/${productId}/cover`, { method: "DELETE" }).catch(() => {});
    router.refresh();
  }, [productId, previewUrl, router]);

  const displayUrl = previewUrl ?? currentThumbnailUrl;

  return (
    <section className="flex flex-col gap-3">
      {error && <Alert variant="error">{error}</Alert>}

      {!editable && productStatus === "PENDING_REVIEW" && (
        <Alert variant="info">
          Votre produit est en cours de vérification. La couverture ne peut pas être modifiée pour
          le moment.
        </Alert>
      )}

      {!editable && productStatus === "ARCHIVED" && (
        <Alert variant="info">
          Votre produit est archivé. La couverture ne peut pas être modifiée.
        </Alert>
      )}

      {displayUrl ? (
        <div className="relative">
          <img
            src={displayUrl}
            alt="Aperçu de la couverture"
            className="h-48 w-full rounded-lg border object-cover"
          />
          {editable && (
            <>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleRemove}
                className="absolute top-2 right-2"
                disabled={uploading}
              >
                Supprimer
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                className="absolute top-2 left-2"
                disabled={uploading}
              >
                Remplacer
              </Button>
            </>
          )}
        </div>
      ) : uploading ? (
        <Skeleton className="h-48 w-full rounded-lg" />
      ) : currentThumbnailPath && !displayUrl ? (
        <div className="flex items-center gap-2 rounded-lg border border-border bg-card p-4">
          <span className="text-sm text-muted-foreground">Couverture définie</span>
          {editable && (
            <Button variant="outline" size="sm" onClick={handleRemove} disabled={uploading}>
              Supprimer
            </Button>
          )}
        </div>
      ) : (
        <div
          className={`flex h-48 w-full items-center justify-center rounded-lg border-2 border-dashed transition-colors ${dragActive ? "border-primary" : "border-muted-foreground/30"}`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={() => editable && fileInputRef.current?.click()}
          role={editable ? "button" : undefined}
          tabIndex={editable ? 0 : undefined}
          aria-label={
            editable
              ? "Zone de dépôt de couverture. Cliquez ou glissez-déposez une image."
              : undefined
          }
          onKeyDown={
            editable
              ? (e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    fileInputRef.current?.click();
                  }
                }
              : undefined
          }
        >
          <div className="flex flex-col items-center gap-1 text-sm text-muted-foreground">
            <span className="text-2xl" aria-hidden="true">
              +
            </span>
            <span>
              {editable ? "Glissez ou cliquez pour ajouter" : "Couverture non modifiable"}
            </span>
            <span className="text-xs">JPG, PNG ou WebP — max 5 Mo</span>
          </div>
        </div>
      )}

      {editable && (
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
            e.target.value = "";
          }}
        />
      )}
    </section>
  );
}
