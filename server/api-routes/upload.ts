import { Router, type Request, type Response, type NextFunction } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { requireAuth, requireRole } from "../middleware/auth";
import sharp from "sharp";
import { uploadsDirectory } from "../utils/upload-paths";

const router: Router = Router();

// Multer configuration for file uploads (store in memory temporarily for compression)
const uploadStorage = multer.memoryStorage();

const upload = multer({ 
  storage: uploadStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
    if (allowedMimeTypes.has(file.mimetype)) return cb(null, true);
    cb(new Error("Yalnızca JPEG, PNG veya WEBP görselleri yüklenebilir."));
  }
});

// ==================== UPLOAD ROUTES ====================

// Sadece öğretmen ve admin dosya yükleyebilir.
// requireRole öğrencileri engeller; aksi hâlde herhangi bir kayıtlı kullanıcı
// 5 MB'lık dosyalar yükleyerek disk alanını tüketebilir (DoS).
router.post("/", requireAuth, requireRole(["admin", "teacher"]), (req: Request, res: Response, next: NextFunction) => {
  upload.single('image')(req, res, async (err: any) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ message: "Dosya boyutu çok büyük. Maksimum 5MB yüklenebilir." });
      }
      return res.status(400).json({ message: `Yükleme hatası: ${err.message}` });
    } else if (err) {
      return res.status(400).json({ message: err.message });
    }
    
    if (!req.file) return res.status(400).json({ message: "Dosya seçilmedi." });
    
    try {
      if (!fs.existsSync(uploadsDirectory)) {
        fs.mkdirSync(uploadsDirectory, { recursive: true });
      }

      const image = sharp(req.file.buffer, { failOn: "warning" });
      const metadata = await image.metadata();
      if (!metadata.width || !metadata.height || !["jpeg", "png", "webp"].includes(metadata.format || "")) {
        return res.status(400).json({ message: "Dosya geçerli bir JPEG, PNG veya WEBP görseli değil." });
      }
      if (metadata.width > 10000 || metadata.height > 10000) {
        return res.status(400).json({ message: "Görsel boyutları en fazla 10000 × 10000 piksel olabilir." });
      }

      const filename = `${crypto.randomUUID()}.webp`;
      const filepath = path.join(uploadsDirectory, filename);
      await image
        .rotate()
        .resize({ width: 2400, height: 2400, fit: "inside", withoutEnlargement: true })
        .webp({ quality: 82 })
        .toFile(filepath);

      const imageUrl = `/uploads/${filename}`;
      res.json({ imageUrl });
    } catch (processError) {
      console.error("Image processing error:", processError);
      res.status(500).json({ message: "Resim işlenirken bir hata oluştu." });
    }
  });
});

export default router;
