// 🦟👀
const { executeQuery } = require('../db');

class UserController {
    // Atualizar usuário
    static async update(req, res) {
        try {
            const { usuario_id, nome, email, senha, descricao } = req.body;
            
            if (!usuario_id || !nome || !email) {
                return res.json({ success: false, message: 'ID do usuário, nome e email são obrigatórios' });
            }
            
            // Verificar se o usuário existe
            const userExists = await executeQuery('SELECT id FROM usuarios WHERE id = ?', [usuario_id]);
            if (userExists.length === 0) {
                return res.json({ success: false, message: 'Usuário não encontrado' });
            }
            
            // Verificar se o email já está sendo usado por outro usuário
            const emailExists = await executeQuery('SELECT id FROM usuarios WHERE email = ? AND id != ?', [email, usuario_id]);
            if (emailExists.length > 0) {
                return res.json({ success: false, message: 'Este email já está sendo usado por outro usuário' });
            }
            
            // Preparar query de atualização
            let updateQuery = 'UPDATE usuarios SET nome = ?, email = ?, descricao = ?';
            let updateParams = [nome, email, descricao || null];
            
            // Adicionar senha se foi fornecida
            if (senha) {
                updateQuery += ', senha = ?';
                updateParams.push(senha);
            }
            
            updateQuery += ' WHERE id = ?';
            updateParams.push(usuario_id);
            
            // Executar atualização
            await executeQuery(updateQuery, updateParams);
            
            console.log('Usuário atualizado:', { id: usuario_id, nome, email });
            
            res.json({
                success: true,
                message: 'Perfil atualizado com sucesso!',
                data: { id: usuario_id, nome, email, descricao }
            });
            
        } catch (error) {
            console.error('Erro ao atualizar usuário:', error);
            res.json({ success: false, message: 'Erro interno do servidor: ' + error.message });
        }
    }

    // Upload de avatar
    static async uploadAvatar(req, res) {
        try {
            const { usuario_id } = req.body;
            
            if (!usuario_id || !req.file) {
                return res.json({ success: false, message: 'Usuário e arquivo são obrigatórios' });
            }
            
            // Caminho da imagem
            const avatarPath = `/uploads/profiles/${req.file.filename}`;
            
            // Atualizar banco de dados
            await executeQuery('UPDATE usuarios SET foto_perfil = ? WHERE id = ?', [avatarPath, usuario_id]);
            
            console.log('Avatar atualizado para usuário:', usuario_id);
            
            res.json({
                success: true,
                message: 'Foto de perfil atualizada com sucesso!',
                data: { foto_perfil: avatarPath }
            });
            
        } catch (error) {
            console.error('Erro ao fazer upload do avatar:', error);
            res.json({ success: false, message: 'Erro interno do servidor' });
        }
    }

    // Obter informações de um usuário específico
    static async getById(req, res) {
        try {
            const userId = req.params.id;
            
            if (!userId) {
                return res.json({ success: false, message: 'ID do usuário é obrigatório' });
            }
            
            // Buscar informações do usuário
            const users = await executeQuery('SELECT id, nome, email, foto_perfil, descricao, data_criacao FROM usuarios WHERE id = ?', [userId]);
            
            if (users.length === 0) {
                return res.json({ success: false, message: 'Usuário não encontrado' });
            }
            
            const user = users[0];
            
            // Buscar posts do usuário
            const posts = await executeQuery(`
                SELECT 
                    p.id, p.conteudo, p.imagem, p.curtidas, p.comentarios, p.data_criacao as created_at
                FROM postagens p
                WHERE p.usuario_id = ?
                ORDER BY p.data_criacao DESC
                LIMIT 10
            `, [userId]);
            
            // Contar total de posts
            const totalPosts = await executeQuery('SELECT COUNT(*) as count FROM postagens WHERE usuario_id = ?', [userId]);
            
            res.json({
                success: true,
                data: {
                    user: user,
                    posts: posts,
                    stats: {
                        total_posts: totalPosts[0].count
                    }
                }
            });
            
        } catch (error) {
            console.error('Erro ao obter usuário:', error);
            res.json({ success: false, message: 'Erro interno do servidor' });
        }
    }

    // Buscar usuário por email (admin only)
    static async findByEmail(req, res) {
        try {
            const requestEmail = req.headers['user-email'];
            const email = req.params.email;
            
            // Verificar se o solicitante é admin (contém "guilherme" no email)
            if (!requestEmail || !requestEmail.includes('guilherme')) {
                return res.json({ success: false, message: 'Acesso negado' });
            }
            
            const users = await executeQuery('SELECT id, nome, email, descricao, foto_perfil FROM usuarios WHERE email = ?', [email]);
            
            if (users.length === 0) {
                return res.json({ success: false, message: 'Usuário não encontrado' });
            }
            
            res.json({
                success: true,
                data: users[0]
            });
            
        } catch (error) {
            console.error('Erro ao buscar usuário:', error);
            res.json({ success: false, message: 'Erro interno do servidor' });
        }
    }

    // Listar usuários (admin only)
    static async list(req, res) {
        try {
            const requestEmail = req.headers['user-email'];
            
            // Verificar se o solicitante é admin (contém "guilherme" no email)
            if (!requestEmail || !requestEmail.includes('guilherme')) {
                return res.json({ success: false, message: 'Acesso negado' });
            }
            
            const users = await executeQuery(`
                SELECT id, nome, email, descricao, foto_perfil, 
                       DATE_FORMAT(data_criacao, '%d/%m/%Y %H:%i') as data_criacao 
                FROM usuarios 
                ORDER BY data_criacao DESC
            `);
            
            res.json({
                success: true,
                message: `${users.length} usuários encontrados`,
                data: users
            });
            
        } catch (error) {
            console.error('Erro ao listar usuários:', error);
            res.json({ success: false, message: 'Erro interno do servidor' });
        }
    }
}

module.exports = UserController;