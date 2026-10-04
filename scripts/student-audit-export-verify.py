"""Read real downloaded workbooks/PDFs; render every PDF page for visual review."""
import json
from pathlib import Path
from zipfile import ZipFile
from xml.etree import ElementTree as ET
from pypdf import PdfReader
import pypdfium2 as pdfium

out = Path(__file__).resolve().parent.parent / 'docs' / 'student-audit'
reports = []
for name in ['student-results-export.xlsx', 'student-statistics-export.xlsx']:
    file = out / name
    if not file.exists():
        reports.append({'file': name, 'status': 'missing'})
        continue
    with ZipFile(file) as workbook:
        sheet = ET.fromstring(workbook.read('xl/worksheets/sheet1.xml'))
        ns = {'s': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
        rows = [[(''.join(cell.itertext())) for cell in row.findall('s:c', ns)] for row in sheet.findall('.//s:row', ns)]
        text = ' '.join(' '.join(row) for row in rows)
        assert 'Student Audit Completed Exam' in text, name
        assert 'Private Other' not in text, name
        assert any('Student Audit Completed Exam' in row and '0' in row for row in rows), name
        reports.append({'file': name, 'status': 'passed', 'rows': rows})
file = out / 'student-results-print.pdf'
if file.exists():
    reader = PdfReader(file)
    text = '\n'.join(page.extract_text() or '' for page in reader.pages)
    assert 'Student Audit Completed Exam' in text
    assert 'Private Other' not in text
    document = pdfium.PdfDocument(str(file))
    render = out / 'print-render'
    render.mkdir(exist_ok=True)
    images = []
    for index, page in enumerate(document):
        image = render / f'student-results-page-{index+1}.png'
        page.render(scale=1.5).to_pil().save(image)
        images.append(str(image.relative_to(out)))
    reports.append({'file': file.name, 'status': 'passed-text-rendered', 'pages': len(reader.pages), 'text': text, 'renders': images})
else:
    reports.append({'file': file.name, 'status': 'missing'})
(out / 'export-verification.json').write_text(json.dumps(reports, ensure_ascii=False, indent=2), encoding='utf8')
print(json.dumps([{'file': item['file'], 'status': item['status']} for item in reports]))
