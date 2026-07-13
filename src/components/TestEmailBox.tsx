import { useState } from "react";
import { sendTestEmail } from "../lib/api";
import type { ContactRecord } from "../types";

// Toda prueba se envía siempre a este correo; los demás se agregan por envío.
export const DEFAULT_TEST_EMAIL = "sebastian.mojica@disruptia.co";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

type Props = {
  /** HTML a enviar, resuelto al momento de la prueba. */
  getHtml: () => string;
  subject: string;
  sampleContact?: ContactRecord | null;
  /** Descripción bajo el título de la caja. */
  hint: string;
  disabled?: boolean;
};

export default function TestEmailBox({ getHtml, subject, sampleContact = null, hint, disabled }: Props) {
  const [extraEmails, setExtraEmails] = useState<string[]>([]);
  const [newEmail, setNewEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  const testEmails = [DEFAULT_TEST_EMAIL, ...extraEmails];

  function handleAdd() {
    const email = newEmail.trim().toLowerCase();
    if (!EMAIL_REGEX.test(email)) {
      setResult({ ok: false, message: "Ingresá un correo válido para agregarlo a la prueba." });
      return;
    }
    if (testEmails.includes(email)) {
      setResult({ ok: false, message: "Ese correo ya está en la lista de prueba." });
      return;
    }
    setExtraEmails((prev) => [...prev, email]);
    setNewEmail("");
    setResult(null);
  }

  async function handleSend() {
    setSending(true);
    setResult(null);
    try {
      await sendTestEmail({
        html: getHtml(),
        subject,
        testEmails,
        sampleContact
      });
      setResult({
        ok: true,
        message: `Prueba enviada a ${testEmails.length} correo(s): ${testEmails.join(", ")}. Revisá la bandeja (y spam).`
      });
    } catch (err) {
      setResult({ ok: false, message: err instanceof Error ? err.message : "No fue posible enviar la prueba." });
    } finally {
      setSending(false);
    }
  }

  return (
    <article className="card space-y-3">
      <div>
        <p className="font-heading text-sm font-semibold">Correo de prueba</p>
        <p className="mt-0.5 text-xs text-text-muted">{hint}</p>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <span className="flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
          {DEFAULT_TEST_EMAIL}
          <span className="font-normal text-primary/60">· siempre</span>
        </span>
        {extraEmails.map((email) => (
          <span
            key={email}
            className="flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1 text-xs font-semibold"
          >
            {email}
            <button
              type="button"
              onClick={() => setExtraEmails((prev) => prev.filter((e) => e !== email))}
              disabled={sending}
              className="text-text-muted hover:text-error"
              aria-label={`Quitar ${email} de la prueba`}
            >
              ×
            </button>
          </span>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          type="email"
          className="input flex-1 min-w-[240px]"
          value={newEmail}
          onChange={(e) => setNewEmail(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleAdd();
            }
          }}
          placeholder="Agregar otro correo de la empresa…"
          disabled={sending}
        />
        <button
          type="button"
          onClick={handleAdd}
          disabled={sending || !newEmail.trim()}
          className="btn-secondary disabled:opacity-40"
        >
          Agregar
        </button>
        <button
          type="button"
          onClick={() => void handleSend()}
          disabled={sending || disabled}
          className="btn-primary disabled:opacity-40"
        >
          {sending ? "Enviando prueba..." : `Enviar prueba (${testEmails.length})`}
        </button>
      </div>
      {result && <p className={`text-sm ${result.ok ? "text-success" : "text-error"}`}>{result.message}</p>}
    </article>
  );
}
