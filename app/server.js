const crypto = require('crypto');
const path = require('path');
const express = require('express');
const { Pool } = require('pg');
const client = require('prom-client');

const port = Number(process.env.PORT || 8000);
const pool = new Pool({
  host: process.env.DB_HOST || 'db',
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.POSTGRES_DB || 'educacional_test',
  user: process.env.POSTGRES_USER || 'educacional',
  password: process.env.POSTGRES_PASSWORD || 'educacional123',
  max: 20,
});

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '6mb' }));

const registry = new client.Registry();
client.collectDefaultMetrics({ register: registry, prefix: 'createjoy_' });

const requestDuration = new client.Histogram({
  name: 'createjoy_http_request_duration_seconds',
  help: 'Duração das requisições HTTP da aplicação.',
  labelNames: ['method', 'route', 'status'],
  buckets: [0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  registers: [registry],
});

const purchaseCounter = new client.Counter({
  name: 'createjoy_store_purchases_total',
  help: 'Quantidade de compras concluídas no ambiente de teste.',
  registers: [registry],
});

const submissionCounter = new client.Counter({
  name: 'createjoy_activity_submissions_total',
  help: 'Quantidade de atividades enviadas no ambiente de teste.',
  labelNames: ['size'],
  registers: [registry],
});

app.use((request, response, next) => {
  const end = requestDuration.startTimer();
  response.on('finish', () => {
    end({
      method: request.method,
      route: request.route?.path || request.path,
      status: String(response.statusCode),
    });
  });
  next();
});

function tokenHash(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function contentSizeLabel(size) {
  if (size >= 1024 * 1024) return 'grande';
  if (size >= 50 * 1024) return 'medio';
  return 'pequeno';
}

async function requireStudent(request, response, next) {
  try {
    const authorization = request.get('authorization') || '';
    const token = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
    if (!token) {
      return response.status(401).json({ ok: false, message: 'Token de acesso obrigatório.' });
    }

    const result = await pool.query(
      `SELECT users.id, users.name, users.email, users.role, users.joys
       FROM sessions
       JOIN users ON users.id = sessions.user_id
       WHERE sessions.token_hash = $1 AND sessions.expires_at > NOW()
       LIMIT 1`,
      [tokenHash(token)],
    );

    if (result.rowCount !== 1 || result.rows[0].role !== 'student') {
      return response.status(401).json({ ok: false, message: 'Sessão inválida ou expirada.' });
    }

    request.student = result.rows[0];
    next();
  } catch (error) {
    next(error);
  }
}

app.get('/health', async (_request, response, next) => {
  try {
    await pool.query('SELECT 1');
    response.json({ ok: true, service: 'createjoy-app', database: 'connected' });
  } catch (error) {
    next(error);
  }
});

app.get('/metrics', async (_request, response, next) => {
  try {
    response.set('Content-Type', registry.contentType);
    response.end(await registry.metrics());
  } catch (error) {
    next(error);
  }
});

app.post('/api/login', async (request, response, next) => {
  try {
    const email = String(request.body.email || '').trim().toLowerCase();
    const password = String(request.body.password || '');
    if (!email || !password) {
      return response.status(422).json({ ok: false, message: 'E-mail e senha são obrigatórios.' });
    }

    const account = await pool.query(
      `SELECT id, name, email, role, joys
       FROM users
       WHERE email = $1 AND password_hash = crypt($2, password_hash) AND status = 'active'
       LIMIT 1`,
      [email, password],
    );

    if (account.rowCount !== 1) {
      return response.status(401).json({ ok: false, message: 'Credenciais inválidas.' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    await pool.query(
      `INSERT INTO sessions (user_id, token_hash, expires_at)
       VALUES ($1, $2, NOW() + INTERVAL '12 hours')`,
      [account.rows[0].id, tokenHash(token)],
    );

    response.json({ ok: true, token, user: account.rows[0] });
  } catch (error) {
    next(error);
  }
});

app.get('/api/alunos/dashboard', requireStudent, async (request, response, next) => {
  try {
    const [activities, submissions, purchases] = await Promise.all([
      pool.query("SELECT COUNT(*)::int AS total FROM activities WHERE status = 'active'"),
      pool.query('SELECT COUNT(*)::int AS total FROM student_submissions WHERE student_id = $1', [request.student.id]),
      pool.query('SELECT COUNT(*)::int AS total FROM purchases WHERE student_id = $1', [request.student.id]),
    ]);

    response.json({
      ok: true,
      student: request.student,
      summary: {
        activities: activities.rows[0].total,
        submissions: submissions.rows[0].total,
        purchases: purchases.rows[0].total,
      },
    });
  } catch (error) {
    next(error);
  }
});

app.get('/api/loja/produtos', requireStudent, async (_request, response, next) => {
  try {
    const result = await pool.query(
      `SELECT id, name, description, price_joys, stock_quantity
       FROM store_products
       WHERE status = 'active'
       ORDER BY id`,
    );
    response.json({ ok: true, products: result.rows });
  } catch (error) {
    next(error);
  }
});

app.get('/api/atividades', requireStudent, async (request, response, next) => {
  try {
    const result = await pool.query(
      `SELECT activities.id, activities.title, activities.description, activities.reward_joys,
              student_submissions.status AS submission_status,
              student_submissions.submitted_at
       FROM activities
       LEFT JOIN student_submissions
         ON student_submissions.activity_id = activities.id
        AND student_submissions.student_id = $1
       WHERE activities.status = 'active'
       ORDER BY activities.id`,
      [request.student.id],
    );
    response.json({ ok: true, activities: result.rows });
  } catch (error) {
    next(error);
  }
});

app.post('/api/loja/comprar', requireStudent, async (request, response, next) => {
  const productId = Number(request.body.product_id ?? request.body.produto_id);
  const quantity = Number(request.body.quantity ?? request.body.quantidade ?? 1);
  if (!Number.isInteger(productId) || productId < 1 || !Number.isInteger(quantity) || quantity < 1 || quantity > 10) {
    return response.status(422).json({ ok: false, message: 'Produto ou quantidade inválida.' });
  }

  const connection = await pool.connect();
  try {
    await connection.query('BEGIN');
    const account = await connection.query('SELECT joys FROM users WHERE id = $1 FOR UPDATE', [request.student.id]);
    const product = await connection.query(
      `SELECT id, name, price_joys, stock_quantity
       FROM store_products
       WHERE id = $1 AND status = 'active'
       FOR UPDATE`,
      [productId],
    );

    if (product.rowCount !== 1) {
      await connection.query('ROLLBACK');
      return response.status(404).json({ ok: false, message: 'Produto não encontrado.' });
    }

    const item = product.rows[0];
    const total = item.price_joys * quantity;
    if (account.rows[0].joys < total) {
      await connection.query('ROLLBACK');
      return response.status(409).json({ ok: false, message: 'Saldo de Joys insuficiente.' });
    }
    if (item.stock_quantity !== null && item.stock_quantity < quantity) {
      await connection.query('ROLLBACK');
      return response.status(409).json({ ok: false, message: 'Estoque insuficiente.' });
    }

    const updatedAccount = await connection.query(
      'UPDATE users SET joys = joys - $1 WHERE id = $2 RETURNING joys',
      [total, request.student.id],
    );
    if (item.stock_quantity !== null) {
      await connection.query('UPDATE store_products SET stock_quantity = stock_quantity - $1 WHERE id = $2', [quantity, productId]);
    }
    const purchase = await connection.query(
      `INSERT INTO purchases (student_id, product_id, quantity, total_joys)
       VALUES ($1, $2, $3, $4)
       RETURNING id, created_at`,
      [request.student.id, productId, quantity, total],
    );
    await connection.query('COMMIT');
    purchaseCounter.inc();

    response.status(201).json({
      ok: true,
      purchase: purchase.rows[0],
      product: item.name,
      total_joys: total,
      remaining_joys: updatedAccount.rows[0].joys,
    });
  } catch (error) {
    await connection.query('ROLLBACK');
    next(error);
  } finally {
    connection.release();
  }
});

app.post('/api/atividades/enviar', requireStudent, async (request, response, next) => {
  try {
    const activityId = Number(request.body.activity_id ?? request.body.atividade_id);
    const content = String(request.body.content ?? request.body.conteudo ?? '');
    if (!Number.isInteger(activityId) || activityId < 1 || !content) {
      return response.status(422).json({ ok: false, message: 'Atividade e conteúdo são obrigatórios.' });
    }

    const activity = await pool.query("SELECT id FROM activities WHERE id = $1 AND status = 'active'", [activityId]);
    if (activity.rowCount !== 1) {
      return response.status(404).json({ ok: false, message: 'Atividade não encontrada.' });
    }

    const sizeBytes = Buffer.byteLength(content, 'utf8');
    const result = await pool.query(
      `INSERT INTO student_submissions (student_id, activity_id, content, content_size_bytes, status, submitted_at)
       VALUES ($1, $2, $3, $4, 'submitted', NOW())
       ON CONFLICT (student_id, activity_id)
       DO UPDATE SET content = EXCLUDED.content,
                     content_size_bytes = EXCLUDED.content_size_bytes,
                     status = 'submitted',
                     submitted_at = NOW()
       RETURNING id, status, content_size_bytes, submitted_at`,
      [request.student.id, activityId, content, sizeBytes],
    );
    submissionCounter.inc({ size: contentSizeLabel(sizeBytes) });
    response.status(201).json({ ok: true, submission: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

app.use(express.static(path.join(__dirname, 'public')));

app.use((error, _request, response, _next) => {
  console.error(error);
  response.status(500).json({ ok: false, message: 'Erro interno no ambiente de teste.' });
});

app.listen(port, '0.0.0.0', () => {
  console.log(`CreateJoy disponível na porta ${port}`);
});

