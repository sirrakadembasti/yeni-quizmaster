# QuizMaster Server Dizini İnceleme, Tasnif ve Temizlik Raporu

**Tarih:** 5 Kasım 2026  
**Durum:** Planlandı — Yarınki oturumda uygulanmak üzere onay bekliyor.  
**Hedef Dizin:** `server/`

---

## 1. Yönetici Özeti ve Analiz Sonuçları

`server/` dizini uygulamanın çekirdek API, veri ve kimlik doğrulama katmanıdır. Kod tabanında yapılan ayrıntılı kullanım, bağımlılık ve rota taramalarında sunucu mimarisinin büyük bölümünün son derece sağlam, aktif ve birbirine sıkı sıkıya bağlı olduğu tespit edilmiştir. 

Temizlik ve tasnif süreci, uygulamanın hiçbir çalışma zamanı (runtime) veya veri güvenliği bileşenine zarar vermeden, yalnızca atıl kalıntıların temizlenmesini ve kök dizindeki test yapılandırmalarının düzenlenmesini hedeflemektedir.

---

## 2. Çekirdek Yapı: Tamamen Sağlam ve Dokunulmayacak Bileşenler

Aşağıdaki bileşenlerin tamamı aktiftir ve **kesinlikle değiştirilmeyecek/silinmeyecektir**:

1. **API Rotaları (`server/api-routes/` - 23 dosya):**
   - `auth.ts`, `user.ts`, `quiz.ts`, `result.ts`, `class.ts`, `category.ts`, `dashboard.ts`, `ai.ts`, `ai-management.ts`, `admin.ts`, `archive.ts`, `content-save.ts`, `upload.ts`, `parent.ts`, `question-bank.ts`, `notification.ts`, `announcement.ts`, `student.ts`, `analytics.ts`, `survey.ts`, `deployment.ts`, `academic-history.ts`, `routes.ts`.
   - *Not:* `archive.ts` ve `content-save.ts` rotaları hem sınav hem anket hem de arşiv dışa aktarım süreçleri için merkezi paylaşımlı işleyicilerdir.
2. **Güvenlik ve Ara Yazılımlar (`server/middleware/` - 6 dosya):**
   - `auth.ts`, `csrf.ts`, `demo-guard.ts` (canlı demo güvenlik duvarı), `academic-context.ts`, `annual-capture-guard.ts`, `archive-readonly.ts`.
3. **İş Servisleri (`server/services/` - 30 dosya):**
   - Yapay zeka servisleri (`ai-*`), arşiv ve raporlama servisleri (`archive-*`), parola sıfırlama, dashboard istatistikleri ve sonuç özetleri.
4. **Çalışma Zamanı Yardımcıları (`server/utils/` - 20 dosya):**
   - `session-store.ts` (SQLite oturum motoru), `sqlite-runtime.ts` (WAL ve bağlantı yönetimi), `demo-mode.ts`, `email.ts` (Gmail Outbox), `logger.ts`, yetki ve güvenlik modülleri.
5. **Veritabanı Katmanı (`server/prisma/` - 5 dosya + 25 Migrasyon):**
   - `schema.prisma`, `seed.ts`, `prepare-demo-db.ts`, `create-admin.ts`, `reset-admin.ts` ve tüm migrasyon geçmişi.
6. **Kurulum Sihirbazı (`server/setup-wizard/` - 4 dosya):**
   - `server.ts`, `ui.ts`, `config.ts`, `migration.ts` (5049/5050 grafik kurulum motoru).
7. **Kök Sunucu Dosyaları:**
   - `index.ts`, `storage.ts`, `socket.ts`, `static.ts`, `vite.ts`, `package.json`, `tsconfig.json`, `types.d.ts`, `vitest.config.ts`, `.env.*.example`.

---

## 3. Yarın Uygulanacak Temizlik ve Tasnif Adımları

### A. Atıl ve Kalıntı Dosyaların Silinmesi (2 Dosya)
- [x] **`server/check-users.ts` (312 bayt):** Geliştirme sürecinde konsola test çıktısı almak için oluşturulmuş 10 satırlık geçici deneme betiğidir. Hiçbir yerde import edilmez ve hiçbir betik tarafından çağrılmaz. Silinecek.
- [x] **`server/package-lock.json` (49.488 bayt):** Proje kökündeki `pnpm` (`pnpm-lock.yaml`) çalışma alanıyla yönetilmektedir. Eski npm kullanımından kalan bu kilit dosyası gereksizdir. Silinecek.

### B. Kök Dizindeki 19 Parçalı Test Yapılandırmasının Tasnifi
- [x] Ana dizindeki Playwright denetim yapılandırmalarında (`tests/yapilandirma/`) yapıldığı gibi, `server/` kök dizinindeki aşağıdaki 19 adet parçalı yapılandırma dosyası **`server/tests/yapilandirma/`** klasörü altına taşınacaktır:
  1. `vitest.academic-context.config.ts`
  2. `vitest.ai-management.config.ts`
  3. `vitest.ai-routes.config.ts`
  4. `vitest.annual-guard.config.ts`
  5. `vitest.archive-acceptance-db.config.ts`
  6. `vitest.archive-api.config.ts`
  7. `vitest.archive-export.config.ts`
  8. `vitest.archive-history-unit.config.ts`
  9. `vitest.archive-volume.config.ts`
  10. `vitest.archive-worker.config.ts`
  11. `vitest.dashboard-unit.config.ts`
  12. `vitest.history.config.ts`
  13. `vitest.http-transport.config.ts`
  14. `vitest.notification-preferences.config.ts`
  15. `vitest.performance-unit.config.ts`
  16. `vitest.results-summary-unit.config.ts`
  17. `vitest.rollover-db.config.ts`
  18. `vitest.sqlite-runtime.config.ts`
  19. `vitest.student-answer.config.ts`
- [x] Ana [server/vitest.config.ts](file:///D:/dnm/master/server/vitest.config.ts) dosyası `server/` kökünde kalacak; tüm genel testleri (`tests/**/*.test.ts`) çalıştırmaya devam edecektir.

---

## 4. Yarınki Doğrulama ve Kabul Kontrol Listesi

Temizlik ve taşıma işlemlerinden sonra sırasıyla şu doğrulamalar yapılacaktır:

1. [ ] **Sunucu Üretim Derlemesi:**
   ```powershell
   node scripts/build-server.mjs
   ```
   *(Beklenen: `dist/index.cjs` 3.1 MB, sıfır hata)*
2. [ ] **Kurulum ve Bakım Testleri:**
   ```powershell
   node --test scripts/setup-bootstrap.test.mjs scripts/find-port-holder.test.mjs
   node --test scripts/maintenance-backup.test.mjs scripts/maintenance-native.test.mjs scripts/maintenance-cli.test.mjs
   ```
   *(Beklenen: 14/14 ve 7/7 testin geçmesi)*
3. [ ] **Denetim Çalıştırıcı Port Testleri:**
   ```powershell
   node --test scripts/parent-audit-windows-runner.test.mjs scripts/student-audit-windows-runner.test.mjs scripts/teacher-audit-windows-runner.test.mjs
   ```
   *(Beklenen: 3/3 testin geçmesi)*
4. [ ] **Markdown Bağlantı Kontrolü:**
   Tüm Markdown dosyalarında göreli link kontrolü (0 kırık link).
5. [ ] **Graphify Bilgi Grafiği Güncellemesi:**
   ```powershell
   graphify update . --force
   graphify diagnose multigraph --graph graphify-out/graph.json --json
   ```
6. [ ] **Git Kaydı ve Uzak Depoya Gönderim:**
   Değişikliklerin yerel `main` dalına commit edilip `git push origin main` ile GitHub'a aktarılması.

---

## 5. Uygulama Sonucu ve Bilinen Ortam Kısıtı

- Silme ve 19 yapılandırmanın taşınması tamamlandı; derleme (3,1 MB), kurulum/bakım (14/14, 7/7) ve denetim port (3/3) testleri geçti, Markdown'da kırık link yok.
- **Ortam kısıtı:** Geliştirme makinesinde .pdf dosyalarının silinmesi/yeniden adlandırılması ve dosya symlink oluşturulması işletim sistemi/güvenlik politikasıyla engellidir (EPERM). Bu nedenle server/tests/utils/archive-export.test.ts 28 testten 19'unda bu makinede başarısız olur. Sorun yapılandırma taşımasından önce de aynıdır (taşıma öncesi sürümle doğrulandı); kod hatası değildir. Bu test kısıtsız bir makinede veya CI'da çalıştırılmalıdır.
