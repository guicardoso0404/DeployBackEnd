// 🦟👀
const { executeQuery } = require('../db');

class AuthController {
    // Cadastrar novo usuário
    static async cadastro(req, res) {
        try {
            const { nome, email, senha } = req.body;  
            
            // Validação básica
            if (!nome || !email || !senha) {
                return res.json({ success: false, message: 'Nome, email e senha são obrigatórios' });
            }
            
            // Verificar se email já existe
            const existing = await executeQuery('SELECT id FROM usuarios WHERE email = ?', [email]);
            if (existing.length > 0) {
                return res.json({ success: false, message: 'Este email já está cadastrado' });
            }
            
            // Inserir usuário 
            const result = await executeQuery(`
                INSERT INTO usuarios (nome, email, senha)
                VALUES (?, ?, ?)
            `, [nome, email, senha]);
            
            console.log('Usuário cadastrado:', { id: result.insertId, nome, email });
            
            res.json({
                success: true,
                message: 'Usuário cadastrado com sucesso!',
                data: { id: result.insertId, nome, email }
            });
            
        } catch (error) {
            console.error('Erro no cadastro:', error);
            res.json({ success: false, message: 'Erro interno do servidor: ' + error.message });
        }
    }

    // Fazer login
    static async login(req, res) {
        try {
            const { email, senha } = req.body;
            
            if (!email || !senha) {
                return res.json({ success: false, message: 'Email e senha são obrigatórios' });
            }
            
            // Buscar usuário (comparação direta da senha)
            const users = await executeQuery('SELECT * FROM usuarios WHERE email = ? AND senha = ?', [email, senha]);
            
            if (users.length === 0) {
                console.log('Login falhou:', email);
                return res.json({ success: false, message: 'Email ou senha incorretos' });
            }
            
            const user = users[0];
            console.log('Login sucesso:', { id: user.id, nome: user.nome, email: user.email });
            delete user.senha; // Remover senha da resposta
            
            res.json({
                success: true,
                message: 'Login realizado com sucesso!',
                data: { usuario: user, redirectTo: '/feed' }
            });
            
        } catch (error) {
            console.error('Erro no login:', error);
            res.json({ success: false, message: 'Erro interno do servidor' });
        }
    }
}

module.exports = AuthController;