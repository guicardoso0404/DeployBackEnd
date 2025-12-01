// Rotas de administração
const express = require('express');
const router = express.Router();
const AdminController = require('../controllers/adminController');
const { isAdmin } = require('../middleware/auth');

// Todas as rotas de admin requerem privilégios de administrador
router.use(isAdmin);

// Estatísticas gerais
router.get('/stats', AdminController.getStats);

// Gerenciamento de usuários
router.get('/users', AdminController.listAllUsers);
router.get('/users/:userId', AdminController.getUserDetails);
router.post('/users/:userId/ban', AdminController.banUser);
router.put('/users/:userId/ban', AdminController.banUser);
router.post('/users/:userId/unban', AdminController.unbanUser);
router.put('/users/:userId/unban', AdminController.unbanUser);
router.post('/users/:userId/promote', AdminController.promoteToAdmin);
router.post('/users/:userId/demote', AdminController.demoteFromAdmin);

// Gerenciamento de conteúdo
router.delete('/posts/:postId', AdminController.deletePost);

module.exports = router;
