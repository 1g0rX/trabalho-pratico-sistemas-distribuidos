// Teacher pages
window.TeacherPages = (function () {
  'use strict';

  function render(page, navigate, icon, D) {
    switch (page) {
      case 'dashboard': return dashboard(navigate, icon, D);
      case 'classes': return classes(navigate, icon, D);
      case 'missions': return missions(icon, D);
      case 'submissions': return submissions(icon, D);
      case 'students': return studentsList(icon, D);
      case 'student-detail': return studentDetail(icon, D);
      case 'achievements': return window.AchievementPages.render(icon, D);
      case 'feedback': return feedback(icon, D);
      case 'profile': return profile(icon, D);
      default: return dashboard(navigate, icon, D);
    }
  }

  function avatar(person, sizeClass) {
    var classes = 'avatar ' + (sizeClass || 'avatar-sm');
    if (person.fotoUrl) return '<img class="' + classes + '" src="' + person.fotoUrl + '" alt="Foto de ' + person.name + '" style="object-fit:cover" />';
    return '<div class="' + classes + '">' + (person.initials || '?') + '</div>';
  }

  function studentById(D, id) {
    return D.students.filter(function (student) { return Number(student.id) === Number(id); })[0] || null;
  }

  function progressMeta(status) {
    var map = {
      approved: { label: 'Concluída', badge: 'badge-green' },
      submitted: { label: 'Enviada', badge: 'badge-yellow' },
      in_progress: { label: 'Em andamento', badge: 'badge-blue' },
      redo: { label: 'Refazer', badge: 'badge-red' },
      blocked: { label: 'Bloqueada', badge: 'badge-gray' },
      available: { label: 'Disponível', badge: 'badge-blue' },
    };
    return map[status] || map.available;
  }

  function missionProgress(D, classId, missionId, studentId) {
    return (D.teacherMissionProgress || []).filter(function (item) {
      return Number(item.classId) === Number(classId)
        && Number(item.missionId) === Number(missionId)
        && Number(item.studentId) === Number(studentId);
    })[0] || null;
  }

  function joyLabel(value) {
    return Number(value || 0).toLocaleString('pt-BR') + ' Joys';
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function openSubmissionReview(icon, submission, onSaved) {
    if (!submission) return;

    var statusMap = {
      pendente: { label: 'Aguardando avaliação', cls: 'badge-yellow' },
      aprovado: { label: 'Aprovada', cls: 'badge-green' },
      refazer: { label: 'Precisa refazer', cls: 'badge-red' },
      concluido: { label: 'Concluída', cls: 'badge-green' },
    };
    var status = statusMap[submission.status] || statusMap.pendente;
    var files = (submission.arquivosDetalhes || []).map(function (file) {
      return '<a class="teacher-review-file" href="' + file.downloadUrl + '">' +
        '<span>' + icon('download', 16) + '</span><div><strong>' + escapeHtml(file.name) + '</strong><small>Clique para baixar e conferir</small></div>' +
        '</a>';
    }).join('');
    if (!files) {
      files = '<div class="teacher-review-no-files">' + icon('fileText', 18) + '<div><strong>Entrega sem arquivos</strong><span>O aluno enviou o relato e o checklist sem anexar um arquivo.</span></div></div>';
    }

    var backdrop = document.createElement('div');
    backdrop.className = 'admin-modal-backdrop teacher-review-backdrop';
    backdrop.innerHTML =
      '<section class="admin-modal teacher-review-modal" role="dialog" aria-modal="true" aria-labelledby="teacher-review-title">' +
      '<div class="admin-modal-header teacher-review-header"><div><span class="admin-form-kicker">CORREÇÃO DA ENTREGA</span><h2 id="teacher-review-title">' + escapeHtml(submission.missao) + '</h2><p class="text-sm text-muted">Revise tudo antes de aprovar ou solicitar uma nova tentativa.</p></div><button type="button" class="btn btn-ghost btn-icon" data-review-close aria-label="Fechar">' + icon('x', 18) + '</button></div>' +
      '<div class="admin-modal-body"><div class="teacher-review-student">' + (submission.alunoFotoUrl ? '<img class="avatar" src="' + escapeHtml(submission.alunoFotoUrl) + '" alt="Foto de ' + escapeHtml(submission.aluno) + '" style="object-fit:cover" />' : '<div class="avatar">' + escapeHtml(submission.aluno.split(' ').map(function (name) { return name[0]; }).slice(0, 2).join('')) + '</div>') + '<div><span>Aluno</span><strong>' + escapeHtml(submission.aluno) + '</strong><small>' + escapeHtml(submission.turma) + ' · Enviada em ' + escapeHtml(submission.enviadoEm) + ' · Tentativa ' + Number(submission.tentativa || 1) + '</small></div><span class="badge ' + status.cls + '">' + status.label + '</span></div>' +
      '<div class="teacher-review-grid"><section><span class="teacher-review-label">Anotações do aluno</span><div class="teacher-review-answer">' + escapeHtml(submission.anotacao || 'Nenhuma anotação informada.') + '</div></section><section><span class="teacher-review-label">O que aprendeu</span><div class="teacher-review-answer">' + escapeHtml(submission.aprendizado || 'Não informado.') + '</div></section></div>' +
      '<section class="teacher-review-files"><span class="teacher-review-label">Arquivos anexados</span><div>' + files + '</div></section>' +
      '<div class="form-group teacher-review-feedback"><label class="form-label" for="teacher-review-feedback">Feedback para o aluno</label><textarea class="form-textarea" id="teacher-review-feedback" maxlength="5000" rows="5" placeholder="Escreva um retorno claro sobre a entrega. Para solicitar correção, este campo é obrigatório.">' + escapeHtml(submission.feedback || '') + '</textarea><span class="form-help">O aluno verá este comentário junto do status da entrega.</span></div>' +
      '<div class="admin-form-error" id="teacher-review-error" role="alert" hidden></div></div>' +
      '<div class="admin-modal-footer teacher-review-actions"><button type="button" class="btn btn-ghost" data-review-close>Cancelar</button><button type="button" class="btn btn-outline teacher-review-redo" data-review-status="redo">' + icon('alertTriangle', 15) + ' Solicitar correção</button><button type="button" class="btn btn-primary" data-review-status="approved">' + icon('checkCircle', 15) + ' Aprovar entrega</button></div>' +
      '</section>';

    var previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.body.appendChild(backdrop);
    var feedback = backdrop.querySelector('#teacher-review-feedback');
    var errorBox = backdrop.querySelector('#teacher-review-error');

    function closeReview() {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      backdrop.remove();
    }

    function onKeyDown(event) {
      if (event.key === 'Escape') closeReview();
    }

    document.addEventListener('keydown', onKeyDown);
    backdrop.querySelectorAll('[data-review-close]').forEach(function (button) {
      button.addEventListener('click', closeReview);
    });
    backdrop.addEventListener('click', function (event) {
      if (event.target === backdrop) closeReview();
    });
    backdrop.querySelectorAll('[data-review-status]').forEach(function (button) {
      button.addEventListener('click', async function () {
        var reviewStatus = button.getAttribute('data-review-status');
        var reviewFeedback = feedback.value.trim();
        if (reviewStatus === 'redo' && !reviewFeedback) {
          errorBox.textContent = 'Explique o que o aluno precisa corrigir antes de solicitar uma nova tentativa.';
          errorBox.hidden = false;
          feedback.focus();
          return;
        }
        errorBox.hidden = true;
        var buttons = backdrop.querySelectorAll('button');
        buttons.forEach(function (item) { item.disabled = true; });
        var originalLabel = button.innerHTML;
        button.textContent = 'Salvando avaliação...';
        try {
          var payload = await window.CreateJoyApi.reviewSubmission(submission.id, reviewStatus, reviewFeedback);
          window.CreateJoyApp.updateData(payload.data);
          closeReview();
          onSaved();
        } catch (error) {
          errorBox.textContent = error.message;
          errorBox.hidden = false;
          buttons.forEach(function (item) { item.disabled = false; });
          button.innerHTML = originalLabel;
        }
      });
    });
    setTimeout(function () { feedback.focus(); }, 0);
  }

  function dashboard(navigate, icon, D) {
    var pendingSubs = D.submissions.filter(function (s) { return s.status === 'pendente' || s.status === 'refazer'; });
    var statCards = [
      { label: 'Turmas', value: D.classes.length, icon: 'users', color: 'blue' },
      { label: 'Alunos', value: D.students.length, icon: 'user', color: 'orange' },
      { label: 'Entregas Pendentes', value: pendingSubs.length, icon: 'clock', color: 'yellow' },
      { label: 'Missões Ativas', value: D.missions.filter(function (mission) { return mission.status === 'ativa'; }).length, icon: 'target', color: 'green' },
    ].map(function (s) {
      return '<div class="stat-card"><div class="stat-icon ' + s.color + '">' + icon(s.icon, 22) + '</div><div><div class="stat-value">' + s.value + '</div><div class="stat-label">' + s.label + '</div></div></div>';
    }).join('');

    var classCards = D.classes.map(function (c) {
      return '<div class="teacher-dashboard-class"><div class="flex items-center justify-between"><div class="flex items-center gap-3"><div class="stat-icon blue" style="width:40px;height:40px">' + icon('school', 18) + '</div><div><h4>' + c.nome + '</h4><span class="text-xs text-muted">' + c.horarios + '</span></div></div><span class="badge badge-green">' + c.status + '</span></div><div class="progress-bar mt-3 mb-2"><div class="progress-fill" style="width:' + c.progresso + '%"></div></div><div class="flex justify-between"><span class="text-xs text-muted">' + c.alunos + ' alunos</span><span class="text-xs font-bold" style="color:var(--blue-primary)">' + c.progresso + '%</span></div><div class="flex gap-2 mt-3"><button class="btn btn-ghost btn-sm" data-nav="students" data-student-class-id="' + c.id + '">Ver alunos</button><button class="btn btn-outline btn-sm" data-nav="missions" data-open-class-missions="' + c.id + '">Acompanhar missões</button></div></div>';
    }).join('');
    if (!classCards) classCards = '<div class="empty-state">Nenhuma turma vinculada.</div>';

    var subRows = pendingSubs.map(function (s) {
      var badge = s.status === 'pendente' ? 'badge-yellow' : 'badge-red';
      return '<tr><td><div class="flex items-center" style="gap:10px"><div class="avatar avatar-sm">' + s.aluno.split(' ').map(function (n) { return n[0]; }).slice(0, 2).join('') + '</div><span class="font-semibold">' + s.aluno + '</span></div></td><td class="text-sm text-muted">' + s.missao + '</td><td><span class="badge ' + badge + '">' + s.status + '</span></td><td><button class="btn btn-outline btn-sm" data-nav="submissions">Avaliar</button></td></tr>';
    }).join('');
    if (!subRows) subRows = '<tr><td colspan="4"><div class="empty-state">Nenhuma entrega pendente.</div></td></tr>';

    return '<div class="animate-fade"><div class="grid-4 mb-6">' + statCards + '</div><div class="grid-2 mb-6"><div class="card"><div class="section-header mb-4"><span class="section-title">Minhas Turmas</span><button class="btn btn-ghost btn-sm" data-nav="classes">Ver todas</button></div><div class="teacher-dashboard-classes">' + classCards + '</div></div><div class="card"><div class="section-header mb-4"><span class="section-title">Entregas Pendentes</span><span class="badge badge-yellow">' + pendingSubs.length + '</span></div><div class="table-wrapper"><table class="table"><thead><tr><th>Aluno</th><th>Missão</th><th>Status</th><th></th></tr></thead><tbody>' + subRows + '</tbody></table></div></div></div></div>';
  }

  function classes(navigate, icon, D) {
    var allClassCards = D.classes.map(function (c) {
      var studentsInClass = D.students.filter(function (s) { return Number(s.turmaId) === Number(c.id); });
      var studentRows = studentsInClass.map(function (s) {
        return '<tr><td><div class="flex items-center" style="gap:10px">' + avatar(s, 'avatar-sm') + '<span class="font-semibold text-sm">' + s.name + '</span></div></td><td><span class="badge badge-blue">' + s.modulo + '</span></td><td class="text-sm">PC #' + s.computador + '</td><td><div class="flex items-center" style="gap:8px"><div class="progress-bar" style="width:80px"><div class="progress-fill" style="width:' + s.progresso + '%"></div></div><span class="text-xs font-bold" style="color:var(--blue-primary)">' + s.progresso + '%</span></div></td><td><button class="btn btn-ghost btn-sm" data-nav="student-detail" data-student-id="' + s.id + '">Ver aluno</button></td></tr>';
      }).join('');
      if (!studentRows) studentRows = '<tr><td colspan="5"><div class="empty-state">Nenhum aluno nesta turma.</div></td></tr>';
      return '<div class="card mb-6"><div class="flex items-center justify-between mb-4"><div class="flex items-center gap-3"><div class="stat-icon blue" style="width:40px;height:40px">' + icon('school', 18) + '</div><div><h3>' + c.nome + '</h3><span class="text-xs text-muted">' + c.horarios + ' · ' + c.alunos + ' alunos</span></div></div><div class="flex items-center gap-2"><span class="badge ' + (c.status === 'ativa' ? 'badge-green' : 'badge-gray') + '">' + c.status + '</span><button class="btn btn-outline btn-sm" data-nav="missions" data-open-class-missions="' + c.id + '">' + icon('target', 14) + ' Missões</button></div></div><div class="table-wrapper"><table class="table"><thead><tr><th>Aluno</th><th>Módulo</th><th>PC</th><th>Progresso</th><th></th></tr></thead><tbody>' + studentRows + '</tbody></table></div></div>';
    }).join('');
    if (!allClassCards) allClassCards = '<div class="card empty-state">Nenhuma turma vinculada.</div>';
    return '<div class="animate-fade">' + allClassCards + '</div>';
  }

  function missions(icon, D) {
    if (!D.classes.length) return '<div class="card empty-state">Nenhuma turma vinculada ao seu perfil.</div>';
    var selectedClassId = Number(D.teacherMissionClassId || D.classes[0].id);
    var selectedClass = D.classes.filter(function (item) { return Number(item.id) === selectedClassId; })[0] || D.classes[0];
    selectedClassId = Number(selectedClass.id);
    var classStudents = D.students.filter(function (student) { return Number(student.turmaId) === selectedClassId; });
    var moduleIds = (selectedClass.moduloIds || []).map(Number);
    classStudents.forEach(function (student) {
      if (student.moduloId && moduleIds.indexOf(Number(student.moduloId)) === -1) moduleIds.push(Number(student.moduloId));
    });
    var availableModules = D.modules.filter(function (module) { return moduleIds.indexOf(Number(module.id)) !== -1; });
    var selectedModuleId = Number(D.teacherMissionModuleId || (availableModules[0] && availableModules[0].id));
    var selectedModule = availableModules.filter(function (item) { return Number(item.id) === selectedModuleId; })[0] || availableModules[0] || null;
    selectedModuleId = selectedModule ? Number(selectedModule.id) : 0;
    var moduleStudents = classStudents.filter(function (student) { return Number(student.moduloId) === selectedModuleId; });
    var moduleMissions = D.missions.filter(function (mission) { return Number(mission.moduloId) === selectedModuleId && mission.status === 'ativa'; }).sort(function (a, b) {
      if (a.tipo !== b.tipo) return a.tipo === 'obrigatoria' ? -1 : 1;
      return Number(a.ordem) - Number(b.ordem);
    });
    var classOptions = D.classes.map(function (item) { return '<option value="' + item.id + '"' + (Number(item.id) === selectedClassId ? ' selected' : '') + '>' + item.nome + '</option>'; }).join('');
    var moduleOptions = availableModules.map(function (item) { return '<option value="' + item.id + '"' + (Number(item.id) === selectedModuleId ? ' selected' : '') + '>' + item.name + '</option>'; }).join('');
    var requiredCount = moduleMissions.filter(function (mission) { return mission.tipo === 'obrigatoria'; }).length;
    var extraCount = moduleMissions.length - requiredCount;

    var missionCards = moduleMissions.map(function (mission) {
      var statuses = moduleStudents.map(function (student) {
        var progress = missionProgress(D, selectedClassId, mission.id, student.id);
        return { student: student, status: progress ? progress.status : 'available' };
      });
      var approved = statuses.filter(function (item) { return item.status === 'approved'; }).length;
      var active = statuses.filter(function (item) { return item.status === 'submitted' || item.status === 'in_progress' || item.status === 'redo'; }).length;
      var blocked = statuses.filter(function (item) { return item.status === 'blocked'; }).length;
      var percent = statuses.length ? Math.round((approved / statuses.length) * 100) : 0;
      var studentRows = statuses.map(function (item) {
        var meta = progressMeta(item.status);
        return '<tr><td><div class="flex items-center gap-2">' + avatar(item.student, 'avatar-sm') + '<div><strong class="text-sm">' + item.student.name + '</strong><span class="text-xs text-muted" style="display:block">' + item.student.modulo + '</span></div></div></td><td><span class="badge ' + meta.badge + '">' + meta.label + '</span></td><td><button class="btn btn-ghost btn-sm" data-nav="student-detail" data-student-id="' + item.student.id + '">Detalhes</button></td></tr>';
      }).join('');
      if (!studentRows) studentRows = '<tr><td colspan="3"><div class="empty-state">Nenhum aluno desta turma está cursando este módulo agora.</div></td></tr>';
      return '<details class="teacher-mission-card"><summary><div class="teacher-mission-order">' + mission.ordem + '</div><div class="teacher-mission-main"><div class="flex items-center gap-2 flex-wrap"><h3>' + mission.titulo + '</h3><span class="badge ' + (mission.tipo === 'obrigatoria' ? 'badge-blue' : 'badge-orange') + '">' + (mission.tipo === 'obrigatoria' ? 'Obrigatória' : 'Extra') + '</span></div><p>' + (mission.objetivo || mission.descricao || 'Sem objetivo informado.') + '</p><div class="teacher-mission-counts"><span style="color:var(--success)">' + icon('checkCircle', 13) + ' ' + approved + ' concluíram</span><span style="color:var(--orange)">' + icon('clock', 13) + ' ' + active + ' acompanhando</span><span style="color:var(--gray-500)">' + icon('lock', 13) + ' ' + blocked + ' bloqueadas</span></div></div><div class="teacher-mission-percent"><strong>' + percent + '%</strong><span>da turma</span></div><span class="teacher-mission-chevron">' + icon('chevronDown', 18) + '</span></summary><div class="teacher-mission-detail"><div class="teacher-mission-description"><span>Aula ' + mission.aula + '</span><p>' + (mission.descricao || 'Sem descrição adicional.') + '</p></div><div class="progress-bar mb-4"><div class="progress-fill" style="width:' + percent + '%"></div></div><div class="table-wrapper"><table class="table"><thead><tr><th>Aluno</th><th>Situação</th><th></th></tr></thead><tbody>' + studentRows + '</tbody></table></div></div></details>';
    }).join('');
    if (!missionCards) missionCards = '<div class="card empty-state">Nenhuma missão ativa cadastrada para este módulo.</div>';
    var noModule = availableModules.length ? '' : '<div class="card empty-state">Esta turma ainda não possui módulos vinculados.</div>';
    return '<div class="animate-fade teacher-missions-page"><div class="card teacher-mission-filters"><div><span class="admin-form-kicker">ACOMPANHAMENTO PEDAGÓGICO</span><h2>Missões por turma e módulo</h2><p class="text-sm text-muted">Selecione uma turma e um curso para visualizar a situação de cada aluno.</p></div><div class="teacher-filter-fields"><div class="form-group"><label class="form-label" for="teacher-mission-class">Turma</label><select class="form-select" id="teacher-mission-class">' + classOptions + '</select></div><div class="form-group"><label class="form-label" for="teacher-mission-module">Curso / módulo</label><select class="form-select" id="teacher-mission-module"' + (availableModules.length ? '' : ' disabled') + '>' + moduleOptions + '</select></div></div></div>' + (selectedModule ? '<div class="teacher-mission-summary"><div><span class="badge" style="background:' + selectedModule.cor + '22;color:' + selectedModule.cor + '">' + selectedModule.name + '</span><strong>' + moduleMissions.length + '</strong><span>missões ativas</span></div><div><strong>' + requiredCount + '</strong><span>obrigatórias</span></div><div><strong>' + extraCount + '</strong><span>extras</span></div><div><strong>' + moduleStudents.length + '</strong><span>alunos neste módulo</span></div></div>' : '') + noModule + '<div class="teacher-mission-list">' + missionCards + '</div></div>';
  }

  function submissions(icon, D) {
    var statusMap = { pendente: { label: 'Pendente', cls: 'badge-yellow' }, aprovado: { label: 'Aprovado', cls: 'badge-green' }, refazer: { label: 'Refazer', cls: 'badge-red' }, concluido: { label: 'Concluído', cls: 'badge-green' } };
    var rows = D.submissions.map(function (s) {
      var sm = statusMap[s.status] || statusMap.pendente;
      var files = (s.arquivosDetalhes || []).map(function (file) { return '<a class="btn btn-ghost btn-sm" href="' + file.downloadUrl + '" title="Baixar ' + file.name + '">' + icon('download', 13) + ' ' + file.name + '</a>'; }).join('');
      var submissionAvatar = s.alunoFotoUrl ? '<img class="avatar avatar-sm" src="' + escapeHtml(s.alunoFotoUrl) + '" alt="Foto de ' + escapeHtml(s.aluno) + '" style="object-fit:cover" />' : '<div class="avatar avatar-sm">' + s.aluno.split(' ').map(function (n) { return n[0]; }).slice(0, 2).join('') + '</div>';
      return '<tr data-submission-row data-search="' + (s.aluno + ' ' + s.missao + ' ' + s.turma).toLowerCase() + '" data-status="' + s.status + '" data-class="' + s.turma + '"><td><div class="flex items-center" style="gap:10px">' + submissionAvatar + '<span class="font-semibold">' + s.aluno + '</span></div></td><td class="text-sm text-muted">' + s.missao + '</td><td class="text-sm text-muted">' + s.turma + '</td><td class="text-sm text-muted">' + s.enviadoEm + '</td><td><div class="flex gap-1 flex-wrap">' + (files || '<span class="text-xs text-muted">Entrega sem arquivo</span>') + '</div></td><td><span class="badge ' + sm.cls + '">' + sm.label + '</span></td><td><button class="btn ' + (s.status === 'pendente' || s.status === 'refazer' ? 'btn-primary' : 'btn-outline') + ' btn-sm" data-action="review" data-id="' + s.id + '">' + icon('clipboardList', 14) + ' ' + (s.status === 'pendente' || s.status === 'refazer' ? 'Avaliar entrega' : 'Ver avaliação') + '</button></td></tr>';
    }).join('');
    if (!rows) rows = '<tr><td colspan="7"><div class="empty-state">Nenhuma entrega recebida.</div></td></tr>';
    var classOptions = '<option value="all">Todas as turmas</option>' + (D.classes || []).map(function (item) { return '<option value="' + item.nome + '">' + item.nome + '</option>'; }).join('');
    return '<div class="animate-fade"><div class="card admin-list-toolbar mb-4"><div class="search-wrapper flex-1">' + icon('search', 16) + '<input class="search-input" id="submission-search" placeholder="Buscar aluno, missão ou turma..." /></div><select class="form-select" id="submission-class">' + classOptions + '</select><select class="form-select" id="submission-status"><option value="all">Todos os status</option><option value="pendente">Pendentes</option><option value="refazer">Refazer</option><option value="aprovado">Aprovados</option><option value="concluido">Concluídos</option></select></div><div class="card"><div class="table-wrapper"><table class="table"><thead><tr><th>Aluno</th><th>Missão</th><th>Turma</th><th>Enviado em</th><th>Arquivos</th><th>Status</th><th>Ações</th></tr></thead><tbody id="sub-rows">' + rows + '</tbody></table></div></div><div class="card empty-state mt-3" id="submission-empty" style="display:none">Nenhuma entrega corresponde aos filtros.</div><div class="list-pagination" id="submission-pagination"><button class="btn btn-outline btn-sm" data-page-prev>Anterior</button><span data-page-info></span><button class="btn btn-outline btn-sm" data-page-next>Próxima</button></div></div>';
  }

  function studentsList(icon, D) {
    var selectedClassId = Number(D.teacherStudentClassId || 0);
    var classOptions = '<option value="0">Todas as turmas</option>' + D.classes.map(function (item) { return '<option value="' + item.id + '"' + (Number(item.id) === selectedClassId ? ' selected' : '') + '>' + item.nome + '</option>'; }).join('');
    var students = D.students.filter(function (student) { return !selectedClassId || Number(student.turmaId) === selectedClassId; });
    var cards = students.map(function (student) {
      return '<article class="card teacher-student-card" data-student-search="' + (student.name + ' ' + student.email + ' ' + student.turma + ' ' + student.modulo).toLowerCase() + '"><div class="teacher-student-head">' + avatar(student, 'avatar-lg') + '<div><h3>' + student.name + '</h3><span>' + student.email + '</span></div><span class="badge ' + (student.status === 'ativo' ? 'badge-green' : student.status === 'atrasado' ? 'badge-red' : 'badge-gray') + '">' + student.status + '</span></div><div class="teacher-student-tags"><span>' + icon('school', 13) + ' ' + student.turma + '</span><span>' + icon('bookOpen', 13) + ' ' + student.modulo + '</span><span>' + icon('coins', 13) + ' ' + joyLabel(student.joys) + '</span></div><div class="teacher-student-progress"><div class="flex justify-between mb-1"><span>Progresso obrigatório</span><strong>' + student.progresso + '%</strong></div><div class="progress-bar"><div class="progress-fill" style="width:' + student.progresso + '%"></div></div></div><button class="btn btn-primary" data-nav="student-detail" data-student-id="' + student.id + '">Acompanhar aluno ' + icon('chevronRight', 14) + '</button></article>';
    }).join('');
    if (!cards) cards = '<div class="card empty-state teacher-student-empty">Nenhum aluno encontrado nesta turma.</div>';
    return '<div class="animate-fade"><div class="card teacher-student-toolbar"><div><span class="admin-form-kicker">ALUNOS VINCULADOS</span><h2>Escolha quem deseja acompanhar</h2></div><div class="teacher-student-filters"><div class="search-wrapper">' + icon('search', 16) + '<input class="search-input" id="teacher-student-search" placeholder="Buscar por nome, turma ou módulo..." /></div><select class="form-select" id="teacher-student-class">' + classOptions + '</select></div></div><div class="teacher-student-grid" id="teacher-student-grid">' + cards + '</div><div class="list-pagination" id="teacher-student-pagination"><button class="btn btn-outline btn-sm" data-page-prev>Anterior</button><span data-page-info></span><button class="btn btn-outline btn-sm" data-page-next>Próxima</button></div></div>';
  }

  function studentDetail(icon, D) {
    var s = studentById(D, D.selectedStudentId);
    if (!s) return '<div class="card empty-state"><p>Selecione primeiro um aluno da sua lista.</p><button class="btn btn-primary mt-3" data-nav="students">Ver lista de alunos</button></div>';
    var mod = D.modules.filter(function (m) { return Number(m.id) === Number(s.moduloId); })[0];
    var studentSubs = D.submissions.filter(function (sub) { return Number(sub.alunoId) === Number(s.id); });
    var classId = Number(s.turmaId);
    var currentMissions = D.missions.filter(function (mission) { return mission.status === 'ativa' && Number(mission.moduloId) === Number(s.moduloId); }).sort(function (a, b) {
      if (a.tipo !== b.tipo) return a.tipo === 'obrigatoria' ? -1 : 1;
      return Number(a.ordem) - Number(b.ordem);
    });
    var missionRows = currentMissions.map(function (mission) {
      var progress = missionProgress(D, classId, mission.id, s.id);
      var meta = progressMeta(progress ? progress.status : 'available');
      return '<tr><td><div><strong class="text-sm">' + mission.titulo + '</strong><span class="text-xs text-muted" style="display:block">Aula ' + mission.aula + '</span></div></td><td><span class="badge ' + (mission.tipo === 'obrigatoria' ? 'badge-blue' : 'badge-orange') + '">' + (mission.tipo === 'obrigatoria' ? 'Obrigatória' : 'Extra') + '</span></td><td><span class="badge ' + meta.badge + '">' + meta.label + '</span></td></tr>';
    }).join('');
    if (!missionRows) missionRows = '<tr><td colspan="3"><div class="empty-state">Nenhuma missão ativa no módulo atual.</div></td></tr>';
    var subRows = studentSubs.map(function (sub) {
      var statusMap = { pendente: 'badge-yellow', aprovado: 'badge-green', refazer: 'badge-red', concluido: 'badge-green' };
      return '<tr><td class="text-sm font-semibold">' + sub.missao + '</td><td class="text-sm text-muted">' + sub.enviadoEm + '</td><td><span class="badge ' + (statusMap[sub.status] || 'badge-gray') + '">' + sub.status + '</span></td></tr>';
    }).join('');
    if (!subRows) subRows = '<tr><td colspan="3"><div class="empty-state">Nenhuma entrega registrada.</div></td></tr>';
    var joyHistory = (D.teacherJoyTransactions || []).filter(function (transaction) { return Number(transaction.studentId) === Number(s.id); }).slice(0, 8).map(function (transaction) {
      var positive = Number(transaction.amount) > 0;
      return '<div class="teacher-joy-history-row"><span class="teacher-joy-amount ' + (positive ? 'positive' : 'negative') + '">' + (positive ? '+' : '') + Number(transaction.amount).toLocaleString('pt-BR') + '</span><div><strong>' + transaction.reason + '</strong><span>' + transaction.createdAt + ' · por ' + transaction.createdBy + '</span></div><small>Saldo: ' + Number(transaction.balanceAfter).toLocaleString('pt-BR') + '</small></div>';
    }).join('');
    if (!joyHistory) joyHistory = '<p class="text-sm text-muted">Nenhuma movimentação registrada para este aluno.</p>';

    return '<div class="animate-fade teacher-student-detail"><button class="btn btn-ghost mb-4" data-nav="students">' + icon('arrowLeft', 15) + ' Voltar para a lista</button><div class="card mb-6"><div class="profile-header"><div class="profile-avatar-wrap">' + avatar(s, 'avatar-xl profile-avatar') + '</div><div class="profile-info"><h2>' + s.name + '</h2><p class="text-muted">' + s.email + '</p><div class="flex gap-2 mt-3 flex-wrap"><span class="badge badge-blue">' + s.turma + '</span><span class="badge" style="background:' + (mod ? mod.cor : '#333') + '22;color:' + (mod ? mod.cor : '#333') + '">' + s.modulo + '</span><span class="badge badge-gray">PC #' + s.computador + '</span></div></div><div class="teacher-student-balance"><span>Saldo atual</span><strong>' + joyLabel(s.joys) + '</strong></div></div></div><div class="grid-3 mb-6"><div class="stat-card teacher-centered-stat"><span class="stat-value" style="color:var(--success)">' + s.missoesConcluidas + '</span><span class="stat-label">Missões concluídas</span></div><div class="stat-card teacher-centered-stat"><span class="stat-value" style="color:var(--blue-primary)">' + s.progresso + '%</span><span class="stat-label">Progresso obrigatório</span></div><div class="stat-card teacher-centered-stat"><span class="stat-value" style="color:var(--orange)">' + s.status + '</span><span class="stat-label">Status</span></div></div><div class="grid-2 teacher-student-detail-grid"><div><div class="card mb-6"><div class="section-header mb-4"><span class="section-title">Missões do módulo atual</span><button class="btn btn-ghost btn-sm" data-nav="missions" data-open-class-missions="' + classId + '" data-open-module-missions="' + s.moduloId + '">Ver turma</button></div><div class="table-wrapper"><table class="table"><thead><tr><th>Missão</th><th>Tipo</th><th>Situação</th></tr></thead><tbody>' + missionRows + '</tbody></table></div></div><div class="card"><div class="section-header mb-4"><span class="section-title">Histórico de Entregas</span></div><div class="table-wrapper"><table class="table"><thead><tr><th>Missão</th><th>Data</th><th>Status</th></tr></thead><tbody>' + subRows + '</tbody></table></div></div></div><aside><div class="card teacher-joy-card mb-6"><div class="teacher-joy-title"><div class="stat-icon orange">' + icon('coins', 20) + '</div><div><h3>Movimentar Joys</h3><p>Adicione ou retire com justificativa.</p></div></div><form id="teacher-joy-form" data-student-id="' + s.id + '"><div class="form-group"><label class="form-label" for="teacher-joy-operation">Operação</label><select class="form-select" id="teacher-joy-operation"><option value="add">Adicionar Joys</option><option value="remove">Retirar Joys</option></select></div><div class="form-group"><label class="form-label" for="teacher-joy-amount">Quantidade</label><input class="form-input" id="teacher-joy-amount" type="number" min="1" max="100000" step="1" required /></div><div class="form-group"><label class="form-label" for="teacher-joy-reason">Motivo</label><textarea class="form-textarea" id="teacher-joy-reason" rows="3" maxlength="255" required placeholder="Ex.: participação na aula ou ajuste autorizado"></textarea></div><div class="teacher-joy-warning">' + icon('clipboardList', 15) + '<span>A movimentação ficará registrada no histórico.</span></div><button class="btn btn-accent" type="submit" style="width:100%;justify-content:center">Confirmar movimentação</button></form></div><div class="card"><div class="section-header mb-4"><span class="section-title">Últimas movimentações</span></div><div class="teacher-joy-history">' + joyHistory + '</div></div></aside></div></div>';
  }

  function feedback(icon, D) {
    var feedbackData = D.submissions.filter(function (submission) { return submission.feedback; }).map(function (submission) {
      return { aluno: submission.aluno, missao: submission.missao, nota: submission.status === 'aprovado' ? 'Aprovado' : 'Refazer', comentario: submission.feedback, data: submission.enviadoEm.split(' ')[0] };
    });
    var cards = feedbackData.map(function (f) {
      var badge = f.nota === 'Aprovado' ? 'badge-green' : 'badge-red';
      return '<div class="card mb-4" style="border-left:4px solid ' + (f.nota === 'Aprovado' ? 'var(--success)' : 'var(--error)') + '"><div class="flex items-center justify-between mb-2"><div class="flex items-center" style="gap:10px"><div class="avatar avatar-sm">' + f.aluno.split(' ').map(function (n) { return n[0]; }).slice(0, 2).join('') + '</div><span class="font-semibold">' + f.aluno + '</span></div><span class="badge ' + badge + '">' + f.nota + '</span></div><p class="text-sm text-muted mb-2"><strong>' + f.missao + '</strong> · ' + f.data + '</p><p class="text-sm">' + f.comentario + '</p></div>';
    }).join('');
    return '<div class="animate-fade">' + (cards || '<div class="empty-state">Nenhum feedback registrado.</div>') + '</div>';
  }

  function profile(icon, D) {
    var teacher = D.currentTeacher;
    if (!teacher) return '<div class="card empty-state">Não foi possível carregar seu perfil.</div>';
    var classBadges = (teacher.turmas || []).map(function (className) { return '<span class="badge badge-blue">' + className + '</span>'; }).join('');
    return '<div class="animate-fade teacher-profile-page"><div class="card teacher-profile-hero"><div class="teacher-profile-avatar" id="teacher-profile-avatar">' + avatar(teacher, 'avatar-xl profile-avatar') + '</div><div><span class="admin-form-kicker">PERFIL DO PROFESSOR</span><h2>' + teacher.name + '</h2><p>' + teacher.email + '</p><div class="flex gap-2 mt-3 flex-wrap">' + classBadges + '</div></div></div><div class="grid-2 teacher-profile-grid"><div class="card"><div class="section-header mb-4"><div><span class="admin-form-kicker">DADOS PESSOAIS</span><h3>Editar perfil</h3></div></div><form id="teacher-profile-form"><div class="form-group"><label class="form-label" for="teacher-profile-name">Nome completo</label><input class="form-input" id="teacher-profile-name" name="name" maxlength="120" value="' + teacher.name + '" required /></div><div class="form-group"><label class="form-label" for="teacher-profile-email">E-mail</label><input class="form-input" id="teacher-profile-email" name="email" type="email" maxlength="190" value="' + teacher.email + '" required /></div><div class="form-group"><label class="form-label" for="teacher-profile-phone">Telefone</label><input class="form-input" id="teacher-profile-phone" name="phone" maxlength="30" value="' + (teacher.telefone || '') + '" placeholder="(00) 00000-0000" /></div><div class="form-group"><label class="form-label" for="teacher-profile-photo">Foto de perfil</label><label class="teacher-photo-upload" for="teacher-profile-photo">' + icon('upload', 17) + '<span>Escolher JPG ou PNG</span><small>Máximo de 1,5 MB</small></label><input id="teacher-profile-photo" name="avatar" type="file" accept="image/jpeg,image/png" hidden /></div><button class="btn btn-primary" type="submit">' + icon('save', 15) + ' Salvar perfil</button></form></div><div><div class="card mb-6"><div class="section-header mb-4"><div><span class="admin-form-kicker">SEGURANÇA</span><h3>Senha de acesso</h3></div></div><p class="text-sm text-muted mb-4">Use uma senha com pelo menos 8 caracteres.</p><button class="btn btn-outline" id="teacher-change-password-btn">' + icon('edit', 15) + ' Alterar minha senha</button><div id="teacher-password-panel" style="display:none"><form id="teacher-change-password-form" class="mt-4"><div class="form-group"><label class="form-label">Senha atual</label><input class="form-input" type="password" id="teacher-current-password" autocomplete="current-password" required /></div><div class="form-group"><label class="form-label">Nova senha</label><input class="form-input" type="password" id="teacher-new-password" autocomplete="new-password" minlength="8" required /></div><div class="form-group"><label class="form-label">Confirmar nova senha</label><input class="form-input" type="password" id="teacher-confirm-password" autocomplete="new-password" minlength="8" required /></div><div class="flex justify-end gap-2"><button type="button" class="btn btn-ghost btn-sm" id="teacher-cancel-password">Cancelar</button><button type="submit" class="btn btn-primary btn-sm">Salvar nova senha</button></div></form></div></div><div class="card"><div class="section-header mb-3"><span class="section-title">Resumo profissional</span></div><div class="teacher-profile-summary"><div><strong>' + Number(teacher.alunos || 0) + '</strong><span>alunos vinculados</span></div><div><strong>' + (teacher.turmas || []).length + '</strong><span>turmas vinculadas</span></div></div><p class="text-xs text-muted mt-4">As turmas vinculadas são definidas pela Supervisão ou pelo Admin.</p></div></div></div></div>';
  }

  function bind(page, navigate, D) {
    if (page === 'achievements') {
      window.AchievementPages.bind(navigate, D);
      return;
    }
    var rawD = window.CreateJoyApp.getRawData();
    document.querySelectorAll('[data-nav]').forEach(function (el) {
      el.addEventListener('click', function () {
        var studentId = parseInt(el.getAttribute('data-student-id'), 10);
        var classId = parseInt(el.getAttribute('data-open-class-missions'), 10);
        var moduleId = parseInt(el.getAttribute('data-open-module-missions'), 10);
        var studentClassId = parseInt(el.getAttribute('data-student-class-id'), 10);
        if (studentId) rawD.selectedStudentId = studentId;
        if (classId) rawD.teacherMissionClassId = classId;
        if (moduleId) rawD.teacherMissionModuleId = moduleId;
        if (studentClassId) rawD.teacherStudentClassId = studentClassId;
        navigate(el.getAttribute('data-nav'));
      });
    });

    if (page === 'missions') {
      var classSelect = document.getElementById('teacher-mission-class');
      var moduleSelect = document.getElementById('teacher-mission-module');
      if (classSelect) classSelect.addEventListener('change', function () { rawD.teacherMissionClassId = Number(classSelect.value); rawD.teacherMissionModuleId = null; navigate('missions'); });
      if (moduleSelect) moduleSelect.addEventListener('change', function () { rawD.teacherMissionModuleId = Number(moduleSelect.value); navigate('missions'); });
    }

    if (page === 'students') {
      var studentClassSelect = document.getElementById('teacher-student-class');
      var studentSearch = document.getElementById('teacher-student-search');
      if (studentClassSelect) studentClassSelect.addEventListener('change', function () { rawD.teacherStudentClassId = Number(studentClassSelect.value); navigate('students'); });
      var studentPager = window.CreateJoyUI.bindPagedList({ itemSelector: '[data-student-search]', pagerId: 'teacher-student-pagination', perPage: 12, matches: function (card) {
        var query = studentSearch ? studentSearch.value.trim().toLowerCase() : '';
        return !query || card.getAttribute('data-student-search').indexOf(query) !== -1;
      } });
      if (studentSearch) studentSearch.addEventListener('input', function () { studentPager.refresh(true); });
    }

    if (page === 'student-detail') {
      var joyForm = document.getElementById('teacher-joy-form');
      if (joyForm) joyForm.addEventListener('submit', async function (event) {
        event.preventDefault();
        var operation = document.getElementById('teacher-joy-operation').value;
        var amount = Number(document.getElementById('teacher-joy-amount').value);
        var reason = document.getElementById('teacher-joy-reason').value.trim();
        var verb = operation === 'add' ? 'adicionar' : 'retirar';
        if (!await window.CreateJoyUI.confirm({ title: (operation === 'add' ? 'Adicionar' : 'Retirar') + ' Joys?', message: 'Confirma ' + verb + ' ' + amount.toLocaleString('pt-BR') + ' Joys deste aluno? O motivo e o saldo final ficarão registrados.', confirmLabel: operation === 'add' ? 'Adicionar Joys' : 'Retirar Joys', tone: 'warning' })) return;
        var submitButton = joyForm.querySelector('button[type="submit"]');
        var originalLabel = submitButton.innerHTML;
        submitButton.disabled = true;
        submitButton.textContent = 'Salvando...';
        try {
          var payload = await window.CreateJoyApi.adjustStudentJoys(joyForm.getAttribute('data-student-id'), operation, amount, reason);
          window.CreateJoyApp.updateData(payload.data);
          window.alert(payload.message);
          navigate('student-detail');
        } catch (error) {
          window.alert(error.message);
          submitButton.disabled = false;
          submitButton.innerHTML = originalLabel;
        }
      });
    }

    if (page === 'submissions') {
      var submissionSearch = document.getElementById('submission-search');
      var submissionClass = document.getElementById('submission-class');
      var submissionStatus = document.getElementById('submission-status');
      var submissionPager = window.CreateJoyUI.bindPagedList({ itemSelector: '[data-submission-row]', pagerId: 'submission-pagination', emptyId: 'submission-empty', perPage: 12, display: 'table-row', matches: function (row) {
        var query = submissionSearch ? submissionSearch.value.trim().toLowerCase() : '';
        var classOk = !submissionClass || submissionClass.value === 'all' || row.getAttribute('data-class') === submissionClass.value;
        var statusOk = !submissionStatus || submissionStatus.value === 'all' || row.getAttribute('data-status') === submissionStatus.value;
        return classOk && statusOk && (!query || row.getAttribute('data-search').indexOf(query) !== -1);
      } });
      if (submissionSearch) submissionSearch.addEventListener('input', function () { submissionPager.refresh(true); });
      if (submissionClass) submissionClass.addEventListener('change', function () { submissionPager.refresh(true); });
      if (submissionStatus) submissionStatus.addEventListener('change', function () { submissionPager.refresh(true); });
      document.querySelectorAll('[data-action]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var id = parseInt(btn.getAttribute('data-id'), 10);
          var submission = rawD.submissions.filter(function (item) { return item.id === id; })[0];
          openSubmissionReview(window.Icons.render, submission, function () { navigate('submissions'); });
        });
      });
    }

    if (page === 'profile') {
      var profileForm = document.getElementById('teacher-profile-form');
      var photoInput = document.getElementById('teacher-profile-photo');
      if (photoInput) photoInput.addEventListener('change', function () {
        if (!photoInput.files.length) return;
        var file = photoInput.files[0];
        if (file.size > 1572864) { window.alert('A foto deve ter no máximo 1,5 MB.'); photoInput.value = ''; return; }
        var reader = new FileReader();
        reader.onload = function () { document.getElementById('teacher-profile-avatar').innerHTML = '<img class="avatar avatar-xl profile-avatar" src="' + reader.result + '" alt="Prévia da nova foto" style="object-fit:cover" />'; };
        reader.readAsDataURL(file);
      });
      if (profileForm) profileForm.addEventListener('submit', async function (event) {
        event.preventDefault();
        var submitButton = profileForm.querySelector('button[type="submit"]');
        var originalLabel = submitButton.innerHTML;
        var formData = new FormData();
        formData.append('name', document.getElementById('teacher-profile-name').value.trim());
        formData.append('email', document.getElementById('teacher-profile-email').value.trim());
        formData.append('phone', document.getElementById('teacher-profile-phone').value.trim());
        if (photoInput.files.length) formData.append('avatar', photoInput.files[0]);
        submitButton.disabled = true;
        submitButton.textContent = 'Salvando...';
        try {
          var payload = await window.CreateJoyApi.updateProfile(formData);
          window.CreateJoyApp.updateData(payload.data);
          window.alert(payload.message);
          navigate('profile');
        } catch (error) { window.alert(error.message); submitButton.disabled = false; submitButton.innerHTML = originalLabel; }
      });

      var changePasswordButton = document.getElementById('teacher-change-password-btn');
      var passwordPanel = document.getElementById('teacher-password-panel');
      var cancelPasswordButton = document.getElementById('teacher-cancel-password');
      var passwordForm = document.getElementById('teacher-change-password-form');
      if (changePasswordButton) changePasswordButton.addEventListener('click', function () { passwordPanel.style.display = 'block'; document.getElementById('teacher-current-password').focus(); });
      if (cancelPasswordButton) cancelPasswordButton.addEventListener('click', function () { passwordForm.reset(); passwordPanel.style.display = 'none'; });
      if (passwordForm) passwordForm.addEventListener('submit', async function (event) {
        event.preventDefault();
        var currentPassword = document.getElementById('teacher-current-password').value;
        var newPassword = document.getElementById('teacher-new-password').value;
        var confirmation = document.getElementById('teacher-confirm-password').value;
        if (newPassword !== confirmation) { window.alert('A confirmação não corresponde à nova senha.'); return; }
        var submitButton = passwordForm.querySelector('button[type="submit"]');
        submitButton.disabled = true;
        submitButton.textContent = 'Salvando...';
        try {
          await window.CreateJoyApi.changePassword(currentPassword, newPassword);
          window.alert('Senha alterada com sucesso.');
          passwordForm.reset();
          passwordPanel.style.display = 'none';
          submitButton.disabled = false;
          submitButton.textContent = 'Salvar nova senha';
        } catch (error) { window.alert(error.message); submitButton.disabled = false; submitButton.textContent = 'Salvar nova senha'; }
      });
    }
  }

  return { render: render, bind: bind };
})();
