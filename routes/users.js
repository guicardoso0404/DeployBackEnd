// 🦟👀
const express = require('express');
const router = express.Router();
const UserController = require('../controllers/userController');
const { profileUpload } = require('../middleware/upload');
const { isAuthenticated, isAdmin } = require('../middleware/auth');

// Rota para listar todos os usuários (GET /api/users)
router.get('/', UserController.listAll);

// Rotas de usuários
router.put('/update', isAuthenticated, UserController.update);
router.post('/upload-avatar', isAuthenticated, profileUpload.single('avatar'), UserController.uploadAvatar);
router.get('/find/:email', isAuthenticated, isAdmin, UserController.findByEmail);
router.get('/list', isAuthenticated, isAdmin, UserController.list);
router.get('/:id', UserController.getById);

module.exports = router;