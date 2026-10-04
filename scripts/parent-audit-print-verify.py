"""Read-only text and render verification of actual Chromium print exports."""
from pathlib import Path
import json
import re
from pypdf import PdfReader
import pypdfium2 as pdfium

root = Path(__file__).resolve().parents[1] / "docs/parent-audit/print"
expected = {
    "announcements": "Parent Audit Parent Announcement",
    "profile": "Parent Audit Guardian",
    "notifications": "Parent Audit Notification",
    "logs": "Parent audit action",
    "security": "Şifre Değiştir",
}
results = []
for name, text in expected.items():
    file = root / f"{name}.pdf"
    reader = PdfReader(file)
    extracted = "\n".join(page.extract_text() or "" for page in reader.pages)
    assert "Private Teacher Announcement" not in extracted, f"Foreign announcement in {name}"
    assert "Private foreign audit action" not in extracted, f"Foreign history in {name}"
    doc = pdfium.PdfDocument(file)
    for i in range(len(doc)):
        page = doc[i]
        bitmap = page.render(scale=1.3)
        bitmap.to_pil().save(root / f"{name}-page-{i + 1}.png")
        bitmap.close()
        page.close()
    doc.close()
    # Chromium's PDF glyph positioning can insert spaces inside bold headings.
    matched = "".join(text.casefold().split()) in "".join(extracted.casefold().split())
    row = {"file": file.name, "pages": len(reader.pages), "expectedText": matched, "textExcerpt": extracted[:350], "foreignText": False, "rendered": True}
    if name == "notifications":
        # Fresh fixture has23 records; the actual settings page requests20.
        printed = sorted(set(int(n) for n in re.findall(r"Parent Audit Notification\s+(\d+)", extracted)))
        row.update({"expectedCurrentPageIds": list(range(20)), "printedNotificationIds": printed, "completeCurrentPage": printed == list(range(20))})
    results.append(row)
status = "passed" if all(item["expectedText"] and item.get("completeCurrentPage", True) for item in results) else "failed"
(root / "verification.json").write_text(json.dumps({"status": status, "files": results}, indent=2) + "\n", encoding="utf-8")
print(json.dumps({"status": status, "files": results}))
assert status == "passed", "Missing expected content or clipped print rows; inspect rendered pages"
