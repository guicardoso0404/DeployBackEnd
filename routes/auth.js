// 🦟👀
const express = require('express');
const router = express.Router();
const AuthController = require('../controllers/authController');
const GoogleAuthController = require('../controllers/googleAuthController');

// Rotas de autenticação
router.post('/cadastro', AuthController.cadastro);
router.post('/login', AuthController.login);

// Rotas de autenticação com Google
router.get('/google', GoogleAuthController.redirectToGoogle);
router.get('/google/callback', GoogleAuthController.googleCallback);

module.exports = router;