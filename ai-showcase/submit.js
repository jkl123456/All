/* 上传作品页：表单、图片压缩、IndexedDB 保存，发布后跳转详情页 */
(() => {
  'use strict';

  const CATEGORIES = Array.isArray(window.CATEGORIES) ? window.CATEGORIES : [];
  const SITE = window.SITE || { qq: '993739647' };
  const PLATFORMS = ['Web', '移动端', 'Windows', 'macOS', 'Linux'];
  const MAX_SHOTS = 8;
  const MAX_CATS = 3;
  const DB_NAME = 'ai-maker-gallery';
  const STORE = 'projects';

  const state = { shots: [] };

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  function toast(message) {
    const el = $('#toast');
    el.textContent = message;
    el.classList.add('show');
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => el.classList.remove('show'), 2600);
  }

  const uid = () => 'p-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);

  function db() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const database = req.result;
        if (!database.objectStoreNames.contains(STORE)) {
          database.createObjectStore(STORE, { keyPath: 'id' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function saveCustom(project) {
    const database = await db();
    await new Promise((resolve, reject) => {
      const tx = database.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(project);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  }

  /* ---------------- 选项 ---------------- */
  function renderOptions() {
    $('#categoryChecks').innerHTML = CATEGORIES.map(
      (c) => `<label><input type="checkbox" name="category" value="${c}">${c}</label>`
    ).join('');
    $('#platformChecks').innerHTML = PLATFORMS.map(
      (p) => `<label><input type="checkbox" name="platform" value="${p}">${p}</label>`
    ).join('');
  }

  /* ---------------- 图片 ---------------- */
  function renderShots() {
    $('#shotGrid').innerHTML = state.shots
      .map(
        (shot, i) => `
        <div class="shot" data-index="${i}">
          <img src="${shot.src}" alt="截图 ${i + 1}">
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
          resolve({
            src: canvas.toDataURL('image/jpeg', 0.82),
            label: img.height > img.width ? 'mobile' : 'pc'
          });
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
    if (room <= 0) {
      toast(`最多只能上传 ${MAX_SHOTS} 张截图`);
      return;
    }
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

  /* ---------------- 提交 ---------------- */
  function collectProject() {
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

    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

    return {
      id: uid(),
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
      qq: SITE.qq,
      date,
      cover: state.shots[0].src,
      images: state.shots.map((s) => ({ ...s })),
      createdAt: Date.now()
    };
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
      if (event.dataTransfer && event.dataTransfer.files) addFiles(event.dataTransfer.files);
    });
    dropZone.addEventListener('click', (event) => {
      if (event.target.closest('.shot')) return;
      if (event.target === $('#imageInput')) return;
      if (event.target.closest('#pickImages')) return;
      $('#imageInput').click();
    });

    $('#shotGrid').addEventListener('click', (event) => {
      const remove = event.target.closest('[data-remove]');
      if (remove) {
        state.shots.splice(Number(remove.dataset.remove), 1);
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

    $('#submitForm').addEventListener('submit', async (event) => {
      event.preventDefault();
      try {
        const project = collectProject();
        await saveCustom(project);
        toast('作品已发布，正在打开详情页');
        setTimeout(() => {
          location.href = 'detail.html?id=' + encodeURIComponent(project.id);
        }, 500);
      } catch (error) {
        toast(error.message || '提交失败');
      }
    });
  }

  renderOptions();
  bindEvents();
})();
