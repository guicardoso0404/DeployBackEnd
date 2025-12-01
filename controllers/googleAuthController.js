// Controller para autenticação com Google OAuth 2.0
const { executeQuery } = require('../db');

// URLs de configuração
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || 'https://deploy-back-end-chi.vercel.app/api/auth/google/callback';
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://deploy-frontend-woad-nine.vercel.app';

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
            const existingUsers = await executeQuery(
                'SELECT * FROM usuarios WHERE email = ? OR google_id = ?', 
                [googleUser.email, googleUser.id]
            );
            
            if (existingUsers.length > 0) {
                // Usuário já existe - fazer login
                user = existingUsers[0];
                
                // Atualizar google_id se ainda não tiver
                if (!user.google_id) {
                    await executeQuery(
                        'UPDATE usuarios SET google_id = ? WHERE id = ?',
                        [googleUser.id, user.id]
                    );
                }
                
                // Atualizar foto se não tiver e o Google fornecer
                if (!user.foto_perfil && googleUser.picture) {
                    await executeQuery(
                        'UPDATE usuarios SET foto_perfil = ? WHERE id = ?',
                        [googleUser.picture, user.id]
                    );
                    user.foto_perfil = googleUser.picture;
                }
                
                console.log('Login com Google - usuário existente:', user.email);
                
            } else {
                // Usuário novo - criar conta
                const result = await executeQuery(`
                    INSERT INTO usuarios (nome, email, senha, google_id, foto_perfil)
                    VALUES (?, ?, ?, ?, ?)
                `, [
                    googleUser.name || googleUser.email.split('@')[0],
                    googleUser.email,
                    'google_oauth_' + googleUser.id, // Senha placeholder para login Google
                    googleUser.id,
                    googleUser.picture || null
                ]);
                
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
            
            // Redirecionar para o frontend com os dados do usuário
            // Usamos base64 para passar os dados de forma segura na URL
            const userData = Buffer.from(JSON.stringify({
                success: true,
                message: 'Login com Google realizado com sucesso!',
                data: { usuario: user }
            })).toString('base64');
            
            res.redirect(`${FRONTEND_URL}/html/feed.html?auth=${userData}`);
            
        } catch (error) {
            console.error('Erro no callback do Google:', error);
            res.redirect(`${FRONTEND_URL}/html/login.html?error=callback_failed`);
        }
    }
}

module.exports = GoogleAuthController;
