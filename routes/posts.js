// 🦟👀
const express = require('express');
const router = express.Router();
const PostController = require('../controllers/postController');
const { postUpload } = require('../middleware/upload');
const { isAuthenticated } = require('../middleware/auth');

// Rotas de postagens
router.post('/postar', isAuthenticated, postUpload.single('photo'), PostController.create);
router.get('/feed', PostController.getFeed);
router.post('/curtir', isAuthenticated, PostController.like);
router.post('/comentar', isAuthenticated, PostController.comment);
router.delete('/deletar/:id', isAuthenticated, PostController.delete);

module.exports = router;