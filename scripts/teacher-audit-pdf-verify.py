"""Read-only content verification and page rendering for synthetic audit PDFs."""
import json
import unicodedata
from pathlib import Path
from pypdf import PdfReader
import pymupdf

output = Path(__file__).resolve().parents[1] / 'docs/teacher-audit/evidence/print'
checks = []
for manifest in sorted(output.glob('*-expected.json')):
    expected = json.loads(manifest.read_text(encoding='utf-8'))
    pdf = manifest.with_name(manifest.name.replace('-expected.json', '.pdf'))
    reader = PdfReader(pdf)
    text = '\n'.join(page.extract_text() or '' for page in reader.pages)
    def normalize(value):
        return ''.join(unicodedata.normalize('NFC', value).casefold().split())
    normalized = normalize(text)
    missing = [value for value in expected['required'] if normalize(value) not in normalized]
    forbidden = [value for value in expected['forbidden'] if normalize(value) in normalized]
    document = pymupdf.open(pdf)
    rendered = []
    for index, page in enumerate(document):
        image = pdf.with_name(f'{pdf.stem}-page-{index + 1}.png')
        page.get_pixmap(matrix=pymupdf.Matrix(1.25, 1.25)).save(image)
        rendered.append(image.name)
    checks.append({'pdf': pdf.name, 'pages': len(reader.pages), 'missing': missing,
                   'forbidden': forbidden, 'rendered': rendered, 'passed': not missing and not forbidden})
result = {'tool': 'pypdf extraction and PyMuPDF rendering', 'checks': checks,
          'passed': len(checks) == 6 and all(check['passed'] for check in checks)}
(output / 'pdf-verification.json').write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(json.dumps(result, ensure_ascii=False, indent=2))
raise SystemExit(0 if result['passed'] else 1)
