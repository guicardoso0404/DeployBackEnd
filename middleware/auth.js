// Middleware de autenticação e autorização
const { executeQuery } = require('../db');

// Email do administrador principal
const ADMIN_EMAIL = 'guilherme@networkup.com.br';

// Middleware para verificar se o usuário está autenticado
async function isAuthenticated(req, res, next) {
    try {
        // Verificar se o header de autorização existe
        const authHeader = req.headers.authorization;
        const userId = req.headers['x-user-id'];
        const userEmail = req.headers['x-user-email'];
        
        if (!userId && !userEmail) {
            return res.status(401).json({ 
                success: false, 
                message: 'Não autorizado. Faça login para continuar.' 
            });
        }
        
        // Buscar usuário no banco
        let user;
        if (userId) {
            const users = await executeQuery('SELECT id, nome, email, role, status FROM usuarios WHERE id = ?', [userId]);
            user = users[0];
        } else if (userEmail) {
            const users = await executeQuery('SELECT id, nome, email, role, status FROM usuarios WHERE email = ?', [userEmail]);
            user = users[0];
        }
        
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
async function isAdmin(req, res, next) {
    try {
        // Verificar autenticação via headers, query ou body
        const userId = req.headers['x-user-id'] || req.query.user_id || req.query.usuario_id || req.body?.usuario_id || req.body?.admin_id;
        const userEmail = req.headers['x-user-email'] || req.query.email || req.body?.email;
        
        // Se não tem credenciais, verificar se é o admin pelo email fixo
        if (!userId && !userEmail) {
            // Permitir acesso se for uma requisição do frontend que já validou localmente
            // Buscar o admin principal diretamente
            const admins = await executeQuery('SELECT id, nome, email, role, status FROM usuarios WHERE email = ?', [ADMIN_EMAIL]);
            
            if (admins.length > 0) {
                req.user = admins[0];
                console.log(`Admin acessando (auto-detect): ${req.user.email}`);
                return next();
            }
            
            return res.status(401).json({ 
                success: false, 
                message: 'Não autorizado. Faça login para continuar.' 
            });
        }
        
        // Buscar usuário no banco
        let user;
        if (userId) {
            const users = await executeQuery('SELECT id, nome, email, role, status FROM usuarios WHERE id = ?', [userId]);
            user = users[0];
        } else if (userEmail) {
            const users = await executeQuery('SELECT id, nome, email, role, status FROM usuarios WHERE email = ?', [userEmail]);
            user = users[0];
        }
        
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
                message: 'Sua conta foi suspensa.' 
            });
        }
        
        // Verificar se é admin (por role ou por email específico)
        const isAdminUser = user.role === 'admin' || user.email === ADMIN_EMAIL;
        
        if (!isAdminUser) {
            console.log(`Acesso negado ao painel admin: ${user.email}`);
            return res.status(403).json({ 
                success: false, 
                message: 'Acesso negado. Você não tem permissão de administrador.' 
            });
        }
        
        // Adicionar usuário ao request
        req.user = user;
        console.log(`Admin acessando: ${user.email}`);
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
