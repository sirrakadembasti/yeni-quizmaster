"""Read/render controlled archive fixtures; does not open the application database."""
from pathlib import Path
import hashlib
import json
import sys
import zipfile
import pdfplumber

pdf_path = Path(sys.argv[1]).resolve(strict=True)
with pdfplumber.open(pdf_path) as pdf:
    text = '\n'.join(page.extract_text() or '' for page in pdf.pages)
    expected = ['9/A', '9/B', 'Matematik', 'Fen Bilimleri', 'Dondurulmuş Öğrenci',
                'Başka Sınıftaki Katılımcı', 'Sınıfsız Katılımcı', '85', '95', '75',
                'Öğrenmekten memnun kaldım.']
    for phrase in expected:
        assert phrase in text, f'Missing PDF text: {phrase}'
    images = []
    for index, page in enumerate(pdf.pages):
        for word in page.extract_words():
            assert word['x0'] >= 0 and word['x1'] <= page.width + 1, 'Text overflows page width'
        image_path = pdf_path.parent / f'page-{index+1}.png'
        page.to_image(resolution=120).save(image_path)
        images.append(str(image_path))
archive = pdf_path.parent.parent / 'archive.zip'
with zipfile.ZipFile(archive) as package:
    assert package.testzip() is None, 'ZIP CRC mismatch'
    checksums = json.loads(package.read('checksums.json'))
    assert len([name for name in package.namelist() if name.endswith('.csv')]) == 4
    for name, checksum in checksums.items():
        assert hashlib.sha256(package.read(name)).hexdigest() == checksum
print(json.dumps({'pages': len(images), 'images': images, 'verifiedText': expected,
                  'zipSha256': hashlib.sha256(archive.read_bytes()).hexdigest()}, ensure_ascii=False))
