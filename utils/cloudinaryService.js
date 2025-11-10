// 🦟👀
const { v2: cloudinary } = require('cloudinary');
const streamifier = require('streamifier');

// A configuração do dotenv é feita no server.js, ponto de entrada da aplicação.
// Apenas validamos se as credenciais foram carregadas.
if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
    console.warn('Credenciais do Cloudinary não foram carregadas corretamente. Verifique o arquivo .env e a inicialização do servidor.');
}

// Configurar Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

/**
 * Upload de arquivo para Cloudinary
 * @param {Buffer} fileBuffer - Buffer do arquivo
 * @param {string} fileName - Nome do arquivo
 * @param {string} folder - Pasta no Cloudinary (ex: 'posts', 'profiles')
 * @returns {Promise<Object>} - Resultado do upload com URL
 */
async function uploadFile(fileBuffer, fileName, folder = 'networkup') {
    return new Promise((resolve, reject) => {
        const stream = streamifier.createReadStream(fileBuffer);
        
        const uploadStream = cloudinary.uploader.upload_stream(
            {
                folder: folder,
                resource_type: 'auto',
                public_id: fileName.split('.')[0] // Remove extensão
            },
            (error, result) => {
                if (error) {
                    reject(error);
                } else {
                    resolve(result);
                }
            }
        );
        
        stream.pipe(uploadStream);
    });
}

/**
 * Upload de imagem com transformações otimizadas
 * @param {Buffer} fileBuffer - Buffer da imagem
 * @param {string} fileName - Nome do arquivo
 * @param {string} folder - Pasta no Cloudinary
 * @returns {Promise<Object>} - URL otimizada
 */
async function uploadImage(fileBuffer, fileName, folder = 'networkup') {
    try {
        const result = await uploadFile(fileBuffer, fileName, folder);
        
        // Gerar URL otimizada
        const optimizedUrl = cloudinary.url(result.public_id, {
            fetch_format: 'auto',
            quality: 'auto',
            secure: true
        });
        
        return {
            success: true,
            public_id: result.public_id,
            url: result.secure_url,
            optimizedUrl: optimizedUrl,
            width: result.width,
            height: result.height,
            size: result.bytes
        };
    } catch (error) {
        throw new Error(`Erro ao fazer upload: ${error.message}`);
    }
}

/**
 * Gerar URL com transformações customizadas
 * @param {string} publicId - Public ID do arquivo no Cloudinary
 * @param {Object} options - Opções de transformação
 * @returns {string} - URL transformada
 */
function getTransformedUrl(publicId, options = {}) {
    const defaultOptions = {
        fetch_format: 'auto',
        quality: 'auto',
        secure: true,
        ...options
    };
    
    return cloudinary.url(publicId, defaultOptions);
}

/**
 * Gerar URL para avatar (quadrada, otimizada)
 * @param {string} publicId - Public ID do arquivo
 * @param {number} size - Tamanho em pixels (padrão: 200)
 * @returns {string} - URL do avatar
 */
function getAvatarUrl(publicId, size = 200) {
    return cloudinary.url(publicId, {
        crop: 'fill',
        gravity: 'face',
        width: size,
        height: size,
        fetch_format: 'auto',
        quality: 'auto',
        secure: true
    });
}

/**
 * Gerar URL para postagem (redimensionada)
 * @param {string} publicId - Public ID do arquivo
 * @param {number} width - Largura em pixels
 * @param {number} height - Altura em pixels
 * @returns {string} - URL da postagem
 */
function getPostImageUrl(publicId, width = 600, height = 400) {
    return cloudinary.url(publicId, {
        crop: 'fill',
        gravity: 'auto',
        width: width,
        height: height,
        fetch_format: 'auto',
        quality: 'auto',
        secure: true
    });
}

/**
 * Deletar arquivo do Cloudinary
 * @param {string} publicId - Public ID do arquivo
 * @returns {Promise<Object>} - Resultado da deleção
 */
async function deleteFile(publicId) {
    try {
        const result = await cloudinary.uploader.destroy(publicId);
        return result;
    } catch (error) {
        throw new Error(`Erro ao deletar arquivo: ${error.message}`);
    }
}

module.exports = {
    uploadFile,
    uploadImage,
    getTransformedUrl,
    getAvatarUrl,
    getPostImageUrl,
    deleteFile,
    cloudinary
};
