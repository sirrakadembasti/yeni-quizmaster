const fs = require('fs');
const path = require('path');

const dirs = ['client/src', 'server'];
const exts = ['.ts', '.tsx', '.html', '.md', '.json'];

const fixes = {
    "S\uFFFDnav": "Sınav",
    "s\uFFFDnav": "sınav",
    "\uFFFD\uFFFDrenci": "Öğrenci",
    "\uFFFD\uFFFDrenciler": "Öğrenciler",
    "\uFFFD\uFFFDretmen": "Öğretmen",
    "E\uFFFDitmen": "Eğitmen",
    "S\uFFFDn\uFFFDf": "Sınıf",
    "S\uFFFDn\uFFFDf\uFFFD": "Sınıfı",
    "Sn\uFFFDf": "Sınıf",
    "Sonu\uFFFD": "Sonuç",
    "sonu\uFFFD": "sonuç",
    "\uFFFDzellik": "Özellik",
    "\uFFFDzellikler": "Özellikler",
    "Ar\uFFFDiv": "Arşiv",
    "Y\uFFFDnetim": "Yönetim",
    "y\uFFFDnetim": "yönetim",
    "\uFFFDstatistik": "İstatistik",
    "\uFFFD\uFFFDk\uFFFD\uFFFD Yap": "Çıkış Yap",
    "k\uFFFD\uFFFD Yap": "Çıkış Yap",
    "D\uFFFDn": "Dön",
    "Sonu\uFFFDlar\uFFFDm": "Sonuçlarım",
    "Detayl\uFFFD": "Detaylı",
    "Bulunamad\uFFFD": "Bulunamadı",
    "\uFFFDsimsiz": "İsimsiz",
    "Ba\uFFFDar\uFFFD": "Başarı",
    "ba\uFFFDar\uFFFD": "başarı",
    "\uFFFDl\uFFFD\uFFFDt\uFFFD": "Ölçütü",
    "Do\uFFFDruluk": "Doğruluk",
    "Geli\uFFFDmi\uFFFD": "Gelişmiş",
    "g\uFFFDrs\uFFFDn": "görsün",
    "de\uFFFDi\uFFFDmez": "değişmez",
    "g\uFFFDr\uFFFDr": "görür",
    "y\uFFFDklenemedi": "yüklenemedi",
    "yay\uFFFDnlanm\uFFFD\uFFFD": "yayınlanmış",
    "olu\uFFFDturdu\uFFFD\uFFFD": "oluşturduğu",
    "S\uFFFDnavlar": "Sınavlar",
    "g\uFFFDrmeli": "görmeli",
    "S\uFFFDralama": "Sıralama",
    "Ba\uFFFDl\uFFFDk": "Başlık",
    "Se\uFFFDti\uFFFDiniz": "Seçtiğiniz",
    "de\uFFFDi\uFFFDtirmeyi": "değiştirmeyi",
    "S\uFFFDf\uFFFDrla": "Sıfırla",
    "T\uFFFDm": "Tüm",
    "t\uFFFDm": "tüm",
    "D\uFFFD\uFFFD\uFFFDk": "Düşük",
    "Y\uFFFDksek": "Yüksek",
    "Puan\uFFFD": "Puanı",
    "s\uFFFDre": "süre",
    "S\uFFFDre": "Süre",
    "olmal\uFFFDd\uFFFDr": "olmalıdır",
    "Ge\uFFFDersiz": "Geçersiz",
    "Se\uFFFDenek": "Seçenek",
    "se\uFFFDenek": "seçenek",
    "g\uFFFDncellenemedi": "güncellenemedi",
    "ba\uFFFDar\uFFFDyla": "başarıyla",
    "G\uFFFDncelle": "Güncelle",
    "g\uFFFDncelle": "güncelle",
    "A\uFFFD\uFFFDklama": "Açıklama",
    "i\uFFFDin": "için",
    "g\uFFFDr\uFFFDnt\uFFFDleme": "görüntüleme",
    "olu\uFFFDturulamad\uFFFD": "oluşturulamadı",
    "silinemedi": "silinemedi",
    "ba\uFFFDl\uFFFD": "bağlı",
    "\uFFFD\uFFFDl\uFFFD\uFFFDt": "Ölçüt", // Ölüt ?
    "d\uFFFDzenleme": "düzenleme",
    "eklenmelidir": "eklenmelidir", // shouldn't be corrupt
    "Ba\uFFFDlang\uFFFD\uFFFD": "Başlangıç",
    "ba\uFFFDlang\uFFFD\uFFFD": "başlangıç",
    "\uFFFD\uFFFDk\uFFFD\uFFFD": "Çıkış",
    "De\uFFFDi\uFFFDtir": "Değiştir",
    "de\uFFFDi\uFFFDtir": "değiştir",
    "Do\uFFFDru": "Doğru",
    "do\uFFFDru": "doğru",
    "Yanl\uFFFD\uFFFD": "Yanlış",
    "yanl\uFFFD\uFFFD": "yanlış",
    "A\uFFFDa\uFFFD\uFFFDdaki": "Aşağıdaki",
    "a\uFFFDa\uFFFD\uFFFDdaki": "aşağıdaki",
    "Sa\uFFFDla": "Sağla",
    "sa\uFFFDla": "sağla",
    "\uFFFDzellik": "Özellik",
    "Ariv": "Arşiv"
};

let replacedFilesCount = 0;

function scanDir(dir) {
    if (!fs.existsSync(dir)) return;
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
            if (file === 'node_modules' || file === 'dist' || file === '.git') continue;
            scanDir(fullPath);
        } else {
            if (exts.includes(path.extname(fullPath))) {
                let content = fs.readFileSync(fullPath, 'utf8');
                let originalContent = content;
                
                // Replace known exact patterns
                for (const [bad, good] of Object.entries(fixes)) {
                    content = content.split(bad).join(good);
                }

                // If any \uFFFD remain, we might need manual fix, but let's first apply what we know.
                if (content !== originalContent) {
                    fs.writeFileSync(fullPath, content, 'utf8');
                    replacedFilesCount++;
                    console.log(`Fixed in: ${fullPath}`);
                }
            }
        }
    }
}

scanDir(dirs[0]);
scanDir(dirs[1]);
console.log(`Total files fixed: ${replacedFilesCount}`);
