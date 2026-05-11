import { useState, type ChangeEvent } from "react";
import { Check, Copy, Trash2 } from "lucide-react";
import { hasSupabaseConfig, SUPABASE_BUCKET_ASSETS } from "../lib/supabase";
import { uploadAssetAndSave } from "../lib/db";
import type { AssetItem } from "../types";

type AssetLibraryViewProps = {
  assets: AssetItem[];
  onAssetCreated: (asset: AssetItem) => void;
  onAssetDeleted: (id: string) => Promise<void>;
};

export default function AssetLibraryView({ assets, onAssetCreated, onAssetDeleted }: AssetLibraryViewProps) {
  const [error, setError] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  function handleCopy(asset: AssetItem) {
    void navigator.clipboard.writeText(asset.publicUrl).then(() => {
      setCopiedId(asset.id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  }

  async function handleUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!hasSupabaseConfig) {
      setError("Falta configurar Supabase en .env para subir archivos.");
      return;
    }
    setError("");
    setIsUploading(true);
    try {
      const createdAsset = await uploadAssetAndSave(file);
      onAssetCreated(createdAsset);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No fue posible subir el archivo.");
    } finally {
      setIsUploading(false);
      event.target.value = "";
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      await onAssetDeleted(id);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No fue posible eliminar el activo.");
      setConfirmId(null);
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <section className="space-y-6">
      <div>
        <h1 className="font-heading text-3xl font-bold">Biblioteca de Activos</h1>
        <p className="mt-2 text-sm text-text-muted">Gestioná imágenes y piezas visuales para tus campañas.</p>
      </div>

      <article className="card">
        <label className="block text-sm font-semibold">Subir imagen a Supabase Storage</label>
        <input className="input mt-2" type="file" accept="image/*" onChange={handleUpload} />
        <p className="mt-2 text-xs text-text-muted">Bucket: {SUPABASE_BUCKET_ASSETS}</p>
        {!hasSupabaseConfig && (
          <p className="mt-2 text-xs text-warning">
            Modo visual activo: configurá VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY para habilitar cargas reales.
          </p>
        )}
        {isUploading && <p className="mt-3 text-sm text-text-muted">Subiendo...</p>}
        {error && <p className="mt-3 text-sm text-error">{error}</p>}
      </article>

      <article className="card">
        <h2 className="font-heading text-xl font-semibold">Activos disponibles</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          {assets.length === 0 ? (
            <p className="text-sm text-text-muted">Aún no hay activos cargados.</p>
          ) : (
            assets.map((asset) => (
              <figure key={asset.id} className="rounded-xl border border-border p-3">
                <img
                  className="h-40 w-full rounded-lg object-cover"
                  src={asset.publicUrl}
                  alt={asset.name}
                />
                <figcaption className="mt-3 space-y-2 text-sm">
                  <p className="font-semibold leading-tight">{asset.name}</p>
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-text-muted">URL pública:</p>
                    <div className="flex items-center gap-2 rounded-lg bg-surface px-3 py-2">
                      <p className="flex-1 truncate font-mono text-xs text-text-muted">
                        {asset.publicUrl}
                      </p>
                      <button
                        type="button"
                        onClick={() => handleCopy(asset)}
                        className="shrink-0 text-text-muted transition-colors hover:text-primary"
                        aria-label="Copiar URL"
                      >
                        {copiedId === asset.id ? (
                          <Check size={14} className="text-success" />
                        ) : (
                          <Copy size={14} />
                        )}
                      </button>
                    </div>
                  </div>

                  {confirmId === asset.id ? (
                    <div className="flex gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => void handleDelete(asset.id)}
                        disabled={deletingId === asset.id}
                        className="flex-1 rounded-lg bg-error px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                      >
                        {deletingId === asset.id ? "Eliminando..." : "Confirmar"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmId(null)}
                        className="flex-1 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:bg-surface"
                      >
                        Cancelar
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmId(asset.id)}
                      className="flex items-center gap-1.5 text-xs text-text-muted hover:text-error transition-colors"
                    >
                      <Trash2 size={13} />
                      Eliminar
                    </button>
                  )}
                </figcaption>
              </figure>
            ))
          )}
        </div>
      </article>
    </section>
  );
}
