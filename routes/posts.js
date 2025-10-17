// 🦟👀
const express = require('express');
const router = express.Router();
const PostController = require('../controllers/postController');
const { postUpload } = require('../middleware/upload');

// Rotas de postagens
router.post('/postar', postUpload.single('photo'), PostController.create);
router.get('/feed', PostController.getFeed);
router.post('/curtir', PostController.like);
router.post('/comentar', PostController.comment);
router.delete('/deletar/:id', PostController.delete);

module.exports = router;