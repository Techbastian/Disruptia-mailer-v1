import { extractColumnNames, readFileRows } from "./csv";

// E.164: "+" + codigo de pais (1-9) + hasta 14 digitos mas (total 8-15 digitos).
const E164_REGEX = /^\+[1-9]\d{7,14}$/;

export type WhatsAppContact = {
  phone: string; // normalizado E.164
  name?: string;
  [key: string]: string | undefined;
};

export type WhatsAppInvalidRow = {
  rowNumber: number;
  phone: string;
  reason: string;
};

export type WhatsAppMetrics = {
  totalLoaded: number;
  validPhones: number;
  invalidPhones: number;
  duplicatesRemoved: number;
};

export type WhatsAppParseResult = {
  contacts: WhatsAppContact[];
  metrics: WhatsAppMetrics;
  columnNames: string[];
  invalidRows: WhatsAppInvalidRow[];
};

/**
 * Normaliza a E.164: quita espacios, guiones, parentesis y puntos.
 * Convierte "00" inicial (prefijo internacional) en "+". No inventa codigo de pais:
 * si no queda con "+", se marca invalido.
 */
export function normalizePhone(raw: string): string {
  let p = raw.trim();
  if (!p) return "";
  if (p.startsWith("00")) p = `+${p.slice(2)}`;
  // Conserva un "+" inicial; elimina todo lo que no sea digito del resto.
  const hasPlus = p.startsWith("+");
  const digits = p.replace(/\D/g, "");
  return hasPlus ? `+${digits}` : digits;
}

function findPhoneKey(keys: string[]): string | undefined {
  return keys.find((k) => {
    const low = k.toLowerCase();
    return (
      low.includes("tel") ||
      low.includes("phone") ||
      low.includes("celular") ||
      low.includes("movil") ||
      low.includes("móvil") ||
      low.includes("whatsapp") ||
      low === "numero" ||
      low === "número"
    );
  });
}

function normalizeRow(row: Record<string, unknown>): WhatsAppContact {
  const keys = Object.keys(row);
  const phoneKey = findPhoneKey(keys) ?? "phone";
  const phone = normalizePhone(String(row[phoneKey] ?? ""));
  const name = String(row["nombre"] ?? row["name"] ?? row["firstName"] ?? "").trim() || undefined;

  const record: WhatsAppContact = { phone, name };
  for (const key of keys) {
    const normalizedKey = key.trim().toLowerCase();
    record[normalizedKey] = String(row[key] ?? "").trim() || undefined;
  }
  return record;
}

function processRows(rows: Record<string, unknown>[]): Omit<WhatsAppParseResult, "columnNames"> {
  const seen = new Set<string>();
  const contacts: WhatsAppContact[] = [];
  const invalidRows: WhatsAppInvalidRow[] = [];
  let duplicatesRemoved = 0;

  for (let i = 0; i < rows.length; i++) {
    const normalized = normalizeRow(rows[i]);
    const rowNumber = i + 2; // +2: encabezado fila 1, datos desde la 2

    if (!normalized.phone) {
      invalidRows.push({ rowNumber, phone: "(vacío)", reason: "El teléfono está vacío" });
      continue;
    }
    if (!E164_REGEX.test(normalized.phone)) {
      invalidRows.push({
        rowNumber,
        phone: normalized.phone,
        reason: "Formato inválido. Debe ser E.164 con código de país, ej. +573001234567"
      });
      continue;
    }
    if (seen.has(normalized.phone)) {
      duplicatesRemoved += 1;
      continue;
    }
    seen.add(normalized.phone);
    contacts.push(normalized);
  }

  return {
    contacts,
    invalidRows,
    metrics: {
      totalLoaded: rows.length,
      validPhones: contacts.length,
      invalidPhones: invalidRows.length,
      duplicatesRemoved
    }
  };
}

export async function parseWhatsAppContactsFile(file: File): Promise<WhatsAppParseResult> {
  const rows = await readFileRows(file);
  return { ...processRows(rows), columnNames: extractColumnNames(rows) };
}
