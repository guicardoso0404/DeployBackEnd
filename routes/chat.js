// 🦟👀
const express = require('express');
const router = express.Router();
const ChatController = require('../controllers/chatController');

// Rotas de chat
router.get('/conversas/:usuarioId', ChatController.getConversations);
router.get('/mensagens/:conversaId', ChatController.getMessages);
router.post('/conversas/criar', ChatController.createConversation);
router.get('/usuarios/buscar', ChatController.searchUsers);

module.exports = router;