import { describe, expect, it } from 'vitest';
import { createCsvBytes, createCsvContent, createExcelBytes, sanitizeCsvValue } from './export';

describe('CSV export helpers', () => {
  it('creates an Excel-compatible semicolon separated report', () => {
    const csv = createCsvContent({
      title: 'Sınav Sonuçları',
      filters: [{ label: 'Ders', value: 'Matematik' }],
      columns: [
        { header: 'Öğrenci', value: 'name' },
        { header: 'Puan', value: 'score' },
      ],
      rows: [{ name: 'Ayşe "A"', score: 95 }],
    });
    expect(csv.startsWith('\uFEFFsep=;')).toBe(true);
    expect(csv).toContain('"Ayşe ""A""";"95"');
    expect(csv).toContain('"Ders";"Matematik"');
  });

  it('blocks spreadsheet formula injection and removes line breaks', () => {
    expect(sanitizeCsvValue('=HYPERLINK("bad")')).toBe('\'=HYPERLINK("bad")');
    expect(sanitizeCsvValue('satır 1\nsatır 2')).toBe('satır 1 satır 2');
  });

  it('encodes Turkish characters as UTF-8 with BOM for Excel', () => {
    const bytes = createCsvBytes({
      columns: [{ header: 'Öğrenci', value: 'name' }],
      rows: [{ name: 'Çağrı Işık Şengül' }],
    });
    expect(Array.from(bytes.slice(0, 3))).toEqual([0xef, 0xbb, 0xbf]);
    expect(new TextDecoder('utf-8').decode(bytes)).toContain('Çağrı Işık Şengül');
  });

  it('creates a real XLSX container with Turkish Unicode cells and worksheet formatting', () => {
    const bytes = createExcelBytes({
      title: 'Öğrenci Çalışma Raporu',
      filters: [{ label: 'Sınıf', value: '10-Ğ' }],
      columns: [{ header: 'Öğrenci', value: 'name' }, { header: 'Puan', value: 'score' }],
      rows: [{ name: 'Çağrı Işık Şengül', score: 95 }],
    });
    expect(Array.from(bytes.slice(0, 4))).toEqual([0x50, 0x4b, 0x03, 0x04]);
    const rawPackage = new TextDecoder('utf-8').decode(bytes);
    expect(rawPackage).toContain('xl/worksheets/sheet1.xml');
    expect(rawPackage).toContain('Çağrı Işık Şengül');
    expect(rawPackage).toContain('<autoFilter');
    expect(rawPackage).toContain('state="frozen"');
  });
});
