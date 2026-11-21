// Core app: state, router, login, sidebar, header
(function () {
  'use strict';

  var I = window.Icons;
var D = window.CreateJoyData;
  var Api = window.CreateJoyApi;

  // ===== State =====
  var state = {
    role: null,
    activePage: 'dashboard',
    collapsed: false,
    loading: true,
  };

  var users = {
    student: { name: 'Aluno', initials: 'AL', email: '' },
    teacher: { name: 'Professor', initials: 'PR', email: '' },
    supervisor: { name: 'Supervisão', initials: 'SU', email: '' },
    admin: { name: 'Admin Geral', initials: 'AG', email: 'admin@createjoy.com' },
    finance: { name: 'Financeiro', initials: 'FI', email: '' },
    administrative: { name: 'Gestão Administrativa', initials: 'GA', email: '' },
  };

  var defaultPages = { student: 'dashboard', teacher: 'dashboard', supervisor: 'dashboard', admin: 'dashboard', finance: 'dashboard', administrative: 'reenrollment' };

  var roleLabels = { student: 'Aluno', teacher: 'Professor', supervisor: 'Supervisão', admin: 'Admin Geral', finance: 'Financeiro', administrative: 'Gestão Administrativa' };
  var roleColors = { student: 'var(--blue-primary)', teacher: 'var(--orange)', supervisor: 'var(--gray-700)', admin: 'var(--gray-700)', finance: '#0F766E', administrative: '#7C3AED' };

  var navItems = {
    student: [
      { key: 'dashboard', label: 'Dashboard', icon: 'layoutDashboard' },
      { key: 'timeline', label: 'Minha Jornada', icon: 'gitBranch' },
      { key: 'mission', label: 'Missão Atual', icon: 'rocket' },
      { key: 'lab', label: 'Meu Laboratório', icon: 'flaskConical' },
      { key: 'files', label: 'Meus Arquivos', icon: 'folderOpen' },
      { key: 'store', label: 'CreateStore', icon: 'shoppingBag' },
      { key: 'investments', label: 'Carteira de Investimentos', icon: 'coins' },
      { key: 'profile', label: 'Meu Perfil', icon: 'user' },
    ],
    teacher: [
      { key: 'dashboard', label: 'Painel', icon: 'layoutDashboard' },
      { key: 'classes', label: 'Minhas Turmas', icon: 'users' },
      { key: 'missions', label: 'Missões', icon: 'target' },
      { key: 'submissions', label: 'Entregas', icon: 'checkSquare' },
      { key: 'students', label: 'Alunos', icon: 'userCheck' },
      { key: 'achievements', label: 'Medalhas', icon: 'award' },
      { key: 'feedback', label: 'Feedback', icon: 'messageSquare' },
      { key: 'profile', label: 'Meu Perfil', icon: 'user' },
    ],
    admin: [
      { key: 'dashboard', label: 'Dashboard', icon: 'layoutDashboard' },
      { key: 'curriculum', label: 'Currículo', icon: 'bookOpen' },
      { key: 'missions', label: 'Missões', icon: 'target' },
      { key: 'activities', label: 'Atividades', icon: 'activity' },
      { key: 'teachers', label: 'Funcionários', icon: 'graduationCap' },
      { key: 'students', label: 'Alunos', icon: 'users' },
      { key: 'course-progress', label: 'Acompanhamento', icon: 'target' },
      { key: 'submissions', label: 'Entregas', icon: 'checkSquare' },
      { key: 'achievements', label: 'Medalhas', icon: 'award' },
      { key: 'classes', label: 'Turmas', icon: 'school' },
      { key: 'store-products', label: 'Produtos da Loja', icon: 'box' },
      { key: 'store-requests', label: 'Solicitações da Loja', icon: 'shoppingBag' },
      { key: 'reenrollment', label: 'Rematrícula', icon: 'calendar' },
      { key: 'administration', label: 'Administração', icon: 'clipboardList' },
      { key: 'permissions', label: 'Permissões', icon: 'shieldCheck' },
      { key: 'reports', label: 'Relatórios', icon: 'fileBarChart' },
      { key: 'profile', label: 'Meu Perfil', icon: 'user' },
    ],
    finance: [
      { key: 'dashboard', label: 'Painel Financeiro', icon: 'layoutDashboard' },
      { key: 'profile', label: 'Meu Perfil', icon: 'user' },
    ],
    administrative: [
      { key: 'reenrollment', label: 'Rematrícula', icon: 'calendar' },
      { key: 'teachers', label: 'Funcionários', icon: 'graduationCap' },
      { key: 'students', label: 'Alunos', icon: 'users' },
      { key: 'administration', label: 'Administração', icon: 'clipboardList' },
      { key: 'permissions', label: 'Permissões', icon: 'shieldCheck' },
      { key: 'profile', label: 'Meu Perfil', icon: 'user' },
    ],
  };
  navItems.supervisor = navItems.admin;

  var pageTitles = {
    student: {
      dashboard: { title: 'Dashboard', sub: 'Acompanhe seu progresso' },
      timeline: { title: 'Minha Jornada', sub: 'Linha do tempo das suas missões' },
      mission: { title: 'Missão Atual', sub: 'Detalhes e envio da atividade' },
      lab: { title: 'Meu Laboratório', sub: 'Equipamentos e anotações' },
      files: { title: 'Meus Arquivos', sub: 'Códigos, STLs e documentos enviados' },
      store: { title: 'CreateStore', sub: 'Troque seus Joys por experiências e criações' },
      investments: { title: 'Carteira de Investimentos', sub: 'Aprenda a investir seus Joys com responsabilidade' },
      profile: { title: 'Meu Perfil', sub: 'Informações e conquistas' },
    },
    teacher: {
      dashboard: { title: 'Painel do Professor', sub: 'Visão geral das suas turmas' },
      classes: { title: 'Minhas Turmas', sub: 'Gerencie turmas e alunos' },
      missions: { title: 'Missões dos Cursos', sub: 'Veja as missões e acompanhe cada aluno' },
      submissions: { title: 'Entregas', sub: 'Missões enviadas pelos alunos' },
      students: { title: 'Meus Alunos', sub: 'Selecione um aluno para acompanhar' },
      'student-detail': { title: 'Perfil do Aluno', sub: 'Detalhes e histórico' },
      achievements: { title: 'Medalhas e Conquistas', sub: 'Reconheça o progresso dos seus alunos' },
      feedback: { title: 'Feedback', sub: 'Comentários e avaliações' },
      profile: { title: 'Meu Perfil', sub: 'Edite seus dados e sua senha' },
    },
    admin: {
      dashboard: { title: 'Dashboard Geral', sub: 'Visão completa da plataforma' },
      curriculum: { title: 'Estrutura Curricular', sub: 'Módulos e níveis de ensino' },
      missions: { title: 'Missões', sub: 'Criar e gerenciar missões' },
      activities: { title: 'Atividades', sub: 'Exercícios e desafios' },
      teachers: { title: 'Funcionários', sub: 'Professores e supervisores' },
      students: { title: 'Alunos', sub: 'Gerenciar base de alunos' },
      'student-detail': { title: 'Perfil do Aluno', sub: 'Acompanhamento, entregas e movimentação de Joys' },
      'course-progress': { title: 'Acompanhamento Pedagógico', sub: 'Missões e progresso por turma' },
      submissions: { title: 'Entregas', sub: 'Verifique e corrija as atividades dos alunos' },
      achievements: { title: 'Medalhas e Conquistas', sub: 'Catálogo, regras e concessões aos alunos' },
      classes: { title: 'Turmas', sub: 'Organização de turmas' },
      'store-requests': { title: 'Solicitações da Loja', sub: 'Aprove compras e desconte Joys com segurança' },
      'store-products': { title: 'Produtos da CreateStore', sub: 'Valores, imagens, disponibilidade e estoque' },
      reenrollment: { title: 'Rematrícula', sub: 'Contratos, pagamentos, follow-ups e lembretes' },
      administration: { title: 'Centro Administrativo', sub: 'Semestres, conquistas, laboratório e registros' },
      permissions: { title: 'Permissões', sub: 'Controle de acesso por perfil' },
      reports: { title: 'Relatórios', sub: 'Análises e dados da plataforma' },
      profile: { title: 'Meu Perfil', sub: 'Edite seus dados, sua foto e sua senha' },
    },
  };
  pageTitles.supervisor = pageTitles.admin;
  pageTitles.finance = {
    dashboard: { title: 'Painel Financeiro', sub: 'Carnês, boletos, taxas e visão financeira das rematrículas' },
    profile: { title: 'Meu Perfil', sub: 'Edite seus dados, sua foto e sua senha' },
  };
  pageTitles.administrative = {
    reenrollment: { title: 'Rematrícula', sub: 'Contratos, pagamentos, follow-ups e lembretes' },
    teachers: { title: 'Funcionários', sub: 'Professores e perfis de gestão' },
    students: { title: 'Alunos', sub: 'Gerenciar base de alunos' },
    administration: { title: 'Centro Administrativo', sub: 'Semestres, conquistas, laboratório e registros' },
    permissions: { title: 'Permissões', sub: 'Controle de acesso por perfil' },
    profile: { title: 'Meu Perfil', sub: 'Edite seus dados, sua foto e sua senha' },
  };

  // ===== Router =====
  function navigate(page) {
    state.activePage = page;
    window.scrollTo(0, 0);
    render();
  }

  function sanitizeValue(value) {
    if (typeof value === 'string') {
      return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    }
    if (Array.isArray(value)) return value.map(sanitizeValue);
    if (value && typeof value === 'object') {
      var result = {};
      Object.keys(value).forEach(function (key) { result[key] = sanitizeValue(value[key]); });
      return result;
    }
    return value;
  }

  function updateData(source) {
    var data = source || {};
    Object.keys(D).forEach(function (key) {
      if (Object.prototype.hasOwnProperty.call(data, key)) D[key] = data[key];
    });
    Object.keys(data).forEach(function (key) {
      D[key] = data[key];
    });
    if (D.currentStudent && D.investmentWallet && Number.isFinite(Number(D.investmentWallet.walletBalance))) {
      D.currentStudent.joys = Number(D.investmentWallet.walletBalance);
    }
    if (state.role && D.currentProfile) users[state.role] = D.currentProfile;
    if (state.role === 'student' && D.currentStudent) users.student = Object.assign({}, users.student, D.currentStudent);
    if (state.role === 'teacher' && D.currentTeacher) users.teacher = Object.assign({}, users.teacher, D.currentTeacher);
  }

  function hydrate(payload) {
    updateData(payload.data);
    var user = payload.user;
    if (user) {
      users[user.role] = user;
      if (D.currentProfile) users[user.role] = Object.assign({}, users[user.role], D.currentProfile);
      if (user.role === 'student' && D.currentStudent) users.student = Object.assign({}, users.student, D.currentStudent);
      if (user.role === 'teacher' && D.currentTeacher) users.teacher = Object.assign({}, users.teacher, D.currentTeacher);
    }
  }

  async function login(role, email, password) {
    var payload = await Api.login(email, password, role);
    hydrate(payload);
    state.role = payload.user.role;
    state.activePage = defaultPages[state.role] || 'dashboard';
    render();
  }

  async function logout() {
    try {
      await Api.logout();
    } catch (error) {
      // A sessão local deve ser encerrada mesmo se o servidor já a expirou.
    }
    state.role = null;
    state.activePage = 'dashboard';
    render();
  }

  function toggleSidebar() {
    state.collapsed = !state.collapsed;
    render();
  }

  function showPendingAchievementPopup() {
    if (state.role !== 'student' || !D.currentStudent || document.querySelector('.achievement-popup-backdrop')) return;
    var studentId = Number(D.currentStudent.id || 0);
    if (!studentId) return;
    var storageKey = 'createjoy:seen-achievements:' + studentId;
    var seen = [];
    try { seen = JSON.parse(window.localStorage.getItem(storageKey) || '[]'); } catch (error) { seen = []; }
    if (!Array.isArray(seen)) seen = [];
    seen = seen.map(Number);
    var medal = (D.medals || []).filter(function (item) {
      return item.conquistada && seen.indexOf(Number(item.id)) === -1;
    })[0];
    if (!medal) return;
    medal = sanitizeValue(medal);

    var backdrop = document.createElement('div');
    backdrop.className = 'achievement-popup-backdrop';
    backdrop.innerHTML = '<section class="achievement-popup" role="dialog" aria-modal="true" aria-labelledby="achievement-popup-title"><div class="achievement-confetti" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i></div><span class="achievement-popup-kicker">NOVA CONQUISTA!</span><div class="achievement-popup-medal">' + (medal.imagemUrl ? '<img src="' + medal.imagemUrl + '" alt="" />' : '<span>' + medal.icone + '</span>') + '</div><p class="achievement-popup-category">' + medal.categoria + '</p><h2 id="achievement-popup-title">' + medal.nome + '</h2><p class="achievement-popup-description">' + medal.descricao + '</p>' + (medal.joys ? '<div class="achievement-popup-reward">+' + medal.joys + ' Joys</div>' : '') + '<button class="btn btn-accent btn-lg" id="achievement-popup-close">Que alegria! Continuar</button></section>';
    document.body.appendChild(backdrop);

    function closePopup() {
      var medalId = Number(medal.id);
      if (seen.indexOf(medalId) === -1) seen.push(medalId);
      try { window.localStorage.setItem(storageKey, JSON.stringify(seen)); } catch (error) { /* armazenamento pode estar bloqueado */ }
      backdrop.remove();
      window.setTimeout(showPendingAchievementPopup, 180);
    }
    backdrop.querySelector('#achievement-popup-close').addEventListener('click', closePopup);
  }

  // ===== Icon helper for pages =====
  function icon(name, size) {
    return I.render(name, size);
  }

  function dialogMessage(message) {
    return sanitizeValue(String(message || '')).replace(/\n/g, '<br>');
  }

  function openSystemDialog(options) {
    var settings = typeof options === 'string' ? { message: options } : (options || {});
    return new Promise(function (resolve) {
      var isConfirm = settings.kind === 'confirm';
      var tone = settings.tone || (isConfirm ? 'warning' : 'info');
      var toneIcons = { info: 'bell', success: 'checkCircle', warning: 'alertTriangle', error: 'alertTriangle' };
      var backdrop = document.createElement('div');
      backdrop.className = 'system-dialog-backdrop';
      backdrop.innerHTML =
        '<section class="system-dialog system-dialog-' + tone + '" role="dialog" aria-modal="true" aria-labelledby="system-dialog-title">' +
        '<div class="system-dialog-icon">' + icon(toneIcons[tone] || 'bell', 26) + '</div>' +
        '<div class="system-dialog-copy"><span>' + (isConfirm ? 'CONFIRME A AÇÃO' : tone === 'error' ? 'ATENÇÃO' : 'CREATEJOY') + '</span><h2 id="system-dialog-title">' + sanitizeValue(settings.title || (isConfirm ? 'Você deseja continuar?' : tone === 'error' ? 'Não foi possível concluir' : 'Tudo certo!')) + '</h2><p>' + dialogMessage(settings.message) + '</p></div>' +
        '<div class="system-dialog-actions">' +
        (isConfirm ? '<button type="button" class="btn btn-ghost" data-dialog-result="cancel">' + sanitizeValue(settings.cancelLabel || 'Cancelar') + '</button>' : '') +
        '<button type="button" class="btn ' + (tone === 'error' || tone === 'warning' ? 'btn-accent' : 'btn-primary') + '" data-dialog-result="confirm">' + sanitizeValue(settings.confirmLabel || (isConfirm ? 'Confirmar' : 'Entendi')) + '</button>' +
        '</div></section>';
      document.body.appendChild(backdrop);
      var previousOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';

      function finish(result) {
        document.removeEventListener('keydown', onKeyDown);
        document.body.style.overflow = previousOverflow;
        backdrop.remove();
        resolve(result);
      }
      function onKeyDown(event) {
        if (event.key === 'Escape') finish(false);
      }
      document.addEventListener('keydown', onKeyDown);
      backdrop.querySelectorAll('[data-dialog-result]').forEach(function (button) {
        button.addEventListener('click', function () { finish(button.getAttribute('data-dialog-result') === 'confirm'); });
      });
      backdrop.addEventListener('click', function (event) {
        if (event.target === backdrop) finish(false);
      });
      setTimeout(function () { backdrop.querySelector('[data-dialog-result="confirm"]').focus(); }, 0);
    });
  }

  function showToast(message, tone) {
    var container = document.getElementById('system-toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'system-toast-container';
      container.className = 'system-toast-container';
      document.body.appendChild(container);
    }
    var toast = document.createElement('div');
    var selectedTone = tone || 'success';
    toast.className = 'system-toast system-toast-' + selectedTone;
    toast.innerHTML = '<span>' + icon(selectedTone === 'error' ? 'alertTriangle' : 'checkCircle', 18) + '</span><p>' + dialogMessage(message) + '</p><button type="button" aria-label="Fechar">' + icon('x', 14) + '</button>';
    container.appendChild(toast);
    function closeToast() { toast.classList.add('leaving'); setTimeout(function () { toast.remove(); }, 180); }
    toast.querySelector('button').addEventListener('click', closeToast);
    setTimeout(closeToast, selectedTone === 'error' ? 6500 : 4200);
  }

  window.CreateJoyUI = {
    alert: function (message, tone, title) { return openSystemDialog({ message: message, tone: tone || 'info', title: title }); },
    confirm: function (options) { return openSystemDialog(Object.assign({}, options || {}, { kind: 'confirm' })); },
    toast: showToast,
    bindPagedList: function (options) {
      var items = Array.prototype.slice.call(document.querySelectorAll(options.itemSelector));
      var pager = document.getElementById(options.pagerId);
      if (!pager) return { refresh: function () {} };
      var page = Math.max(1, Number(options.initialPage || 1));
      var perPage = Number(options.perPage || 12);
      var info = pager.querySelector('[data-page-info]');
      var previous = pager.querySelector('[data-page-prev]');
      var next = pager.querySelector('[data-page-next]');
      var empty = options.emptyId ? document.getElementById(options.emptyId) : null;
      function refresh(reset) {
        if (reset) page = 1;
        var visible = items.filter(function (item) { return !options.matches || options.matches(item); });
        var totalPages = Math.max(1, Math.ceil(visible.length / perPage));
        page = Math.min(page, totalPages);
        items.forEach(function (item) { item.style.display = 'none'; });
        visible.slice((page - 1) * perPage, page * perPage).forEach(function (item) { item.style.display = options.display || ''; });
        if (info) info.textContent = visible.length ? 'Página ' + page + ' de ' + totalPages + ' · ' + visible.length + ' registro' + (visible.length === 1 ? '' : 's') : 'Nenhum registro';
        if (previous) previous.disabled = page <= 1;
        if (next) next.disabled = page >= totalPages;
        if (empty) empty.style.display = visible.length ? 'none' : 'block';
        pager.style.display = visible.length > perPage ? 'flex' : (visible.length ? 'flex' : 'none');
        if (typeof options.onPageChange === 'function') options.onPageChange(page, totalPages, visible.length);
      }
      if (previous) previous.addEventListener('click', function () { if (page > 1) { page -= 1; refresh(false); } });
      if (next) next.addEventListener('click', function () { page += 1; refresh(false); });
      refresh(false);
      return { refresh: refresh, getPage: function () { return page; } };
    },
  };
  window.alert = function (message) {
    var normalized = String(message || '').toLowerCase();
    var tone = /erro|falha|não foi possível|inválid|incorret|não corresponde|não encontrad/.test(normalized)
      ? 'error'
      : /sucesso|enviad|salv|aprova|alterad/.test(normalized) ? 'success' : 'info';
    window.CreateJoyUI.alert(message, tone);
  };

  function notificationStorageKey() {
    var user = users[state.role] || {};
    return 'createjoy:seen-notifications:' + state.role + ':' + Number(user.id || 0);
  }

  function seenNotifications() {
    try {
      var stored = JSON.parse(window.localStorage.getItem(notificationStorageKey()) || '[]');
      return Array.isArray(stored) ? stored.map(String) : [];
    } catch (error) {
      return [];
    }
  }

  function saveSeenNotifications(keys) {
    try { window.localStorage.setItem(notificationStorageKey(), JSON.stringify(keys.slice(-1000))); } catch (error) { /* armazenamento pode estar bloqueado */ }
  }

  function buildNotifications() {
    var items = [];
    var role = state.role;
    if (role === 'finance') {
      (((D.reenrollment || {}).contracts) || []).forEach(function (contract) {
        (contract.reminders || []).filter(function (reminder) {
          return reminder.status === 'pending'
            && (reminder.type === 'issue_boleto' || reminder.type === 'issue_enrollment_fee');
        }).forEach(function (reminder) {
          items.push({
            key: 'financial-reminder:' + reminder.id + ':' + reminder.dueAt,
            title: reminder.title,
            text: contract.studentName,
            meta: reminder.dueAt,
            page: 'dashboard',
            icon: reminder.isOverdue ? 'alertTriangle' : 'fileText',
          });
        });
      });
    } else if (role === 'administrative') {
      ((D.reenrollment && D.reenrollment.notifications) || []).forEach(function (notification) {
        items.push(notification);
      });
    } else if (role === 'teacher' || role === 'admin' || role === 'supervisor') {
      if (role === 'admin' || role === 'supervisor') {
        ((D.reenrollment && D.reenrollment.notifications) || []).forEach(function (notification) {
          items.push(notification);
        });
      }
      (D.submissions || []).filter(function (submission) {
        return submission.status === 'pendente' || submission.status === 'refazer';
      }).forEach(function (submission) {
        items.push({
          key: 'submission:' + submission.id + ':' + submission.status,
          title: submission.status === 'refazer' ? 'Nova tentativa aguardada' : 'Entrega para avaliar',
          text: submission.aluno + ' · ' + submission.missao,
          meta: submission.enviadoEm,
          page: 'submissions',
          icon: submission.status === 'refazer' ? 'alertTriangle' : 'clipboardList',
        });
      });
      if (role === 'admin' || role === 'supervisor') {
        (D.storeRequests || []).filter(function (request) { return request.status === 'pending'; }).forEach(function (request) {
          items.push({ key: 'store:' + request.id + ':pending', title: 'Solicitação da CreateStore', text: request.studentName + ' · ' + request.productName, meta: request.requestedAt || '', page: 'store-requests', icon: 'shoppingBag' });
        });
      }
    } else if (role === 'student') {
      (D.submissions || []).filter(function (submission) { return submission.status === 'aprovado' || submission.status === 'refazer'; }).forEach(function (submission) {
        items.push({ key: 'submission:' + submission.id + ':' + submission.status, title: submission.status === 'aprovado' ? 'Missão aprovada!' : 'Professor solicitou correção', text: submission.missao, meta: submission.feedback || submission.enviadoEm, page: 'mission', missionId: submission.missaoId, icon: submission.status === 'aprovado' ? 'checkCircle' : 'alertTriangle' });
      });
      (D.storeRequests || []).filter(function (request) { return request.status === 'approved' || request.status === 'rejected'; }).forEach(function (request) {
        items.push({ key: 'store:' + request.id + ':' + request.status, title: request.status === 'approved' ? 'Pedido aprovado' : 'Pedido não aprovado', text: request.productName, meta: request.reviewNotes || '', page: 'store', icon: 'shoppingBag' });
      });
      (D.medals || []).filter(function (medal) { return medal.conquistada; }).forEach(function (medal) {
        items.push({ key: 'medal:' + medal.id, title: 'Conquista desbloqueada', text: medal.nome, meta: medal.conquistadaEm || '', page: 'profile', icon: 'award' });
      });
    }
    return items;
  }

  function showSystemReminders(attempt) {
    if (!state.role || document.querySelector('.achievement-popup-backdrop, .system-dialog-backdrop, .admin-modal-backdrop')) {
      if ((attempt || 0) < 4) window.setTimeout(function () { showSystemReminders((attempt || 0) + 1); }, 700);
      return;
    }
    var user = users[state.role] || {};
    if (state.role === 'student') {
      var approved = (D.storeRequests || []).filter(function (request) { return request.status === 'approved'; });
      var key = 'createjoy:seen-approved-purchases:' + Number(user.id || 0);
      var seen = [];
      try { seen = JSON.parse(window.localStorage.getItem(key) || '[]'); } catch (error) { seen = []; }
      if (!Array.isArray(seen)) seen = [];
      var purchase = approved.filter(function (request) { return seen.indexOf(Number(request.id)) === -1; })[0];
      if (purchase) {
        seen.push(Number(purchase.id));
        try { window.localStorage.setItem(key, JSON.stringify(seen.slice(-100))); } catch (error) { /* armazenamento pode estar bloqueado */ }
        window.CreateJoyUI.alert('Sua solicitação de “' + purchase.productName + '” foi aceita. O valor de ' + purchase.totalJoys + ' Joys foi retirado da sua carteira.', 'success', 'Compra aprovada!');
      }
      return;
    }
    if (state.role === 'finance') {
      var financialTasks = (((D.reenrollment || {}).contracts) || []).reduce(function (total, contract) {
        return total + (contract.reminders || []).filter(function (reminder) {
          return reminder.status === 'pending'
            && (reminder.type === 'issue_boleto' || reminder.type === 'issue_enrollment_fee');
        }).length;
      }, 0);
      if (!financialTasks) return;
      var financeReminderKey = 'createjoy:finance-reminder:' + Number(user.id || 0) + ':' + new Date().toISOString().slice(0, 10);
      try { if (window.sessionStorage.getItem(financeReminderKey)) return; window.sessionStorage.setItem(financeReminderKey, '1'); } catch (error) { /* segue sem persistência */ }
      window.CreateJoyUI.alert('Você tem ' + financialTasks + ' tarefa' + (financialTasks === 1 ? '' : 's') + ' de carnê, boleto ou taxa de matrícula para verificar.', 'info', 'Tarefas financeiras');
      return;
    }
    if (state.role === 'administrative') {
      var administrativeReminders = ((D.reenrollment && D.reenrollment.notifications) || []).length;
      if (!administrativeReminders) return;
      var administrativeReminderKey = 'createjoy:administrative-reminder:' + Number(user.id || 0) + ':' + new Date().toISOString().slice(0, 10);
      try { if (window.sessionStorage.getItem(administrativeReminderKey)) return; window.sessionStorage.setItem(administrativeReminderKey, '1'); } catch (error) { /* segue sem persistência */ }
      window.CreateJoyUI.alert('Você tem ' + administrativeReminders + ' aviso' + (administrativeReminders === 1 ? '' : 's') + ' de rematrícula para acompanhar.', 'info', 'Lembretes de rematrícula');
      return;
    }
    if (state.role === 'teacher' || state.role === 'admin' || state.role === 'supervisor') {
      var pendingSubmissions = (D.submissions || []).filter(function (item) { return item.status === 'pendente' || item.status === 'refazer'; }).length;
      var pendingStore = (state.role === 'admin' || state.role === 'supervisor')
        ? (D.storeRequests || []).filter(function (item) { return item.status === 'pending'; }).length : 0;
      var pendingReenrollment = (state.role === 'admin' || state.role === 'supervisor')
        ? (((D.reenrollment && D.reenrollment.notifications) || []).length) : 0;
      if (!pendingSubmissions && !pendingStore && !pendingReenrollment) return;
      var reminderKey = 'createjoy:work-reminder:' + Number(user.id || 0) + ':' + new Date().toISOString().slice(0, 10);
      try { if (window.sessionStorage.getItem(reminderKey)) return; window.sessionStorage.setItem(reminderKey, '1'); } catch (error) { /* segue sem persistência */ }
      var parts = [];
      if (pendingSubmissions) parts.push(pendingSubmissions + ' entrega' + (pendingSubmissions === 1 ? '' : 's') + ' para verificar');
      if (pendingStore) parts.push(pendingStore + ' solicitação' + (pendingStore === 1 ? '' : 'ões') + ' da CreateStore');
      if (pendingReenrollment) parts.push(pendingReenrollment + ' lembrete' + (pendingReenrollment === 1 ? '' : 's') + ' de rematrícula');
      window.CreateJoyUI.alert('Você tem ' + parts.join(' e ') + '. A central de notificações também mostra cada item.', 'info', 'Lembretes de hoje');
    }
  }

  // ===== Login Page =====
  function renderLogin() {
    var roles = [
      { key: 'student', label: 'Aluno', icon: '🎓', desc: 'Acompanhe sua jornada de aprendizado', color: '#1E72B8' },
      { key: 'teacher', label: 'Professor', icon: '📋', desc: 'Gerencie turmas e corrija atividades', color: '#F26522' },
      { key: 'admin', label: 'Gestão', icon: '🛡️', desc: 'Admin, supervisão, financeiro e gestão administrativa', color: '#555555' },
    ];

    var roleCards = roles
      .map(function (r) {
        return (
          '<button class="role-card" data-role="' + r.key + '" style="--role-color:' + r.color + '" type="button">' +
          '<span class="role-icon">' + r.icon + '</span>' +
          '<span class="role-label">' + r.label + '</span>' +
          '<span class="role-desc">' + r.desc + '</span>' +
          '</button>'
        );
      })
      .join('');

    var html =
      '<div class="login-page">' +
      '<div class="login-bg"><div class="login-blob blob-1"></div><div class="login-blob blob-2"></div><div class="login-blob blob-3"></div></div>' +
      '<div class="login-container">' +
      '<div class="login-left">' +
      '<div class="login-logo"><img src="/images/brand/createjoy-logo.png" alt="CreateJoy" /></div>' +
      '<h1 class="login-headline">Bem-vindo ao<br/><span>Sistema de Missões</span></h1>' +
      '<p class="login-tagline">Aprenda, evolua e conquiste missões na sua jornada de criação com tecnologia.</p>' +
      '</div>' +
      '<div class="login-right">' +
      '<div class="login-card animate-slide">' +
      '<div class="login-card-header"><h2>Entrar na plataforma</h2><p>Selecione seu perfil de acesso</p></div>' +
      '<div class="role-grid">' + roleCards + '</div>' +
      '<form id="login-form" class="login-form">' +
      '<div class="form-group"><label class="form-label">E-mail</label><input class="form-input" type="email" id="login-email" placeholder="seu@email.com" required /></div>' +
      '<div class="form-group"><label class="form-label">Senha</label><div class="password-input-wrap"><input class="form-input" type="password" id="login-senha" placeholder="••••••••" required /><button class="password-visibility" id="login-password-toggle" type="button" aria-label="Mostrar senha" title="Mostrar senha">' + icon('eye', 18) + '</button></div></div>' +
      '<div id="login-error" class="form-error" style="display:none;color:var(--error);font-size:0.8125rem"></div>' +
      '<button type="submit" class="btn btn-primary btn-lg" id="login-submit" style="width:100%;justify-content:center" disabled>Entrar</button>' +
      '</form>' +
      '<p class="login-hint">Selecione seu perfil e informe as credenciais cadastradas pela supervisão.</p>' +
      '</div>' +
      '</div>' +
      '</div>' +
      '</div>';

    document.getElementById('app').innerHTML = html;

    var selectedRole = null;
    var passwordInput = document.getElementById('login-senha');
    var passwordToggle = document.getElementById('login-password-toggle');
    passwordToggle.addEventListener('click', function () {
      var show = passwordInput.type === 'password';
      passwordInput.type = show ? 'text' : 'password';
      passwordToggle.innerHTML = icon(show ? 'eyeOff' : 'eye', 18);
      passwordToggle.setAttribute('aria-label', show ? 'Ocultar senha' : 'Mostrar senha');
      passwordToggle.setAttribute('title', show ? 'Ocultar senha' : 'Mostrar senha');
      passwordInput.focus();
    });

    function updateButton() {
      var btn = document.getElementById('login-submit');
      if (selectedRole) {
        btn.disabled = false;
        btn.innerHTML = 'Entrar como ' + selectedRole.label;
      } else {
        btn.disabled = true;
        btn.innerHTML = 'Entrar';
      }
    }

    var cards = document.querySelectorAll('.role-card');
    cards.forEach(function (card) {
      card.addEventListener('click', function () {
        cards.forEach(function (c) { c.classList.remove('active'); });
        card.classList.add('active');
        var key = card.getAttribute('data-role');
        selectedRole = roles.filter(function (r) { return r.key === key; })[0];
        document.getElementById('login-email').focus();
        updateButton();
      });
    });

    document.getElementById('login-form').addEventListener('submit', async function (e) {
      e.preventDefault();
      if (!selectedRole) return;
      var btn = document.getElementById('login-submit');
      var errorBox = document.getElementById('login-error');
      btn.disabled = true;
      btn.innerHTML = '<span class="login-spinner"></span>';
      errorBox.style.display = 'none';
      try {
        await login(
          selectedRole.key,
          document.getElementById('login-email').value,
          document.getElementById('login-senha').value
        );
      } catch (error) {
        var activeLoginForm = document.getElementById('login-form');
        if (!activeLoginForm) {
          console.error('Falha ao concluir a renderização após o login:', error);
          return;
        }
        errorBox.textContent = error.message;
        errorBox.style.display = 'block';
        updateButton();
      }
    });
  }

  // ===== Sidebar =====
  function renderSidebar() {
    var role = state.role;
    var user = sanitizeValue(users[role]);
    var items = navItems[role] || [];
    var collapsed = state.collapsed;
    var color = roleColors[role];

    var navHtml = items
      .map(function (item) {
        var cls = 'nav-item' + (state.activePage === item.key ? ' active' : '');
        return (
          '<button class="' + cls + '" data-page="' + item.key + '" aria-label="' + item.label + '" title="' + (collapsed ? item.label : '') + '">' +
          icon(item.icon, 20) +
          (collapsed ? '' : '<span>' + item.label + '</span>') +
          (state.activePage === item.key && !collapsed ? '<span class="nav-active-dot"></span>' : '') +
          '</button>'
        );
      })
      .join('');

    var userHtml =
      '<div class="sidebar-user">' +
      (user.fotoUrl ? '<img class="avatar avatar-sm sidebar-user-avatar" src="' + user.fotoUrl + '" alt="" style="object-fit:cover" />' : '<div class="avatar avatar-sm sidebar-user-avatar">' + user.initials + '</div>') +
      '<div class="sidebar-user-info">' +
      '<span class="sidebar-user-name">' + user.name + '</span>' +
      '<span class="sidebar-user-role">' + roleLabels[role] + '</span>' +
      '</div>' +
      '</div>';

    return (
      '<aside class="sidebar' + (collapsed ? ' collapsed' : '') + '" style="--role-accent:' + color + '">' +
      '<div class="sidebar-header">' +
      '<div class="sidebar-logo' + (collapsed ? ' compact' : '') + '">' +
      '<img src="' + (collapsed ? '/images/brand/createjoy-icon.png' : '/images/brand/createjoy-logo.png') + '" alt="CreateJoy" class="sidebar-logo-img" />' +
      '</div>' +
      '<button class="sidebar-toggle" id="toggle-sidebar" title="' + (collapsed ? 'Expandir' : 'Recolher') + '">' +
      icon(collapsed ? 'chevronRight' : 'chevronLeft', 16) +
      '</button>' +
      '</div>' +
      (collapsed ? '' : '<div class="sidebar-role-badge"><span class="role-pill">' + roleLabels[role] + '</span></div>') +
      '<nav class="sidebar-nav">' + navHtml + '</nav>' +
      '<div class="sidebar-footer">' +
      (collapsed ? '' : userHtml) +
      '<button class="nav-item logout-btn" id="logout-btn" aria-label="Sair" title="Sair">' + icon('logOut', 18) + (collapsed ? '' : '<span>Sair</span>') + '</button>' +
      '</div>' +
      '</aside>'
    );
  }

  // ===== Header =====
  function renderHeader() {
    var role = state.role;
    var info = (pageTitles[role] && pageTitles[role][state.activePage]) || { title: state.activePage, sub: '' };
    var user = sanitizeValue(users[role]);
    var collapsed = state.collapsed;
    var notifications = buildNotifications();
    var seen = seenNotifications();
    var notificationCount = notifications.filter(function (item) { return seen.indexOf(String(item.key)) === -1; }).length;
    var notificationsHtml = notifications.map(function (item) {
      var isUnread = seen.indexOf(String(item.key)) === -1;
      return '<button type="button" class="notification-item' + (isUnread ? ' unread' : '') + '" data-notification-key="' + sanitizeValue(item.key) + '" data-notification-page="' + sanitizeValue(item.page) + '"' + (item.missionId ? ' data-notification-mission="' + Number(item.missionId) + '"' : '') + '><span class="notification-item-icon">' + icon(item.icon || 'bell', 17) + '</span><span class="notification-item-copy"><strong>' + sanitizeValue(item.title) + '</strong><span>' + sanitizeValue(item.text) + '</span>' + (item.meta ? '<small>' + sanitizeValue(item.meta) + '</small>' : '') + '</span>' + (isUnread ? '<i aria-label="Não lida"></i>' : '') + '</button>';
    }).join('');
    if (!notificationsHtml) notificationsHtml = '<div class="notification-empty">' + icon('checkCircle', 24) + '<strong>Tudo em dia</strong><span>Não há nenhuma notificação no momento.</span></div>';

    return (
      '<header class="top-header' + (collapsed ? ' collapsed' : '') + '">' +
      '<div class="header-left">' +
      '<h1 class="header-title">' + info.title + '</h1>' +
      (info.sub ? '<p class="header-sub">' + info.sub + '</p>' : '') +
      (user.mustChangePassword ? '<span class="badge badge-yellow" style="margin-top:4px">Troque a senha temporária</span>' : '') +
      '</div>' +
      '<div class="header-right">' +
      '<div class="notification-wrap"><button class="header-icon-btn notification-btn" id="notification-toggle" type="button" aria-label="Abrir notificações" aria-expanded="false">' + icon('bell', 20) + (notificationCount > 0 ? '<span class="notif-badge">' + (notificationCount > 99 ? '99+' : notificationCount) + '</span>' : '') + '</button><section class="notification-panel" id="notification-panel" hidden><div class="notification-panel-head"><div><span>CENTRAL CREATEJOY</span><h3>Notificações</h3></div>' + (notificationCount ? '<button type="button" id="notification-read-all">Marcar como lidas</button>' : '') + '</div><div class="notification-list">' + notificationsHtml + '</div></section></div>' +
      '<button type="button" class="header-user" id="header-profile" title="Abrir meu perfil">' +
      (user.fotoUrl ? '<img class="avatar avatar-sm header-avatar" src="' + user.fotoUrl + '" alt="" style="object-fit:cover" />' : '<div class="avatar avatar-sm header-avatar">' + (user.initials || '?') + '</div>') +
      '<div class="header-user-info">' +
      '<span class="header-user-name">' + (user.name || 'Usuário') + '</span>' +
      '<span class="header-user-role">' + roleLabels[role] + '</span>' +
      '</div>' +
      '</button>' +
      '</div>' +
      '</header>'
    );
  }

  // ===== Page rendering =====
  function renderPage() {
    var role = state.role;
    var page = state.activePage;
    var nav = navigate;
    var viewData = sanitizeValue(D);

    if (role === 'student') return window.StudentPages.render(page, nav, icon, viewData);
    if (role === 'teacher') return window.TeacherPages.render(page, nav, icon, viewData);
    if (role === 'admin' || role === 'supervisor' || role === 'finance' || role === 'administrative') return window.AdminPages.render(page, nav, icon, viewData);
    return '<div class="empty-state">Página não encontrada</div>';
  }

  // ===== Main render =====
  function render() {
    var app = document.getElementById('app');

    if (state.loading) {
      app.innerHTML = '<div class="login-page"><div class="login-spinner" style="width:36px;height:36px"></div></div>';
      return;
    }

    if (!state.role) {
      renderLogin();
      return;
    }

    var html =
      '<div class="app-layout">' +
      renderSidebar() +
      '<div class="main-content' + (state.collapsed ? ' collapsed' : '') + '">' +
      renderHeader() +
      '<main class="page-body">' + renderPage() + '</main>' +
      '</div>' +
      '</div>';

    app.innerHTML = html;

    // Bind events
    var toggle = document.getElementById('toggle-sidebar');
    if (toggle) toggle.addEventListener('click', toggleSidebar);

    var logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) logoutBtn.addEventListener('click', logout);

    var navBtns = document.querySelectorAll('.sidebar-nav .nav-item[data-page]');
    navBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        navigate(btn.getAttribute('data-page'));
      });
    });

    var headerProfile = document.getElementById('header-profile');
    if (headerProfile) headerProfile.addEventListener('click', function () { navigate('profile'); });

    var notificationToggle = document.getElementById('notification-toggle');
    var notificationPanel = document.getElementById('notification-panel');
    if (notificationToggle && notificationPanel) {
      notificationToggle.addEventListener('click', function (event) {
        event.stopPropagation();
        var willOpen = notificationPanel.hidden;
        notificationPanel.hidden = !willOpen;
        notificationToggle.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
        if (willOpen) {
          setTimeout(function () {
            document.addEventListener('click', function closeNotifications(clickEvent) {
              if (!notificationPanel.contains(clickEvent.target) && clickEvent.target !== notificationToggle) {
                notificationPanel.hidden = true;
                notificationToggle.setAttribute('aria-expanded', 'false');
              }
            }, { once: true });
          }, 0);
        }
      });
      notificationPanel.addEventListener('click', function (event) { event.stopPropagation(); });
      notificationPanel.querySelectorAll('[data-notification-key]').forEach(function (button) {
        button.addEventListener('click', function () {
          var seen = seenNotifications();
          var key = String(button.getAttribute('data-notification-key'));
          if (seen.indexOf(key) === -1) seen.push(key);
          saveSeenNotifications(seen);
          var missionId = Number(button.getAttribute('data-notification-mission') || 0);
          if (missionId) D.selectedMissionId = missionId;
          navigate(button.getAttribute('data-notification-page') || 'dashboard');
        });
      });
      var readAll = document.getElementById('notification-read-all');
      if (readAll) readAll.addEventListener('click', function () {
        var seen = seenNotifications();
        buildNotifications().forEach(function (item) {
          if (seen.indexOf(String(item.key)) === -1) seen.push(String(item.key));
        });
        saveSeenNotifications(seen);
        render();
      });
    }

    // Bind page-specific events
    var role = state.role;
    var viewData = sanitizeValue(D);
    if (role === 'student' && window.StudentPages.bind) window.StudentPages.bind(state.activePage, navigate, viewData);
    if (role === 'teacher' && window.TeacherPages.bind) window.TeacherPages.bind(state.activePage, navigate, viewData);
    if ((role === 'admin' || role === 'supervisor' || role === 'finance' || role === 'administrative') && window.AdminPages.bind) window.AdminPages.bind(state.activePage, navigate, viewData);
    window.setTimeout(showPendingAchievementPopup, 80);
    window.setTimeout(function () { showSystemReminders(0); }, 450);
  }

  // ===== Init =====
  window.CreateJoyApp = {
    updateData: updateData,
    navigate: navigate,
    getRawData: function () { return D; },
    getCurrentUser: function () { return state.role ? users[state.role] : null; },
  };

  document.addEventListener('DOMContentLoaded', async function () {
    render();
    try {
      var payload = await Api.me();
      hydrate(payload);
      state.role = payload.user.role;
    } catch (error) {
      state.role = null;
    }
    state.loading = false;
    render();
  });
})();
