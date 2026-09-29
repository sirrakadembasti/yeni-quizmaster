import { describe, expect, it } from "vitest";
import { createCsvBytes, createCsvContent, createExcelBytes, sanitizeCsvValue } from "./export";

function storedZipEntries(bytes: Uint8Array) {
  const entries = new Map<string, string>();
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const decoder = new TextDecoder();
  let offset = 0;
  while (offset + 30 <= bytes.length && view.getUint32(offset, true) === 0x04034b50) {
    const compressedSize = view.getUint32(offset + 18, true);
    const nameLength = view.getUint16(offset + 26, true);
    const extraLength = view.getUint16(offset + 28, true);
    const nameStart = offset + 30;
    const dataStart = nameStart + nameLength + extraLength;
    const name = decoder.decode(bytes.slice(nameStart, nameStart + nameLength));
    entries.set(name, decoder.decode(bytes.slice(dataStart, dataStart + compressedSize)));
    offset = dataStart + compressedSize;
  }
  return entries;
}

describe("Excel export", () => {
  it("geçerli OpenXML sıralaması ve Türkçe metinlerle çalışma kitabı üretir", () => {
    const bytes = createExcelBytes({
      title: "Öğretmen Listesi",
      filters: [{ label: "Kurum", value: "Şehit Öğretmenler Okulu" }],
      columns: [{ header: "Ad Soyad", value: "name" }, { header: "E-posta", value: "email" }],
      rows: [{ name: "Şule İğde", email: "sule@example.com" }],
    });
    const entries = storedZipEntries(bytes);
    expect([...bytes.slice(0, 4)]).toEqual([0x50, 0x4b, 0x03, 0x04]);
    expect(entries.has("[Content_Types].xml")).toBe(true);
    expect(entries.has("xl/workbook.xml")).toBe(true);
    const sheet = entries.get("xl/worksheets/sheet1.xml") || "";
    expect(sheet).toContain("Öğretmen Listesi");
    expect(sheet).toContain("Şule İğde");
    expect(sheet.indexOf("<autoFilter")).toBeLessThan(sheet.indexOf("<mergeCells"));
    expect(new DOMParser().parseFromString(sheet, "application/xml").querySelector("parsererror")).toBeNull();
  });

  it("formül enjeksiyonunu önler", () => {
    expect(sanitizeCsvValue("=HYPERLINK(\"bad\")")).toBe("'=HYPERLINK(\"bad\")");
  });
});

describe("CSV compatibility helpers", () => {
  it("keeps the UTF-8 BOM and Turkish characters for legacy integrations", () => {
    const bytes = createCsvBytes({
      columns: [{ header: "Öğrenci", value: "name" }],
      rows: [{ name: "Çağrı Işık Şengül" }],
    });
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    expect(new TextDecoder("utf-8").decode(bytes)).toContain("Çağrı Işık Şengül");
  });

  it("uses Excel's semicolon separator declaration and quotes values", () => {
    const csv = createCsvContent({
      columns: [{ header: "Öğrenci", value: "name" }],
      rows: [{ name: "Ayşe \"A\"" }],
    });
    expect(csv.startsWith("\uFEFFsep=;")).toBe(true);
    expect(csv).toContain('"Ayşe ""A"""');
  });
});
