// 🦟👀
const { executeQuery } = require('../db');

class ChatController {
    // Obter conversas do usuário
    static async getConversations(req, res) {
        try {
            const usuarioId = req.params.usuarioId;
            
            if (!usuarioId) {
                return res.json({ success: false, message: 'ID do usuário é obrigatório' });
            }
            
            // Buscar conversas em que o usuário é participante
            const conversas = await executeQuery(`
                SELECT 
                    c.id, c.nome, c.tipo, c.data_criacao
                FROM 
                    conversas c
                INNER JOIN 
                    participantes_conversa pc ON c.id = pc.conversa_id
                WHERE 
                    pc.usuario_id = ? AND pc.status = 'ativo'
                ORDER BY 
                    c.data_criacao DESC
            `, [usuarioId]);
            
            // Para cada conversa, buscar detalhes adicionais
            for (const conversa of conversas) {
                // Se for chat individual, buscar informações do outro usuário
                if (conversa.tipo === 'individual') {
                    const outroUsuario = await executeQuery(`
                        SELECT 
                            u.id, u.nome, u.foto_perfil
                        FROM 
                            usuarios u
                        INNER JOIN 
                            participantes_conversa pc ON u.id = pc.usuario_id
                        WHERE 
                            pc.conversa_id = ? AND pc.usuario_id != ? AND pc.status = 'ativo'
                        LIMIT 1
                    `, [conversa.id, usuarioId]);
                    
                    if (outroUsuario.length > 0) {
                        conversa.outro_usuario = outroUsuario[0];
                        // Se não tiver nome definido, usar nome do outro usuário
                        if (!conversa.nome) {
                            conversa.nome = outroUsuario[0].nome;
                        }
                    }
                }
                
                // Buscar última mensagem
                const ultimaMensagem = await executeQuery(`
                    SELECT 
                        m.id, m.conteudo, m.data_envio, m.status,
                        u.id as usuario_id, u.nome as usuario_nome
                    FROM 
                        mensagens m
                    INNER JOIN 
                        usuarios u ON m.usuario_id = u.id
                    WHERE 
                        m.conversa_id = ?
                    ORDER BY 
                        m.data_envio DESC
                    LIMIT 1
                `, [conversa.id]);
                
                if (ultimaMensagem.length > 0) {
                    conversa.ultima_mensagem = ultimaMensagem[0];
                }
                
                // Contar mensagens não lidas
                const mensagensNaoLidas = await executeQuery(`
                    SELECT 
                        COUNT(*) as total
                    FROM 
                        mensagens
                    WHERE 
                        conversa_id = ? AND 
                        usuario_id != ? AND
                        status = 'enviada'
                `, [conversa.id, usuarioId]);
                
                conversa.nao_lidas = mensagensNaoLidas[0].total;
            }
            
            res.json({
                success: true,
                data: conversas
            });
            
        } catch (error) {
            console.error('Erro ao obter conversas:', error);
            res.json({ success: false, message: 'Erro interno do servidor' });
        }
    }

    // Obter mensagens de uma conversa
    static async getMessages(req, res) {
        try {
            const conversaId = req.params.conversaId;
            const usuarioId = req.query.usuarioId;
            
            if (!conversaId || !usuarioId) {
                return res.json({ success: false, message: 'ID da conversa e do usuário são obrigatórios' });
            }
            
            // Verificar se o usuário é participante da conversa
            const participante = await executeQuery(`
                SELECT id FROM participantes_conversa
                WHERE conversa_id = ? AND usuario_id = ? AND status = 'ativo'
            `, [conversaId, usuarioId]);
            
            if (participante.length === 0) {
                return res.json({ success: false, message: 'Você não tem acesso a esta conversa' });
            }
            
            // Buscar mensagens
            const mensagens = await executeQuery(`
                SELECT 
                    m.id, m.conteudo, m.data_envio, m.status,
                    u.id as usuario_id, u.nome as usuario_nome, u.foto_perfil
                FROM 
                    mensagens m
                INNER JOIN 
                    usuarios u ON m.usuario_id = u.id
                WHERE 
                    m.conversa_id = ?
                ORDER BY 
                    m.data_envio ASC
            `, [conversaId]);
            
            // Marcar mensagens como lidas
            await executeQuery(`
                UPDATE mensagens
                SET status = 'lida'
                WHERE conversa_id = ? AND usuario_id != ? AND status = 'enviada'
            `, [conversaId, usuarioId]);
            
            res.json({
                success: true,
                data: mensagens
            });
            
        } catch (error) {
            console.error('Erro ao obter mensagens:', error);
            res.json({ success: false, message: 'Erro interno do servidor' });
        }
    }

    // Criar nova conversa
    static async createConversation(req, res) {
        try {
            const { usuarioId, outroUsuarioId, tipo, nome } = req.body;
            
            if (!usuarioId || (!outroUsuarioId && tipo !== 'grupo') || !tipo) {
                return res.json({ success: false, message: 'Dados insuficientes para criar conversa' });
            }
            
            // Para chat individual, verificar se já existe conversa entre os usuários
            if (tipo === 'individual' && outroUsuarioId) {
                // Verificar se já existe conversa
                const conversaExistente = await executeQuery(`
                    SELECT c.id
                    FROM conversas c
                    JOIN participantes_conversa pc1 ON c.id = pc1.conversa_id
                    JOIN participantes_conversa pc2 ON c.id = pc2.conversa_id
                    WHERE c.tipo = 'individual'
                    AND pc1.usuario_id = ? AND pc1.status = 'ativo'
                    AND pc2.usuario_id = ? AND pc2.status = 'ativo'
                    LIMIT 1
                `, [usuarioId, outroUsuarioId]);
                
                if (conversaExistente.length > 0) {
                    return res.json({
                        success: true,
                        message: 'Conversa já existe',
                        data: { id: conversaExistente[0].id, ja_existia: true }
                    });
                }
            }
            
            // Criar nova conversa
            const resultConversa = await executeQuery(`
                INSERT INTO conversas (nome, tipo)
                VALUES (?, ?)
            `, [nome || null, tipo]);
            
            const conversaId = resultConversa.insertId;
            
            // Adicionar usuário criador como participante
            await executeQuery(`
                INSERT INTO participantes_conversa (conversa_id, usuario_id)
                VALUES (?, ?)
            `, [conversaId, usuarioId]);
            
            // Para chat individual, adicionar o outro usuário
            if (tipo === 'individual' && outroUsuarioId) {
                await executeQuery(`
                    INSERT INTO participantes_conversa (conversa_id, usuario_id)
                    VALUES (?, ?)
                `, [conversaId, outroUsuarioId]);
            }
            
            res.json({
                success: true,
                message: 'Conversa criada com sucesso',
                data: { id: conversaId, ja_existia: false }
            });
            
        } catch (error) {
            console.error('Erro ao criar conversa:', error);
            res.json({ success: false, message: 'Erro interno do servidor' });
        }
    }

    // Buscar usuários para conversa
    static async searchUsers(req, res) {
        try {
            const { termo, usuarioId } = req.query;
            
            if (!termo || !usuarioId) {
                return res.json({ success: false, message: 'Termo de busca e ID do usuário são obrigatórios' });
            }
            
            // Buscar usuários que correspondem ao termo (exceto o próprio usuário)
            const usuarios = await executeQuery(`
                SELECT id, nome, email, foto_perfil
                FROM usuarios
                WHERE (nome LIKE ? OR email LIKE ?)
                AND id != ?
                LIMIT 10
            `, [`%${termo}%`, `%${termo}%`, usuarioId]);
            
            res.json({
                success: true,
                data: usuarios
            });
            
        } catch (error) {
            console.error('Erro ao buscar usuários:', error);
            res.json({ success: false, message: 'Erro interno do servidor' });
        }
    }
}

module.exports = ChatController;