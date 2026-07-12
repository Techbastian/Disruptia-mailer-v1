type StatCardProps = {
  label: string;
  value: number | string;
  // Colorea el valor; "primary" además resalta el borde de la tarjeta.
  tone?: "primary" | "success" | "warning" | "error";
};

const VALUE_COLOR: Record<NonNullable<StatCardProps["tone"]>, string> = {
  primary: "text-primary",
  success: "text-success",
  warning: "text-warning",
  error: "text-error"
};

export default function StatCard({ label, value, tone }: StatCardProps) {
  return (
    <div
      className={`card py-4 text-center ${tone === "primary" ? "border-primary/30 bg-primary/5" : ""}`}
    >
      <p className={`text-2xl font-bold ${tone ? VALUE_COLOR[tone] : ""}`}>{value}</p>
      <p className="mt-1 text-xs text-text-muted">{label}</p>
    </div>
  );
}
