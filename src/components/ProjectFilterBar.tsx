import type { Project } from "../types";

// "all" = todas | "general" = solo agnósticas | <id> = un proyecto
export type ProjectFilter = "all" | "general" | string;

type Props = {
  projects: Project[];
  filter: ProjectFilter;
  onChange: (filter: ProjectFilter) => void;
  counts: { all: number; general: number };
};

/** Chips de filtro por proyecto, compartidos por la biblioteca y el creador. */
export default function ProjectFilterBar({ projects, filter, onChange, counts }: Props) {
  const chip = (value: ProjectFilter, label: string, count?: number) => (
    <button
      key={value}
      type="button"
      onClick={() => onChange(value)}
      className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold transition ${
        filter === value
          ? "bg-primary text-white"
          : "border border-border text-text-muted hover:bg-surface"
      }`}
    >
      {label}
      {count !== undefined && (
        <span className={`text-xs ${filter === value ? "text-white/70" : "text-text-muted"}`}>{count}</span>
      )}
    </button>
  );

  return (
    <div className="flex flex-wrap items-center gap-2">
      {chip("all", "Todas", counts.all)}
      {chip("general", "General", counts.general)}
      {projects.length > 0 && <span className="mx-1 h-5 w-px bg-border" />}
      {projects.map((p) => chip(p.id, p.name))}
    </div>
  );
}
