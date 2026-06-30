import Papa from "papaparse";
import * as XLSX from "xlsx";
import type { CampaignMetrics, ContactRecord } from "../types";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

export type InvalidRow = {
  rowNumber: number;
  email: string;
  reason: string;
};

export type ParseResult = {
  contacts: ContactRecord[];
  metrics: CampaignMetrics;
  columnNames: string[];
  invalidRows: InvalidRow[];
};

function normalizeRow(row: Record<string, unknown>): ContactRecord {
  const keys = Object.keys(row);
  const emailKey = keys.find((k) => k.toLowerCase().includes("mail")) ?? "email";
  const email = String(row[emailKey] ?? "").trim().toLowerCase();
  const firstName = String(row["firstName"] ?? row["nombre"] ?? "").trim() || undefined;
  const lastName = String(row["lastName"] ?? row["apellido"] ?? "").trim() || undefined;

  // Preserve every original column with a normalized key so N8N can substitute {{variable}}
  const record: ContactRecord = { email, firstName, lastName };
  for (const key of keys) {
    const normalizedKey = key.trim().toLowerCase();
    record[normalizedKey] = String(row[key] ?? "").trim() || undefined;
  }
  return record;
}

function processRows(rows: Record<string, unknown>[]): Omit<ParseResult, "columnNames"> {
  const seen = new Set<string>();
  const contacts: ContactRecord[] = [];
  const invalidRows: InvalidRow[] = [];
  let duplicatesRemoved = 0;

  for (let i = 0; i < rows.length; i++) {
    const normalized = normalizeRow(rows[i]);
    const rowNumber = i + 2; // +2: header is row 1, data starts at row 2

    if (!normalized.email) {
      invalidRows.push({ rowNumber, email: "(vacío)", reason: "El correo está vacío" });
      continue;
    }
    if (!EMAIL_REGEX.test(normalized.email)) {
      invalidRows.push({ rowNumber, email: normalized.email, reason: "Formato de correo inválido" });
      continue;
    }
    if (seen.has(normalized.email)) {
      duplicatesRemoved += 1;
      continue;
    }
    seen.add(normalized.email);
    contacts.push(normalized);
  }

  return {
    contacts,
    invalidRows,
    metrics: {
      totalLoaded: rows.length,
      validEmails: contacts.length,
      invalidEmails: invalidRows.length,
      duplicatesRemoved
    }
  };
}

export function extractColumnNames(rows: Record<string, unknown>[]): string[] {
  if (rows.length === 0) return [];
  return Object.keys(rows[0]).map((k) => k.trim().toLowerCase());
}

/** Lee filas de un .csv o .xlsx como objetos planos (clave = encabezado). */
export async function readFileRows(file: File): Promise<Record<string, unknown>[]> {
  const extension = file.name.split(".").pop()?.toLowerCase();

  if (extension === "xlsx") {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array" });
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    return XLSX.utils.sheet_to_json<Record<string, unknown>>(firstSheet);
  }

  const text = await file.text();
  const parsed = Papa.parse<Record<string, unknown>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => header.trim()
  });
  return parsed.data;
}

export async function parseContactsFile(file: File): Promise<ParseResult> {
  const rows = await readFileRows(file);
  return { ...processRows(rows), columnNames: extractColumnNames(rows) };
}
