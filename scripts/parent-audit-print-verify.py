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
    "security": "Güvenlik Bilgileri",
}
results = []
for name, text in expected.items():
    file = root / f"{name}.pdf"
    reader = PdfReader(file)
    assert all((page.extract_text() or "").strip() for page in reader.pages), f"Blank print page in {name}"
    extracted = "\n".join(page.extract_text() or "" for page in reader.pages)
    normalized = "".join(extracted.casefold().split())
    for secret in ["StudentAuditOnly2026!", "ParentAuditTemporary2026!"]:
        assert secret.casefold() not in normalized, f"Password value printed in {name}"
    if name == "security":
        assert "mevcutşifre" not in normalized and "yenişifre" not in normalized, "Password form printed"
    assert "Private Teacher Announcement" not in extracted, f"Foreign announcement in {name}"
    assert "Private foreign audit action" not in extracted, f"Foreign history in {name}"
    if name == "profile":
        profile = json.loads((root / "source-profile.json").read_text(encoding="utf-8"))
        assert all(profile.values()), "Profile fixture must exercise all saved fields"
        assert all("".join(value.casefold().split()) in normalized for value in profile.values()), "Saved profile field missing from print"
    if name in ("logs", "notifications"):
        assert "sayfa" not in normalized, "Pagination controls printed"
        assert "baskıkapsamı:mevcut" in normalized, "Current-page print scope missing"
    for stale in root.glob(f"{name}-page-*.png"):
        assert stale.resolve().parent == root.resolve()
        stale.unlink()
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
        source = json.loads((root / "source-notifications.json").read_text(encoding="utf-8"))
        printed = sorted(set(int(n) for n in re.findall(r"Parent Audit Notification\s+(\d+)", extracted)))
        row.update({"expectedCurrentPageIds": source["expectedIds"], "sourceDomCount": source["currentPageCount"], "printedNotificationIds": printed, "completeCurrentPage": printed == source["expectedIds"]})
    if name == "logs":
        source = json.loads((root / "source-history.json").read_text(encoding="utf-8"))
        matched_details = sum("".join(detail.casefold().split()) in normalized for detail in source["expectedDetails"])
        row.update({"sourceDomCount": source["currentPageCount"], "matchedSourceDetails": matched_details, "completeCurrentPage": matched_details == source["currentPageCount"]})
    results.append(row)
status = "passed" if all(item["expectedText"] and item.get("completeCurrentPage", True) for item in results) else "failed"
(root / "verification.json").write_text(json.dumps({"status": status, "files": results}, indent=2) + "\n", encoding="utf-8")
print(json.dumps({"status": status, "files": results}))
assert status == "passed", "Missing expected content or clipped print rows; inspect rendered pages"
