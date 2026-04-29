function serializeCsvCell(value: unknown): string {
  if (value == null) {
    return '';
  }

  const text = typeof value === 'string' ? value : String(value);

  if (/[",\r\n]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`;
  }

  return text;
}

export function serializeCsv(headers: string[], rows: Record<string, unknown>[]): string {
  return [
    headers.map(serializeCsvCell).join(','),
    ...rows.map((row) => headers.map((header) => serializeCsvCell(row[header])).join(',')),
  ].join('\n') + '\n';
}
