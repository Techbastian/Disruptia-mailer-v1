import * as XLSX from "xlsx";
import type { EmailTemplate } from "../types";

function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "plantilla"
  );
}

/**
 * Genera y descarga un Excel guía con las columnas que la plantilla necesita:
 * siempre `email` y `nombre`, más las variables CSV declaradas, con una fila
 * de ejemplo para que quien arme la lista sepa el formato esperado.
 */
export function downloadContactsExcelTemplate(template: EmailTemplate): void {
  const headers = [...new Set(["email", "nombre", ...template.variablesCsv])];
  const exampleRow = headers.map((h) => {
    if (h === "email") return "ana.perez@ejemplo.com";
    if (h === "nombre") return "Ana Pérez";
    return `Valor de {{${h}}}`;
  });

  const sheet = XLSX.utils.aoa_to_sheet([headers, exampleRow]);
  sheet["!cols"] = headers.map(() => ({ wch: 30 }));

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Contactos");
  XLSX.writeFile(workbook, `contactos-${slugify(template.name)}.xlsx`);
}
