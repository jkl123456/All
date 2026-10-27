/* 发布作品：登录校验、图片压缩后上传、提交审核 */
(() => {
  'use strict';

  const CATEGORIES = Array.isArray(window.CATEGORIES) ? window.CATEGORIES : [];
  const PLATFORMS = ['Web', '移动端', 'Windows', 'macOS', 'Linux'];
  const MAX_SHOTS = 8;
  const MAX_CATS = 3;

  const state = { shots: [], user: null };

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  function toast(message) {
    const el = $('#toast');
    el.textContent = message;
    el.classList.add('show');
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => el.classList.remove('show'), 2800);
  }

  function gotoLogin() {
    location.href = 'auth.html?next=' + encodeURIComponent('submit.html');
  }

  function renderOptions() {
    $('#categoryChecks').innerHTML = CATEGORIES.map(
      (c) => `<label><input type="checkbox" name="category" value="${c}">${c}</label>`
    ).join('');
    $('#platformChecks').innerHTML = PLATFORMS.map(
      (p) => `<label><input type="checkbox" name="platform" value="${p}">${p}</label>`
    ).join('');
  }

  function renderShots() {
    $('#shotGrid').innerHTML = state.shots
      .map(
        (shot, i) => `
        <div class="shot" data-index="${i}">
          <img src="${shot.preview}" alt="截图 ${i + 1}">
          <button class="remove" type="button" data-remove="${i}" aria-label="删除这张">✕</button>
          <button class="tag ${shot.label === 'mobile' ? 'mobile' : ''}" type="button" data-toggle="${i}">
            ${shot.label === 'mobile' ? '手机端' : 'PC 端'}
          </button>
        </div>`
      )
      .join('');
    $('#uploadCount').textContent = `${state.shots.length} / ${MAX_SHOTS}`;
  }

  function fileToShot(file) {
    return new Promise((resolve, reject) => {
      if (!file.type.startsWith('image/')) return reject(new Error('不是图片'));
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          const max = 1600;
          const scale = Math.min(1, max / Math.max(img.width, img.height));
          const canvas = document.createElement('canvas');
          canvas.width = Math.round(img.width * scale);
          canvas.height = Math.round(img.height * scale);
          const ctx = canvas.getContext('2d');
          ctx.fillStyle = '#0b0d18';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          canvas.toBlob(
            (blob) => {
              if (!blob) return reject(new Error('图片处理失败'));
              resolve({
                file: new File([blob], `shot-${Date.now()}.jpg`, { type: 'image/jpeg' }),
                preview: URL.createObjectURL(blob),
                label: img.height > img.width ? 'mobile' : 'pc'
              });
            },
            'image/jpeg',
            0.82
          );
        };
        img.onerror = () => reject(new Error('图片读取失败'));
        img.src = reader.result;
      };
      reader.onerror = () => reject(new Error('文件读取失败'));
      reader.readAsDataURL(file);
    });
  }

  async function addFiles(files) {
    const images = Array.from(files).filter((f) => f.type.startsWith('image/'));
    if (!images.length) return;
    const room = MAX_SHOTS - state.shots.length;
    if (room <= 0) return toast(`最多只能上传 ${MAX_SHOTS} 张截图`);
    const slice = images.slice(0, room);
    if (images.length > room) toast(`只添加了前 ${room} 张，最多 ${MAX_SHOTS} 张`);
    try {
      const shots = await Promise.all(slice.map(fileToShot));
      state.shots.push(...shots);
      renderShots();
    } catch (error) {
      toast('图片处理失败：' + error.message);
    }
  }

  async function collectProject() {
    const form = $('#submitForm');
    const data = new FormData(form);
    const platforms = $$('input[name="platform"]:checked').map((el) => el.value);
    const categories = $$('input[name="category"]:checked').map((el) => el.value);
    const stack = String(data.get('stack') || '')
      .split(/[,，、]/)
      .map((s) => s.trim())
      .filter(Boolean);
    const gameplay = String(data.get('gameplay') || '')
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);

    if (!state.shots.length) throw new Error('至少上传 1 张截图');
    if (!categories.length) throw new Error('至少选择一个分类');
    if (!platforms.length) platforms.push('Web');

    return {
      name: String(data.get('name') || '').trim(),
      tagline: String(data.get('tagline') || '').trim(),
      categories,
      description: String(data.get('description') || '').trim(),
      gameplay,
      stack,
      platforms,
      repo: String(data.get('repo') || '').trim(),
      contactName: String(data.get('contactName') || '').trim(),
      contact: String(data.get('contact') || '').trim(),
      qq: '993739647',
      images: state.shots.map((s) => ({ label: s.label }))
    };
  }

  async function submit(event) {
    event.preventDefault();
    if (!state.user) return gotoLogin();
    const btn = $('#submitBtn');
    btn.disabled = true;
    btn.textContent = '上传图片中…';
    try {
      const payload = await collectProject();
      const { urls } = await API.uploadImages(state.shots.map((s) => s.file));
      btn.textContent = '提交审核中…';
      payload.images = urls.map((src, i) => ({ src, label: state.shots[i].label }));
      const { project } = await API.createProject(payload);
      state.shots.forEach((s) => URL.revokeObjectURL(s.preview));
      toast('已提交审核，正在跳转到我的作品…');
      setTimeout(() => {
        location.href = 'my.html?new=' + encodeURIComponent(project.id);
      }, 600);
    } catch (error) {
      toast(error.message || '提交失败');
      if (error.status === 401) gotoLogin();
      btn.disabled = false;
      btn.textContent = '提交审核';
    }
  }

  function bindEvents() {
    $('#pickImages').addEventListener('click', () => $('#imageInput').click());
    $('#imageInput').addEventListener('change', (event) => {
      addFiles(event.target.files);
      event.target.value = '';
    });

    const dropZone = $('#dropZone');
    ['dragenter', 'dragover'].forEach((type) =>
      dropZone.addEventListener(type, (event) => {
        event.preventDefault();
        dropZone.classList.add('dragover');
      })
    );
    ['dragleave', 'drop'].forEach((type) =>
      dropZone.addEventListener(type, (event) => {
        event.preventDefault();
        dropZone.classList.remove('dragover');
      })
    );
    dropZone.addEventListener('drop', (event) => {
      if (event.dataTransfer?.files) addFiles(event.dataTransfer.files);
    });
    dropZone.addEventListener('click', (event) => {
      if (event.target.closest('.shot') || event.target.closest('#pickImages')) return;
      if (event.target === $('#imageInput')) return;
      $('#imageInput').click();
    });

    $('#shotGrid').addEventListener('click', (event) => {
      const remove = event.target.closest('[data-remove]');
      if (remove) {
        const i = Number(remove.dataset.remove);
        URL.revokeObjectURL(state.shots[i].preview);
        state.shots.splice(i, 1);
        renderShots();
        return;
      }
      const toggle = event.target.closest('[data-toggle]');
      if (toggle) {
        const i = Number(toggle.dataset.toggle);
        state.shots[i].label = state.shots[i].label === 'mobile' ? 'pc' : 'mobile';
        renderShots();
      }
    });

    $('#categoryChecks').addEventListener('change', (event) => {
      const checked = $$('input[name="category"]:checked');
      if (checked.length > MAX_CATS) {
        event.target.checked = false;
        toast(`最多选 ${MAX_CATS} 个分类`);
      }
    });

    $('#submitForm').addEventListener('submit', submit);
  }

  async function init() {
    renderOptions();
    bindEvents();
    state.user = await window.mountUserBar?.() || null;
    if (!state.user) {
      toast('发布作品需要先登录');
      setTimeout(gotoLogin, 900);
    }
  }

  init();
})();
