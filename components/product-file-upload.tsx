"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { MAX_PRODUCT_FILES, type ProductFileRow } from "@/services/products/product-files";

interface ProductFileUploadProps {
  productId: string;
  productStatus: string;
  existingFiles: ProductFileRow[];
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

function mimeToLabel(mime: string): string {
  const map: Record<string, string> = {
    "image/jpeg": "JPG",
    "image/png": "PNG",
    "image/webp": "WebP",
    "application/pdf": "PDF",
    "application/zip": "ZIP",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "DOCX",
    "application/msword": "DOC",
    "text/plain": "TXT",
    "text/csv": "CSV",
    "application/vnd.ms-excel": "XLS",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "XLSX",
  };
  return map[mime] ?? mime;
}

const isEditable = (status: string) =>
  status === "DRAFT" || status === "REJECTED" || status === "PUBLISHED";

export function ProductFileUpload({
  productId,
  productStatus,
  existingFiles,
}: ProductFileUploadProps) {
  const router = useRouter();
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editable = isEditable(productStatus);

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
    const file = e.dataTransfer.files[0];
    if (file) setSelectedFile(file);
  }, []);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setSelectedFile(file);
    setError(null);
    setSuccess(false);
  }, []);

  const handleUpload = useCallback(() => {
    if (!selectedFile || !editable) return;
    setError(null);
    setUploading(true);
    const formData = new FormData();
    formData.set("file", selectedFile);
    formData.set("productId", productId);
    fetch(`/api/products/${productId}/files`, { method: "POST", body: formData })
      .then((res) => res.json())
      .then((data) => {
        if (data.ok) {
          setSelectedFile(null);
          setSuccess(true);
          router.refresh();
        } else {
          setError(data.error ?? "Erreur lors de l&apos;upload.");
        }
      })
      .catch(() => setError("Erreur réseau."))
      .finally(() => setUploading(false));
  }, [selectedFile, productId, editable, router]);

  const handleDelete = useCallback(
    async (fileId: string) => {
      setDeletingId(fileId);
      setError(null);
      const response = await fetch(`/api/products/${productId}/files/${fileId}`, { method: "DELETE" });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) setError(data.error ?? "Impossible de supprimer le fichier.");
      else router.refresh();
      setDeletingId(null);
    },
    [productId, router],
  );

  return (
    <section className="flex flex-col gap-3">
      {error && <Alert variant="error">{error}</Alert>}

      {success && <Alert variant="success">Fichier ajouté avec succès.</Alert>}

      {!editable && productStatus === "PENDING_REVIEW" && (
        <Alert variant="info">
          Votre produit est en cours de vérification. Le fichier numérique ne peut pas être modifié
          pour le moment.
        </Alert>
      )}

      {!editable && productStatus === "ARCHIVED" && (
        <Alert variant="info">
          Votre produit est archivé. Le fichier numérique ne peut pas être modifié.
        </Alert>
      )}

      {existingFiles.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium text-foreground">
            Fichiers à télécharger ({existingFiles.length}/{MAX_PRODUCT_FILES})
          </p>
          {existingFiles.map((file) => (
            <div
              key={file.id}
              className="flex items-center justify-between rounded-lg border border-border bg-card p-3"
            >
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-medium text-foreground">{file.file_name}</span>
                <span className="text-xs text-muted-foreground">
                  {formatFileSize(Number(file.file_size_bytes))} · {mimeToLabel(file.mime_type)}
                </span>
              </div>
              {editable && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={deletingId === file.id}
                  onClick={() => void handleDelete(file.id)}
                >
                  {deletingId === file.id ? "Suppression…" : "Supprimer"}
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      {editable && existingFiles.length >= MAX_PRODUCT_FILES && (
        <Alert variant="info">Limite atteinte : un produit peut contenir jusqu&apos;à {MAX_PRODUCT_FILES} fichiers.</Alert>
      )}

      {!selectedFile && !uploading && existingFiles.length < MAX_PRODUCT_FILES && (
        <div
          className={[
            "flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 text-center transition-colors",
            dragActive
              ? "border-primary bg-primary/5"
              : "border-input bg-background hover:border-muted-foreground",
          ]
            .filter(Boolean)
            .join(" ")}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={() => editable && fileInputRef.current?.click()}
          role={editable ? "button" : undefined}
          tabIndex={editable ? 0 : undefined}
          aria-label={
            editable
              ? "Zone de dépôt de fichier. Cliquez ou glissez-déposez un fichier."
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
          <span className="text-3xl" aria-hidden="true">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
          </span>
          <p className="text-sm font-medium text-foreground">
            {editable ? "Glissez-déposez votre fichier ici" : "Aucun fichier ajouté"}
          </p>
          <p className="text-xs text-muted-foreground">
            {editable ? "ou cliquez pour parcourir" : ""}
          </p>
        </div>
      )}

      {selectedFile && (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-border bg-card p-4">
          <p className="text-sm font-medium text-foreground">{selectedFile.name}</p>
          <p className="text-xs text-muted-foreground">{formatFileSize(selectedFile.size)}</p>
        </div>
      )}

      {uploading && (
        <div className="flex flex-col items-center gap-2">
          <Skeleton variant="circular" className="h-12 w-12" />
          <p className="text-sm text-muted-foreground">Envoi en cours…</p>
        </div>
      )}

      {editable && selectedFile && !uploading && existingFiles.length < MAX_PRODUCT_FILES && (
        <Button onClick={handleUpload} className="w-full" size="lg">
          Envoyer le fichier
        </Button>
      )}

      {editable && (
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.zip,.docx,.doc,.txt,.csv,.xls,.xlsx,.jpg,.jpeg,.png,.webp,.gif"
          className="hidden"
          onChange={handleFileChange}
        />
      )}
    </section>
  );
}
