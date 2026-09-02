// ─────────────────────────────────────────────────────────────────────────────
// Horarios de programación, siempre en America/Bogota.
//
// Toda la app razona en hora de Bogotá, no en la del navegador: un input
// datetime-local devuelve "2026-09-02T08:00" sin zona, y si lo interpretáramos
// con la zona de la máquina, programar desde otro huso mandaría los correos a
// otra hora. Acá se fija el offset -05:00 (Colombia no tiene horario de verano),
// el mismo que usan la Edge Function `dispatch-runner` y `countDispatchedToday`.
// ─────────────────────────────────────────────────────────────────────────────

const BOGOTA_OFFSET = "-05:00";
const BOGOTA_OFFSET_MS = -5 * 60 * 60 * 1000;

/** "2026-09-02T08:00" (hora de Bogotá) → instante ISO en UTC. */
export function scheduleInputToIso(value: string): string {
  return new Date(`${value}:00${BOGOTA_OFFSET}`).toISOString();
}

/** Instante ISO → "2026-09-02T08:00" para precargar un datetime-local. */
export function isoToScheduleInput(iso: string): string {
  const local = new Date(new Date(iso).getTime() + BOGOTA_OFFSET_MS);
  return local.toISOString().slice(0, 16);
}

/** Fecha y hora legibles en Bogotá: "2 sept 2026, 08:00". */
export function formatBogota(iso: string): string {
  return new Date(iso).toLocaleString("es-CO", {
    timeZone: "America/Bogota",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

/** Valor mínimo del datetime-local: dentro de 5 minutos, en hora de Bogotá. */
export function minScheduleInput(): string {
  return isoToScheduleInput(new Date(Date.now() + 5 * 60 * 1000).toISOString());
}

/** true si la fecha elegida ya pasó (se compara como instante, no como texto). */
export function isPastSchedule(value: string): boolean {
  return new Date(scheduleInputToIso(value)).getTime() <= Date.now();
}

/**
 * Días que tomará despachar `total` destinatarios: el primero sale con lo que
 * quede del cupo de hoy y los siguientes con el cupo completo.
 */
export function estimateDays(total: number, quotaToday: number, dailyLimit: number): number {
  if (total <= 0) return 0;
  if (total <= quotaToday) return 1;
  return 1 + Math.ceil((total - quotaToday) / dailyLimit);
}
