// Controller de administração
const { executeQuery } = require('../db');

class AdminController {
    // Obter estatísticas gerais do sistema
    static async getStats(req, res) {
        try {
            const stats = await executeQuery(`
                SELECT 
                    (SELECT COUNT(*) FROM usuarios) as total_usuarios,
                    (SELECT COUNT(*) FROM usuarios WHERE role = 'admin') as total_admins,
                    (SELECT COUNT(*) FROM usuarios WHERE status = 'ativo' OR status IS NULL) as usuarios_ativos,
                    (SELECT COUNT(*) FROM usuarios WHERE status = 'banido') as usuarios_banidos,
                    (SELECT COUNT(*) FROM postagens) as total_postagens,
                    (SELECT COUNT(*) FROM comentarios) as total_comentarios,
                    (SELECT COUNT(*) FROM curtidas) as total_curtidas,
                    (SELECT COUNT(*) FROM conversas) as total_conversas,
                    (SELECT COUNT(*) FROM mensagens) as total_mensagens
            `);
            
            res.json({
                success: true,
                data: stats[0]
            });
            
        } catch (error) {
            console.error('Erro ao obter estatísticas:', error);
            res.status(500).json({ 
                success: false, 
                message: 'Erro ao obter estatísticas' 
            });
        }
    }
    
    // Listar todos os usuários com detalhes
    static async listAllUsers(req, res) {
        try {
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 20;
            const offset = (page - 1) * limit;
            const search = req.query.search || '';
            
            let query = `
                SELECT 
                    u.id, 
                    u.nome, 
                    u.email, 
                    u.role, 
                    u.status,
                    u.foto_perfil,
                    u.data_criacao,
                    (SELECT COUNT(*) FROM postagens WHERE usuario_id = u.id) as total_posts,
                    (SELECT COUNT(*) FROM comentarios WHERE usuario_id = u.id) as total_comentarios
                FROM usuarios u
            `;
            
            let params = [];
            
            if (search) {
                query += ' WHERE u.nome LIKE ? OR u.email LIKE ?';
                params.push(`%${search}%`, `%${search}%`);
            }
            
            query += ` ORDER BY u.data_criacao DESC LIMIT ${limit} OFFSET ${offset}`;
            
            const users = await executeQuery(query, params);
            
            // Contar total de usuários
            let countQuery = 'SELECT COUNT(*) as total FROM usuarios';
            let countParams = [];
            
            if (search) {
                countQuery += ' WHERE nome LIKE ? OR email LIKE ?';
                countParams.push(`%${search}%`, `%${search}%`);
            }
            
            const totalResult = await executeQuery(countQuery, countParams);
            const total = totalResult[0].total;
            
            res.json({
                success: true,
                data: {
                    users,
                    pagination: {
                        page,
                        limit,
                        total,
                        totalPages: Math.ceil(total / limit)
                    }
                }
            });
            
        } catch (error) {
            console.error('Erro ao listar usuários:', error);
            res.status(500).json({ 
                success: false, 
                message: 'Erro ao listar usuários' 
            });
        }
    }
    
    // Banir usuário
    static async banUser(req, res) {
        try {
            const { userId } = req.params;
            const { motivo, status } = req.body;
            
            // Se o frontend enviou status = 'ativo', redirecionar para unban
            if (status === 'ativo') {
                return AdminController.unbanUser(req, res);
            }
            
            if (!userId) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'ID do usuário é obrigatório' 
                });
            }
            
            // Verificar se o usuário existe
            const users = await executeQuery(
                'SELECT id, nome, email, role FROM usuarios WHERE id = ?', 
                [userId]
            );
            
            if (users.length === 0) {
                return res.status(404).json({ 
                    success: false, 
                    message: 'Usuário não encontrado' 
                });
            }
            
            const user = users[0];
            
            // Não permitir banir outros admins
            if (user.role === 'admin' || user.email === 'guilherme@networkup.com.br') {
                return res.status(403).json({ 
                    success: false, 
                    message: 'Não é possível banir outro administrador' 
                });
            }
            
            // Banir usuário
            await executeQuery(
                'UPDATE usuarios SET status = ? WHERE id = ?', 
                ['banido', userId]
            );
            
            console.log(`Admin ${req.user.email} baniu usuário ${user.email}. Motivo: ${motivo || 'Não especificado'}`);
            
            res.json({
                success: true,
                message: `Usuário ${user.nome} foi banido com sucesso`
            });
            
        } catch (error) {
            console.error('Erro ao banir usuário:', error);
            res.status(500).json({ 
                success: false, 
                message: 'Erro ao banir usuário' 
            });
        }
    }
    
    // Desbanir usuário
    static async unbanUser(req, res) {
        try {
            const { userId } = req.params;
            
            if (!userId) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'ID do usuário é obrigatório' 
                });
            }
            
            // Verificar se o usuário existe
            const users = await executeQuery(
                'SELECT id, nome, email FROM usuarios WHERE id = ?', 
                [userId]
            );
            
            if (users.length === 0) {
                return res.status(404).json({ 
                    success: false, 
                    message: 'Usuário não encontrado' 
                });
            }
            
            const user = users[0];
            
            // Desbanir usuário
            await executeQuery(
                'UPDATE usuarios SET status = ? WHERE id = ?', 
                ['ativo', userId]
            );
            
            console.log(`Admin ${req.user.email} desbaniu usuário ${user.email}`);
            
            res.json({
                success: true,
                message: `Usuário ${user.nome} foi desbanido com sucesso`
            });
            
        } catch (error) {
            console.error('Erro ao desbanir usuário:', error);
            res.status(500).json({ 
                success: false, 
                message: 'Erro ao desbanir usuário' 
            });
        }
    }
    
    // Deletar postagem (admin)
    static async deletePost(req, res) {
        try {
            const { postId } = req.params;
            
            if (!postId) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'ID da postagem é obrigatório' 
                });
            }
            
            // Verificar se a postagem existe
            const posts = await executeQuery(
                'SELECT id, usuario_id FROM postagens WHERE id = ?', 
                [postId]
            );
            
            if (posts.length === 0) {
                return res.status(404).json({ 
                    success: false, 
                    message: 'Postagem não encontrada' 
                });
            }
            
            // Deletar postagem
            await executeQuery('DELETE FROM postagens WHERE id = ?', [postId]);
            
            console.log(`Admin ${req.user.email} deletou postagem ${postId}`);
            
            res.json({
                success: true,
                message: 'Postagem deletada com sucesso'
            });
            
        } catch (error) {
            console.error('Erro ao deletar postagem:', error);
            res.status(500).json({ 
                success: false, 
                message: 'Erro ao deletar postagem' 
            });
        }
    }
    
    // Obter detalhes de um usuário específico
    static async getUserDetails(req, res) {
        try {
            const { userId } = req.params;
            
            if (!userId) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'ID do usuário é obrigatório' 
                });
            }
            
            // Buscar usuário
            const users = await executeQuery(`
                SELECT 
                    id, nome, email, role, status, foto_perfil, descricao, data_criacao
                FROM usuarios 
                WHERE id = ?
            `, [userId]);
            
            if (users.length === 0) {
                return res.status(404).json({ 
                    success: false, 
                    message: 'Usuário não encontrado' 
                });
            }
            
            const user = users[0];
            
            // Buscar estatísticas do usuário
            const stats = await executeQuery(`
                SELECT 
                    (SELECT COUNT(*) FROM postagens WHERE usuario_id = ?) as total_posts,
                    (SELECT COUNT(*) FROM comentarios WHERE usuario_id = ?) as total_comentarios,
                    (SELECT COUNT(*) FROM curtidas WHERE usuario_id = ?) as total_curtidas
            `, [userId, userId, userId]);
            
            // Buscar últimas postagens
            const posts = await executeQuery(`
                SELECT id, conteudo, imagem, curtidas, comentarios, data_criacao
                FROM postagens
                WHERE usuario_id = ?
                ORDER BY data_criacao DESC
                LIMIT 5
            `, [userId]);
            
            res.json({
                success: true,
                data: {
                    user,
                    stats: stats[0],
                    recentPosts: posts
                }
            });
            
        } catch (error) {
            console.error('Erro ao obter detalhes do usuário:', error);
            res.status(500).json({ 
                success: false, 
                message: 'Erro ao obter detalhes do usuário' 
            });
        }
    }
    
    // Promover usuário para admin
    static async promoteToAdmin(req, res) {
        try {
            const { userId } = req.params;
            
            if (!userId) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'ID do usuário é obrigatório' 
                });
            }
            
            // Verificar se o usuário existe
            const users = await executeQuery(
                'SELECT id, nome, email FROM usuarios WHERE id = ?', 
                [userId]
            );
            
            if (users.length === 0) {
                return res.status(404).json({ 
                    success: false, 
                    message: 'Usuário não encontrado' 
                });
            }
            
            const user = users[0];
            
            // Promover para admin
            await executeQuery(
                'UPDATE usuarios SET role = ? WHERE id = ?', 
                ['admin', userId]
            );
            
            console.log(`Admin ${req.user.email} promoveu ${user.email} para administrador`);
            
            res.json({
                success: true,
                message: `Usuário ${user.nome} foi promovido a administrador`
            });
            
        } catch (error) {
            console.error('Erro ao promover usuário:', error);
            res.status(500).json({ 
                success: false, 
                message: 'Erro ao promover usuário' 
            });
        }
    }
    
    // Rebaixar admin para usuário comum
    static async demoteFromAdmin(req, res) {
        try {
            const { userId } = req.params;
            
            if (!userId) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'ID do usuário é obrigatório' 
                });
            }
            
            // Verificar se o usuário existe
            const users = await executeQuery(
                'SELECT id, nome, email FROM usuarios WHERE id = ?', 
                [userId]
            );
            
            if (users.length === 0) {
                return res.status(404).json({ 
                    success: false, 
                    message: 'Usuário não encontrado' 
                });
            }
            
            const user = users[0];
            
            // Não permitir rebaixar o admin principal
            if (user.email === 'guilherme@networkup.com.br') {
                return res.status(403).json({ 
                    success: false, 
                    message: 'Não é possível rebaixar o administrador principal' 
                });
            }
            
            // Rebaixar para usuário comum
            await executeQuery(
                'UPDATE usuarios SET role = ? WHERE id = ?', 
                ['user', userId]
            );
            
            console.log(`Admin ${req.user.email} rebaixou ${user.email} para usuário comum`);
            
            res.json({
                success: true,
                message: `Usuário ${user.nome} foi rebaixado para usuário comum`
            });
            
        } catch (error) {
            console.error('Erro ao rebaixar usuário:', error);
            res.status(500).json({ 
                success: false, 
                message: 'Erro ao rebaixar usuário' 
            });
        }
    }
}

module.exports = AdminController;
