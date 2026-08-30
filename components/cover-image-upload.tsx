"use client";

import { useCallback, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

interface CoverImageUploadProps {
  productId: string;
  currentThumbnailPath: string | null;
  onUploadComplete?: () => void;
  onRemove: () => void;
}

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_SIZE = 5 * 1024 * 1024;

export function CoverImageUpload({ productId, currentThumbnailPath, onUploadComplete, onRemove }: CoverImageUploadProps) {
  const [dragActive, setDragActive] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((file: File) => {
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
          onUploadComplete?.();
        } else {
          setError(data.error ?? "Erreur lors de l'upload.");
          setPreviewUrl(null);
        }
      })
      .catch(() => setError("Erreur réseau."))
      .finally(() => setUploading(false));
  }, [productId, onUploadComplete]);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
    else if (e.type === "dragleave") setDragActive(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleRemove = useCallback(() => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setError(null);
    fetch(`/api/products/${productId}/cover`, { method: "DELETE" }).catch(() => {});
    onRemove();
  }, [productId, previewUrl, onRemove]);

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium">Image de couverture</label>
      {previewUrl ? (
        <div className="relative">
          <img src={previewUrl} alt="Aperçu couverture" className="h-48 w-full object-cover rounded-lg border" />
          <Button variant="destructive" size="sm" onClick={handleRemove} className="absolute top-2 right-2">
            Supprimer
          </Button>
        </div>
      ) : uploading ? (
        <Skeleton className="h-48 w-full rounded-lg" />
      ) : currentThumbnailPath ? (
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Couverture définie</span>
          <Button variant="outline" size="sm" onClick={handleRemove}>
            Supprimer
          </Button>
        </div>
      ) : (
        <div
          className={`flex h-48 w-full items-center justify-center rounded-lg border-2 border-dashed transition-colors ${dragActive ? "border-primary" : "border-muted-foreground/30"}`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <div className="flex flex-col items-center gap-1 text-sm text-muted-foreground">
            <span className="text-2xl">+</span>
            <span>Glissez ou cliquez pour ajouter</span>
            <span className="text-xs">JPG, PNG ou WebP — max 5 Mo</span>
          </div>
        </div>
      )}
      <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }} />
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}