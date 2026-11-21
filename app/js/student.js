// Student pages
window.StudentPages = (function () {
  'use strict';

  function joyLabel(value) {
    var amount = Number(value || 0);
    return amount + ' Joy' + (amount === 1 ? '' : 's');
  }

  function render(page, navigate, icon, D) {
    switch (page) {
      case 'dashboard': return dashboard(navigate, icon, D);
      case 'timeline': return timeline(navigate, icon, D);
      case 'mission': return mission(icon, D);
      case 'lab': return lab(icon, D);
      case 'files': return files(icon, D);
      case 'store': return store(icon, D);
      case 'investments': return investments(icon, D);
      case 'profile': return profile(icon, D);
      default: return dashboard(navigate, icon, D);
    }
  }

  // ===== Dashboard =====
  function dashboard(navigate, icon, D) {
    var s = D.currentStudent;
    var currentMissions = D.missions || [];
    var requiredMissions = currentMissions.filter(function (m) { return m.tipo === 'obrigatoria'; });
    var nextMission = currentMissions.filter(function (m) { return !m.concluida && !m.bloqueada && !m.entregue; })[0];
    var awaitingMission = currentMissions.filter(function (m) { return m.entregue; })[0];
    var earnedMedals = D.medals.filter(function (m) { return m.conquistada; });
    var stats = [
      { val: s.missoesConcluidas, lbl: 'Concluídas', icon: 'checkCircle', color: '#22C55E', bg: '#F0FDF4' },
      { val: Math.max(0, requiredMissions.length - s.missoesConcluidas), lbl: 'Pendentes', icon: 'clock', color: '#F59E0B', bg: '#FFFBEB' },
      { val: s.progresso + '%', lbl: 'Módulo atual', icon: 'trendingUp', color: '#F26522', bg: '#FEF3EC' },
      { val: s.joys || 0, lbl: 'Joys', icon: 'zap', color: '#1E72B8', bg: '#EBF5FC' },
    ];
    var statsHtml = stats.map(function (item) {
      return '<div class="student-summary-stat"><span style="background:' + item.bg + ';color:' + item.color + '">' + icon(item.icon, 18) + '</span><div><strong style="color:' + item.color + '">' + item.val + '</strong><small>' + item.lbl + '</small></div></div>';
    }).join('');

    var nextMissionHtml = nextMission ?
      '<div class="student-next card"><div class="student-section-label">' + icon('rocket', 15) + ' Próxima missão</div><h3>' + nextMission.titulo + '</h3><p>' + nextMission.objetivo + '</p><div class="student-next-meta"><span>' + nextMission.modulo + '</span><span>Aula ' + nextMission.aula + '</span><span>' + (nextMission.tipo === 'extra' ? 'Extra' : 'Obrigatória') + '</span></div><button class="btn btn-accent" data-nav="mission" data-open-mission="' + nextMission.id + '">' + (nextMission.emAndamento ? 'Continuar missão' : 'Abrir missão') + ' ' + icon('chevronRight', 14) + '</button></div>'
      : awaitingMission
        ? '<div class="student-next card student-next-submitted"><div class="student-section-label">' + icon('send', 15) + ' Entrega enviada</div><h3>' + awaitingMission.titulo + '</h3><p>Sua tarefa foi registrada e está aguardando a avaliação do professor.</p><button class="btn btn-outline" data-nav="mission" data-open-mission="' + awaitingMission.id + '">Ver entrega enviada ' + icon('chevronRight', 14) + '</button></div>'
        : '<div class="student-next card student-next-done"><div>' + icon('checkCircle', 28) + '</div><h3>Tudo concluído por aqui!</h3><p>Não há missões pendentes neste módulo.</p></div>';

    var medalsHtml = earnedMedals.slice(0, 4).map(function (m) {
      return '<div class="student-earned-medal"><span>' + m.icone + '</span><div><strong>' + m.nome + '</strong><small>' + m.descricao + '</small></div></div>';
    }).join('');
    if (!medalsHtml) medalsHtml = '<div class="empty-state" style="padding:24px">Suas conquistas aparecerão aqui.</div>';

    return (
      '<div class="animate-fade student-dashboard-clean">' +
      '<section class="student-welcome card"><div class="student-welcome-person">' + (s.fotoUrl ? '<img class="avatar" src="' + s.fotoUrl + '" alt="Foto de ' + s.name + '">' : '<div class="avatar">' + s.initials + '</div>') + '<div><span>Bem-vindo de volta</span><h2>' + s.name + '</h2><p>' + s.turma + ' · ' + s.modulo + ' · PC #' + s.computador + '</p></div></div><button class="btn btn-outline" data-nav="timeline">Ver minha jornada ' + icon('chevronRight', 14) + '</button></section>' +
      '<section class="student-summary-grid">' + statsHtml + '</section>' +
      '<section class="student-dashboard-grid">' + nextMissionHtml + '<div class="card student-achievements"><div class="student-section-label">' + icon('award', 15) + ' Conquistas <span>' + earnedMedals.length + '</span></div><div>' + medalsHtml + '</div><button class="student-text-link" data-nav="profile">Ver perfil e conquistas ' + icon('chevronRight', 12) + '</button></div></section>' +
      '</div>'
    );
  }

  // ===== Timeline =====
  function timeline(navigate, icon, D) {
    var student = D.currentStudent;
    var currentModule = D.modules.filter(function (module) {
      return Number(module.id) === Number(student.moduloId) || module.name === student.modulo;
    })[0];
    var missions = (D.missions || []).slice();
    var required = missions.filter(function (item) { return item.tipo === 'obrigatoria'; });
    var completed = required.filter(function (item) { return item.concluida; }).length;
    var progress = required.length ? Math.round((completed / required.length) * 100) : 0;
    var moduleColor = currentModule ? currentModule.cor : 'var(--blue-primary)';

    function missionState(item) {
      if (item.concluida) return { key: 'done', label: 'Concluída', icon: 'checkCircle' };
      if (item.entregue) return { key: 'submitted', label: 'Enviada para avaliação', icon: 'send' };
      if (item.bloqueada) return { key: 'blocked', label: 'Bloqueada', icon: 'lock' };
      if (item.emAndamento) return { key: 'active', label: 'Em andamento', icon: 'clock' };
      return { key: 'available', label: 'Disponível', icon: 'chevronRight' };
    }

    var completedModules = (student.modulosConcluidos || []).map(function (name) {
      return '<span class="journey-completed-chip">' + icon('checkCircle', 14) + name + '</span>';
    }).join('');

    var missionCards = missions.map(function (item, index) {
      var state = missionState(item);
      var action = item.bloqueada
        ? '<span class="journey-locked-note">Conclua a missão obrigatória indicada</span>'
        : '<button class="btn btn-sm ' + (item.concluida || item.entregue ? 'btn-outline' : 'btn-primary') + '" data-nav="mission" data-open-mission="' + item.id + '">' + (item.concluida ? 'Revisar' : item.entregue ? 'Ver entrega' : item.emAndamento ? 'Continuar' : 'Abrir') + ' ' + icon('chevronRight', 12) + '</button>';
      return (
        '<article class="journey-mission journey-mission-' + state.key + '">' +
        '<div class="journey-mission-order">' + (item.concluida ? icon('check', 16) : index + 1) + '</div>' +
        '<div class="journey-mission-copy"><div class="journey-mission-meta"><span>Aula ' + item.aula + '</span><span class="badge ' + (item.tipo === 'extra' ? 'badge-orange' : 'badge-blue') + '">' + (item.tipo === 'extra' ? 'Extra' : 'Obrigatória') + '</span><span class="journey-status journey-status-' + state.key + '">' + icon(state.icon, 13) + state.label + '</span></div><h3>' + item.titulo + '</h3><span class="text-sm text-muted">Entrega: ' + item.entrega.toUpperCase() + (item.joys ? ' · +' + item.joys + ' Joys' : '') + '</span></div>' +
        '<div class="journey-mission-action">' + action + '</div>' +
        '</article>'
      );
    }).join('');
    if (!missionCards) missionCards = '<div class="empty-state">Ainda não há missões ativas neste módulo.</div>';

    return (
      '<div class="animate-fade journey-page">' +
      (completedModules ? '<section class="journey-completed"><span>Módulos realmente concluídos</span><div>' + completedModules + '</div></section>' : '') +
      '<section class="card journey-current" style="--module-color:' + moduleColor + '">' +
      '<div class="journey-current-main"><span class="student-section-label">MÓDULO ATUAL</span><h2>' + (currentModule ? currentModule.name : student.modulo) + '</h2><p>' + (currentModule && currentModule.descricao ? currentModule.descricao : 'Conteúdo em andamento na sua turma.') + '</p></div>' +
      '<div class="journey-progress"><strong>' + progress + '%</strong><span>' + completed + ' de ' + required.length + ' obrigatórias</span><div class="progress-bar"><div class="progress-fill" style="width:' + progress + '%;background:' + moduleColor + '"></div></div></div>' +
      '</section>' +
      '<section class="journey-missions"><div class="section-header"><div><span class="student-section-label">SUA TRILHA</span><h2>Missões deste módulo</h2></div><span class="badge badge-gray">' + missions.length + ' missões</span></div><div class="journey-mission-list">' + missionCards + '</div></section>' +
      '</div>'
    );
  }

  // ===== Mission =====
  function mission(icon, D) {
    var missions = (D.missions || []).slice();
    if (!missions.length) return '<div class="empty-state">Nenhuma missão disponível no seu módulo no momento.</div>';

    function stateOf(item) {
      if (item.concluida) return { key: 'done', label: 'Concluída', icon: 'checkCircle' };
      if (item.entregue) return { key: 'submitted', label: 'Enviada para avaliação', icon: 'send' };
      if (item.bloqueada) return { key: 'blocked', label: 'Bloqueada', icon: 'lock' };
      if (item.emAndamento) return { key: 'active', label: 'Em andamento', icon: 'clock' };
      return { key: 'available', label: 'Disponível', icon: 'chevronRight' };
    }

    var overview = missions.map(function (item, index) {
      var state = stateOf(item);
      var selected = Number(D.selectedMissionId) === Number(item.id);
      var button = item.bloqueada
        ? '<button type="button" class="mission-overview-action" disabled aria-label="Missão bloqueada">' + icon('lock', 15) + '</button>'
        : '<button type="button" class="mission-overview-action" data-open-mission="' + item.id + '" aria-label="Abrir missão">' + icon('chevronRight', 16) + '</button>';
      return (
        '<article class="mission-overview-item mission-overview-' + state.key + (selected ? ' selected' : '') + '">' +
        '<div class="mission-overview-number">' + (item.concluida ? icon('check', 15) : index + 1) + '</div>' +
        '<div class="mission-overview-copy"><div><span>Aula ' + item.aula + '</span><span class="badge ' + (item.tipo === 'extra' ? 'badge-orange' : 'badge-blue') + '">' + (item.tipo === 'extra' ? 'Extra' : 'Obrigatória') + '</span></div><h3>' + item.titulo + '</h3><span class="mission-overview-status mission-overview-status-' + state.key + '">' + icon(state.icon, 13) + state.label + '</span></div>' +
        button + '</article>'
      );
    }).join('');

    var selectedMission = missions.filter(function (item) {
      return Number(item.id) === Number(D.selectedMissionId) && !item.bloqueada;
    })[0];
    var selector = '<section class="card mission-overview"><div class="section-header"><div><span class="student-section-label">MÓDULO ATUAL</span><h2>Escolha uma missão</h2><p class="text-sm text-muted">Veja primeiro toda a sequência. Missões extras aparecem somente depois da obrigatória indicada.</p></div><span class="badge badge-gray">' + missions.length + ' missões</span></div><div class="mission-overview-list">' + overview + '</div></section>';

    if (!selectedMission) {
      return '<div class="animate-fade mission-page">' + selector + '<section class="mission-selection-hint">' + icon('chevronRight', 22) + '<div><h3>Selecione uma missão disponível</h3><p>Os objetivos, o checklist e os campos de entrega serão abertos aqui.</p></div></section></div>';
    }

    var m = selectedMission;
    var latestSubmission = (D.submissions || []).filter(function (submission) {
      return Number(submission.missaoId) === Number(m.id);
    })[0] || null;
    var steps = m.passos || [];
    var supportFiles = m.arquivosApoio || [];
    var activities = (D.activities || []).filter(function (activity) { return Number(activity.missaoId) === Number(m.id); });
    var requiredActivities = activities.filter(function (activity) { return !activity.extra && !activity.informativa; });
    var requiredDone = requiredActivities.filter(function (activity) { return activity.concluida; }).length;
    var pendingRequired = requiredActivities.length - requiredDone;

    var stepsHtml = steps
      .map(function (step, i) {
        return '<li style="display:flex;align-items:flex-start;gap:14px"><span style="width:28px;height:28px;border-radius:50%;background:var(--blue-faint);color:var(--blue-primary);font-weight:700;font-size:0.8125rem;display:flex;align-items:center;justify-content:center;flex-shrink:0">' + (i + 1) + '</span><span class="text-sm" style="padding-top:4px">' + step + '</span></li>';
      })
      .join('');
    if (!stepsHtml) stepsHtml = '<li class="text-sm text-muted">Nenhum passo cadastrado para esta missão.</li>';

    var filesHtml = supportFiles
      .map(function (f) {
        return '<a class="flex items-center" href="' + f.downloadUrl + '" style="border-radius:var(--radius-sm);background:var(--gray-50);border:1px solid var(--gray-200);gap:10px;padding:8px">' + icon('fileText', 16) + '<span class="text-sm flex-1" style="color:var(--blue-primary)">' + f.name + '</span><span class="text-xs text-muted">' + f.size + '</span></a>';
      })
      .join('');
    if (!filesHtml) filesHtml = '<p class="text-sm text-muted">Nenhum arquivo de apoio cadastrado.</p>';

    var checklistHtml = activities.map(function (activity) {
      if (activity.informativa) {
        return '<div class="mission-check-item mission-check-info"><span class="mission-check-box">' + icon('fileText', 16) + '</span><div><div class="mission-check-title"><strong>' + activity.nome + '</strong><span class="badge badge-gray">Apoio</span></div>' + (activity.descricao ? '<p>' + activity.descricao + '</p>' : '') + (activity.criterio ? '<small>' + activity.criterio + '</small>' : '') + '</div></div>';
      }
      return (
        '<label class="mission-check-item' + (activity.concluida ? ' completed' : '') + (activity.extra ? ' extra' : '') + '">' +
        '<input type="checkbox" data-activity-toggle="' + activity.id + '" ' + (activity.concluida ? 'checked' : '') + (m.concluida ? ' disabled' : '') + '>' +
        '<span class="mission-check-box">' + icon('check', 15) + '</span>' +
        '<span class="mission-check-copy"><span class="mission-check-title"><strong>' + activity.nome + '</strong><span class="badge ' + (activity.extra ? 'badge-orange' : 'badge-blue') + '">' + (activity.extra ? 'Extra' : 'Obrigatória') + '</span></span>' +
        (activity.descricao ? '<span>' + activity.descricao + '</span>' : '') +
        (activity.criterio ? '<small>Critério: ' + activity.criterio + '</small>' : '') + '</span></label>'
      );
    }).join('');
    if (!checklistHtml) checklistHtml = '<div class="empty-state mission-check-empty">Nenhuma atividade de checklist foi cadastrada para esta missão.</div>';

    var submittedFiles = latestSubmission && latestSubmission.arquivosDetalhes ? latestSubmission.arquivosDetalhes : [];
    var submittedFilesHtml = submittedFiles.map(function (file) {
      return '<a class="mission-submitted-file" href="' + file.downloadUrl + '">' + icon('download', 14) + '<span>' + file.name + '</span></a>';
    }).join('');
    if (!submittedFilesHtml) submittedFilesHtml = '<span class="mission-submitted-no-file">' + icon('fileText', 14) + ' Entrega registrada sem arquivos anexados</span>';

    var completionNotice = '';
    if (m.concluida) {
      completionNotice = '<section class="mission-completed-notice">' + icon('checkCircle', 22) + '<div><h3>Missão concluída</h3><p>Esta entrega já foi aprovada. Você pode consultar o conteúdo e o checklist.</p></div></section>';
    } else if (m.entregue) {
      completionNotice = '<section class="mission-submitted-notice">' + icon('send', 22) + '<div><span>ENTREGA REGISTRADA</span><h3>Tarefa enviada para o professor</h3><p>' + (latestSubmission ? 'Enviada em ' + latestSubmission.enviadoEm + ' · Tentativa ' + latestSubmission.tentativa : 'Aguardando avaliação do professor.') + '</p><div class="mission-submitted-files">' + submittedFilesHtml + '</div></div></section>';
    } else if (m.refazer && latestSubmission) {
      completionNotice = '<section class="mission-redo-notice">' + icon('alertTriangle', 22) + '<div><span>CORREÇÃO SOLICITADA</span><h3>Revise a missão e envie novamente</h3><p>' + (latestSubmission.feedback || 'Confira a orientação do professor e prepare uma nova tentativa.') + '</p></div></section>';
    }

    var submissionForm = (m.concluida || m.entregue) ? '' : (
      '<form id="mission-form" data-mission-id="' + m.id + '">' +
      '<div class="card mb-4"><h4 class="mb-3" style="color:var(--blue-primary)">Anotações pessoais</h4><textarea class="form-textarea" id="mission-notes" placeholder="Escreva suas anotações sobre a aula..." rows="4"></textarea></div>' +
      '<div class="mission-files-optional">' + icon('paperclip', 16) + '<div><strong>Arquivos são opcionais</strong><span>Você pode enviar a tarefa somente com seu relato. Anexe código ou STL apenas quando fizer parte desta missão.</span></div></div>' +
      '<div class="grid-2 mb-4">' +
      '<div class="card"><h4 class="mb-3" style="color:var(--blue-primary);display:flex;align-items:center;gap:8px">' + icon('fileCode', 16) + ' Código <span class="badge badge-gray">Opcional</span></h4><label class="file-upload-area" for="mission-code-files" style="display:block;cursor:pointer"><input id="mission-code-files" type="file" accept=".ino,.cpp,.c,.h,.zip" multiple style="display:none" />' + icon('upload', 24) + '<p class="text-sm font-semibold mb-1" id="mission-code-label" style="margin-top:8px">Selecionar .ino, .cpp ou .zip</p><p class="text-xs text-muted">até 3 arquivos no total, máximo de 8 MB por tentativa</p></label></div>' +
      '<div class="card"><h4 class="mb-3" style="color:var(--blue-primary);display:flex;align-items:center;gap:8px">' + icon('box', 16) + ' Arquivo STL <span class="badge badge-gray">Opcional</span></h4><label class="file-upload-area" for="mission-stl-files" style="display:block;cursor:pointer"><input id="mission-stl-files" type="file" accept=".stl" multiple style="display:none" />' + icon('upload', 24) + '<p class="text-sm font-semibold mb-1" id="mission-stl-label" style="margin-top:8px">Selecionar arquivo .stl</p><p class="text-xs text-muted">até 3 arquivos no total, máximo de 8 MB por tentativa</p></label></div>' +
      '</div>' +
      '<div class="card mb-4"><h4 class="mb-3" style="color:var(--orange)">O que aprendi hoje? ✨</h4><textarea class="form-textarea" id="mission-learned" placeholder="Compartilhe o que você aprendeu nesta missão..." rows="3" required></textarea></div>' +
      (pendingRequired > 0 ? '<div class="mission-submit-blocked">' + icon('lock', 17) + '<span>Conclua as ' + pendingRequired + ' atividade' + (pendingRequired === 1 ? '' : 's') + ' obrigatória' + (pendingRequired === 1 ? '' : 's') + ' do checklist para liberar o envio.</span></div>' : '') +
      '<div class="flex justify-center"><button type="submit" class="btn btn-accent btn-lg" style="min-width:220px;justify-content:center" ' + (pendingRequired > 0 ? 'disabled' : '') + '>' + icon('send', 18) + ' Enviar Missão</button></div>' +
      '</form>'
    );

    return (
      '<div class="animate-fade mission-page">' + selector +
      '<section class="mission-detail">' + completionNotice +
      '<div class="card mb-4 mission-detail-head">' +
      '<div class="flex items-center gap-3 mb-2 flex-wrap"><span class="badge badge-blue">' + m.modulo + '</span><span class="badge badge-gray">Aula ' + m.aula + '</span><span class="badge ' + (m.tipo === 'extra' ? 'badge-orange' : 'badge-blue') + '">' + (m.tipo === 'extra' ? 'Extra' : 'Obrigatória') + '</span></div>' +
      '<h2 class="mb-2">' + m.titulo + '</h2><p class="text-muted">' + m.descricao + '</p>' +
      '</div>' +
      '<div class="grid-2 mb-4">' +
      '<div class="card"><h4 class="mb-3" style="color:var(--blue-primary)">Objetivo da aula</h4><p class="text-sm">' + m.objetivo + '</p></div>' +
      '<div class="card"><h4 class="mb-3" style="color:var(--blue-primary)">Arquivos de apoio</h4><div style="display:flex;flex-direction:column;gap:8px">' + filesHtml + '</div></div>' +
      '</div>' +
      '<div class="card mb-4">' +
      '<button id="steps-toggle" style="display:flex;align-items:center;justify-content:space-between;width:100%;cursor:pointer;background:none;border:none;padding:0"><h4 style="color:var(--blue-primary)">Passo a passo</h4><span id="steps-chevron">' + icon('chevronUp', 18) + '</span></button>' +
      '<ol id="steps-list" style="margin-top:16px;display:flex;flex-direction:column;gap:12px;padding-left:0">' + stepsHtml + '</ol>' +
      '</div>' +
      '<section class="card mission-checklist mb-4"><div class="mission-checklist-head"><div><span class="student-section-label">CHECKLIST DA MISSÃO</span><h3>Atividades</h3></div><strong>' + requiredDone + '/' + requiredActivities.length + ' obrigatórias</strong></div><div class="mission-check-list">' + checklistHtml + '</div></section>' +
      submissionForm + '</section></div>'
    );
  }

  // ===== Lab =====
  function lab(icon, D) {
    var s = D.currentStudent;
    var kits = D.labKits || [];
    var materials = D.personalMaterials || [];

    var kitInfo = [
      { label: 'Número', value: '#' + s.computador },
      { label: 'Turma', value: s.turma },
      { label: 'Aluno', value: s.name },
      { label: 'Status', value: s.status },
    ];

    var kitInfoHtml = kitInfo
      .map(function (item) {
        return '<div style="padding:10px 14px;background:var(--gray-50);border-radius:var(--radius-sm);border:1px solid var(--gray-200)"><span style="display:block;font-size:0.6875rem;color:var(--gray-500);font-weight:600;text-transform:uppercase;letter-spacing:0.05em">' + item.label + '</span><span style="display:block;font-size:0.9375rem;font-weight:700;color:var(--gray-800);margin-top:2px">' + item.value + '</span></div>';
      })
      .join('');
    if (!kitsHtml) kitsHtml = '<div class="empty-state" style="padding:20px">Nenhum kit vinculado.</div>';

    var materialsHtml = materials
      .map(function (material) {
        return '<div class="flex items-center justify-between" style="padding:10px 0;border-bottom:1px solid var(--gray-100)"><div><span class="text-sm font-semibold">' + material.name + '</span>' + (material.notes ? '<span class="text-xs text-muted" style="display:block">' + material.notes + '</span>' : '') + '</div><span class="badge badge-gray">' + material.quantity + 'x</span></div>';
      })
      .join('');
    if (!materialsHtml) materialsHtml = '<div class="empty-state" style="padding:20px">Nenhum material pessoal cadastrado.</div>';

    var kitsHtml = kits
      .map(function (kit) {
        var items = kit.items.map(function (item) { return '<span class="badge badge-blue">' + item + '</span>'; }).join('');
        return '<div style="margin-bottom:12px"><p class="text-sm font-semibold mb-2" style="color:var(--gray-700)">' + kit.name + '</p><div style="display:flex;flex-wrap:wrap;gap:6px">' + items + '</div></div>';
      })
      .join('');

    return (
      '<div class="animate-fade">' +
      '<div class="grid-2 mb-6">' +
      '<div class="card" style="border-left:4px solid var(--blue-primary)"><div class="flex items-center mb-4" style="gap:12px"><div class="stat-icon blue">' + icon('monitor', 22) + '</div><div><h3>Computador #' + s.computador + '</h3><p class="text-sm text-muted">Estação de trabalho</p></div></div><div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">' + kitInfoHtml + '</div></div>' +
      '<div class="card" style="border-left:4px solid var(--orange)"><div class="flex items-center mb-4" style="gap:12px"><div class="stat-icon orange">' + icon('cpu', 22) + '</div><div><h3>Kits Utilizados</h3><p class="text-sm text-muted">Material em uso neste módulo</p></div></div>' + kitsHtml + '</div>' +
      '</div>' +
      '<div class="card mb-6"><div class="section-header mb-4"><div class="flex items-center gap-2">' + icon('box', 18) + '<span class="section-title">Materiais pessoais</span></div></div>' + materialsHtml + '</div>' +
      '<div class="card">' +
      '<div class="section-header mb-4"><div class="flex items-center" style="gap:10px">' + icon('stickyNote', 18) + '<span class="section-title">Anotações do Laboratório</span></div><button class="btn btn-primary btn-sm" id="lab-save" style="gap:6px">' + icon('save', 14) + ' Salvar</button></div>' +
      '<textarea class="form-textarea" id="lab-notes" rows="10">' + (s.labNotes || '') + '</textarea>' +
      '<p class="text-xs text-muted mt-2">Essas anotações ficam salvas no seu perfil e podem ser acessadas a qualquer momento.</p>' +
      '</div>' +
      '</div>'
    );
  }

  // ===== Files =====
  function files(icon, D) {
    var fileTypes = {
      code: { label: 'Código', icon: 'fileCode', color: 'var(--blue-primary)', bg: 'var(--blue-faint)' },
      stl: { label: 'STL', icon: 'box', color: 'var(--orange)', bg: 'var(--orange-faint)' },
      pdf: { label: 'PDF', icon: 'fileText', color: '#EF4444', bg: '#FEE2E2' },
      image: { label: 'Imagem', icon: 'image', color: 'var(--success)', bg: 'var(--success-light)' },
    };

    var filesData = D.files || [];
    var submissionsData = D.submissions || [];

    var statusMap = {
      aprovado: { label: 'Aprovado', cls: 'badge-green' },
      pendente: { label: 'Aguardando', cls: 'badge-yellow' },
      refazer: { label: 'Refazer', cls: 'badge-red' },
      rascunho: { label: 'Rascunho', cls: 'badge-gray' },
    };

    var submissionRows = submissionsData.map(function (submission) {
      var sm = statusMap[submission.status] || statusMap.pendente;
      var attachmentCount = (submission.arquivosDetalhes || []).length;
      var attachmentLabel = attachmentCount
        ? attachmentCount + ' arquivo' + (attachmentCount === 1 ? '' : 's') + ' anexado' + (attachmentCount === 1 ? '' : 's')
        : 'Sem arquivos anexados';
      return '<tr><td><div><strong class="text-sm">' + submission.missao + '</strong><span class="text-xs text-muted" style="display:block">Tentativa ' + submission.tentativa + '</span></div></td><td class="text-sm text-muted">' + submission.enviadoEm + '</td><td class="text-sm text-muted">' + attachmentLabel + '</td><td><span class="badge ' + sm.cls + '">' + sm.label + '</span></td><td class="text-sm text-muted">' + (submission.feedback || 'Aguardando retorno do professor') + '</td></tr>';
    }).join('');
    if (!submissionRows) submissionRows = '<tr><td colspan="5"><div class="empty-state">Nenhuma tarefa enviada ainda.</div></td></tr>';

    var typeKeys = Object.keys(fileTypes);
    var filterBtns = ['<button class="btn btn-sm btn-primary" data-filter="todos">Todos</button>']
      .concat(
        typeKeys.map(function (t) {
          return '<button class="btn btn-sm btn-ghost" data-filter="' + t + '">' + fileTypes[t].label + '</button>';
        })
      )
      .join('');

    var statCards = typeKeys
      .map(function (k) {
        var v = fileTypes[k];
        var count = filesData.filter(function (f) { return f.type === k; }).length;
        return '<div style="padding:16px;border-radius:var(--radius);background:' + v.bg + ';border:1px solid ' + v.color + '22;text-align:center">' + icon(v.icon, 24) + '<div style="font-size:1.5rem;font-weight:800;color:' + v.color + ';margin-top:8px">' + count + '</div><div style="font-size:0.75rem;color:var(--gray-600);font-weight:600">' + v.label + 's</div></div>';
      })
      .join('');

    var rowsHtml = filesData
      .map(function (f) {
        var ft = fileTypes[f.type];
        var sm = statusMap[f.status];
        return (
          '<tr><td><div class="flex items-center" style="gap:10px"><div style="width:32px;height:32px;border-radius:var(--radius-sm);background:' + ft.bg + ';display:flex;align-items:center;justify-content:center;flex-shrink:0">' + icon(ft.icon, 16) + '</div><span class="font-semibold text-sm">' + f.name + '</span></div></td>' +
          '<td class="text-sm text-muted">' + f.missao + '</td>' +
          '<td><div class="flex items-center" style="gap:6px">' + icon('clock', 13) + '<span class="text-sm text-muted">' + f.enviado + '</span></div></td>' +
          '<td class="text-sm text-muted">' + f.size + '</td>' +
          '<td><span class="badge ' + sm.cls + '">' + sm.label + '</span></td>' +
          '<td><a class="btn btn-ghost btn-sm btn-icon" href="' + f.downloadUrl + '" title="Baixar arquivo">' + icon('download', 14) + '</a></td></tr>'
        );
      })
      .join('');
    if (!rowsHtml) rowsHtml = '<tr><td colspan="6"><div class="empty-state">Nenhum arquivo enviado.</div></td></tr>';

    return (
      '<div class="animate-fade">' +
      '<div class="card mb-6 student-delivery-history"><div class="section-header mb-4"><div><span class="section-title">Histórico de entregas</span><p class="text-xs text-muted mt-1">Toda tarefa enviada aparece aqui, mesmo quando não possui arquivo anexado.</p></div><span class="badge badge-gray">' + submissionsData.length + ' entrega' + (submissionsData.length === 1 ? '' : 's') + '</span></div>' +
      '<div class="table-wrapper"><table class="table"><thead><tr><th>Missão</th><th>Enviado em</th><th>Anexos</th><th>Status</th><th>Feedback</th></tr></thead><tbody>' + submissionRows + '</tbody></table></div></div>' +
      '<div class="section-header mb-4"><div><span class="section-title">Arquivos enviados</span><p class="text-xs text-muted mt-1">Códigos, STL, PDFs e imagens anexados às suas entregas.</p></div><span class="badge badge-gray" id="file-count">' + filesData.length + ' arquivos</span></div>' +
      '<div class="flex gap-2 mb-6 flex-wrap" id="file-filters">' + filterBtns + '</div>' +
      '<div class="card mb-6"><div class="grid-4 mb-4">' + statCards + '</div></div>' +
      '<div class="card"><div class="section-header mb-4"><span class="section-title">Lista de arquivos</span></div>' +
      '<div class="table-wrapper"><table class="table"><thead><tr><th>Arquivo</th><th>Missão</th><th>Enviado em</th><th>Tamanho</th><th>Status</th><th></th></tr></thead><tbody id="file-rows">' + rowsHtml + '</tbody></table></div>' +
      '</div>' +
      '</div>'
    );
  }

  // ===== CreateStore =====
  function store(icon, D) {
    var student = D.currentStudent;
    var products = D.storeProducts || [];
    var requests = D.storeRequests || [];
    var balance = Number(student.joys || 0);
    var statusMap = {
      pending: { label: 'Aguardando aprovação', cls: 'store-status-pending', icon: 'clock' },
      approved: { label: 'Compra aprovada', cls: 'store-status-approved', icon: 'checkCircle' },
      rejected: { label: 'Solicitação recusada', cls: 'store-status-rejected', icon: 'x' },
      cancelled: { label: 'Solicitação cancelada', cls: 'store-status-cancelled', icon: 'x' },
    };

    function presentation(product) {
      var name = product.name.toLowerCase();
      if (name.indexOf('bala') !== -1) return { icon: 'candy', accent: '#F06F92', surface: '#FDEAF0' };
      if (name.indexOf('bomb') !== -1) return { icon: 'gift', accent: '#E85D75', surface: '#FCE8EC' };
      if (name.indexOf('kit mouse') !== -1) return { icon: 'keyboard', accent: '#2563EB', surface: '#E7F0FF' };
      if (name.indexOf('mouse') !== -1) return { icon: 'mouse', accent: '#1E72B8', surface: '#E4F2FC' };
      if (name.indexOf('headset') !== -1) return { icon: 'headphones', accent: '#7C3AED', surface: '#F0EAFE' };
      return { icon: 'box', accent: '#F26522', surface: '#FFF0E7' };
    }

    var productsHtml = products.map(function (product) {
      var price = Number(product.priceJoys || 0);
      var pendingRequest = requests.filter(function (request) {
        return request.status === 'pending' && Number(request.productId) === Number(product.id);
      })[0];
      var enoughJoys = balance >= price;
      var soldOut = Boolean(product.soldOut);
      var missingJoys = Math.max(0, price - balance);
      var visual = presentation(product);
      return (
        '<article class="store-product-card store-product-card-catalog" style="--store-accent:' + visual.accent + ';--store-surface:' + visual.surface + '">' +
        '<div class="store-product-visual">' +
        '<span class="store-shape store-shape-one"></span><span class="store-shape store-shape-two"></span><span class="store-shape store-shape-three"></span>' +
        (product.imageUrl ? '<img class="store-product-image" src="' + product.imageUrl + '" alt="' + product.name + '">' : '<div class="store-product-icon">' + icon(visual.icon, 42) + '</div>') +
        '<span class="store-visual-label">' + product.category.toUpperCase() + '</span>' +
        '</div>' +
        '<div class="store-product-content">' +
        '<div class="flex items-center justify-between gap-2"><span class="store-category">' + product.category + '</span><span class="store-stock ' + (soldOut ? 'sold-out' : '') + '">' + (product.inventoryMode === 'unlimited' ? 'Disponibilidade ilimitada' : soldOut ? 'Esgotado' : product.availableQuantity + ' disponível' + (Number(product.availableQuantity) === 1 ? '' : 'is')) + '</span></div>' +
        '<h2>' + product.name + '</h2>' +
        '<p>' + product.description + '</p>' +
        '<div class="store-product-footer">' +
        '<div><span class="store-price-label">Valor</span><strong class="store-price">' + joyLabel(price) + '</strong></div>' +
        '<button class="btn btn-accent store-request-button" data-store-product="' + product.id + '" ' + ((!enoughJoys || pendingRequest || soldOut) ? 'disabled' : '') + '>' +
        icon(pendingRequest ? 'clock' : 'shoppingBag', 16) + ' ' +
        (pendingRequest ? 'Pedido pendente' : soldOut ? 'Produto esgotado' : enoughJoys ? 'Solicitar' : 'Saldo insuficiente') + '</button>' +
        '</div>' +
        (!enoughJoys && !pendingRequest ? '<p class="store-missing">Faltam <strong>' + joyLabel(missingJoys) + '</strong>.</p>' : '') +
        '</div></article>'
      );
    }).join('');
    if (!productsHtml) productsHtml = '<div class="card empty-state">Nenhum item está disponível na CreateStore.</div>';

    var requestRows = requests.map(function (request) {
      var status = statusMap[request.status] || statusMap.pending;
      return (
        '<article class="store-history-item" data-store-history-status="' + request.status + '">' +
        '<div class="store-history-icon ' + status.cls + '">' + icon(status.icon, 18) + '</div>' +
        '<div class="store-history-main"><div class="store-history-heading"><strong>' + request.productName + '</strong><span class="store-status ' + status.cls + '">' + status.label + '</span></div>' +
        '<p>' + request.details + '</p>' +
        (request.reviewNotes ? '<div class="store-review-note"><strong>Retorno da equipe:</strong> ' + request.reviewNotes + '</div>' : '') +
        '<div class="store-history-meta"><span>Pedido #' + request.id + '</span><span>' + request.requestedAt + '</span>' +
        (request.reviewerName ? '<span>Por ' + request.reviewerName + '</span>' : '') + '</div></div>' +
        '<div class="store-history-side"><strong>' + joyLabel(request.totalJoys) + '</strong>' +
        (request.status === 'pending' ? '<button class="btn btn-ghost btn-sm" data-store-cancel="' + request.id + '">Cancelar</button>' : '') +
        '</div></article>'
      );
    }).join('');
    if (!requestRows) requestRows = '<div class="empty-state store-empty-history">Você ainda não fez nenhuma solicitação.</div>';

    return (
      '<div class="animate-fade store-page">' +
      '<section class="store-hero">' +
      '<div><span class="store-kicker">CREATEJOY REWARDS</span><h1>CreateStore!</h1><p>Transforme seus Joys em prêmios, experiências e criações feitas no nosso laboratório.</p></div>' +
      '<div class="store-balance-card"><div class="store-balance-icon">' + icon('coins', 23) + '</div><div><span>Seu saldo</span><strong>' + balance + ' Joys</strong></div></div>' +
      '</section>' +
      '<section class="store-catalog"><div class="store-section-title"><div><span>CATÁLOGO</span><h3>Disponíveis para solicitar</h3></div><span class="badge badge-green">' + products.length + ' produto' + (products.length === 1 ? '' : 's') + '</span></div><div class="store-products-grid">' + productsHtml + '</div></section>' +
      '<section class="card store-request-panel" id="store-request-panel" style="display:none"></section>' +
      '<section class="card store-history"><div class="section-header"><div><span class="store-kicker">ACOMPANHAMENTO</span><h3>Minhas solicitações</h3></div><span class="badge badge-gray">' + requests.length + ' pedido' + (requests.length === 1 ? '' : 's') + '</span></div><div class="store-history-list">' + requestRows + '</div></section>' +
      '</div>'
    );
  }

  // ===== Carteira de Investimentos educativa =====
  function investments(icon, D) {
    var wallet = D.investmentWallet || { products: [], transactions: [] };
    var products = wallet.products || [];
    var transactions = wallet.transactions || [];
    var balance = Number(wallet.walletBalance != null ? wallet.walletBalance : ((D.currentStudent && D.currentStudent.joys) || 0));
    var totalPrincipal = products.reduce(function (sum, item) { return sum + Number(item.principalJoys || 0); }, 0);
    var totalMarketValue = products.reduce(function (sum, item) { return sum + Number(item.marketValueJoys || 0); }, 0);
    var totalResult = products.reduce(function (sum, item) { return sum + Number(item.profitLossJoys || 0); }, 0);
    var totalTodayOpeningValue = products.reduce(function (sum, item) { return sum + Number(item.todayOpeningValueJoys || 0); }, 0);
    var totalTodayResult = products.reduce(function (sum, item) { return sum + Number(item.todayProfitLossJoys || 0); }, 0);
    var totalTodayPercent = totalTodayOpeningValue > 0 ? (totalTodayResult / totalTodayOpeningValue) * 100 : 0;

    function signedPercent(value) {
      var number = Number(value || 0);
      return (number > 0 ? '+' : '') + number.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%';
    }

    function signedJoys(value) {
      var number = Number(value || 0);
      return (number > 0 ? '+' : '') + number.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' Joys';
    }

    function variationClass(value) {
      return Number(value || 0) > 0 ? 'is-positive' : Number(value || 0) < 0 ? 'is-negative' : 'is-neutral';
    }

    function marketChart(product) {
      var history = product.history || [];
      if (history.length < 2) return '<div class="investment-chart-empty">Histórico sendo formado.</div>';
      var values = history.map(function (point) { return Number(point.price || 0); });
      var minimum = Math.min.apply(Math, values);
      var maximum = Math.max.apply(Math, values);
      var range = Math.max(maximum - minimum, 0.01);
      var width = 280;
      var height = 88;
      var padding = 5;
      var points = values.map(function (value, index) {
        var x = padding + (index / (values.length - 1)) * (width - padding * 2);
        var y = height - padding - ((value - minimum) / range) * (height - padding * 2);
        return x.toFixed(1) + ',' + y.toFixed(1);
      }).join(' ');
      var positive = Number(product.changeMonth || 0) >= 0;
      return '<div class="investment-chart ' + (positive ? 'is-positive' : 'is-negative') + '"><svg viewBox="0 0 ' + width + ' ' + height + '" role="img" aria-label="Oscilação simulada dos últimos 30 dias"><line x1="5" y1="44" x2="275" y2="44"></line><polyline points="' + points + '"></polyline></svg><div><span>' + history[0].date + '</span><strong>30 dias</strong><span>' + history[history.length - 1].date + '</span></div></div>';
    }

    var cards = products.map(function (product, index) {
      var visualByType = {
        fixed_income: { accent: '#1E72B8', icon: 'shieldCheck' },
        fund: { accent: '#7C3AED', icon: 'barChart' },
        stocks: { accent: '#F26522', icon: 'trendingUp' },
        etf: { accent: '#059669', icon: 'activity' },
        crypto: { accent: '#D97706', icon: 'coins' },
      };
      var visual = visualByType[product.assetType] || { accent: ['#1E72B8', '#7C3AED', '#F26522'][index % 3], icon: 'rocket' };
      var resultClass = variationClass(product.profitLossJoys);
      var todayResultClass = variationClass(product.todayProfitLossJoys);
      return '<article class="investment-card investment-market-card" style="--investment-accent:' + visual.accent + '"><div class="investment-card-head"><div class="investment-icon">' + icon(visual.icon, 23) + '</div><div><span>' + product.riskLabel + '</span><h3>' + product.name + '</h3><small>' + product.symbol + '</small></div><div class="investment-day-change ' + variationClass(product.changeDay) + '">' + signedPercent(product.changeDay) + '<small>ativo hoje</small></div></div><p>' + product.description + '</p><div class="investment-quote"><div><span>Cotação simulada</span><strong>' + Number(product.currentPrice).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' Joys</strong><small>por cota</small></div><div class="investment-periods"><span class="' + variationClass(product.changeDay) + '"><small>1 dia</small>' + signedPercent(product.changeDay) + '</span><span class="' + variationClass(product.changeWeek) + '"><small>7 dias</small>' + signedPercent(product.changeWeek) + '</span><span class="' + variationClass(product.changeMonth) + '"><small>30 dias</small>' + signedPercent(product.changeMonth) + '</span></div></div>' + marketChart(product) + '<div class="investment-position"><div><span>Você investiu</span><strong>' + Number(product.principalJoys).toLocaleString('pt-BR') + ' Joys</strong></div><div><span>Valor atual</span><strong>' + Number(product.marketValueJoys).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' Joys</strong></div><div><span>Seu rendimento hoje</span><strong class="' + todayResultClass + '">' + signedJoys(product.todayProfitLossJoys) + '</strong><small class="' + todayResultClass + '">' + signedPercent(product.todayProfitLossPercent) + '</small></div><div><span>Seu rendimento total</span><strong class="' + resultClass + '">' + signedJoys(product.profitLossJoys) + '</strong><small class="' + resultClass + '">' + signedPercent(product.profitLossPercent) + ' desde a compra</small></div><div><span>Disponível para retirar</span><strong>' + Number(product.availableJoys).toLocaleString('pt-BR') + ' Joys</strong></div></div><div class="investment-actions"><button class="btn btn-primary" data-investment-action="deposit" data-product-id="' + product.id + '">' + icon('plus', 14) + ' Investir</button><button class="btn btn-outline" data-investment-action="withdraw" data-product-id="' + product.id + '" ' + (Number(product.availableJoys) < 1 ? 'disabled' : '') + '>' + icon('arrowLeftRight', 14) + ' Retirar</button></div><small class="investment-minimum">Aporte mínimo: ' + product.minimumJoys + ' Joys · o rendimento de hoje considera somente as cotas que já estavam investidas antes da cotação atual</small></article>';
    }).join('');
    if (!cards) cards = '<div class="card empty-state">As opções educativas de investimento ainda não foram ativadas.</div>';

    var history = transactions.map(function (transaction) {
      var deposit = transaction.type === 'deposit';
      return '<tr><td><span class="badge ' + (deposit ? 'badge-blue' : 'badge-green') + '">' + (deposit ? 'Aporte' : 'Retirada') + '</span></td><td class="font-semibold text-sm">' + transaction.productName + '</td><td class="font-semibold">' + (deposit ? '−' : '+') + transaction.amountJoys + ' Joys</td><td class="text-sm text-muted">' + transaction.createdAt + '</td><td class="text-sm">' + transaction.balanceAfter + ' Joys</td></tr>';
    }).join('');
    if (!history) history = '<tr><td colspan="5"><div class="empty-state">Você ainda não realizou nenhum investimento.</div></td></tr>';

    return '<div class="animate-fade investment-page"><section class="investment-hero"><div><span>APRENDER FAZENDO</span><h1>Carteira de Investimentos</h1><p>Invista Joys em ativos simulados, acompanhe altas e quedas por dia, semana e mês e aprenda como risco e tempo afetam uma carteira.</p></div><div class="investment-wallet-balance"><span>Carteira disponível</span><strong>' + balance.toLocaleString('pt-BR') + ' Joys</strong></div></section><section class="investment-notice">' + icon('alertTriangle', 20) + '<div><strong>Esta é uma simulação educativa.</strong><p>Os Joys não são dinheiro real, somente utilizado dentro da CreateJoy. Você pode retirar os Joys inteiros disponíveis quando quiser.</p></div></section><div class="grid-4 investment-summary"><div class="stat-card"><div><span class="stat-label">Total investido</span><strong class="stat-value">' + totalPrincipal.toLocaleString('pt-BR') + '</strong><small>Joys usados na compra de cotas</small></div></div><div class="stat-card"><div><span class="stat-label">Valor atual</span><strong class="stat-value">' + totalMarketValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '</strong><small>Joys conforme as cotações simuladas</small></div></div><div class="stat-card"><div><span class="stat-label">Rendimento de hoje</span><strong class="stat-value ' + variationClass(totalTodayResult) + '">' + signedJoys(totalTodayResult) + '</strong><small>' + signedPercent(totalTodayPercent) + ' sobre as cotas de ontem</small></div></div><div class="stat-card"><div><span class="stat-label">Resultado total</span><strong class="stat-value ' + variationClass(totalResult) + '">' + signedJoys(totalResult) + '</strong><small>desde as compras realizadas</small></div></div></div><section><div class="section-header mb-4"><div><span class="store-kicker">MERCADO SIMULADO</span><h3>Escolha onde investir</h3><p class="text-xs text-muted mt-1">A variação do ativo mostra o movimento da cotação. O rendimento do aluno considera quando as cotas foram compradas.</p></div></div><div class="investment-grid">' + cards + '</div></section><section class="card investment-history"><div class="section-header mb-4"><div><span class="store-kicker">EXTRATO</span><h3>Movimentações</h3></div></div><div class="table-wrapper"><table class="table"><thead><tr><th>Tipo</th><th>Opção</th><th>Valor</th><th>Data</th><th>Saldo da carteira</th></tr></thead><tbody>' + history + '</tbody></table></div></section></div>';
  }

  // ===== Profile =====
  function profile(icon, D) {
    var s = D.currentStudent;
    var mod = D.modules.filter(function (m) { return m.name === s.modulo; })[0];

    var statCards = [
      { label: 'Missões concluídas', value: s.missoesConcluidas, color: 'var(--success)' },
      { label: 'Progresso geral', value: s.progresso + '%', color: 'var(--blue-primary)' },
      { label: 'Medalhas', value: D.medals.filter(function (m) { return m.conquistada; }).length, color: 'var(--orange)' },
    ]
      .map(function (stat) {
        return '<div class="stat-card" style="flex-direction:column;align-items:center;text-align:center"><span class="stat-value" style="color:' + stat.color + '">' + stat.value + '</span><span class="stat-label">' + stat.label + '</span></div>';
      })
      .join('');

    var completedModuleIds = (s.modulosConcluidosIds || []).map(Number);
    var moduleProgress = D.modules
      .filter(function (item) {
        return Number(item.id) === Number(s.moduloId) || completedModuleIds.indexOf(Number(item.id)) !== -1;
      })
      .map(function (m) {
        var isActive = Number(m.id) === Number(s.moduloId) || m.name === s.modulo;
        var pct = isActive ? s.progresso : 100;
        return '<div class="mb-3"><div class="flex items-center justify-between mb-1"><span class="text-sm font-semibold">' + m.name + '</span><span class="text-xs" style="color:' + m.cor + ';font-weight:700">' + pct + '%</span></div><div class="progress-bar"><div class="progress-fill" style="width:' + pct + '%;background:' + m.cor + '"></div></div></div>';
      })
      .join('');
    if (!moduleProgress) moduleProgress = '<p class="text-sm text-muted">O progresso aparecerá conforme o módulo atual avançar.</p>';

    var earnedProfileMedals = D.medals.filter(function (m) { return m.conquistada; });
    var medalsHtml = earnedProfileMedals.map(function (m) {
      return '<div class="student-profile-medal"><span>' + m.icone + '</span><div><strong>' + m.nome + '</strong><small>' + m.descricao + '</small><em>' + (m.conquistadaEm || 'Conquistada') + '</em></div></div>';
    }).join('');
    if (!medalsHtml) medalsHtml = '<div class="empty-state" style="padding:24px">Suas medalhas aparecerão aqui conforme você avançar.</div>';

    return (
      '<div class="animate-fade student-profile-page" style="max-width:900px;margin:0 auto">' +
      '<div class="card mb-6">' +
      '<div class="profile-header">' +
      '<div class="profile-avatar-wrap" id="student-profile-avatar">' + (s.fotoUrl ? '<img class="avatar avatar-xl profile-avatar" src="' + s.fotoUrl + '" alt="Foto de ' + s.name + '" style="object-fit:cover" />' : '<div class="avatar avatar-xl profile-avatar">' + s.initials + '</div>') + '</div>' +
      '<div class="profile-info"><h2>' + s.name + '</h2><p class="text-muted">' + s.email + '</p><div class="flex gap-2 mt-3 flex-wrap"><span class="badge badge-blue">' + s.turma + '</span><span class="badge" style="background:' + (mod ? mod.cor : '#333') + '22;color:' + (mod ? mod.cor : '#333') + '">Módulo ' + s.modulo + '</span><span class="badge badge-gray">Computador #' + s.computador + '</span></div></div>' +
      '<button class="btn btn-outline btn-sm" id="change-password-btn" style="align-self:flex-start">' + icon('edit', 14) + ' Alterar senha</button>' +
      '</div>' +
      '</div>' +
      '<div class="card mb-6 student-profile-edit-card"><div class="section-header mb-4"><div><span class="student-section-label">DADOS PESSOAIS</span><h3>Editar perfil e foto</h3><p class="text-xs text-muted mt-1">A turma, o módulo e o computador continuam sendo definidos pela supervisão.</p></div></div><form id="student-profile-form"><div class="grid-2"><div><div class="form-group"><label class="form-label" for="student-profile-name">Nome completo</label><input class="form-input" id="student-profile-name" maxlength="120" value="' + s.name + '" required /></div><div class="form-group"><label class="form-label" for="student-profile-email">E-mail</label><input class="form-input" id="student-profile-email" type="email" maxlength="190" value="' + s.email + '" required /></div><div class="form-group"><label class="form-label" for="student-profile-phone">Telefone</label><input class="form-input" id="student-profile-phone" maxlength="30" value="' + (s.telefone || '') + '" placeholder="(00) 00000-0000" /></div></div><div class="student-avatar-editor"><label for="student-profile-photo">' + icon('image', 24) + '<strong>Escolher foto de perfil</strong><span>Use JPG ou PNG com no máximo 1,5 MB.</span><small id="student-profile-photo-name">Nenhuma nova foto selecionada</small></label><input id="student-profile-photo" type="file" accept="image/jpeg,image/png" hidden /></div></div><div class="flex justify-end mt-4"><button class="btn btn-primary" type="submit">' + icon('save', 15) + ' Salvar meu perfil</button></div></form></div>' +
      '<div class="card mb-6" id="password-panel" style="display:none">' +
      '<h4 class="mb-4" style="color:var(--blue-primary)">Alterar senha</h4>' +
      '<form id="change-password-form"><div class="grid-3">' +
      '<div class="form-group"><label class="form-label">Senha atual</label><input class="form-input" type="password" id="current-password" autocomplete="current-password" required /></div>' +
      '<div class="form-group"><label class="form-label">Nova senha</label><input class="form-input" type="password" id="new-password" autocomplete="new-password" minlength="8" required /></div>' +
      '<div class="form-group"><label class="form-label">Confirmar nova senha</label><input class="form-input" type="password" id="confirm-password" autocomplete="new-password" minlength="8" required /></div>' +
      '</div><div class="flex justify-end gap-2"><button type="button" class="btn btn-ghost btn-sm" id="cancel-password-btn">Cancelar</button><button type="submit" class="btn btn-primary btn-sm">Salvar nova senha</button></div></form>' +
      '</div>' +
      '<div class="grid-3 mb-6">' + statCards + '</div>' +
      '<div class="grid-2 mb-6">' +
      '<div class="card"><h4 class="mb-4" style="color:var(--blue-primary)">Progresso por módulo</h4>' + moduleProgress + '</div>' +
      '<div class="card"><div class="flex items-center justify-between gap-2 mb-4"><div class="flex items-center gap-2">' + icon('award', 18) + '<h4 style="color:var(--orange)">Conquistas</h4></div><span class="badge badge-orange">' + earnedProfileMedals.length + '</span></div><div class="student-profile-medals">' + medalsHtml + '</div></div>' +
      '</div>' +
      '</div>'
    );
  }

  // ===== Event binding =====
  function bind(page, navigate, D) {
    var icon = window.Icons.render;

    // Navigation buttons (data-nav)
    document.querySelectorAll('[data-nav]').forEach(function (el) {
      el.addEventListener('click', function () {
        var missionId = el.getAttribute('data-open-mission');
        if (missionId) window.CreateJoyApp.getRawData().selectedMissionId = Number(missionId);
        navigate(el.getAttribute('data-nav'));
      });
    });

    if (page === 'mission') {
      document.querySelectorAll('[data-open-mission]:not([data-nav])').forEach(function (button) {
        button.addEventListener('click', function () {
          window.CreateJoyApp.getRawData().selectedMissionId = Number(button.getAttribute('data-open-mission'));
          navigate('mission');
        });
      });

      document.querySelectorAll('[data-activity-toggle]').forEach(function (checkbox) {
        checkbox.addEventListener('change', async function () {
          var completed = checkbox.checked;
          checkbox.disabled = true;
          try {
            var payload = await window.CreateJoyApi.toggleActivity(checkbox.getAttribute('data-activity-toggle'), completed);
            window.CreateJoyApp.updateData(payload.data);
            navigate('mission');
          } catch (error) {
            checkbox.checked = !completed;
            checkbox.disabled = false;
            window.alert(error.message);
          }
        });
      });

      var stepsToggle = document.getElementById('steps-toggle');
      if (stepsToggle) {
        stepsToggle.addEventListener('click', function () {
          var list = document.getElementById('steps-list');
          var chevron = document.getElementById('steps-chevron');
          if (list.style.display === 'none') {
            list.style.display = 'flex';
            chevron.innerHTML = icon('chevronUp', 18);
          } else {
            list.style.display = 'none';
            chevron.innerHTML = icon('chevronDown', 18);
          }
        });
      }
      var form = document.getElementById('mission-form');
      if (form) {
        ['code', 'stl'].forEach(function (kind) {
          var input = document.getElementById('mission-' + kind + '-files');
          var label = document.getElementById('mission-' + kind + '-label');
          if (input && label) {
            input.addEventListener('change', function () {
              label.textContent = input.files.length
                ? Array.prototype.map.call(input.files, function (file) { return file.name; }).join(', ')
                : 'Selecione seus arquivos';
            });
          }
        });

        form.addEventListener('submit', async function (e) {
          e.preventDefault();
          var submitButton = form.querySelector('button[type="submit"]');
          var originalLabel = submitButton.innerHTML;
          var formData = new FormData();
          var submittedMissionId = form.getAttribute('data-mission-id');
          var attachmentCount = 0;
          formData.append('mission_id', submittedMissionId);
          formData.append('notes', document.getElementById('mission-notes').value);
          formData.append('learned', document.getElementById('mission-learned').value);
          ['mission-code-files', 'mission-stl-files'].forEach(function (id) {
            var input = document.getElementById(id);
            Array.prototype.forEach.call(input.files, function (file) {
              formData.append('files[]', file);
              attachmentCount += 1;
            });
          });

          submitButton.disabled = true;
          submitButton.textContent = 'Enviando...';
          try {
            var payload = await window.CreateJoyApi.submitMission(formData);
            window.CreateJoyApp.updateData(payload.data);
            window.CreateJoyApp.getRawData().selectedMissionId = Number(submittedMissionId);
            var main = document.querySelector('.page-body');
            main.innerHTML = '<div class="animate-fade mission-send-success"><div class="mission-send-success-icon">' + icon('checkCircle', 38) + '</div><span>ENTREGA REGISTRADA</span><h2>Missão enviada!</h2><p>Seu professor já pode visualizar a tarefa. ' + (attachmentCount ? attachmentCount + ' arquivo' + (attachmentCount === 1 ? ' foi anexado.' : 's foram anexados.') : 'A entrega foi registrada sem arquivos anexados.') + '</p><button class="btn btn-primary" id="back-to-mission">Ver entrega enviada</button></div>';
            document.getElementById('back-to-mission').addEventListener('click', function () { navigate('mission'); });
          } catch (error) {
            window.alert(error.message);
            submitButton.disabled = false;
            submitButton.innerHTML = originalLabel;
          }
        });
      }
    }

    if (page === 'lab') {
      var saveBtn = document.getElementById('lab-save');
      if (saveBtn) {
        saveBtn.addEventListener('click', async function () {
          var originalLabel = saveBtn.innerHTML;
          saveBtn.disabled = true;
          saveBtn.textContent = 'Salvando...';
          try {
            await window.CreateJoyApi.saveLabNotes(document.getElementById('lab-notes').value);
            saveBtn.innerHTML = window.Icons.render('checkCircle', 14) + ' Salvo!';
          } catch (error) {
            window.alert(error.message);
            saveBtn.innerHTML = originalLabel;
          }
          saveBtn.disabled = false;
          setTimeout(function () { saveBtn.innerHTML = window.Icons.render('save', 14) + ' Salvar'; }, 2000);
        });
      }
    }

    if (page === 'store') {
      var requestPanel = document.getElementById('store-request-panel');

      function closeRequestPanel() {
        if (!requestPanel) return;
        requestPanel.style.display = 'none';
        requestPanel.innerHTML = '';
      }

      document.querySelectorAll('[data-store-product]').forEach(function (openButton) {
        openButton.addEventListener('click', function () {
          var productId = Number(openButton.getAttribute('data-store-product'));
          var product = (D.storeProducts || []).filter(function (item) { return Number(item.id) === productId; })[0];
          if (!product || !requestPanel) return;
          var isPrint = product.name.toLowerCase().indexOf('impressão') !== -1;
          var prompt = isPrint
            ? 'Descreva o objeto, tamanho aproximado, cor e outras informações importantes. Se existir um arquivo STL, informe em qual missão ele foi enviado.'
            : 'Informe sua preferência de modelo, cor ou sabor. Caso não tenha preferência, escreva “sem preferência”.';
          requestPanel.innerHTML =
            '<div class="store-request-panel-head"><div><span class="store-kicker">SEU PEDIDO</span><h3>Solicitar ' + product.name + '</h3></div><button type="button" class="btn btn-ghost btn-icon" data-store-request-close aria-label="Fechar">' + window.Icons.render('x', 18) + '</button></div>' +
            '<form id="store-request-form" data-product-id="' + product.id + '">' +
            '<div class="form-group"><label class="form-label" for="store-request-details">Detalhes da solicitação</label><textarea class="form-textarea" id="store-request-details" rows="5" maxlength="2000" required placeholder="' + prompt + '"></textarea><span class="form-help">A equipe usará estas informações para analisar o pedido.</span></div>' +
            '<div class="store-request-confirm"><div>' + window.Icons.render('coins', 18) + '<span>Custo da solicitação</span></div><strong>' + joyLabel(product.priceJoys) + '</strong></div>' +
            '<div class="store-policy-note">' + window.Icons.render('checkCircle', 17) + '<span>Os Joys só serão retirados quando a Supervisão ou o Admin aprovar o pedido.</span></div>' +
            '<div class="flex justify-end gap-2 mt-4"><button type="button" class="btn btn-ghost" data-store-request-close>Voltar</button><button type="submit" class="btn btn-accent">' + window.Icons.render('send', 16) + ' Enviar solicitação</button></div>' +
            '</form>';
          requestPanel.style.display = 'block';
          requestPanel.scrollIntoView({ behavior: 'smooth', block: 'center' });
          var detailsInput = document.getElementById('store-request-details');
          setTimeout(function () { detailsInput.focus(); }, 250);
          requestPanel.querySelectorAll('[data-store-request-close]').forEach(function (button) {
            button.addEventListener('click', closeRequestPanel);
          });
          document.getElementById('store-request-form').addEventListener('submit', async function (event) {
            event.preventDefault();
            var requestForm = event.currentTarget;
            var submitButton = requestForm.querySelector('button[type="submit"]');
            var originalLabel = submitButton.innerHTML;
            submitButton.disabled = true;
            submitButton.textContent = 'Enviando...';
            try {
              var payload = await window.CreateJoyApi.requestStorePurchase(
                requestForm.getAttribute('data-product-id'),
                detailsInput.value.trim()
              );
              window.CreateJoyApp.updateData(payload.data);
              window.alert('Solicitação enviada! Seus Joys ainda não foram descontados.');
              navigate('store');
            } catch (error) {
              window.alert(error.message);
              submitButton.disabled = false;
              submitButton.innerHTML = originalLabel;
            }
          });
        });
      });

      document.querySelectorAll('[data-store-cancel]').forEach(function (button) {
        button.addEventListener('click', async function () {
          if (!await window.CreateJoyUI.confirm({ title: 'Cancelar esta solicitação?', message: 'O pedido será cancelado e nenhum Joy será retirado do seu saldo.', confirmLabel: 'Cancelar solicitação', tone: 'warning' })) return;
          button.disabled = true;
          try {
            var payload = await window.CreateJoyApi.cancelStorePurchase(button.getAttribute('data-store-cancel'));
            window.CreateJoyApp.updateData(payload.data);
            navigate('store');
          } catch (error) {
            button.disabled = false;
            window.alert(error.message);
          }
        });
      });
    }

    if (page === 'investments') {
      document.querySelectorAll('[data-investment-action]').forEach(function (button) {
        button.addEventListener('click', function () {
          var action = button.getAttribute('data-investment-action');
          var productId = Number(button.getAttribute('data-product-id'));
          var liveData = window.CreateJoyApp.getRawData();
          var product = ((liveData.investmentWallet && liveData.investmentWallet.products) || []).filter(function (item) { return Number(item.id) === productId; })[0];
          if (!product) return;
          var deposit = action === 'deposit';
          var walletBalance = Number(liveData.investmentWallet && liveData.investmentWallet.walletBalance != null
            ? liveData.investmentWallet.walletBalance
            : (liveData.currentStudent && liveData.currentStudent.joys) || 0);
          var modal = document.createElement('div');
          modal.className = 'admin-modal-backdrop';
          modal.innerHTML = '<section class="admin-modal investment-modal" role="dialog" aria-modal="true"><div class="admin-modal-header"><div><span class="admin-form-kicker">CARTEIRA EDUCATIVA</span><h2>' + (deposit ? 'Investir em ' : 'Retirar de ') + product.name + '</h2></div><button class="btn btn-ghost btn-icon" type="button" data-invest-close>' + icon('x', 18) + '</button></div><form id="investment-form"><div class="admin-modal-body"><div class="investment-modal-summary"><span>' + (deposit ? 'Saldo da carteira' : 'Disponível para retirada') + '</span><strong>' + Number(deposit ? walletBalance : product.availableJoys).toLocaleString('pt-BR') + ' Joys</strong><small>' + (deposit ? 'Aporte mínimo de ' + product.minimumJoys + ' Joys.' : 'Apenas Joys inteiros podem ser retirados.') + '</small></div><div class="form-group mt-4"><label class="form-label" for="investment-amount">Quantidade de Joys</label><input class="form-input" id="investment-amount" type="number" min="' + (deposit ? product.minimumJoys : 1) + '" max="' + Number(deposit ? walletBalance : product.availableJoys) + '" step="1" required /></div><div class="store-policy-note">' + icon('alertTriangle', 17) + '<span>' + (deposit ? 'Os Joys saem da carteira e passam a render somente nesta simulação.' : 'A retirada volta imediatamente para o saldo da sua carteira.') + '</span></div><div class="admin-form-error" id="investment-error" hidden></div></div><div class="admin-modal-footer"><button class="btn btn-ghost" type="button" data-invest-close>Cancelar</button><button class="btn btn-primary" type="submit">' + (deposit ? 'Confirmar aporte' : 'Confirmar retirada') + '</button></div></form></section>';
          document.body.appendChild(modal);
          function close() { modal.remove(); }
          modal.querySelectorAll('[data-invest-close]').forEach(function (item) { item.addEventListener('click', close); });
          modal.addEventListener('click', function (event) { if (event.target === modal) close(); });
          modal.querySelector('#investment-form').addEventListener('submit', async function (event) {
            event.preventDefault();
            var amount = Number(modal.querySelector('#investment-amount').value);
            var submit = event.currentTarget.querySelector('button[type="submit"]');
            var errorBox = modal.querySelector('#investment-error');
            submit.disabled = true; errorBox.hidden = true;
            try {
              var payload = deposit ? await window.CreateJoyApi.depositInvestment(productId, amount) : await window.CreateJoyApi.withdrawInvestment(productId, amount);
              window.CreateJoyApp.updateData(payload.data);
              close();
              window.CreateJoyUI.toast(payload.message, 'success');
              navigate('investments');
            } catch (error) {
              errorBox.textContent = error.message; errorBox.hidden = false; submit.disabled = false;
            }
          });
          setTimeout(function () { modal.querySelector('#investment-amount').focus(); }, 0);
        });
      });
    }

    if (page === 'profile') {
      var studentProfileForm = document.getElementById('student-profile-form');
      var studentPhotoInput = document.getElementById('student-profile-photo');
      if (studentPhotoInput) studentPhotoInput.addEventListener('change', function () {
        if (!studentPhotoInput.files.length) return;
        var file = studentPhotoInput.files[0];
        if (file.size > 1572864) {
          window.CreateJoyUI.alert('A foto deve ter no máximo 1,5 MB.', 'error', 'Foto muito grande');
          studentPhotoInput.value = '';
          return;
        }
        var reader = new FileReader();
        reader.onload = function () {
          document.getElementById('student-profile-avatar').innerHTML = '<img class="avatar avatar-xl profile-avatar" src="' + reader.result + '" alt="Prévia da nova foto" style="object-fit:cover" />';
        };
        reader.readAsDataURL(file);
        document.getElementById('student-profile-photo-name').textContent = file.name;
      });
      if (studentProfileForm) studentProfileForm.addEventListener('submit', async function (event) {
        event.preventDefault();
        var submitButton = studentProfileForm.querySelector('button[type="submit"]');
        var originalLabel = submitButton.innerHTML;
        var formData = new FormData();
        formData.append('name', document.getElementById('student-profile-name').value.trim());
        formData.append('email', document.getElementById('student-profile-email').value.trim());
        formData.append('phone', document.getElementById('student-profile-phone').value.trim());
        if (studentPhotoInput.files.length) formData.append('avatar', studentPhotoInput.files[0]);
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
      var changePasswordBtn = document.getElementById('change-password-btn');
      var passwordPanel = document.getElementById('password-panel');
      var cancelPasswordBtn = document.getElementById('cancel-password-btn');
      var changePasswordForm = document.getElementById('change-password-form');
      if (changePasswordBtn) {
        changePasswordBtn.addEventListener('click', function () {
          passwordPanel.style.display = 'block';
          document.getElementById('current-password').focus();
        });
      }
      if (cancelPasswordBtn) {
        cancelPasswordBtn.addEventListener('click', function () {
          changePasswordForm.reset();
          passwordPanel.style.display = 'none';
        });
      }
      if (changePasswordForm) {
        changePasswordForm.addEventListener('submit', async function (event) {
          event.preventDefault();
          var currentPassword = document.getElementById('current-password').value;
          var newPassword = document.getElementById('new-password').value;
          var confirmation = document.getElementById('confirm-password').value;
          if (newPassword !== confirmation) {
            window.alert('A confirmação não corresponde à nova senha.');
            return;
          }
          var submitButton = changePasswordForm.querySelector('button[type="submit"]');
          submitButton.disabled = true;
          try {
            await window.CreateJoyApi.changePassword(currentPassword, newPassword);
            changePasswordForm.reset();
            passwordPanel.style.display = 'none';
            window.alert('Senha alterada com sucesso.');
          } catch (error) {
            window.alert(error.message);
          }
          submitButton.disabled = false;
        });
      }
    }

    if (page === 'files') {
      var filterBtns = document.querySelectorAll('#file-filters button');
      var allFiles = D.files || [];
      var statusMap = { aprovado: { label: 'Aprovado', cls: 'badge-green' }, pendente: { label: 'Aguardando', cls: 'badge-yellow' }, refazer: { label: 'Refazer', cls: 'badge-red' }, rascunho: { label: 'Rascunho', cls: 'badge-gray' } };
      var fileTypes = { code: { icon: 'fileCode', color: 'var(--blue-primary)', bg: 'var(--blue-faint)' }, stl: { icon: 'box', color: 'var(--orange)', bg: 'var(--orange-faint)' }, pdf: { icon: 'fileText', color: '#EF4444', bg: '#FEE2E2' }, image: { icon: 'image', color: 'var(--success)', bg: 'var(--success-light)' } };

      filterBtns.forEach(function (btn) {
        btn.addEventListener('click', function () {
          filterBtns.forEach(function (b) { b.classList.remove('btn-primary'); b.classList.add('btn-ghost'); });
          btn.classList.add('btn-primary'); btn.classList.remove('btn-ghost');
          var filter = btn.getAttribute('data-filter');
          var filtered = filter === 'todos' ? allFiles : allFiles.filter(function (f) { return f.type === filter; });
          var tbody = document.getElementById('file-rows');
          tbody.innerHTML = filtered.map(function (f) {
            var ft = fileTypes[f.type]; var sm = statusMap[f.status];
            return '<tr><td><div class="flex items-center" style="gap:10px"><div style="width:32px;height:32px;border-radius:var(--radius-sm);background:' + ft.bg + ';display:flex;align-items:center;justify-content:center;flex-shrink:0">' + window.Icons.render(ft.icon, 16) + '</div><span class="font-semibold text-sm">' + f.name + '</span></div></td><td class="text-sm text-muted">' + f.missao + '</td><td><div class="flex items-center" style="gap:6px">' + window.Icons.render('clock', 13) + '<span class="text-sm text-muted">' + f.enviado + '</span></div></td><td class="text-sm text-muted">' + f.size + '</td><td><span class="badge ' + sm.cls + '">' + sm.label + '</span></td><td><a class="btn btn-ghost btn-sm btn-icon" href="' + f.downloadUrl + '">' + window.Icons.render('download', 14) + '</a></td></tr>';
          }).join('');
          document.getElementById('file-count').textContent = filtered.length + ' arquivos';
        });
      });
    }
  }

  return { render: render, bind: bind };
})();
