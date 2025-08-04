// Mobile Navigation
const hamburger = document.querySelector('.hamburger');
const navMenu = document.querySelector('.nav-menu');

hamburger.addEventListener('click', () => {
    hamburger.classList.toggle('active');
    navMenu.classList.toggle('active');
});

// Close mobile menu when clicking on a link
document.querySelectorAll('.nav-link').forEach(n => n.addEventListener('click', () => {
    hamburger.classList.remove('active');
    navMenu.classList.remove('active');
}));

// Smooth scrolling for navigation links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    });
});

// Countdown Timer
function updateCountdown() {
    const weddingDate = new Date('2025-08-09T19:00:00').getTime();
    const now = new Date().getTime();
    const distance = weddingDate - now;

    if (distance > 0) {
        const days = Math.floor(distance / (1000 * 60 * 60 * 24));
        const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((distance % (1000 * 60)) / 1000);

        document.getElementById('days').textContent = days.toString().padStart(2, '0');
        document.getElementById('hours').textContent = hours.toString().padStart(2, '0');
        document.getElementById('minutes').textContent = minutes.toString().padStart(2, '0');
        document.getElementById('seconds').textContent = seconds.toString().padStart(2, '0');
    } else {
        document.getElementById('countdown').innerHTML = '<p>Düğün günü geldi!</p>';
    }
}

// Update countdown every second
setInterval(updateCountdown, 1000);
updateCountdown();

// Navbar scroll effect
window.addEventListener('scroll', () => {
    const navbar = document.querySelector('.navbar');
    if (window.scrollY > 100) {
        navbar.style.background = 'rgba(255, 255, 255, 0.98)';
        navbar.style.boxShadow = '0 2px 20px rgba(0, 0, 0, 0.1)';
    } else {
        navbar.style.background = 'rgba(255, 255, 255, 0.95)';
        navbar.style.boxShadow = 'none';
    }
});

// File Upload Functionality
const uploadForm = document.getElementById('uploadForm');
const uploadProgress = document.getElementById('uploadProgress');
const uploadResult = document.getElementById('uploadResult');
const progressFill = document.getElementById('progressFill');
const progressText = document.getElementById('progressText');
const uploadZone = document.getElementById('uploadZone');
const fileInput = document.getElementById('fileUpload');
const fileList = document.getElementById('fileList');

let selectedFiles = [];

// Drag and Drop Functionality
uploadZone.addEventListener('click', () => {
    fileInput.click();
});

uploadZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadZone.classList.add('dragover');
});

uploadZone.addEventListener('dragleave', (e) => {
    e.preventDefault();
    uploadZone.classList.remove('dragover');
});

uploadZone.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadZone.classList.remove('dragover');
    const files = Array.from(e.dataTransfer.files);
    handleFileSelection(files);
});

fileInput.addEventListener('change', (e) => {
    const files = Array.from(e.target.files);
    handleFileSelection(files);
});

function handleFileSelection(files) {
    // Filter valid files
    const validFiles = files.filter(file => {
        const allowedTypes = /jpeg|jpg|png|gif|bmp|webp|mp4|avi|mov|wmv|flv|webm|mkv|3gp|heic|heif/;
        const isValidType = allowedTypes.test(file.name.toLowerCase().split('.').pop());
        const isValidSize = file.size <= 50 * 1024 * 1024; // 50MB
        
        if (!isValidType) {
            showUploadResult(`"${file.name}" geçersiz dosya türü. Sadece resim ve video dosyaları kabul edilir.`, 'error');
            return false;
        }
        
        if (!isValidSize) {
            showUploadResult(`"${file.name}" çok büyük. Maksimum dosya boyutu 50MB.`, 'error');
            return false;
        }
        
        return true;
    });
    
    // Add to selected files (avoid duplicates)
    validFiles.forEach(file => {
        const isDuplicate = selectedFiles.some(existing => 
            existing.name === file.name && existing.size === file.size
        );
        
        if (!isDuplicate) {
            selectedFiles.push(file);
        }
    });
    
    updateFileList();
    updateFormData();
}

function updateFileList() {
    fileList.innerHTML = '';
    
    selectedFiles.forEach((file, index) => {
        const fileItem = document.createElement('div');
        fileItem.className = 'file-item';
        
        const fileInfo = document.createElement('div');
        fileInfo.className = 'file-info';
        
        const fileName = document.createElement('span');
        fileName.textContent = file.name;
        
        const fileSize = document.createElement('span');
        fileSize.className = 'file-size';
        fileSize.textContent = formatFileSize(file.size);
        
        const removeBtn = document.createElement('button');
        removeBtn.className = 'remove-file';
        removeBtn.innerHTML = '×';
        removeBtn.type = 'button';
        removeBtn.onclick = () => removeFile(index);
        
        fileInfo.appendChild(fileName);
        fileInfo.appendChild(fileSize);
        fileItem.appendChild(fileInfo);
        fileItem.appendChild(removeBtn);
        
        fileList.appendChild(fileItem);
    });
    
    // Update upload zone text
    if (selectedFiles.length > 0) {
        uploadZone.querySelector('p').innerHTML = `<strong>${selectedFiles.length} dosya seçildi</strong>`;
        uploadZone.querySelector('p:last-of-type').textContent = 'Daha fazla eklemek için tıklayın';
    } else {
        uploadZone.querySelector('p').innerHTML = '<strong>Dosyaları buraya sürükleyin</strong>';
        uploadZone.querySelector('p:last-of-type').textContent = 'veya tıklayarak seçin';
    }
}

function removeFile(index) {
    selectedFiles.splice(index, 1);
    updateFileList();
    updateFormData();
}

function updateFormData() {
    // Create a new DataTransfer object to update the file input
    const dt = new DataTransfer();
    selectedFiles.forEach(file => dt.items.add(file));
    fileInput.files = dt.files;
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

uploadForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    if (selectedFiles.length === 0) {
        showUploadResult('Lütfen en az bir dosya seçin.', 'error');
        return;
    }

    const formData = new FormData();
    
    // Add form fields
    formData.append('uploaderName', document.getElementById('uploaderName').value);
    formData.append('message', document.getElementById('message').value);
    
    // Add selected files
    selectedFiles.forEach(file => {
        formData.append('files', file);
    });

    uploadProgress.style.display = 'block';
    uploadResult.style.display = 'none';
    
    try {
        const response = await fetch('/upload', {
            method: 'POST',
            body: formData
        });

        const result = await response.json();
        
        if (result.success) {
            showUploadResult(result.message + ' Teşekkür ederiz.', 'success');
            uploadForm.reset();
            
            // Clear selected files and update UI
            selectedFiles = [];
            updateFileList();
            
            // Yüklenen dosyaları önizle
            if (result.files && result.files.length > 0) {
                console.log('Yüklenen dosyalar:', result.files);
                showPreview(result.files);
            }
        } else {
            showUploadResult(result.message || 'Yükleme sırasında bir hata oluştu.', 'error');
        }
    } catch (error) {
        console.error('Upload error:', error);
        showUploadResult('Ağ bağlantısı hatası. Lütfen internet bağlantınızı kontrol edin ve tekrar deneyin.', 'error');
    } finally {
        uploadProgress.style.display = 'none';
    }
});

function showUploadResult(message, type) {
    uploadResult.textContent = message;
    uploadResult.className = `upload-result ${type}`;
    uploadResult.style.display = 'block';
    
    setTimeout(() => {
        uploadResult.style.display = 'none';
    }, 5000);
}

// Contact Form
const contactForm = document.getElementById('contactForm');

contactForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const formData = new FormData(contactForm);
    const submitBtn = contactForm.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    
    submitBtn.textContent = 'Gönderiliyor...';
    submitBtn.disabled = true;
    
    try {
        const response = await fetch('/contact', {
            method: 'POST',
            body: formData
        });

        if (response.ok) {
            alert('Mesajınız başarıyla gönderildi!');
            contactForm.reset();
        } else {
            throw new Error('Mesaj gönderilirken bir hata oluştu.');
        }
    } catch (error) {
        alert('Mesaj gönderilirken bir hata oluştu. Lütfen tekrar deneyin.');
    } finally {
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
    }
});

// Map functions
function openMap(type) {
    if (type === 'nikah') {
        // Belediye Nikah Salonu için örnek koordinat
        window.open('https://www.google.com/maps/place/%F0%9D%97%A6%F0%9D%97%B2%F0%9D%98%86%F0%9D%97%BF-%F0%9D%97%B6+%F0%9D%97%9A%F0%9D%97%BC%F0%9D%97%B9+Balo%26Davet+Salonlar%C4%B1/@38.3591586,38.370619,17z/data=!3m1!4b1!4m6!3m5!1s0x4076373a2c31f6db:0xbffa2cfc8a34a26a!8m2!3d38.3591586!4d38.370619!16s%2Fg%2F11p0062kcb?entry=ttu&g_ep=EgoyMDI1MDcyMy4wIKXMDSoASAFQAw%3D%3D', '_blank');
    } else if (type === 'dugun') {
        // Düğün Salonu için örnek koordinat
        window.open('https://www.google.com/maps/place/Atakale+Restaurant/@41.1387786,37.2857498,17z/data=!3m1!4b1!4m6!3m5!1s0x4062bb9003d451d3:0x70a041fef8fd678!8m2!3d41.1387786!4d37.2883301!16s%2Fg%2F113f43n1_?entry=ttu&g_ep=EgoyMDI1MDcyMy4wIKXMDSoASAFQAw%3D%3D', '_blank');
    }
}

// Gallery functionality (will be populated by backend)
function loadGallery() {
    // This will be implemented when backend is ready
    const galleryGrid = document.getElementById('galleryGrid');
    
    // Placeholder for now
    galleryGrid.innerHTML = `
        <div class="gallery-placeholder">
            <p>Galeri fotoğrafları yakında eklenecek...</p>
        </div>
    `;
}

// Load gallery on page load
document.addEventListener('DOMContentLoaded', loadGallery);

// Intersection Observer for animations
const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.style.opacity = '1';
            entry.target.style.transform = 'translateY(0)';
        }
    });
}, observerOptions);

// Observe elements for animation
document.addEventListener('DOMContentLoaded', () => {
    const animateElements = document.querySelectorAll('.detail-card, .story-text, .upload-content, .contact-content');
    
    animateElements.forEach(el => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(30px)';
        el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        observer.observe(el);
    });
});

// Preloader (optional)
window.addEventListener('load', () => {
    const preloader = document.querySelector('.preloader');
    if (preloader) {
        preloader.style.opacity = '0';
        setTimeout(() => {
            preloader.style.display = 'none';
        }, 500);
    }
});

// Error handling for images
document.addEventListener('DOMContentLoaded', () => {
    const images = document.querySelectorAll('img');
    images.forEach(img => {
        img.addEventListener('error', function() {
            this.style.display = 'none';
        });
    });
});

// Form validation
function validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

// Add real-time validation to forms
document.addEventListener('DOMContentLoaded', () => {
    const emailInputs = document.querySelectorAll('input[type="email"]');
    
    emailInputs.forEach(input => {
        input.addEventListener('blur', (e) => {
            if (!validateEmail(e.target.value)) {
                e.target.classList.add('invalid');
            } else {
                e.target.classList.remove('invalid');
            }
        });
    });
});

// Lazy loading for images (if needed)
if ('IntersectionObserver' in window) {
    const imageObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const img = entry.target;
                img.src = img.dataset.src;
                img.classList.remove('lazy');
                imageObserver.unobserve(img);
            }
        });
    });

    document.querySelectorAll('img[data-src]').forEach(img => {
        imageObserver.observe(img);
    });
}

// Yükleme sonrası önizleme fonksiyonu
function showPreview(files) {
    const previewContainer = document.getElementById('uploadPreview');
    previewContainer.innerHTML = '<h4>Az önce yükledikleriniz:</h4>'; // Clear previous previews and add a title

    files.forEach(file => {
        const previewItem = document.createElement('div');
        previewItem.className = 'preview-item';

        if (file.mimetype.startsWith('image/')) {
            const img = document.createElement('img');
            img.src = `uploads/${file.filename}`;
            img.alt = file.originalName;
            previewItem.appendChild(img);
        } else if (file.mimetype.startsWith('video/')) {
            const video = document.createElement('video');
            video.src = `uploads/${file.filename}`;
            video.controls = true;
            previewItem.appendChild(video);
        } else {
            const fileInfo = document.createElement('p');
            fileInfo.innerHTML = `<i class="fas fa-file-alt"></i> ${file.originalName}`;
            previewItem.appendChild(fileInfo);
        }
        
        const fileName = document.createElement('p');
        fileName.className = 'preview-item-name';
        fileName.textContent = file.originalName;
        previewItem.appendChild(fileName);

        previewContainer.appendChild(previewItem);
    });

    // Önizleme alanını görünür yap
    previewContainer.style.display = 'grid';
}

