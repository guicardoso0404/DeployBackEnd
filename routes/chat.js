// 🦟👀
const express = require('express');
const router = express.Router();
const ChatController = require('../controllers/chatController');
const { isAuthenticated } = require('../middleware/auth');

// Rotas de chat
router.get('/conversas/:usuarioId', isAuthenticated, ChatController.getConversations);
router.get('/mensagens/:conversaId', isAuthenticated, ChatController.getMessages);
router.post('/conversas/criar', isAuthenticated, ChatController.createConversation);
router.post('/mensagens/enviar', isAuthenticated, ChatController.sendMessage);
router.post('/mensagens/lidas', isAuthenticated, ChatController.markAsRead);
router.post('/digitando', isAuthenticated, ChatController.typing);
router.get('/usuarios/buscar', isAuthenticated, ChatController.searchUsers);

module.exports = router;