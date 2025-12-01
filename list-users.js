// Script temporário para listar usuários
require('dotenv').config();
const mysql = require('mysql2/promise');

async function listUsers() {
    try {
        const connection = await mysql.createConnection({
            host: process.env.MYSQL_HOST,
            user: process.env.MYSQL_USER,
            password: process.env.MYSQL_PASSWORD,
            database: process.env.MYSQL_DATABASE,
            port: process.env.MYSQL_PORT
        });

        const [users] = await connection.execute('SELECT id, nome, email, senha FROM usuarios');
        
        console.log('\n=== USUÁRIOS CADASTRADOS ===\n');
        users.forEach(user => {
            console.log(`ID: ${user.id}`);
            console.log(`Nome: ${user.nome}`);
            console.log(`Email: ${user.email}`);
            console.log(`Senha: ${user.senha}`);
            console.log('----------------------------');
        });
        console.log(`\nTotal: ${users.length} usuários\n`);

        await connection.end();
    } catch (error) {
        console.error('Erro:', error.message);
    }
}

listUsers();
