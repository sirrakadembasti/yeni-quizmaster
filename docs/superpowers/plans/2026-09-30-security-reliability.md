# Guvenlik ve veri butunlugu duzeltme plani

Amac: React/Express/Prisma/SQLite mimarisini koruyarak dogrulanan bulgulari duzeltmek.

- [x] Izole test veritabani ve regresyon testleri
- [x] Rol iliskileri, veli/ogretmen yetkileri, sonuc gizliligi, profil/parola kurallari
- [x] Soru gecmisi, atomik sinav islemleri ve sinif yukseltme
- [x] Oturum/Socket.IO, SSRF ve okul NAT hiz sinirlari
- [x] Cevrimdisi akis, gorseller ve soru karistirma
- [x] Bagimlilik yamalari, tam test/tip/build kontrolleri
- [x] README/docs; Graphify CLI uretimi (son tutarlilik kontrolu commit oncesi)
- [x] Bagimsiz diff inceleme; yalniz bu calismayi commit icin hazirlama

Testler canli veritabanina erismez. Yerel migration testlerden sonra SQLite yedegi alinarak uygulanir. Onceden mevcut iki yerel kurulum degisikligi korunur ve commit disinda tutulur. MFA/e-posta dogrulamasi ve PostgreSQL gecisi yeni urun akislaridir; bu bakim kapsaminda eklenmez.
