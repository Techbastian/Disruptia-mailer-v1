import type { SaveTemplateInput } from "../lib/db";

export type BaseTemplate = Omit<SaveTemplateInput, "id">;

export const BASE_TEMPLATES: BaseTemplate[] = [
  // ── 1. Citación a entrevistas (estilo clásico) ────────────────────────────
  {
    name: "Citación a entrevistas (clásico)",
    description: "Correo para citar a un espacio de conocimiento o entrevista. Estilo corporativo azul/naranja.",
    variablesCsv: ["nombre"],
    variablesCampaign: ["link_agenda"],
    html: `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f4f4f4;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;max-width:600px;">
      <tr><td style="padding:0;">
        <img src="https://upkvrgncduvxzjvtxbpv.supabase.co/storage/v1/object/public/Imagenes%20Disruptia/banner_presentacion.png" alt="Disruptia" width="600" style="display:block;width:100%;max-width:600px;"/>
      </td></tr>
      <tr><td style="padding:32px 28px;font-family:Arial,sans-serif;font-size:15px;color:#222222;line-height:1.7;">
        <p style="font-size:15px;font-family:Arial,sans-serif;font-weight:bold;margin:0 0 16px;">
          ¡Hola, <span style="color:#0057a8;">{{nombre}}</span>!
        </p>
        <p style="font-size:15px;font-family:Arial,sans-serif;margin:0 0 16px;">Esperamos que estés muy bien. Tenemos una <strong>excelente noticia</strong>: hemos recibido correctamente tus documentos. Gracias por tu compromiso y por el interés de formar parte de este proceso de transformación digital.</p>
        <p style="font-size:15px;font-family:Arial,sans-serif;margin:0 0 16px;">Ahora, queremos conocerte mejor. El siguiente paso en tu camino hacia la empleabilidad es un <strong>espacio de conocimiento</strong>, donde hablaremos sobre tus metas y cómo este proyecto, impulsado por el <strong>Fondo Quiero Ser Digital, GOYN, la Fundación Corona y Corporación Inversor</strong>, puede impulsarte.</p>
        <div style="border-left:4px solid #f5a623;background:#fff8ee;padding:18px 20px;border-radius:6px;margin:24px 0;">
          <p style="font-size:15px;font-family:Arial,sans-serif;font-weight:bold;color:#0057a8;margin:0 0 10px;">📅 ¿Qué debes hacer ahora?</p>
          <p style="font-size:15px;font-family:Arial,sans-serif;color:#444444;margin:0 0 20px;">Elige el horario que mejor te convenga haciendo clic en el siguiente enlace:</p>
          <div style="text-align:center;margin:16px 0;">
            <a href="{{link_agenda}}" style="background-color:#f5a623;color:#ffffff;text-decoration:none;font-family:Arial,sans-serif;font-size:15px;font-weight:bold;padding:12px 32px;border-radius:8px;display:inline-block;">
              👉 Agendar mi entrevista
            </a>
          </div>
          <p style="text-align:center;font-size:13px;font-family:Arial,sans-serif;color:#666666;margin:10px 0 0;">
            <a href="{{link_agenda}}" style="color:#0057a8;text-decoration:underline;font-family:Arial,sans-serif;word-break:break-all;">{{link_agenda}}</a>
          </p>
        </div>
        <div style="border-left:4px solid #0057a8;background:#f0f6ff;padding:18px 20px;border-radius:6px;margin:24px 0;">
          <p style="font-size:15px;font-family:Arial,sans-serif;font-weight:bold;color:#0057a8;margin:0 0 14px;">✅ Recomendaciones para el éxito del espacio</p>
          <div style="background:#ffffff;border:1px solid #d0e4f7;border-radius:6px;padding:14px 16px;margin-bottom:10px;">
            <p style="margin:0;font-size:15px;font-family:Arial,sans-serif;color:#222222;">📶 <strong>Conexión:</strong> Ubícate en un lugar con buena señal de internet.</p>
          </div>
          <div style="background:#ffffff;border:1px solid #d0e4f7;border-radius:6px;padding:14px 16px;margin-bottom:10px;">
            <p style="margin:0;font-size:15px;font-family:Arial,sans-serif;color:#222222;">🎥 <strong>Cámara:</strong> Mantén tu cámara encendida; queremos conocer a la persona detrás del talento.</p>
          </div>
          <div style="background:#ffffff;border:1px solid #d0e4f7;border-radius:6px;padding:14px 16px;margin-bottom:10px;">
            <p style="margin:0;font-size:15px;font-family:Arial,sans-serif;color:#222222;">💡 <strong>Iluminación:</strong> Busca un lugar con buena luz (preferiblemente de frente) para que te veamos bien.</p>
          </div>
          <div style="background:#ffffff;border:1px solid #d0e4f7;border-radius:6px;padding:14px 16px;">
            <p style="margin:0;font-size:15px;font-family:Arial,sans-serif;color:#222222;">🔇 <strong>Entorno:</strong> Elige un espacio tranquilo y sin ruido para que podamos escucharnos sin interrupciones.</p>
          </div>
        </div>
        <p style="text-align:center;font-size:15px;font-family:Arial,sans-serif;font-weight:bold;color:#f5a623;margin:28px 0;">
          ¡Estamos muy emocionados de conversar contigo y acompañarte en este proceso!<br/>Tu futuro digital empieza hoy.
        </p>
        <p style="font-size:15px;font-family:Arial,sans-serif;margin:0;">Atentamente,<br/><strong>Equipo Disruptia | Fondo Quiero Ser Digital</strong></p>
      </td></tr>
      <tr><td style="text-align:center;padding:16px;border-top:1px solid #dddddd;font-family:Arial,sans-serif;">
        <a href="URL_LINKEDIN" style="margin:0 6px;color:#0057a8;text-decoration:none;font-size:15px;font-family:Arial,sans-serif;">LinkedIn</a>
        <a href="URL_INSTAGRAM" style="margin:0 6px;color:#0057a8;text-decoration:none;font-size:15px;font-family:Arial,sans-serif;">Instagram</a>
        <a href="URL_WHATSAPP" style="margin:0 6px;color:#0057a8;text-decoration:none;font-size:15px;font-family:Arial,sans-serif;">WhatsApp</a>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`
  },

  // ── 2. Citación a entrevistas (estilo moderno) ────────────────────────────
  {
    name: "Citación a entrevistas (moderno)",
    description: "Correo para citar a un espacio de conocimiento o entrevista. Estilo moderno violeta con gradiente.",
    variablesCsv: ["nombre"],
    variablesCampaign: ["link_agenda"],
    html: `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>¡Tus documentos llegaron! Agenda tu espacio</title>
</head>
<body style="margin:0; padding:0; background-color:#f0ebff; font-family: Arial, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f0ebff; padding: 32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px; width:100%; background:#ffffff; border-radius:12px; overflow:hidden; border:1px solid #ddd6fe; box-shadow:0 4px 24px rgba(123,59,228,0.10);">
        <tr><td style="padding:0; line-height:0; font-size:0;">
          <img src="https://upkvrgncduvxzjvtxbpv.supabase.co/storage/v1/object/public/Imagenes%20Disruptia/Disruptia%20%20Banner%20(QSD).png" alt="Disruptia" width="600" style="display:block; width:100%; max-width:600px; height:auto;" />
        </td></tr>
        <tr><td style="background:linear-gradient(180deg,#5B21B6 0%,#7B3BE4 35%,#9B5CF6 70%,#EDE9FE 100%); padding:30px 40px 40px; text-align:center;">
          <h1 style="margin:0 0 10px; color:#ffffff; font-size:26px; font-weight:700; line-height:1.35; text-shadow:0 1px 4px rgba(0,0,0,0.18);">
            ¡Documentos recibidos!<br>Agenda tu espacio 📅
          </h1>
          <p style="margin:0; color:#E9D5FF; font-size:14px; line-height:1.5;">
            Fondo Quiero Ser Digital · Siguiente paso en tu proceso
          </p>
        </td></tr>
        <tr><td style="padding:36px 40px 32px; background:#ffffff;">
          <p style="margin:0 0 16px; font-size:15px; color:#1a1a1a; line-height:1.7;">
            ¡Hola, <strong>{{nombre}}</strong>! 👋
          </p>
          <p style="margin:0 0 16px; font-size:15px; color:#333333; line-height:1.7;">
            Esperamos que estés muy bien. Tenemos una excelente noticia: <strong>hemos recibido correctamente tus documentos</strong>. Gracias por tu compromiso y por el interés de formar parte de este proceso de transformación digital.
          </p>
          <p style="margin:0 0 28px; font-size:15px; color:#333333; line-height:1.7;">
            Ahora queremos conocerte mejor. El siguiente paso en tu camino hacia la empleabilidad es un <strong>espacio de conocimiento</strong>, donde hablaremos sobre tus metas y cómo este proyecto puede impulsarte.
          </p>
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
            <tr><td style="background:#F3F0FF; border-radius:10px; padding:24px 28px; text-align:center; border:1px solid #DDD6FE;">
              <p style="margin:0 0 6px; font-size:15px; font-weight:700; color:#5B21B6; line-height:1.5;">¿Qué debes hacer ahora?</p>
              <p style="margin:0 0 18px; font-size:14px; color:#6B7280; line-height:1.6;">Elige el horario que mejor te convenga y reserva tu espacio con un solo clic:</p>
              <a href="{{link_agenda}}" style="display:inline-block; background:#7B3BE4; color:#ffffff; font-size:15px; font-weight:700; text-decoration:none; padding:14px 32px; border-radius:8px; box-shadow:0 2px 8px rgba(123,59,228,0.25);">
                📅 Agendar mi espacio
              </a>
              <p style="margin:14px 0 0; font-size:12px; color:#9CA3AF; line-height:1.5;">
                👉 <a href="{{link_agenda}}" style="color:#7B3BE4; text-decoration:none; word-break:break-all;">{{link_agenda}}</a>
              </p>
            </td></tr>
          </table>
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
            <tr><td style="background:#F9F7FF; border-radius:10px; border:1px solid #DDD6FE; overflow:hidden;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr><td style="background:#7B3BE4; padding:12px 20px;">
                  <p style="margin:0; font-size:14px; font-weight:700; color:#ffffff;">✅ Recomendaciones para el éxito del espacio</p>
                </td></tr>
              </table>
              <table width="100%" cellpadding="0" cellspacing="0" style="padding:16px 20px;">
                <tr><td style="padding:10px 0; border-bottom:1px solid #EDE9FE;">
                  <table width="100%" cellpadding="0" cellspacing="0"><tr>
                    <td width="40" style="vertical-align:middle; padding-right:14px;"><div style="width:34px; height:34px; background:#EDE9FE; border-radius:50%; text-align:center; line-height:34px; font-size:17px;">📶</div></td>
                    <td style="vertical-align:middle;"><p style="margin:0 0 2px; font-size:13px; font-weight:700; color:#1a1a1a;">Conexión</p><p style="margin:0; font-size:13px; color:#6B7280; line-height:1.5;">Ubícate en un lugar con buena señal de internet.</p></td>
                  </tr></table>
                </td></tr>
                <tr><td style="padding:10px 0; border-bottom:1px solid #EDE9FE;">
                  <table width="100%" cellpadding="0" cellspacing="0"><tr>
                    <td width="40" style="vertical-align:middle; padding-right:14px;"><div style="width:34px; height:34px; background:#EDE9FE; border-radius:50%; text-align:center; line-height:34px; font-size:17px;">📷</div></td>
                    <td style="vertical-align:middle;"><p style="margin:0 0 2px; font-size:13px; font-weight:700; color:#1a1a1a;">Cámara</p><p style="margin:0; font-size:13px; color:#6B7280; line-height:1.5;">Mantén tu cámara encendida; queremos conocer a la persona detrás del talento.</p></td>
                  </tr></table>
                </td></tr>
                <tr><td style="padding:10px 0; border-bottom:1px solid #EDE9FE;">
                  <table width="100%" cellpadding="0" cellspacing="0"><tr>
                    <td width="40" style="vertical-align:middle; padding-right:14px;"><div style="width:34px; height:34px; background:#EDE9FE; border-radius:50%; text-align:center; line-height:34px; font-size:17px;">💡</div></td>
                    <td style="vertical-align:middle;"><p style="margin:0 0 2px; font-size:13px; font-weight:700; color:#1a1a1a;">Iluminación</p><p style="margin:0; font-size:13px; color:#6B7280; line-height:1.5;">Busca un lugar con buena luz (preferiblemente de frente) para que te veamos bien.</p></td>
                  </tr></table>
                </td></tr>
                <tr><td style="padding:10px 0 0;">
                  <table width="100%" cellpadding="0" cellspacing="0"><tr>
                    <td width="40" style="vertical-align:middle; padding-right:14px;"><div style="width:34px; height:34px; background:#EDE9FE; border-radius:50%; text-align:center; line-height:34px; font-size:17px;">🔇</div></td>
                    <td style="vertical-align:middle;"><p style="margin:0 0 2px; font-size:13px; font-weight:700; color:#1a1a1a;">Entorno</p><p style="margin:0; font-size:13px; color:#6B7280; line-height:1.5;">Elige un espacio tranquilo y sin ruido para que podamos escucharnos sin interrupciones.</p></td>
                  </tr></table>
                </td></tr>
              </table>
            </td></tr>
          </table>
          <p style="margin:0 0 4px; font-size:15px; font-weight:700; color:#1a1a1a; text-align:center; line-height:1.5;">¡Estamos muy emocionados de conversar contigo! 🎉🚀</p>
          <p style="margin:0 0 16px; font-size:14px; color:#555555; text-align:center; line-height:1.6;">Tu futuro digital empieza hoy. ¡Te esperamos!</p>
          <p style="margin:0 0 4px; font-size:14px; color:#555555; text-align:center;">El equipo de <span style="background-color:#FDE68A; padding:1px 3px; border-radius:3px; font-weight:600; color:#111;">Disruptia</span></p>
          <p style="margin:0; font-size:12px; color:#9CA3AF; text-align:center;">En alianza con el <strong style="color:#D97706;">Fondo Quiero Ser Digital</strong></p>
        </td></tr>
        <tr><td style="background:linear-gradient(180deg,#f8f5ff 0%,#f0ebff 100%); padding:20px 40px; border-top:1px solid #ede9fe; text-align:center;">
          <p style="margin:0 0 4px; font-size:12px; color:#888888; line-height:1.6;"><strong style="color:#7B3BE4;">Disruptia</strong> · Conectando talento con oportunidades</p>
          <p style="margin:0; font-size:12px; color:#aaaaaa; line-height:1.6;">¿Preguntas? Escríbenos a <a href="mailto:soporte@disruptia.co" style="color:#7B3BE4; text-decoration:none;">soporte@disruptia.co</a></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
  },

  // ── 3. Para quien no continúa ─────────────────────────────────────────────
  {
    name: "Para quien no continúa",
    description: "Correo para participantes que no avanzan en el proceso. Cierra con respeto y mantiene el vínculo con Disruptia.",
    variablesCsv: ["nombre"],
    variablesCampaign: ["link_plataforma"],
    html: `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Tu camino con Disruptia continúa</title>
</head>
<body style="margin:0; padding:0; background-color:#f0ebff; font-family: Arial, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f0ebff; padding: 32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px; width:100%; background:#ffffff; border-radius:12px; overflow:hidden; border:1px solid #ddd6fe; box-shadow:0 4px 24px rgba(123,59,228,0.10);">
        <tr><td style="padding:0; line-height:0; font-size:0;">
          <img src="https://upkvrgncduvxzjvtxbpv.supabase.co/storage/v1/object/public/Imagenes%20Disruptia/Disruptia%20%20Banner%20(QSD).png" alt="Disruptia" width="600" style="display:block; width:100%; max-width:600px; height:auto;" />
        </td></tr>
        <tr><td style="background:linear-gradient(180deg,#5B21B6 0%,#7B3BE4 35%,#9B5CF6 70%,#EDE9FE 100%); padding:30px 40px 40px; text-align:center;">
          <h1 style="margin:0 0 10px; color:#ffffff; font-size:26px; font-weight:700; line-height:1.35; text-shadow:0 1px 4px rgba(0,0,0,0.18);">
            Tenemos noticias sobre<br>tu postulación 💌
          </h1>
          <p style="margin:0; color:#E9D5FF; font-size:14px; font-weight:400; line-height:1.5;">
            Fondo Quiero Ser Digital · Programa de Intermediación Laboral
          </p>
        </td></tr>
        <tr><td style="padding:36px 40px 32px; background:#ffffff;">
          <p style="margin:0 0 16px; font-size:15px; color:#1a1a1a; line-height:1.7;">
            Hola, <strong>{{nombre}}</strong> 👋
          </p>
          <p style="margin:0 0 16px; font-size:15px; color:#333333; line-height:1.7;">
            Desde el equipo de <span style="background-color:#FDE68A; padding:1px 3px; border-radius:3px; font-weight:600; color:#111;">Disruptia</span> y el <strong style="color:#D97706;">Fondo Quiero Ser Digital</strong>, queremos agradecerte sinceramente por haber completado el primer paso de postulación para nuestro programa de Intermediación Laboral.
          </p>
          <p style="margin:0 0 28px; font-size:15px; color:#333333; line-height:1.7;">
            Tras revisar tu perfil en este primer filtro, queremos informarte que por el momento tu perfil quedará reservado para esta convocatoria específica. Sin embargo, <strong>¡esto no es el final del camino!</strong>
          </p>
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
            <tr><td style="background:#F3F0FF; border-radius:10px; padding:22px 24px; border:1px solid #DDD6FE;">
              <p style="margin:0 0 18px; font-size:15px; font-weight:700; color:#5B21B6;">Tu talento nos interesa y queremos seguir acompañándote 💜</p>
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;">
                <tr>
                  <td width="36" style="vertical-align:top; padding-right:14px; padding-top:2px;">
                    <div style="width:28px; height:28px; background:#7B3BE4; border-radius:50%; text-align:center; line-height:28px; font-size:13px; font-weight:700; color:white;">1</div>
                  </td>
                  <td style="vertical-align:top;">
                    <p style="margin:0 0 8px; font-size:14px; color:#1a1a1a; line-height:1.6;"><strong>Regístrate en nuestra plataforma oficial</strong></p>
                    <p style="margin:0 0 10px; font-size:13px; color:#555555; line-height:1.6;">Completa tu perfil y postúlate directamente a vacantes digitales.</p>
                    <a href="{{link_plataforma}}" style="display:inline-block; background:#7B3BE4; color:#ffffff; font-size:14px; font-weight:700; text-decoration:none; padding:11px 22px; border-radius:8px; box-shadow:0 2px 8px rgba(123,59,228,0.25);">
                      🚀 Crear mi perfil en Disruptia
                    </a>
                  </td>
                </tr>
              </table>
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;">
                <tr><td style="height:1px; background:#DDD6FE; font-size:0; line-height:0;">&nbsp;</td></tr>
              </table>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td width="36" style="vertical-align:top; padding-right:14px; padding-top:2px;">
                    <div style="width:28px; height:28px; background:#7B3BE4; border-radius:50%; text-align:center; line-height:28px; font-size:13px; font-weight:700; color:white;">2</div>
                  </td>
                  <td style="vertical-align:top;">
                    <p style="margin:0 0 8px; font-size:14px; color:#1a1a1a; line-height:1.6;"><strong>Síguenos en redes sociales</strong></p>
                    <p style="margin:0; font-size:13px; color:#555555; line-height:1.6;">Mantente atento a las oportunidades que publicamos junto a nuestros aliados.</p>
                  </td>
                </tr>
              </table>
            </td></tr>
          </table>
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
            <tr><td style="background:#FFF7ED; border-radius:10px; padding:16px 20px; border:1px solid #FDE68A; text-align:center;">
              <p style="margin:0; font-size:14px; color:#92400E; line-height:1.7;">
                En <span style="background-color:#FDE68A; padding:1px 3px; border-radius:3px; font-weight:600; color:#111;">Disruptia</span> sabemos que <strong>cada paso es aprendizaje</strong> y estás más cerca de donde quieres llegar. ¡Sigue fortaleciendo tus habilidades!
              </p>
            </td></tr>
          </table>
          <p style="margin:0 0 4px; font-size:15px; font-weight:700; color:#1a1a1a; text-align:center; line-height:1.5;">¡Sigue aprendiendo y creciendo! 💪🚀</p>
          <p style="margin:0 0 4px; font-size:14px; color:#555555; text-align:center;">El equipo de <span style="background-color:#FDE68A; padding:1px 3px; border-radius:3px; font-weight:600; color:#111;">Disruptia</span></p>
          <p style="margin:0; font-size:12px; color:#9CA3AF; text-align:center;">En alianza con el <strong style="color:#D97706;">Fondo Quiero Ser Digital</strong></p>
        </td></tr>
        <tr><td style="background:linear-gradient(180deg,#f8f5ff 0%,#f0ebff 100%); padding:20px 40px; border-top:1px solid #ede9fe; text-align:center;">
          <p style="margin:0 0 4px; font-size:12px; color:#888888; line-height:1.6;"><strong style="color:#7B3BE4;">Disruptia</strong> · Conectando talento con oportunidades</p>
          <p style="margin:0; font-size:12px; color:#aaaaaa; line-height:1.6;">¿Preguntas? Escríbenos a <a href="mailto:soporte@disruptia.co" style="color:#7B3BE4; text-decoration:none;">soporte@disruptia.co</a></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
  },

  // ── 4. Solicitar documentos ───────────────────────────────────────────────
  {
    name: "Solicitar documentos",
    description: "Correo para solicitar documentos a participantes que cumplen requisitos. Lista los documentos requeridos con instrucciones claras.",
    variablesCsv: ["nombre"],
    variablesCampaign: [],
    html: `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>¡Cumples con los requisitos! Necesitamos tus documentos</title>
</head>
<body style="margin:0; padding:0; background-color:#f0ebff; font-family: Arial, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f0ebff; padding: 32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px; width:100%; background:#ffffff; border-radius:12px; overflow:hidden; border:1px solid #ddd6fe; box-shadow:0 4px 24px rgba(123,59,228,0.10);">
        <tr><td style="padding:0; line-height:0; font-size:0;">
          <img src="https://upkvrgncduvxzjvtxbpv.supabase.co/storage/v1/object/public/Imagenes%20Disruptia/Disruptia%20%20Banner%20(QSD).png" alt="Disruptia" width="600" style="display:block; width:100%; max-width:600px; height:auto;" />
        </td></tr>
        <tr><td style="background:linear-gradient(180deg,#5B21B6 0%,#7B3BE4 35%,#9B5CF6 70%,#EDE9FE 100%); padding:30px 40px 40px; text-align:center;">
          <h1 style="margin:0 0 8px; color:#ffffff; font-size:26px; font-weight:700; line-height:1.35; text-shadow:0 1px 4px rgba(0,0,0,0.18);">¡Cumples con los requisitos! 🎉</h1>
          <p style="margin:0; color:#E9D5FF; font-size:15px; font-weight:400; line-height:1.4;">Necesitamos unos documentos para continuar</p>
        </td></tr>
        <tr><td style="padding:36px 40px 32px; background:#ffffff;">
          <p style="margin:0 0 16px; font-size:15px; color:#1a1a1a; line-height:1.7;">¡Hola, <strong>{{nombre}}</strong>! 👋</p>
          <p style="margin:0 0 16px; font-size:15px; color:#333333; line-height:1.7;">Tenemos muy buenas noticias: <strong>tu perfil cumple con los requisitos</strong> que buscamos y queremos seguir avanzando contigo en el proceso.</p>
          <p style="margin:0 0 28px; font-size:15px; color:#333333; line-height:1.7;">En <span style="background-color:#FDE68A; padding:1px 3px; border-radius:3px; font-weight:600; color:#111;">Disruptia</span> valoramos cada detalle de tu proceso, por eso necesitamos que nos compartas los siguientes documentos para continuar:</p>
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:12px;">
            <tr><td style="background:#F9F7FF; border-radius:10px; border:1px solid #DDD6FE; overflow:hidden;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td width="60" style="background:#7B3BE4; padding:0; text-align:center; vertical-align:middle; width:60px;"><p style="margin:0; font-size:26px; padding:18px 0;">🪪</p></td>
                  <td style="padding:16px 20px; vertical-align:middle;">
                    <p style="margin:0 0 2px; font-size:13px; color:#7B3BE4; font-weight:700; text-transform:uppercase; letter-spacing:0.05em;">Documento 1</p>
                    <p style="margin:0 0 4px; font-size:15px; font-weight:700; color:#1a1a1a;">Cédula de ciudadanía</p>
                    <p style="margin:0; font-size:13px; color:#6B7280; line-height:1.5;">Copia del documento por ambas caras, en formato PDF o imagen clara (JPG, PNG).</p>
                  </td>
                </tr>
              </table>
            </td></tr>
          </table>
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:12px;">
            <tr><td style="background:#F9F7FF; border-radius:10px; border:1px solid #DDD6FE; overflow:hidden;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td width="60" style="background:#7B3BE4; padding:0; text-align:center; vertical-align:middle; width:60px;"><p style="margin:0; font-size:26px; padding:18px 0;">🏠</p></td>
                  <td style="padding:16px 20px; vertical-align:middle;">
                    <p style="margin:0 0 2px; font-size:13px; color:#7B3BE4; font-weight:700; text-transform:uppercase; letter-spacing:0.05em;">Documento 2</p>
                    <p style="margin:0 0 4px; font-size:15px; font-weight:700; color:#1a1a1a;">Recibo de servicio público</p>
                    <p style="margin:0; font-size:13px; color:#6B7280; line-height:1.5;">Último recibo de agua, luz o gas del lugar donde resides actualmente. Debe ser reciente (no mayor a 3 meses).</p>
                  </td>
                </tr>
              </table>
            </td></tr>
          </table>
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
            <tr><td style="background:#F9F7FF; border-radius:10px; border:1px solid #DDD6FE; overflow:hidden;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td width="60" style="background:#7B3BE4; padding:0; text-align:center; vertical-align:middle; width:60px;"><p style="margin:0; font-size:26px; padding:18px 0;">🤝</p></td>
                  <td style="padding:16px 20px; vertical-align:middle;">
                    <p style="margin:0 0 2px; font-size:13px; color:#7B3BE4; font-weight:700; text-transform:uppercase; letter-spacing:0.05em;">Documento 3</p>
                    <p style="margin:0 0 4px; font-size:15px; font-weight:700; color:#1a1a1a;">Acuerdo de corresponsabilidad</p>
                    <p style="margin:0; font-size:13px; color:#6B7280; line-height:1.5;">Descarga el documento, diligéncialo completo, fírmalo y envíalo en formato PDF.</p>
                  </td>
                </tr>
              </table>
            </td></tr>
          </table>
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
            <tr><td style="background:#F3F0FF; border-radius:10px; padding:22px 28px; text-align:center; border:1px solid #DDD6FE;">
              <p style="margin:0 0 6px; font-size:14px; color:#5B21B6; line-height:1.5; font-weight:600;">Envía tus documentos respondiendo directamente a este correo</p>
              <p style="margin:0 0 16px; font-size:13px; color:#7C3AED; line-height:1.5;">o escríbenos con el asunto <strong>"Documentos – [Tu nombre]"</strong></p>
              <a href="mailto:soporte@disruptia.co?subject=Documentos" style="display:inline-block; background:#7B3BE4; color:#ffffff; font-size:15px; font-weight:700; text-decoration:none; padding:13px 30px; border-radius:8px; box-shadow:0 2px 8px rgba(123,59,228,0.25);">💜 Enviar mis documentos</a>
            </td></tr>
          </table>
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
            <tr><td style="background:#FFF7ED; border-radius:10px; padding:16px 20px; border:1px solid #FDE68A;">
              <p style="margin:0 0 8px; font-size:13px; font-weight:700; color:#92400E;">📌 Ten en cuenta:</p>
              <ul style="margin:0; padding-left:18px; font-size:13px; color:#78350F; line-height:1.9;">
                <li>Envía los tres documentos en un solo correo para agilizar tu proceso.</li>
                <li>Asegúrate de que las imágenes o PDFs sean legibles y estén completos.</li>
                <li>Entre más pronto los enviés, más rápido avanzamos juntos.</li>
              </ul>
            </td></tr>
          </table>
          <p style="margin:8px 0 4px; font-size:15px; font-weight:700; color:#1a1a1a; text-align:center; line-height:1.5;">¡Estamos muy cerca de conectarte con tu próxima oportunidad! 🚀💼</p>
          <p style="margin:0; font-size:14px; color:#555555; text-align:center;">El equipo de <span style="background-color:#FDE68A; padding:1px 3px; border-radius:3px; font-weight:600; color:#111;">Disruptia</span></p>
        </td></tr>
        <tr><td style="background:linear-gradient(180deg,#f8f5ff 0%,#f0ebff 100%); padding:20px 40px; border-top:1px solid #ede9fe; text-align:center;">
          <p style="margin:0 0 4px; font-size:12px; color:#888888; line-height:1.6;"><strong style="color:#7B3BE4;">Disruptia</strong> · Conectando talento con oportunidades</p>
          <p style="margin:0; font-size:12px; color:#aaaaaa; line-height:1.6;">¿Preguntas? Escríbenos a <a href="mailto:soporte@disruptia.co" style="color:#7B3BE4; text-decoration:none;">soporte@disruptia.co</a></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
  },

  // ── 5. Invitación a proyecto ──────────────────────────────────────────────
  {
    name: "Invitación a proyecto",
    description: "Correo para invitar a participantes a un nuevo proyecto o convocatoria. Incluye beneficios y dos CTAs: conocer el proyecto e inscribirse.",
    variablesCsv: ["nombre"],
    variablesCampaign: ["link_proyecto", "link_inscripcion"],
    html: `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Una oportunidad única te espera</title>
</head>
<body style="margin:0; padding:0; background-color:#f0ebff; font-family: Arial, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f0ebff; padding: 32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px; width:100%; background:#ffffff; border-radius:12px; overflow:hidden; border:1px solid #ddd6fe; box-shadow:0 4px 24px rgba(123,59,228,0.10);">
        <tr><td style="padding:0; line-height:0; font-size:0;">
          <img src="https://upkvrgncduvxzjvtxbpv.supabase.co/storage/v1/object/public/Imagenes%20Disruptia/Disruptia%20%20Banner%20(QSD).png" alt="Disruptia" width="600" style="display:block; width:100%; max-width:600px; height:auto;" />
        </td></tr>
        <tr><td style="background:linear-gradient(180deg,#5B21B6 0%,#7B3BE4 35%,#9B5CF6 70%,#EDE9FE 100%); padding:30px 40px 40px; text-align:center;">
          <h1 style="margin:0 0 10px; color:#ffffff; font-size:26px; font-weight:700; line-height:1.35; text-shadow:0 1px 4px rgba(0,0,0,0.18);">
            ¡Una oportunidad única<br>te espera! 🚀
          </h1>
          <p style="margin:0; color:#E9D5FF; font-size:14px; font-weight:400; line-height:1.5;">
            Fondo Quiero Ser Digital · Una convocatoria especial para ti
          </p>
        </td></tr>
        <tr><td style="padding:36px 40px 32px; background:#ffffff;">
          <p style="margin:0 0 16px; font-size:15px; color:#1a1a1a; line-height:1.7;">
            Hola, <strong>{{nombre}}</strong> 👋
          </p>
          <p style="margin:0 0 16px; font-size:15px; color:#333333; line-height:1.7;">
            Sabemos que tienes el talento y las ganas de transformar tu futuro. Por eso, desde <span style="background-color:#FDE68A; padding:1px 3px; border-radius:3px; font-weight:600; color:#111;">Disruptia</span>, en alianza con el <strong style="color:#D97706;">Fondo Quiero Ser Digital</strong>, queremos invitarte a ser parte de una oportunidad única.
          </p>
          <p style="margin:0 0 28px; font-size:15px; color:#333333; line-height:1.7;">
            Esta no es solo una formación; es tu <strong>puente directo hacia el empleo formal</strong> en las mejores empresas tecnológicas del país.
          </p>
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
            <tr><td style="background:#F3F0FF; border-radius:10px; padding:22px 24px; border:1px solid #DDD6FE;">
              <p style="margin:0 0 16px; font-size:15px; font-weight:700; color:#5B21B6;">¿Qué ganas al participar? 🌟</p>
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:10px;">
                <tr>
                  <td width="36" style="vertical-align:top; padding-right:12px;"><div style="width:32px; height:32px; background:#7B3BE4; border-radius:50%; text-align:center; line-height:32px; font-size:15px;">✨</div></td>
                  <td style="vertical-align:middle;"><p style="margin:0; font-size:14px; color:#333333; line-height:1.6;"><strong>Acompañamiento</strong> para que tu perfil destaque ante las empresas.</p></td>
                </tr>
              </table>
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:10px;">
                <tr>
                  <td width="36" style="vertical-align:top; padding-right:12px;"><div style="width:32px; height:32px; background:#7B3BE4; border-radius:50%; text-align:center; line-height:32px; font-size:15px;">💼</div></td>
                  <td style="vertical-align:middle;"><p style="margin:0; font-size:14px; color:#333333; line-height:1.6;"><strong>Conexión directa</strong> con empresas que buscan tu talento digital.</p></td>
                </tr>
              </table>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td width="36" style="vertical-align:top; padding-right:12px;"><div style="width:32px; height:32px; background:#7B3BE4; border-radius:50%; text-align:center; line-height:32px; font-size:15px;">🤝</div></td>
                  <td style="vertical-align:middle;"><p style="margin:0; font-size:14px; color:#333333; line-height:1.6;">El <strong>respaldo de una red de aliados</strong> enfocados en tu éxito.</p></td>
                </tr>
              </table>
            </td></tr>
          </table>
          <p style="margin:0 0 20px; font-size:16px; font-weight:700; color:#1a1a1a; line-height:1.5;">¿Quieres dar el salto? 🎯</p>
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:12px;">
            <tr>
              <td width="36" style="vertical-align:top; padding-right:14px; padding-top:2px;">
                <div style="width:28px; height:28px; background:#7B3BE4; border-radius:50%; text-align:center; line-height:28px; font-size:13px; font-weight:700; color:white;">1</div>
              </td>
              <td style="vertical-align:top;">
                <p style="margin:0 0 6px; font-size:14px; color:#333333; line-height:1.6;">Conoce todos los detalles del proyecto:</p>
                <a href="{{link_proyecto}}" style="display:inline-block; font-size:14px; font-weight:600; color:#7B3BE4; text-decoration:none; background:#F3F0FF; padding:8px 16px; border-radius:8px; border:1px solid #DDD6FE;">
                  🌐 Ver proyecto
                </a>
              </td>
            </tr>
          </table>
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
            <tr>
              <td width="36" style="vertical-align:top; padding-right:14px; padding-top:2px;">
                <div style="width:28px; height:28px; background:#7B3BE4; border-radius:50%; text-align:center; line-height:28px; font-size:13px; font-weight:700; color:white;">2</div>
              </td>
              <td style="vertical-align:top;">
                <p style="margin:0 0 10px; font-size:14px; color:#333333; line-height:1.6;">¡No pierdas tiempo! Inscríbete directamente:</p>
                <a href="{{link_inscripcion}}" style="display:inline-block; background:#7B3BE4; color:#ffffff; font-size:15px; font-weight:700; text-decoration:none; padding:13px 28px; border-radius:8px; box-shadow:0 2px 8px rgba(123,59,228,0.25);">
                  👉 POSTÚLATE AQUÍ
                </a>
              </td>
            </tr>
          </table>
          <p style="margin:0 0 4px; font-size:15px; font-weight:700; color:#1a1a1a; text-align:center; line-height:1.5;">¡Sigue creciendo y transformando tu futuro! 💪🚀</p>
          <p style="margin:0; font-size:14px; color:#555555; text-align:center;">El equipo de <span style="background-color:#FDE68A; padding:1px 3px; border-radius:3px; font-weight:600; color:#111;">Disruptia</span></p>
        </td></tr>
        <tr><td style="background:linear-gradient(180deg,#f8f5ff 0%,#f0ebff 100%); padding:20px 40px; border-top:1px solid #ede9fe; text-align:center;">
          <p style="margin:0 0 4px; font-size:12px; color:#888888; line-height:1.6;"><strong style="color:#7B3BE4;">Disruptia</strong> · Conectando talento con oportunidades</p>
          <p style="margin:0; font-size:12px; color:#aaaaaa; line-height:1.6;">¿Preguntas? Escríbenos a <a href="mailto:soporte@disruptia.co" style="color:#7B3BE4; text-decoration:none;">soporte@disruptia.co</a></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
  },

  // ── 6. Acceso a plataforma ────────────────────────────────────────────────
  {
    name: "Acceso a plataforma",
    description: "Correo para compartir credenciales de acceso a la plataforma Disruptia. Ideal para participantes registrados en ferias o eventos.",
    variablesCsv: ["nombre"],
    variablesCampaign: ["link_plataforma", "nombre_evento", "fecha_evento"],
    html: `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Tu acceso a Disruptia ya está listo</title>
</head>
<body style="margin:0; padding:0; background-color:#f0ebff; font-family: Arial, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f0ebff; padding: 32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px; width:100%; background:#ffffff; border-radius:12px; overflow:hidden; border:1px solid #ddd6fe; box-shadow:0 4px 24px rgba(123,59,228,0.10);">
        <tr><td style="padding:0; line-height:0; font-size:0;">
          <img src="https://upkvrgncduvxzjvtxbpv.supabase.co/storage/v1/object/public/Imagenes%20Disruptia/Disruptia%20%20Banner%20(QSD).png" alt="Disruptia" width="600" style="display:block; width:100%; max-width:600px; height:auto;" />
        </td></tr>
        <tr><td style="background:linear-gradient(180deg,#5B21B6 0%,#7B3BE4 35%,#9B5CF6 70%,#EDE9FE 100%); padding:30px 40px 40px; text-align:center;">
          <h1 style="margin:0; color:#ffffff; font-size:26px; font-weight:700; line-height:1.35; text-shadow:0 1px 4px rgba(0,0,0,0.18);">🔓 ¡Tu acceso a Disruptia<br>ya está listo!</h1>
        </td></tr>
        <tr><td style="padding:36px 40px 32px; background:#ffffff;">
          <p style="margin:0 0 16px; font-size:15px; color:#1a1a1a; line-height:1.7;">¡Hola, <strong>{{nombre}}</strong>! 👋</p>
          <p style="margin:0 0 16px; font-size:15px; color:#333333; line-height:1.7;">Fue un placer encontrarte en la <strong style="color:#D97706;">{{nombre_evento}}</strong> {{fecha_evento}}. Gracias por compartir tu información con nosotros.</p>
          <p style="margin:0 0 16px; font-size:15px; color:#333333; line-height:1.7;">En <span style="background-color:#FDE68A; padding:1px 3px; border-radius:3px; font-weight:600; color:#111;">Disruptia</span> ya creamos tu acceso a la plataforma con los datos que nos diste. No necesitas registrarte, ¡ya estás dentro!</p>
          <p style="margin:0 0 24px; font-size:15px; color:#333333; line-height:1.7;">Para ingresar, solo necesitas dos cosas:</p>
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
            <tr><td style="background:#F3F0FF; border-radius:10px; padding:20px 24px; border:1px solid #DDD6FE;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td width="48" style="vertical-align:top; padding-right:16px; padding-bottom:16px;">
                    <div style="width:40px; height:40px; background:#7B3BE4; border-radius:50%; text-align:center; line-height:40px; font-size:18px; color:white;">🪪</div>
                  </td>
                  <td style="vertical-align:middle; padding-bottom:16px;">
                    <p style="margin:0; font-size:13px; color:#6B7280;">Usuario</p>
                    <p style="margin:4px 0 0; font-size:15px; font-weight:700; color:#1a1a1a;">Tu número de cédula</p>
                  </td>
                </tr>
                <tr><td colspan="2" style="height:1px; background:#DDD6FE; padding:0; font-size:0; line-height:0;">&nbsp;</td></tr>
                <tr>
                  <td width="48" style="vertical-align:top; padding-right:16px; padding-top:16px;">
                    <div style="width:40px; height:40px; background:#7B3BE4; border-radius:50%; text-align:center; line-height:40px; font-size:18px; color:white;">🎂</div>
                  </td>
                  <td style="vertical-align:middle; padding-top:16px;">
                    <p style="margin:0; font-size:13px; color:#6B7280;">Contraseña</p>
                    <p style="margin:4px 0 0; font-size:15px; font-weight:700; color:#1a1a1a;">Tu fecha de nacimiento</p>
                    <p style="margin:4px 0 0; font-size:12px; color:#9CA3AF;">Formato: DD/MM/AAAA</p>
                  </td>
                </tr>
              </table>
            </td></tr>
          </table>
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
            <tr><td style="text-align:center;">
              <a href="{{link_plataforma}}" style="display:inline-block; background:#7B3BE4; color:#ffffff; font-size:15px; font-weight:700; text-decoration:none; padding:14px 36px; border-radius:8px; box-shadow:0 2px 8px rgba(123,59,228,0.25);">💜 Ingresar a Disruptia</a>
            </td></tr>
          </table>
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:8px;">
            <tr><td style="background:#FFF7ED; border-radius:10px; padding:16px 20px; border:1px solid #FDE68A;">
              <p style="margin:0 0 8px; font-size:13px; font-weight:700; color:#92400E;">📌 Recuerda:</p>
              <ul style="margin:0; padding-left:18px; font-size:13px; color:#78350F; line-height:1.8;">
                <li>Una vez adentro, completa tu perfil para que las empresas puedan encontrarte.</li>
                <li>Explora las vacantes disponibles y postúlate a las que más te interesen.</li>
                <li>Si tienes algún problema al ingresar, escríbenos y te ayudamos de inmediato.</li>
              </ul>
            </td></tr>
          </table>
          <p style="margin:24px 0 4px; font-size:15px; font-weight:700; color:#1a1a1a; text-align:center; line-height:1.5;">¡Tu próxima oportunidad ya te está esperando! 💪🚀</p>
          <p style="margin:0; font-size:14px; color:#555555; text-align:center;">El equipo de <span style="background-color:#FDE68A; padding:1px 3px; border-radius:3px; font-weight:600; color:#111;">Disruptia</span></p>
        </td></tr>
        <tr><td style="background:linear-gradient(180deg,#f8f5ff 0%,#f0ebff 100%); padding:20px 40px; border-top:1px solid #ede9fe; text-align:center;">
          <p style="margin:0 0 4px; font-size:12px; color:#888888; line-height:1.6;"><strong style="color:#7B3BE4;">Disruptia</strong> · Conectando talento con oportunidades</p>
          <p style="margin:0; font-size:12px; color:#aaaaaa; line-height:1.6;">¿Preguntas? Escríbenos a <a href="mailto:soporte@disruptia.co" style="color:#7B3BE4; text-decoration:none;">soporte@disruptia.co</a></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
  }
];
