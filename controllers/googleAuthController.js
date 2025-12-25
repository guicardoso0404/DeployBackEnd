// 🦟👀
// Controller para autenticação com Google OAuth 2.0
const { executeQuery } = require('../db');
const { resolveProfilePhotoUrl } = require('../utils/profilePhoto');
const jwt = require('jsonwebtoken');

// URLs de configuração
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || 'https://deploy-back-end-chi.vercel.app/api/auth/google/callback';
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://deploy-frontend-snowy.vercel.app';

class GoogleAuthController {
    
    // Redireciona o usuário para a página de login do Google
    static async redirectToGoogle(req, res) {
        try {
            const scope = encodeURIComponent('openid email profile');
            const redirectUri = encodeURIComponent(GOOGLE_REDIRECT_URI);
            
            const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
                `client_id=${GOOGLE_CLIENT_ID}&` +
                `redirect_uri=${redirectUri}&` +
                `response_type=code&` +
                `scope=${scope}&` +
                `access_type=offline&` +
                `prompt=consent`;
            
            console.log('Redirecionando para Google OAuth...');
            res.redirect(googleAuthUrl);
            
        } catch (error) {
            console.error('Erro ao redirecionar para Google:', error);
            res.redirect(`${FRONTEND_URL}/html/login.html?error=google_redirect_failed`);
        }
    }
    
    // Callback do Google - recebe o código e troca por token
    static async googleCallback(req, res) {
        try {
            const { code, error } = req.query;
            
            // Se o usuário cancelou ou houve erro
            if (error) {
                console.log('Usuário cancelou login Google:', error);
                return res.redirect(`${FRONTEND_URL}/html/login.html?error=google_cancelled`);
            }
            
            if (!code) {
                console.log('Código de autorização não recebido');
                return res.redirect(`${FRONTEND_URL}/html/login.html?error=no_code`);
            }
            
            console.log('Código recebido do Google, trocando por token...');
            
            // Trocar código por access token
            const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: new URLSearchParams({
                    code: code,
                    client_id: GOOGLE_CLIENT_ID,
                    client_secret: GOOGLE_CLIENT_SECRET,
                    redirect_uri: GOOGLE_REDIRECT_URI,
                    grant_type: 'authorization_code'
                })
            });
            
            const tokenData = await tokenResponse.json();
            
            if (tokenData.error) {
                console.error('Erro ao obter token:', tokenData.error);
                return res.redirect(`${FRONTEND_URL}/html/login.html?error=token_failed`);
            }
            
            console.log('Token obtido com sucesso, buscando informações do usuário...');
            
            // Buscar informações do usuário com o access token
            const userResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
                headers: {
                    'Authorization': `Bearer ${tokenData.access_token}`
                }
            });
            
            const googleUser = await userResponse.json();
            
            console.log('[DEBUG Google] Dados recebidos do Google:', JSON.stringify(googleUser, null, 2));

            if (!googleUser.email) {
                console.error('Email não obtido do Google');
                return res.redirect(`${FRONTEND_URL}/html/login.html?error=no_email`);
            }
            
            console.log('Usuário Google:', { 
                id: googleUser.id, 
                email: googleUser.email, 
                name: googleUser.name 
            });
            
            // Verificar se usuário já existe no banco
            let user;
            let existingUsers;
            
            try {
                existingUsers = await executeQuery(
                    'SELECT * FROM usuarios WHERE email = ? OR google_id = ?', 
                    [googleUser.email, googleUser.id]
                );
            } catch (dbError) {
                // Se a coluna google_id não existir, buscar só por email
                console.log('Coluna google_id pode não existir, buscando só por email...');
                existingUsers = await executeQuery(
                    'SELECT * FROM usuarios WHERE email = ?', 
                    [googleUser.email]
                );
            }
            
            if (existingUsers.length > 0) {
                // Usuário já existe - fazer login
                user = existingUsers[0];
                console.log('[DEBUG Google] Usuário existente encontrado:', { id: user.id, email: user.email, foto_perfil_atual: user.foto_perfil });

                // Verificar se usuário está banido
                if (user.status === 'banido') {
                    console.log('Login Google bloqueado - usuário banido:', user.email);
                    return res.redirect(`${FRONTEND_URL}/html/login.html?error=user_banned`);
                }
                
                // Atualizar google_id se ainda não tiver
                try {
                    if (!user.google_id) {
                        await executeQuery(
                            'UPDATE usuarios SET google_id = ? WHERE id = ?',
                            [googleUser.id, user.id]
                        );
                    }
                } catch (e) {
                    console.log('Não foi possível atualizar google_id:', e.message);
                }
                
                // Atualizar foto se o Google fornecer uma.
                // Isso sobrepõe fotos antigas (ex: do Cloudinary) com a do Google.
                if (googleUser.picture) {
                    console.log(`[DEBUG Google] Atualizando foto para: ${googleUser.picture}`);
                    await executeQuery(
                        'UPDATE usuarios SET foto_perfil = ? WHERE id = ?',
                        [googleUser.picture, user.id]
                    );
                    user.foto_perfil = googleUser.picture;
                }
                
                console.log('Login com Google - usuário existente:', user.email);
                
            } else {
                // Usuário novo - criar conta
                console.log('[DEBUG Google] Criando novo usuário com foto:', googleUser.picture);
                let result;
                try {
                    result = await executeQuery(`
                        INSERT INTO usuarios (nome, email, senha, google_id, foto_perfil)
                        VALUES (?, ?, ?, ?, ?)
                    `, [
                        googleUser.name || googleUser.email.split('@')[0],
                        googleUser.email,
                        'google_oauth_' + googleUser.id,
                        googleUser.id,
                        googleUser.picture || null
                    ]);
                } catch (insertError) {
                    // Se falhar (coluna google_id não existe), tentar sem google_id
                    console.log('Tentando inserir sem google_id...');
                    result = await executeQuery(`
                        INSERT INTO usuarios (nome, email, senha, foto_perfil)
                        VALUES (?, ?, ?, ?)
                    `, [
                        googleUser.name || googleUser.email.split('@')[0],
                        googleUser.email,
                        'google_oauth_' + googleUser.id,
                        googleUser.picture || null
                    ]);
                }
                
                user = {
                    id: result.insertId,
                    nome: googleUser.name || googleUser.email.split('@')[0],
                    email: googleUser.email,
                    foto_perfil: googleUser.picture || null
                };
                
                console.log('Conta criada via Google:', user.email);
            }
            
            // Remover senha da resposta
            delete user.senha;

            if (!process.env.JWT_SECRET) {
                return res.redirect(`${FRONTEND_URL}/html/login.html?error=jwt_not_configured`);
            }
            
            // Gerar URL da foto de perfil (Cloudinary public_id ou URL externa)
            user.foto_perfil_url = resolveProfilePhotoUrl(user.foto_perfil);
            
            console.log('[DEBUG Google] Objeto final do usuário antes de redirecionar:', JSON.stringify(user, null, 2));

            const expiresIn = process.env.JWT_EXPIRES_IN || '7d';
            const accessToken = jwt.sign(
                { role: user.role || 'user' },
                process.env.JWT_SECRET,
                { subject: String(user.id), expiresIn }
            );
            
            // Redirecionar para o frontend com os dados do usuário
            // Usamos base64 para passar os dados de forma segura na URL
            const userData = Buffer.from(JSON.stringify({
                success: true,
                message: 'Login com Google realizado com sucesso!',
                data: { usuario: user, accessToken, tokenType: 'Bearer', expiresIn }
            })).toString('base64');
            
            res.redirect(`${FRONTEND_URL}/html/feed.html?auth=${userData}`);
            
        } catch (error) {
            console.error('Erro no callback do Google:', error);
            res.redirect(`${FRONTEND_URL}/html/login.html?error=callback_failed`);
        }
    }
}

module.exports = GoogleAuthController;
