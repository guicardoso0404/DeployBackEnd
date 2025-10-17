// 🦟👀
const { executeQuery } = require('../db');

function setupSocketIO(io) {
    // Mapear usuários conectados: { userId: socketId }
    const connectedUsers = new Map();
    
    io.on('connection', (socket) => {
        console.log(`Nova conexão: ${socket.id}`);
        
        // Autenticar usuário
        socket.on('authenticate', async (userData) => {
            try {
                const { userId } = userData;
                
                if (userId) {
                    // Associar socketId ao userId
                    connectedUsers.set(userId.toString(), socket.id);
                    socket.userId = userId;
                    console.log(`Usuário ${userId} autenticado, socket: ${socket.id}`);
                    
                    // Juntar-se a salas para cada conversa do usuário
                    const conversas = await executeQuery(`
                        SELECT conversa_id 
                        FROM participantes_conversa 
                        WHERE usuario_id = ? AND status = 'ativo'
                    `, [userId]);
                    
                    conversas.forEach(({ conversa_id }) => {
                        socket.join(`chat:${conversa_id}`);
                    });
                    
                    // Notificar cliente que está autenticado
                    socket.emit('authenticated', { success: true });
                }
            } catch (error) {
                console.error('Erro na autenticação socket:', error);
                socket.emit('authenticated', { success: false });
            }
        });
        
        // Enviar mensagem
        socket.on('send_message', async (data) => {
            try {
                const { conversaId, conteudo } = data;
                const userId = socket.userId;
                
                if (!userId || !conversaId || !conteudo) {
                    socket.emit('message_error', { message: 'Dados incompletos' });
                    return;
                }
                
                // Verificar se usuário é participante da conversa
                const participante = await executeQuery(`
                    SELECT id FROM participantes_conversa
                    WHERE conversa_id = ? AND usuario_id = ? AND status = 'ativo'
                `, [conversaId, userId]);
                
                if (participante.length === 0) {
                    socket.emit('message_error', { message: 'Você não tem acesso a esta conversa' });
                    return;
                }
                
                // Salvar mensagem no banco
                const result = await executeQuery(`
                    INSERT INTO mensagens (conversa_id, usuario_id, conteudo)
                    VALUES (?, ?, ?)
                `, [conversaId, userId, conteudo]);
                
                // Buscar detalhes da mensagem para retornar
                const [mensagem] = await executeQuery(`
                    SELECT 
                        m.id, m.conteudo, m.data_envio, m.status,
                        u.id as usuario_id, u.nome as usuario_nome, u.foto_perfil
                    FROM 
                        mensagens m
                    INNER JOIN 
                        usuarios u ON m.usuario_id = u.id
                    WHERE 
                        m.id = ?
                `, [result.insertId]);
                
                // Enviar mensagem para todos na sala
                io.to(`chat:${conversaId}`).emit('new_message', {
                    message: mensagem,
                    conversaId
                });
                
                console.log(`Mensagem enviada: ${result.insertId} para conversa ${conversaId}`);
            } catch (error) {
                console.error('Erro ao enviar mensagem:', error);
                socket.emit('message_error', { message: 'Erro ao enviar mensagem' });
            }
        });
        
        // Marcar mensagens como lidas
        socket.on('mark_as_read', async (data) => {
            try {
                const { conversaId } = data;
                const userId = socket.userId;
                
                if (!userId || !conversaId) {
                    return;
                }
                
                // Atualizar status das mensagens
                await executeQuery(`
                    UPDATE mensagens
                    SET status = 'lida'
                    WHERE conversa_id = ? AND usuario_id != ? AND status = 'enviada'
                `, [conversaId, userId]);
                
                // Notificar os outros usuários da conversa
                socket.to(`chat:${conversaId}`).emit('messages_read', {
                    conversaId,
                    userId
                });
            } catch (error) {
                console.error('Erro ao marcar mensagens como lidas:', error);
            }
        });
        
        // Quando usuário digita
        socket.on('typing', (data) => {
            const { conversaId } = data;
            const userId = socket.userId;
            
            if (!userId || !conversaId) {
                return;
            }
            
            // Notificar outros usuários da conversa
            socket.to(`chat:${conversaId}`).emit('user_typing', {
                conversaId,
                userId
            });
        });
        
        // Desconexão
        socket.on('disconnect', () => {
            if (socket.userId) {
                console.log(`Usuário ${socket.userId} desconectado`);
                connectedUsers.delete(socket.userId.toString());
            }
        });
    });
    
    console.log('Socket.io configurado para chat em tempo real');
}

module.exports = { setupSocketIO };