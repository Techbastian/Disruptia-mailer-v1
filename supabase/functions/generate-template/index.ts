// Edge Function: generate-template
// ─────────────────────────────────────────────────────────────────────────────
// Genera el HTML de un correo CLONANDO la identidad visual de una plantilla
// de referencia (el "molde"): estructura, colores y tipografia. El usuario solo
// aporta el CONTENIDO del correo (texto + variables) y un banner superior.
//
// SEGURIDAD: la ANTHROPIC_API_KEY vive aqui como SECRETO server-side.
// El navegador nunca la ve; solo llama a esta funcion.
//
// MINIMIZACION DE DATOS: solo recibe (1) contenido del correo, (2) nombres de
// variables, (3) HTML del molde de referencia, (4) URL del banner.
// NUNCA recibe contactos, emails ni listas de destinatarios.
// ─────────────────────────────────────────────────────────────────────────────

const MODEL = "claude-sonnet-4-6";
const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const BRAND_PURPLE = "#4D4BCF";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

type ReferenceTemplate = { name: string; html: string };

type RequestBody = {
  content?: string;
  variables?: string[];
  baseIsGeneral?: boolean;
  referenceTemplate?: ReferenceTemplate | null;
  bannerImageUrl?: string | null;
};

const SYSTEM_PROMPT = `Sos un maquetador experto de correos HTML para Disruptia, una organizacion de diversidad, equidad e inclusion (DEI) y crecimiento profesional.

TU TAREA: tomar el CONTENIDO que te da el usuario y volcarlo en una plantilla HTML que MANTIENE UNA IDENTIDAD VISUAL CONSTANTE con las plantillas existentes. NO sos un disenador libre: tu prioridad es la CONSISTENCIA.

SI SE TE DA UNA PLANTILLA MOLDE (referencia):
- CLONA su estructura HTML, su paleta de colores, su tipografia, sus margenes y su disposicion general.
- Cambia UNICAMENTE el texto/contenido por el que aporta el usuario. No rediseñes, no inventes una paleta nueva, no cambies la tipografia.
- Heredá los colores del molde tal cual.

SI NO HAY MOLDE (base GENERAL): usa los lineamientos de marca Disruptia:
- Primario / acentos / CTAs: ${BRAND_PURPLE}. Secundario: #FFB700. Texto titulos: #081420.
- Fondo de pagina: #F8F9FA. Contenedor del correo: #FFFFFF, ancho max 600px centrado.
- Tipografia: Arial, Helvetica, sans-serif (fallback web-safe).

BANNER SUPERIOR (SIEMPRE va arriba del correo):
- Si se da una URL de imagen de banner: insertala como <img> al tope, ancho completo (width 100%, max 600px), con alt descriptivo. Usá EXACTAMENTE esa URL, no la modifiques ni la recortes.
- Si la base es GENERAL y se da una URL: tratala como LOGO -> ponela centrada sobre una franja de color ${BRAND_PURPLE} (banda superior morada con el logo encima).
- Si NO se da URL: con molde, conservá el banner/header que ya tenga el molde; sin molde (general), creá una franja superior ${BRAND_PURPLE} con el texto "Disruptia" centrado en blanco.

VARIABLES: respetá las variables con doble llave (ej. {{nombre}}) TAL CUAL aparecen en el contenido. No las reemplaces por valores de ejemplo; el sistema las completa al enviar.

REGLAS TECNICAS DE EMAIL (OBLIGATORIAS):
- Layout con <table>, CSS EN LINEA (inline). Nada de <script>, ni <style> dependiente del <head>, ni flexbox/grid.
- Compatible con clientes de correo, responsive simple. Ancho de contenido ~600px.
- No inventes URLs de imagenes; usa solo las que te den.

SALIDA: respondé UNICAMENTE con el HTML del correo. Sin explicaciones, sin markdown, sin bloques de codigo (nada de triple backtick).`;

function buildUserPrompt(body: RequestBody): string {
  const parts: string[] = [];

  parts.push("CONTENIDO DEL CORREO (texto real a usar; respetá las variables {{...}} tal cual):");
  parts.push((body.content ?? "").trim() || "(sin contenido)");

  if (body.variables && body.variables.length > 0) {
    parts.push("");
    parts.push("VARIABLES declaradas (deben quedar como {{variable}} donde corresponda):");
    parts.push(body.variables.map((v) => `{{${v}}}`).join(", "));
  }

  parts.push("");
  if (body.bannerImageUrl) {
    parts.push(
      body.baseIsGeneral
        ? `BANNER: usá esta URL como LOGO centrado sobre una franja superior ${BRAND_PURPLE}: ${body.bannerImageUrl}`
        : `BANNER: usá esta URL como imagen de banner superior (ancho completo): ${body.bannerImageUrl}`
    );
  } else {
    parts.push("BANNER: no se dio URL — seguí la regla de fallback del system prompt.");
  }

  parts.push("");
  if (body.referenceTemplate && body.referenceTemplate.html?.trim()) {
    parts.push(
      `PLANTILLA MOLDE a clonar (estructura, colores y tipografia) — "${body.referenceTemplate.name}":`
    );
    parts.push(body.referenceTemplate.html);
  } else {
    parts.push("SIN MOLDE: base GENERAL, usá los lineamientos de marca Disruptia.");
  }

  parts.push("");
  parts.push("Generá ahora el HTML del correo. Manté la identidad del molde y solo cambiá el contenido. Solo HTML.");
  return parts.join("\n");
}

function stripCodeFences(text: string): string {
  let out = text.trim();
  const fence = /^```(?:html)?\s*\n([\s\S]*?)\n```$/i;
  const m = out.match(fence);
  if (m) out = m[1].trim();
  return out;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Metodo no permitido" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "Falta configurar el secreto ANTHROPIC_API_KEY en la Edge Function." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Body JSON invalido." }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  if (!body.content || !body.content.trim()) {
    return new Response(JSON.stringify({ error: "El contenido del correo es obligatorio." }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  try {
    const anthropicResp = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 8000,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: buildUserPrompt(body) }]
      })
    });

    if (!anthropicResp.ok) {
      const errText = await anthropicResp.text();
      console.error("Error de Anthropic:", anthropicResp.status, errText);
      return new Response(
        JSON.stringify({ error: `Error del modelo (${anthropicResp.status}).` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await anthropicResp.json();
    const rawText: string =
      Array.isArray(data?.content) && data.content[0]?.type === "text" ? data.content[0].text : "";

    const html = stripCodeFences(rawText);
    if (!html) {
      return new Response(JSON.stringify({ error: "El modelo no devolvio HTML." }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    return new Response(JSON.stringify({ html }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } catch (err) {
    console.error("Error inesperado:", err);
    return new Response(JSON.stringify({ error: "Error inesperado al generar el HTML." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
