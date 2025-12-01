// Controller para autenticação com LinkedIn OAuth 2.0 v2
const { executeQuery } = require('../db');

const FRONTEND_URL = process.env.FRONTEND_URL || 'https://deploy-frontend-woad-nine.vercel.app';

class LinkedInAuthController {
    
    // Redireciona o usuário para a página de login do LinkedIn
    static redirectToLinkedIn(req, res) {
        try {
            console.log('=== INICIANDO LINKEDIN AUTH ===');
            const LINKEDIN_CLIENT_ID = process.env.LINKEDIN_CLIENT_ID;
            const LINKEDIN_REDIRECT_URI = process.env.LINKEDIN_REDIRECT_URI || 'https://deploy-back-end-chi.vercel.app/api/auth/linkedin/callback';
            
            if (!LINKEDIN_CLIENT_ID) {
                console.error('LINKEDIN_CLIENT_ID não configurado!');
                return res.redirect(`${FRONTEND_URL}/html/login.html?error=linkedin_not_configured`);
            }
            
            const scope = encodeURIComponent('openid profile email');
            const redirectUri = encodeURIComponent(LINKEDIN_REDIRECT_URI);
            const state = Math.random().toString(36).substring(7);
            
            const linkedinAuthUrl = `https://www.linkedin.com/oauth/v2/authorization?` +
                `response_type=code&` +
                `client_id=${LINKEDIN_CLIENT_ID}&` +
                `redirect_uri=${redirectUri}&` +
                `state=${state}&` +
                `scope=${scope}`;
            
            console.log('Redirecionando para LinkedIn OAuth...');
            console.log('Client ID:', LINKEDIN_CLIENT_ID);
            res.redirect(linkedinAuthUrl);
            
        } catch (error) {
            console.error('Erro ao redirecionar para LinkedIn:', error);
            res.redirect(`${FRONTEND_URL}/html/login.html?error=linkedin_redirect_failed`);
        }
    }
    
    // Callback do LinkedIn - recebe o código e troca por token
    static async linkedinCallback(req, res) {
        try {
            const LINKEDIN_CLIENT_ID = process.env.LINKEDIN_CLIENT_ID;
            const LINKEDIN_CLIENT_SECRET = process.env.LINKEDIN_CLIENT_SECRET;
            const LINKEDIN_REDIRECT_URI = process.env.LINKEDIN_REDIRECT_URI || 'https://deploy-back-end-chi.vercel.app/api/auth/linkedin/callback';
            
            const { code, error, error_description } = req.query;
            
            // Se o usuário cancelou ou houve erro
            if (error) {
                console.log('Usuário cancelou login LinkedIn:', error, error_description);
                return res.redirect(`${FRONTEND_URL}/html/login.html?error=linkedin_cancelled`);
            }
            
            if (!code) {
                console.log('Código de autorização não recebido');
                return res.redirect(`${FRONTEND_URL}/html/login.html?error=no_code`);
            }
            
            console.log('Código recebido do LinkedIn, trocando por token...');
            
            // Trocar código por access token
            const tokenResponse = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: new URLSearchParams({
                    grant_type: 'authorization_code',
                    code: code,
                    client_id: LINKEDIN_CLIENT_ID,
                    client_secret: LINKEDIN_CLIENT_SECRET,
                    redirect_uri: LINKEDIN_REDIRECT_URI
                })
            });
            
            const tokenData = await tokenResponse.json();
            
            if (tokenData.error) {
                console.error('Erro ao obter token:', tokenData.error, tokenData.error_description);
                return res.redirect(`${FRONTEND_URL}/html/login.html?error=token_failed`);
            }
            
            console.log('Token obtido com sucesso, buscando informações do usuário...');
            
            // Buscar informações do usuário com OpenID Connect userinfo
            const userResponse = await fetch('https://api.linkedin.com/v2/userinfo', {
                headers: {
                    'Authorization': `Bearer ${tokenData.access_token}`
                }
            });
            
            const linkedinUser = await userResponse.json();
            
            if (!linkedinUser.sub) {
                console.error('Dados do usuário não obtidos do LinkedIn:', linkedinUser);
                return res.redirect(`${FRONTEND_URL}/html/login.html?error=no_user_data`);
            }
            
            console.log('Usuário LinkedIn:', { 
                id: linkedinUser.sub, 
                email: linkedinUser.email, 
                name: linkedinUser.name 
            });
            
            const linkedinId = linkedinUser.sub;
            const email = linkedinUser.email;
            const nome = linkedinUser.name || linkedinUser.given_name || 'Usuário LinkedIn';
            const fotoPerfil = linkedinUser.picture || null;
            
            // Verificar se usuário já existe no banco
            let user;
            let existingUsers;
            
            try {
                existingUsers = await executeQuery(
                    'SELECT * FROM usuarios WHERE email = ? OR linkedin_id = ?', 
                    [email, linkedinId]
                );
            } catch (dbError) {
                // Se a coluna linkedin_id não existir, buscar só por email
                console.log('Coluna linkedin_id pode não existir, buscando só por email...');
                existingUsers = await executeQuery(
                    'SELECT * FROM usuarios WHERE email = ?', 
                    [email]
                );
            }
            
            if (existingUsers.length > 0) {
                // Usuário já existe - fazer login
                user = existingUsers[0];
                
                // Atualizar linkedin_id se ainda não tiver
                try {
                    if (!user.linkedin_id) {
                        await executeQuery(
                            'UPDATE usuarios SET linkedin_id = ? WHERE id = ?',
                            [linkedinId, user.id]
                        );
                    }
                } catch (e) {
                    console.log('Não foi possível atualizar linkedin_id:', e.message);
                }
                
                // Atualizar foto se não tiver e o LinkedIn fornecer
                if (!user.foto_perfil && fotoPerfil) {
                    await executeQuery(
                        'UPDATE usuarios SET foto_perfil = ? WHERE id = ?',
                        [fotoPerfil, user.id]
                    );
                    user.foto_perfil = fotoPerfil;
                }
                
                console.log('Login com LinkedIn - usuário existente:', user.email);
                
            } else {
                // Usuário novo - criar conta
                let result;
                try {
                    result = await executeQuery(`
                        INSERT INTO usuarios (nome, email, senha, linkedin_id, foto_perfil)
                        VALUES (?, ?, ?, ?, ?)
                    `, [
                        nome,
                        email,
                        'linkedin_oauth_' + linkedinId,
                        linkedinId,
                        fotoPerfil
                    ]);
                } catch (insertError) {
                    // Se falhar (coluna linkedin_id não existe), tentar sem linkedin_id
                    console.log('Tentando inserir sem linkedin_id...');
                    result = await executeQuery(`
                        INSERT INTO usuarios (nome, email, senha, foto_perfil)
                        VALUES (?, ?, ?, ?)
                    `, [
                        nome,
                        email,
                        'linkedin_oauth_' + linkedinId,
                        fotoPerfil
                    ]);
                }
                
                user = {
                    id: result.insertId,
                    nome: nome,
                    email: email,
                    foto_perfil: fotoPerfil
                };
                
                console.log('Conta criada via LinkedIn:', user.email);
            }
            
            // Remover senha da resposta
            delete user.senha;
            
            // Redirecionar para o frontend com os dados do usuário
            const userData = Buffer.from(JSON.stringify({
                success: true,
                message: 'Login com LinkedIn realizado com sucesso!',
                data: { usuario: user }
            })).toString('base64');
            
            res.redirect(`${FRONTEND_URL}/html/feed.html?auth=${userData}`);
            
        } catch (error) {
            console.error('Erro no callback do LinkedIn:', error);
            res.redirect(`${FRONTEND_URL}/html/login.html?error=callback_failed`);
        }
    }
}

module.exports = LinkedInAuthController;
