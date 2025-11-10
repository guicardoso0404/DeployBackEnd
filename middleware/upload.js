// 🦟👀
const multer = require('multer');

// Filtro para permitir apenas imagens
const imageFilter = function (req, file, cb) {
    if (file.mimetype.startsWith('image/')) {
        cb(null, true);
    } else {
        cb(new Error('Apenas arquivos de imagem são permitidos!'), false);
    }
};

// Middleware para upload de posts (5MB max) - Cloudinary
const postUpload = multer({ 
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB
    },
    fileFilter: imageFilter
});

// Middleware para upload de fotos de perfil (2MB max) - Cloudinary
const profileUpload = multer({ 
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 2 * 1024 * 1024 // 2MB para fotos de perfil
    },
    fileFilter: imageFilter
});

module.exports = {
    postUpload,
    profileUpload
};