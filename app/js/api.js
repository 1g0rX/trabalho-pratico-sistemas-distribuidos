window.CreateJoyApi = (function () {
  'use strict';

  var endpoint = '/api/index.php';
  var csrf = '';

  async function request(route, options) {
    options = options || {};
    var headers = Object.assign({ Accept: 'application/json' }, options.headers || {});
    var body = options.body;

    if (body && !(body instanceof FormData) && typeof body !== 'string') {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(body);
    }
    if (csrf && options.method && options.method !== 'GET') {
      headers['X-CSRF-Token'] = csrf;
    }

    var response;
    try {
      response = await fetch(endpoint + '?route=' + encodeURIComponent(route), {
        method: options.method || 'GET',
        headers: headers,
        body: body,
        credentials: 'same-origin',
      });
    } catch (error) {
      throw new Error('Não foi possível acessar o servidor. Verifique sua conexão.');
    }

    var payload;
    try {
      payload = await response.json();
    } catch (error) {
      throw new Error('O servidor retornou uma resposta inválida.');
    }

    if (!response.ok || !payload.ok) {
      var apiError = new Error(payload.message || 'Não foi possível concluir a operação.');
      apiError.status = response.status;
      throw apiError;
    }

    if (payload.csrfToken) csrf = payload.csrfToken;
    return payload;
  }

  return {
    login: function (email, password, role) {
      return request('auth/login', {
        method: 'POST',
        body: { email: email, password: password, role: role },
      });
    },
    me: function () {
      return request('auth/me');
    },
    logout: function () {
      return request('auth/logout', { method: 'POST' });
    },
    changePassword: function (currentPassword, newPassword) {
      return request('auth/change-password', {
        method: 'POST',
        body: { currentPassword: currentPassword, newPassword: newPassword },
      });
    },
    updateProfile: function (formData) {
      return request('profile/update', { method: 'POST', body: formData });
    },
    adjustStudentJoys: function (studentId, operation, amount, reason) {
      return request('teacher/student/joy-adjust', {
        method: 'POST',
        body: { student_id: studentId, operation: operation, amount: amount, reason: reason },
      });
    },
    syncAchievementCatalog: function () {
      return request('achievements/catalog/sync', { method: 'POST' });
    },
    grantAchievement: function (studentId, medalId, notes) {
      return request('achievements/grant', {
        method: 'POST',
        body: { student_id: studentId, medal_id: medalId, notes: notes },
      });
    },
    refresh: function () {
      return request('bootstrap');
    },
    submitMission: function (formData) {
      return request('submissions/create', { method: 'POST', body: formData });
    },
    toggleActivity: function (activityId, completed) {
      return request('student/activity/toggle', {
        method: 'POST',
        body: { activity_id: activityId, completed: completed },
      });
    },
    reviewSubmission: function (id, status, feedback) {
      return request('submissions/review', {
        method: 'POST',
        body: { id: id, status: status, feedback: feedback || '' },
      });
    },
    saveLabNotes: function (notes) {
      return request('student/lab-notes', { method: 'POST', body: { notes: notes } });
    },
    requestStorePurchase: function (productId, details) {
      return request('store/request/create', { method: 'POST', body: { product_id: productId, details: details } });
    },
    cancelStorePurchase: function (id) {
      return request('store/request/cancel', { method: 'POST', body: { id: id } });
    },
    reviewStorePurchase: function (id, decision, notes) {
      return request('store/request/review', { method: 'POST', body: { id: id, decision: decision, notes: notes || '' } });
    },
    saveUser: function (data) {
      return request('admin/user/save', { method: 'POST', body: data });
    },
    deleteUser: function (id) {
      return request('admin/user/delete', { method: 'POST', body: { id: id } });
    },
    permanentlyDeleteStudent: function (id) {
      return request('admin/user/permanent-delete', { method: 'POST', body: { id: id } });
    },
    saveReenrollmentContract: function (data) {
      return request('admin/reenrollment/contract/save', { method: 'POST', body: data });
    },
    saveReenrollmentFollowup: function (data) {
      return request('admin/reenrollment/followup/save', { method: 'POST', body: data });
    },
    saveReenrollmentReminder: function (data) {
      return request('admin/reenrollment/reminder/save', { method: 'POST', body: data });
    },
    completeReenrollmentReminder: function (id, completed, pdfFile) {
      if (pdfFile) {
        var formData = new FormData();
        formData.append('id', String(id));
        formData.append('completed', completed ? '1' : '0');
        formData.append('boleto_pdf', pdfFile);
        return request('admin/reenrollment/reminder/complete', { method: 'POST', body: formData });
      }
      return request('admin/reenrollment/reminder/complete', { method: 'POST', body: { id: id, completed: completed } });
    },
    rescindReenrollmentContract: function (studentId, rescindedAt, reason) {
      return request('admin/reenrollment/rescind', { method: 'POST', body: { student_id: studentId, rescinded_at: rescindedAt, reason: reason } });
    },
    saveStoreProduct: function (formData) {
      return request('admin/store-product/save', { method: 'POST', body: formData });
    },
    depositInvestment: function (productId, amount) {
      return request('investments/deposit', { method: 'POST', body: { product_id: productId, amount: amount } });
    },
    withdrawInvestment: function (productId, amount) {
      return request('investments/withdraw', { method: 'POST', body: { product_id: productId, amount: amount } });
    },
    savePermission: function (roleCode, permissionCode, allowed) {
      return request('admin/permission/save', {
        method: 'POST',
        body: { role_code: roleCode, permission_code: permissionCode, allowed: allowed },
      });
    },
    saveEntity: function (entity, data) {
      return request('admin/' + entity + '/save', { method: 'POST', body: data });
    },
    deleteEntity: function (entity, id) {
      return request('admin/' + entity + '/delete', { method: 'POST', body: { id: id } });
    },
    uploadMissionSupport: function (formData) {
      return request('admin/mission-support/upload', { method: 'POST', body: formData });
    },
    setCsrf: function (token) {
      csrf = token || '';
    },
  };
})();
