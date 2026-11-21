// Admin pages
window.AdminPages = (function () {
  'use strict';

  var activeAdministrationSection = 'semesters';
  var reenrollmentListState = {
    page: 1,
    search: '',
    status: 'all',
    payment: 'all',
    action: 'all',
  };

  function joyLabel(value) {
    var amount = Number(value || 0);
    return amount + ' Joy' + (amount === 1 ? '' : 's');
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function dateLabel(value, withTime) {
    if (!value) return 'Não informado';
    var normalized = String(value).replace(' ', 'T');
    var date = new Date(normalized.length === 10 ? normalized + 'T12:00:00' : normalized);
    if (Number.isNaN(date.getTime())) return escapeHtml(value);
    return date.toLocaleDateString('pt-BR') + (withTime ? ' · ' + date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '');
  }

  function render(page, navigate, icon, D) {
    switch (page) {
      case 'dashboard': return dashboard(navigate, icon, D);
      case 'curriculum': return curriculum(icon, D);
      case 'missions': return missions(icon, D);
      case 'activities': return activities(icon, D);
      case 'teachers': return teachers(icon, D);
      case 'students': return students(icon, D);
      case 'student-detail': return window.TeacherPages.render('student-detail', navigate, icon, D);
      case 'course-progress': return window.TeacherPages.render('missions', navigate, icon, D);
      case 'submissions': return window.TeacherPages.render('submissions', navigate, icon, D);
      case 'achievements': return window.AchievementPages.render(icon, D);
      case 'classes': return classes(icon, D);
      case 'store-products': return storeProducts(icon, D);
      case 'store-requests': return storeRequests(icon, D);
      case 'reenrollment': return reenrollment(icon, D);
      case 'administration': return administration(icon, D);
      case 'permissions': return permissions(icon, D);
      case 'reports': return reports(icon, D);
      case 'profile': return profile(icon, D);
      default: return dashboard(navigate, icon, D);
    }
  }

  // ===== Dashboard =====
  function financialDashboard(icon, D) {
    var data = D.reenrollment || { available: false, contracts: [], analytics: {} };
    var contracts = data.contracts || [];
    var analytics = data.analytics || {};
    var methods = analytics.paymentMethods || {};
    var workflow = reenrollmentWorkflowCounts(contracts);
    var financialTypes = { issue_boleto: 'Emitir carnê/boleto', issue_enrollment_fee: 'Emitir taxa de matrícula' };
    var tasks = [];
    var completedTasks = [];

    contracts.forEach(function (contract) {
      (contract.reminders || []).forEach(function (reminder) {
        if (!financialTypes[reminder.type]) return;
        if (reminder.status === 'pending') tasks.push({ contract: contract, reminder: reminder });
        if (reminder.status === 'completed') completedTasks.push({ contract: contract, reminder: reminder });
      });
    });
    tasks.sort(function (left, right) { return String(left.reminder.dueAt || '').localeCompare(String(right.reminder.dueAt || '')); });
    completedTasks.sort(function (left, right) { return String(right.reminder.completedAt || '').localeCompare(String(left.reminder.completedAt || '')); });

    var statCards = [
      { label: 'Alunos acompanhados', value: analytics.totalStudents || contracts.length, icon: 'users', color: 'blue' },
      { label: 'Pagam por boleto', value: methods.boleto || 0, icon: 'fileText', color: 'green' },
      { label: 'Pagam por cartão', value: methods.card || 0, icon: 'coins', color: 'orange' },
      { label: 'Pagam à vista', value: methods.cash || 0, icon: 'coins', color: 'blue' },
      { label: 'Tarefas pendentes', value: tasks.length, icon: 'clipboardList', color: 'orange' },
    ].map(function (stat) {
      return '<article class="stat-card"><div class="stat-icon ' + stat.color + '">' + icon(stat.icon, 21) + '</div><div><div class="stat-value">' + stat.value + '</div><div class="stat-label">' + stat.label + '</div></div></article>';
    }).join('');

    var paymentItems = [
      { key: 'card', label: 'Cartão', color: '#1E72B8' },
      { key: 'boleto', label: 'Boleto', color: '#F26522' },
      { key: 'cash', label: 'À vista', color: '#22C55E' },
      { key: 'other', label: 'Outro/Bolsista', color: '#8B5CF6' },
      { key: 'not_informed', label: 'Não informado', color: '#94A3B8' },
    ];
    var paymentTotal = Math.max(1, paymentItems.reduce(function (sum, item) { return sum + Number(methods[item.key] || 0); }, 0));
    var paymentChart = paymentItems.map(function (item) {
      var value = Number(methods[item.key] || 0);
      return '<div class="reenrollment-bar-row"><div><span>' + item.label + '</span><strong>' + value + '</strong></div><div class="reenrollment-bar"><i style="width:' + Math.round(value * 100 / paymentTotal) + '%;background:' + item.color + '"></i></div></div>';
    }).join('');

    var workflowItems = [
      { label: 'Sem pendência / rematriculado', value: workflow.confirmed, color: '#22C55E' },
      { label: 'Falta pagamento ou taxa', value: workflow.paymentOnly, color: '#EAB308' },
      { label: 'Renovação pendente', value: workflow.renewal, color: '#F97316' },
      { label: 'Confirmaram — criar contrato', value: workflow.awaitingContract, color: '#3B82F6' },
      { label: 'Não vão continuar', value: workflow.stopped, color: '#EF4444' },
    ];
    var workflowTotal = Math.max(1, contracts.length);
    var workflowChart = workflowItems.map(function (item) {
      return '<div class="reenrollment-bar-row"><div><span>' + item.label + '</span><strong>' + item.value + '</strong></div><div class="reenrollment-bar"><i style="width:' + Math.round(item.value * 100 / workflowTotal) + '%;background:' + item.color + '"></i></div></div>';
    }).join('');

    function boletoDetails(reminder) {
      if (reminder.type !== 'issue_boleto') return '';
      return '<div class="finance-task-details"><span><small>Responsável</small><strong>' + escapeHtml(reminder.responsibleName || 'Não informado') + '</strong></span><span><small>Período</small><strong>' + (reminder.installmentCount || 0) + ' boleto(s)</strong></span><span><small>Primeiro vencimento</small><strong>' + dateLabel(reminder.firstDueDate, false) + '</strong></span><span><small>Dia de vencimento</small><strong>Dia ' + (reminder.dueDay || '—') + '</strong></span><span><small>Sponte</small><strong>' + (reminder.sponteRegistered === true ? 'Cadastrado' : reminder.sponteRegistered === false ? 'Não cadastrado' : 'Não informado') + '</strong></span></div>';
    }

    function attachmentLink(reminder) {
      if (reminder.attachment) {
        return '<a class="finance-task-file" href="' + escapeHtml(reminder.attachment.downloadUrl) + '" target="_blank" rel="noopener">' + icon('fileText', 14) + '<span><strong>' + escapeHtml(reminder.attachment.name) + '</strong><small>Disponível até ' + dateLabel(reminder.attachment.deleteAfter, false) + '</small></span></a>';
      }
      if (reminder.attachmentDeletedAt) {
        return '<span class="finance-file-expired">' + icon('checkCircle', 14) + ' PDF removido automaticamente após o prazo</span>';
      }
      return '';
    }

    var taskRows = tasks.map(function (entry) {
      var reminder = entry.reminder;
      var requiresPdf = reminder.type === 'issue_boleto';
      var upload = requiresPdf
        ? '<label class="finance-pdf-upload"><input type="file" accept="application/pdf,.pdf" data-financial-pdf="' + reminder.id + '" /><span>' + icon('upload', 14) + ' ' + (reminder.attachment ? 'Substituir PDF' : 'Selecionar PDF do carnê') + '</span></label>'
        : '';
      return '<article class="finance-task ' + (reminder.isOverdue ? 'overdue' : '') + '" data-financial-task="' + reminder.id + '"><div class="finance-task-icon">' + icon(reminder.type === 'issue_enrollment_fee' ? 'calendar' : 'fileText', 18) + '</div><div class="finance-task-copy"><span class="badge ' + (reminder.isOverdue ? 'badge-red' : 'badge-yellow') + '">' + (reminder.isOverdue ? 'Atrasada' : financialTypes[reminder.type]) + '</span><strong>' + escapeHtml(reminder.title) + '</strong><span>' + escapeHtml(entry.contract.studentName) + ' · ' + escapeHtml(entry.contract.className || 'Sem turma') + '</span><small>' + dateLabel(reminder.dueAt, true) + (reminder.notes ? ' · ' + escapeHtml(reminder.notes) : '') + '</small>' + boletoDetails(reminder) + attachmentLink(reminder) + '</div><div class="finance-task-actions"><button class="btn btn-outline btn-sm" type="button" data-financial-task-open="' + reminder.id + '">' + icon('eye', 14) + ' Ver detalhes</button>' + upload + '<button class="btn btn-primary btn-sm" type="button" data-financial-task-complete="' + reminder.id + '" data-requires-pdf="' + (requiresPdf ? '1' : '0') + '" data-has-attachment="' + (reminder.attachment ? '1' : '0') + '">' + icon('checkCircle', 14) + ' ' + (requiresPdf ? (reminder.attachment ? 'Concluir' : 'Enviar PDF e concluir') : 'Concluir') + '</button></div></article>';
    }).join('');
    if (!taskRows) taskRows = '<div class="empty-state compact">Nenhuma tarefa financeira pendente. Quando a gestão criar uma tarefa de carnê, boleto ou taxa de matrícula, ela aparecerá aqui.</div>';

    var completedRows = completedTasks.slice(0, 20).map(function (entry) {
      var reminder = entry.reminder;
      return '<article class="finance-task finance-task-completed"><div class="finance-task-icon">' + icon('checkCircle', 18) + '</div><div class="finance-task-copy"><span class="badge badge-green">Concluída</span><strong>' + escapeHtml(reminder.title) + '</strong><span>' + escapeHtml(entry.contract.studentName) + '</span><small>Concluída em ' + dateLabel(reminder.completedAt, true) + '</small>' + boletoDetails(reminder) + attachmentLink(reminder) + '</div></article>';
    }).join('');
    if (!completedRows) completedRows = '<div class="empty-state compact">Nenhuma tarefa financeira foi concluída ainda.</div>';

    return '<div class="animate-fade finance-dashboard">' +
      (!data.available ? '<div class="card reenrollment-migration-warning mb-5">' + icon('alertTriangle', 20) + '<div><strong>Atualização financeira indisponível.</strong><span>Peça ao Admin Geral para conferir a atualização do banco.</span></div></div>' : '') +
      '<section class="card finance-hero mb-6"><div><span class="admin-form-kicker">ACESSO FINANCEIRO</span><h2>Boletos, carnês e taxas</h2><p>Você visualiza somente as tarefas financeiras criadas pela gestão e os indicadores gerais de pagamento e rematrícula.</p></div><div class="finance-hero-total"><strong>' + tasks.length + '</strong><span>tarefas pendentes</span></div></section>' +
      '<div class="finance-stats mb-6">' + statCards + '</div>' +
      '<div class="grid-2 finance-insights mb-6"><section class="card"><div class="section-header mb-4"><span class="section-title">Formas de pagamento</span><span class="badge badge-blue">' + (analytics.totalStudents || contracts.length) + ' alunos</span></div>' + paymentChart + '</section><section class="card"><div class="section-header mb-4"><span class="section-title">Situação da rematrícula</span></div>' + workflowChart + '</section></div>' +
      '<section class="card mb-6"><div class="section-header mb-4"><div><span class="section-title">Tarefas para executar</span><p class="finance-section-help">O PDF é obrigatório para concluir a emissão de carnê ou boleto.</p></div><span class="badge ' + (tasks.some(function (entry) { return entry.reminder.isOverdue; }) ? 'badge-red' : 'badge-green') + '">' + tasks.length + ' pendente(s)</span></div><div class="finance-task-list">' + taskRows + '</div></section>' +
      '<section class="card"><div class="section-header mb-4"><div><span class="section-title">Histórico financeiro recente</span><p class="finance-section-help">O PDF é apagado automaticamente um mês após o último vencimento; o registro da tarefa continua salvo.</p></div><span class="badge badge-blue">' + completedTasks.length + ' concluída(s)</span></div><div class="finance-task-list finance-history-list">' + completedRows + '</div></section>' +
      '</div>';
  }

  function openFinancialTaskModal(entry) {
    var contract = entry.contract;
    var reminder = entry.reminder;
    var isBoleto = reminder.type === 'issue_boleto';
    var modal = document.createElement('div');
    modal.className = 'admin-modal-backdrop';
    var details = isBoleto
      ? '<div class="finance-task-modal-grid"><div><span>Aluno</span><strong>' + escapeHtml(contract.studentName) + '</strong></div><div><span>Turma</span><strong>' + escapeHtml(contract.className || 'Sem turma') + '</strong></div><div class="finance-task-modal-wide"><span>Nome completo do responsável</span><strong>' + escapeHtml(reminder.responsibleName || 'Não informado') + '</strong></div><div><span>Quantidade de boletos</span><strong>' + (reminder.installmentCount || 0) + '</strong></div><div><span>Primeiro vencimento</span><strong>' + dateLabel(reminder.firstDueDate, false) + '</strong></div><div><span>Dia de vencimento</span><strong>Dia ' + (reminder.dueDay || '—') + '</strong></div><div><span>Cadastro no Sponte</span><strong>' + (reminder.sponteRegistered === true ? 'Sim, já cadastrado' : reminder.sponteRegistered === false ? 'Não cadastrado' : 'Não informado') + '</strong></div></div>'
      : '<div class="finance-task-modal-grid"><div><span>Aluno</span><strong>' + escapeHtml(contract.studentName) + '</strong></div><div><span>Turma</span><strong>' + escapeHtml(contract.className || 'Sem turma') + '</strong></div></div>';
    var attachment = reminder.attachment
      ? '<a class="finance-task-file" href="' + escapeHtml(reminder.attachment.downloadUrl) + '" target="_blank" rel="noopener">' + window.Icons.render('fileText', 15) + '<span><strong>' + escapeHtml(reminder.attachment.name) + '</strong><small>Disponível até ' + dateLabel(reminder.attachment.deleteAfter, false) + '</small></span></a>'
      : '<p class="finance-task-modal-empty">Nenhum PDF foi enviado ainda.</p>';
    modal.innerHTML = '<section class="admin-modal reenrollment-small-modal finance-task-modal" role="dialog" aria-modal="true" aria-labelledby="financial-task-title"><div class="admin-modal-header"><div><span class="admin-form-kicker">TAREFA FINANCEIRA</span><h2 id="financial-task-title">' + escapeHtml(reminder.title) + '</h2><p class="text-sm text-muted">Prazo: ' + dateLabel(reminder.dueAt, true) + '</p></div><button class="btn btn-ghost btn-icon" type="button" data-financial-modal-close aria-label="Fechar">' + window.Icons.render('x', 18) + '</button></div><div class="admin-modal-body">' + details + '<div class="finance-task-modal-section"><span>Observações da gestão</span><p>' + escapeHtml(reminder.notes || 'Nenhuma observação informada.') + '</p></div><div class="finance-task-modal-section"><span>Arquivo do carnê</span>' + attachment + '</div></div><div class="admin-modal-footer"><span class="admin-save-hint">O envio do PDF e a conclusão ficam disponíveis no cartão da tarefa.</span><button class="btn btn-primary" type="button" data-financial-modal-close>Voltar para a tarefa</button></div></section>';
    document.body.appendChild(modal);
    function close() { modal.remove(); }
    modal.querySelectorAll('[data-financial-modal-close]').forEach(function (button) {
      button.addEventListener('click', close);
    });
    modal.addEventListener('click', function (event) {
      if (event.target === modal) close();
    });
  }

  function dashboard(navigate, icon, D) {
    var currentUser = window.CreateJoyApp.getCurrentUser();
    if (currentUser && currentUser.role === 'finance') return financialDashboard(icon, D);
    var activeStudents = D.students.filter(function (s) { return s.status === 'ativo'; }).length;
    var activeClasses = D.classes.filter(function (c) { return c.status === 'ativa'; }).length;
    var activeMissions = D.missions.filter(function (m) { return m.status === 'ativa'; }).length;
    var avgProgress = D.students.length
      ? Math.round(D.students.reduce(function (a, s) { return a + s.progresso; }, 0) / D.students.length)
      : 0;

    var analytics = D.managementAnalytics || {};
    var genderStats = analytics.gender || {
      total: D.students.length,
      male: D.students.filter(function (student) { return student.gender === 'male'; }).length,
      female: D.students.filter(function (student) { return student.gender === 'female'; }).length,
      notInformed: D.students.filter(function (student) { return student.gender !== 'male' && student.gender !== 'female'; }).length,
    };
    var storeRequests = D.storeRequests || [];
    var storeStats = analytics.store || {
      total: storeRequests.length,
      approved: storeRequests.filter(function (request) { return request.status === 'approved'; }).length,
      pending: storeRequests.filter(function (request) { return request.status === 'pending'; }).length,
      rejected: storeRequests.filter(function (request) { return request.status === 'rejected'; }).length,
      cancelled: storeRequests.filter(function (request) { return request.status === 'cancelled'; }).length,
    };
    var topProducts = analytics.topProducts || [];
    if (!topProducts.length && storeRequests.length) {
      var productsByName = {};
      storeRequests.forEach(function (request) {
        if (request.status !== 'approved') return;
        var name = request.productName || 'Produto';
        productsByName[name] = (productsByName[name] || 0) + 1;
      });
      topProducts = Object.keys(productsByName).map(function (name) {
        return { name: name, approvedQuantity: productsByName[name] };
      }).sort(function (a, b) {
        return b.approvedQuantity - a.approvedQuantity || a.name.localeCompare(b.name);
      }).slice(0, 5);
    }

    function safeText(value) {
      return String(value == null ? '' : value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
    }

    function percent(value, total) {
      return total > 0 ? Math.round((Number(value || 0) / total) * 100) : 0;
    }

    var malePercent = percent(genderStats.male, genderStats.total);
    var femalePercent = percent(genderStats.female, genderStats.total);
    var informedPercent = malePercent + femalePercent;
    var genderGradient = genderStats.total > 0
      ? 'conic-gradient(#1E72B8 0 ' + malePercent + '%, #EC4899 ' + malePercent + '% ' + informedPercent + '%, #CBD5E1 ' + informedPercent + '% 100%)'
      : 'conic-gradient(#E2E8F0 0 100%)';
    var genderChart =
      '<div class="dashboard-chart-card card">' +
      '<div class="dashboard-chart-heading"><span class="dashboard-chart-icon is-blue">' + icon('users', 18) + '</span><div><h3>Alunos por gênero</h3><p>Todos os alunos cadastrados</p></div></div>' +
      '<div class="gender-chart-layout"><div class="gender-donut" style="background:' + genderGradient + '"><div class="gender-donut-center"><strong>' + Number(genderStats.total || 0) + '</strong><span>alunos</span></div></div>' +
      '<div class="gender-legend">' +
      '<div><i class="analytics-dot is-female"></i><span>Feminino</span><strong>' + Number(genderStats.female || 0) + '</strong><small>' + femalePercent + '%</small></div>' +
      '<div><i class="analytics-dot is-male"></i><span>Masculino</span><strong>' + Number(genderStats.male || 0) + '</strong><small>' + malePercent + '%</small></div>' +
      '<div><i class="analytics-dot is-unknown"></i><span>Não informado</span><strong>' + Number(genderStats.notInformed || 0) + '</strong><small>' + percent(genderStats.notInformed, genderStats.total) + '%</small></div>' +
      '</div></div></div>';

    var statusMax = Math.max(Number(storeStats.approved || 0), Number(storeStats.pending || 0), Number(storeStats.rejected || 0), 1);
    var requestStatusRows = [
      { label: 'Aprovadas', value: Number(storeStats.approved || 0), cls: 'is-approved' },
      { label: 'Pendentes', value: Number(storeStats.pending || 0), cls: 'is-pending' },
      { label: 'Recusadas', value: Number(storeStats.rejected || 0), cls: 'is-rejected' },
    ].map(function (status) {
      var width = status.value > 0 ? Math.max(8, Math.round((status.value / statusMax) * 100)) : 0;
      return '<div class="status-bar-row"><div><span>' + status.label + '</span><strong>' + status.value + '</strong></div><div class="status-track"><i class="status-fill ' + status.cls + '" style="width:' + width + '%"></i></div></div>';
    }).join('');
    var requestChart =
      '<div class="dashboard-chart-card card">' +
      '<div class="dashboard-chart-heading"><span class="dashboard-chart-icon is-orange">' + icon('shoppingBag', 18) + '</span><div><h3>Solicitações da CreateStore</h3><p>Situação de todos os pedidos</p></div><strong class="analytics-total">' + Number(storeStats.total || 0) + '<small>solicitadas</small></strong></div>' +
      '<div class="status-bars">' + requestStatusRows + '</div>' +
      (Number(storeStats.cancelled || 0) > 0 ? '<p class="analytics-footnote">Além disso, ' + Number(storeStats.cancelled || 0) + ' solicitação(ões) foram canceladas.</p>' : '') +
      '</div>';

    var topMax = topProducts.length ? Math.max(Number(topProducts[0].approvedQuantity || 0), 1) : 1;
    var topProductsHtml = topProducts.length
      ? topProducts.map(function (product, index) {
        var quantity = Number(product.approvedQuantity || 0);
        return '<div class="product-rank-row"><b>' + (index + 1) + '</b><div><span>' + safeText(product.name) + '</span><i><em style="width:' + Math.round((quantity / topMax) * 100) + '%"></em></i></div><strong>' + quantity + '</strong></div>';
      }).join('')
      : '<div class="analytics-empty">Nenhuma compra aprovada ainda.</div>';
    var topProductChart =
      '<div class="dashboard-chart-card card dashboard-top-products">' +
      '<div class="dashboard-chart-heading"><span class="dashboard-chart-icon is-green">' + icon('trendingUp', 18) + '</span><div><h3>Produtos mais vendidos</h3><p>Somente solicitações aprovadas</p></div></div>' +
      (topProducts.length ? '<div class="top-product-highlight"><span>Mais vendido</span><strong>' + safeText(topProducts[0].name) + '</strong><small>' + Number(topProducts[0].approvedQuantity || 0) + ' unidade(s) aprovada(s)</small></div>' : '') +
      '<div class="product-ranking">' + topProductsHtml + '</div></div>';

    var statCards = [
      { label: 'Total de Alunos', value: D.students.length, icon: 'users', color: 'blue', delta: '' },
      { label: 'Funcionários', value: (D.employees || D.teachers).length, icon: 'graduationCap', color: 'orange', delta: '' },
      { label: 'Turmas Ativas', value: activeClasses, icon: 'school', color: 'green', delta: '' },
      { label: 'Missões Ativas', value: activeMissions, icon: 'target', color: 'yellow', delta: '' },
    ]
      .map(function (s) {
        return '<div class="stat-card"><div class="stat-icon ' + s.color + '">' + icon(s.icon, 22) + '</div><div><div class="stat-value">' + s.value + '</div><div class="stat-label">' + s.label + '</div>' + (s.delta ? '<div class="stat-delta up">' + s.delta + '</div>' : '') + '</div></div>';
      })
      .join('');

    var classProgress = D.classes.filter(function (c) { return c.status === 'ativa'; })
      .map(function (c) {
        return '<div class="mb-4"><div class="flex items-center justify-between mb-1"><span class="text-sm font-semibold">' + c.nome + '</span><span class="text-xs font-bold" style="color:var(--blue-primary)">' + c.progresso + '%</span></div><div class="flex items-center" style="gap:10px"><div class="progress-bar flex-1"><div class="progress-fill" style="width:' + c.progresso + '%"></div></div><span class="text-xs text-muted" style="flex-shrink:0">' + c.alunos + ' alunos</span></div></div>';
      })
      .join('');

    var pendingCount = D.submissions.filter(function (submission) { return submission.status === 'pendente' || submission.status === 'refazer'; }).length;
    var bestClass = D.classes.slice().sort(function (a, b) { return b.progresso - a.progresso; })[0];
    var delayedCount = D.students.filter(function (s) { return s.status === 'atrasado'; }).length;
    var alerts = [];
    if (delayedCount > 0) {
      alerts.push({ type: 'warning', text: delayedCount + ' alunos com atraso nas missões', action: 'Ver alunos', page: 'students' });
    }
    if (pendingCount > 0) {
      alerts.push({ type: 'info', text: pendingCount + ' entregas aguardando avaliação', action: 'Ver entregas', page: 'submissions' });
    }
    if (bestClass) {
      alerts.push({ type: 'success', text: bestClass.nome + ' com maior progresso: ' + bestClass.progresso + '%', action: 'Ver turma', page: 'classes' });
    }
    var alertsHtml = alerts
      .map(function (a) {
        var bg = a.type === 'warning' ? 'var(--warning-light)' : a.type === 'info' ? 'var(--blue-faint)' : 'var(--success-light)';
        var border = a.type === 'warning' ? '#FCD34D' : a.type === 'info' ? 'var(--blue-lighter)' : '#86EFAC';
        return '<div style="padding:12px 14px;border-radius:var(--radius);background:' + bg + ';border:1px solid ' + border + ';display:flex;align-items:center;justify-content:space-between;gap:12px"><p class="text-sm" style="color:var(--gray-700)">' + a.text + '</p><button class="btn btn-ghost btn-sm" style="flex-shrink:0;font-size:0.75rem" data-nav="' + a.page + '">' + a.action + '</button></div>';
      })
      .join('');
    if (!alertsHtml) alertsHtml = '<div class="empty-state" style="padding:24px">Nenhum alerta no momento.</div>';
    if (!classProgress) classProgress = '<div class="empty-state" style="padding:24px">Nenhuma turma cadastrada.</div>';

    var studentRows = D.students
      .map(function (s) {
        var studentAvatar = s.fotoUrl ? '<img class="avatar avatar-sm" src="' + s.fotoUrl + '" alt="Foto de ' + s.name + '" style="object-fit:cover" />' : '<div class="avatar avatar-sm">' + s.initials + '</div>';
        return '<tr><td><div class="flex items-center" style="gap:10px">' + studentAvatar + '<span class="font-semibold">' + s.name + '</span></div></td><td class="text-sm text-muted">' + s.turma + '</td><td><span class="badge badge-blue">' + s.modulo + '</span></td><td><div class="flex items-center" style="gap:10px"><div class="progress-bar" style="width:100px"><div class="progress-fill" style="width:' + s.progresso + '%"></div></div><span class="text-sm font-bold" style="color:var(--blue-primary)">' + s.progresso + '%</span></div></td><td><span class="badge ' + (s.status === 'ativo' ? 'badge-green' : 'badge-red') + '">' + s.status + '</span></td></tr>';
      })
      .join('');
    if (!studentRows) studentRows = '<tr><td colspan="5"><div class="empty-state">Nenhum aluno cadastrado.</div></td></tr>';

    return (
      '<div class="animate-fade">' +
      '<div class="grid-4 mb-6">' + statCards + '</div>' +
      '<div class="dashboard-analytics-grid mb-6">' + genderChart + requestChart + topProductChart + '</div>' +
      '<div class="grid-2 mb-6">' +
      '<div class="card"><div class="section-header mb-4"><div class="flex items-center gap-2">' + icon('barChart', 18) + '<span class="section-title">Progresso por turma</span></div></div>' + classProgress + '</div>' +
      '<div class="card"><div class="section-header mb-4"><div class="flex items-center gap-2">' + icon('alertTriangle', 18) + '<span class="section-title">Alertas importantes</span></div></div><div style="display:flex;flex-direction:column;gap:10px">' + alertsHtml + '</div></div>' +
      '</div>' +
      '<div class="card"><div class="section-header mb-4"><div class="flex items-center gap-2">' + icon('trendingUp', 18) + '<span class="section-title">Progresso geral dos alunos</span></div><span class="badge badge-blue">Média: ' + avgProgress + '%</span></div><div class="table-wrapper"><table class="table"><thead><tr><th>Aluno</th><th>Turma</th><th>Módulo</th><th>Progresso</th><th>Status</th></tr></thead><tbody>' + studentRows + '</tbody></table></div></div>' +
      '</div>'
    );
  }

  // ===== Curriculum =====
  function curriculum(icon, D) {
    var levelColors = { 1: '#22C55E', 2: '#3B82F6', 3: '#F59E0B', 4: '#8B5CF6', 5: '#EF4444', 6: '#F26522', 7: '#1E72B8' };

    var modulesHtml = D.modules
      .map(function (m) {
        var color = m.cor || levelColors[m.level];
        return (
          '<div class="card" style="display:flex;align-items:center;gap:20px;opacity:' + (m.status === 'inativo' ? 0.6 : 1) + '">' +
          '<div style="width:48px;height:48px;border-radius:var(--radius);background:' + color + '22;border:2px solid ' + color + '44;display:flex;align-items:center;justify-content:center;flex-shrink:0">' + icon('bookOpen', 22) + '</div>' +
          '<div style="flex:1;min-width:0"><div class="flex items-center gap-3 mb-1"><span style="display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:50%;background:' + color + ';color:white;font-size:0.75rem;font-weight:800;flex-shrink:0">' + m.level + '</span><h4>' + m.name + '</h4><span class="badge ' + (m.status === 'ativo' ? 'badge-green' : 'badge-gray') + '">' + m.status + '</span></div><p class="text-sm text-muted">' + m.descricao + '</p></div>' +
          '<div class="flex gap-4 text-center" style="flex-shrink:0"><div><div class="font-bold" style="color:var(--blue-primary)">' + m.cargaHoraria + 'h</div><div class="text-xs text-muted">Carga</div></div><div><div class="font-bold" style="color:var(--orange)">' + m.missoes + '</div><div class="text-xs text-muted">Missões</div></div></div>' +
          '<div class="flex gap-2"><button class="btn btn-ghost btn-icon" title="Editar" data-admin-entity="module" data-admin-action="edit" data-id="' + m.id + '">' + icon('edit', 16) + '</button><button class="btn btn-ghost btn-icon" title="Excluir" data-admin-entity="module" data-admin-action="delete" data-id="' + m.id + '" style="color:var(--error)">' + icon('trash', 16) + '</button></div>' +
          '</div>'
        );
      })
      .join('');
    if (!modulesHtml) modulesHtml = '<div class="card empty-state">Nenhum módulo cadastrado.</div>';

    return (
      '<div class="animate-fade">' +
      '<div class="flex justify-between items-center mb-6"><p class="text-muted">Estrutura de módulos e níveis de ensino</p><button class="btn btn-primary" id="add-module-btn">' + icon('plus', 16) + ' Novo módulo</button></div>' +
      '<div id="module-form" style="display:none"></div>' +
      '<div style="display:flex;flex-direction:column;gap:12px">' + modulesHtml + '</div>' +
      '</div>'
    );
  }

  // ===== Missions =====
  function missions(icon, D) {
    var statusMap = { ativa: 'badge-green', rascunho: 'badge-yellow', arquivada: 'badge-gray' };

    var rows = D.missions
      .map(function (m) {
        return (
          '<tr><td><div><span class="font-semibold text-sm">' + m.titulo + '</span><span style="display:block;font-size:0.75rem;color:var(--gray-500)">' + m.objetivo + '</span></div></td>' +
          '<td><span class="badge badge-blue">' + m.modulo + '</span></td>' +
          '<td class="text-sm text-muted">Aula ' + m.aula + '</td>' +
          '<td><span class="badge ' + (m.tipo === 'obrigatoria' ? 'badge-blue' : 'badge-orange') + '">' + m.tipo + '</span></td>' +
          '<td><span class="badge badge-gray">' + m.entrega.toUpperCase() + '</span></td>' +
          '<td><span class="badge ' + (statusMap[m.status] || 'badge-gray') + '">' + m.status + '</span></td>' +
          '<td><div class="flex gap-1"><button class="btn btn-ghost btn-icon btn-sm" title="Editar" data-admin-entity="mission" data-admin-action="edit" data-id="' + m.id + '">' + icon('edit', 14) + '</button><button class="btn btn-ghost btn-icon btn-sm" title="Excluir" data-admin-entity="mission" data-admin-action="delete" data-id="' + m.id + '" style="color:var(--error)">' + icon('trash', 14) + '</button></div></td></tr>'
        );
      })
      .join('');
    if (!rows) rows = '<tr><td colspan="7"><div class="empty-state">Nenhuma missão cadastrada.</div></td></tr>';

    return (
      '<div class="animate-fade">' +
      '<div class="flex gap-3 mb-6 flex-wrap items-center"><div class="search-wrapper flex-1" style="max-width:320px">' + icon('search', 16) + '<input class="search-input" id="mission-search" placeholder="Buscar missão..." /></div><button class="btn btn-primary" id="add-mission-btn">' + icon('plus', 16) + ' Nova missão</button></div>' +
      '<div class="card"><div class="table-wrapper"><table class="table"><thead><tr><th>Missão</th><th>Módulo</th><th>Aula</th><th>Tipo</th><th>Entrega</th><th>Status</th><th>Ações</th></tr></thead><tbody id="mission-rows">' + rows + '</tbody></table></div></div>' +
      '</div>'
    );
  }

  // ===== Activities =====
  function activities(icon, D) {
    var activitiesData = D.activities || [];
    var tipoConfig = { exercicio: { label: 'Exercício', cls: 'badge-blue', icon: 'checkSquare' }, desafio: { label: 'Desafio', cls: 'badge-orange', icon: 'fileText' }, arquivo: { label: 'Arquivo', cls: 'badge-gray', icon: 'paperclip' } };

    var rows = activitiesData
      .map(function (a) {
        var tc = tipoConfig[a.tipo];
        return (
          '<tr><td><div class="flex items-center" style="gap:10px"><div style="width:32px;height:32px;border-radius:var(--radius-sm);background:var(--blue-faint);display:flex;align-items:center;justify-content:center">' + icon(tc.icon, 15) + '</div><span class="font-semibold text-sm">' + a.nome + '</span></div></td>' +
          '<td class="text-sm text-muted">' + a.missao + '</td>' +
          '<td><span class="badge ' + tc.cls + '">' + tc.label + '</span></td>' +
          '<td><span class="badge badge-gray">' + a.entrega.toUpperCase() + '</span></td>' +
          '<td class="text-sm text-muted" style="max-width:200px">' + a.criterio + '</td>' +
          '<td><div class="flex gap-1"><button class="btn btn-ghost btn-icon btn-sm" data-admin-entity="activity" data-admin-action="edit" data-id="' + a.id + '">' + icon('edit', 14) + '</button><button class="btn btn-ghost btn-icon btn-sm" data-admin-entity="activity" data-admin-action="delete" data-id="' + a.id + '" style="color:var(--error)">' + icon('x', 14) + '</button></div></td></tr>'
        );
      })
      .join('');
    if (!rows) rows = '<tr><td colspan="6"><div class="empty-state">Nenhuma atividade cadastrada.</div></td></tr>';

    return (
      '<div class="animate-fade">' +
      '<div class="flex justify-between items-center mb-6 flex-wrap gap-3"><p class="text-muted">Crie exercícios, desafios extras e arquivos de apoio para as missões</p><button class="btn btn-primary" id="add-activity-btn">' + icon('plus', 16) + ' Nova atividade</button></div>' +
      '<div class="card"><div class="table-wrapper"><table class="table"><thead><tr><th>Atividade</th><th>Missão</th><th>Tipo</th><th>Entrega</th><th>Critério</th><th>Ações</th></tr></thead><tbody>' + rows + '</tbody></table></div></div>' +
      '</div>'
    );
  }

  // ===== Employees =====
  function employeeRows(icon, items) {
    var currentUser = window.CreateJoyApp.getCurrentUser();
    return items
      .map(function (t) {
        var turmas = t.turmas || [];
        var turmasHtml = turmas.length
          ? '<details class="employee-classes"><summary><span>' + turmas.length + ' turma' + (turmas.length === 1 ? '' : 's') + '</span><small>' + turmas[0] + (turmas.length > 1 ? ' +' + (turmas.length - 1) : '') + '</small></summary><div class="employee-classes-list">' + turmas.map(function (tm) { return '<span>' + tm + '</span>'; }).join('') + '</div></details>'
          : '<span class="text-muted">—</span>';
        var isSelf = currentUser && currentUser.id === t.id;
        var protectedProfile = ['supervisor', 'admin', 'finance', 'administrative'].indexOf(t.role) !== -1;
        var canManageProfile = currentUser && (currentUser.role === 'admin' || !protectedProfile || isSelf);
        var editButton = canManageProfile
          ? '<button class="btn btn-ghost btn-icon btn-sm" data-admin-entity="employee" data-admin-action="edit" data-id="' + t.id + '">' + icon('edit', 14) + '</button>'
          : '<button class="btn btn-ghost btn-icon btn-sm" disabled title="Somente o Admin Geral pode editar este perfil" style="color:var(--gray-400);cursor:not-allowed">' + icon('edit', 14) + '</button>';
        var deleteButton = isSelf || !canManageProfile
          ? '<button class="btn btn-ghost btn-icon btn-sm" disabled title="Você não pode desativar a conta que está usando" style="color:var(--gray-400);cursor:not-allowed">' + icon('trash', 14) + '</button>'
          : '<button class="btn btn-ghost btn-icon btn-sm" data-admin-entity="employee" data-admin-action="delete" data-id="' + t.id + '" style="color:var(--error)">' + icon('trash', 14) + '</button>';
        var roleBadge = t.role === 'teacher' ? 'badge-orange'
          : t.role === 'supervisor' ? 'badge-gray'
          : t.role === 'finance' ? 'badge-blue'
          : t.role === 'administrative' ? 'badge-yellow'
          : 'badge-green';
        return (
          '<tr data-admin-employee-row data-search="' + (t.name + ' ' + t.email + ' ' + t.perfil + ' ' + turmas.join(' ')).toLowerCase() + '" data-role="' + t.role + '" data-account-status="' + t.status + '"><td><div class="flex items-center" style="gap:10px">' + (t.fotoUrl ? '<img class="avatar avatar-md" src="' + t.fotoUrl + '" alt="Foto de ' + t.name + '" style="object-fit:cover" />' : '<div class="avatar avatar-md" style="background:var(--orange-faint);color:var(--orange)">' + t.initials + '</div>') + '<div><span class="font-semibold">' + t.name + '</span><span class="text-xs text-muted" style="display:block">' + t.email + '</span></div></div></td>' +
          '<td><span class="badge ' + roleBadge + '">' + t.perfil + '</span></td>' +
          '<td>' + turmasHtml + '</td>' +
          '<td class="text-sm font-semibold">' + (t.role === 'teacher' ? t.alunos : '—') + '</td>' +
          '<td><span class="badge ' + (t.status === 'ativo' ? 'badge-green' : 'badge-gray') + '">' + t.status + '</span></td>' +
          '<td><div class="flex gap-1">' + editButton + deleteButton + '</div></td></tr>'
        );
      })
      .join('');
  }

  function teachers(icon, D) {
    var employees = D.employees || D.teachers;
    var rows = employeeRows(icon, employees);
    if (!rows) rows = '<tr><td colspan="6"><div class="empty-state">Nenhum funcionário cadastrado.</div></td></tr>';
    return (
      '<div class="animate-fade">' +
      '<div class="card admin-list-toolbar mb-4"><div class="search-wrapper flex-1">' + icon('search', 16) + '<input class="search-input" id="employee-search" placeholder="Buscar nome, e-mail ou turma..." /></div><select class="form-select" id="employee-role"><option value="all">Todos os perfis</option><option value="teacher">Professores</option><option value="supervisor">Supervisores</option><option value="finance">Financeiro</option><option value="administrative">Gestão Administrativa</option><option value="admin">Administradores</option></select><select class="form-select" id="employee-status"><option value="all">Todos os acessos</option><option value="ativo">Ativos</option><option value="inativo">Inativos</option></select><button class="btn btn-primary" id="add-employee-btn">' + icon('plus', 16) + ' Novo funcionário</button></div>' +
      '<div class="card"><div class="table-wrapper"><table class="table"><thead><tr><th>Funcionário</th><th>Perfil</th><th>Turmas</th><th>Alunos</th><th>Status</th><th>Ações</th></tr></thead><tbody id="employee-rows">' + rows + '</tbody></table></div></div>' +
      '<div class="card empty-state mt-3" id="employee-empty" style="display:none">Nenhum funcionário corresponde aos filtros.</div><div class="list-pagination" id="employee-pagination"><button class="btn btn-outline btn-sm" data-page-prev>Anterior</button><span data-page-info></span><button class="btn btn-outline btn-sm" data-page-next>Próxima</button></div>' +
      '</div>'
    );
  }

  // ===== Students =====
  function students(icon, D) {
    var rows = D.students
      .map(function (s) {
        var genderLabel = s.gender === 'male' ? 'Masculino' : s.gender === 'female' ? 'Feminino' : 'Não informado';
        return (
          '<tr data-admin-student-row data-search="' + (s.name + ' ' + s.email + ' ' + s.turma + ' ' + s.modulo + ' ' + genderLabel).toLowerCase() + '" data-class-id="' + (s.turmaId || 0) + '" data-account-status="' + s.accountStatus + '" data-gender="' + s.gender + '"><td><div class="flex items-center" style="gap:10px">' + (s.fotoUrl ? '<img class="avatar avatar-sm" src="' + s.fotoUrl + '" alt="Foto de ' + s.name + '" style="object-fit:cover" />' : '<div class="avatar avatar-sm">' + s.initials + '</div>') + '<div><span class="font-semibold">' + s.name + '</span><span class="text-xs text-muted" style="display:block">' + s.email + '</span></div></div></td>' +
          '<td class="text-sm text-muted">' + genderLabel + '</td>' +
          '<td class="text-sm text-muted">' + s.turma + '</td>' +
          '<td><span class="badge badge-blue">' + s.modulo + '</span></td>' +
          '<td class="text-sm font-semibold">#' + s.computador + '</td>' +
          '<td><div class="flex items-center" style="gap:8px"><div class="progress-bar" style="width:80px"><div class="progress-fill" style="width:' + s.progresso + '%"></div></div><span class="text-xs font-bold" style="color:var(--blue-primary)">' + s.progresso + '%</span></div></td>' +
          '<td><span class="badge ' + (s.status === 'ativo' ? 'badge-green' : s.status === 'atrasado' ? 'badge-red' : 'badge-gray') + '">' + s.status + '</span></td>' +
          '<td><div class="flex gap-1"><button class="btn btn-ghost btn-icon btn-sm" title="Acompanhar aluno" data-admin-entity="student" data-admin-action="view" data-id="' + s.id + '">' + icon('eye', 14) + '</button><button class="btn btn-ghost btn-icon btn-sm" title="Editar ou transferir" data-admin-entity="student" data-admin-action="edit" data-id="' + s.id + '">' + icon('edit', 14) + '</button><button class="btn btn-ghost btn-icon btn-sm" title="Desativar acesso" data-admin-entity="student" data-admin-action="deactivate" data-id="' + s.id + '" style="color:var(--warning)">' + icon('archive', 14) + '</button><button class="btn btn-ghost btn-icon btn-sm" title="Excluir definitivamente" data-admin-entity="student" data-admin-action="permanent-delete" data-id="' + s.id + '" style="color:var(--error)">' + icon('trash', 14) + '</button></div></td></tr>'
        );
      })
      .join('');
    if (!rows) rows = '<tr><td colspan="8"><div class="empty-state">Nenhum aluno cadastrado.</div></td></tr>';

    return (
      '<div class="animate-fade">' +
      '<div class="card admin-list-toolbar mb-4"><div class="search-wrapper flex-1">' + icon('search', 16) + '<input class="search-input" id="student-search" placeholder="Buscar por nome, e-mail, turma ou módulo..." /></div><select class="form-select" id="admin-student-class"><option value="all">Todas as turmas</option>' + (D.classes || []).map(function (item) { return '<option value="' + item.id + '">' + item.nome + '</option>'; }).join('') + '</select><select class="form-select" id="admin-student-gender"><option value="all">Todos os gêneros</option><option value="female">Feminino</option><option value="male">Masculino</option><option value="not_informed">Não informado</option></select><select class="form-select" id="admin-student-status"><option value="all">Todos os acessos</option><option value="active">Acesso ativo</option><option value="inactive">Acesso desativado</option></select><button class="btn btn-primary" id="add-student-btn">' + icon('plus', 16) + ' Novo aluno</button></div>' +
      '<div class="card"><div class="table-wrapper"><table class="table"><thead><tr><th>Aluno</th><th>Gênero</th><th>Turma</th><th>Módulo</th><th>PC</th><th>Progresso</th><th>Status</th><th>Ações</th></tr></thead><tbody id="student-rows">' + rows + '</tbody></table></div></div>' +
      '<div class="card empty-state mt-3" id="admin-student-empty" style="display:none">Nenhum aluno corresponde aos filtros.</div><div class="list-pagination" id="admin-student-pagination"><button class="btn btn-outline btn-sm" data-page-prev>Anterior</button><span data-page-info></span><button class="btn btn-outline btn-sm" data-page-next>Próxima</button></div>' +
      '</div>'
    );
  }

  // ===== Classes =====
  function classes(icon, D) {
    var cards = D.classes
      .map(function (c) {
        var items = [
          { label: 'Alunos', value: c.alunos },
          { label: 'Módulos', value: c.modulos.join(', ') },
          { label: 'Semestre', value: c.semestre },
          { label: 'Horários', value: c.horarios },
          { label: 'Progresso', value: c.progresso + '%' },
        ];
        var itemsHtml = items
          .map(function (item) {
            return '<div style="padding:8px 10px;background:var(--gray-50);border-radius:var(--radius-sm);border:1px solid var(--gray-200)"><span style="display:block;font-size:0.6875rem;color:var(--gray-500);font-weight:600">' + item.label + '</span><span style="display:block;font-size:0.875rem;font-weight:700;color:var(--gray-800)">' + item.value + '</span></div>';
          })
          .join('');

        return (
          '<div class="card" style="opacity:' + (c.status === 'inativa' ? 0.6 : 1) + '">' +
          '<div class="flex items-start justify-between mb-3"><div class="flex items-center gap-3"><div class="stat-icon blue" style="width:40px;height:40px">' + icon('users', 18) + '</div><div><h4>' + c.nome + '</h4><span class="text-xs text-muted">' + c.professor + '</span></div></div><span class="badge ' + (c.status === 'ativa' ? 'badge-green' : 'badge-gray') + '">' + c.status + '</span></div>' +
          '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px">' + itemsHtml + '</div>' +
          '<div class="progress-bar mb-3"><div class="progress-fill" style="width:' + c.progresso + '%"></div></div>' +
          '<div class="flex gap-2"><button class="btn btn-outline btn-sm" data-admin-entity="class" data-admin-action="edit" data-id="' + c.id + '">' + icon('edit', 13) + ' Editar</button><button class="btn btn-ghost btn-sm" data-admin-entity="class" data-admin-action="toggle" data-id="' + c.id + '">' + (c.status === 'ativa' ? 'Desativar' : 'Ativar') + '</button><button class="btn btn-ghost btn-sm btn-icon" data-admin-entity="class" data-admin-action="delete" data-id="' + c.id + '" style="color:var(--error);margin-left:auto">' + icon('trash', 14) + '</button></div>' +
          '</div>'
        );
      })
      .join('');
    if (!cards) cards = '<div class="card empty-state">Nenhuma turma cadastrada.</div>';

    return (
      '<div class="animate-fade">' +
      '<div class="flex justify-between items-center mb-6 flex-wrap gap-3"><p class="text-muted">Gerencie as turmas e suas configurações</p><button class="btn btn-primary" id="add-class-btn">' + icon('plus', 16) + ' Nova turma</button></div>' +
      '<div class="grid-2">' + cards + '</div>' +
      '</div>'
    );
  }

  // ===== CreateStore requests =====
  function storeProducts(icon, D) {
    var products = D.storeProducts || [];
    var cards = products.map(function (product) {
      var unlimited = product.inventoryMode === 'unlimited';
      var soldOut = Boolean(product.soldOut);
      var available = Number(product.availableQuantity || 0);
      var inventoryText = unlimited ? 'Ilimitado' : soldOut ? 'Esgotado' : available + (available === 1 ? ' disponível' : ' disponíveis');
      if (!unlimited && Number(product.reservedQuantity || 0) > 0) inventoryText += ' · ' + product.reservedQuantity + ' reservados';
      return '<article class="admin-product-card" data-admin-product-card data-search="' + (product.name + ' ' + product.category + ' ' + product.description).toLowerCase() + '" data-product-status="' + product.status + '"><div class="admin-product-image">' + (product.imageUrl ? '<img src="' + product.imageUrl + '" alt="' + product.name + '" />' : icon('box', 38)) + '<span class="badge ' + (product.status === 'active' ? 'badge-green' : 'badge-gray') + '">' + (product.status === 'active' ? 'Ativo' : 'Inativo') + '</span></div><div class="admin-product-copy"><span class="store-category">' + product.category + '</span><h3>' + product.name + '</h3><p>' + product.description + '</p><div class="admin-product-meta"><strong>' + joyLabel(product.priceJoys) + '</strong><span class="store-stock ' + (soldOut ? 'sold-out' : '') + '">' + inventoryText + '</span></div><button class="btn btn-outline" data-store-product-edit="' + product.id + '">' + icon('edit', 14) + ' Editar produto</button></div></article>';
    }).join('');
    if (!cards) cards = '<div class="card empty-state">Nenhum produto cadastrado.</div>';
    return '<div class="animate-fade"><section class="store-products-admin-hero"><div><span class="store-kicker">CATÁLOGO DA CREATESTORE</span><h2>Produtos, valores e estoque</h2><p>Produtos ilimitados não reduzem estoque. Produtos exclusivos usam uma quantidade limitada e ficam indisponíveis automaticamente ao chegar a zero.</p></div><button class="btn btn-primary" id="add-store-product">' + icon('plus', 15) + ' Novo produto exclusivo</button></section><div class="card admin-list-toolbar mb-4"><div class="search-wrapper flex-1">' + icon('search', 16) + '<input class="search-input" id="admin-product-search" placeholder="Buscar produto ou categoria..." /></div><select class="form-select" id="admin-product-status"><option value="all">Todos</option><option value="active">Ativos</option><option value="inactive">Inativos</option></select></div><div class="admin-products-grid">' + cards + '</div><div class="card empty-state" id="admin-product-empty" style="display:none">Nenhum produto corresponde aos filtros.</div><div class="list-pagination" id="admin-product-pagination"><button class="btn btn-outline btn-sm" data-page-prev>Anterior</button><span data-page-info></span><button class="btn btn-outline btn-sm" data-page-next>Próxima</button></div></div>';
  }

  function openStoreProductModal(product, D, navigate) {
    var item = product || { name: '', description: '', category: '', priceJoys: '', inventoryMode: 'limited', stockQuantity: 1, status: 'active', sortOrder: (D.storeProducts || []).length + 1, imageUrl: null };
    var modal = document.createElement('div');
    modal.className = 'admin-modal-backdrop';
    modal.innerHTML = '<section class="admin-modal store-product-modal" role="dialog" aria-modal="true"><div class="admin-modal-header"><div><span class="admin-form-kicker">CREATESTORE</span><h2>' + (product ? 'Editar produto' : 'Novo produto exclusivo') + '</h2><p class="text-sm text-muted">Cadastre a imagem, o valor e a disponibilidade.</p></div><button class="btn btn-ghost btn-icon" type="button" data-product-modal-close>' + window.Icons.render('x', 18) + '</button></div><form id="store-product-form"><div class="admin-modal-body"><div class="store-product-form-grid"><div><div class="form-group"><label class="form-label">Nome</label><input class="form-input" id="store-product-name" maxlength="120" required value="' + item.name + '" /></div><div class="form-group"><label class="form-label">Categoria</label><input class="form-input" id="store-product-category" maxlength="60" required value="' + item.category + '" placeholder="Ex.: Item exclusivo" /></div><div class="form-group"><label class="form-label">Descrição</label><textarea class="form-textarea" id="store-product-description" maxlength="500" rows="4" required>' + item.description + '</textarea></div></div><div><label class="store-product-image-picker" for="store-product-image"><span id="store-product-image-preview">' + (item.imageUrl ? '<img src="' + item.imageUrl + '" alt="Imagem atual" />' : window.Icons.render('image', 28)) + '</span><strong>' + (item.imageUrl ? 'Trocar imagem' : 'Escolher imagem') + '</strong><small>JPG, PNG ou WebP · até 1,5 MB</small></label><input id="store-product-image" type="file" accept="image/jpeg,image/png,image/webp" hidden ' + (product ? '' : 'required') + ' /></div></div><div class="grid-2"><div class="form-group"><label class="form-label">Valor em Joys</label><input class="form-input" id="store-product-price" type="number" min="1" max="1000000" step="1" required value="' + item.priceJoys + '" /></div><div class="form-group"><label class="form-label">Ordem no catálogo</label><input class="form-input" id="store-product-order" type="number" min="1" step="1" value="' + item.sortOrder + '" required /></div><div class="form-group"><label class="form-label">Disponibilidade</label><select class="form-select" id="store-product-inventory"><option value="limited"' + (item.inventoryMode === 'limited' ? ' selected' : '') + '>Limitado por estoque</option><option value="unlimited"' + (item.inventoryMode === 'unlimited' ? ' selected' : '') + '>Ilimitado</option></select></div><div class="form-group" id="store-product-stock-group"><label class="form-label">Quantidade em estoque</label><input class="form-input" id="store-product-stock" type="number" min="0" max="100000" step="1" value="' + (item.stockQuantity == null ? 0 : item.stockQuantity) + '" /><span class="form-help">Ao chegar a zero, o produto aparecerá como esgotado.</span></div><div class="form-group"><label class="form-label">Situação</label><select class="form-select" id="store-product-status"><option value="active"' + (item.status === 'active' ? ' selected' : '') + '>Ativo no catálogo</option><option value="inactive"' + (item.status === 'inactive' ? ' selected' : '') + '>Inativo</option></select></div></div><div class="admin-form-error" id="store-product-error" hidden></div></div><div class="admin-modal-footer"><button class="btn btn-ghost" type="button" data-product-modal-close>Cancelar</button><button class="btn btn-primary" type="submit">Salvar produto</button></div></form></section>';
    document.body.appendChild(modal);
    function close() { modal.remove(); }
    modal.querySelectorAll('[data-product-modal-close]').forEach(function (button) { button.addEventListener('click', close); });
    modal.addEventListener('click', function (event) { if (event.target === modal) close(); });
    var inventory = modal.querySelector('#store-product-inventory');
    var stockGroup = modal.querySelector('#store-product-stock-group');
    function updateStockVisibility() { stockGroup.style.display = inventory.value === 'limited' ? 'block' : 'none'; }
    inventory.addEventListener('change', updateStockVisibility); updateStockVisibility();
    var imageInput = modal.querySelector('#store-product-image');
    imageInput.addEventListener('change', function () {
      if (!imageInput.files.length) return;
      var file = imageInput.files[0];
      if (file.size > 1572864) { window.CreateJoyUI.alert('A imagem deve ter no máximo 1,5 MB.', 'error'); imageInput.value = ''; return; }
      var reader = new FileReader();
      reader.onload = function () { modal.querySelector('#store-product-image-preview').innerHTML = '<img src="' + reader.result + '" alt="Prévia" />'; };
      reader.readAsDataURL(file);
    });
    modal.querySelector('#store-product-form').addEventListener('submit', async function (event) {
      event.preventDefault();
      var formData = new FormData();
      if (product) formData.append('id', product.id);
      formData.append('name', modal.querySelector('#store-product-name').value.trim());
      formData.append('category', modal.querySelector('#store-product-category').value.trim());
      formData.append('description', modal.querySelector('#store-product-description').value.trim());
      formData.append('price_joys', modal.querySelector('#store-product-price').value);
      formData.append('sort_order', modal.querySelector('#store-product-order').value);
      formData.append('inventory_mode', inventory.value);
      formData.append('stock_quantity', modal.querySelector('#store-product-stock').value);
      formData.append('status', modal.querySelector('#store-product-status').value);
      if (imageInput.files.length) formData.append('image', imageInput.files[0]);
      var submit = event.currentTarget.querySelector('button[type="submit"]');
      var errorBox = modal.querySelector('#store-product-error');
      submit.disabled = true; errorBox.hidden = true;
      try {
        var payload = await window.CreateJoyApi.saveStoreProduct(formData);
        window.CreateJoyApp.updateData(payload.data); close(); window.CreateJoyUI.toast(payload.message, 'success'); navigate('store-products');
      } catch (error) { errorBox.textContent = error.message; errorBox.hidden = false; submit.disabled = false; }
    });
  }

  function storeRequests(icon, D) {
    var requests = D.storeRequests || [];
    var pending = requests.filter(function (request) { return request.status === 'pending'; });
    var approved = requests.filter(function (request) { return request.status === 'approved'; });
    var rejected = requests.filter(function (request) { return request.status === 'rejected'; });
    var joysDeducted = approved.reduce(function (total, request) { return total + Number(request.totalJoys || 0); }, 0);
    var statusMap = {
      pending: { label: 'Pendente', badge: 'badge-yellow', icon: 'clock' },
      approved: { label: 'Aprovada', badge: 'badge-green', icon: 'checkCircle' },
      rejected: { label: 'Recusada', badge: 'badge-red', icon: 'x' },
      cancelled: { label: 'Cancelada pelo aluno', badge: 'badge-gray', icon: 'x' },
    };

    var statCards = [
      { label: 'Aguardando análise', value: pending.length, icon: 'clock', color: 'yellow' },
      { label: 'Aprovadas', value: approved.length, icon: 'checkCircle', color: 'green' },
      { label: 'Joys retirados', value: joysDeducted, icon: 'coins', color: 'orange' },
      { label: 'Recusadas', value: rejected.length, icon: 'x', color: 'blue' },
    ].map(function (stat) {
      return '<div class="stat-card"><div class="stat-icon ' + stat.color + '">' + icon(stat.icon, 21) + '</div><div><div class="stat-value">' + stat.value + '</div><div class="stat-label">' + stat.label + '</div></div></div>';
    }).join('');

    var requestCards = requests.map(function (request) {
      var status = statusMap[request.status] || statusMap.pending;
      var canApprove = Number(request.studentBalance) >= Number(request.totalJoys);
      return (
        '<article class="store-admin-request" data-store-admin-status="' + request.status + '" data-store-admin-search="' + (request.studentName + ' ' + request.productName + ' ' + request.details).toLowerCase() + '">' +
        '<div class="store-admin-avatar">' + request.studentName.split(' ').map(function (part) { return part.charAt(0); }).slice(0, 2).join('').toUpperCase() + '</div>' +
        '<div class="store-admin-request-main">' +
        '<div class="store-admin-request-head"><div><h4>' + request.studentName + '</h4><span class="text-sm text-muted">Solicitou ' + request.productName + '</span></div><span class="badge ' + status.badge + '">' + icon(status.icon, 13) + ' ' + status.label + '</span></div>' +
        '<div class="store-admin-details"><span>Detalhes do pedido</span><p>' + request.details + '</p></div>' +
        (request.reviewNotes ? '<div class="store-review-note"><strong>Observação da análise:</strong> ' + request.reviewNotes + '</div>' : '') +
        '<div class="store-admin-meta"><span>Pedido #' + request.id + '</span><span>Solicitado em ' + request.requestedAt + '</span>' +
        (request.reviewerName ? '<span>Analisado por ' + request.reviewerName + (request.reviewedAt ? ' em ' + request.reviewedAt : '') + '</span>' : '') + '</div>' +
        '</div>' +
        '<aside class="store-admin-request-side"><div class="store-admin-cost"><span>Custo</span><strong>' + joyLabel(request.totalJoys) + '</strong></div><div class="store-admin-balance"><span>Saldo atual do aluno</span><strong>' + joyLabel(request.studentBalance) + '</strong></div>' +
        (request.status === 'pending' ? '<div class="store-admin-actions"><button class="btn btn-primary btn-sm" data-store-review="approved" data-id="' + request.id + '" ' + (!canApprove ? 'disabled title="Saldo insuficiente"' : '') + '>' + icon('checkCircle', 14) + ' Aprovar e retirar</button><button class="btn btn-outline btn-sm" data-store-review="rejected" data-id="' + request.id + '">' + icon('x', 14) + ' Recusar</button></div>' : '') +
        (!canApprove && request.status === 'pending' ? '<span class="store-balance-warning">Saldo insuficiente para aprovar</span>' : '') +
        '</aside></article>'
      );
    }).join('');
    if (!requestCards) requestCards = '<div class="card empty-state">Nenhuma solicitação de compra foi feita.</div>';

    return (
      '<div class="animate-fade store-admin-page">' +
      '<div class="store-admin-intro card mb-6"><div><span class="store-kicker">CONTROLE DA CREATESTORE</span><h2>Solicitações de compra</h2><p>Analise os pedidos. Ao aprovar, o sistema retira o valor do produto do saldo do aluno e registra a movimentação no extrato.</p></div><div class="store-admin-safety">' + icon('checkCircle', 20) + '<span>Desconto protegido contra duplicação</span></div></div>' +
      '<div class="grid-4 mb-6">' + statCards + '</div>' +
      '<div class="card admin-list-toolbar mb-4"><div class="search-wrapper flex-1">' + icon('search', 16) + '<input class="search-input" id="store-request-search" placeholder="Buscar aluno, produto ou detalhes..." /></div><label class="store-filter-label">Mostrar <select class="form-select" id="store-request-filter"><option value="all">Todos</option><option value="pending">Pendentes</option><option value="approved">Aprovados</option><option value="rejected">Recusados</option><option value="cancelled">Cancelados</option></select></label></div>' +
      '<div class="store-admin-list" id="store-admin-list">' + requestCards + '</div>' +
      '<div class="card empty-state" id="store-admin-filter-empty" style="display:none">Nenhuma solicitação neste status.</div>' +
      '<div class="list-pagination" id="store-request-pagination"><button class="btn btn-outline btn-sm" data-page-prev>Anterior</button><span data-page-info></span><button class="btn btn-outline btn-sm" data-page-next>Próxima</button></div>' +
      '</div>'
    );
  }

  function openStoreReviewModal(request, decision, navigate) {
    var approving = decision === 'approved';
    var balanceAfter = Number(request.studentBalance) - Number(request.totalJoys);
    var modal = document.createElement('div');
    modal.className = 'admin-modal-backdrop';
    modal.innerHTML =
      '<div class="admin-modal store-review-modal" role="dialog" aria-modal="true" aria-labelledby="store-review-title">' +
      '<div class="admin-modal-header"><div><h2 id="store-review-title">' + (approving ? 'Aprovar solicitação' : 'Recusar solicitação') + '</h2><p class="text-sm text-muted">Pedido #' + request.id + ' · ' + request.studentName + '</p></div><button class="btn btn-ghost btn-icon" type="button" data-store-modal-close aria-label="Fechar">' + window.Icons.render('x', 18) + '</button></div>' +
      '<form id="store-review-form"><div class="admin-modal-body">' +
      '<div class="store-review-summary"><div><span>Produto</span><strong>' + request.productName + '</strong></div><div><span>Valor</span><strong>' + joyLabel(request.totalJoys) + '</strong></div><div><span>Saldo atual</span><strong>' + joyLabel(request.studentBalance) + '</strong></div>' +
      (approving ? '<div class="store-review-balance-after"><span>Saldo após aprovação</span><strong>' + joyLabel(balanceAfter) + '</strong></div>' : '') + '</div>' +
      '<div class="store-admin-details mt-4"><span>Pedido do aluno</span><p>' + request.details + '</p></div>' +
      '<div class="form-group mt-4"><label class="form-label" for="store-review-notes">' + (approving ? 'Observação (opcional)' : 'Motivo da recusa') + '</label><textarea class="form-textarea" id="store-review-notes" rows="4" maxlength="1000" ' + (approving ? '' : 'required') + ' placeholder="' + (approving ? 'Ex.: Impressão agendada para sexta-feira.' : 'Explique ao aluno por que o pedido foi recusado.') + '"></textarea></div>' +
      '<div class="store-policy-note ' + (approving ? '' : 'store-policy-warning') + '">' + window.Icons.render(approving ? 'coins' : 'x', 17) + '<span>' + (approving ? 'Ao confirmar, ' + joyLabel(request.totalJoys) + ' serão retirados imediatamente e a operação ficará registrada.' : 'A recusa não altera o saldo de Joys do aluno.') + '</span></div>' +
      '<div class="admin-form-error" id="store-review-error" hidden></div></div>' +
      '<div class="admin-modal-footer"><button type="button" class="btn btn-ghost" data-store-modal-close>Cancelar</button><button type="submit" class="btn ' + (approving ? 'btn-primary' : 'btn-danger') + '">' + (approving ? window.Icons.render('checkCircle', 15) + ' Aprovar e retirar Joys' : window.Icons.render('x', 15) + ' Confirmar recusa') + '</button></div></form></div>';
    document.body.appendChild(modal);

    function close() { modal.remove(); }
    modal.querySelectorAll('[data-store-modal-close]').forEach(function (button) { button.addEventListener('click', close); });
    modal.addEventListener('click', function (event) { if (event.target === modal) close(); });
    var notes = modal.querySelector('#store-review-notes');
    notes.focus();
    modal.querySelector('#store-review-form').addEventListener('submit', async function (event) {
      event.preventDefault();
      var submitButton = event.currentTarget.querySelector('button[type="submit"]');
      var errorBox = modal.querySelector('#store-review-error');
      submitButton.disabled = true;
      errorBox.hidden = true;
      try {
        var payload = await window.CreateJoyApi.reviewStorePurchase(request.id, decision, notes.value.trim());
        window.CreateJoyApp.updateData(payload.data);
        close();
        navigate('store-requests');
      } catch (error) {
        errorBox.textContent = error.message;
        errorBox.hidden = false;
        submitButton.disabled = false;
      }
    });
  }

  function isRenewalConfirmedAwaitingContract(contract) {
    return contract.renewalStatus === 'confirmed'
      && contract.billingAction === 'renew_contract'
      && ['pending', 'renewal_due'].indexOf(contract.contractStatus) !== -1;
  }

  function contractHasRenewalPending(contract) {
    var renewalConfirmed = contract.renewalStatus === 'confirmed' || contract.renewalStatus === 'completed';
    var contractStatusPending = ['blank', 'pending', 'renewal_due', 'expired'].indexOf(contract.contractStatus) !== -1;
    var contractActionPending = contract.billingAction === 'renew_contract' || contract.billingAction === 'contact_guardian';
    var contractDatePending = contract.daysToExpiry !== null && contract.daysToExpiry <= 60 && !renewalConfirmed;
    return contractStatusPending || contractActionPending || contractDatePending;
  }

  function reenrollmentAttentionState(contract) {
    var notContinuing = contract.contractStatus === 'not_renewing'
      || contract.contractStatus === 'rescinded'
      || contract.renewalStatus === 'declined';
    if (notContinuing) return 'not-continuing';
    if (isRenewalConfirmedAwaitingContract(contract)) return 'renewal-confirmed';

    var contractPending = contractHasRenewalPending(contract);
    var pendingReminders = (contract.reminders || []).filter(function (item) { return item.status === 'pending'; });
    var cardReminderPending = pendingReminders.some(function (item) { return item.type === 'charge_card' || item.type === 'send_card_link'; });
    var otherReminderPending = pendingReminders.some(function (item) {
      return item.type !== 'charge_card'
        && item.type !== 'send_card_link'
        && item.type !== 'issue_boleto';
    });
    var cardActionPending = contract.billingAction === 'charge_card' || contract.billingAction === 'send_card_link';
    var cardDatePending = contract.paymentMethod === 'card'
      && contract.paymentDaysToExpiry !== null
      && contract.paymentDaysToExpiry <= 60;
    var cardPending = cardActionPending || cardDatePending || cardReminderPending;
    var enrollmentFeePending = contract.enrollmentFeeRequired === true
      && contract.enrollmentFeeDaysToExpiry !== null
      && contract.enrollmentFeeDaysToExpiry <= 60;

    if (contractPending) return 'neutral';
    if (cardPending || enrollmentFeePending) return 'payment-pending';
    if (otherReminderPending) return 'neutral';
    return 'clear';
  }

  function reenrollmentWorkflowCounts(contracts) {
    var counts = { pending: 0, confirmed: 0, paymentOnly: 0, renewal: 0, awaitingContract: 0, stopped: 0 };
    (contracts || []).forEach(function (contract) {
      var state = reenrollmentAttentionState(contract);
      if (state === 'neutral' || state === 'payment-pending' || state === 'renewal-confirmed') counts.pending++;
      if (state === 'clear') counts.confirmed++;
      if (state === 'payment-pending') counts.paymentOnly++;
      if (state === 'renewal-confirmed') counts.awaitingContract++;
      if (state !== 'not-continuing' && state !== 'renewal-confirmed' && contractHasRenewalPending(contract)) counts.renewal++;
      if (state === 'not-continuing') counts.stopped++;
    });
    return counts;
  }

  function reenrollment(icon, D) {
    var data = D.reenrollment || { available: false, contracts: [], analytics: {}, notifications: [] };
    var contracts = data.contracts || [];
    var analytics = data.analytics || {};
    var methods = analytics.paymentMethods || {};
    var statusMap = {
      blank: { label: 'Cadastro em branco', badge: 'badge-gray' },
      active: { label: 'Contrato ativo', badge: 'badge-green' },
      pending: { label: 'Pendente', badge: 'badge-yellow' },
      renewal_due: { label: 'Renovar', badge: 'badge-orange' },
      renewed: { label: 'Renovado', badge: 'badge-green' },
      expired: { label: 'Vencido', badge: 'badge-red' },
      rescinded: { label: 'Rescindido', badge: 'badge-red' },
      not_renewing: { label: 'Não vai renovar', badge: 'badge-gray' },
    };
    var paymentMap = { card: 'Cartão', boleto: 'Boleto', cash: 'À vista', scholarship: 'Bolsista', other: 'Outro' };
    var billingMap = { none: 'Nenhuma ação', issue_boleto: 'Emitir carnê/boleto', charge_card: 'Passar cartão', send_card_link: 'Enviar link', renew_contract: 'Renovar contrato', contact_guardian: 'Contatar responsável' };
    var hasRenewalPending = contractHasRenewalPending;
    var attentionState = reenrollmentAttentionState;
    var statCards = [
      { label: 'Alunos acompanhados', value: analytics.totalStudents || 0, icon: 'users', color: 'blue' },
      { label: 'Cadastros em branco', value: analytics.blank || 0, icon: 'fileText', color: 'yellow' },
      { label: 'Renovar em até 1 mês', value: analytics.renewalDue || 0, icon: 'calendar', color: 'orange' },
      { label: 'Contratos vencidos', value: analytics.expired || 0, icon: 'alertTriangle', color: 'blue' },
      { label: 'Boletos a gerar', value: analytics.boletoDue || 0, icon: 'fileText', color: 'green' },
      { label: 'Cartões a passar', value: analytics.cardDue || 0, icon: 'clock', color: 'orange' },
      { label: 'Taxas em até 2 meses', value: analytics.enrollmentFeeDue || 0, icon: 'calendar', color: 'blue' },
    ].map(function (stat) {
      return '<div class="stat-card"><div class="stat-icon ' + stat.color + '">' + icon(stat.icon, 21) + '</div><div><div class="stat-value">' + stat.value + '</div><div class="stat-label">' + stat.label + '</div></div></div>';
    }).join('');

    var paymentItems = [
      { key: 'card', label: 'Cartão', color: '#1E72B8' },
      { key: 'boleto', label: 'Boleto', color: '#F26522' },
      { key: 'cash', label: 'À vista', color: '#22C55E' },
      { key: 'other', label: 'Outro/Bolsista', color: '#8B5CF6' },
      { key: 'not_informed', label: 'Não informado', color: '#94A3B8' },
    ];
    var paymentTotal = Math.max(1, paymentItems.reduce(function (sum, item) { return sum + Number(methods[item.key] || 0); }, 0));
    var paymentChart = paymentItems.map(function (item) {
      var value = Number(methods[item.key] || 0);
      var width = Math.round(value * 100 / paymentTotal);
      return '<div class="reenrollment-bar-row"><div><span>' + item.label + '</span><strong>' + value + '</strong></div><div class="reenrollment-bar"><i style="width:' + width + '%;background:' + item.color + '"></i></div></div>';
    }).join('');

    var workflowCounts = reenrollmentWorkflowCounts(contracts);
    var workflowTotal = Math.max(1, contracts.length);
    var workflowChart = [
      { label: 'Pendentes no total', value: workflowCounts.pending, color: '#64748b' },
      { label: 'Sem pendência / rematriculado', value: workflowCounts.confirmed, color: '#22c55e' },
      { label: 'Falta apenas pagamento', value: workflowCounts.paymentOnly, color: '#eab308' },
      { label: 'Precisam confirmar renovação', value: workflowCounts.renewal, color: '#f97316' },
      { label: 'Confirmaram — criar contrato', value: workflowCounts.awaitingContract, color: '#3b82f6' },
      { label: 'Não vão continuar', value: workflowCounts.stopped, color: '#ef4444' },
    ].map(function (item) {
      var width = Math.round(item.value * 100 / workflowTotal);
      return '<div class="reenrollment-bar-row"><div><span>' + item.label + '</span><strong>' + item.value + '</strong></div><div class="reenrollment-bar"><i style="width:' + width + '%;background:' + item.color + '"></i></div></div>';
    }).join('');

    var dueReminders = [];
    contracts.forEach(function (contract) {
      (contract.reminders || []).forEach(function (reminder) {
        if (reminder.status === 'pending') dueReminders.push({ contract: contract, reminder: reminder });
      });
    });
    dueReminders.sort(function (left, right) { return String(left.reminder.dueAt).localeCompare(String(right.reminder.dueAt)); });
    var actionItems = (data.notifications || []).filter(function (notification) {
      return String(notification.key || '').indexOf('contract-reminder:') !== 0;
    }).map(function (notification) {
      return {
        kind: 'automatic',
        dueAt: notification.dueAt || '',
        isOverdue: Boolean(notification.isOverdue),
        title: notification.title,
        studentName: notification.text,
        meta: notification.meta,
        icon: notification.icon || 'calendar',
        studentId: notification.studentId,
      };
    });
    dueReminders.forEach(function (entry) {
      actionItems.push({
        kind: 'reminder',
        dueAt: entry.reminder.dueAt,
        isOverdue: Boolean(entry.reminder.isOverdue),
        title: entry.reminder.title,
        studentName: entry.contract.studentName,
        meta: dateLabel(entry.reminder.dueAt, true),
        icon: entry.reminder.isOverdue ? 'alertTriangle' : 'clock',
        reminderId: entry.reminder.id,
        studentId: entry.contract.studentId,
      });
    });
    actionItems.sort(function (left, right) { return String(left.dueAt || '').localeCompare(String(right.dueAt || '')); });
    var overdueActions = actionItems.filter(function (item) { return item.isOverdue; }).length;
    var remindersHtml = actionItems.map(function (entry) {
      var actionButton = entry.kind === 'reminder'
        ? '<button class="btn btn-ghost btn-sm" data-reenrollment-reminder-complete="' + entry.reminderId + '">Concluir</button>'
        : '<button class="btn btn-ghost btn-sm" data-reenrollment-action-open="' + entry.studentId + '">Ver aluno</button>';
      return '<article class="reenrollment-alert ' + (entry.isOverdue ? 'overdue' : '') + '"><div class="reenrollment-alert-icon">' + icon(entry.icon, 17) + '</div><div><strong>' + escapeHtml(entry.title) + '</strong><span>' + escapeHtml(entry.studentName) + ' · ' + escapeHtml(entry.meta || dateLabel(entry.dueAt, true)) + '</span></div>' + actionButton + '</article>';
    }).join('');
    if (!remindersHtml) remindersHtml = '<div class="empty-state compact">Nenhuma próxima ação ou notificação.</div>';

    var rows = contracts.map(function (contract) {
      var status = statusMap[contract.contractStatus] || statusMap.blank;
      var attention = attentionState(contract);
      var expiry = contract.endDate ? dateLabel(contract.endDate, false) : 'A cadastrar';
      var expiryNote = contract.daysToExpiry === null ? '' : contract.daysToExpiry < 0
        ? '<span class="reenrollment-expiry danger">Vencido há ' + Math.abs(contract.daysToExpiry) + ' dias</span>'
        : contract.daysToExpiry <= 60 ? '<span class="reenrollment-expiry warning">Faltam ' + contract.daysToExpiry + ' dias</span>' : '';
      var feeLabel = contract.enrollmentFeeRequired === true ? 'Sim' : contract.enrollmentFeeRequired === false ? 'Não' : 'Não informado';
      var feeDate = contract.enrollmentFeeRequired === true && contract.enrollmentFeeNextDate
        ? '<span class="text-xs text-muted" style="display:block">Próxima: ' + dateLabel(contract.enrollmentFeeNextDate, false) + '</span>'
        : '';
      var search = [contract.studentName, contract.studentEmail, contract.className, paymentMap[contract.paymentMethod] || '', status.label].join(' ').toLowerCase();
      return '<tr class="reenrollment-row-' + attention + '" data-reenrollment-row data-attention="' + attention + '" data-search="' + escapeHtml(search) + '" data-contract-status="' + escapeHtml(contract.contractStatus) + '" data-payment-method="' + escapeHtml(contract.paymentMethod || 'not_informed') + '" data-billing-action="' + escapeHtml(contract.billingAction || 'none') + '">' +
        '<td><div><span class="font-semibold">' + escapeHtml(contract.studentName) + '</span><span class="text-xs text-muted" style="display:block">' + escapeHtml(contract.className) + '</span></div></td>' +
        '<td><span class="badge ' + status.badge + '">' + status.label + '</span>' + (contract.sourceImported ? '<span class="reenrollment-source">Planilha 2026 · pág. ' + contract.sourcePage + '</span>' : '') + '</td>' +
        '<td><strong class="text-sm">' + (paymentMap[contract.paymentMethod] || 'Não informado') + '</strong><span class="text-xs text-muted" style="display:block">' + (billingMap[contract.billingAction] || 'Nenhuma ação') + '</span></td>' +
        '<td><strong class="text-sm">' + feeLabel + '</strong>' + feeDate + '</td>' +
        '<td><span class="text-sm">' + expiry + '</span>' + expiryNote + '</td>' +
        '<td><span class="badge ' + ((contract.reminders || []).some(function (item) { return item.status === 'pending' && item.isOverdue; }) ? 'badge-red' : 'badge-gray') + '">' + (contract.reminders || []).filter(function (item) { return item.status === 'pending'; }).length + ' lembrete(s)</span><span class="text-xs text-muted" style="display:block;margin-top:4px">' + (contract.followups || []).length + ' follow-up(s)</span></td>' +
        '<td><button class="btn btn-primary btn-sm" data-reenrollment-open="' + contract.studentId + '">' + icon('edit', 14) + ' Ver e editar</button></td></tr>';
    }).join('');
    if (!rows) rows = '<tr><td colspan="7"><div class="empty-state">Nenhum aluno cadastrado.</div></td></tr>';

    return '<div class="animate-fade reenrollment-page">' +
      (!data.available ? '<div class="card reenrollment-migration-warning mb-5">' + icon('alertTriangle', 20) + '<div><strong>A atualização do banco ainda não foi aplicada.</strong><span>Execute o arquivo SQL desta atualização para ativar contratos, follow-ups e lembretes.</span></div></div>' : '') +
      '<div class="card reenrollment-hero mb-6"><div><span class="admin-form-kicker">GESTÃO DE CONTRATOS</span><h2>Central de rematrícula</h2><p>Acompanhe contratos, formas de pagamento, conversas com responsáveis e tarefas futuras em um único lugar.</p></div><div class="reenrollment-hero-count"><strong>' + workflowCounts.pending + '</strong><span>processos pendentes</span></div></div>' +
      '<div class="reenrollment-stats mb-6">' + statCards + '</div>' +
      '<div class="card reenrollment-status-chart mb-6"><div class="section-header mb-4"><div><span class="section-title">Situação da rematrícula</span><p class="reenrollment-chart-description">Visão geral calculada pelas mesmas regras de cores da lista.</p></div><span class="badge badge-blue">' + contracts.length + ' aluno(s)</span></div><div class="reenrollment-status-chart-grid">' + workflowChart + '</div><p class="reenrollment-chart-note">“Pendentes no total” inclui quem ainda precisa confirmar, quem já confirmou e aguarda a criação do contrato e quem aguarda somente pagamento. “Não vão continuar” aparece separadamente.</p></div>' +
      '<div class="grid-2 reenrollment-insights-grid mb-6"><div class="card"><div class="section-header mb-4"><span class="section-title">Formas de pagamento</span><span class="badge badge-blue">' + paymentTotal + ' contratos</span></div>' + paymentChart + '</div><div class="card"><div class="section-header mb-4"><span class="section-title">Próximas ações e avisos</span><span class="badge ' + (overdueActions ? 'badge-red' : 'badge-green') + '">' + actionItems.length + ' ação(ões) · ' + overdueActions + ' atrasada(s)</span></div><div class="reenrollment-alerts reenrollment-alerts-scroll">' + remindersHtml + '</div></div></div>' +
      '<div class="card admin-list-toolbar mb-4"><div class="search-wrapper flex-1">' + icon('search', 16) + '<input class="search-input" id="reenrollment-search" placeholder="Buscar aluno, turma ou e-mail..." /></div><select class="form-select" id="reenrollment-status-filter"><option value="all">Todos os contratos</option><option value="blank">Em branco</option><option value="active">Ativos</option><option value="pending">Pendentes</option><option value="renewal_due">A renovar</option><option value="rescinded">Rescindidos</option><option value="not_renewing">Não vão renovar</option></select><select class="form-select" id="reenrollment-payment-filter"><option value="all">Todos os pagamentos</option><option value="card">Cartão</option><option value="boleto">Boleto</option><option value="cash">À vista</option><option value="not_informed">Não informado</option></select><select class="form-select" id="reenrollment-action-filter"><option value="all">Todas as ações</option><option value="issue_boleto">Emitir boleto</option><option value="charge_card">Passar cartão</option><option value="send_card_link">Enviar link</option><option value="contact_guardian">Contatar responsável</option></select></div>' +
      '<div class="reenrollment-color-legend mb-3"><span><i class="neutral"></i>Renovação ou outra pendência</span><span><i class="confirmed"></i>Confirmado — criar contrato</span><span><i class="payment"></i>Somente cartão ou taxa pendente</span><span><i class="clear"></i>Rematriculado</span><span><i class="stopped"></i>Não vai continuar</span></div>' +
      '<div class="card"><div class="table-wrapper"><table class="table reenrollment-table"><thead><tr><th>Aluno</th><th>Contrato</th><th>Pagamento</th><th>Taxa matrícula</th><th>Término</th><th>Acompanhamento</th><th>Ações</th></tr></thead><tbody>' + rows + '</tbody></table></div><div class="empty-state" id="reenrollment-empty" style="display:none">Nenhum contrato corresponde aos filtros.</div></div>' +
      '<div class="list-pagination" id="reenrollment-pagination"><button class="btn btn-outline btn-sm" data-page-prev>Anterior</button><span data-page-info></span><button class="btn btn-outline btn-sm" data-page-next>Próxima</button></div>' +
      '</div>';
  }

  function datetimeLocalValue(value) {
    if (!value) {
      var now = new Date();
      now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
      return now.toISOString().slice(0, 16);
    }
    return String(value).replace(' ', 'T').slice(0, 16);
  }

  function openReenrollmentFollowupModal(contract, existing, navigate, closeParent) {
    var item = existing || {};
    var modal = document.createElement('div');
    modal.className = 'admin-modal-backdrop admin-modal-layer-2';
    modal.innerHTML = '<section class="admin-modal reenrollment-small-modal" role="dialog" aria-modal="true"><div class="admin-modal-header"><div><span class="admin-form-kicker">FOLLOW-UP</span><h2>' + (existing ? 'Editar registro' : 'Registrar conversa') + '</h2><p class="text-sm text-muted">' + escapeHtml(contract.studentName) + '</p></div><button class="btn btn-ghost btn-icon" type="button" data-close>' + window.Icons.render('x', 18) + '</button></div><form id="reenrollment-followup-form"><div class="admin-modal-body"><div class="grid-2"><div class="form-group"><label class="form-label">Data e hora</label><input class="form-input" id="followup-date" type="datetime-local" value="' + datetimeLocalValue(item.contactAt) + '" required /></div><div class="form-group"><label class="form-label">Canal</label><select class="form-select" id="followup-channel"><option value="whatsapp">WhatsApp</option><option value="phone">Telefone</option><option value="email">E-mail</option><option value="in_person">Presencial</option><option value="other">Outro</option><option value="legacy">Histórico importado</option></select></div></div><div class="form-group"><label class="form-label">Mensagem enviada / assunto</label><textarea class="form-textarea" id="followup-message" rows="3" maxlength="5000" placeholder="Ex.: Enviei a proposta de renovação e o link do cartão.">' + escapeHtml(item.sentMessage || '') + '</textarea></div><div class="form-group"><label class="form-label">Resposta da mãe ou responsável</label><textarea class="form-textarea" id="followup-response" rows="3" maxlength="5000" placeholder="Registre exatamente o retorno recebido.">' + escapeHtml(item.guardianResponse || '') + '</textarea></div><div class="form-group"><label class="form-label">Próxima ação</label><textarea class="form-textarea" id="followup-next" rows="2" maxlength="5000" placeholder="Ex.: Reenviar o link na próxima segunda-feira.">' + escapeHtml(item.nextAction || '') + '</textarea></div><div class="admin-form-error" id="followup-error" hidden></div></div><div class="admin-modal-footer"><button type="button" class="btn btn-ghost" data-close>Cancelar</button><button type="submit" class="btn btn-primary">Salvar follow-up</button></div></form></section>';
    document.body.appendChild(modal);
    modal.querySelector('#followup-channel').value = item.channel || 'whatsapp';
    function close() { modal.remove(); }
    modal.querySelectorAll('[data-close]').forEach(function (button) { button.addEventListener('click', close); });
    modal.querySelector('#reenrollment-followup-form').addEventListener('submit', async function (event) {
      event.preventDefault();
      var submit = event.currentTarget.querySelector('button[type="submit"]');
      var errorBox = modal.querySelector('#followup-error');
      submit.disabled = true; errorBox.hidden = true;
      try {
        var payload = await window.CreateJoyApi.saveReenrollmentFollowup({
          id: item.id || null,
          student_id: contract.studentId,
          contact_at: modal.querySelector('#followup-date').value,
          channel: modal.querySelector('#followup-channel').value,
          sent_message: modal.querySelector('#followup-message').value.trim(),
          guardian_response: modal.querySelector('#followup-response').value.trim(),
          next_action: modal.querySelector('#followup-next').value.trim(),
        });
        window.CreateJoyApp.updateData(payload.data); close(); closeParent(); window.CreateJoyUI.toast(payload.message, 'success'); navigate('reenrollment');
      } catch (error) { errorBox.textContent = error.message; errorBox.hidden = false; submit.disabled = false; }
    });
  }

  function openReenrollmentReminderModal(contract, existing, navigate, closeParent) {
    var item = existing || {};
    var modal = document.createElement('div');
    modal.className = 'admin-modal-backdrop admin-modal-layer-2';
    modal.innerHTML = '<section class="admin-modal reenrollment-small-modal" role="dialog" aria-modal="true"><div class="admin-modal-header"><div><span class="admin-form-kicker">LEMBRETE</span><h2>' + (existing ? 'Editar lembrete' : 'Criar lembrete') + '</h2><p class="text-sm text-muted">' + escapeHtml(contract.studentName) + '</p></div><button class="btn btn-ghost btn-icon" type="button" data-close>' + window.Icons.render('x', 18) + '</button></div><form id="reenrollment-reminder-form"><div class="admin-modal-body"><div class="form-group"><label class="form-label">O que precisa ser feito?</label><input class="form-input" id="reminder-title" maxlength="160" required value="' + escapeHtml(item.title || '') + '" placeholder="Ex.: Emitir carnê do próximo semestre" /></div><div class="grid-2"><div class="form-group"><label class="form-label">Data e hora</label><input class="form-input" id="reminder-date" type="datetime-local" value="' + datetimeLocalValue(item.dueAt) + '" required /></div><div class="form-group"><label class="form-label">Tipo</label><select class="form-select" id="reminder-type"><option value="message">Mandar mensagem</option><option value="send_card_link">Enviar link do cartão</option><option value="charge_card">Passar cartão</option><option value="issue_boleto">Emitir carnê/boleto</option><option value="issue_enrollment_fee">Emitir taxa de matrícula</option><option value="renew_contract">Renovar contrato</option><option value="other">Outro</option></select><span class="form-help">Os dois tipos de emissão aparecem automaticamente para o perfil Financeiro.</span></div></div><div class="form-group"><label class="form-label">Observações</label><textarea class="form-textarea" id="reminder-notes" rows="3" maxlength="1000">' + escapeHtml(item.notes || '') + '</textarea></div>' + (existing ? '<div class="form-group"><label class="form-label">Situação</label><select class="form-select" id="reminder-status"><option value="pending">Pendente</option><option value="cancelled">Cancelado</option></select></div>' : '') + '<div class="admin-form-error" id="reminder-error" hidden></div></div><div class="admin-modal-footer"><button type="button" class="btn btn-ghost" data-close>Cancelar</button><button type="submit" class="btn btn-primary">Salvar lembrete</button></div></form></section>';
    document.body.appendChild(modal);
    modal.querySelector('#reminder-notes').closest('.form-group').insertAdjacentHTML('beforebegin', '<section class="financial-reminder-fields" id="financial-reminder-fields" hidden><div class="financial-reminder-heading"><strong>Dados para emissão do carnê</strong><span>Estas informações aparecerão somente para o Financeiro.</span></div><div class="grid-2"><div class="form-group"><label class="form-label">Nome do responsável</label><input class="form-input" id="reminder-responsible" maxlength="120" value="' + escapeHtml(item.responsibleName || contract.guardianName || '') + '" /></div><div class="form-group"><label class="form-label">Quantidade de boletos</label><input class="form-input" id="reminder-installments" type="number" min="1" max="36" step="1" value="' + (item.installmentCount || '') + '" placeholder="Ex.: 6" /></div><div class="form-group"><label class="form-label">Primeiro vencimento</label><input class="form-input" id="reminder-first-due" type="date" value="' + (item.firstDueDate || '') + '" /></div><div class="form-group"><label class="form-label">Dia de vencimento</label><input class="form-input" id="reminder-due-day" type="number" min="1" max="31" step="1" value="' + (item.dueDay || '') + '" placeholder="Ex.: 10" /></div><div class="form-group"><label class="form-label">Cadastrado no Sponte?</label><select class="form-select" id="reminder-sponte"><option value="">Selecione</option><option value="1">Sim, já está cadastrado</option><option value="0">Não está cadastrado</option></select></div></div><p class="financial-reminder-note">O PDF será eliminado automaticamente um mês após o último vencimento calculado pela quantidade de boletos.</p></section>');
    modal.querySelector('#reminder-type').value = item.type || 'message';
    modal.querySelector('#reminder-sponte').value = item.sponteRegistered === true ? '1' : item.sponteRegistered === false ? '0' : '';
    if (modal.querySelector('#reminder-status')) {
      var reminderStatus = item.status === 'completed' ? 'completed' : item.status === 'cancelled' ? 'cancelled' : 'pending';
      if (reminderStatus === 'completed') {
        modal.querySelector('#reminder-status').insertAdjacentHTML('beforeend', '<option value="completed">Concluído</option>');
      }
      modal.querySelector('#reminder-status').value = reminderStatus;
    }
    var typeSelect = modal.querySelector('#reminder-type');
    var financialPanel = modal.querySelector('#financial-reminder-fields');
    var financialInputs = financialPanel.querySelectorAll('input, select');
    function syncFinancialReminderFields() {
      var visible = typeSelect.value === 'issue_boleto';
      financialPanel.hidden = !visible;
      financialInputs.forEach(function (input) { input.required = visible; });
    }
    typeSelect.addEventListener('change', syncFinancialReminderFields);
    modal.querySelector('#reminder-first-due').addEventListener('change', function (event) {
      if (!event.target.value) return;
      modal.querySelector('#reminder-due-day').value = String(Number(event.target.value.slice(-2)));
    });
    syncFinancialReminderFields();
    function close() { modal.remove(); }
    modal.querySelectorAll('[data-close]').forEach(function (button) { button.addEventListener('click', close); });
    modal.querySelector('#reenrollment-reminder-form').addEventListener('submit', async function (event) {
      event.preventDefault();
      var submit = event.currentTarget.querySelector('button[type="submit"]');
      var errorBox = modal.querySelector('#reminder-error');
      submit.disabled = true; errorBox.hidden = true;
      try {
        var payload = await window.CreateJoyApi.saveReenrollmentReminder({
          id: item.id || null,
          student_id: contract.studentId,
          title: modal.querySelector('#reminder-title').value.trim(),
          due_at: modal.querySelector('#reminder-date').value,
          reminder_type: modal.querySelector('#reminder-type').value,
          notes: modal.querySelector('#reminder-notes').value.trim(),
          status: modal.querySelector('#reminder-status') ? modal.querySelector('#reminder-status').value : 'pending',
          responsible_name: modal.querySelector('#reminder-responsible').value.trim(),
          installment_count: modal.querySelector('#reminder-installments').value || null,
          first_due_date: modal.querySelector('#reminder-first-due').value,
          due_day: modal.querySelector('#reminder-due-day').value || null,
          sponte_registered: modal.querySelector('#reminder-sponte').value,
        });
        window.CreateJoyApp.updateData(payload.data); close(); closeParent(); window.CreateJoyUI.toast(payload.message, 'success'); navigate('reenrollment');
      } catch (error) { errorBox.textContent = error.message; errorBox.hidden = false; submit.disabled = false; }
    });
  }

  function openReenrollmentRescissionModal(contract, navigate, closeParent) {
    var modal = document.createElement('div');
    modal.className = 'admin-modal-backdrop admin-modal-layer-2';
    var today = new Date();
    today.setMinutes(today.getMinutes() - today.getTimezoneOffset());
    modal.innerHTML = '<section class="admin-modal reenrollment-small-modal" role="dialog" aria-modal="true"><div class="admin-modal-header"><div><span class="admin-form-kicker">RESCISÃO</span><h2>Registrar rescisão</h2><p class="text-sm text-muted">' + escapeHtml(contract.studentName) + '</p></div><button class="btn btn-ghost btn-icon" type="button" data-close>' + window.Icons.render('x', 18) + '</button></div><form id="reenrollment-rescission-form"><div class="admin-modal-body"><div class="system-dialog-copy"><p>A rescisão mantém todo o histórico e cancela os lembretes pendentes deste contrato.</p></div><div class="form-group"><label class="form-label">Data da rescisão</label><input class="form-input" id="rescission-date" type="date" required value="' + (contract.rescindedAt || today.toISOString().slice(0, 10)) + '" /></div><div class="form-group"><label class="form-label">Motivo</label><textarea class="form-textarea" id="rescission-reason" rows="4" maxlength="1000" required placeholder="Registre o motivo informado pela família.">' + escapeHtml(contract.rescissionReason || '') + '</textarea></div><div class="admin-form-error" id="rescission-error" hidden></div></div><div class="admin-modal-footer"><button type="button" class="btn btn-ghost" data-close>Cancelar</button><button type="submit" class="btn btn-danger">Confirmar rescisão</button></div></form></section>';
    document.body.appendChild(modal);
    function close() { modal.remove(); }
    modal.querySelectorAll('[data-close]').forEach(function (button) { button.addEventListener('click', close); });
    modal.querySelector('#reenrollment-rescission-form').addEventListener('submit', async function (event) {
      event.preventDefault();
      var submit = event.currentTarget.querySelector('button[type="submit"]');
      var errorBox = modal.querySelector('#rescission-error');
      submit.disabled = true; errorBox.hidden = true;
      try {
        var payload = await window.CreateJoyApi.rescindReenrollmentContract(contract.studentId, modal.querySelector('#rescission-date').value, modal.querySelector('#rescission-reason').value.trim());
        window.CreateJoyApp.updateData(payload.data); close(); closeParent(); window.CreateJoyUI.toast(payload.message, 'success'); navigate('reenrollment');
      } catch (error) { errorBox.textContent = error.message; errorBox.hidden = false; submit.disabled = false; }
    });
  }

  function openReenrollmentModal(contract, D, navigate) {
    var modal = document.createElement('div');
    modal.className = 'admin-modal-backdrop';
    var paymentMap = { card: 'Cartão', boleto: 'Boleto', cash: 'À vista', scholarship: 'Bolsista', other: 'Outro' };
    var followups = (contract.followups || []).map(function (item) {
      return '<article class="contract-history-item"><div class="contract-history-marker">' + window.Icons.render(item.channel === 'legacy' ? 'fileText' : 'messageSquare', 15) + '</div><div><div class="contract-history-head"><strong>' + dateLabel(item.contactAt || item.createdAt, true) + '</strong><button class="btn btn-ghost btn-sm" type="button" data-followup-edit="' + item.id + '">' + window.Icons.render('edit', 13) + ' Editar</button></div>' + (item.sentMessage ? '<p><span>Mensagem:</span> ' + escapeHtml(item.sentMessage) + '</p>' : '') + (item.guardianResponse ? '<p><span>Resposta:</span> ' + escapeHtml(item.guardianResponse) + '</p>' : '') + (item.nextAction ? '<p><span>Próxima ação:</span> ' + escapeHtml(item.nextAction) + '</p>' : '') + '</div></article>';
    }).join('') || '<div class="empty-state compact">Nenhum follow-up registrado.</div>';
    var reminderTypes = { message: 'Mensagem', send_card_link: 'Link do cartão', charge_card: 'Passar cartão', issue_boleto: 'Emitir carnê/boleto', issue_enrollment_fee: 'Emitir taxa de matrícula', renew_contract: 'Renovar contrato', other: 'Outro' };
    var reminders = (contract.reminders || []).map(function (item) {
      var financialTask = item.type === 'issue_boleto' || item.type === 'issue_enrollment_fee';
      var boletoData = item.type === 'issue_boleto'
        ? '<div class="contract-reminder-financial"><span>Responsável: <strong>' + escapeHtml(item.responsibleName || '—') + '</strong></span><span>Período: <strong>' + (item.installmentCount || 0) + ' boleto(s)</strong></span><span>Primeiro vencimento: <strong>' + dateLabel(item.firstDueDate, false) + '</strong></span><span>Vencimento: <strong>dia ' + (item.dueDay || '—') + '</strong></span><span>Sponte: <strong>' + (item.sponteRegistered === true ? 'sim' : item.sponteRegistered === false ? 'não' : '—') + '</strong></span></div>'
        : '';
      var attachment = item.attachment
        ? '<a class="finance-task-file compact" href="' + escapeHtml(item.attachment.downloadUrl) + '" target="_blank" rel="noopener">' + window.Icons.render('fileText', 14) + '<span><strong>' + escapeHtml(item.attachment.name) + '</strong><small>Será removido em ' + dateLabel(item.attachment.deleteAfter, false) + '</small></span></a>'
        : item.attachmentDeletedAt ? '<span class="finance-file-expired">PDF removido automaticamente após o prazo.</span>' : '';
      var action = item.status === 'pending'
        ? (financialTask ? '<span class="badge badge-blue">Conclusão pelo Financeiro</span>' : '<button class="btn btn-outline btn-sm" type="button" data-reminder-complete="' + item.id + '">Concluir</button>')
        : '';
      return '<article class="contract-reminder-item ' + (item.isOverdue ? 'overdue' : '') + '"><div><span class="badge ' + (item.status === 'completed' ? 'badge-green' : item.status === 'cancelled' ? 'badge-gray' : item.isOverdue ? 'badge-red' : 'badge-yellow') + '">' + (item.status === 'completed' ? 'Concluído' : item.status === 'cancelled' ? 'Cancelado' : item.isOverdue ? 'Atrasado' : 'Pendente') + '</span><strong>' + escapeHtml(item.title) + '</strong><small>' + (reminderTypes[item.type] || item.type) + ' · ' + dateLabel(item.dueAt, true) + '</small>' + (item.notes ? '<p>' + escapeHtml(item.notes) + '</p>' : '') + boletoData + attachment + '</div><div class="flex gap-1 contract-reminder-actions"><button class="btn btn-ghost btn-icon btn-sm" type="button" data-reminder-edit="' + item.id + '">' + window.Icons.render('edit', 13) + '</button>' + action + '</div></article>';
    }).join('') || '<div class="empty-state compact">Nenhum lembrete criado.</div>';
    var legacy = contract.legacy ? '<details class="contract-legacy"><summary>' + window.Icons.render('fileText', 15) + ' Dados importados da planilha de 2026</summary><div><p><span>Pagamento inicial:</span> ' + escapeHtml(contract.legacy.paymentInitial || '—') + '</p><p><span>Contrato:</span> ' + escapeHtml(contract.legacy.contract || '—') + '</p><p><span>Follow-up:</span> ' + escapeHtml(contract.legacy.followup || '—') + '</p><p><span>Pagamento 2º semestre:</span> ' + escapeHtml(contract.legacy.paymentSecondSemester || '—') + '</p><p><span>Status antigo:</span> ' + escapeHtml(contract.legacy.status || '—') + '</p><small>Fonte: ' + escapeHtml(contract.sourceLabel || '') + ' · página ' + contract.sourcePage + '</small></div></details>' : '';
    var notContinuing = contract.contractStatus === 'not_renewing'
      || contract.contractStatus === 'rescinded'
      || contract.renewalStatus === 'declined';
    var renewalConfirmedAwaitingContract = isRenewalConfirmedAwaitingContract(contract);

    modal.innerHTML = '<section class="admin-modal reenrollment-modal" role="dialog" aria-modal="true"><div class="admin-modal-header"><div><span class="admin-form-kicker">CONTRATO DO ALUNO</span><h2>' + escapeHtml(contract.studentName) + '</h2><p class="text-sm text-muted">' + escapeHtml(contract.className) + ' · ' + escapeHtml(contract.studentEmail) + '</p></div><button class="btn btn-ghost btn-icon" type="button" data-contract-close>' + window.Icons.render('x', 18) + '</button></div><div class="admin-modal-body"><form id="reenrollment-contract-form"><div class="contract-section"><div class="contract-section-title"><div><h3>Dados do contrato</h3><p>Preencha as datas exatas para o sistema avisar com dois meses e novamente com um mês de antecedência.</p></div><span class="badge badge-blue">' + (paymentMap[contract.paymentMethod] || 'Pagamento não informado') + '</span></div><div class="reenrollment-form-grid"><div class="form-group"><label class="form-label">Contrato assinado em</label><input class="form-input" id="contract-signed-at" type="date" value="' + (contract.signedAt || '') + '" /></div><div class="form-group"><label class="form-label">Início do contrato</label><input class="form-input" id="contract-start-date" type="date" value="' + (contract.startDate || '') + '" /></div><div class="form-group"><label class="form-label">Duração em meses</label><div class="contract-duration"><input class="form-input" id="contract-duration" type="number" min="1" max="120" value="' + (contract.durationMonths || '') + '" placeholder="Ex.: 6 ou 12" /><button type="button" data-duration="6">6 meses</button><button type="button" data-duration="12">1 ano</button></div></div><div class="form-group"><label class="form-label">Término do contrato</label><input class="form-input" id="contract-end-date" type="date" value="' + (contract.endDate || '') + '" /></div><div class="form-group"><label class="form-label">Forma de pagamento</label><select class="form-select" id="contract-payment"><option value="">Não informado</option><option value="card">Cartão</option><option value="boleto">Boleto</option><option value="cash">À vista</option><option value="scholarship">Bolsista</option><option value="other">Outro</option></select></div><div class="form-group"><label class="form-label">Pagamento atual termina em</label><input class="form-input" id="contract-payment-end" type="date" value="' + (contract.paymentCycleEndDate || '') + '" /><span class="form-help">Use para saber quando passar o cartão ou emitir novos boletos.</span></div><div class="form-group"><label class="form-label">Tem taxa de matrícula?</label><select class="form-select" id="contract-enrollment-fee-required"><option value="">Não informado</option><option value="1">Sim</option><option value="0">Não</option></select></div><div class="form-group"><label class="form-label">Próxima taxa de matrícula</label><input class="form-input" id="contract-enrollment-fee-date" type="date" value="' + (contract.enrollmentFeeNextDate || '') + '" /><span class="form-help">Gera avisos com dois meses, um mês e quando vencer.</span></div><div class="form-group"><label class="form-label">Próxima ação financeira</label><select class="form-select" id="contract-billing"><option value="none">Nenhuma</option><option value="issue_boleto">Emitir boleto</option><option value="charge_card">Passar cartão</option><option value="send_card_link">Enviar link do cartão</option><option value="renew_contract">Renovar contrato</option><option value="contact_guardian">Contatar responsável</option></select></div><div class="form-group"><label class="form-label">Situação do contrato</label><select class="form-select" id="contract-status"><option value="blank">Cadastro em branco</option><option value="active">Ativo</option><option value="pending">Pendente</option><option value="renewal_due">Precisa renovar</option><option value="renewed">Renovado</option><option value="expired">Vencido</option><option value="not_renewing">Não vai renovar</option><option value="rescinded">Rescindido</option></select></div><div class="form-group"><label class="form-label">Situação da rematrícula</label><select class="form-select" id="contract-renewal"><option value="not_started">Não iniciada</option><option value="contacted">Responsável contatado</option><option value="awaiting">Aguardando resposta</option><option value="confirmed">Confirmada</option><option value="completed">Concluída</option><option value="declined">Recusada</option></select></div></div><label class="contract-continuation-check"><input type="checkbox" id="contract-not-continuing" ' + (notContinuing ? 'checked ' : '') + (contract.contractStatus === 'rescinded' ? 'disabled ' : '') + '/><span><strong>Aluno não vai continuar</strong><small>Marque somente quando a família confirmar que não fará a renovação. A linha ficará vermelha.</small></span></label><div class="form-group"><label class="form-label">Observações gerais</label><textarea class="form-textarea" id="contract-notes" rows="3" maxlength="5000">' + escapeHtml(contract.notes || '') + '</textarea></div><div class="admin-form-error" id="contract-error" hidden></div><div class="contract-form-actions"><button class="btn btn-primary" type="submit">' + window.Icons.render('save', 15) + ' Salvar contrato</button>' + (contract.contractStatus !== 'rescinded' ? '<button class="btn btn-outline contract-rescind-button" type="button" id="contract-rescind">Registrar rescisão</button>' : '<span class="badge badge-red">Rescindido em ' + dateLabel(contract.rescindedAt, false) + '</span>') + '</div></div></form><div class="contract-section"><div class="contract-section-title"><div><h3>Follow-ups</h3><p>Histórico de mensagens, respostas e próximos passos.</p></div><button class="btn btn-outline btn-sm" type="button" id="contract-add-followup">' + window.Icons.render('plus', 14) + ' Novo follow-up</button></div><div class="contract-history">' + followups + '</div></div><div class="contract-section"><div class="contract-section-title"><div><h3>Lembretes e tarefas</h3><p>Crie avisos para enviar link, passar cartão, emitir boleto ou renovar.</p></div><button class="btn btn-outline btn-sm" type="button" id="contract-add-reminder">' + window.Icons.render('plus', 14) + ' Novo lembrete</button></div><div class="contract-reminders">' + reminders + '</div></div>' + legacy + '</div><div class="admin-modal-footer"><span class="admin-save-hint">O histórico permanece salvo mesmo depois de uma rescisão.</span><button class="btn btn-ghost" type="button" data-contract-close>Fechar</button></div></section>';
    document.body.appendChild(modal);
    modal.querySelector('.contract-continuation-check').insertAdjacentHTML('beforebegin', '<label class="contract-renewal-confirmed-check"><input type="checkbox" id="contract-renewal-confirmed" ' + (renewalConfirmedAwaitingContract ? 'checked ' : '') + (contract.contractStatus === 'rescinded' ? 'disabled ' : '') + '/><span><strong>Responsável confirmou — falta criar o contrato</strong><small>Marque quando a renovação estiver confirmada. A linha ficará azul-clara; desmarque depois que o novo contrato for criado.</small></span></label>');
    function close() { modal.remove(); }
    modal.querySelectorAll('[data-contract-close]').forEach(function (button) { button.addEventListener('click', close); });
    modal.querySelector('#contract-payment').value = contract.paymentMethod || '';
    var billingSelect = modal.querySelector('#contract-billing');
    var statusSelect = modal.querySelector('#contract-status');
    var renewalSelect = modal.querySelector('#contract-renewal');
    var renewalConfirmedCheck = modal.querySelector('#contract-renewal-confirmed');
    var notContinuingCheck = modal.querySelector('#contract-not-continuing');
    billingSelect.value = contract.billingAction || 'none';
    statusSelect.value = contract.contractStatus || 'blank';
    renewalSelect.value = contract.renewalStatus || 'not_started';
    function syncNotContinuing(checked) {
      notContinuingCheck.checked = checked;
      if (checked) {
        renewalConfirmedCheck.checked = false;
        if (statusSelect.value !== 'rescinded') statusSelect.value = 'not_renewing';
        renewalSelect.value = 'declined';
        billingSelect.value = 'none';
      } else {
        if (statusSelect.value === 'not_renewing') statusSelect.value = 'active';
        if (renewalSelect.value === 'declined') renewalSelect.value = 'not_started';
      }
    }
    function syncRenewalConfirmed(checked) {
      renewalConfirmedCheck.checked = checked;
      if (checked) {
        notContinuingCheck.checked = false;
        statusSelect.value = 'pending';
        renewalSelect.value = 'confirmed';
        billingSelect.value = 'renew_contract';
      } else if (statusSelect.value === 'pending' && renewalSelect.value === 'confirmed' && billingSelect.value === 'renew_contract') {
        statusSelect.value = 'renewed';
        renewalSelect.value = 'completed';
        billingSelect.value = 'none';
      }
    }
    renewalConfirmedCheck.addEventListener('change', function () { syncRenewalConfirmed(renewalConfirmedCheck.checked); });
    notContinuingCheck.addEventListener('change', function () { syncNotContinuing(notContinuingCheck.checked); });
    statusSelect.addEventListener('change', function () { if (statusSelect.value === 'not_renewing') syncNotContinuing(true); });
    renewalSelect.addEventListener('change', function () { if (renewalSelect.value === 'declined') syncNotContinuing(true); });
    var enrollmentFeeSelect = modal.querySelector('#contract-enrollment-fee-required');
    var enrollmentFeeDate = modal.querySelector('#contract-enrollment-fee-date');
    enrollmentFeeSelect.value = contract.enrollmentFeeRequired === true ? '1' : contract.enrollmentFeeRequired === false ? '0' : '';
    function syncEnrollmentFeeDate() {
      var hasFee = enrollmentFeeSelect.value === '1';
      enrollmentFeeDate.disabled = !hasFee;
      if (enrollmentFeeSelect.value === '0') enrollmentFeeDate.value = '';
    }
    enrollmentFeeSelect.addEventListener('change', syncEnrollmentFeeDate);
    syncEnrollmentFeeDate();
    function calculateEnd() {
      var start = modal.querySelector('#contract-start-date').value;
      var duration = parseInt(modal.querySelector('#contract-duration').value, 10);
      if (!start || !duration) return;
      var parts = start.split('-').map(Number);
      var date = new Date(parts[0], parts[1] - 1, parts[2], 12);
      date.setMonth(date.getMonth() + duration);
      date.setDate(date.getDate() - 1);
      modal.querySelector('#contract-end-date').value = date.toISOString().slice(0, 10);
    }
    modal.querySelectorAll('[data-duration]').forEach(function (button) { button.addEventListener('click', function () { modal.querySelector('#contract-duration').value = button.getAttribute('data-duration'); calculateEnd(); }); });
    modal.querySelector('#contract-duration').addEventListener('change', calculateEnd);
    modal.querySelector('#contract-start-date').addEventListener('change', calculateEnd);
    modal.querySelector('#reenrollment-contract-form').addEventListener('submit', async function (event) {
      event.preventDefault();
      var submit = event.currentTarget.querySelector('button[type="submit"]');
      var errorBox = modal.querySelector('#contract-error');
      submit.disabled = true; errorBox.hidden = true;
      try {
        var payload = await window.CreateJoyApi.saveReenrollmentContract({ student_id: contract.studentId, contract_signed_at: modal.querySelector('#contract-signed-at').value, contract_start_date: modal.querySelector('#contract-start-date').value, contract_end_date: modal.querySelector('#contract-end-date').value, duration_months: modal.querySelector('#contract-duration').value || null, payment_method: modal.querySelector('#contract-payment').value, payment_cycle_end_date: modal.querySelector('#contract-payment-end').value, enrollment_fee_required: enrollmentFeeSelect.value, enrollment_fee_next_date: enrollmentFeeDate.value, billing_action: notContinuingCheck.checked ? 'none' : renewalConfirmedCheck.checked ? 'renew_contract' : billingSelect.value, contract_status: notContinuingCheck.checked && statusSelect.value !== 'rescinded' ? 'not_renewing' : renewalConfirmedCheck.checked ? 'pending' : statusSelect.value, renewal_status: notContinuingCheck.checked ? 'declined' : renewalConfirmedCheck.checked ? 'confirmed' : renewalSelect.value, notes: modal.querySelector('#contract-notes').value.trim() });
        window.CreateJoyApp.updateData(payload.data); close(); window.CreateJoyUI.toast(payload.message, 'success'); navigate('reenrollment');
      } catch (error) { errorBox.textContent = error.message; errorBox.hidden = false; submit.disabled = false; }
    });
    modal.querySelector('#contract-add-followup').addEventListener('click', function () { openReenrollmentFollowupModal(contract, null, navigate, close); });
    modal.querySelector('#contract-add-reminder').addEventListener('click', function () { openReenrollmentReminderModal(contract, null, navigate, close); });
    if (modal.querySelector('#contract-rescind')) modal.querySelector('#contract-rescind').addEventListener('click', function () { openReenrollmentRescissionModal(contract, navigate, close); });
    modal.querySelectorAll('[data-followup-edit]').forEach(function (button) { button.addEventListener('click', function () { var id = Number(button.getAttribute('data-followup-edit')); var item = (contract.followups || []).filter(function (entry) { return Number(entry.id) === id; })[0]; if (item) openReenrollmentFollowupModal(contract, item, navigate, close); }); });
    modal.querySelectorAll('[data-reminder-edit]').forEach(function (button) { button.addEventListener('click', function () { var id = Number(button.getAttribute('data-reminder-edit')); var item = (contract.reminders || []).filter(function (entry) { return Number(entry.id) === id; })[0]; if (item) openReenrollmentReminderModal(contract, item, navigate, close); }); });
    modal.querySelectorAll('[data-reminder-complete]').forEach(function (button) { button.addEventListener('click', async function () { button.disabled = true; try { var payload = await window.CreateJoyApi.completeReenrollmentReminder(Number(button.getAttribute('data-reminder-complete')), true); window.CreateJoyApp.updateData(payload.data); close(); window.CreateJoyUI.toast(payload.message, 'success'); navigate('reenrollment'); } catch (error) { button.disabled = false; window.CreateJoyUI.alert(error.message, 'error'); } }); });
  }

  // ===== Advanced administration =====
  function administration(icon, D) {
    var currentUser = window.CreateJoyApp.getCurrentUser();
    var statusLabels = { planned: 'Planejado', active: 'Ativo', closed: 'Encerrado', archived: 'Arquivado' };
    var statusBadges = { planned: 'badge-yellow', active: 'badge-green', closed: 'badge-gray', archived: 'badge-gray' };

    var semesterRows = (D.semesters || []).map(function (semester) {
      return '<tr><td><span class="font-semibold">' + semester.name + '</span></td><td class="text-sm text-muted">' + semester.startDate + '</td><td class="text-sm text-muted">' + semester.endDate + '</td><td><span class="badge ' + (statusBadges[semester.status] || 'badge-gray') + '">' + (statusLabels[semester.status] || semester.status) + '</span></td><td><div class="flex gap-1"><button class="btn btn-ghost btn-icon btn-sm" data-advanced-entity="semester" data-advanced-action="edit" data-id="' + semester.id + '" title="Editar">' + icon('edit', 14) + '</button><button class="btn btn-ghost btn-icon btn-sm" data-advanced-entity="semester" data-advanced-action="delete" data-id="' + semester.id + '" title="Arquivar" style="color:var(--error)">' + icon('archive', 14) + '</button></div></td></tr>';
    }).join('');
    if (!semesterRows) semesterRows = '<tr><td colspan="5"><div class="empty-state">Nenhum semestre cadastrado.</div></td></tr>';

    var medalRows = (D.medals || []).map(function (medal) {
      var criteriaLabels = { manual: 'Manual', first_submission: 'Primeira entrega', stl_upload: 'Envio de STL', approved_count: 'Missões aprovadas', module_complete: 'Módulo concluído', progress_percent: 'Percentual de progresso' };
      return '<tr><td><div class="flex items-center gap-2"><span style="font-size:1.4rem">' + (medal.icone || '🏅') + '</span><div><span class="font-semibold">' + medal.nome + '</span><span class="text-xs text-muted" style="display:block">' + medal.descricao + '</span></div></div></td><td class="text-sm">' + (criteriaLabels[medal.criterioTipo] || medal.criterioTipo) + (medal.criterioValor !== null ? ': ' + medal.criterioValor : '') + '</td><td><span class="badge badge-orange">' + medal.joys + ' Joys</span></td><td><span class="badge ' + (medal.status === 'ativa' ? 'badge-green' : 'badge-gray') + '">' + medal.status + '</span></td><td><div class="flex gap-1"><button class="btn btn-ghost btn-icon btn-sm" data-advanced-entity="medal" data-advanced-action="edit" data-id="' + medal.id + '">' + icon('edit', 14) + '</button><button class="btn btn-ghost btn-icon btn-sm" data-advanced-entity="medal" data-advanced-action="delete" data-id="' + medal.id + '" style="color:var(--error)">' + icon('x', 14) + '</button></div></td></tr>';
    }).join('');
    if (!medalRows) medalRows = '<tr><td colspan="5"><div class="empty-state">Nenhuma medalha cadastrada.</div></td></tr>';

    var kitRows = (D.labKits || []).map(function (kit) {
      var components = (kit.items || []).map(function (item) { return item.name + (item.quantity > 1 ? ' ×' + item.quantity : ''); }).join(', ');
      return '<tr><td><div><span class="font-semibold">' + kit.name + '</span><span class="text-xs text-muted" style="display:block">' + (kit.code || 'Sem código') + '</span></div></td><td class="text-sm text-muted">' + (components || 'Nenhum componente') + '</td><td><span class="badge ' + (kit.status === 'active' ? 'badge-green' : 'badge-gray') + '">' + (kit.status === 'active' ? 'ativo' : 'inativo') + '</span></td><td><div class="flex gap-1"><button class="btn btn-ghost btn-icon btn-sm" data-advanced-entity="lab-kit" data-advanced-action="edit" data-id="' + kit.id + '">' + icon('edit', 14) + '</button><button class="btn btn-ghost btn-icon btn-sm" data-advanced-entity="lab-kit" data-advanced-action="delete" data-id="' + kit.id + '" style="color:var(--error)">' + icon('x', 14) + '</button></div></td></tr>';
    }).join('');
    if (!kitRows) kitRows = '<tr><td colspan="4"><div class="empty-state">Nenhum kit cadastrado.</div></td></tr>';

    var assignmentRows = (D.kitAssignments || []).map(function (assignment) {
      var active = assignment.status === 'active';
      return '<tr><td class="font-semibold">' + assignment.studentName + '</td><td>' + assignment.kitName + '</td><td class="text-sm text-muted">' + assignment.moduleName + '</td><td><span class="badge ' + (active ? 'badge-green' : 'badge-gray') + '">' + (active ? 'em uso' : assignment.status) + '</span></td><td class="text-sm text-muted">' + assignment.assignedAt + '</td><td><div class="flex gap-1"><button class="btn btn-ghost btn-icon btn-sm" data-advanced-entity="kit-assignment" data-advanced-action="edit" data-id="' + assignment.id + '">' + icon('edit', 14) + '</button>' + (active ? '<button class="btn btn-ghost btn-sm" data-advanced-entity="kit-assignment" data-advanced-action="delete" data-id="' + assignment.id + '">Registrar devolução</button>' : '') + '</div></td></tr>';
    }).join('');
    if (!assignmentRows) assignmentRows = '<tr><td colspan="6"><div class="empty-state">Nenhum kit vinculado a aluno.</div></td></tr>';

    var materialRows = (D.personalMaterials || []).map(function (material) {
      return '<tr><td class="font-semibold">' + material.studentName + '</td><td>' + material.name + '</td><td class="text-center">' + material.quantity + '</td><td class="text-sm text-muted">' + (material.notes || '—') + '</td><td><button class="btn btn-ghost btn-icon btn-sm" data-advanced-entity="student-material" data-advanced-action="edit" data-id="' + material.id + '">' + icon('edit', 14) + '</button><button class="btn btn-ghost btn-icon btn-sm" data-advanced-entity="student-material" data-advanced-action="delete" data-id="' + material.id + '" style="color:var(--error)">' + icon('x', 14) + '</button></td></tr>';
    }).join('');
    if (!materialRows) materialRows = '<tr><td colspan="5"><div class="empty-state">Nenhum material pessoal cadastrado.</div></td></tr>';

    var prerequisiteRows = [];
    (D.missions || []).forEach(function (mission) {
      (mission.prerequisitoIds || []).forEach(function (prerequisiteId) {
        var prerequisite = (D.missions || []).filter(function (item) { return item.id === prerequisiteId; })[0];
        prerequisiteRows.push('<tr><td class="font-semibold">' + mission.titulo + '</td><td>' + (prerequisite ? prerequisite.titulo : 'Missão #' + prerequisiteId) + '</td><td><button class="btn btn-ghost btn-sm" data-prerequisite-remove data-mission-id="' + mission.id + '" data-prerequisite-id="' + prerequisiteId + '" style="color:var(--error)">Remover vínculo</button></td></tr>');
      });
    });
    var prerequisiteHtml = prerequisiteRows.join('') || '<tr><td colspan="3"><div class="empty-state">Nenhum pré-requisito configurado.</div></td></tr>';

    var supportRows = [];
    (D.missions || []).forEach(function (mission) {
      (mission.arquivosApoio || []).forEach(function (file) {
        supportRows.push('<tr><td class="font-semibold">' + mission.titulo + '</td><td><a href="' + file.downloadUrl + '">' + file.name + '</a></td><td class="text-sm text-muted">' + file.type.toUpperCase() + ' · ' + file.size + '</td><td><button class="btn btn-ghost btn-icon btn-sm" data-advanced-entity="mission-support" data-advanced-action="delete" data-id="' + file.id + '" style="color:var(--error)">' + icon('archive', 14) + '</button></td></tr>');
      });
    });
    var supportHtml = supportRows.join('') || '<tr><td colspan="4"><div class="empty-state">Nenhum arquivo de apoio enviado.</div></td></tr>';

    var noteRows = (D.pedagogicalNotes || []).map(function (note) {
      return '<tr><td><span class="font-semibold">' + note.studentName + '</span><span class="text-xs text-muted" style="display:block">' + note.className + '</span></td><td class="text-sm" style="max-width:420px">' + note.note + '</td><td><span class="badge badge-gray">' + (note.visibility === 'supervision' ? 'Só supervisão' : 'Equipe') + '</span></td><td><span class="text-sm">' + note.authorName + '</span><span class="text-xs text-muted" style="display:block">' + note.createdAt + '</span></td><td><button class="btn btn-ghost btn-icon btn-sm" data-advanced-entity="pedagogical-note" data-advanced-action="edit" data-id="' + note.id + '">' + icon('edit', 14) + '</button><button class="btn btn-ghost btn-icon btn-sm" data-advanced-entity="pedagogical-note" data-advanced-action="delete" data-id="' + note.id + '" style="color:var(--error)">' + icon('archive', 14) + '</button></td></tr>';
    }).join('');
    if (!noteRows) noteRows = '<tr><td colspan="5"><div class="empty-state">Nenhuma observação pedagógica registrada.</div></td></tr>';

    var auditRows = (D.auditLogs || []).map(function (log) {
      var actionLabels = { save: 'Salvou', archive: 'Arquivou', deactivate: 'Desativou', delete: 'Excluiu', return: 'Registrou devolução', link: 'Vinculou', unlink: 'Desvinculou', upload: 'Enviou arquivo', review: 'Avaliou', grant: 'Concedeu acesso', revoke: 'Removeu acesso' };
      return '<tr><td class="text-sm text-muted">' + log.createdAt + '</td><td class="font-semibold">' + log.userName + '</td><td><span class="badge badge-blue">' + (actionLabels[log.action] || log.action) + '</span></td><td class="text-sm">' + log.entityType + (log.entityId ? ' #' + log.entityId : '') + '</td><td class="text-sm text-muted">' + (log.ipAddress || '—') + '</td></tr>';
    }).join('');
    if (!auditRows) auditRows = '<tr><td colspan="5"><div class="empty-state">' + (currentUser && currentUser.role === 'admin' ? 'Nenhuma ação administrativa registrada ainda.' : 'A auditoria é visível somente para quem possui essa permissão.') + '</div></td></tr>';

    var tabs = [
      { key: 'semesters', label: 'Semestres' },
      { key: 'medals', label: 'Medalhas' },
      { key: 'laboratory', label: 'Laboratório' },
      { key: 'content', label: 'Conteúdo' },
      { key: 'notes', label: 'Observações' },
      { key: 'audit', label: 'Auditoria' },
    ];
    var tabButtons = tabs.map(function (tab) {
      return '<button class="tab-btn' + (activeAdministrationSection === tab.key ? ' active' : '') + '" data-admin-section="' + tab.key + '">' + tab.label + '</button>';
    }).join('');
    function panel(key, content) {
      return '<section class="admin-section-panel" data-admin-panel="' + key + '" style="display:' + (activeAdministrationSection === key ? 'block' : 'none') + '">' + content + '</section>';
    }

    return '<div class="animate-fade">' +
      '<div class="card admin-hub-intro mb-6"><div><span class="badge badge-blue mb-2">Configuração central</span><h3>Centro administrativo</h3><p class="text-sm text-muted mt-2">Organize os ciclos letivos, recompensas, laboratório e registros pedagógicos em um único lugar.</p></div><div class="admin-hub-summary"><div><strong>' + (D.semesters || []).length + '</strong><span>semestres</span></div><div><strong>' + (D.medals || []).length + '</strong><span>medalhas</span></div><div><strong>' + (D.labKits || []).length + '</strong><span>kits</span></div></div></div>' +
      '<div class="tabs admin-hub-tabs mb-6">' + tabButtons + '</div>' +
      panel('semesters', '<div class="flex justify-between items-center mb-4"><div><h3>Semestres e períodos letivos</h3><p class="text-sm text-muted">Defina datas e mantenha o histórico dos ciclos.</p></div><button class="btn btn-primary" data-advanced-add="semester">' + icon('plus', 16) + ' Novo semestre</button></div><div class="card"><div class="table-wrapper"><table class="table"><thead><tr><th>Semestre</th><th>Início</th><th>Fim</th><th>Status</th><th>Ações</th></tr></thead><tbody>' + semesterRows + '</tbody></table></div></div>') +
      panel('medals', '<div class="flex justify-between items-center mb-4"><div><h3>Medalhas e recompensas</h3><p class="text-sm text-muted">Cadastre conquistas usadas pelas regras automáticas.</p></div><button class="btn btn-primary" data-advanced-add="medal">' + icon('plus', 16) + ' Nova medalha</button></div><div class="card"><div class="table-wrapper"><table class="table"><thead><tr><th>Medalha</th><th>Critério</th><th>Recompensa</th><th>Status</th><th>Ações</th></tr></thead><tbody>' + medalRows + '</tbody></table></div></div>') +
      panel('laboratory', '<div class="admin-section-heading"><div><h3>Laboratório</h3><p class="text-sm text-muted">Controle kits, vínculos e materiais pessoais.</p></div><div class="flex gap-2 flex-wrap"><button class="btn btn-primary" data-advanced-add="lab-kit">' + icon('plus', 16) + ' Novo kit</button><button class="btn btn-outline" data-advanced-add="kit-assignment">Vincular kit</button><button class="btn btn-outline" data-advanced-add="student-material">Adicionar material</button></div></div><div class="card mb-6"><div class="section-header mb-3"><span class="section-title">Catálogo de kits</span></div><div class="table-wrapper"><table class="table"><thead><tr><th>Kit</th><th>Componentes</th><th>Status</th><th>Ações</th></tr></thead><tbody>' + kitRows + '</tbody></table></div></div><div class="card mb-6"><div class="section-header mb-3"><span class="section-title">Kits vinculados</span></div><div class="table-wrapper"><table class="table"><thead><tr><th>Aluno</th><th>Kit</th><th>Módulo</th><th>Status</th><th>Vinculado em</th><th>Ações</th></tr></thead><tbody>' + assignmentRows + '</tbody></table></div></div><div class="card"><div class="section-header mb-3"><span class="section-title">Materiais pessoais</span></div><div class="table-wrapper"><table class="table"><thead><tr><th>Aluno</th><th>Material</th><th>Qtd.</th><th>Observação</th><th>Ações</th></tr></thead><tbody>' + materialRows + '</tbody></table></div></div>') +
      panel('content', '<div class="admin-section-heading"><div><h3>Organização das missões</h3><p class="text-sm text-muted">Defina dependências e disponibilize materiais de apoio.</p></div><div class="flex gap-2 flex-wrap"><button class="btn btn-primary" data-advanced-add="mission-prerequisite">' + icon('plus', 16) + ' Novo pré-requisito</button><button class="btn btn-outline" data-advanced-add="mission-support">' + icon('paperclip', 16) + ' Enviar arquivo</button></div></div><div class="grid-2"><div class="card"><div class="section-header mb-3"><span class="section-title">Pré-requisitos</span></div><div class="table-wrapper"><table class="table"><thead><tr><th>Missão</th><th>Exige antes</th><th>Ação</th></tr></thead><tbody>' + prerequisiteHtml + '</tbody></table></div></div><div class="card"><div class="section-header mb-3"><span class="section-title">Arquivos de apoio</span></div><div class="table-wrapper"><table class="table"><thead><tr><th>Missão</th><th>Arquivo</th><th>Tipo</th><th>Ação</th></tr></thead><tbody>' + supportHtml + '</tbody></table></div></div></div>') +
      panel('notes', '<div class="flex justify-between items-center mb-4"><div><h3>Observações pedagógicas</h3><p class="text-sm text-muted">Registros internos com autoria, turma e visibilidade.</p></div><button class="btn btn-primary" data-advanced-add="pedagogical-note">' + icon('plus', 16) + ' Nova observação</button></div><div class="card"><div class="table-wrapper"><table class="table"><thead><tr><th>Aluno</th><th>Observação</th><th>Visibilidade</th><th>Registro</th><th>Ações</th></tr></thead><tbody>' + noteRows + '</tbody></table></div></div>') +
      panel('audit', '<div class="mb-4"><h3>Auditoria administrativa</h3><p class="text-sm text-muted">Últimas 200 ações registradas pelo sistema.</p></div><div class="card"><div class="table-wrapper"><table class="table"><thead><tr><th>Data</th><th>Responsável</th><th>Ação</th><th>Registro</th><th>IP</th></tr></thead><tbody>' + auditRows + '</tbody></table></div></div>') +
      '</div>';
  }

  // ===== Permissions =====
  function permissions(icon, D) {
    var matrix = D.permissions || { roles: [], items: [] };
    var currentUser = window.CreateJoyApp.getCurrentUser();
    var canEdit = currentUser && (currentUser.role === 'admin' || currentUser.role === 'administrative');
    var roleColors = {
      student: 'var(--blue-primary)',
      teacher: 'var(--orange)',
      supervisor: 'var(--gray-700)',
      admin: 'var(--success)',
      finance: '#0F766E',
      administrative: '#7C3AED',
    };

    var headerCells = matrix.roles.map(function (role) {
      var color = roleColors[role.code] || 'var(--gray-700)';
      return '<th style="text-align:center"><span class="badge" style="background:' + color + '22;color:' + color + '">' + role.name + '</span></th>';
    }).join('');

    var rows = matrix.items
      .map(function (permission) {
        var cells = matrix.roles
          .map(function (role) {
            var value = Boolean(permission.roles[role.code]);
            var disabled = !canEdit || role.code === 'admin';
            return '<td style="text-align:center"><button class="perm-toggle" data-role="' + role.code + '" data-perm="' + permission.code + '" data-allowed="' + (value ? '1' : '0') + '" style="width:32px;height:32px;border-radius:50%;background:' + (value ? 'var(--success-light)' : 'var(--gray-100)') + ';border:2px solid ' + (value ? 'var(--success)' : 'var(--gray-300)') + ';cursor:' + (disabled ? 'not-allowed' : 'pointer') + ';display:inline-flex;align-items:center;justify-content:center;transition:all var(--transition);font-size:0.875rem" ' + (disabled ? 'disabled' : '') + '>' + (value ? '✓' : '✗') + '</button></td>';
          })
          .join('');
        return '<tr><td><span class="font-semibold text-sm">' + permission.name + '</span><span class="text-xs text-muted" style="display:block">' + permission.group + '</span></td>' + cells + '</tr>';
      })
      .join('');
    if (!rows) rows = '<tr><td colspan="' + (matrix.roles.length + 1) + '"><div class="empty-state">Nenhuma permissão configurada.</div></td></tr>';

    return (
      '<div class="animate-fade">' +
      '<div class="card mb-6" style="background:linear-gradient(135deg,var(--blue-darker),var(--blue-primary));color:white;padding:24px"><div class="flex items-center gap-3">' + icon('shieldCheck', 32) + '<div><h3>Controle de Permissões</h3><p style="opacity:0.75;font-size:0.875rem;margin-top:4px">Defina o que cada perfil pode visualizar e modificar na plataforma.</p></div></div></div>' +
      '<div class="card"><div class="table-wrapper"><table class="table"><thead><tr><th>Permissão</th>' + headerCells + '</tr></thead><tbody>' + rows + '</tbody></table></div><p class="text-xs text-muted mt-4">' + (canEdit ? 'Clique nos indicadores para alterar. ' : 'Somente os perfis autorizados podem alterar. ') + 'O Admin Geral sempre possui acesso total.</p></div>' +
      '</div>'
    );
  }

  // ===== Reports =====
  function profile(icon, D) {
    var account = D.currentProfile;
    if (!account) return '<div class="card empty-state">Não foi possível carregar os dados do seu perfil.</div>';
    var roleNames = { admin: 'Admin Geral', supervisor: 'Supervisão', finance: 'Financeiro', administrative: 'Gestão Administrativa' };
    var roleName = roleNames[account.role] || account.role;
    var totalStudents = Number((((D.reenrollment || {}).analytics || {}).totalStudents) || (D.students || []).length);
    var scopeText = account.role === 'finance' ? 'Acesso limitado a tarefas e indicadores financeiros.' : 'Dados protegidos pelas permissões do sistema.';
    return '<div class="animate-fade management-profile-page"><section class="management-profile-hero"><div class="management-profile-avatar" id="management-profile-avatar">' + (account.fotoUrl ? '<img class="avatar avatar-xl profile-avatar" src="' + account.fotoUrl + '" alt="Foto de ' + account.name + '" />' : '<div class="avatar avatar-xl profile-avatar">' + account.initials + '</div>') + '</div><div><span>PERFIL DA GESTÃO</span><h2>' + account.name + '</h2><p>' + account.email + '</p><span class="badge badge-orange">' + roleName + '</span></div><div class="management-profile-scope">' + icon('shieldCheck', 26) + '<strong>Acesso protegido</strong><span>' + scopeText + '</span></div></section><div class="grid-2 management-profile-grid"><section class="card"><div class="section-header mb-4"><div><span class="admin-form-kicker">DADOS PESSOAIS</span><h3>Editar perfil e foto</h3></div></div><form id="management-profile-form"><div class="form-group"><label class="form-label" for="management-profile-name">Nome completo</label><input class="form-input" id="management-profile-name" maxlength="120" value="' + account.name + '" required /></div><div class="form-group"><label class="form-label" for="management-profile-email">E-mail</label><input class="form-input" id="management-profile-email" type="email" maxlength="190" value="' + account.email + '" required /></div><div class="form-group"><label class="form-label" for="management-profile-phone">Telefone</label><input class="form-input" id="management-profile-phone" maxlength="30" value="' + (account.telefone || '') + '" placeholder="(00) 00000-0000" /></div><div class="form-group"><label class="form-label">Foto de perfil</label><label class="teacher-photo-upload" for="management-profile-photo">' + icon('upload', 17) + '<span>Escolher JPG ou PNG</span><small id="management-profile-photo-name">Máximo de 1,5 MB</small></label><input id="management-profile-photo" type="file" accept="image/jpeg,image/png" hidden /></div><button class="btn btn-primary" type="submit">' + icon('save', 15) + ' Salvar perfil</button></form></section><div><section class="card mb-6"><div class="section-header mb-4"><div><span class="admin-form-kicker">SEGURANÇA</span><h3>Senha de acesso</h3></div></div><p class="text-sm text-muted mb-4">Altere sua senha sempre que precisar. Use pelo menos 8 caracteres.</p><button class="btn btn-outline" id="management-change-password-btn">' + icon('edit', 15) + ' Alterar minha senha</button><div id="management-password-panel" style="display:none"><form id="management-password-form" class="mt-4"><div class="form-group"><label class="form-label">Senha atual</label><input class="form-input" type="password" id="management-current-password" autocomplete="current-password" required /></div><div class="form-group"><label class="form-label">Nova senha</label><input class="form-input" type="password" id="management-new-password" autocomplete="new-password" minlength="8" required /></div><div class="form-group"><label class="form-label">Confirmar nova senha</label><input class="form-input" type="password" id="management-confirm-password" autocomplete="new-password" minlength="8" required /></div><div class="flex justify-end gap-2"><button type="button" class="btn btn-ghost btn-sm" id="management-cancel-password">Cancelar</button><button type="submit" class="btn btn-primary btn-sm">Salvar nova senha</button></div></form></div></section><section class="card management-profile-summary"><div><strong>' + totalStudents + '</strong><span>alunos acompanhados</span></div><div><strong>' + (D.classes || []).length + '</strong><span>turmas cadastradas</span></div><div><strong>' + (D.teachers || []).length + '</strong><span>professores</span></div></section></div></div></div>';
  }

  function reports(icon, D) {
    var tabs = [
      { key: 'alunos', label: 'Por Aluno' },
      { key: 'turmas', label: 'Por Turma' },
      { key: 'missoes', label: 'Missões' },
      { key: 'desempenho', label: 'Desempenho' },
    ];
    var tabBtns = tabs.map(function (t) { return '<button class="tab-btn' + (t.key === 'alunos' ? ' active' : '') + '" data-tab="' + t.key + '">' + t.label + '</button>'; }).join('');

    var sortedStudents = D.students.slice().sort(function (a, b) { return b.progresso - a.progresso; });
    var studentRows = sortedStudents
      .map(function (s) {
        var barColor = s.progresso >= 70 ? 'var(--success)' : s.progresso >= 40 ? 'var(--warning)' : 'var(--error)';
        return '<tr><td><div class="flex items-center" style="gap:10px"><div class="avatar avatar-sm">' + s.initials + '</div><span class="font-semibold">' + s.name + '</span></div></td><td class="text-sm text-muted">' + s.turma + '</td><td><span class="badge badge-blue">' + s.modulo + '</span></td><td class="text-sm">' + s.missoesConcluidas + '/' + s.missoesTotal + '</td><td><div class="flex items-center" style="gap:8px"><div class="progress-bar" style="width:100px"><div class="progress-fill" style="width:' + s.progresso + '%;background:' + barColor + '"></div></div><span class="text-sm font-bold">' + s.progresso + '%</span></div></td><td><span class="badge ' + (s.status === 'ativo' ? 'badge-green' : s.status === 'atrasado' ? 'badge-red' : 'badge-gray') + '">' + s.status + '</span></td></tr>';
      })
      .join('');
    if (!studentRows) studentRows = '<tr><td colspan="6"><div class="empty-state">Nenhum aluno cadastrado.</div></td></tr>';

    return (
      '<div class="animate-fade">' +
      '<div class="flex items-center justify-between mb-6 flex-wrap gap-3"><div class="tabs" style="flex:1;max-width:500px">' + tabBtns + '</div><a class="btn btn-outline btn-sm" href="/api/index.php?route=reports%2Fstudents.csv">' + icon('download', 14) + ' Exportar CSV</a></div>' +
      '<div id="report-alunos" class="card"><div class="section-header mb-4"><span class="section-title">Progresso por Aluno</span><span class="badge badge-gray">' + D.students.length + ' alunos</span></div><div class="table-wrapper"><table class="table"><thead><tr><th>Aluno</th><th>Turma</th><th>Módulo</th><th>Concluídas</th><th>Progresso</th><th>Status</th></tr></thead><tbody>' + studentRows + '</tbody></table></div></div>' +
      '<div id="report-turmas" style="display:none"></div>' +
      '<div id="report-missoes" style="display:none"></div>' +
      '<div id="report-desempenho" style="display:none"></div>' +
      '</div>'
    );
  }

  // ===== Event binding =====
  function findById(items, id) {
    return (items || []).filter(function (item) { return item.id === id; })[0] || null;
  }

  function entityPage(entity) {
    return {
      module: 'curriculum',
      mission: 'missions',
      activity: 'activities',
      employee: 'teachers',
      teacher: 'teachers',
      student: 'students',
      class: 'classes',
    }[entity] || 'dashboard';
  }

  async function persist(entity, payload, navigate) {
    var response;
    if (entity === 'employee' || entity === 'teacher' || entity === 'student') {
      response = await window.CreateJoyApi.saveUser(payload);
    } else {
      response = await window.CreateJoyApi.saveEntity(entity, payload);
    }
    window.CreateJoyApp.updateData(response.data);
    navigate(entityPage(entity));
  }

  async function remove(entity, id, navigate) {
    if (!await window.CreateJoyUI.confirm({ title: 'Desativar ou arquivar este cadastro?', message: 'Registros que já possuem histórico serão preservados e apenas desativados ou arquivados.', confirmLabel: 'Confirmar alteração', tone: 'warning' })) return;
    var response = (entity === 'employee' || entity === 'teacher' || entity === 'student')
      ? await window.CreateJoyApi.deleteUser(id)
      : await window.CreateJoyApi.deleteEntity(entity, id);
    window.CreateJoyApp.updateData(response.data);
    navigate(entityPage(entity));
  }

  async function permanentlyDeleteStudent(student, navigate) {
    if (!student) return;
    var confirmed = await window.CreateJoyUI.confirm({
      title: 'Excluir ' + student.name + ' definitivamente?',
      message: 'Esta ação apaga o login do aluno e todo o histórico relacionado, incluindo entregas, arquivos, Joys, medalhas, pedidos e investimentos. Ela não pode ser desfeita. Para apenas impedir o acesso, use o botão “Desativar”.',
      confirmLabel: 'Excluir definitivamente',
      cancelLabel: 'Manter aluno',
      tone: 'error',
    });
    if (!confirmed) return;
    var response = await window.CreateJoyApi.permanentlyDeleteStudent(student.id);
    window.CreateJoyApp.updateData(response.data);
    window.CreateJoyUI.toast(response.message, 'success');
    navigate('students');
  }

  function openCoreEntityForm(entity, existing, D, navigate) {
    var definitions = {
      module: {
        title: existing ? 'Editar módulo' : 'Novo módulo',
        subtitle: 'Organize a etapa curricular, a ordem e a carga horária.',
        submit: 'Salvar módulo',
      },
      mission: {
        title: existing ? 'Editar missão' : 'Nova missão',
        subtitle: 'Defina todo o conteúdo, a entrega e a recompensa em um só lugar.',
        submit: 'Salvar missão',
      },
      activity: {
        title: existing ? 'Editar atividade' : 'Nova atividade',
        subtitle: 'Cadastre o exercício ou desafio que faz parte de uma missão.',
        submit: 'Salvar atividade',
      },
      class: {
        title: existing ? 'Editar turma' : 'Nova turma',
        subtitle: 'Vincule semestre, professor, horários e módulos da turma.',
        submit: 'Salvar turma',
      },
    };
    var definition = definitions[entity];
    if (!definition) return;

    var fields = '';
    if (entity === 'module') {
      fields =
        '<div class="form-group admin-form-span-2"><label class="form-label" for="core-name">Nome do módulo</label><input class="form-input" id="core-name" maxlength="100" placeholder="Ex.: Player — Básico" required><span class="form-help">Use um nome que identifique claramente a etapa curricular.</span></div>' +
        '<div class="form-group"><label class="form-label" for="core-level">Ordem do módulo</label><input class="form-input" id="core-level" type="number" min="1" step="1" required><span class="form-help">Controla a sequência e o desbloqueio para os alunos.</span></div>' +
        '<div class="form-group"><label class="form-label" for="core-workload">Carga horária</label><div class="admin-input-suffix"><input class="form-input" id="core-workload" type="number" min="0" step="1" required><span>horas</span></div></div>' +
        '<div class="form-group"><label class="form-label" for="core-status">Status</label><select class="form-select" id="core-status"><option value="active">Ativo</option><option value="inactive">Inativo</option></select></div>' +
        '<div class="form-group"><label class="form-label" for="core-color">Cor de identificação</label><input class="form-input admin-color-input" id="core-color" type="color"></div>' +
        '<div class="form-group admin-form-span-2"><label class="form-label" for="core-description">Descrição do módulo</label><textarea class="form-textarea" id="core-description" maxlength="500" rows="5" placeholder="Explique o que o aluno aprenderá, quais habilidades desenvolverá e o resultado esperado."></textarea><span class="form-help">As aulas e tarefas específicas serão cadastradas como missões.</span></div>';
    } else if (entity === 'mission') {
      fields =
        '<div class="form-group admin-form-span-2"><label class="form-label" for="core-title">Título da missão</label><input class="form-input" id="core-title" maxlength="160" placeholder="Ex.: Criando seu primeiro jogo" required></div>' +
        '<div class="form-group"><label class="form-label" for="core-module">Módulo</label><select class="form-select" id="core-module" required></select></div>' +
        '<div class="form-group"><label class="form-label" for="core-type">Tipo da missão</label><select class="form-select" id="core-type"><option value="required">Obrigatória — conta no progresso</option><option value="extra">Extra — não conta no progresso</option></select></div>' +
        '<div class="form-group admin-form-span-2" id="core-extra-prerequisite-group" style="display:none"><label class="form-label" for="core-extra-prerequisite">Liberar a missão extra depois de</label><select class="form-select" id="core-extra-prerequisite"></select><span class="form-help">A missão extra só aparecerá ao aluno quando esta missão obrigatória estiver aprovada.</span></div>' +
        '<div class="form-group"><label class="form-label" for="core-lesson">Número da aula</label><input class="form-input" id="core-lesson" type="number" min="1" step="1" required></div>' +
        '<div class="form-group"><label class="form-label" for="core-order">Ordem de exibição</label><input class="form-input" id="core-order" type="number" min="1" step="1" required></div>' +
        '<div class="form-group"><label class="form-label" for="core-delivery">Tipo de entrega</label><select class="form-select" id="core-delivery"><option value="texto">Texto</option><option value="codigo">Código</option><option value="stl">Arquivo STL</option><option value="imagem">Imagem</option><option value="pdf">PDF</option></select></div>' +
        '<div class="form-group"><label class="form-label" for="core-status">Status</label><select class="form-select" id="core-status"><option value="draft">Rascunho</option><option value="active">Ativa</option><option value="archived">Arquivada</option></select></div>' +
        '<div class="form-group"><label class="form-label" for="core-joys">Recompensa</label><div class="admin-input-suffix"><input class="form-input" id="core-joys" type="number" min="0" max="10000" step="1"><span>Joys</span></div></div>' +
        '<div class="form-group admin-form-span-2"><label class="form-label" for="core-objective">Objetivo da aula</label><textarea class="form-textarea" id="core-objective" maxlength="500" rows="3" placeholder="O que o aluno deverá compreender ou realizar?"></textarea></div>' +
        '<div class="form-group admin-form-span-2"><label class="form-label" for="core-description">Descrição</label><textarea class="form-textarea" id="core-description" maxlength="20000" rows="6" placeholder="Apresente a proposta, o contexto e as orientações da missão." required></textarea></div>' +
        '<div class="form-group admin-form-span-2"><label class="form-label" for="core-steps">Passo a passo</label><textarea class="form-textarea" id="core-steps" rows="7" placeholder="Um passo por linha.\nEx.: Abra o programa\nCrie um novo projeto\nTeste o resultado"></textarea><span class="form-help">Digite um passo em cada linha; o sistema organizará a numeração.</span></div>';
    } else if (entity === 'activity') {
      fields =
        '<div class="form-group admin-form-span-2"><label class="form-label" for="core-name">Nome da atividade</label><input class="form-input" id="core-name" maxlength="160" placeholder="Ex.: Desafio de pontuação" required></div>' +
        '<div class="form-group admin-form-span-2"><label class="form-label" for="core-mission">Missão relacionada</label><select class="form-select" id="core-mission" required></select></div>' +
        '<div class="form-group"><label class="form-label" for="core-type">Tipo</label><select class="form-select" id="core-type"><option value="exercicio">Obrigatória — checklist</option><option value="desafio">Desafio extra</option><option value="arquivo">Arquivo de apoio</option></select></div>' +
        '<div class="form-group"><label class="form-label" for="core-delivery">Tipo de entrega</label><select class="form-select" id="core-delivery"><option value="texto">Texto</option><option value="codigo">Código</option><option value="stl">Arquivo STL</option><option value="imagem">Imagem</option><option value="pdf">PDF</option><option value="nenhuma">Sem entrega</option></select></div>' +
        '<div class="form-group admin-form-span-2" id="core-activity-prerequisite-group" style="display:none"><label class="form-label" for="core-activity-prerequisite">Liberar o desafio extra depois de</label><select class="form-select" id="core-activity-prerequisite"></select><span class="form-help">O desafio só aparecerá depois que o aluno marcar a atividade obrigatória selecionada.</span></div>' +
        '<div class="form-group admin-form-span-2"><label class="form-label" for="core-criteria">Critério de conclusão</label><textarea class="form-textarea" id="core-criteria" maxlength="500" rows="4" placeholder="Explique o que o aluno precisa fazer para concluir esta atividade."></textarea></div>';
    } else if (entity === 'class') {
      fields =
        '<div class="form-group admin-form-span-2"><label class="form-label" for="core-name">Nome da turma</label><input class="form-input" id="core-name" maxlength="120" placeholder="Ex.: Turma Player — Segunda 14h" required></div>' +
        '<div class="form-group"><label class="form-label" for="core-semester">Semestre</label><select class="form-select" id="core-semester"></select></div>' +
        '<div class="form-group"><label class="form-label" for="core-teacher">Professor responsável</label><select class="form-select" id="core-teacher"></select></div>' +
        '<div class="form-group admin-form-span-2"><label class="form-label" for="core-schedule">Dias e horários</label><input class="form-input" id="core-schedule" maxlength="190" placeholder="Ex.: Segundas e quartas, das 14h às 16h"></div>' +
        '<div class="form-group"><label class="form-label" for="core-status">Status</label><select class="form-select" id="core-status"><option value="active">Ativa</option><option value="inactive">Inativa</option></select></div>' +
        '<div class="form-group admin-form-span-2"><span class="form-label">Módulos vinculados</span><div class="admin-check-grid" id="core-modules"></div><span class="form-help">Selecione todos os módulos que poderão ser trabalhados nesta turma.</span></div>';
    }

    var backdrop = document.createElement('div');
    backdrop.className = 'admin-modal-backdrop admin-editor-backdrop';
    backdrop.innerHTML =
      '<section class="admin-modal admin-editor-page" role="dialog" aria-modal="true" aria-labelledby="core-form-title">' +
        '<div class="admin-modal-header"><div><span class="admin-form-kicker">CADASTRO</span><h2 id="core-form-title">' + definition.title + '</h2><p class="text-sm text-muted">' + definition.subtitle + '</p></div><button type="button" class="btn btn-ghost btn-icon" data-modal-close aria-label="Fechar">' + window.Icons.render('x', 18) + '</button></div>' +
        '<form id="core-entity-form"><div class="admin-modal-body"><div class="admin-form-section"><div class="admin-user-form-grid">' + fields + '</div></div><div class="admin-form-error" id="core-form-error" role="alert" hidden></div></div>' +
        '<div class="admin-modal-footer"><span class="admin-save-hint">Revise as informações antes de salvar.</span><button type="button" class="btn btn-ghost" data-modal-close>Cancelar</button><button type="submit" class="btn btn-primary" id="core-form-save">' + window.Icons.render('save', 15) + ' ' + definition.submit + '</button></div></form>' +
      '</section>';
    document.body.appendChild(backdrop);

    function input(selector) { return backdrop.querySelector(selector); }
    function value(selector) { var element = input(selector); return element ? element.value : ''; }
    function setValue(selector, fieldValue) {
      var element = input(selector);
      if (element && fieldValue !== undefined && fieldValue !== null) element.value = String(fieldValue);
    }
    function populateSelect(selector, items, selected, emptyLabel, label) {
      var select = input(selector);
      if (!select) return;
      if (emptyLabel) appendOption(select, '', emptyLabel, selected);
      (items || []).forEach(function (item) { appendOption(select, item.id, label(item), selected); });
    }

    if (entity === 'module') {
      setValue('#core-name', existing && existing.name);
      setValue('#core-level', existing ? existing.level : ((D.modules || []).reduce(function (max, item) { return Math.max(max, Number(item.level) || 0); }, 0) + 1));
      setValue('#core-workload', existing ? existing.cargaHoraria : 40);
      setValue('#core-status', existing && existing.status === 'inativo' ? 'inactive' : 'active');
      setValue('#core-color', existing && existing.cor ? existing.cor : '#1E72B8');
      setValue('#core-description', existing && existing.descricao);
    } else if (entity === 'mission') {
      populateSelect('#core-module', D.modules, existing && existing.moduloId, 'Selecione um módulo', function (item) { return item.level + ' · ' + item.name; });
      setValue('#core-title', existing && existing.titulo);
      setValue('#core-type', existing && existing.tipo === 'extra' ? 'extra' : 'required');
      setValue('#core-lesson', existing ? existing.aula : 1);
      setValue('#core-order', existing ? existing.ordem : 1);
      setValue('#core-delivery', existing ? existing.entrega : 'texto');
      setValue('#core-status', existing ? ({ ativa: 'active', rascunho: 'draft', arquivada: 'archived' }[existing.status] || 'draft') : 'draft');
      setValue('#core-joys', existing ? existing.joys : 0);
      setValue('#core-objective', existing && existing.objetivo);
      setValue('#core-description', existing && existing.descricao);
      setValue('#core-steps', existing && existing.passos ? existing.passos.join('\n') : '');
      var missionPrerequisiteGroup = input('#core-extra-prerequisite-group');
      var missionPrerequisiteSelect = input('#core-extra-prerequisite');
      var selectedMissionPrerequisite = existing && existing.prerequisitoIds && existing.prerequisitoIds.length ? existing.prerequisitoIds[0] : '';
      function refreshMissionPrerequisites() {
        missionPrerequisiteSelect.innerHTML = '';
        appendOption(missionPrerequisiteSelect, '', 'Selecione uma missão obrigatória', selectedMissionPrerequisite);
        (D.missions || []).filter(function (mission) {
          return mission.tipo === 'obrigatoria'
            && String(mission.moduloId) === String(value('#core-module'))
            && (!existing || Number(mission.id) !== Number(existing.id));
        }).forEach(function (mission) {
          appendOption(missionPrerequisiteSelect, mission.id, 'Aula ' + mission.aula + ' · ' + mission.titulo, selectedMissionPrerequisite);
        });
      }
      function updateMissionTypeFields() {
        var isExtra = value('#core-type') === 'extra';
        missionPrerequisiteGroup.style.display = isExtra ? 'block' : 'none';
        missionPrerequisiteSelect.required = isExtra;
      }
      refreshMissionPrerequisites();
      updateMissionTypeFields();
      input('#core-module').addEventListener('change', function () { selectedMissionPrerequisite = ''; refreshMissionPrerequisites(); });
      input('#core-type').addEventListener('change', updateMissionTypeFields);
    } else if (entity === 'activity') {
      populateSelect('#core-mission', D.missions, existing && existing.missaoId, 'Selecione uma missão', function (item) { return item.titulo + ' · ' + item.modulo; });
      setValue('#core-name', existing && existing.nome);
      setValue('#core-type', existing ? existing.tipo : 'exercicio');
      setValue('#core-delivery', existing ? existing.entrega : 'texto');
      setValue('#core-criteria', existing && existing.criterio);
      var activityPrerequisiteGroup = input('#core-activity-prerequisite-group');
      var activityPrerequisiteSelect = input('#core-activity-prerequisite');
      var selectedActivityPrerequisite = existing && existing.prerequisitoId ? existing.prerequisitoId : '';
      function refreshActivityPrerequisites() {
        activityPrerequisiteSelect.innerHTML = '';
        appendOption(activityPrerequisiteSelect, '', 'Selecione uma atividade obrigatória', selectedActivityPrerequisite);
        (D.activities || []).filter(function (activity) {
          return ['exercicio', 'exercise'].indexOf(activity.tipo) !== -1
            && String(activity.missaoId) === String(value('#core-mission'))
            && (!existing || Number(activity.id) !== Number(existing.id));
        }).forEach(function (activity) {
          appendOption(activityPrerequisiteSelect, activity.id, activity.nome, selectedActivityPrerequisite);
        });
      }
      function updateActivityTypeFields() {
        var isExtra = value('#core-type') === 'desafio';
        activityPrerequisiteGroup.style.display = isExtra ? 'block' : 'none';
        activityPrerequisiteSelect.required = isExtra;
      }
      refreshActivityPrerequisites();
      updateActivityTypeFields();
      input('#core-mission').addEventListener('change', function () { selectedActivityPrerequisite = ''; refreshActivityPrerequisites(); });
      input('#core-type').addEventListener('change', updateActivityTypeFields);
    } else if (entity === 'class') {
      populateSelect('#core-semester', D.semesters, existing && existing.semestreId, 'Sem semestre definido', function (item) { return item.name; });
      populateSelect('#core-teacher', D.teachers, existing && existing.professorId, 'Sem professor definido', function (item) { return item.name; });
      setValue('#core-name', existing && existing.nome);
      setValue('#core-schedule', existing && existing.horarios !== 'Não definido' ? existing.horarios : '');
      setValue('#core-status', existing && existing.status === 'inativa' ? 'inactive' : 'active');
      var selectedModules = existing && existing.moduloIds ? existing.moduloIds.map(String) : [];
      var moduleContainer = input('#core-modules');
      (D.modules || []).forEach(function (module) {
        var label = document.createElement('label');
        label.className = 'admin-check-option';
        var checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.value = String(module.id);
        checkbox.checked = selectedModules.indexOf(String(module.id)) !== -1;
        var textNode = document.createElement('span');
        textNode.textContent = module.level + ' · ' + module.name;
        label.appendChild(checkbox);
        label.appendChild(textNode);
        moduleContainer.appendChild(label);
      });
      if (!(D.modules || []).length) moduleContainer.innerHTML = '<p class="text-sm text-muted">Cadastre um módulo antes de vinculá-lo à turma.</p>';
    }

    function closeForm() {
      document.removeEventListener('keydown', onKeyDown);
      backdrop.remove();
    }
    function onKeyDown(event) { if (event.key === 'Escape') closeForm(); }
    document.addEventListener('keydown', onKeyDown);
    backdrop.querySelectorAll('[data-modal-close]').forEach(function (button) { button.addEventListener('click', closeForm); });

    input('#core-entity-form').addEventListener('submit', async function (event) {
      event.preventDefault();
      var errorBox = input('#core-form-error');
      var saveButton = input('#core-form-save');
      var payload = { id: existing ? existing.id : null };
      errorBox.hidden = true;

      if (entity === 'module') {
        payload.name = value('#core-name').trim();
        payload.level = value('#core-level');
        payload.workload_hours = value('#core-workload');
        payload.status = value('#core-status');
        payload.color = value('#core-color');
        payload.description = value('#core-description').trim();
      } else if (entity === 'mission') {
        payload.module_id = value('#core-module');
        payload.title = value('#core-title').trim();
        payload.type = value('#core-type');
        payload.lesson_number = value('#core-lesson');
        payload.sort_order = value('#core-order');
        payload.delivery_type = value('#core-delivery');
        payload.status = value('#core-status');
        payload.joys_reward = value('#core-joys') || 0;
        payload.objective = value('#core-objective').trim();
        payload.description = value('#core-description').trim();
        payload.steps = value('#core-steps');
        payload.extra_prerequisite_id = value('#core-type') === 'extra' ? (value('#core-extra-prerequisite') || null) : null;
      } else if (entity === 'activity') {
        payload.name = value('#core-name').trim();
        payload.mission_id = value('#core-mission');
        payload.type = value('#core-type');
        payload.delivery_type = value('#core-delivery');
        payload.criteria = value('#core-criteria').trim();
        payload.prerequisite_activity_id = value('#core-type') === 'desafio' ? (value('#core-activity-prerequisite') || null) : null;
      } else if (entity === 'class') {
        payload.name = value('#core-name').trim();
        payload.semester_id = value('#core-semester') || null;
        payload.teacher_user_id = value('#core-teacher') || null;
        payload.schedule = value('#core-schedule').trim();
        payload.status = value('#core-status');
        payload.module_ids = Array.prototype.map.call(backdrop.querySelectorAll('#core-modules input:checked'), function (checkbox) { return checkbox.value; });
      }

      saveButton.disabled = true;
      saveButton.textContent = 'Salvando...';
      try {
        await persist(entity, payload, navigate);
        closeForm();
      } catch (error) {
        errorBox.textContent = error.message;
        errorBox.hidden = false;
        saveButton.disabled = false;
        saveButton.innerHTML = window.Icons.render('save', 15) + ' ' + definition.submit;
      }
    });

    window.setTimeout(function () {
      var firstField = input('input:not([type="checkbox"]), select, textarea');
      if (firstField) firstField.focus();
    }, 0);
  }

  function editModule(existing, D, navigate) { return openCoreEntityForm('module', existing, D, navigate); }
  function editMission(existing, D, navigate) { return openCoreEntityForm('mission', existing, D, navigate); }
  function editActivity(existing, D, navigate) { return openCoreEntityForm('activity', existing, D, navigate); }

  function appendOption(select, value, label, selectedValue) {
    var option = document.createElement('option');
    option.value = String(value);
    option.textContent = label;
    option.selected = String(value) === String(selectedValue === null || selectedValue === undefined ? '' : selectedValue);
    select.appendChild(option);
  }

  function openUserModal(kind, existing, D, navigate) {
    var isStudent = kind === 'student';
    var entityLabel = isStudent ? 'aluno' : 'funcionário';
    var currentUser = window.CreateJoyApp.getCurrentUser();
    var isCurrentAccount = Boolean(existing && currentUser && currentUser.id === existing.id);
    var employeeRoleOptions = '<option value="teacher">Professor</option>';
    if (!isStudent && currentUser && currentUser.role === 'admin') {
      employeeRoleOptions += '<option value="supervisor">Supervisão</option><option value="finance">Financeiro</option><option value="administrative">Gestão Administrativa</option><option value="admin">Admin Geral</option>';
    } else if (!isStudent && existing && existing.role !== 'teacher') {
      var protectedRoleNames = { supervisor: 'Supervisão', finance: 'Financeiro', administrative: 'Gestão Administrativa', admin: 'Admin Geral' };
      employeeRoleOptions += '<option value="' + existing.role + '">' + (protectedRoleNames[existing.role] || existing.perfil || existing.role) + '</option>';
    }
    var backdrop = document.createElement('div');
    backdrop.className = 'admin-modal-backdrop';
    backdrop.innerHTML =
      '<section class="admin-modal" role="dialog" aria-modal="true" aria-labelledby="admin-user-modal-title">' +
        '<div class="admin-modal-header">' +
          '<div><h2 id="admin-user-modal-title">' + (existing ? 'Editar ' : 'Novo ') + entityLabel + '</h2>' +
          '<p class="text-sm text-muted">' + (existing ? 'Atualize os dados e deixe a senha vazia para mantê-la.' : 'Crie a conta e defina a senha de primeiro acesso.') + '</p></div>' +
          '<button type="button" class="btn btn-ghost btn-icon" data-modal-close aria-label="Fechar">' + window.Icons.render('x', 18) + '</button>' +
        '</div>' +
        '<form id="admin-user-form">' +
          '<div class="admin-modal-body">' +
            '<div class="admin-user-form-grid">' +
              '<div class="form-group admin-form-span-2"><label class="form-label" for="user-name">Nome completo</label><input class="form-input" id="user-name" name="name" maxlength="120" autocomplete="name" required></div>' +
              '<div class="form-group admin-form-span-2"><label class="form-label" for="user-email">E-mail de acesso</label><input class="form-input" id="user-email" name="email" type="email" maxlength="190" autocomplete="email" required></div>' +
              '<div class="form-group"><label class="form-label" for="user-password">' + (existing ? 'Nova senha (opcional)' : 'Senha inicial') + '</label><input class="form-input" id="user-password" name="password" type="password" minlength="8" autocomplete="new-password"' + (existing ? '' : ' required') + '><span class="form-help">Mínimo de 8 caracteres.</span></div>' +
              '<div class="form-group"><label class="form-label" for="user-password-confirm">Confirmar senha</label><input class="form-input" id="user-password-confirm" name="password_confirm" type="password" minlength="8" autocomplete="new-password"' + (existing ? '' : ' required') + '></div>' +
              '<div class="form-group"><label class="form-label" for="user-account-status">Status da conta</label><select class="form-select" id="user-account-status"><option value="active">Ativa</option><option value="inactive">Inativa</option></select></div>' +
              (isStudent
                ? '<div class="form-group"><label class="form-label" for="student-status">Situação pedagógica</label><select class="form-select" id="student-status"><option value="ativo">Ativo</option><option value="atrasado">Atrasado</option><option value="inativo">Inativo</option></select></div>' +
                  '<div class="form-group"><label class="form-label" for="student-gender">Gênero</label><select class="form-select" id="student-gender"><option value="not_informed">Não informado</option><option value="female">Feminino</option><option value="male">Masculino</option></select></div>' +
                  '<div class="form-group"><label class="form-label" for="student-class">Turma</label><select class="form-select" id="student-class"></select></div>' +
                  '<div class="form-group"><label class="form-label" for="student-module">Módulo atual</label><select class="form-select" id="student-module"></select></div>' +
                  '<div class="form-group"><label class="form-label" for="student-computer">Número do computador</label><input class="form-input" id="student-computer" maxlength="20" placeholder="Ex.: 12"></div>' +
                  '<div class="form-group"><label class="form-label" for="student-joys">Saldo atual de Joys</label><input class="form-input" id="student-joys" type="number" min="0" max="1000000" step="1" value="0"><span class="form-help">O ajuste fica registrado no extrato do aluno.</span></div>' +
                  '<div class="form-group admin-form-span-2"><span class="form-label">Módulos anteriores realmente concluídos</span><div class="admin-check-grid" id="student-completed-modules"></div><span class="form-help">Não marque apenas porque o aluno entrou em um módulo avançado. Selecione somente cursos concluídos ou reconhecidos.</span></div>'
                : '<div class="form-group"><label class="form-label" for="employee-role">Perfil de acesso</label><select class="form-select" id="employee-role">' + employeeRoleOptions + '</select></div>') +
            '</div>' +
            '<div class="admin-form-error" id="admin-user-error" role="alert" hidden></div>' +
            (isCurrentAccount ? '<p class="admin-form-note">Você está editando a conta em uso. O perfil e o status ativo desta conta são protegidos.</p>' : '') +
          '</div>' +
          '<div class="admin-modal-footer"><button type="button" class="btn btn-ghost" data-modal-close>Cancelar</button><button type="submit" class="btn btn-primary" id="admin-user-save">Salvar ' + entityLabel + '</button></div>' +
        '</form>' +
      '</section>';

    document.body.appendChild(backdrop);

    var form = backdrop.querySelector('#admin-user-form');
    var nameInput = backdrop.querySelector('#user-name');
    var emailInput = backdrop.querySelector('#user-email');
    var passwordInput = backdrop.querySelector('#user-password');
    var passwordConfirmInput = backdrop.querySelector('#user-password-confirm');
    var accountStatusSelect = backdrop.querySelector('#user-account-status');
    var errorBox = backdrop.querySelector('#admin-user-error');
    var saveButton = backdrop.querySelector('#admin-user-save');

    nameInput.value = existing ? existing.name : '';
    emailInput.value = existing ? existing.email : '';
    accountStatusSelect.value = existing
      ? (isStudent ? (existing.accountStatus || (existing.status === 'inativo' ? 'inactive' : 'active')) : (existing.status === 'inativo' ? 'inactive' : 'active'))
      : 'active';

    if (isStudent) {
      var classSelect = backdrop.querySelector('#student-class');
      var moduleSelect = backdrop.querySelector('#student-module');
      appendOption(classSelect, '', 'Sem turma', existing ? existing.turmaId : '');
      D.classes.forEach(function (item) { appendOption(classSelect, item.id, item.nome, existing ? existing.turmaId : ''); });
      appendOption(moduleSelect, '', 'Sem módulo', existing ? existing.moduloId : '');
      D.modules.forEach(function (item) { appendOption(moduleSelect, item.id, item.name, existing ? existing.moduloId : ''); });
      backdrop.querySelector('#student-status').value = existing && ['ativo', 'atrasado', 'inativo'].indexOf(existing.status) !== -1 ? existing.status : 'ativo';
      backdrop.querySelector('#student-gender').value = existing && ['male', 'female'].indexOf(existing.gender) !== -1 ? existing.gender : 'not_informed';
      backdrop.querySelector('#student-computer').value = existing && existing.computador !== '--' ? existing.computador : '';
      backdrop.querySelector('#student-joys').value = existing ? Number(existing.joys || 0) : 0;
      var completedModuleIds = existing && existing.modulosConcluidosIds ? existing.modulosConcluidosIds.map(String) : [];
      var completedModulesContainer = backdrop.querySelector('#student-completed-modules');
      D.modules.forEach(function (module) {
        var optionLabel = document.createElement('label');
        optionLabel.className = 'admin-check-option';
        var optionCheckbox = document.createElement('input');
        optionCheckbox.type = 'checkbox';
        optionCheckbox.value = String(module.id);
        optionCheckbox.checked = completedModuleIds.indexOf(String(module.id)) !== -1;
        var optionText = document.createElement('span');
        optionText.textContent = module.level + ' · ' + module.name;
        optionLabel.appendChild(optionCheckbox);
        optionLabel.appendChild(optionText);
        completedModulesContainer.appendChild(optionLabel);
      });
      function protectCurrentModule() {
        completedModulesContainer.querySelectorAll('input').forEach(function (checkbox) {
          checkbox.disabled = checkbox.value === moduleSelect.value;
          if (checkbox.disabled) checkbox.checked = false;
        });
      }
      moduleSelect.addEventListener('change', protectCurrentModule);
      protectCurrentModule();
    } else {
      backdrop.querySelector('#employee-role').value = existing ? existing.role : 'teacher';
    }

    if (isCurrentAccount) {
      accountStatusSelect.disabled = true;
      backdrop.querySelector('#employee-role').disabled = true;
    }

    function closeModal() {
      document.removeEventListener('keydown', onKeyDown);
      backdrop.remove();
    }

    function onKeyDown(event) {
      if (event.key === 'Escape') closeModal();
    }

    document.addEventListener('keydown', onKeyDown);
    backdrop.querySelectorAll('[data-modal-close]').forEach(function (button) {
      button.addEventListener('click', closeModal);
    });
    backdrop.addEventListener('click', function (event) {
      if (event.target === backdrop) closeModal();
    });

    form.addEventListener('submit', async function (event) {
      event.preventDefault();
      errorBox.hidden = true;

      if (passwordInput.value !== passwordConfirmInput.value) {
        errorBox.textContent = 'A confirmação da senha não corresponde à senha informada.';
        errorBox.hidden = false;
        passwordConfirmInput.focus();
        return;
      }

      var payload = {
        id: existing ? existing.id : null,
        name: nameInput.value.trim(),
        email: emailInput.value.trim(),
        role: isStudent ? 'student' : (isCurrentAccount ? existing.role : backdrop.querySelector('#employee-role').value),
        status: isCurrentAccount ? 'active' : accountStatusSelect.value,
      };
      if (passwordInput.value) payload.password = passwordInput.value;

      if (isStudent) {
        payload.class_id = backdrop.querySelector('#student-class').value || null;
        payload.module_id = backdrop.querySelector('#student-module').value || null;
        payload.computer_number = backdrop.querySelector('#student-computer').value.trim();
        payload.student_status = backdrop.querySelector('#student-status').value;
        payload.gender = backdrop.querySelector('#student-gender').value;
        payload.joy_balance = backdrop.querySelector('#student-joys').value || 0;
        payload.completed_module_ids = Array.prototype.map.call(
          backdrop.querySelectorAll('#student-completed-modules input:checked'),
          function (checkbox) { return checkbox.value; }
        );
      }

      saveButton.disabled = true;
      saveButton.textContent = 'Salvando...';
      try {
        await persist(isStudent ? 'student' : 'employee', payload, navigate);
        closeModal();
      } catch (error) {
        errorBox.textContent = error.message;
        errorBox.hidden = false;
        saveButton.disabled = false;
        saveButton.textContent = 'Salvar ' + entityLabel;
      }
    });

    window.setTimeout(function () { nameInput.focus(); }, 0);
  }

  function administrationSectionFor(entity) {
    if (entity === 'semester') return 'semesters';
    if (entity === 'medal') return 'medals';
    if (['lab-kit', 'kit-assignment', 'student-material'].indexOf(entity) !== -1) return 'laboratory';
    if (['mission-prerequisite', 'mission-support'].indexOf(entity) !== -1) return 'content';
    if (entity === 'pedagogical-note') return 'notes';
    return 'semesters';
  }

  function advancedCollection(entity, D) {
    return {
      semester: D.semesters,
      medal: D.medals,
      'lab-kit': D.labKits,
      'kit-assignment': D.kitAssignments,
      'student-material': D.personalMaterials,
      'pedagogical-note': D.pedagogicalNotes,
    }[entity] || [];
  }

  function openAdvancedModal(entity, existing, D, navigate) {
    var definitions = {
      semester: { title: existing ? 'Editar semestre' : 'Novo semestre', submit: 'Salvar semestre' },
      medal: { title: existing ? 'Editar medalha' : 'Nova medalha', submit: 'Salvar medalha' },
      'lab-kit': { title: existing ? 'Editar kit' : 'Novo kit', submit: 'Salvar kit' },
      'kit-assignment': { title: existing ? 'Editar vínculo de kit' : 'Vincular kit ao aluno', submit: 'Salvar vínculo' },
      'student-material': { title: existing ? 'Editar material' : 'Adicionar material pessoal', submit: 'Salvar material' },
      'pedagogical-note': { title: existing ? 'Editar observação' : 'Nova observação pedagógica', submit: 'Salvar observação' },
      'mission-prerequisite': { title: 'Novo pré-requisito', submit: 'Criar vínculo' },
      'mission-support': { title: 'Enviar arquivo de apoio', submit: 'Enviar arquivo' },
    };
    var definition = definitions[entity];
    if (!definition) return;

    var fields = '';
    if (entity === 'semester') {
      fields = '<div class="form-group admin-form-span-2"><label class="form-label" for="advanced-name">Nome</label><input class="form-input" id="advanced-name" maxlength="100" required></div><div class="form-group"><label class="form-label" for="advanced-start">Data inicial</label><input class="form-input" id="advanced-start" type="date" required></div><div class="form-group"><label class="form-label" for="advanced-end">Data final</label><input class="form-input" id="advanced-end" type="date" required></div><div class="form-group"><label class="form-label" for="advanced-status">Status</label><select class="form-select" id="advanced-status"><option value="planned">Planejado</option><option value="active">Ativo</option><option value="closed">Encerrado</option><option value="archived">Arquivado</option></select></div>';
    } else if (entity === 'medal') {
      fields = '<div class="form-group"><label class="form-label" for="advanced-icon">Ícone</label><input class="form-input" id="advanced-icon" maxlength="30" placeholder="🏅"></div><div class="form-group"><label class="form-label" for="advanced-name">Nome</label><input class="form-input" id="advanced-name" maxlength="100" required></div><div class="form-group admin-form-span-2"><label class="form-label" for="advanced-description">Descrição</label><textarea class="form-textarea" id="advanced-description" maxlength="255" rows="3"></textarea></div><div class="form-group"><label class="form-label" for="advanced-criteria">Critério</label><select class="form-select" id="advanced-criteria"><option value="manual">Concessão manual</option><option value="first_submission">Primeira entrega</option><option value="stl_upload">Enviar STL</option><option value="approved_count">Quantidade aprovada</option><option value="module_complete">Concluir módulo</option><option value="progress_percent">Percentual de progresso</option></select></div><div class="form-group"><label class="form-label" for="advanced-value">Valor do critério</label><input class="form-input" id="advanced-value" type="number" min="0"></div><div class="form-group"><label class="form-label" for="advanced-joys">Joys adicionais</label><input class="form-input" id="advanced-joys" type="number" min="0" max="10000" value="0"></div><div class="form-group"><label class="form-label" for="advanced-status">Status</label><select class="form-select" id="advanced-status"><option value="active">Ativa</option><option value="inactive">Inativa</option></select></div>';
    } else if (entity === 'lab-kit') {
      fields = '<div class="form-group"><label class="form-label" for="advanced-code">Código</label><input class="form-input" id="advanced-code" maxlength="50"></div><div class="form-group"><label class="form-label" for="advanced-name">Nome</label><input class="form-input" id="advanced-name" maxlength="120" required></div><div class="form-group admin-form-span-2"><label class="form-label" for="advanced-description">Descrição</label><textarea class="form-textarea" id="advanced-description" maxlength="500" rows="2"></textarea></div><div class="form-group admin-form-span-2"><label class="form-label" for="advanced-items">Componentes</label><textarea class="form-textarea" id="advanced-items" rows="6" placeholder="Arduino Uno | 1 | Observação&#10;Cabo USB | 2"></textarea><span class="form-help">Um item por linha: nome | quantidade | observação.</span></div><div class="form-group"><label class="form-label" for="advanced-status">Status</label><select class="form-select" id="advanced-status"><option value="active">Ativo</option><option value="inactive">Inativo</option></select></div>';
    } else if (entity === 'kit-assignment') {
      fields = '<div class="form-group"><label class="form-label" for="advanced-student">Aluno</label><select class="form-select" id="advanced-student" required></select></div><div class="form-group"><label class="form-label" for="advanced-kit">Kit</label><select class="form-select" id="advanced-kit" required></select></div><div class="form-group"><label class="form-label" for="advanced-module">Módulo relacionado</label><select class="form-select" id="advanced-module"></select></div><div class="form-group"><label class="form-label" for="advanced-status">Status</label><select class="form-select" id="advanced-status"><option value="active">Em uso</option><option value="returned">Devolvido</option><option value="maintenance">Manutenção</option><option value="lost">Extraviado</option></select></div><div class="form-group admin-form-span-2"><label class="form-label" for="advanced-notes">Observações</label><textarea class="form-textarea" id="advanced-notes" maxlength="500" rows="3"></textarea></div>';
    } else if (entity === 'student-material') {
      fields = '<div class="form-group"><label class="form-label" for="advanced-student">Aluno</label><select class="form-select" id="advanced-student" required></select></div><div class="form-group"><label class="form-label" for="advanced-name">Material</label><input class="form-input" id="advanced-name" maxlength="120" required></div><div class="form-group"><label class="form-label" for="advanced-quantity">Quantidade</label><input class="form-input" id="advanced-quantity" type="number" min="1" value="1" required></div><div class="form-group"><label class="form-label" for="advanced-status">Status</label><select class="form-select" id="advanced-status"><option value="active">Ativo</option><option value="inactive">Inativo</option></select></div><div class="form-group admin-form-span-2"><label class="form-label" for="advanced-notes">Observações</label><textarea class="form-textarea" id="advanced-notes" maxlength="500" rows="3"></textarea></div>';
    } else if (entity === 'pedagogical-note') {
      fields = '<div class="form-group"><label class="form-label" for="advanced-student">Aluno</label><select class="form-select" id="advanced-student" required></select></div><div class="form-group"><label class="form-label" for="advanced-visibility">Visibilidade</label><select class="form-select" id="advanced-visibility"><option value="staff">Toda a equipe</option><option value="supervision">Somente supervisão</option></select></div><div class="form-group admin-form-span-2"><label class="form-label" for="advanced-note">Observação</label><textarea class="form-textarea" id="advanced-note" maxlength="10000" rows="7" required></textarea></div>';
    } else if (entity === 'mission-prerequisite') {
      fields = '<div class="form-group admin-form-span-2"><label class="form-label" for="advanced-mission">Missão que ficará bloqueada</label><select class="form-select" id="advanced-mission" required></select></div><div class="form-group admin-form-span-2"><label class="form-label" for="advanced-prerequisite">Missão que deve ser concluída antes</label><select class="form-select" id="advanced-prerequisite" required></select></div><p class="admin-form-note admin-form-span-2">O sistema impede dependências circulares entre missões.</p>';
    } else if (entity === 'mission-support') {
      fields = '<div class="form-group admin-form-span-2"><label class="form-label" for="advanced-mission">Missão</label><select class="form-select" id="advanced-mission" required></select></div><div class="form-group admin-form-span-2"><label class="form-label" for="advanced-file">Arquivo</label><input class="form-input" id="advanced-file" type="file" accept=".ino,.cpp,.c,.h,.stl,.pdf,.png,.jpg,.jpeg,.zip" required><span class="form-help">Até 5 MB. Formatos de código, STL, PDF, imagem ou ZIP.</span></div>';
    }

    var backdrop = document.createElement('div');
    backdrop.className = 'admin-modal-backdrop';
    backdrop.innerHTML = '<section class="admin-modal" role="dialog" aria-modal="true"><div class="admin-modal-header"><div><h2>' + definition.title + '</h2><p class="text-sm text-muted">Os dados serão gravados no banco do sistema.</p></div><button type="button" class="btn btn-ghost btn-icon" data-modal-close aria-label="Fechar">' + window.Icons.render('x', 18) + '</button></div><form id="advanced-admin-form"><div class="admin-modal-body"><div class="admin-user-form-grid">' + fields + '</div><div class="admin-form-error" id="advanced-admin-error" role="alert" hidden></div></div><div class="admin-modal-footer"><button type="button" class="btn btn-ghost" data-modal-close>Cancelar</button><button type="submit" class="btn btn-primary" id="advanced-admin-save">' + definition.submit + '</button></div></form></section>';
    document.body.appendChild(backdrop);

    function value(id, fallback) {
      var element = backdrop.querySelector(id);
      return element ? element.value : (fallback || '');
    }
    function setValue(id, fieldValue) {
      var element = backdrop.querySelector(id);
      if (element && fieldValue !== undefined && fieldValue !== null) element.value = fieldValue;
    }
    function populateSelect(id, items, selected, label) {
      var select = backdrop.querySelector(id);
      if (!select) return;
      appendOption(select, '', 'Selecione...', selected);
      (items || []).forEach(function (item) { appendOption(select, item.id, label(item), selected); });
    }

    if (entity === 'semester') {
      setValue('#advanced-name', existing && existing.name);
      setValue('#advanced-start', existing && existing.startDate);
      setValue('#advanced-end', existing && existing.endDate);
      setValue('#advanced-status', existing ? existing.status : 'planned');
    } else if (entity === 'medal') {
      setValue('#advanced-icon', existing ? existing.icone : '🏅');
      setValue('#advanced-name', existing && existing.nome);
      setValue('#advanced-description', existing && existing.descricao);
      setValue('#advanced-criteria', existing ? existing.criterioTipo : 'manual');
      setValue('#advanced-value', existing && existing.criterioValor);
      setValue('#advanced-joys', existing ? existing.joys : 0);
      setValue('#advanced-status', existing && existing.status === 'inativa' ? 'inactive' : 'active');
    } else if (entity === 'lab-kit') {
      setValue('#advanced-code', existing && existing.code);
      setValue('#advanced-name', existing && existing.name);
      setValue('#advanced-description', existing && existing.description);
      setValue('#advanced-status', existing ? existing.status : 'active');
      setValue('#advanced-items', existing ? (existing.items || []).map(function (item) { return item.name + ' | ' + item.quantity + (item.notes ? ' | ' + item.notes : ''); }).join('\n') : '');
    } else if (entity === 'kit-assignment') {
      populateSelect('#advanced-student', D.students, existing && existing.studentId, function (item) { return item.name + ' · ' + item.turma; });
      populateSelect('#advanced-kit', D.labKits, existing && existing.kitId, function (item) { return item.name; });
      populateSelect('#advanced-module', D.modules, existing && existing.moduleId, function (item) { return item.name; });
      setValue('#advanced-status', existing ? existing.status : 'active');
      setValue('#advanced-notes', existing && existing.notes);
    } else if (entity === 'student-material') {
      populateSelect('#advanced-student', D.students, existing && existing.studentId, function (item) { return item.name + ' · ' + item.turma; });
      setValue('#advanced-name', existing && existing.name);
      setValue('#advanced-quantity', existing ? existing.quantity : 1);
      setValue('#advanced-status', existing ? existing.status : 'active');
      setValue('#advanced-notes', existing && existing.notes);
    } else if (entity === 'pedagogical-note') {
      populateSelect('#advanced-student', D.students, existing && existing.studentId, function (item) { return item.name + ' · ' + item.turma; });
      setValue('#advanced-visibility', existing ? existing.visibility : 'staff');
      setValue('#advanced-note', existing && existing.note);
    } else if (entity === 'mission-prerequisite' || entity === 'mission-support') {
      populateSelect('#advanced-mission', D.missions, '', function (item) { return item.titulo + ' · ' + item.modulo; });
      if (entity === 'mission-prerequisite') populateSelect('#advanced-prerequisite', D.missions, '', function (item) { return item.titulo + ' · ' + item.modulo; });
    }

    function closeModal() {
      document.removeEventListener('keydown', onKeyDown);
      backdrop.remove();
    }
    function onKeyDown(event) { if (event.key === 'Escape') closeModal(); }
    document.addEventListener('keydown', onKeyDown);
    backdrop.querySelectorAll('[data-modal-close]').forEach(function (button) { button.addEventListener('click', closeModal); });
    backdrop.addEventListener('click', function (event) { if (event.target === backdrop) closeModal(); });

    backdrop.querySelector('#advanced-admin-form').addEventListener('submit', async function (event) {
      event.preventDefault();
      var errorBox = backdrop.querySelector('#advanced-admin-error');
      var saveButton = backdrop.querySelector('#advanced-admin-save');
      errorBox.hidden = true;
      saveButton.disabled = true;
      saveButton.textContent = 'Salvando...';
      try {
        var response;
        var payload = { id: existing ? existing.id : null };
        if (entity === 'semester') {
          payload.name = value('#advanced-name').trim(); payload.start_date = value('#advanced-start'); payload.end_date = value('#advanced-end'); payload.status = value('#advanced-status');
        } else if (entity === 'medal') {
          payload.name = value('#advanced-name').trim(); payload.description = value('#advanced-description').trim(); payload.icon = value('#advanced-icon').trim() || '🏅'; payload.criteria_type = value('#advanced-criteria'); payload.criteria_value = value('#advanced-value') || null; payload.joys_reward = value('#advanced-joys') || 0; payload.status = value('#advanced-status');
        } else if (entity === 'lab-kit') {
          payload.code = value('#advanced-code').trim(); payload.name = value('#advanced-name').trim(); payload.description = value('#advanced-description').trim(); payload.items = value('#advanced-items'); payload.status = value('#advanced-status');
        } else if (entity === 'kit-assignment') {
          payload.student_id = value('#advanced-student'); payload.kit_id = value('#advanced-kit'); payload.module_id = value('#advanced-module') || null; payload.status = value('#advanced-status'); payload.notes = value('#advanced-notes').trim();
        } else if (entity === 'student-material') {
          payload.student_id = value('#advanced-student'); payload.name = value('#advanced-name').trim(); payload.quantity = value('#advanced-quantity'); payload.status = value('#advanced-status'); payload.notes = value('#advanced-notes').trim();
        } else if (entity === 'pedagogical-note') {
          payload.student_id = value('#advanced-student'); payload.visibility = value('#advanced-visibility'); payload.note = value('#advanced-note').trim();
        } else if (entity === 'mission-prerequisite') {
          payload.mission_id = value('#advanced-mission'); payload.prerequisite_mission_id = value('#advanced-prerequisite'); payload.enabled = true;
        }
        if (entity === 'mission-support') {
          var fileInput = backdrop.querySelector('#advanced-file');
          var formData = new FormData();
          formData.append('mission_id', value('#advanced-mission'));
          formData.append('file', fileInput.files[0]);
          response = await window.CreateJoyApi.uploadMissionSupport(formData);
        } else {
          response = await window.CreateJoyApi.saveEntity(entity, payload);
        }
        window.CreateJoyApp.updateData(response.data);
        activeAdministrationSection = administrationSectionFor(entity);
        closeModal();
        navigate('administration');
      } catch (error) {
        errorBox.textContent = error.message;
        errorBox.hidden = false;
        saveButton.disabled = false;
        saveButton.textContent = definition.submit;
      }
    });
  }

  async function editClass(existing, D, navigate, toggleOnly) {
    if (toggleOnly) {
      await persist('class', {
        id: existing.id,
        name: existing.nome,
        teacher_user_id: existing.professorId,
        semester_id: existing.semestreId,
        schedule: existing.horarios === 'Não definido' ? '' : existing.horarios,
        status: existing.status === 'ativa' ? 'inactive' : 'active',
        module_ids: existing.moduloIds || [],
      }, navigate);
      return;
    }
    return openCoreEntityForm('class', existing, D, navigate);
  }

  function bind(page, navigate, D) {
    if (page === 'achievements') {
      window.AchievementPages.bind(navigate, D);
      return;
    }
    if (page === 'student-detail' || page === 'course-progress' || page === 'submissions') {
      var teacherPage = page === 'course-progress' ? 'missions' : page;
      window.TeacherPages.bind(teacherPage, function (target) {
        navigate(target === 'missions' ? 'course-progress' : target);
      }, D);
      return;
    }
    var rawD = window.CreateJoyApp.getRawData();
    document.querySelectorAll('[data-nav]').forEach(function (el) {
      el.addEventListener('click', function () { navigate(el.getAttribute('data-nav')); });
    });

    if (page === 'dashboard') {
      document.querySelectorAll('[data-financial-task-open]').forEach(function (button) {
        button.addEventListener('click', function () {
          var taskId = Number(button.getAttribute('data-financial-task-open'));
          var selected = null;
          ((D.reenrollment && D.reenrollment.contracts) || []).some(function (contract) {
            var reminder = (contract.reminders || []).filter(function (item) { return Number(item.id) === taskId; })[0];
            if (!reminder) return false;
            selected = { contract: contract, reminder: reminder };
            return true;
          });
          if (selected) openFinancialTaskModal(selected);
        });
      });
      document.querySelectorAll('[data-financial-pdf]').forEach(function (input) {
        input.addEventListener('change', function () {
          var label = input.closest('.finance-pdf-upload');
          var text = label ? label.querySelector('span') : null;
          if (text && input.files && input.files[0]) {
            text.textContent = input.files[0].name;
          }
        });
      });
      document.querySelectorAll('[data-financial-task-complete]').forEach(function (button) {
        button.addEventListener('click', async function () {
          var taskId = Number(button.getAttribute('data-financial-task-complete'));
          var taskCard = button.closest('[data-financial-task]');
          var fileInput = taskCard ? taskCard.querySelector('[data-financial-pdf]') : null;
          var file = fileInput && fileInput.files ? fileInput.files[0] : null;
          var requiresPdf = button.getAttribute('data-requires-pdf') === '1';
          var hasAttachment = button.getAttribute('data-has-attachment') === '1';
          if (requiresPdf && !hasAttachment && !file) {
            window.CreateJoyUI.alert('Selecione o PDF do carnê antes de concluir a tarefa.', 'warning');
            if (fileInput) fileInput.focus();
            return;
          }
          if (file && (!/\.pdf$/i.test(file.name) || (file.type && file.type !== 'application/pdf'))) {
            window.CreateJoyUI.alert('Escolha um arquivo PDF válido.', 'warning');
            return;
          }
          if (file && file.size > 5 * 1024 * 1024) {
            window.CreateJoyUI.alert('O PDF deve ter no máximo 5 MB.', 'warning');
            return;
          }
          button.disabled = true;
          try {
            var payload = await window.CreateJoyApi.completeReenrollmentReminder(taskId, true, file);
            window.CreateJoyApp.updateData(payload.data);
            window.CreateJoyUI.toast(payload.message, 'success');
            navigate('dashboard');
          } catch (error) {
            button.disabled = false;
            window.CreateJoyUI.alert(error.message, 'error');
          }
        });
      });
    }

    if (page === 'reenrollment') {
      var searchInput = document.getElementById('reenrollment-search');
      var statusFilter = document.getElementById('reenrollment-status-filter');
      var paymentFilter = document.getElementById('reenrollment-payment-filter');
      var actionFilter = document.getElementById('reenrollment-action-filter');
      if (searchInput) searchInput.value = reenrollmentListState.search;
      if (statusFilter) statusFilter.value = reenrollmentListState.status;
      if (paymentFilter) paymentFilter.value = reenrollmentListState.payment;
      if (actionFilter) actionFilter.value = reenrollmentListState.action;
      var contractPager = window.CreateJoyUI.bindPagedList({
        itemSelector: '[data-reenrollment-row]',
        pagerId: 'reenrollment-pagination',
        emptyId: 'reenrollment-empty',
        perPage: 15,
        display: 'table-row',
        initialPage: reenrollmentListState.page,
        onPageChange: function (currentPage) { reenrollmentListState.page = currentPage; },
        matches: function (row) {
          var query = searchInput ? searchInput.value.trim().toLowerCase() : '';
          var statusOk = !statusFilter || statusFilter.value === 'all' || row.getAttribute('data-contract-status') === statusFilter.value;
          var paymentOk = !paymentFilter || paymentFilter.value === 'all' || row.getAttribute('data-payment-method') === paymentFilter.value;
          var actionOk = !actionFilter || actionFilter.value === 'all' || row.getAttribute('data-billing-action') === actionFilter.value;
          return statusOk && paymentOk && actionOk && (!query || row.getAttribute('data-search').indexOf(query) !== -1);
        },
      });
      [searchInput, statusFilter, paymentFilter, actionFilter].forEach(function (control) {
        if (!control) return;
        control.addEventListener(control.tagName === 'INPUT' ? 'input' : 'change', function () {
          reenrollmentListState.search = searchInput ? searchInput.value : '';
          reenrollmentListState.status = statusFilter ? statusFilter.value : 'all';
          reenrollmentListState.payment = paymentFilter ? paymentFilter.value : 'all';
          reenrollmentListState.action = actionFilter ? actionFilter.value : 'all';
          reenrollmentListState.page = 1;
          contractPager.refresh(true);
        });
      });
      document.querySelectorAll('[data-reenrollment-open]').forEach(function (button) {
        button.addEventListener('click', function () {
          var studentId = Number(button.getAttribute('data-reenrollment-open'));
          var contract = (((rawD.reenrollment || {}).contracts) || []).filter(function (item) { return Number(item.studentId) === studentId; })[0];
          if (contract) openReenrollmentModal(contract, rawD, navigate);
        });
      });
      document.querySelectorAll('[data-reenrollment-action-open]').forEach(function (button) {
        button.addEventListener('click', function () {
          var studentId = Number(button.getAttribute('data-reenrollment-action-open'));
          var contract = (((rawD.reenrollment || {}).contracts) || []).filter(function (item) { return Number(item.studentId) === studentId; })[0];
          if (contract) openReenrollmentModal(contract, rawD, navigate);
        });
      });
      document.querySelectorAll('[data-reenrollment-reminder-complete]').forEach(function (button) {
        button.addEventListener('click', async function () {
          button.disabled = true;
          try {
            var payload = await window.CreateJoyApi.completeReenrollmentReminder(Number(button.getAttribute('data-reenrollment-reminder-complete')), true);
            window.CreateJoyApp.updateData(payload.data);
            window.CreateJoyUI.toast(payload.message, 'success');
            navigate('reenrollment');
          } catch (error) {
            button.disabled = false;
            window.CreateJoyUI.alert(error.message, 'error');
          }
        });
      });
    }

    if (page === 'profile') {
      var managementForm = document.getElementById('management-profile-form');
      var managementPhoto = document.getElementById('management-profile-photo');
      if (managementPhoto) managementPhoto.addEventListener('change', function () {
        if (!managementPhoto.files.length) return;
        var file = managementPhoto.files[0];
        if (file.size > 1572864) {
          window.CreateJoyUI.alert('A foto deve ter no máximo 1,5 MB.', 'error', 'Foto muito grande');
          managementPhoto.value = '';
          return;
        }
        var reader = new FileReader();
        reader.onload = function () { document.getElementById('management-profile-avatar').innerHTML = '<img class="avatar avatar-xl profile-avatar" src="' + reader.result + '" alt="Prévia da nova foto" />'; };
        reader.readAsDataURL(file);
        document.getElementById('management-profile-photo-name').textContent = file.name;
      });
      if (managementForm) managementForm.addEventListener('submit', async function (event) {
        event.preventDefault();
        var submitButton = managementForm.querySelector('button[type="submit"]');
        var originalLabel = submitButton.innerHTML;
        var formData = new FormData();
        formData.append('name', document.getElementById('management-profile-name').value.trim());
        formData.append('email', document.getElementById('management-profile-email').value.trim());
        formData.append('phone', document.getElementById('management-profile-phone').value.trim());
        if (managementPhoto.files.length) formData.append('avatar', managementPhoto.files[0]);
        submitButton.disabled = true;
        submitButton.textContent = 'Salvando...';
        try {
          var payload = await window.CreateJoyApi.updateProfile(formData);
          window.CreateJoyApp.updateData(payload.data);
          window.CreateJoyUI.toast(payload.message, 'success');
          navigate('profile');
        } catch (error) {
          window.CreateJoyUI.alert(error.message, 'error');
          submitButton.disabled = false;
          submitButton.innerHTML = originalLabel;
        }
      });
      var managementPasswordButton = document.getElementById('management-change-password-btn');
      var managementPasswordPanel = document.getElementById('management-password-panel');
      var managementPasswordForm = document.getElementById('management-password-form');
      var managementCancelPassword = document.getElementById('management-cancel-password');
      if (managementPasswordButton) managementPasswordButton.addEventListener('click', function () { managementPasswordPanel.style.display = 'block'; document.getElementById('management-current-password').focus(); });
      if (managementCancelPassword) managementCancelPassword.addEventListener('click', function () { managementPasswordForm.reset(); managementPasswordPanel.style.display = 'none'; });
      if (managementPasswordForm) managementPasswordForm.addEventListener('submit', async function (event) {
        event.preventDefault();
        var currentPassword = document.getElementById('management-current-password').value;
        var newPassword = document.getElementById('management-new-password').value;
        var confirmation = document.getElementById('management-confirm-password').value;
        if (newPassword !== confirmation) {
          window.CreateJoyUI.alert('A confirmação não corresponde à nova senha.', 'error');
          return;
        }
        var submitButton = managementPasswordForm.querySelector('button[type="submit"]');
        submitButton.disabled = true;
        submitButton.textContent = 'Salvando...';
        try {
          await window.CreateJoyApi.changePassword(currentPassword, newPassword);
          managementPasswordForm.reset();
          managementPasswordPanel.style.display = 'none';
          window.CreateJoyUI.toast('Senha alterada com sucesso.', 'success');
        } catch (error) {
          window.CreateJoyUI.alert(error.message, 'error');
        }
        submitButton.disabled = false;
        submitButton.textContent = 'Salvar nova senha';
      });
    }

    if (page === 'store-requests') {
      var requestFilter = document.getElementById('store-request-filter');
      var requestSearch = document.getElementById('store-request-search');
      var requestPager = window.CreateJoyUI.bindPagedList({ itemSelector: '[data-store-admin-status]', pagerId: 'store-request-pagination', emptyId: 'store-admin-filter-empty', perPage: 8, display: 'grid', matches: function (card) {
        var statusMatches = !requestFilter || requestFilter.value === 'all' || card.getAttribute('data-store-admin-status') === requestFilter.value;
        var query = requestSearch ? requestSearch.value.trim().toLowerCase() : '';
        return statusMatches && (!query || card.getAttribute('data-store-admin-search').indexOf(query) !== -1);
      } });
      if (requestFilter) requestFilter.addEventListener('change', function () { requestPager.refresh(true); });
      if (requestSearch) requestSearch.addEventListener('input', function () { requestPager.refresh(true); });

      document.querySelectorAll('[data-store-review]').forEach(function (button) {
        button.addEventListener('click', function () {
          var requestId = parseInt(button.getAttribute('data-id'), 10);
          var request = (D.storeRequests || []).filter(function (item) { return Number(item.id) === requestId; })[0];
          if (!request) {
            window.alert('Solicitação não encontrada. Atualize a página e tente novamente.');
            return;
          }
          openStoreReviewModal(request, button.getAttribute('data-store-review'), navigate);
        });
      });
    }

    if (page === 'store-products') {
      var productSearch = document.getElementById('admin-product-search');
      var productStatus = document.getElementById('admin-product-status');
      var productPager = window.CreateJoyUI.bindPagedList({ itemSelector: '[data-admin-product-card]', pagerId: 'admin-product-pagination', emptyId: 'admin-product-empty', perPage: 9, matches: function (card) {
        var query = productSearch ? productSearch.value.trim().toLowerCase() : '';
        var statusOk = !productStatus || productStatus.value === 'all' || card.getAttribute('data-product-status') === productStatus.value;
        return statusOk && (!query || card.getAttribute('data-search').indexOf(query) !== -1);
      } });
      if (productSearch) productSearch.addEventListener('input', function () { productPager.refresh(true); });
      if (productStatus) productStatus.addEventListener('change', function () { productPager.refresh(true); });
      var addProduct = document.getElementById('add-store-product');
      if (addProduct) addProduct.addEventListener('click', function () { openStoreProductModal(null, rawD, navigate); });
      document.querySelectorAll('[data-store-product-edit]').forEach(function (button) {
        button.addEventListener('click', function () {
          openStoreProductModal(findById(rawD.storeProducts || [], Number(button.getAttribute('data-store-product-edit'))), rawD, navigate);
        });
      });
    }

    if (page === 'administration') {
      document.querySelectorAll('[data-admin-section]').forEach(function (button) {
        button.addEventListener('click', function () {
          activeAdministrationSection = button.getAttribute('data-admin-section');
          document.querySelectorAll('[data-admin-section]').forEach(function (item) { item.classList.toggle('active', item === button); });
          document.querySelectorAll('[data-admin-panel]').forEach(function (panel) {
            panel.style.display = panel.getAttribute('data-admin-panel') === activeAdministrationSection ? 'block' : 'none';
          });
        });
      });

      document.querySelectorAll('[data-advanced-add]').forEach(function (button) {
        button.addEventListener('click', function () {
          openAdvancedModal(button.getAttribute('data-advanced-add'), null, rawD, navigate);
        });
      });

      document.querySelectorAll('[data-advanced-entity]').forEach(function (button) {
        button.addEventListener('click', async function () {
          var entity = button.getAttribute('data-advanced-entity');
          var action = button.getAttribute('data-advanced-action');
          var id = parseInt(button.getAttribute('data-id'), 10);
          var item = findById(advancedCollection(entity, rawD), id);
          if (action === 'edit') {
            openAdvancedModal(entity, item, rawD, navigate);
            return;
          }
          if (!await window.CreateJoyUI.confirm({ title: entity === 'kit-assignment' ? 'Registrar devolução do kit?' : 'Arquivar ou desativar este registro?', message: entity === 'kit-assignment' ? 'O vínculo ativo do kit com o aluno será encerrado e permanecerá no histórico.' : 'O registro permanecerá no histórico do sistema.', confirmLabel: entity === 'kit-assignment' ? 'Registrar devolução' : 'Confirmar alteração', tone: 'warning' })) return;
          try {
            var response = await window.CreateJoyApi.deleteEntity(entity, id);
            window.CreateJoyApp.updateData(response.data);
            activeAdministrationSection = administrationSectionFor(entity);
            navigate('administration');
          } catch (error) {
            window.alert(error.message);
          }
        });
      });

      document.querySelectorAll('[data-prerequisite-remove]').forEach(function (button) {
        button.addEventListener('click', async function () {
          if (!await window.CreateJoyUI.confirm({ title: 'Remover este pré-requisito?', message: 'A missão deixará de depender desta etapa para ser liberada.', confirmLabel: 'Remover pré-requisito', tone: 'warning' })) return;
          try {
            var response = await window.CreateJoyApi.saveEntity('mission-prerequisite', {
              mission_id: button.getAttribute('data-mission-id'),
              prerequisite_mission_id: button.getAttribute('data-prerequisite-id'),
              enabled: false,
            });
            window.CreateJoyApp.updateData(response.data);
            activeAdministrationSection = 'content';
            navigate('administration');
          } catch (error) {
            window.alert(error.message);
          }
        });
      });
    }

    var addHandlers = {
      'add-module-btn': function () { return editModule(null, rawD, navigate); },
      'add-mission-btn': function () { return editMission(null, rawD, navigate); },
      'add-activity-btn': function () { return editActivity(null, rawD, navigate); },
      'add-employee-btn': function () { return openUserModal('employee', null, rawD, navigate); },
      'add-student-btn': function () { return openUserModal('student', null, rawD, navigate); },
      'add-class-btn': function () { return editClass(null, rawD, navigate, false); },
    };
    Object.keys(addHandlers).forEach(function (id) {
      var button = document.getElementById(id);
      if (button) {
        button.addEventListener('click', function () {
          var operation = addHandlers[id]();
          if (operation && typeof operation.catch === 'function') {
            operation.catch(function (error) { window.alert(error.message); });
          }
        });
      }
    });

    var adminScope = document.querySelector('.page-body');
    if (adminScope) {
      adminScope.addEventListener('click', function (event) {
        var button = event.target.closest('[data-admin-entity]');
        if (!button || !adminScope.contains(button)) return;
        var entity = button.getAttribute('data-admin-entity');
        var action = button.getAttribute('data-admin-action');
        var id = parseInt(button.getAttribute('data-id'), 10);
        var collection = {
          module: rawD.modules,
          mission: rawD.missions,
          activity: rawD.activities,
          employee: rawD.employees,
          teacher: rawD.teachers,
          student: rawD.students,
          class: rawD.classes,
        }[entity] || [];
        var item = findById(collection, id);
        var operation;
        if (entity === 'student' && action === 'view') {
          rawD.selectedStudentId = id;
          navigate('student-detail');
          return;
        } else if (entity === 'student' && action === 'permanent-delete') {
          operation = permanentlyDeleteStudent(item, navigate);
        } else if (action === 'delete' || action === 'deactivate') {
          operation = remove(entity, id, navigate);
        } else if (entity === 'module') {
          operation = editModule(item, rawD, navigate);
        } else if (entity === 'mission') {
          operation = editMission(item, rawD, navigate);
        } else if (entity === 'activity') {
          operation = editActivity(item, rawD, navigate);
        } else if (entity === 'employee') {
          operation = openUserModal('employee', item, rawD, navigate);
        } else if (entity === 'student') {
          operation = openUserModal('student', item, rawD, navigate);
        } else if (entity === 'class') {
          operation = editClass(item, rawD, navigate, action === 'toggle');
        }
        if (operation && typeof operation.catch === 'function') {
          operation.catch(function (error) { window.alert(error.message); });
        }
      });
    }

    if (page === 'missions') {
      var search = document.getElementById('mission-search');
      if (search) {
        search.addEventListener('input', function () {
          var q = search.value.toLowerCase();
          var filtered = D.missions.filter(function (m) { return m.titulo.toLowerCase().indexOf(q) !== -1 || m.modulo.toLowerCase().indexOf(q) !== -1; });
          var statusMap = { ativa: 'badge-green', rascunho: 'badge-yellow', arquivada: 'badge-gray' };
          document.getElementById('mission-rows').innerHTML = filtered.map(function (m) {
            return '<tr><td><div><span class="font-semibold text-sm">' + m.titulo + '</span><span style="display:block;font-size:0.75rem;color:var(--gray-500)">' + m.objetivo + '</span></div></td><td><span class="badge badge-blue">' + m.modulo + '</span></td><td class="text-sm text-muted">Aula ' + m.aula + '</td><td><span class="badge ' + (m.tipo === 'obrigatoria' ? 'badge-blue' : 'badge-orange') + '">' + m.tipo + '</span></td><td><span class="badge badge-gray">' + m.entrega.toUpperCase() + '</span></td><td><span class="badge ' + (statusMap[m.status] || 'badge-gray') + '">' + m.status + '</span></td><td><div class="flex gap-1"><button class="btn btn-ghost btn-icon btn-sm" data-admin-entity="mission" data-admin-action="edit" data-id="' + m.id + '">' + window.Icons.render('edit', 14) + '</button><button class="btn btn-ghost btn-icon btn-sm" data-admin-entity="mission" data-admin-action="delete" data-id="' + m.id + '" style="color:var(--error)">' + window.Icons.render('trash', 14) + '</button></div></td></tr>';
          }).join('');
        });
      }
    }

    if (page === 'teachers') {
      var tSearch = document.getElementById('employee-search');
      var tRole = document.getElementById('employee-role');
      var tStatus = document.getElementById('employee-status');
      var employeePager = window.CreateJoyUI.bindPagedList({ itemSelector: '[data-admin-employee-row]', pagerId: 'employee-pagination', emptyId: 'employee-empty', perPage: 12, display: 'table-row', matches: function (row) {
        var query = tSearch ? tSearch.value.trim().toLowerCase() : '';
        var roleOk = !tRole || tRole.value === 'all' || row.getAttribute('data-role') === tRole.value;
        var statusOk = !tStatus || tStatus.value === 'all' || row.getAttribute('data-account-status') === tStatus.value;
        return roleOk && statusOk && (!query || row.getAttribute('data-search').indexOf(query) !== -1);
      } });
      if (tSearch) tSearch.addEventListener('input', function () { employeePager.refresh(true); });
      if (tRole) tRole.addEventListener('change', function () { employeePager.refresh(true); });
      if (tStatus) tStatus.addEventListener('change', function () { employeePager.refresh(true); });
    }

    if (page === 'students') {
      var sSearch = document.getElementById('student-search');
      var sClass = document.getElementById('admin-student-class');
      var sStatus = document.getElementById('admin-student-status');
      var sGender = document.getElementById('admin-student-gender');
      var studentPager = window.CreateJoyUI.bindPagedList({ itemSelector: '[data-admin-student-row]', pagerId: 'admin-student-pagination', emptyId: 'admin-student-empty', perPage: 12, display: 'table-row', matches: function (row) {
        var query = sSearch ? sSearch.value.trim().toLowerCase() : '';
        var classOk = !sClass || sClass.value === 'all' || row.getAttribute('data-class-id') === sClass.value;
        var statusOk = !sStatus || sStatus.value === 'all' || row.getAttribute('data-account-status') === sStatus.value;
        var genderOk = !sGender || sGender.value === 'all' || row.getAttribute('data-gender') === sGender.value;
        return classOk && statusOk && genderOk && (!query || row.getAttribute('data-search').indexOf(query) !== -1);
      } });
      if (sSearch) sSearch.addEventListener('input', function () { studentPager.refresh(true); });
      if (sClass) sClass.addEventListener('change', function () { studentPager.refresh(true); });
      if (sStatus) sStatus.addEventListener('change', function () { studentPager.refresh(true); });
      if (sGender) sGender.addEventListener('change', function () { studentPager.refresh(true); });
    }

    if (page === 'permissions') {
      document.querySelectorAll('.perm-toggle').forEach(function (btn) {
        btn.addEventListener('click', async function () {
          if (btn.disabled) return;
          btn.disabled = true;
          try {
            var payload = await window.CreateJoyApi.savePermission(
              btn.getAttribute('data-role'),
              btn.getAttribute('data-perm'),
              btn.getAttribute('data-allowed') !== '1'
            );
            window.CreateJoyApp.updateData(payload.data);
            navigate('permissions');
          } catch (error) {
            btn.disabled = false;
            window.alert(error.message);
          }
        });
      });
    }

    if (page === 'reports') {
      document.querySelectorAll('.tab-btn[data-tab]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          document.querySelectorAll('.tab-btn[data-tab]').forEach(function (b) { b.classList.remove('active'); });
          btn.classList.add('active');
          var tab = btn.getAttribute('data-tab');
          ['alunos', 'turmas', 'missoes', 'desempenho'].forEach(function (t) {
            var el = document.getElementById('report-' + t);
            if (el) el.style.display = t === tab ? 'block' : 'none';
          });
        });
      });
    }
  }

  return { render: render, bind: bind };
})();
