const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'wedding_db',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
});

// Test database connection
let isDbConnected = false;

pool.on('connect', () => {
    console.log('✅ PostgreSQL veritabanına bağlandı');
    isDbConnected = true;
});

pool.on('error', (err) => {
    console.error('❌ PostgreSQL bağlantı hatası:', err);
    console.log('⚠️  Veritabanı olmadan çalışmaya devam ediliyor...');
    isDbConnected = false;
});

// Create tables if they don't exist
const initializeDatabase = async () => {
    try {
        // Create uploads table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS uploads (
                id SERIAL PRIMARY KEY,
                uploader_name VARCHAR(255) NOT NULL,
                original_filename VARCHAR(255) NOT NULL,
                stored_filename VARCHAR(255) NOT NULL,
                file_path VARCHAR(500) NOT NULL,
                file_size BIGINT NOT NULL,
                file_type VARCHAR(100) NOT NULL,
                mime_type VARCHAR(100) NOT NULL,
                message TEXT,
                upload_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                ip_address INET,
                user_agent TEXT,
                is_approved BOOLEAN DEFAULT true,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Create gallery table for approved photos
        await pool.query(`
            CREATE TABLE IF NOT EXISTS gallery (
                id SERIAL PRIMARY KEY,
                upload_id INTEGER REFERENCES uploads(id) ON DELETE CASCADE,
                display_order INTEGER DEFAULT 0,
                is_featured BOOLEAN DEFAULT false,
                caption TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Create admin_settings table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS admin_settings (
                id SERIAL PRIMARY KEY,
                setting_key VARCHAR(100) UNIQUE NOT NULL,
                setting_value TEXT,
                description TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Insert default settings
        await pool.query(`
            INSERT INTO admin_settings (setting_key, setting_value, description) 
            VALUES 
                ('auto_approve_uploads', 'true', 'Automatically approve new uploads'),
                ('max_file_size', '52428800', 'Maximum file size in bytes (50MB)'),
                ('allowed_file_types', 'jpeg,jpg,png,gif,bmp,webp,mp4,avi,mov,wmv,flv,webm,mkv,3gp,heic,heif', 'Allowed file extensions')
            ON CONFLICT (setting_key) DO NOTHING
        `);

        console.log('✅ Veritabanı tabloları başarıyla oluşturuldu');
    } catch (error) {
        console.error('❌ Veritabanı başlatma hatası:', error);
        throw error;
    }
};

// Database query functions
const dbQueries = {
    // Insert new upload
    insertUpload: async (uploadData) => {
        const query = `
            INSERT INTO uploads (
                uploader_name, original_filename, stored_filename, file_path, 
                file_size, file_type, mime_type, message, ip_address, user_agent
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            RETURNING id, upload_date
        `;
        const values = [
            uploadData.uploaderName,
            uploadData.originalFilename,
            uploadData.storedFilename,
            uploadData.filePath,
            uploadData.fileSize,
            uploadData.fileType,
            uploadData.mimeType,
            uploadData.message,
            uploadData.ipAddress,
            uploadData.userAgent
        ];
        
        const result = await pool.query(query, values);
        return result.rows[0];
    },

    // Get all approved uploads for gallery
    getGalleryItems: async () => {
        const query = `
            SELECT u.*, g.display_order, g.is_featured, g.caption
            FROM uploads u
            LEFT JOIN gallery g ON u.id = g.upload_id
            WHERE u.is_approved = true
            ORDER BY g.display_order DESC, u.upload_date DESC
        `;
        const result = await pool.query(query);
        return result.rows;
    },

    // Get all uploads for admin
    getAllUploads: async () => {
        const query = `
            SELECT * FROM uploads 
            ORDER BY upload_date DESC
        `;
        const result = await pool.query(query);
        return result.rows;
    },

    // Update upload approval status
    updateUploadApproval: async (uploadId, isApproved) => {
        const query = `
            UPDATE uploads 
            SET is_approved = $1, updated_at = CURRENT_TIMESTAMP 
            WHERE id = $2
            RETURNING *
        `;
        const result = await pool.query(query, [isApproved, uploadId]);
        return result.rows[0];
    },

    // Add to gallery
    addToGallery: async (uploadId, displayOrder = 0, isFeatured = false, caption = null) => {
        const query = `
            INSERT INTO gallery (upload_id, display_order, is_featured, caption)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (upload_id) DO UPDATE SET
                display_order = $2,
                is_featured = $3,
                caption = $4
            RETURNING *
        `;
        const result = await pool.query(query, [uploadId, displayOrder, isFeatured, caption]);
        return result.rows[0];
    },

    // Get upload statistics
    getUploadStats: async () => {
        const query = `
            SELECT 
                COUNT(*) as total_uploads,
                COUNT(*) FILTER (WHERE is_approved = true) as approved_uploads,
                COUNT(*) FILTER (WHERE is_approved = false) as pending_uploads,
                SUM(file_size) as total_size,
                COUNT(*) FILTER (WHERE file_type LIKE 'image%') as image_count,
                COUNT(*) FILTER (WHERE file_type LIKE 'video%') as video_count
            FROM uploads
        `;
        const result = await pool.query(query);
        return result.rows[0];
    }
};

module.exports = {
    pool,
    initializeDatabase,
    dbQueries
};
