"""Read-only verification and sample renders of actual Chromium PDFs."""
from pathlib import Path
import json
import re
import unicodedata
from pypdf import PdfReader
import pypdfium2 as pdfium

out = Path(__file__).resolve().parents[1] / "tests/denetim-kanitlari/entegrasyon"
results = []
for name in ["ux-detail-A-U01", "ux-detail-T-U03", "ux-detail-T-U04-fast", "ux-detail-T-U04-filter-fast", "ux-detail-T-U04-many", "ux-extra-large-report"]:
    file = out / f"{name}.pdf"
    reader = PdfReader(file)
    texts = [page.extract_text() or "" for page in reader.pages]
    text = "\n".join(texts)
    normalized = "".join(c for c in unicodedata.normalize('NFKD', text.casefold()) if not unicodedata.combining(c) and not c.isspace())
    assert "studentauditonly2026!" not in normalized
    row = {"file": file.name, "pages": len(texts), "nonemptyPages": all(t.strip() for t in texts)}
    if name == "ux-extra-large-report":
        markers = sorted(set(re.findall(r"LargeAuditRow-\s*(\d\d)", text)))
        ends = sorted(set(re.findall(r"END-\s*(\d\d)", text)))
        row.update(expectedRows=60, printedRows=len(markers), completeRows=markers == [f"{n:02d}" for n in range(60)], longTitleEnds=len(ends))
    if name == "ux-detail-A-U01":
        row["actionsHeaderPrinted"] = "islemler" in normalized
        assert not row["actionsHeaderPrinted"], "Action column header must be omitted"
    if name == "ux-detail-T-U03":
        row["fullStudentCodePrinted"] = "parent-audit-student" in normalized
        row["actionsHeaderPrinted"] = "eylem" in normalized
        assert row["fullStudentCodePrinted"], "Student code must be complete"
        assert not row["actionsHeaderPrinted"], "Action column must be omitted"
    if name == "ux-detail-T-U04-many":
        markers = sorted(set(re.findall(r"PrintAudit-\s*(\d\d)", text)))
        row.update(expectedClasses=30, printedClasses=len(markers), completeClasses=markers == [f"{n:02d}" for n in range(30)])
        assert row["completeClasses"], "All thirty full class names must print"
    elif name.startswith("ux-detail-T-U04"):
        row["classLabelsPrinted"] = "parentaudit7a" in normalized and "privateother7b" in normalized
        assert row["classLabelsPrinted"], "Both classes must be represented in print"
    doc = pdfium.PdfDocument(file)
    samples = list(range(len(doc))) if name == "ux-detail-T-U04-many" else sorted({0, len(doc) - 1}) if name == "ux-extra-large-report" else [0]
    row["renderedPages"] = [n + 1 for n in samples]
    for number in samples:
        page = doc[number]
        bitmap = page.render(scale=1.1)
        bitmap.to_pil().save(out / f"{name}-page-{number + 1}.png")
        bitmap.close()
        page.close()
    doc.close()
    results.append(row)
(out / "pdf-verification.json").write_text(json.dumps({"files": results, "visualReviewFile": "pdf-visual-review.json"}, indent=2) + "\n", encoding="utf-8")
print(json.dumps(results))
assert all(item['nonemptyPages'] for item in results), 'Blank PDF page'
large = next(item for item in results if item['file'] == 'ux-extra-large-report.pdf')
assert large['completeRows'] and large['longTitleEnds'] == 60, 'Missing long-report record or title end'
