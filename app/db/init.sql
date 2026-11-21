CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    email VARCHAR(190) NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role VARCHAR(30) NOT NULL,
    joys INTEGER NOT NULL DEFAULT 0 CHECK (joys >= 0),
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sessions (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash CHAR(64) NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sessions_expiration ON sessions(expires_at);

CREATE TABLE IF NOT EXISTS store_products (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    description TEXT NOT NULL,
    price_joys INTEGER NOT NULL CHECK (price_joys > 0),
    stock_quantity INTEGER NULL CHECK (stock_quantity IS NULL OR stock_quantity >= 0),
    status VARCHAR(20) NOT NULL DEFAULT 'active'
);

CREATE TABLE IF NOT EXISTS activities (
    id BIGSERIAL PRIMARY KEY,
    title VARCHAR(160) NOT NULL,
    description TEXT NOT NULL,
    reward_joys INTEGER NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'active'
);

CREATE TABLE IF NOT EXISTS purchases (
    id BIGSERIAL PRIMARY KEY,
    student_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    product_id BIGINT NOT NULL REFERENCES store_products(id),
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    total_joys INTEGER NOT NULL CHECK (total_joys > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_purchases_student_created ON purchases(student_id, created_at DESC);

CREATE TABLE IF NOT EXISTS student_submissions (
    id BIGSERIAL PRIMARY KEY,
    student_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    activity_id BIGINT NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    content_size_bytes INTEGER NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'submitted',
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (student_id, activity_id)
);

INSERT INTO users (name, email, password_hash, role, joys)
VALUES
    ('Aluno Teste', 'aluno.teste@createjoy.test', crypt('Create123', gen_salt('bf')), 'student', 10000),
    ('Maria Maker', 'maria.maker@createjoy.test', crypt('Create123', gen_salt('bf')), 'student', 7500),
    ('João Player', 'joao.player@createjoy.test', crypt('Create123', gen_salt('bf')), 'student', 5000),
    ('Professor Teste', 'professor.teste@createjoy.test', crypt('Create123', gen_salt('bf')), 'teacher', 0)
ON CONFLICT (email) DO NOTHING;

INSERT INTO store_products (id, name, description, price_joys, stock_quantity)
VALUES
    (1, 'Bala', 'Guloseima para troca na CreateStore.', 1, NULL),
    (2, 'Caixa de bombons', 'Caixa de bombons para troca com Joys.', 300, 25),
    (3, 'Impressão 3D', 'Peça personalizada produzida na escola.', 300, NULL),
    (4, 'Mouse gamer', 'Mouse gamer disponível no catálogo educativo.', 1500, 10),
    (5, 'Teclado gamer', 'Teclado gamer para troca com Joys.', 1500, 8)
ON CONFLICT (id) DO NOTHING;

SELECT setval(pg_get_serial_sequence('store_products', 'id'), GREATEST((SELECT MAX(id) FROM store_products), 1));

INSERT INTO activities (id, title, description, reward_joys)
VALUES
    (1, 'Primeiro circuito', 'Monte um circuito simples com LED e registre o resultado.', 100),
    (2, 'Missão de programação', 'Crie um algoritmo com entrada, processamento e saída.', 150),
    (3, 'Projeto maker', 'Modele e apresente uma solução para um problema da comunidade.', 250)
ON CONFLICT (id) DO NOTHING;

SELECT setval(pg_get_serial_sequence('activities', 'id'), GREATEST((SELECT MAX(id) FROM activities), 1));

