const { getAvatarUrl } = require('./cloudinaryService');

function isHttpUrl(value) {
    return typeof value === 'string' && /^(https?:)?\/\//i.test(value);
}

/**
 * Resolve a URL de foto de perfil.
 * - Se `foto_perfil` já for uma URL http(s), retorna ela.
 * - Caso contrário, assume ser `public_id` do Cloudinary e gera URL otimizada.
 * - Se vazio/nulo, retorna null.
 */
function resolveProfilePhotoUrl(foto_perfil, size = 200) {
    if (!foto_perfil) return null;
    if (isHttpUrl(foto_perfil)) return foto_perfil;
    try {
        return getAvatarUrl(foto_perfil, size);
    } catch (e) {
        return null;
    }
}

module.exports = {
    resolveProfilePhotoUrl,
    isHttpUrl
};
