const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Caminho do banco de dados (configurável via variável de ambiente para Railway)
const dataDir = process.env.DATABASE_PATH || __dirname;

// Garantir que o diretório existe
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'users.db');
console.log('📁 Database path:', dbPath);

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('❌ Erro ao conectar ao banco de dados:', err);
    } else {
        console.log('✅ Conectado ao banco de dados SQLite');
    }
});

// Criar tabela de usuários
const createUsersTable = () => {
    const sql = `
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      must_reset_password INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `;

    db.run(sql, (err) => {
        if (err) {
            console.error('❌ Erro ao criar tabela users:', err);
        } else {
            console.log('✅ Tabela users criada/verificada com sucesso');
            // Adicionar coluna enabled_agents se não existir
            addEnabledAgentsColumn();
        }
    });
};

// Adicionar coluna enabled_agents (migração)
const addEnabledAgentsColumn = () => {
    // Verificar se coluna já existe
    db.get("PRAGMA table_info(users)", (err, rows) => {
        if (err) {
            console.error('❌ Erro ao verificar estrutura da tabela:', err);
            return;
        }
    });

    // Tentar adicionar (se já existir, SQLite vai ignorar o erro)
    const alterSql = `ALTER TABLE users ADD COLUMN enabled_agents TEXT DEFAULT '["naming"]'`;

    db.run(alterSql, (err) => {
        if (err) {
            // Ignorar erro se coluna já existir
            if (!err.message.includes('duplicate column')) {
                console.error('⚠️  Erro ao adicionar coluna enabled_agents:', err.message);
            }
        } else {
            console.log('✅ Coluna enabled_agents adicionada com sucesso');
            // Atualizar usuários admin existentes para terem todos os agentes
            updateAdminAgents();
        }
    });
};

// Dar todos os agentes para admins existentes
const updateAdminAgents = () => {
    const allAgents = JSON.stringify(['naming', 'youtube']);
    db.run(
        `UPDATE users SET enabled_agents = ? WHERE role = 'admin' AND (enabled_agents IS NULL OR enabled_agents = '["naming"]')`,
        [allAgents],
        (err) => {
            if (err) {
                console.error('⚠️  Erro ao atualizar agentes dos admins:', err);
            } else {
                console.log('✅ Admins atualizados com todos os agentes');
            }
        }
    );
};

// Inicializar banco de dados
const initDatabase = () => {
    createUsersTable();
};

// Inicializar automaticamente
initDatabase();

module.exports = db;
