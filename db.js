// 🦟👀
const mysql = require('mysql2/promise');

// Configuração da conexão com MySQL
const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'root',
    database: process.env.DB_NAME || 'networkup_certo',
    port: process.env.DB_PORT || 3306,
    charset: 'utf8mb4'
};

// Pool de conexões
let pool;

// Função para conectar ao banco de dados
async function connectDB() {
    try {
        console.log('Conectando ao banco de dados MySQL...');
        
        // Criar pool de conexões
        pool = mysql.createPool({
            ...dbConfig,
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0
        });

        // Testar conexão
        const connection = await pool.getConnection();
        console.log('Conexão com MySQL estabelecida com sucesso!');
        console.log(`Database: ${dbConfig.database}@${dbConfig.host}:${dbConfig.port}`);
        
        connection.release();
        
        // Criar tabelas se não existirem
        await createTables();
        
        return pool;
    } catch (error) {
        console.error('Erro ao conectar com o banco de dados:', error.message);
        
        // Se o banco não existe, tentar criar
        if (error.code === 'ER_BAD_DB_ERROR') {
            console.log('Tentando criar o banco de dados...');
            await createDatabase();
        } else {
            console.error('Verifique se o MySQL está rodando e as configurações estão corretas');
            console.error('Config atual:', {
                host: dbConfig.host,
                user: dbConfig.user,
                database: dbConfig.database,
                port: dbConfig.port
            });
        }
        
        throw error;
    }
}

// // Função para criar o banco de dados
async function createDatabase() {
    try {
        const tempConfig = { ...dbConfig };
        delete tempConfig.database;
        
        const tempConnection = await mysql.createConnection(tempConfig);
        
        // Criar o banco de dados se não existir
        await tempConnection.execute(`CREATE DATABASE IF NOT EXISTS ${dbConfig.database} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
        console.log(`Banco de dados '${dbConfig.database}' criado com sucesso!`);
        
        // Usar o banco de dados
        await tempConnection.execute(`USE ${dbConfig.database}`);
        
        await tempConnection.end();
        
        // Reconectar com o banco criado
        return await connectDB();
    } catch (error) {
        console.error('Erro ao criar banco de dados:', error.message);
        throw error;
    }
}

// Função para criar as tabelas
async function createTables() {
    try {
        console.log('Verificando/criando tabelas...');
        
        // Habilitar verificação de chaves estrangeiras
        await pool.execute(`SET FOREIGN_KEY_CHECKS = 1`);
        
        // Tabela de usuários (tabela principal)
        await pool.execute(`
            CREATE TABLE IF NOT EXISTS usuarios (
                id INT AUTO_INCREMENT PRIMARY KEY,
                nome VARCHAR(100) NOT NULL,
                email VARCHAR(150) UNIQUE NOT NULL,
                senha VARCHAR(255) NOT NULL,
                descricao TEXT,
                foto_perfil TEXT,
                data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        // Tabela de postagens
        await pool.execute(`
            CREATE TABLE IF NOT EXISTS postagens (
                id INT AUTO_INCREMENT PRIMARY KEY,
                usuario_id INT NOT NULL,
                conteudo TEXT NOT NULL,
                imagem TEXT,
                curtidas INT DEFAULT 0,
                comentarios INT DEFAULT 0,
                data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        // Tabela de comentários
        await pool.execute(`
            CREATE TABLE IF NOT EXISTS comentarios (
                id INT AUTO_INCREMENT PRIMARY KEY,
                postagem_id INT NOT NULL,
                usuario_id INT NOT NULL,
                conteudo TEXT NOT NULL,
                data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (postagem_id) REFERENCES postagens(id) ON DELETE CASCADE,
                FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        // Tabela de curtidas
        await pool.execute(`
            CREATE TABLE IF NOT EXISTS curtidas (
                id INT AUTO_INCREMENT PRIMARY KEY,
                postagem_id INT NOT NULL,
                usuario_id INT NOT NULL,
                data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY unique_curtida (postagem_id, usuario_id),
                FOREIGN KEY (postagem_id) REFERENCES postagens(id) ON DELETE CASCADE,
                FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        
        // Tabela de conversas (chats)
        await pool.execute(`
            CREATE TABLE IF NOT EXISTS conversas (
                id INT AUTO_INCREMENT PRIMARY KEY,
                nome VARCHAR(100),
                tipo ENUM('individual', 'grupo') DEFAULT 'individual',
                data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        // Tabela de participantes das conversas
        await pool.execute(`
            CREATE TABLE IF NOT EXISTS participantes_conversa (
                id INT AUTO_INCREMENT PRIMARY KEY,
                conversa_id INT NOT NULL,
                usuario_id INT NOT NULL,
                data_entrada TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                status ENUM('ativo', 'saiu', 'banido') DEFAULT 'ativo',
                FOREIGN KEY (conversa_id) REFERENCES conversas(id) ON DELETE CASCADE,
                FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
                UNIQUE KEY unique_participante (conversa_id, usuario_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        // Tabela de mensagens
        await pool.execute(`
            CREATE TABLE IF NOT EXISTS mensagens (
                id INT AUTO_INCREMENT PRIMARY KEY,
                conversa_id INT NOT NULL,
                usuario_id INT NOT NULL,
                conteudo TEXT NOT NULL,
                data_envio TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                status ENUM('enviada', 'entregue', 'lida', 'excluida') DEFAULT 'enviada',
                FOREIGN KEY (conversa_id) REFERENCES conversas(id) ON DELETE CASCADE,
                FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        // Mostrar estatísticas do banco de dados (para log)
        const [stats] = await pool.execute(`
            SELECT 
                (SELECT COUNT(*) FROM usuarios) as total_usuarios,
                (SELECT COUNT(*) FROM postagens) as total_postagens,
                (SELECT COUNT(*) FROM comentarios) as total_comentarios,
                (SELECT COUNT(*) FROM curtidas) as total_curtidas,
                (SELECT COUNT(*) FROM conversas) as total_conversas,
                (SELECT COUNT(*) FROM mensagens) as total_mensagens
        `);
        
        console.log('Estatísticas do banco de dados:');
        console.log(`- Total de usuários: ${stats[0].total_usuarios}`);
        console.log(`- Total de postagens: ${stats[0].total_postagens}`);
        console.log(`- Total de comentários: ${stats[0].total_comentarios}`);
        console.log(`- Total de curtidas: ${stats[0].total_curtidas}`);
        console.log(`- Total de conversas: ${stats[0].total_conversas || 0}`);
        console.log(`- Total de mensagens: ${stats[0].total_mensagens || 0}`);
        console.log('Tabelas criadas/verificadas com sucesso!');
        
    } catch (error) {
        console.error('Erro ao criar tabelas:', error.message);
        throw error;
    }
}

// Função para obter uma conexão do pool
function getConnection() {
    if (!pool) {
        throw new Error('Banco de dados não conectado. Execute connectDB() primeiro.');
    }
    return pool;
}

// Função para executar queries com tratamento de erro
async function executeQuery(query, params = []) {
    try {
        const connection = getConnection();
        const [results] = await connection.execute(query, params);
        return results;
    } catch (error) {
        console.error('Erro na query:', error.message);
        console.error('Query:', query);
        console.error('Params:', params);
        throw error;
    }
}


// Função para fechar conexão com o banco de dados
async function closeConnection() {
    if (pool) {
        await pool.end();
        console.log('Conexão com banco de dados fechada');
    }
}

// Configurar handlers para fechamento do servidor
process.on('SIGINT', async () => {
    console.log('\nRecebido SIGINT, fechando servidor...');
    await closeConnection();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('\nRecebido SIGTERM, fechando servidor...');
    await closeConnection();
    process.exit(0);
});

process.on('beforeExit', async () => {
    console.log('\nEvento beforeExit recebido...');
    await closeConnection();
});

// Exportar funções
module.exports = {
    connectDB,
    getConnection,
    executeQuery,
    closeConnection
};

//