export type CsvValue = string | number | boolean | Date | null | undefined;

export interface CsvColumn<T> {
  header: string;
  value: keyof T | ((row: T, index: number) => CsvValue);
}

export interface CsvExportOptions<T> {
  filename: string;
  title?: string;
  filters?: Array<{ label: string; value: CsvValue }>;
  columns: Array<CsvColumn<T>>;
  rows: T[];
}

const FORMULA_PREFIX = /^[\t\r ]*[=+\-@]/;

export function sanitizeCsvValue(value: CsvValue): string {
  if (value == null) return "";
  const raw = value instanceof Date
    ? value.toLocaleString("tr-TR")
    : typeof value === "boolean"
      ? (value ? "Evet" : "Hayır")
      : String(value);
  const singleLine = raw.replace(/\r?\n|\r/g, " ").trim();
  return FORMULA_PREFIX.test(singleLine) ? `'${singleLine}` : singleLine;
}

function quote(value: CsvValue): string {
  const safe = sanitizeCsvValue(value).replace(/"/g, '""');
  return `"${safe}"`;
}

export function createCsvContent<T>(options: Omit<CsvExportOptions<T>, "filename">): string {
  const delimiter = ";";
  const width = Math.max(options.columns.length, 2);
  const lines: string[] = [`sep=${delimiter}`];

  if (options.title) {
    lines.push([options.title, ...Array(width - 1).fill("")].map((cell) => quote(cell)).join(delimiter));
  }
  for (const filter of options.filters || []) {
    lines.push([filter.label, filter.value, ...Array(Math.max(width - 2, 0)).fill("")]
      .map((cell) => quote(cell)).join(delimiter));
  }
  if (options.title || options.filters?.length) {
    lines.push(Array(width).fill("").map((cell) => quote(cell)).join(delimiter));
  }

  lines.push(options.columns.map((column) => quote(column.header)).join(delimiter));
  options.rows.forEach((row, index) => {
    lines.push(options.columns.map((column) => {
      const value = typeof column.value === "function" ? column.value(row, index) : row[column.value] as CsvValue;
      return quote(value);
    }).join(delimiter));
  });

  return "\uFEFF" + lines.join("\r\n");
}

export function downloadCsv<T>(options: CsvExportOptions<T>) {
  const content = createCsvContent(options);
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = options.filename.toLowerCase().endsWith(".csv") ? options.filename : `${options.filename}.csv`;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}