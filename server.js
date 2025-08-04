const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const archiver = require('archiver');
require('dotenv').config();
const { initializeDatabase, dbQueries } = require('./src/database/db');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Initialize database
initializeDatabase().catch(console.error);

// Multer konfigürasyonu - dosyaları orijinal uzantıları ile kaydet
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = 'uploads/';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // Orijinal dosya adını ve uzantısını koru
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    const name = path.basename(file.originalname, ext);
    cb(null, name + '-' + uniqueSuffix + ext);
  }
});

// Dosya filtreleme - sadece resim ve video dosyalarını kabul et
const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|bmp|webp|mp4|avi|mov|wmv|flv|webm|mkv|3gp|heic|heif/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);
  
  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(new Error('Sadece resim ve video dosyaları yüklenebilir!'));
  }
};

const upload = multer({ 
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit
  }
});

// Statik dosyaları sun
app.use(express.static(path.join(__dirname, 'src', 'static')));

// Ana sayfa endpoint'i
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'src', 'static', 'index.html'));
});

// Upload endpoint'i
app.post('/upload', upload.array('files'), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Dosya yüklenmedi.' 
      });
    }

    const { uploaderName, message } = req.body;
    
    if (!uploaderName || uploaderName.trim() === '') {
      return res.status(400).json({ 
        success: false, 
        message: 'İsim alanı zorunludur.' 
      });
    }

    const uploadedFiles = [];
    const clientIP = req.ip || req.connection.remoteAddress || req.socket.remoteAddress;
    const userAgent = req.get('User-Agent');

    // Process each uploaded file and save to database
    for (const file of req.files) {
      try {
        const uploadData = {
          uploaderName: uploaderName.trim(),
          originalFilename: file.originalname,
          storedFilename: file.filename,
          filePath: file.path,
          fileSize: file.size,
          fileType: file.mimetype.split('/')[0], // 'image' or 'video'
          mimeType: file.mimetype,
          message: message || null,
          ipAddress: clientIP,
          userAgent: userAgent
        };

        const dbResult = await dbQueries.insertUpload(uploadData);
        
        uploadedFiles.push({
          id: dbResult.id,
          originalName: file.originalname,
          filename: file.filename,
          size: file.size,
          path: file.path,
          uploadDate: dbResult.upload_date
        });

        console.log(`✅ ${uploaderName} tarafından yüklendi: ${file.originalname} (${(file.size / 1024 / 1024).toFixed(2)} MB)`);
      } catch (dbError) {
        console.error(`❌ Veritabanı kayıt hatası (${file.originalname}):`, dbError);
        // Continue with other files even if one fails
      }
    }

    if (uploadedFiles.length === 0) {
      return res.status(500).json({ 
        success: false, 
        message: 'Dosyalar yüklendi ancak veritabanına kaydedilemedi.' 
      });
    }

    res.json({ 
      success: true, 
      message: `${uploadedFiles.length} dosya başarıyla yüklendi!`,
      files: uploadedFiles,
      uploader: uploaderName,
      uploadMessage: message
    });

  } catch (error) {
    console.error('❌ Upload error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Sunucu hatası oluştu.' 
    });
  }
});

// Galeri endpoint'i - onaylanmış dosyaları listele
app.get('/api/gallery', async (req, res) => {
  try {
    const galleryItems = await dbQueries.getGalleryItems();
    
    const files = galleryItems.map(item => ({
      id: item.id,
      filename: item.stored_filename,
      originalName: item.original_filename,
      size: item.file_size,
      uploadDate: item.upload_date,
      uploaderName: item.uploader_name,
      message: item.message,
      fileType: item.file_type,
      url: `/uploads/${item.stored_filename}`,
      isFeatured: item.is_featured,
      caption: item.caption
    }));

    res.json({ success: true, files });
  } catch (error) {
    console.error('❌ Gallery error:', error);
    res.status(500).json({ success: false, message: 'Galeri yüklenirken hata oluştu.' });
  }
});

// Hata yakalama middleware'i
app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ 
        success: false, 
        message: 'Dosya boyutu çok büyük! Maksimum 50MB olmalıdır.' 
      });
    }
  }
  
  if (error.message === 'Sadece resim ve video dosyaları yüklenebilir!') {
    return res.status(400).json({ 
      success: false, 
      message: error.message 
    });
  }
  
  res.status(500).json({ 
    success: false, 
    message: 'Bilinmeyen bir hata oluştu!' 
  });
});

// Admin API endpoints
app.get('/api/admin/uploads', async (req, res) => {
  try {
    const uploads = await dbQueries.getAllUploads();
    res.json({ success: true, uploads });
  } catch (error) {
    console.error('❌ Admin uploads error:', error);
    res.status(500).json({ success: false, message: 'Yüklemeler alınırken hata oluştu.' });
  }
});

app.post('/api/admin/approve/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { approved } = req.body;
    
    const result = await dbQueries.updateUploadApproval(id, approved);
    
    if (approved) {
      await dbQueries.addToGallery(id);
    }
    
    res.json({ success: true, upload: result });
  } catch (error) {
    console.error('❌ Admin approve error:', error);
    res.status(500).json({ success: false, message: 'Onay durumu güncellenirken hata oluştu.' });
  }
});

app.get('/api/admin/stats', async (req, res) => {
  try {
    const stats = await dbQueries.getUploadStats();
    res.json({ success: true, stats });
  } catch (error) {
    console.error('❌ Admin stats error:', error);
    res.status(500).json({ success: false, message: 'İstatistikler alınırken hata oluştu.' });
  }
});

// Bulk download endpoint - ZIP all files
app.get('/api/admin/download-all', async (req, res) => {
  try {
    const uploads = await dbQueries.getAllUploads();
    
    if (uploads.length === 0) {
      return res.status(404).json({ success: false, message: 'İndirilecek dosya bulunamadı.' });
    }

    // Set response headers for ZIP download
    const zipName = `wedding-photos-${new Date().toISOString().split('T')[0]}.zip`;
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${zipName}"`);

    // Create ZIP archive
    const archive = archiver('zip', {
      zlib: { level: 9 } // Maximum compression
    });

    // Pipe archive to response
    archive.pipe(res);

    // Add files to archive
    let addedFiles = 0;
    for (const upload of uploads) {
      const filePath = path.join(__dirname, upload.file_path);
      
      if (fs.existsSync(filePath)) {
        // Create organized folder structure in ZIP
        const folderName = upload.file_type === 'image' ? 'Fotoğraflar' : 'Videolar';
        const fileName = `${upload.uploader_name}_${upload.original_filename}`;
        const zipPath = `${folderName}/${fileName}`;
        
        archive.file(filePath, { name: zipPath });
        addedFiles++;
      }
    }

    if (addedFiles === 0) {
      return res.status(404).json({ success: false, message: 'Dosyalar bulunamadı.' });
    }

    // Add a summary file
    const summary = uploads.map(u => 
      `${u.uploader_name} - ${u.original_filename} - ${new Date(u.upload_date).toLocaleString('tr-TR')}`
    ).join('\n');
    
    archive.append(summary, { name: 'Yükleme_Listesi.txt' });

    console.log(`📦 ${addedFiles} dosya ZIP olarak indiriliyor...`);
    
    // Finalize archive
    archive.finalize();

  } catch (error) {
    console.error('❌ Bulk download error:', error);
    res.status(500).json({ success: false, message: 'Toplu indirme sırasında hata oluştu.' });
  }
});

// Individual file download endpoint
app.get('/api/admin/download/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const uploads = await dbQueries.getAllUploads();
    const upload = uploads.find(u => u.id == id);
    
    if (!upload) {
      return res.status(404).json({ success: false, message: 'Dosya bulunamadı.' });
    }

    const filePath = path.join(__dirname, upload.file_path);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, message: 'Dosya sistemde bulunamadı.' });
    }

    // Set download headers
    res.setHeader('Content-Disposition', `attachment; filename="${upload.original_filename}"`);
    res.setHeader('Content-Type', upload.mime_type);
    
    // Stream file to response
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
    
    console.log(`📥 ${upload.original_filename} indirildi`);

  } catch (error) {
    console.error('❌ File download error:', error);
    res.status(500).json({ success: false, message: 'Dosya indirme sırasında hata oluştu.' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server ${PORT} portunda çalışıyor`);
  console.log(`📱 Ana sayfa: http://localhost:${PORT}`);
  console.log(`⚙️  Admin paneli: http://localhost:${PORT}/admin.html`);
  console.log(`📊 API endpoints hazır`);
});