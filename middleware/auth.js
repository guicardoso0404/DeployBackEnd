// Middleware de autenticação e autorização
const jwt = require('jsonwebtoken');
const { executeQuery } = require('../db');

// Email do administrador principal
const ADMIN_EMAIL = 'guilherme@networkup.com.br';

function getBearerToken(req) {
    const header = req.headers.authorization;
    if (!header) return null;

    const [type, token] = header.split(' ');
    if (type !== 'Bearer' || !token) return null;
    return token;
}

// Middleware para verificar se o usuário está autenticado
async function isAuthenticated(req, res, next) {
    try {
        if (!process.env.JWT_SECRET) {
            return res.status(500).json({
                success: false,
                message: 'JWT_SECRET não configurado no servidor'
            });
        }

        const token = getBearerToken(req);
        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'Não autorizado. Envie Authorization: Bearer <token>.'
            });
        }

        let payload;
        try {
            payload = jwt.verify(token, process.env.JWT_SECRET);
        } catch (err) {
            return res.status(401).json({
                success: false,
                message: 'Token inválido ou expirado.'
            });
        }

        const userId = Number(payload.sub);
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Token sem sub válido.'
            });
        }

        const users = await executeQuery(
            'SELECT id, nome, email, role, status FROM usuarios WHERE id = ?',
            [userId]
        );
        const user = users[0];

        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Usuário não encontrado.'
            });
        }

        // Verificar se usuário está banido
        if (user.status === 'banido') {
            return res.status(403).json({
                success: false,
                message: 'Sua conta foi suspensa. Entre em contato com o suporte.'
            });
        }

        // Adicionar usuário ao request
        req.user = user;
        next();
    } catch (error) {
        console.error('Erro na autenticação:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor'
        });
    }
}

// Middleware para verificar se o usuário é administrador
function isAdmin(req, res, next) {
    try {
        if (!req.user) {
            return res.status(500).json({
                success: false,
                message: 'Middleware isAdmin requer isAuthenticated antes.'
            });
        }

        const isAdminUser = req.user.role === 'admin' || req.user.email === ADMIN_EMAIL;
        if (!isAdminUser) {
            return res.status(403).json({
                success: false,
                message: 'Acesso negado. Você não tem permissão de administrador.'
            });
        }

        next();
    } catch (error) {
        console.error('Erro na verificação de admin:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor'
        });
    }
}

module.exports = {
    isAuthenticated,
    isAdmin,
    ADMIN_EMAIL
};
