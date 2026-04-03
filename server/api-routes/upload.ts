import { Router, type Request, type Response, type NextFunction } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { requireAuth, requireRole } from "../middleware/auth";
import sharp from "sharp";

const router: Router = Router();

// Multer configuration for file uploads (store in memory temporarily for compression)
const uploadStorage = multer.memoryStorage();

const upload = multer({ 
  storage: uploadStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    // Only accept JPEG as requested
    const allowedTypes = /jpeg|jpg/;
    const mimetype = allowedTypes.test(file.mimetype);
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    if (mimetype && extname) return cb(null, true);
    cb(new Error("Sadece JPEG resim dosyaları yüklenebilir (jpg, jpeg)."));
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
      const dir = 'uploads/';
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      const filename = uniqueSuffix + '.jpg';
      const filepath = path.join(dir, filename);
      
      // Compress and save as JPEG
      await sharp(req.file.buffer)
        .jpeg({ quality: 70 }) // Görüntü sıkıştırma (Compression)
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
