// Shared medal and achievement management for teachers and supervision.
window.AchievementPages = (function () {
  'use strict';

  function selectedStudent(D) {
    var raw = window.CreateJoyApp.getRawData();
    var selectedId = Number(raw.achievementStudentId || 0);
    var student = (D.students || []).filter(function (item) { return Number(item.id) === selectedId; })[0];
    if (!student && D.students && D.students.length) student = D.students[0];
    if (student) raw.achievementStudentId = Number(student.id);
    return student || null;
  }

  function render(icon, D) {
    var user = window.CreateJoyApp.getCurrentUser() || {};
    var management = user.role === 'supervisor' || user.role === 'admin';
    var student = selectedStudent(D);
    var medals = (D.medals || []).filter(function (medal) { return medal.status === 'ativa'; });
    var awards = D.studentMedalAwards || [];
    var earnedMap = {};
    if (student) {
      awards.filter(function (award) { return Number(award.studentId) === Number(student.id); })
        .forEach(function (award) { earnedMap[Number(award.medalId)] = award; });
    }

    var studentOptions = (D.students || []).map(function (item) {
      return '<option value="' + item.id + '"' + (student && Number(item.id) === Number(student.id) ? ' selected' : '') + '>' + item.name + ' · ' + item.turma + '</option>';
    }).join('');

    var categories = [];
    medals.forEach(function (medal) {
      if (categories.indexOf(medal.categoria) === -1) categories.push(medal.categoria);
    });
    categories.sort();
    var categoryOptions = categories.map(function (category) { return '<option value="' + category + '">' + category + '</option>'; }).join('');

    var cards = medals.map(function (medal) {
      var award = earnedMap[Number(medal.id)];
      var isEarned = !!award;
      var title = medal.secreta && !isEarned ? 'Conquista secreta' : medal.nome;
      var description = medal.secreta && !isEarned ? 'O conteúdo será revelado quando esta conquista for concedida.' : medal.descricao;
      var search = (title + ' ' + description + ' ' + medal.categoria).toLowerCase();
      var action = '';
      if (isEarned) {
        action = '<div class="achievement-earned-note"><strong>Conquistada</strong><span>' + award.earnedAt + ' · ' + award.grantedBy + '</span>' + (award.notes ? '<small>' + award.notes + '</small>' : '') + '</div>';
      } else if (student && medal.podeConceder) {
        action = '<button class="btn btn-primary btn-sm" data-achievement-grant="' + medal.id + '">' + icon('award', 14) + ' Conceder</button>';
      } else {
        action = '<span class="achievement-rule-note">' + (medal.automatica ? 'Concedida automaticamente' : 'Exclusiva da supervisão') + '</span>';
      }
      return '<article class="achievement-card' + (isEarned ? ' is-earned' : '') + '" data-achievement-card data-category="' + medal.categoria + '" data-search="' + search + '">' +
        '<div class="achievement-card-top"><span class="achievement-medal-icon">' + (medal.secreta && !isEarned ? '❔' : medal.icone) + '</span><div class="achievement-card-badges"><span class="badge badge-gray">' + medal.categoria + '</span><span class="badge ' + (medal.automatica ? 'badge-blue' : 'badge-orange') + '">' + (medal.automatica ? 'Automática' : 'Manual') + '</span></div></div>' +
        '<h3>' + title + '</h3><p>' + description + '</p><div class="achievement-card-footer">' + action + '</div></article>';
    }).join('');
    if (!cards) cards = '<div class="achievement-empty"><span>🏅</span><h3>As medalhas ainda não foram cadastradas</h3><p>A Supervisão pode adicionar com segurança todas as medalhas e conquistas preparadas para o sistema, sem alterar os outros cadastros.</p>' + (management ? '<button class="btn btn-primary" id="achievement-sync">Cadastrar medalhas e conquistas</button>' : '') + '</div>';

    var studentHeader = student
      ? '<div class="achievement-student-summary"><div class="avatar avatar-lg">' + student.initials + '</div><div><span>ALUNO SELECIONADO</span><h2>' + student.name + '</h2><p>' + student.turma + ' · ' + student.modulo + '</p></div><div class="achievement-student-total"><strong>' + Object.keys(earnedMap).length + '</strong><span>conquistas</span></div></div>'
      : '<div class="achievement-empty compact"><h3>Nenhum aluno disponível</h3><p>Cadastre ou vincule alunos para conceder conquistas.</p></div>';

    return '<div class="animate-fade achievement-management-page">' +
      '<section class="achievement-hero"><div><span class="achievement-kicker">RECONHECER PARA INSPIRAR</span><h2>Medalhas e conquistas</h2><p>Conceda reconhecimentos pedagógicos e acompanhe as conquistas automáticas de cada aluno.</p></div><div class="achievement-hero-stat"><strong>' + medals.length + '</strong><span>itens no catálogo</span></div>' + (management && medals.length ? '<button class="btn btn-outline" id="achievement-sync">Atualizar catálogo</button>' : '') + '</section>' +
      '<section class="card achievement-controls"><div class="form-group"><label class="form-label" for="achievement-student">Aluno</label><select class="form-select" id="achievement-student">' + studentOptions + '</select></div><div class="form-group"><label class="form-label" for="achievement-category">Categoria</label><select class="form-select" id="achievement-category"><option value="">Todas as categorias</option>' + categoryOptions + '</select></div><div class="form-group achievement-search"><label class="form-label" for="achievement-search">Buscar conquista</label><div class="search-wrapper">' + icon('search', 16) + '<input class="search-input" id="achievement-search" placeholder="Nome ou descrição" /></div></div></section>' +
      studentHeader + '<div class="achievement-grid" id="achievement-grid">' + cards + '</div></div>';
  }

  function openGrantModal(student, medal, navigate) {
    var backdrop = document.createElement('div');
    backdrop.className = 'admin-modal-backdrop achievement-grant-backdrop';
    backdrop.innerHTML = '<section class="admin-modal achievement-grant-modal" role="dialog" aria-modal="true"><div class="achievement-grant-visual"><span>' + medal.icone + '</span><small>' + medal.categoria + '</small><h2>' + medal.nome + '</h2><p>' + medal.descricao + '</p></div><form id="achievement-grant-form"><div class="admin-modal-body"><div class="achievement-recipient"><div class="avatar">' + student.initials + '</div><div><span>Conceder para</span><strong>' + student.name + '</strong><small>' + student.turma + ' · ' + student.modulo + '</small></div></div><div class="form-group"><label class="form-label" for="achievement-notes">Por que o aluno conquistou?</label><textarea class="form-textarea" id="achievement-notes" maxlength="500" rows="4" required placeholder="Descreva brevemente o comportamento, projeto ou resultado observado."></textarea></div><div class="admin-form-error" id="achievement-error" hidden></div></div><div class="admin-modal-footer"><button class="btn btn-ghost" type="button" data-achievement-close>Cancelar</button><button class="btn btn-primary" type="submit" id="achievement-save">Conceder conquista</button></div></form></section>';
    document.body.appendChild(backdrop);

    function close() { backdrop.remove(); }
    backdrop.querySelector('[data-achievement-close]').addEventListener('click', close);
    backdrop.addEventListener('click', function (event) { if (event.target === backdrop) close(); });
    backdrop.querySelector('#achievement-grant-form').addEventListener('submit', async function (event) {
      event.preventDefault();
      var button = backdrop.querySelector('#achievement-save');
      var error = backdrop.querySelector('#achievement-error');
      var notes = backdrop.querySelector('#achievement-notes').value.trim();
      error.hidden = true;
      button.disabled = true;
      button.textContent = 'Concedendo...';
      try {
        var response = await window.CreateJoyApi.grantAchievement(student.id, medal.id, notes);
        window.CreateJoyApp.updateData(response.data);
        close();
        navigate('achievements');
      } catch (requestError) {
        error.textContent = requestError.message;
        error.hidden = false;
        button.disabled = false;
        button.textContent = 'Conceder conquista';
      }
    });
    window.setTimeout(function () { backdrop.querySelector('#achievement-notes').focus(); }, 0);
  }

  function bind(navigate, D) {
    var raw = window.CreateJoyApp.getRawData();
    var studentSelect = document.getElementById('achievement-student');
    var search = document.getElementById('achievement-search');
    var category = document.getElementById('achievement-category');
    if (studentSelect) studentSelect.addEventListener('change', function () {
      raw.achievementStudentId = Number(studentSelect.value);
      navigate('achievements');
    });

    function filterCards() {
      var query = search ? search.value.trim().toLowerCase() : '';
      var selectedCategory = category ? category.value : '';
      document.querySelectorAll('[data-achievement-card]').forEach(function (card) {
        var matchesSearch = !query || card.getAttribute('data-search').indexOf(query) !== -1;
        var matchesCategory = !selectedCategory || card.getAttribute('data-category') === selectedCategory;
        card.style.display = matchesSearch && matchesCategory ? '' : 'none';
      });
    }
    if (search) search.addEventListener('input', filterCards);
    if (category) category.addEventListener('change', filterCards);

    document.querySelectorAll('[data-achievement-grant]').forEach(function (button) {
      button.addEventListener('click', function () {
        var student = selectedStudent(D);
        var medalId = Number(button.getAttribute('data-achievement-grant'));
        var medal = (D.medals || []).filter(function (item) { return Number(item.id) === medalId; })[0];
        if (student && medal) openGrantModal(student, medal, navigate);
      });
    });

    var sync = document.getElementById('achievement-sync');
    if (sync) sync.addEventListener('click', async function () {
      sync.disabled = true;
      sync.textContent = 'Carregando catálogo...';
      try {
        var response = await window.CreateJoyApi.syncAchievementCatalog();
        window.CreateJoyApp.updateData(response.data);
        navigate('achievements');
      } catch (error) {
        window.alert(error.message);
        sync.disabled = false;
        sync.textContent = 'Tentar novamente';
      }
    });
  }

  return { render: render, bind: bind };
})();
