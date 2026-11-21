const loginCard = document.querySelector('#login-card');
const loginForm = document.querySelector('#login-form');
const loginFeedback = document.querySelector('#login-feedback');
const dashboard = document.querySelector('#dashboard');
const dashboardFeedback = document.querySelector('#dashboard-feedback');
const summaryGrid = document.querySelector('#summary-grid');
const productList = document.querySelector('#product-list');
const activityList = document.querySelector('#activity-list');
let accessToken = sessionStorage.getItem('createjoy_test_token') || '';

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...(options.headers || {}),
    },
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Não foi possível concluir a operação.');
  return data;
}

function escapeHtml(value) {
  const element = document.createElement('div');
  element.textContent = String(value ?? '');
  return element.innerHTML;
}

function renderSummary(data) {
  const cards = [
    [data.student.joys, 'Joys disponíveis'],
    [data.summary.activities, 'Atividades'],
    [data.summary.submissions, 'Envios realizados'],
    [data.summary.purchases, 'Compras concluídas'],
  ];
  summaryGrid.innerHTML = cards.map(([value, label]) => (
    `<div class="summary-card"><strong>${value}</strong><span>${label}</span></div>`
  )).join('');
}

function renderProducts(products) {
  productList.innerHTML = products.map((product) => `
    <div class="item-row">
      <div>
        <strong>${escapeHtml(product.name)}</strong>
        <p>${escapeHtml(product.description)}</p>
        <span class="price">J$ ${product.price_joys}</span>
      </div>
      <button type="button" data-buy="${product.id}">Comprar</button>
    </div>
  `).join('');
}

function renderActivities(activities) {
  activityList.innerHTML = activities.map((activity) => `
    <div class="item-row">
      <div>
        <strong>${escapeHtml(activity.title)}</strong>
        <p>${escapeHtml(activity.description)}</p>
        <span class="price">+${activity.reward_joys} Joys</span>
      </div>
      <button type="button" data-submit="${activity.id}">${activity.submission_status ? 'Reenviar' : 'Enviar'}</button>
    </div>
  `).join('');
}

async function loadDashboard() {
  const [dashboardData, productData, activityData] = await Promise.all([
    api('/api/alunos/dashboard'),
    api('/api/loja/produtos'),
    api('/api/atividades'),
  ]);
  document.querySelector('#student-name').textContent = dashboardData.student.name;
  renderSummary(dashboardData);
  renderProducts(productData.products);
  renderActivities(activityData.activities);
  loginCard.classList.add('hidden');
  dashboard.classList.remove('hidden');
}

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  loginFeedback.textContent = 'Entrando...';
  try {
    const result = await api('/api/login', {
      method: 'POST',
      body: JSON.stringify({
        email: document.querySelector('#email').value,
        password: document.querySelector('#password').value,
      }),
    });
    accessToken = result.token;
    sessionStorage.setItem('createjoy_test_token', accessToken);
    loginFeedback.textContent = '';
    await loadDashboard();
  } catch (error) {
    loginFeedback.textContent = error.message;
  }
});

productList.addEventListener('click', async (event) => {
  const button = event.target.closest('[data-buy]');
  if (!button) return;
  button.disabled = true;
  try {
    const result = await api('/api/loja/comprar', {
      method: 'POST',
      body: JSON.stringify({ produto_id: Number(button.dataset.buy), quantidade: 1 }),
    });
    dashboardFeedback.textContent = `Compra concluída. Saldo: ${result.remaining_joys} Joys.`;
    await loadDashboard();
  } catch (error) {
    dashboardFeedback.textContent = error.message;
  } finally {
    button.disabled = false;
  }
});

activityList.addEventListener('click', async (event) => {
  const button = event.target.closest('[data-submit]');
  if (!button) return;
  button.disabled = true;
  try {
    await api('/api/atividades/enviar', {
      method: 'POST',
      body: JSON.stringify({
        atividade_id: Number(button.dataset.submit),
        conteudo: `Envio de demonstração realizado em ${new Date().toISOString()}`,
      }),
    });
    dashboardFeedback.textContent = 'Atividade enviada com sucesso.';
    await loadDashboard();
  } catch (error) {
    dashboardFeedback.textContent = error.message;
  } finally {
    button.disabled = false;
  }
});

document.querySelector('#logout-button').addEventListener('click', () => {
  sessionStorage.removeItem('createjoy_test_token');
  accessToken = '';
  dashboard.classList.add('hidden');
  loginCard.classList.remove('hidden');
});

if (accessToken) {
  loadDashboard().catch(() => {
    sessionStorage.removeItem('createjoy_test_token');
    accessToken = '';
  });
}

