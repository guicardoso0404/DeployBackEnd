-- 🦟👀
-- Criar o banco de dados se não existir e usar 
CREATE DATABASE IF NOT EXISTS networkup_certo;
USE networkup_certo;

-- Habilitar verificação de chaves estrangeiras
SET FOREIGN_KEY_CHECKS = 1;

-- Tabela de usuários (tabela principal)
CREATE TABLE IF NOT EXISTS usuarios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    senha VARCHAR(255) NOT NULL,
    descricao TEXT,
    foto_perfil TEXT,
    data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabela de postagens
CREATE TABLE IF NOT EXISTS postagens (
    id INT AUTO_INCREMENT PRIMARY KEY,
    usuario_id INT NOT NULL,
    conteudo TEXT NOT NULL,
    imagem TEXT,
    curtidas INT DEFAULT 0,
    comentarios INT DEFAULT 0,
    data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabela de comentários
CREATE TABLE IF NOT EXISTS comentarios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    postagem_id INT NOT NULL,
    usuario_id INT NOT NULL,
    conteudo TEXT NOT NULL,
    data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (postagem_id) REFERENCES postagens(id) ON DELETE CASCADE,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabela de curtidas
CREATE TABLE IF NOT EXISTS curtidas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    postagem_id INT NOT NULL,
    usuario_id INT NOT NULL,
    data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_curtida (postagem_id, usuario_id),
    FOREIGN KEY (postagem_id) REFERENCES postagens(id) ON DELETE CASCADE,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Selecionar todos os usuários cadastrados (para visualização)
SELECT id, nome, email, descricao, foto_perfil, data_criacao
FROM usuarios 
ORDER BY data_criacao DESC;

-- Tabela de conversas (chats)
CREATE TABLE IF NOT EXISTS conversas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(100), -- Nome do grupo (se for chat em grupo)
    tipo ENUM('individual', 'grupo') DEFAULT 'individual',
    data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabela de participantes das conversas
CREATE TABLE IF NOT EXISTS participantes_conversa (
    id INT AUTO_INCREMENT PRIMARY KEY,
    conversa_id INT NOT NULL,
    usuario_id INT NOT NULL,
    data_entrada TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status ENUM('ativo', 'saiu', 'banido') DEFAULT 'ativo',
    FOREIGN KEY (conversa_id) REFERENCES conversas(id) ON DELETE CASCADE,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    UNIQUE KEY unique_participante (conversa_id, usuario_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabela de mensagens
CREATE TABLE IF NOT EXISTS mensagens (
    id INT AUTO_INCREMENT PRIMARY KEY,
    conversa_id INT NOT NULL,
    usuario_id INT NOT NULL,
    conteudo TEXT NOT NULL,
    data_envio TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status ENUM('enviada', 'entregue', 'lida', 'excluida') DEFAULT 'enviada',
    FOREIGN KEY (conversa_id) REFERENCES conversas(id) ON DELETE CASCADE,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Mostrar estatísticas básicas
SELECT 
    (SELECT COUNT(*) FROM usuarios) as 'Total de Usuários',
    (SELECT COUNT(*) FROM postagens) as 'Total de Postagens',
    (SELECT COUNT(*) FROM comentarios) as 'Total de Comentários',
    (SELECT COUNT(*) FROM curtidas) as 'Total de Curtidas',
    (SELECT COUNT(*) FROM conversas) as 'Total de Conversas',
    (SELECT COUNT(*) FROM mensagens) as 'Total de Mensagens';

-- Mostrar mensagem de sucesso
SELECT 'Banco de dados NetworkUp configurado com sucesso!' as STATUS;

-- 