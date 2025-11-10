require('dotenv').config()

// Log para verificar se as variáveis de ambiente foram carregadas
console.log('=== VARIÁVEIS DE AMBIENTE ===');
console.log('CLOUDINARY_CLOUD_NAME:', process.env.CLOUDINARY_CLOUD_NAME ? '✓ Carregado' : '✗ NÃO carregado');
console.log('CLOUDINARY_API_KEY:', process.env.CLOUDINARY_API_KEY ? '✓ Carregado' : '✗ NÃO carregado');
console.log('CLOUDINARY_API_SECRET:', process.env.CLOUDINARY_API_SECRET ? '✓ Carregado' : '✗ NÃO carregado');
console.log('=============================\n');

const express = require('express');
const cors = require('cors');
const path = require('path');
const { createServer } = require('http');
const { Server } = require('socket.io');
const { connectDB, executeQuery } = require('./db');
const { setupSocketIO } = require('./socket/chatSocket');

// Importar rotas
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const postRoutes = require('./routes/posts');
const chatRoutes = require('./routes/chat');

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: [
            "http://localhost:3002", 
            "http://localhost:3000", 
            "http://127.0.0.1:3002",
            "http://127.0.0.1:3000",
            "http://networkup.local:3002",
            "http://networkup.local:3000"
        ],
        methods: ["GET", "POST"],
        credentials: true
    }
});
const PORT = 3002;

// Middleware básico
app.use(cors());
app.use(express.json());
app.use(express.static('../public'));

// // Log de requisições
// app.use((req, res, next) => {
//     console.log(`${req.method} ${req.path}`);
//     next();
// });

// ===== ROTAS DA API =====
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/chat', chatRoutes);

// ===== ROTAS FRONTEND =====

// Página inicial - redirecionar para home
app.get('/', (req, res) => {
    res.send('Api rodando! Acesse /home para a página inicial.');
});

// app.get('/home', (req, res) => {
//     res.sendFile('html/home.html', { root: '../public' });
// });

// app.get('/inicial', (req, res) => {
//     res.sendFile('html/home.html', { root: '../public' });
// });

// app.get('/login', (req, res) => {
//     res.sendFile('html/login.html', { root: '../public' });
// });

// app.get('/cadastro', (req, res) => {
//     res.sendFile('html/cadastro.html', { root: '../public' });
// });

// app.get('/feed', (req, res) => {
//     res.sendFile('html/feed.html', { root: '../public' });
// });

// app.get('/profile', (req, res) => {
//     res.sendFile('html/profile.html', { root: '../public' });
// });

// app.get('/user-profile', (req, res) => {
//     res.sendFile('html/user-profile.html', { root: '../public' });
// });

// app.get('/sobre', (req, res) => {
//     res.sendFile('html/sobre.html', { root: '../public' });
// });

// // Rota para página de chat
// app.get('/chat', (req, res) => {
//     res.sendFile('html/chat.html', { root: '../public' });
// });

// ===== ROTAS DA DOCUMENTAÇÃO =====

// Info da API
app.get('/api', (req, res) => {
    res.json({
        message: 'NetworkUp API está funcionando!',
        version: '1.0.0',
        docs_url: '/api-docs',
        endpoints: {
            'POST /api/auth/cadastro': 'Cadastrar usuário',
            'POST /api/auth/login': 'Fazer login',
            'PUT /api/users/update': 'Atualizar perfil de usuário',
            'POST /api/users/upload-avatar': 'Enviar/atualizar foto de perfil',
            'POST /api/posts/postar': 'Criar postagem',
            'GET /api/posts/feed': 'Obter feed',
            'POST /api/posts/curtir': 'Curtir/descurtir postagem',
            'POST /api/posts/comentar': 'Comentar postagem',
            'GET /api/users/:id': 'Obter perfil de usuário',
            'DELETE /api/posts/deletar/:id': 'Deletar postagem (requer autenticação)',
            'GET /api/users/find/:email': 'Buscar usuário por email (somente admin)',
            'GET /api/users/list': 'Listar usuários cadastrados (somente admin)',
            'GET /api/chat/conversas/:usuarioId': 'Obter conversas do usuário',
            'GET /api/chat/mensagens/:conversaId': 'Obter mensagens de uma conversa',
            'POST /api/chat/conversas/criar': 'Criar nova conversa',
            'GET /api/chat/usuarios/buscar': 'Buscar usuários para conversa'
        }
    });
});

// // Documentação da API (Swagger)
// app.get('/api-docs', (req, res) => {
//     res.sendFile('api-docs.html', { root: '../public' });
// });

// // Servir o arquivo swagger.json
// app.get('/swagger.json', (req, res) => {
//     res.sendFile('swagger.json', { root: '../' });
// });

// // 404 - Página não encontrada
// app.use('*', (req, res) => {
//     if (req.originalUrl.startsWith('/api/')) {
//         res.status(404).json({ success: false, message: 'Endpoint não encontrado' });
//     } else {
//         res.sendFile('html/home.html', { root: '../public' });
//     }
// });

// ===== FUNÇÕES AUXILIARES =====

// Função para garantir que as contas principais existam
async function createDefaultAccounts() {
    try {
        // Lista de contas principais
        const mainAccounts = [
            {
                nome: 'Guilherme Cardoso',
                email: 'guilherme@networkup.com.br',
                senha: '123456',
                descricao: 'Desenvolvedor Full Stack e criador do NetworkUp'
            },
            {
                nome: 'Guilherme Test',
                email: 'guilherme123@networkup.com.br', 
                senha: '123456',
                descricao: 'Conta de teste secundária'
            }
        ];
        
        for (const account of mainAccounts) {
            const existing = await executeQuery('SELECT id FROM usuarios WHERE email = ?', [account.email]);
            
            if (existing.length === 0) {
                await executeQuery(`
                    INSERT INTO usuarios (nome, email, senha, descricao)
                    VALUES (?, ?, ?, ?)
                `, [account.nome, account.email, account.senha, account.descricao]);
                console.log(`Conta padrão criada: ${account.email}`);
            }
        }
    } catch (error) {
        console.error('Erro ao criar contas padrão:', error);
    }
}

// ===== INICIALIZAÇÃO DO SERVIDOR =====

async function startServer() {
    try {
        // Conectar ao banco de dados
        await connectDB();
        
        // Garantir contas padrão
        await createDefaultAccounts();
        
        // Configurar Socket.io para chat
        setupSocketIO(io);
        
        // Iniciar servidor
        httpServer.listen(PORT, () => {
            console.log(`Servidor rodando na porta ${PORT}`);
        });
    } catch (error) {
        console.error('Erro ao iniciar servidor:', error);
        process.exit(1);
    }
}

// Inicializar o servidor
startServer();