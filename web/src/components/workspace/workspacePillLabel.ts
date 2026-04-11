export const WORKSPACE_PILL_LABEL_MAX_CHARS = 28;

export function formatWorkspacePillLabel(label: string): string {
  if (label.length <= WORKSPACE_PILL_LABEL_MAX_CHARS) {
    return label;
  }

  return `${label.slice(0, WORKSPACE_PILL_LABEL_MAX_CHARS - 3).trimEnd()}...`;
}
