// 🦟👀
const express = require('express');
const router = express.Router();
const UserController = require('../controllers/userController');
const { profileUpload } = require('../middleware/upload');

// Rota para listar todos os usuários (GET /api/users)
router.get('/', UserController.listAll);

// Rotas de usuários
router.put('/update', UserController.update);
router.post('/upload-avatar', profileUpload.single('avatar'), UserController.uploadAvatar);
router.get('/find/:email', UserController.findByEmail);
router.get('/list', UserController.list);
router.get('/:id', UserController.getById);

module.exports = router;