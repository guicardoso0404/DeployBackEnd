// 🦟👀
const { executeQuery } = require('../db');

class PostController {
    // Criar postagem
    static async create(req, res) {
        try {
            const { usuario_id, conteudo } = req.body;
            
            if (!usuario_id || (!conteudo && !req.file)) {
                return res.json({ success: false, message: 'Usuário e conteúdo (ou imagem) são obrigatórios' });
            }
            
            // Caminho da imagem se foi enviada
            const imagePath = req.file ? `/uploads/posts/${req.file.filename}` : null;
            
            const result = await executeQuery(
                'INSERT INTO postagens (usuario_id, conteudo, imagem) VALUES (?, ?, ?)', 
                [usuario_id, conteudo || '', imagePath]
            );
            
            console.log('Postagem criada:', result.insertId);
            
            res.json({
                success: true,
                message: 'Postagem criada com sucesso!',
                data: { id: result.insertId, usuario_id, conteudo, imagem: imagePath }
            });
            
        } catch (error) {
            console.error('Erro ao criar postagem:', error);
            res.json({ success: false, message: 'Erro interno do servidor' });
        }
    }

    // Obter feed
    static async getFeed(req, res) {
        try {
            const posts = await executeQuery(`
                SELECT 
                    p.id, p.conteudo, p.imagem, p.curtidas, p.data_criacao as created_at,
                    u.id as usuario_id, u.nome as usuario_nome, u.email as usuario_email, u.foto_perfil
                FROM postagens p
                JOIN usuarios u ON p.usuario_id = u.id
                ORDER BY p.data_criacao DESC
                LIMIT 20
            `);
            
            // Buscar comentários para cada post
            for (let post of posts) {
                const comments = await executeQuery(`
                    SELECT 
                        c.id, c.conteudo, c.data_criacao as created_at,
                        u.id as usuario_id, u.nome as usuario_nome, u.foto_perfil
                    FROM comentarios c
                    JOIN usuarios u ON c.usuario_id = u.id
                    WHERE c.postagem_id = ?
                    ORDER BY c.data_criacao ASC
                    LIMIT 3
                `, [post.id]);
                
                post.comentarios_lista = comments;
            }
            
            res.json({ success: true, data: posts });
            
        } catch (error) {
            console.error('Erro ao obter feed:', error);
            res.json({ success: false, message: 'Erro interno do servidor' });
        }
    }

    // Curtir postagem
    static async like(req, res) {
        try {
            const { postagem_id, usuario_id } = req.body;
            
            if (!postagem_id || !usuario_id) {
                return res.json({ success: false, message: 'Postagem e usuário são obrigatórios' });
            }
            
            // Verificar se já curtiu
            const existing = await executeQuery('SELECT id FROM curtidas WHERE postagem_id = ? AND usuario_id = ?', [postagem_id, usuario_id]);
            
            let acao;
            if (existing.length > 0) {
                // Remover curtida
                await executeQuery('DELETE FROM curtidas WHERE postagem_id = ? AND usuario_id = ?', [postagem_id, usuario_id]);
                acao = 'descurtiu';
            } else {
                // Adicionar curtida
                await executeQuery('INSERT INTO curtidas (postagem_id, usuario_id) VALUES (?, ?)', [postagem_id, usuario_id]);
                acao = 'curtiu';
            }
            
            // Contar total de curtidas
            const total = await executeQuery('SELECT COUNT(*) as count FROM curtidas WHERE postagem_id = ?', [postagem_id]);
            const totalCurtidas = total[0].count;
            
            // Atualizar contador na postagem
            await executeQuery('UPDATE postagens SET curtidas = ? WHERE id = ?', [totalCurtidas, postagem_id]);
            
            res.json({
                success: true,
                message: `Postagem ${acao} com sucesso!`,
                data: { postagem_id, usuario_id, acao, total_curtidas: totalCurtidas }
            });
            
        } catch (error) {
            console.error('Erro ao curtir:', error);
            res.json({ success: false, message: 'Erro interno do servidor' });
        }
    }

    // Comentar postagem
    static async comment(req, res) {
        try {
            const { postagem_id, usuario_id, conteudo } = req.body;
            
            if (!postagem_id || !usuario_id || !conteudo) {
                return res.json({ success: false, message: 'Todos os campos são obrigatórios' });
            }
            
            const result = await executeQuery('INSERT INTO comentarios (postagem_id, usuario_id, conteudo) VALUES (?, ?, ?)', 
                [postagem_id, usuario_id, conteudo]);
            
            // Contar total de comentários
            const total = await executeQuery('SELECT COUNT(*) as count FROM comentarios WHERE postagem_id = ?', [postagem_id]);
            const totalComentarios = total[0].count;
            
            // Atualizar contador na postagem
            await executeQuery('UPDATE postagens SET comentarios = ? WHERE id = ?', [totalComentarios, postagem_id]);
            
            console.log('Comentário adicionado:', result.insertId);
            
            res.json({
                success: true,
                message: 'Comentário adicionado com sucesso!',
                data: { id: result.insertId, postagem_id, usuario_id, conteudo }
            });
            
        } catch (error) {
            console.error('Erro ao comentar:', error);
            res.json({ success: false, message: 'Erro interno do servidor' });
        }
    }

    // Deletar postagem (apenas para administradores)
    static async delete(req, res) {
        try {
            const postId = req.params.id;
            const { usuario_id } = req.body;
            
            if (!postId || !usuario_id) {
                return res.json({ success: false, message: 'Post ID e usuário são obrigatórios' });
            }
            
            // Verificar se o usuário é o criador do post ou administrador
            const post = await executeQuery('SELECT * FROM postagens WHERE id = ?', [postId]);
            const user = await executeQuery('SELECT * FROM usuarios WHERE id = ?', [usuario_id]);
            
            if (post.length === 0) {
                return res.json({ success: false, message: 'Postagem não encontrada' });
            }
            
            if (user.length === 0) {
                return res.json({ success: false, message: 'Usuário não encontrado' });
            }
            
            // Verificar se é o criador do post ou admin (email com "guilherme")
            const isOwner = post[0].usuario_id === parseInt(usuario_id);
            const isAdmin = user[0].email.includes('guilherme');
            
            if (!isOwner && !isAdmin) {
                return res.json({ success: false, message: 'Você não tem permissão para deletar este post' });
            }
            
            // Deletar comentários primeiro
            await executeQuery('DELETE FROM comentarios WHERE postagem_id = ?', [postId]);
            
            // Deletar curtidas
            await executeQuery('DELETE FROM curtidas WHERE postagem_id = ?', [postId]);
            
            // Deletar postagem
            await executeQuery('DELETE FROM postagens WHERE id = ?', [postId]);
            
            console.log('Postagem deletada:', postId, 'por usuário:', usuario_id);
            
            res.json({
                success: true,
                message: 'Postagem deletada com sucesso!',
                data: { postagem_id: postId }
            });
            
        } catch (error) {
            console.error('Erro ao deletar postagem:', error);
            res.json({ success: false, message: 'Erro interno do servidor' });
        }
    }
}

module.exports = PostController;