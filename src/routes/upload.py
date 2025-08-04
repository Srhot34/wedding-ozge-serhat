import os
import uuid
from flask import Blueprint, request, jsonify, current_app, send_from_directory
from werkzeug.utils import secure_filename
from src.models.upload import db, Upload, Contact

upload_bp = Blueprint('upload', __name__)

ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'mp4', 'mov', 'avi', 'mkv', 'webm'}
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB

def allowed_file(filename):
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def get_file_type(filename):
    ext = filename.rsplit('.', 1)[1].lower()
    if ext in {'png', 'jpg', 'jpeg', 'gif'}:
        return 'image'
    elif ext in {'mp4', 'mov', 'avi', 'mkv', 'webm'}:
        return 'video'
    return 'other'

@upload_bp.route('/upload', methods=['POST'])
def upload_files():
    try:
        if 'files' not in request.files:
            return jsonify({'error': 'Dosya seçilmedi'}), 400
        
        files = request.files.getlist('files')
        uploader_name = request.form.get('uploaderName', '').strip()
        message = request.form.get('message', '').strip()
        
        if not uploader_name:
            return jsonify({'error': 'İsim alanı zorunludur'}), 400
        
        if not files or all(file.filename == '' for file in files):
            return jsonify({'error': 'Dosya seçilmedi'}), 400
        
        # Create uploads directory if it doesn't exist
        upload_dir = os.path.join(current_app.root_path, 'uploads')
        os.makedirs(upload_dir, exist_ok=True)
        
        uploaded_files = []
        
        for file in files:
            if file and file.filename != '':
                if not allowed_file(file.filename):
                    return jsonify({'error': f'Desteklenmeyen dosya türü: {file.filename}'}), 400
                
                # Check file size
                file.seek(0, os.SEEK_END)
                file_size = file.tell()
                file.seek(0)
                
                if file_size > MAX_FILE_SIZE:
                    return jsonify({'error': f'Dosya boyutu çok büyük: {file.filename}'}), 400
                
                # Generate unique filename
                original_filename = secure_filename(file.filename)
                file_extension = original_filename.rsplit('.', 1)[1].lower()
                unique_filename = f"{uuid.uuid4().hex}.{file_extension}"
                
                # Save file
                file_path = os.path.join(upload_dir, unique_filename)
                file.save(file_path)
                
                # Save to database
                upload_record = Upload(
                    uploader_name=uploader_name,
                    filename=unique_filename,
                    original_filename=original_filename,
                    file_type=get_file_type(original_filename),
                    file_size=file_size,
                    message=message if message else None
                )
                
                db.session.add(upload_record)
                uploaded_files.append({
                    'original_filename': original_filename,
                    'size': file_size
                })
        
        db.session.commit()
        
        return jsonify({
            'message': 'Dosyalar başarıyla yüklendi',
            'files': uploaded_files
        }), 200
        
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Upload error: {str(e)}")
        return jsonify({'error': 'Yükleme sırasında bir hata oluştu'}), 500

@upload_bp.route('/contact', methods=['POST'])
def contact_form():
    try:
        name = request.form.get('name', '').strip()
        email = request.form.get('email', '').strip()
        message = request.form.get('message', '').strip()
        
        if not all([name, email, message]):
            return jsonify({'error': 'Tüm alanlar zorunludur'}), 400
        
        # Basic email validation
        if '@' not in email or '.' not in email:
            return jsonify({'error': 'Geçerli bir e-posta adresi girin'}), 400
        
        contact_record = Contact(
            name=name,
            email=email,
            message=message
        )
        
        db.session.add(contact_record)
        db.session.commit()
        
        return jsonify({'message': 'Mesajınız başarıyla gönderildi'}), 200
        
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Contact form error: {str(e)}")
        return jsonify({'error': 'Mesaj gönderilirken bir hata oluştu'}), 500

@upload_bp.route('/admin/uploads', methods=['GET'])
def admin_uploads():
    """Admin panel for viewing uploaded files"""
    try:
        uploads = Upload.query.order_by(Upload.upload_date.desc()).all()
        return jsonify([upload.to_dict() for upload in uploads]), 200
    except Exception as e:
        current_app.logger.error(f"Admin uploads error: {str(e)}")
        return jsonify({'error': 'Yüklemeler alınırken bir hata oluştu'}), 500

@upload_bp.route('/admin/contacts', methods=['GET'])
def admin_contacts():
    """Admin panel for viewing contact messages"""
    try:
        contacts = Contact.query.order_by(Contact.created_date.desc()).all()
        return jsonify([contact.to_dict() for contact in contacts]), 200
    except Exception as e:
        current_app.logger.error(f"Admin contacts error: {str(e)}")
        return jsonify({'error': 'Mesajlar alınırken bir hata oluştu'}), 500

@upload_bp.route('/admin/uploads/<int:upload_id>/approve', methods=['POST'])
def approve_upload(upload_id):
    """Approve an uploaded file for gallery"""
    try:
        upload = Upload.query.get_or_404(upload_id)
        upload.is_approved = True
        db.session.commit()
        return jsonify({'message': 'Dosya onaylandı'}), 200
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Approve upload error: {str(e)}")
        return jsonify({'error': 'Onaylama sırasında bir hata oluştu'}), 500

@upload_bp.route('/uploads/<filename>')
def uploaded_file(filename):
    """Serve uploaded files (only for admin)"""
    upload_dir = os.path.join(current_app.root_path, 'uploads')
    return send_from_directory(upload_dir, filename)

@upload_bp.route('/gallery', methods=['GET'])
def public_gallery():
    """Public gallery showing approved uploads"""
    try:
        approved_uploads = Upload.query.filter_by(is_approved=True).order_by(Upload.upload_date.desc()).all()
        gallery_items = []
        
        for upload in approved_uploads:
            if upload.file_type == 'image':
                gallery_items.append({
                    'id': upload.id,
                    'filename': upload.filename,
                    'type': upload.file_type,
                    'uploader_name': upload.uploader_name,
                    'upload_date': upload.upload_date.isoformat()
                })
        
        return jsonify(gallery_items), 200
    except Exception as e:
        current_app.logger.error(f"Gallery error: {str(e)}")
        return jsonify({'error': 'Galeri yüklenirken bir hata oluştu'}), 500

