/* 登录 / 注册：邮箱验证码注册，成功后回到 next 或首页 */
(() => {
  'use strict';

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));
  const next = new URLSearchParams(location.search).get('next') || 'index.html';

  function setMessage(text, type = '') {
    const el = $('#authMessage');
    el.textContent = text || '';
    el.className = 'auth-message' + (type ? ' ' + type : '');
  }

  function switchTab(tab) {
    $$('.auth-tab').forEach((btn) => btn.classList.toggle('active', btn.dataset.tab === tab));
    $('#loginForm').classList.toggle('hidden', tab !== 'login');
    $('#registerForm').classList.toggle('hidden', tab !== 'register');
    setMessage('');
  }

  $$('[data-tab]').forEach((btn) => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  let countdown = 0;
  let timer = 0;
  function startCountdown(seconds = 60) {
    countdown = seconds;
    $('#sendCodeBtn').disabled = true;
    $('#sendCodeBtn').textContent = `${countdown}s 后重发`;
    clearInterval(timer);
    timer = setInterval(() => {
      countdown -= 1;
      if (countdown <= 0) {
        clearInterval(timer);
        $('#sendCodeBtn').disabled = false;
        $('#sendCodeBtn').textContent = '获取验证码';
        return;
      }
      $('#sendCodeBtn').textContent = `${countdown}s 后重发`;
    }, 1000);
  }

  $('#sendCodeBtn').addEventListener('click', async () => {
    const email = $('#regEmail').value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      setMessage('请先填写正确的邮箱', 'error');
      return;
    }
    $('#sendCodeBtn').disabled = true;
    setMessage('正在发送验证码…');
    try {
      const data = await API.sendCode(email);
      if (data.dev && data.devCode) {
        setMessage(`开发模式：验证码 ${data.devCode}（未配置 SMTP，已打印到服务端控制台）`, 'ok');
        $('#regCode').value = data.devCode;
      } else {
        setMessage('验证码已发送，请查收邮箱（10 分钟内有效）', 'ok');
      }
      startCountdown(60);
    } catch (error) {
      setMessage(error.message, 'error');
      $('#sendCodeBtn').disabled = false;
    }
  });

  $('#loginForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const email = $('#loginEmail').value.trim();
    const password = $('#loginPassword').value;
    const btn = $('#loginBtn');
    btn.disabled = true;
    btn.textContent = '登录中…';
    try {
      await API.login(email, password);
      setMessage('登录成功，正在跳转…', 'ok');
      location.href = next;
    } catch (error) {
      setMessage(error.message, 'error');
      btn.disabled = false;
      btn.textContent = '登录';
    }
  });

  $('#registerForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const payload = {
      email: $('#regEmail').value.trim(),
      code: $('#regCode').value.trim(),
      name: $('#regName').value.trim(),
      password: $('#regPassword').value
    };
    const btn = $('#registerBtn');
    btn.disabled = true;
    btn.textContent = '注册中…';
    try {
      await API.register(payload);
      setMessage('注册成功，正在跳转…', 'ok');
      location.href = next;
    } catch (error) {
      setMessage(error.message, 'error');
      btn.disabled = false;
      btn.textContent = '注册并登录';
    }
  });

  API.me()
    .then(({ user }) => {
      if (user) location.replace(next);
    })
    .catch(() => {});
})();
