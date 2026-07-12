import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./supabase";
import type { EmailTemplate } from "../types";

// Cap del HTML del molde para no inflar tokens (una sola plantilla de referencia).
const MAX_REFERENCE_CHARS = 14000;

const FUNCTION_URL = SUPABASE_URL ? `${SUPABASE_URL}/functions/v1/generate-template` : "";

/**
 * Devuelve la plantilla MAS RECIENTE del proyecto base (molde a clonar).
 * `templates` viene en orden created_at desc (ver listTemplates), asi que el
 * primer match es la mas reciente. Si la base es General (null) -> sin molde.
 */
export function pickBaseTemplate(
  templates: EmailTemplate[],
  baseProjectId: string | null,
  excludeId?: string
): EmailTemplate | null {
  if (!baseProjectId) return null;
  return templates.find((t) => t.projectId === baseProjectId && t.id !== excludeId) ?? null;
}

type GenerateInput = {
  // Contenido real del correo (texto + variables {{...}}).
  content: string;
  // Variables declaradas (se mandan como ayuda; el contenido manda).
  variables: string[];
  // Proyecto cuyo estilo se clona (null = General / lineamientos de marca).
  baseProjectId: string | null;
  // Molde a clonar (plantilla mas reciente del proyecto base). null si General.
  referenceTemplate: EmailTemplate | null;
  // URL publica del banner superior (imagen de la Biblioteca de Activos).
  bannerImageUrl: string | null;
};

/**
 * Genera el HTML de una plantilla con Claude via Edge Function.
 * Solo se comparte: contenido + variables + HTML del molde + URL del banner.
 * Nunca contactos.
 */
export async function generateTemplateHtml(input: GenerateInput): Promise<string> {
  if (!FUNCTION_URL) {
    throw new Error("Supabase no esta configurado (falta VITE_SUPABASE_URL).");
  }
  if (!input.content.trim()) {
    throw new Error("Escribí el contenido del correo para generar la plantilla.");
  }

  const referenceTemplate = input.referenceTemplate
    ? {
        name: input.referenceTemplate.name,
        html:
          input.referenceTemplate.html.length > MAX_REFERENCE_CHARS
            ? input.referenceTemplate.html.slice(0, MAX_REFERENCE_CHARS)
            : input.referenceTemplate.html
      }
    : null;

  let response: Response;
  try {
    response = await fetch(FUNCTION_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`
      },
      body: JSON.stringify({
        content: input.content.trim(),
        variables: input.variables,
        baseIsGeneral: input.baseProjectId === null,
        referenceTemplate,
        bannerImageUrl: input.bannerImageUrl
      }),
      // La generación con Claude puede tardar; corta a los 90s en vez de colgar la UI.
      signal: AbortSignal.timeout(90_000)
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "TimeoutError") {
      throw new Error("La generación tardó más de 90 segundos y se canceló. Probá de nuevo con un contenido más corto.");
    }
    throw err;
  }

  if (!response.ok) {
    let message = `Error al generar (${response.status}).`;
    try {
      const data = await response.json();
      if (data?.error) message = data.error;
    } catch {
      /* sin cuerpo JSON */
    }
    throw new Error(message);
  }

  const data = (await response.json()) as { html?: string };
  if (!data.html) throw new Error("La respuesta no incluyo HTML.");
  return data.html;
}
