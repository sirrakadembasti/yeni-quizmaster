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

export function createCsvBytes<T>(options: Omit<CsvExportOptions<T>, "filename">): Uint8Array {
  return new TextEncoder().encode(createCsvContent(options));
}

const XML_ESCAPE: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" };
const xml = (value: unknown) => String(value ?? "").replace(/[&<>"']/g, (character) => XML_ESCAPE[character]);

function columnName(index: number) {
  let value = index + 1;
  let name = "";
  while (value > 0) {
    value -= 1;
    name = String.fromCharCode(65 + (value % 26)) + name;
    value = Math.floor(value / 26);
  }
  return name;
}

function crc32(data: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function zipStored(files: Array<{ name: string; content: string }>) {
  const encoder = new TextEncoder();
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;
  const now = new Date();
  const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | Math.floor(now.getSeconds() / 2);
  const dosDate = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
  const view = (size: number) => new DataView(new ArrayBuffer(size));

  for (const file of files) {
    const name = encoder.encode(file.name);
    const data = encoder.encode(file.content);
    const checksum = crc32(data);
    const localView = view(30);
    localView.setUint32(0, 0x04034b50, true);
    localView.setUint16(4, 20, true);
    localView.setUint16(6, 0x0800, true);
    localView.setUint16(8, 0, true);
    localView.setUint16(10, dosTime, true);
    localView.setUint16(12, dosDate, true);
    localView.setUint32(14, checksum, true);
    localView.setUint32(18, data.length, true);
    localView.setUint32(22, data.length, true);
    localView.setUint16(26, name.length, true);
    const localHeader = new Uint8Array(localView.buffer);
    localParts.push(localHeader, name, data);

    const centralView = view(46);
    centralView.setUint32(0, 0x02014b50, true);
    centralView.setUint16(4, 20, true);
    centralView.setUint16(6, 20, true);
    centralView.setUint16(8, 0x0800, true);
    centralView.setUint16(10, 0, true);
    centralView.setUint16(12, dosTime, true);
    centralView.setUint16(14, dosDate, true);
    centralView.setUint32(16, checksum, true);
    centralView.setUint32(20, data.length, true);
    centralView.setUint32(24, data.length, true);
    centralView.setUint16(28, name.length, true);
    centralView.setUint32(42, offset, true);
    centralParts.push(new Uint8Array(centralView.buffer), name);
    offset += localHeader.length + name.length + data.length;
  }

  const centralSize = centralParts.reduce((total, part) => total + part.length, 0);
  const endView = view(22);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(8, files.length, true);
  endView.setUint16(10, files.length, true);
  endView.setUint32(12, centralSize, true);
  endView.setUint32(16, offset, true);
  const parts = [...localParts, ...centralParts, new Uint8Array(endView.buffer)];
  const output = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
  let position = 0;
  for (const part of parts) { output.set(part, position); position += part.length; }
  return output;
}

export function createExcelBytes<T>(options: Omit<CsvExportOptions<T>, "filename">): Uint8Array {
  const width = Math.max(options.columns.length, 1);
  const rows: Array<{ values: CsvValue[]; style: number }> = [];
  if (options.title) rows.push({ values: [options.title, ...Array(width - 1).fill("")], style: 1 });
  for (const filter of options.filters || []) rows.push({ values: [filter.label, filter.value, ...Array(Math.max(width - 2, 0)).fill("")], style: 2 });
  if (options.title || options.filters?.length) rows.push({ values: Array(width).fill(""), style: 0 });
  const headerRow = rows.length + 1;
  rows.push({ values: options.columns.map((column) => column.header), style: 3 });
  options.rows.forEach((row, index) => rows.push({
    values: options.columns.map((column) => typeof column.value === "function" ? column.value(row, index) : row[column.value] as CsvValue),
    style: 0,
  }));

  const columnWidths = options.columns.map((column) => Math.min(60, Math.max(12,
    column.header.length + 2,
    ...options.rows.map((row, rowIndex) => sanitizeCsvValue(typeof column.value === "function" ? column.value(row, rowIndex) : row[column.value] as CsvValue).length + 2),
  )));
  const cellXml = (value: CsvValue, rowIndex: number, columnIndex: number, style: number) => {
    const reference = `${columnName(columnIndex)}${rowIndex + 1}`;
    if (typeof value === "number" && Number.isFinite(value)) return `<c r="${reference}" s="${style}"><v>${value}</v></c>`;
    const text = sanitizeCsvValue(value);
    return `<c r="${reference}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${xml(text)}</t></is></c>`;
  };
  const sheetRows = rows.map((row, rowIndex) => `<row r="${rowIndex + 1}">${row.values.map((value, columnIndex) => cellXml(value, rowIndex, columnIndex, row.style)).join("")}</row>`).join("");
  const lastColumn = columnName(width - 1);
  const lastRow = Math.max(rows.length, headerRow);
  const columns = columnWidths.map((columnWidth, index) => `<col min="${index + 1}" max="${index + 1}" width="${columnWidth}" customWidth="1"/>`).join("");
  const merge = options.title && width > 1 ? `<mergeCells count="1"><mergeCell ref="A1:${lastColumn}1"/></mergeCells>` : "";
  const worksheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="${headerRow}" topLeftCell="A${headerRow + 1}" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${columns}</cols><sheetData>${sheetRows}</sheetData>${merge}<autoFilter ref="A${headerRow}:${lastColumn}${lastRow}"/><pageMargins left="0.25" right="0.25" top="0.5" bottom="0.5" header="0.2" footer="0.2"/><pageSetup orientation="landscape" fitToWidth="1" fitToHeight="0"/></worksheet>`;
  const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="3"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="16"/><color rgb="FF1E293B"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF4F46E5"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="2"><border/><border><left style="thin"><color rgb="FFD8DEE9"/></left><right style="thin"><color rgb="FFD8DEE9"/></right><top style="thin"><color rgb="FFD8DEE9"/></top><bottom style="thin"><color rgb="FFD8DEE9"/></bottom></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="4"><xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="0" fontId="2" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"><alignment horizontal="center"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
  const workbook = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Rapor" sheetId="1" r:id="rId1"/></sheets><calcPr calcId="0"/></workbook>`;
  return zipStored([
    { name: "[Content_Types].xml", content: `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>` },
    { name: "_rels/.rels", content: `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>` },
    { name: "xl/workbook.xml", content: workbook },
    { name: "xl/_rels/workbook.xml.rels", content: `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>` },
    { name: "xl/worksheets/sheet1.xml", content: worksheet },
    { name: "xl/styles.xml", content: styles },
  ]);
}

export function downloadExcel<T>(options: CsvExportOptions<T>) {
  const bytes = createExcelBytes(options);
  const blob = new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = options.filename.replace(/\.csv$/i, "").replace(/\.xlsx$/i, "") + ".xlsx";
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function downloadCsv<T>(options: CsvExportOptions<T>) {
  downloadExcel(options);
}
