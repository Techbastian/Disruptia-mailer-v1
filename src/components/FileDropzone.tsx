import { useRef, useState, type ReactNode } from "react";
import { AlertTriangle, Upload } from "lucide-react";

type FileDropzoneProps = {
  // Texto secundario bajo el título del dropzone (formatos, columnas esperadas).
  subtitle: ReactNode;
  // Procesa el archivo ya validado (.csv/.xlsx). Si lanza, el mensaje se muestra como error.
  onFile: (file: File) => Promise<void>;
};

export default function FileDropzone({ subtitle, onFile }: FileDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState("");

  async function handleFile(file: File) {
    if (!/\.(csv|xlsx)$/i.test(file.name)) {
      setError("Formato no soportado. Subí un archivo .csv o .xlsx.");
      return;
    }
    setParsing(true);
    setError("");
    try {
      await onFile(file);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al procesar el archivo.");
    } finally {
      setParsing(false);
    }
  }

  return (
    <div className="space-y-3">
      <div
        className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-border bg-surface/50 py-12 transition-colors hover:border-primary/40"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const file = e.dataTransfer.files[0];
          if (file) void handleFile(file);
        }}
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
          <Upload size={22} className="text-primary" />
        </div>
        <div className="text-center">
          <p className="font-semibold">{parsing ? "Procesando…" : "Arrastrá o hacé clic para subir"}</p>
          <p className="text-sm text-text-muted">{subtitle}</p>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.xlsx"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleFile(file);
          }}
        />
      </div>

      {error && (
        <p className="flex items-center gap-2 text-sm text-error">
          <AlertTriangle size={14} />
          {error}
        </p>
      )}
    </div>
  );
}
