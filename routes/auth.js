// 🦟👀
const express = require('express');
const router = express.Router();
const AuthController = require('../controllers/authController');
const GoogleAuthController = require('../controllers/googleAuthController');
const LinkedInAuthController = require('../controllers/linkedinAuthController');

// Rotas de autenticação
router.post('/cadastro', AuthController.cadastro);
router.post('/login', AuthController.login);

// Rotas de autenticação com Google
router.get('/google', GoogleAuthController.redirectToGoogle);
router.get('/google/callback', GoogleAuthController.googleCallback);

// Rotas de autenticação com LinkedIn
router.get('/linkedin', LinkedInAuthController.redirectToLinkedIn);
router.get('/linkedin/callback', LinkedInAuthController.linkedinCallback);

// Teste LinkedIn
router.get('/linkedin/test', (req, res) => {
    res.json({
        message: 'Rota LinkedIn funcionando!',
        client_id: process.env.LINKEDIN_CLIENT_ID ? 'OK' : 'FALTANDO',
        redirect_uri: process.env.LINKEDIN_REDIRECT_URI || 'usando padrão'
    });
});

module.exports = router;