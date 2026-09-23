import { describe, expect, it } from 'vitest';
import { createCsvContent, sanitizeCsvValue } from './export';

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
});