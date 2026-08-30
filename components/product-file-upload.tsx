"use client";

import { useActionState, useCallback, useRef, useState } from "react";
import { uploadProductFileAction } from "@/app/actions/product-files";
import { initialProductFormState } from "@/lib/product-form-state";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

interface ProductFileUploadProps {
  productId: string;
}

export function ProductFileUpload({ productId }: ProductFileUploadProps) {
  const [state, formAction, pending] = useActionState(uploadProductFileAction, initialProductFormState);
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      setSelectedFile(file);
    }
  }, []);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setSelectedFile(file);
  }, []);

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} o`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
  };

  return (
    <form action={formAction} className="flex flex-col gap-4 max-w-md">
      <input type="hidden" name="productId" value={productId} />

      <div
        className={[
          "flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 text-center transition-colors",
          dragActive
            ? "border-primary bg-primary/5"
            : "border-input bg-background hover:border-muted-foreground",
        ].filter(Boolean).join(" ")}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        role="button"
        tabIndex={0}
        aria-label="Zone de dépôt de fichier. Cliquez ou glissez-déposez un fichier."
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fileInputRef.current?.click(); } }}
      >
        <input
          ref={fileInputRef}
          type="file"
          name="file"
          className="hidden"
          onChange={handleFileChange}
          aria-hidden="true"
          tabIndex={-1}
        />
        {pending ? (
          <div className="flex flex-col items-center gap-2">
            <Skeleton variant="circular" className="h-12 w-12" />
            <p className="text-sm text-muted-foreground">Envoi en cours…</p>
          </div>
        ) : selectedFile ? (
          <div className="flex flex-col items-center gap-2">
            <span className="text-3xl" aria-hidden="true">📄</span>
            <p className="text-sm font-medium text-foreground">{selectedFile.name}</p>
            <p className="text-xs text-muted-foreground">{formatFileSize(selectedFile.size)}</p>
            <p className="text-xs text-muted-foreground">Cliquez pour changer</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <span className="text-3xl" aria-hidden="true">📤</span>
            <p className="text-sm font-medium text-foreground">Glissez-déposez votre fichier ici</p>
            <p className="text-xs text-muted-foreground">ou cliquez pour parcourir</p>
          </div>
        )}
      </div>

      {state.status === "success" && (
        <div role="status" className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
          ✓ Fichier uploadé avec succès.
        </div>
      )}

      {state.status === "error" && state.error && (
        <div role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-300">
          {state.error}
        </div>
      )}

      <Button type="submit" disabled={pending || !selectedFile} className="w-full">
        {pending ? "Envoi…" : "Envoyer le fichier"}
      </Button>
    </form>
  );
}