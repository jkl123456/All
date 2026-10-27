/* 统一 API 封装：所有请求带 cookie，错误统一抛出 Error(message, status) */
(() => {
  'use strict';

  async function request(path, options = {}) {
    const opts = { credentials: 'same-origin', ...options };
    if (opts.body && !(opts.body instanceof FormData)) {
      opts.headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
      opts.body = JSON.stringify(opts.body);
    }
    const res = await fetch(path, opts);
    let data = {};
    try {
      data = await res.json();
    } catch {
      data = {};
    }
    if (!res.ok) {
      const error = new Error(data.error || `请求失败（${res.status}）`);
      error.status = res.status;
      throw error;
    }
    return data;
  }

  const get = (path) => request(path);
  const post = (path, body) => request(path, { method: 'POST', body });
  const put = (path, body) => request(path, { method: 'PUT', body });
  const del = (path) => request(path, { method: 'DELETE' });

  const API = {
    request,
    get,
    post,
    put,
    del,

    me: () => get('/api/auth/me'),
    login: (email, password) => post('/api/auth/login', { email, password }),
    register: (payload) => post('/api/auth/register', payload),
    sendCode: (email) => post('/api/auth/send-code', { email }),
    logout: () => post('/api/auth/logout'),

    site: () => get('/api/site'),
    listProjects: (params = {}) => {
      const qs = new URLSearchParams();
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') qs.set(k, v);
      });
      return get('/api/projects?' + qs.toString());
    },
    getProject: (id) => get('/api/projects/' + encodeURIComponent(id)),
    createProject: (payload) => post('/api/projects', payload),
    deleteProject: (id) => del('/api/projects/' + encodeURIComponent(id)),

    uploadImages: (files, onProgress) =>
      new Promise((resolve, reject) => {
        const form = new FormData();
        Array.from(files).forEach((file) => form.append('images', file));
        const xhr = new XMLHttpRequest();
        xhr.open('POST', '/api/projects/upload/images');
        xhr.withCredentials = true;
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable && onProgress) onProgress(Math.round((event.loaded / event.total) * 100));
        };
        xhr.onload = () => {
          let data = {};
          try {
            data = JSON.parse(xhr.responseText || '{}');
          } catch {
            data = {};
          }
          if (xhr.status >= 200 && xhr.status < 300) resolve(data);
          else reject(new Error(data.error || '上传失败'));
        };
        xhr.onerror = () => reject(new Error('网络错误，上传失败'));
        xhr.send(form);
      }),

    like: (id) => post(`/api/projects/${encodeURIComponent(id)}/like`),
    favorite: (id) => post(`/api/projects/${encodeURIComponent(id)}/favorite`),
    comments: (id) => get(`/api/projects/${encodeURIComponent(id)}/comments`),
    addComment: (id, content) => post(`/api/projects/${encodeURIComponent(id)}/comments`, { content }),
    deleteComment: (commentId) => del(`/api/projects/comments/${commentId}`),

    myProjects: () => get('/api/my/projects'),
    myFavorites: () => get('/api/my/favorites'),
    myComments: () => get('/api/my/comments'),

    adminStats: () => get('/api/admin/stats'),
    adminProjects: (params = {}) => {
      const qs = new URLSearchParams();
      Object.entries(params).forEach(([k, v]) => v !== undefined && v !== '' && qs.set(k, v));
      return get('/api/admin/projects?' + qs.toString());
    },
    review: (id, action, reason) => post(`/api/admin/projects/${id}/review`, { action, reason }),
    boost: (id, boost) => post(`/api/admin/projects/${id}/boost`, { boost }),
    adminDeleteProject: (id) => del(`/api/admin/projects/${id}`),
    adminUsers: (params = {}) => {
      const qs = new URLSearchParams();
      Object.entries(params).forEach(([k, v]) => v !== undefined && v !== '' && qs.set(k, v));
      return get('/api/admin/users?' + qs.toString());
    },
    adminUser: (id) => get('/api/admin/users/' + id),
    banUser: (id, banned) => post(`/api/admin/users/${id}/ban`, { banned }),
    muteUser: (id, minutes) => post(`/api/admin/users/${id}/mute`, { minutes })
  };

  window.API = API;

  /* 顶栏登录态：所有页面共用 */
  window.mountUserBar = async function mountUserBar(slotSelector = '#userSlot') {
    const slot = document.querySelector(slotSelector);
    if (!slot) return null;
    try {
      const { user } = await API.me();
      if (!user) throw new Error('guest');
      slot.innerHTML = `
        <a class="user-chip" href="my.html" title="我的作品与收藏">
          <span class="avatar">${escapeName(user.name).slice(0, 1)}</span>
          <span class="user-name">${escapeName(user.name)}</span>
        </a>
        ${user.role === 'admin' ? '<a class="top-link" href="admin.html">后台</a>' : ''}
        <button class="top-link as-btn" type="button" id="logoutBtn">退出</button>`;
      document.querySelector('#logoutBtn')?.addEventListener('click', async () => {
        await API.logout();
        location.href = 'index.html';
      });
      return user;
    } catch {
      slot.innerHTML = '<a class="top-link" href="auth.html">登录</a><a class="nav-cta" href="submit.html">发布作品</a>';
      return null;
    }
  };

  function escapeName(name = '') {
    return String(name).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  }
})();
