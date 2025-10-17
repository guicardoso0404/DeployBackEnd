// 🦟👀
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configuração do multer para uploads de posts
const postStorage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadPath = path.join(__dirname, '../../public/uploads/posts');
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }
        cb(null, uploadPath);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'post-' + uniqueSuffix + path.extname(file.originalname));
    }
});

// Configuração do multer para fotos de perfil
const profileStorage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadPath = path.join(__dirname, '../../public/uploads/profiles');
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }
        cb(null, uploadPath);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'profile-' + uniqueSuffix + path.extname(file.originalname));
    }
});

// Filtro para permitir apenas imagens
const imageFilter = function (req, file, cb) {
    if (file.mimetype.startsWith('image/')) {
        cb(null, true);
    } else {
        cb(new Error('Apenas arquivos de imagem são permitidos!'), false);
    }
};

// Middleware para upload de posts (5MB max)
const postUpload = multer({ 
    storage: postStorage,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB
    },
    fileFilter: imageFilter
});

// Middleware para upload de fotos de perfil (2MB max)
const profileUpload = multer({ 
    storage: profileStorage,
    limits: {
        fileSize: 2 * 1024 * 1024 // 2MB para fotos de perfil
    },
    fileFilter: imageFilter
});

module.exports = {
    postUpload,
    profileUpload
};