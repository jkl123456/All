'use strict';

/**
 * 批量提示词工作台 - 主进程
 * 负责：数据存储、项目/附件管理、批量执行引擎、Windows UI 自动化调用
 */

const { app, BrowserWindow, ipcMain, dialog, shell, protocol, net, clipboard } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const readline = require('readline');
const crypto = require('crypto');
const { pathToFileURL } = require('url');

const ROOT = __dirname;
const PS_SEND = path.join(ROOT, 'scripts', 'automation.ps1');
const PS_IDLE = path.join(ROOT, 'scripts', 'wait-idle.ps1');
const IMAGE_EXT = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.avif']);

let DATA_DIR = '';
let ATTACH_DIR = '';
let STORE_FILE = '';
let TMP_DIR = '';

let mainWindow = null;
let store = null;
let saveTimer = null;

/** 当前正在运行的 powershell 子进程（一次只有一个） */
let activeChild = null;
let activeControlFile = null;

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'media',
    privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true }
  }
]);

/* ------------------------------------------------------------------ */
/* 数据层                                                              */
/* ------------------------------------------------------------------ */

function defaultSettings() {
  return {
    appPath: 'H:\\anything\\WorkBuddy\\WorkBuddy.exe',
    windowTitleKeyword: 'WorkBuddy',
    processName: 'WorkBuddy',
    launchWaitSeconds: 30,
    sendKey: 'enter',
    focusStrategy: 'auto',
    candidates: [
      { x: 60, y: 49 },
      { x: 60, y: 89 }
    ],
    completionMode: 'idle',
    fixedWaitSeconds: 90,
    idleMinWaitSeconds: 30,
    idleStableSeconds: 30,
    idleNoActivitySeconds: 300,
    idleIntervalMs: 1200,
    idleThresholdPercent: 0.1,
    idleTimeoutSeconds: 1800,
    idleSampleStep: 6,
    pixelThreshold: 26,
    idleMonitorWidthPercent: 0,
    continueOnError: true,
    attachImages: true,
    clearInputFirst: true,
    workspaceRoot: path.join(ROOT, 'projects'),
    withFolderHint: true,
    promptTemplate: [
      '请按照下面的需求完成这个项目，并直接开始动手实现。',
      '',
      '【项目名称】',
      '{{title}}',
      '',
      '【需求详情】',
      '{{details}}',
      '',
      '{{attachments}}'
    ].join('\n')
  };
}

function defaultStore() {
  return { projects: [], settings: defaultSettings() };
}

function ensureDirs() {
  for (const dir of [DATA_DIR, ATTACH_DIR, TMP_DIR]) {
    if (dir && !fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  }
}

function loadStore() {
  ensureDirs();
  try {
    const raw = fs.readFileSync(STORE_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    const settings = Object.assign(defaultSettings(), parsed.settings || {});
    let needFix = false;

    // 迁移：旧版默认静止判定 6 秒太短，容易在 AI 停顿/工具调用时误判
    if (!settings.configVersion) {
      if (Number(settings.idleStableSeconds) <= 8) settings.idleStableSeconds = 20;
      settings.configVersion = 2;
      needFix = true;
    }

    const projects = (Array.isArray(parsed.projects) ? parsed.projects : []).map(normalizeProject);
    store = { projects, settings };

    // 老数据补项目目录名（不急着建目录，执行或打开时再建）
    for (const p of store.projects) {
      if (!p.folder) {
        p.folder = allocateFolder(p.title);
        needFix = true;
      }
    }

    // 迁移：旧版给预设项目写死 600/900 秒最短等待，配合静止检测等于白等
    if (Number(settings.configVersion) < 3) {
      for (const p of store.projects) {
        if (p.waitSeconds && p.waitSeconds >= 600) p.waitSeconds = 60;
      }
      settings.configVersion = 3;
      needFix = true;
    }

    // 迁移：0.3% 的变化阈值太钝，小范围进度更新检测不到，会被误判成"已完成"
    if (Number(settings.configVersion) < 4) {
      settings.idleThresholdPercent = 0.1;
      settings.idleSampleStep = 6;
      if (Number(settings.idleStableSeconds) < 30) settings.idleStableSeconds = 30;
      settings.configVersion = 4;
      needFix = true;
    }

    // 迁移：生成型任务（几千行代码）中途会有很长的静默期，30 秒仍可能误判
    if (Number(settings.configVersion) < 5) {
      if (Number(settings.idleStableSeconds) < 45) settings.idleStableSeconds = 45;
      settings.configVersion = 5;
      needFix = true;
    }

    // 迁移：WorkBuddy 新增右侧实时预览面板（动画不停），全窗口空闲检测会永远判不到静止
    if (Number(settings.configVersion) < 6) {
      if (!Number(settings.idleMonitorWidthPercent)) settings.idleMonitorWidthPercent = 60;
      settings.configVersion = 6;
      needFix = true;
    }

    // 迁移：写死的 60% 对不齐所有布局，改为"从截图里自动找分栏边界"（0 = 自动）
    if (Number(settings.configVersion) < 7) {
      if (Number(settings.idleMonitorWidthPercent) === 60) settings.idleMonitorWidthPercent = 0;
      settings.configVersion = 7;
      needFix = true;
    }

    if (needFix) saveStore();
  } catch {
    store = defaultStore();
  }
}

function normalizeProject(p) {
  return {
    id: p.id || crypto.randomUUID(),
    title: p.title || '未命名项目',
    details: p.details || '',
    folder: p.folder || '',
    attachments: Array.isArray(p.attachments) ? p.attachments : [],
    enabled: p.enabled !== false,
    waitSeconds: typeof p.waitSeconds === 'number' && p.waitSeconds > 0 ? p.waitSeconds : null,
    status: p.status === 'running' ? 'pending' : p.status || 'pending',
    lastRunAt: p.lastRunAt || null,
    note: p.note || ''
  };
}

/* ------------------------------------------------------------------ */
/* 项目工作目录                                                        */
/* ------------------------------------------------------------------ */

function workspaceRoot() {
  const root = String((store && store.settings && store.settings.workspaceRoot) || '').trim();
  return root || path.join(ROOT, 'projects');
}

function sanitizeFolderName(title) {
  return String(title || '')
    .replace(/[\\/:*?"<>|\r\n\t]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[.\s]+/, '')
    .slice(0, 40)
    .trim();
}

function nextProjectSeq() {
  let max = 0;
  const pick = (name) => {
    const m = /^(\d{1,3})[_\-\s]/.exec(name || '');
    if (m) max = Math.max(max, parseInt(m[1], 10));
  };
  try {
    const root = workspaceRoot();
    if (fs.existsSync(root)) fs.readdirSync(root).forEach(pick);
  } catch {
    /* ignore */
  }
  if (store && Array.isArray(store.projects)) store.projects.forEach((p) => pick(p.folder));
  return max + 1;
}

function allocateFolder(title) {
  const root = workspaceRoot();
  const seq = nextProjectSeq();
  const base = `${String(seq).padStart(2, '0')}_${sanitizeFolderName(title) || '项目'}`;
  let folder = base;
  let i = 2;
  const taken = () => {
    if (store.projects.some((p) => p.folder === folder)) return true;
    try {
      return fs.existsSync(path.join(root, folder));
    } catch {
      return false;
    }
  };
  while (taken() && i < 200) {
    folder = `${base}_${i++}`;
  }
  return folder;
}

function projectDir(project) {
  if (!project || !project.folder) return '';
  return path.join(workspaceRoot(), project.folder);
}

function ensureProjectDir(project) {
  const dir = projectDir(project);
  if (!dir) return '';
  try {
    fs.mkdirSync(dir, { recursive: true });
  } catch (err) {
    console.error('[dir] 创建项目目录失败', err);
  }
  return dir;
}

function saveStore() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      fs.writeFileSync(STORE_FILE, JSON.stringify(store, null, 2), 'utf8');
    } catch (err) {
      console.error('[store] 保存失败', err);
    }
  }, 120);
}

function findProject(id) {
  return store.projects.find((p) => p.id === id) || null;
}

/* ------------------------------------------------------------------ */
/* 提示词拼装                                                          */
/* ------------------------------------------------------------------ */

function buildPrompt(project, index = 1, total = 1) {
  const settings = store.settings;
  const attachImages = settings.attachImages !== false;
  const attachments = project.attachments || [];
  const textFiles = attachments.filter((a) => !(attachImages && a.isImage));

  const block = textFiles.length
    ? [
        '【参考文件】以下文件已保存在本机，可直接读取：',
        ...textFiles.map((a, i) => `${i + 1}. ${a.path}`),
        ''
      ].join('\n')
    : '';

  const dir = projectDir(project);
  const tpl = settings.promptTemplate || '{{details}}';
  let text = tpl
    .replace(/\{\{\s*title\s*\}\}/g, project.title || '')
    .replace(/\{\{\s*details\s*\}\}/g, project.details || '')
    .replace(/\{\{\s*folder\s*\}\}/g, dir)
    .replace(/\{\{\s*attachments\s*\}\}/g, block)
    .replace(/\{\{\s*index\s*\}\}/g, String(index))
    .replace(/\{\{\s*total\s*\}\}/g, String(total));

  text = text.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();

  // 模板里没有 {{folder}} 时，自动在开头补一段工作目录说明
  if (dir && settings.withFolderHint !== false && !/\{\{\s*folder\s*\}\}/.test(tpl)) {
    text = [
      '【工作目录】',
      '请在下面这个目录里创建并写入所有文件（代码、素材、说明文档），不要写到其他位置：',
      dir,
      '',
      text
    ].join('\n');
  }

  const imageCount = attachImages ? attachments.filter((a) => a.isImage).length : 0;
  if (imageCount > 0) {
    text += `\n\n（另有 ${imageCount} 张图片已通过粘贴方式一并放入输入框，请一并查看。）`;
  }
  return text;
}

/* ------------------------------------------------------------------ */
/* PowerShell 调用                                                     */
/* ------------------------------------------------------------------ */

function writeControl(word) {
  if (!activeControlFile) return false;
  try {
    fs.writeFileSync(activeControlFile, word, 'utf8');
    return true;
  } catch {
    return false;
  }
}

function execJob(script, job, handlers = {}) {
  return new Promise((resolve) => {
    ensureDirs();
    const tag = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    const jobFile = path.join(TMP_DIR, `job-${tag}.json`);
    const resultFile = path.join(TMP_DIR, `result-${tag}.json`);
    const controlFile = path.join(TMP_DIR, `ctrl-${tag}.txt`);

    try {
      fs.writeFileSync(jobFile, JSON.stringify(Object.assign({}, job, { resultFile, controlFile })), 'utf8');
      if (fs.existsSync(resultFile)) fs.unlinkSync(resultFile);
      if (fs.existsSync(controlFile)) fs.unlinkSync(controlFile);
    } catch (err) {
      resolve({ ok: false, error: `写入任务文件失败: ${err.message}` });
      return;
    }

    const args = ['-NoProfile', '-Sta', '-ExecutionPolicy', 'Bypass', '-File', script, '-JobFile', jobFile];
    let child;
    try {
      child = spawn('powershell.exe', args, { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (err) {
      resolve({ ok: false, error: `启动 PowerShell 失败: ${err.message}` });
      return;
    }

    activeChild = child;
    activeControlFile = controlFile;

    const rl = readline.createInterface({ input: child.stdout });
    rl.on('line', (line) => {
      if (handlers.onLine) handlers.onLine(line.trim());
    });

    let stderr = '';
    child.stderr.on('data', (d) => {
      stderr += d.toString('utf8');
    });

    const hardTimer = setTimeout(
      () => {
        try {
          child.kill();
        } catch {}
      },
      job.hardTimeoutMs || 40 * 60 * 1000
    );

    const finish = (code, extra) => {
      clearTimeout(hardTimer);
      try {
        rl.close();
      } catch {}
      if (activeChild === child) {
        activeChild = null;
        activeControlFile = null;
      }
      let result = null;
      try {
        result = JSON.parse(fs.readFileSync(resultFile, 'utf8'));
      } catch {}
      setTimeout(() => {
        for (const f of [jobFile, resultFile, controlFile]) {
          try {
            fs.unlinkSync(f);
          } catch {}
        }
      }, 300);
      if (!result) {
        result = {
          ok: code === 0,
          error: code === 0 ? undefined : (stderr || `powershell 退出码 ${code}`).trim().split(/\r?\n/).slice(-2).join(' ')
        };
      }
      resolve(Object.assign({}, result, extra, { code, stderr }));
    };

    child.on('error', (err) => finish(-1, { error: err.message }));
    child.on('close', (code) => finish(code));
  });
}

async function findTargetWindow() {
  const settings = store.settings;
  return execJob(PS_SEND, {
    action: 'find',
    titleKeyword: settings.windowTitleKeyword || '',
    processName: settings.processName || '',
    hardTimeoutMs: 30000
  });
}

/* ------------------------------------------------------------------ */
/* 附件处理                                                            */
/* ------------------------------------------------------------------ */

function addAttachments(project, paths) {
  const dir = path.join(ATTACH_DIR, project.id);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const added = [];
  for (const src of paths) {
    try {
      const stat = fs.statSync(src);
      if (!stat.isFile()) continue;
      const ext = path.extname(src);
      const base = path.basename(src, ext).slice(0, 40).replace(/[\\/:*?"<>|]/g, '_');
      let dest = path.join(dir, `${base}${ext}`);
      let i = 1;
      while (fs.existsSync(dest)) {
        dest = path.join(dir, `${base}_${i}${ext}`);
        i += 1;
      }
      fs.copyFileSync(src, dest);
      const item = {
        id: crypto.randomUUID(),
        name: path.basename(dest),
        path: dest,
        size: stat.size,
        isImage: IMAGE_EXT.has(ext.toLowerCase())
      };
      project.attachments.push(item);
      added.push(item);
    } catch (err) {
      console.error('[attachment] 添加失败', src, err);
    }
  }
  return added;
}

/* ------------------------------------------------------------------ */
/* 执行引擎                                                            */
/* ------------------------------------------------------------------ */

function ts() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(
    d.getSeconds()
  ).padStart(2, '0')}`;
}

const STEP_TEXT = {
  activate: '激活目标窗口',
  focused: '已聚焦目标窗口，等待界面稳定',
  focus: '尝试自动定位输入框',
  'focus-ok': '已通过无障碍接口定位到输入框',
  'paste-text': '粘贴提示词',
  'send-enter': '按 Enter 发送',
  'send-ctrl-enter': '按 Ctrl+Enter 发送',
  'send-shift-enter': '按 Shift+Enter 发送',
  'no-send': '已填入输入框，未自动发送',
  'verify-na': '无法截屏校验',
  'caret-ok': '该位置确认可以输入文字',
  'caret-no': '该位置不能输入文字，换下一个点',
  countdown: '倒计时取样中…'
};

function stepText(line) {
  const body = line.slice(5).trim();
  const [cmd, ...rest] = body.split(' ');
  if (STEP_TEXT[cmd]) return STEP_TEXT[cmd] + (rest.length ? ' ' + rest.join(' ') : '');
  if (cmd === 'click') return `点击输入框 ${rest.join(' ')}`;
  if (cmd === 'paste-image') return `粘贴第 ${rest[0]} 张图片`;
  if (cmd === 'verify') return `输入框校验：画面变化=${rest[0]}`;
  if (cmd === 'probe') {
    const n = Number(rest[0]) || 0;
    const split = Number(rest[1]) || 100;
    if (!n) return '无障碍接口没有可用的输入框控件，改用坐标定位';
    return split > 0 && split < 96
      ? `探测到 ${n} 个候选位置（界面已分栏，右栏边界 ${split}%）`
      : `探测到 ${n} 个候选位置`;
  }
  if (cmd === 'skip') return `该位置是按钮/图标，已跳过 ${rest.join(' ')}`;
  if (cmd === 'sweep') return `定位点没命中，正在自动扫描输入框位置 ${rest.join(' ')}`;
  if (cmd === 'split') {
    const pct = Number(rest[0]) || 100;
    return pct < 96
      ? `检测到右侧预览面板，左栏宽 ${pct}%，点击只在左栏内进行`
      : '界面没有分栏，按整窗定位';
  }
  return body;
}

class Runner {
  constructor() {
    this.running = false;
    this.stopping = false;
    this.paused = false;
    this.skipRequested = false;
    this.currentId = null;
    this.lastGoodIndex = -1;
    /** 上次点成功的输入框位置（窗口百分比），布局变化后自动更新 */
    this.lastGoodPoint = null;
  }

  emit(payload) {
    if (process.env.PBS_DEBUG) console.log('[run]', JSON.stringify(payload));
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('run:event', payload);
    }
  }

  log(message, level = 'info') {
    this.emit({ type: 'log', level, message, time: ts() });
  }

  sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  reset() {
    this.stopping = false;
    this.paused = false;
    this.skipRequested = false;
  }

  async ensureTargetApp() {
    const settings = store.settings;
    let found = await findTargetWindow();
    if (found && found.found) {
      this.log(`已连接目标窗口：${found.title}`, 'ok');
      return true;
    }

    if (!settings.appPath) {
      this.log(`未检测到目标窗口，且没有配置程序路径，请先在设置里填写目标软件。`, 'error');
      return false;
    }
    if (!fs.existsSync(settings.appPath)) {
      this.log(`程序路径不存在：${settings.appPath}`, 'error');
      return false;
    }

    this.log(`未检测到目标窗口，正在启动 ${path.basename(settings.appPath)} …`);
    try {
      spawn(settings.appPath, [], { detached: true, stdio: 'ignore' }).unref();
    } catch (err) {
      this.log(`启动失败：${err.message}`, 'error');
      return false;
    }

    const deadline = Date.now() + Math.max(5, settings.launchWaitSeconds || 30) * 1000;
    while (Date.now() < deadline) {
      if (this.stopping) return false;
      await this.sleep(1500);
      found = await findTargetWindow();
      if (found && found.found) {
        this.log(`目标窗口已就绪：${found.title}`, 'ok');
        await this.sleep(2500);
        return true;
      }
    }
    this.log('等待目标窗口超时，请确认软件是否已打开。', 'error');
    return false;
  }

  async sendPrompt(project, prompt) {
    const settings = store.settings;
    const images =
      settings.attachImages !== false ? project.attachments.filter((a) => a.isImage).map((a) => a.path) : [];

    const points =
      Array.isArray(settings.candidates) && settings.candidates.length
        ? settings.candidates.slice()
        : [
            { x: 60, y: 49 },
            { x: 60, y: 89 }
          ];

    // 默认先试靠下的定位点：聊天类应用的输入框基本都在底部，
    // 靠上的点通常只存在于欢迎页，先试它等于每次白等 3 秒
    const order = points
      .map((p, i) => ({ i, y: Number(p.y) || 0 }))
      .sort((a, b) => b.y - a.y)
      .map((x) => x.i);

    // 有成功记录时，优先复用上次那个点
    if (this.lastGoodIndex >= 0 && this.lastGoodIndex < points.length) {
      const at = order.indexOf(this.lastGoodIndex);
      if (at > 0) {
        order.splice(at, 1);
        order.unshift(this.lastGoodIndex);
      }
    }

    const candidates = order.map((i) => points[i]);
    // 上次真正点成功的位置（可能是自动探测/自动扫描出来的，未必在设置里）优先重试，
    // 这样右侧预览面板出现、界面布局变了之后也能直接命中
    const prefix = this.lastGoodPoint ? 1 : 0;
    if (prefix) {
      candidates.unshift({ x: this.lastGoodPoint.x, y: this.lastGoodPoint.y });
    }

    this.emit({ type: 'phase', id: project.id, phase: 'sending', message: '正在输入提示词…' });

    const res = await execJob(
      PS_SEND,
      {
        action: 'send',
        titleKeyword: settings.windowTitleKeyword || '',
        processName: settings.processName || '',
        text: prompt,
        images,
        sendKey: settings.sendKey || 'enter',
        focusStrategy: settings.focusStrategy || 'auto',
        candidates,
        clearFirst: settings.clearInputFirst !== false,
        hardTimeoutMs: 120000
      },
      {
        onLine: (line) => {
          if (line.startsWith('STEP:')) this.log(stepText(line), 'muted');
        }
      }
    );

    if (!res.ok) {
      if (res.error === 'INPUT_NOT_FOUND') {
        // 点位全都点不出可输入区域：界面没露出输入框（预览占满窗口等）。
        // 等下去也不会好，直接报清楚，让人切回对话界面
        this.lastGoodPoint = null;
        return {
          ok: false,
          error: '界面上没找到可输入的输入框（目标可能停在全屏预览页，切回对话页再跑）'
        };
      }
      if (res.error === 'INPUT_NOT_READY' || res.error === 'FOCUS_NOT_CONFIRMED') {
        // 记下来的位置已经不准了，下次重新定位
        this.lastGoodPoint = null;
        return {
          ok: false,
          busy: true,
          error: '输入框没有接受文字（目标可能还在生成中）'
        };
      }
      if (res.error === 'CLIPBOARD_STOLEN' || res.error === 'CLIPBOARD_FAILED') {
        return {
          ok: false,
          busy: true,
          error: '剪贴板被其他程序占用，提示词没能粘贴进去'
        };
      }
      if (res.error === 'WINDOW_NOT_FOUND') {
        return { ok: false, error: `未找到目标窗口（关键字：${settings.windowTitleKeyword}）` };
      }
      if (res.error === 'FG_FAILED') {
        return { ok: false, error: '无法把目标窗口切换到前台，请手动点一下目标窗口后重试' };
      }
      if (res.error === 'FOCUS_WRONG_PROCESS') {
        return { ok: false, error: res.detail || '焦点落在了别的程序上，已取消输入' };
      }
      if (res.error === 'FG_LOST') {
        return { ok: false, error: res.detail || '输入过程中焦点丢失，已取消' };
      }
      if (res.error === 'WINDOW_ABNORMAL') {
        return { ok: false, error: res.detail || '目标窗口状态异常' };
      }
      return { ok: false, error: res.error || '发送失败' };
    }

    const hitIndex = typeof res.configIndex === 'number' ? res.configIndex - prefix : -1;
    if (res.source === 'config' && hitIndex >= 0 && hitIndex < order.length) {
      this.lastGoodIndex = order[hitIndex];
    }
    if (Number.isFinite(res.clickedXPercent) && Number.isFinite(res.clickedYPercent)) {
      this.lastGoodPoint = { x: res.clickedXPercent, y: res.clickedYPercent };
      if (res.source === 'uia') {
        this.log(
          `已自动定位输入框（${res.clickedXPercent}% , ${res.clickedYPercent}%，无障碍坐标）`,
          'muted'
        );
      } else if (res.source === 'sweep') {
        this.log(
          `定位点没命中，已按当前界面布局自动找到输入框（${res.clickedXPercent}% , ${res.clickedYPercent}%）`,
          'warn'
        );
      }
    }
    return { ok: true };
  }

  /** 固定时长等待，支持暂停 / 跳过 / 停止 */
  async countdown(sec, projectId, label) {
    const total = Math.max(1, Math.round(sec)) * 1000;
    let elapsed = 0;
    let lastShown = -1;
    const step = 250;

    while (elapsed < total) {
      if (this.stopping) return 'stopped';
      if (this.skipRequested) {
        this.skipRequested = false;
        return 'skipped';
      }
      if (this.paused) {
        await this.sleep(step);
        continue;
      }
      const remaining = Math.ceil((total - elapsed) / 1000);
      if (remaining !== lastShown) {
        lastShown = remaining;
        this.emit({ type: 'countdown', id: projectId, remaining, mode: 'fixed', label });
      }
      await this.sleep(step);
      elapsed += step;
    }
    return 'done';
  }

  /** 画面空闲检测：等 AI 输出结束后继续 */
  async waitIdle(project, retried) {
    const settings = store.settings;
    const minWait = Math.max(3, Number(project.waitSeconds) || Number(settings.idleMinWaitSeconds) || 25);
    const timeoutSec = Math.max(60, Number(settings.idleTimeoutSeconds) || 1800);

    const stableSec = Number(settings.idleStableSeconds) || 20;
    const noActivitySec = Number(settings.idleNoActivitySeconds) || 300;

    this.emit({
      type: 'phase',
      id: project.id,
      phase: 'waiting',
      message: `等待 AI 输出完成（输出结束后连续静止 ${stableSec}s 才继续）`
    });

    let stableSeen = 0;
    const res = await execJob(
      PS_IDLE,
      {
        titleKeyword: settings.windowTitleKeyword || '',
        processName: settings.processName || '',
        minWaitSeconds: minWait,
        stableSeconds: stableSec,
        noActivitySeconds: noActivitySec,
        intervalMs: Number(settings.idleIntervalMs) || 1200,
        thresholdPercent: Number(settings.idleThresholdPercent) || 0.3,
        timeoutSeconds: timeoutSec,
        sampleStep: Number(settings.idleSampleStep) || 6,
        minChangedPixels: Number(settings.idleMinChangedPixels) || 2,
        pixelThreshold: Number(settings.pixelThreshold) || 26,
        monitorWidthPercent: Number(settings.idleMonitorWidthPercent) || 0,
        hardTimeoutMs: (timeoutSec + 180) * 1000
      },
      {
        onLine: (line) => {
          if (line.startsWith('ACTIVITY')) {
            this.log('检测到 AI 开始输出…', 'ok');
            return;
          }
          if (line.startsWith('SPLIT')) {
            const pct = Number(line.split(/\s+/)[1]) || 100;
            this.log(
              pct < 96
                ? `检测到右侧预览面板，只监测左侧 ${pct}% 区域判断是否输出完成`
                : '未检测到分栏，按整个窗口判断是否输出完成',
              'muted'
            );
            return;
          }
          if (!line.startsWith('TICK')) return;
          const parts = line.split(/\s+/);
          const elapsed = Number(parts[1]) || 0;
          const stable = Number(parts[3]) || 0;
          if (Math.abs(stable - stableSeen) >= 1) {
            stableSeen = stable;
            this.emit({
              type: 'idle',
              id: project.id,
              elapsed,
              stable,
              message: stable > 0
                ? `已等待 ${elapsed}s · 画面静止 ${stable.toFixed(1)}s（满 ${stableSec}s 继续）`
                : `已等待 ${elapsed}s · AI 正在输出`
            });
          }
        }
      }
    );

    if (res.code === 0) return 'done';
    if (res.code === 3) return 'stopped';
    if (res.code === 4) return 'skipped';
    if (res.code === 5) {
      if (retried) {
        this.log('目标窗口消失了，停止本批次。', 'error');
        return 'stopped';
      }
      this.log('目标窗口不见了，尝试重新唤醒…', 'warn');
      const revived = await this.ensureTargetApp();
      if (revived) {
        this.log('窗口已恢复，继续等待', 'ok');
        return this.waitIdle(project, true);
      }
      this.log('目标窗口消失了，停止本批次。', 'error');
      return 'stopped';
    }
    if (res.code === 2) return 'timeout';
    return 'timeout';
  }

  async waitManual(project) {
    this.emit({ type: 'phase', id: project.id, phase: 'manual', message: '等待你点击「跳过/继续」' });
    while (true) {
      if (this.stopping) return 'stopped';
      if (this.skipRequested) {
        this.skipRequested = false;
        return 'skipped';
      }
      await this.sleep(300);
    }
  }

  async waitForCompletion(project) {
    const settings = store.settings;
    const mode = settings.completionMode || 'idle';
    if (mode === 'manual') return this.waitManual(project);
    if (mode === 'fixed') return this.countdown(settings.fixedWaitSeconds || 90, project.id, '固定等待');
    const r = await this.waitIdle(project);
    return r;
  }

  async start(ids) {
    if (this.running) return { ok: false, error: '已有任务在执行中' };
    const projects = ids.map(findProject).filter(Boolean);
    if (!projects.length) return { ok: false, error: '没有可执行的项目' };

    this.running = true;
    this.reset();
    const startedAt = Date.now();
    this.emit({ type: 'start', total: projects.length, ids: projects.map((p) => p.id) });
    this.log(`开始批量执行，共 ${projects.length} 个项目`, 'ok');

    const ready = await this.ensureTargetApp();
    if (!ready) {
      this.emit({ type: 'finish', done: 0, failed: 0, skipped: projects.length, elapsedMs: Date.now() - startedAt, aborted: true });
      this.running = false;
      return { ok: false, error: '目标窗口不可用' };
    }

    let done = 0;
    let failed = 0;
    let skipped = 0;
    let busyFailStreak = 0;

    for (let i = 0; i < projects.length; i += 1) {
      if (this.stopping) break;
      const project = findProject(projects[i].id);
      if (!project) continue;

      this.currentId = project.id;
      project.status = 'running';
      saveStore();

      const projDir = ensureProjectDir(project);
      if (projDir) this.log(`工作目录：${projDir}`, 'muted');

      this.emit({
        type: 'project-start',
        id: project.id,
        index: i + 1,
        total: projects.length,
        title: project.title
      });
      this.log(`[${i + 1}/${projects.length}] ${project.title}`, 'info');

      const prompt = buildPrompt(project, i + 1, projects.length);

      // 输入框可能还被上一次生成占着：等一下再重试，别急着把这个项目判死
      let sendRes = await this.sendPrompt(project, prompt);
      let busyRetry = 0;
      while (!sendRes.ok && sendRes.busy && busyRetry < 2 && !this.stopping) {
        busyRetry += 1;
        this.log(
          `输入框还没空出来（目标可能仍在生成），等待 25 秒后重试 · 第 ${busyRetry}/2 次`,
          'warn'
        );
        const waitSec = 25;
        for (let s = waitSec; s > 0 && !this.stopping; s -= 1) {
          this.emit({ type: 'countdown', id: project.id, remaining: s, mode: 'retry', label: '重试等待' });
          await this.sleep(1000);
        }
        if (this.stopping) break;
        this.log('重试发送…', 'muted');
        sendRes = await this.sendPrompt(project, prompt);
      }

      if (this.stopping) {
        project.status = 'pending';
        saveStore();
        break;
      }

      if (!sendRes.ok) {
        project.status = 'failed';
        project.note = sendRes.error || '发送失败';
        failed += 1;
        busyFailStreak += 1;
        saveStore();
        this.emit({ type: 'project-done', id: project.id, status: 'failed', message: project.note });
        this.log(`发送失败：${project.note}`, 'error');

        // 连续失败多半是目标一直在生成，继续硬发只会全军覆没
        if (busyFailStreak >= 3) {
          this.log(
            '连续 3 个项目都发不进去，已暂停。确认目标软件空闲后，在面板点「继续」重跑剩下的项目。',
            'error'
          );
          this.paused = true;
          this.emit({ type: 'paused', reason: 'consecutive-busy' });
          while (this.paused && !this.stopping) {
            await this.sleep(400);
          }
          if (this.stopping) break;
          busyFailStreak = 0;
          await this.sleep(1500);
        }
        if (!store.settings.continueOnError) break;
        continue;
      }
      busyFailStreak = 0;

      const result = await this.waitForCompletion(project);

      if (this.stopping || result === 'stopped') {
        project.status = 'pending';
        saveStore();
        break;
      }

      project.lastRunAt = Date.now();
      if (result === 'timeout') {
        project.status = 'done';
        project.note = '等待超时，已自动继续';
        this.log('等待超时，已继续下一个项目（AI 可能仍在输出）', 'warn');
      } else if (result === 'skipped') {
        project.status = 'done';
        project.note = '手动跳过等待';
        this.log('已手动跳过等待', 'warn');
      } else {
        project.status = 'done';
        project.note = '';
      }
      done += 1;
      saveStore();
      this.emit({ type: 'project-done', id: project.id, status: project.status, message: project.note });
      this.log(`完成：${project.title}`, 'ok');

      if (i < projects.length - 1 && !this.stopping) {
        await this.sleep(800);
      }
    }

    if (this.stopping) skipped = projects.length - done - failed;

    this.emit({
      type: 'finish',
      done,
      failed,
      skipped: Math.max(0, skipped),
      stopped: this.stopping,
      elapsedMs: Date.now() - startedAt
    });
    this.log(
      this.stopping ? '已停止批量执行' : `批量执行结束：成功 ${done} 个${failed ? `，失败 ${failed} 个` : ''}`,
      this.stopping ? 'warn' : 'ok'
    );

    this.running = false;
    this.currentId = null;
    return { ok: true };
  }

  pause() {
    if (!this.running) return false;
    this.paused = true;
    writeControl('pause');
    this.log('已暂停', 'warn');
    this.emit({ type: 'paused', reason: 'manual' });
    return true;
  }

  resume() {
    if (!this.running) return false;
    this.paused = false;
    writeControl('run');
    this.log('已继续', 'info');
    this.emit({ type: 'resumed' });
    return true;
  }

  skip() {
    if (!this.running) return false;
    this.skipRequested = true;
    writeControl('skip');
    this.log('跳过当前等待', 'warn');
    return true;
  }

  stop() {
    if (!this.running) return false;
    this.stopping = true;
    this.paused = false;
    this.skipRequested = true;
    if (activeChild) {
      try {
        activeChild.kill();
      } catch {}
    }
    writeControl('stop');
    this.log('正在停止…', 'warn');
    return true;
  }
}

const runner = new Runner();

/* ------------------------------------------------------------------ */
/* 窗口                                                                */
/* ------------------------------------------------------------------ */

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 880,
    minWidth: 1080,
    minHeight: 660,
    show: false,
    frame: false,
    backgroundColor: '#0b0d12',
    webPreferences: {
      preload: path.join(ROOT, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile(path.join(ROOT, 'src', 'index.html'));
  mainWindow.once('ready-to-show', () => mainWindow.show());

  mainWindow.webContents.on('console-message', (e, level, message, line, source) => {
    if (level >= 2) console.log(`[renderer] ${message} (${source}:${line})`);
  });
  mainWindow.webContents.on('did-fail-load', (e, code, desc) => {
    console.log('[renderer] load failed', code, desc);
  });

  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

/* ------------------------------------------------------------------ */
/* IPC                                                                 */
/* ------------------------------------------------------------------ */

function registerIpc() {
  ipcMain.handle('store:get', () => ({
    projects: store.projects,
    settings: store.settings,
    dataDir: DATA_DIR
  }));

  ipcMain.handle('project:create', () => {
    const title = `新项目 ${store.projects.length + 1}`;
    const project = normalizeProject({
      title,
      details: '',
      folder: allocateFolder(title),
      status: 'pending'
    });
    store.projects.push(project);
    ensureProjectDir(project);
    saveStore();
    return project;
  });

  ipcMain.handle('project:create-many', (e, list) => {
    if (!Array.isArray(list) || !list.length) return [];
    const created = [];
    for (const item of list.slice(0, 50)) {
      const title = String((item && item.title) || '新项目').slice(0, 120);
      const project = normalizeProject({
        title,
        details: String((item && item.details) || ''),
        folder: allocateFolder(title),
        enabled: !item || item.enabled !== false,
        waitSeconds: item && typeof item.waitSeconds === 'number' ? item.waitSeconds : null,
        status: 'pending'
      });
      store.projects.push(project);
      ensureProjectDir(project);
      created.push(project);
    }
    saveStore();
    return created;
  });

  ipcMain.handle('project:update', (e, id, patch) => {
    const project = findProject(id);
    if (!project) return null;
    const allowed = ['title', 'details', 'enabled', 'waitSeconds', 'status', 'note'];
    for (const key of allowed) {
      if (Object.prototype.hasOwnProperty.call(patch, key)) project[key] = patch[key];
    }
    saveStore();
    return project;
  });

  ipcMain.handle('project:delete', (e, id) => {
    const idx = store.projects.findIndex((p) => p.id === id);
    if (idx < 0) return false;
    store.projects.splice(idx, 1);
    try {
      fs.rmSync(path.join(ATTACH_DIR, id), { recursive: true, force: true });
    } catch {}
    saveStore();
    return true;
  });

  ipcMain.handle('project:duplicate', (e, id) => {
    const src = findProject(id);
    if (!src) return null;
    const idx = store.projects.findIndex((p) => p.id === id);
    const copy = normalizeProject(Object.assign({}, src, {
      id: crypto.randomUUID(),
      title: `${src.title} 副本`,
      attachments: [],
      status: 'pending',
      lastRunAt: null,
      note: ''
    }));
    store.projects.splice(idx + 1, 0, copy);
    if (src.attachments.length) addAttachments(copy, src.attachments.map((a) => a.path));
    saveStore();
    return copy;
  });

  ipcMain.handle('project:move', (e, id, dir) => {
    const idx = store.projects.findIndex((p) => p.id === id);
    const next = idx + dir;
    if (idx < 0 || next < 0 || next >= store.projects.length) return false;
    const [item] = store.projects.splice(idx, 1);
    store.projects.splice(next, 0, item);
    saveStore();
    return true;
  });

  ipcMain.handle('project:reset-status', () => {
    store.projects.forEach((p) => {
      p.status = 'pending';
      p.note = '';
    });
    saveStore();
    return true;
  });

  ipcMain.handle('attachment:pick', async (e, id) => {
    const project = findProject(id);
    if (!project) return null;
    const res = await dialog.showOpenDialog(mainWindow, {
      title: '选择图片或附件',
      properties: ['openFile', 'multiSelections'],
      filters: [
        { name: '所有文件', extensions: ['*'] },
        { name: '图片', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp'] }
      ]
    });
    if (res.canceled || !res.filePaths.length) return project;
    addAttachments(project, res.filePaths);
    saveStore();
    return project;
  });

  ipcMain.handle('attachment:add-paths', (e, id, paths) => {
    const project = findProject(id);
    if (!project || !Array.isArray(paths)) return null;
    addAttachments(project, paths);
    saveStore();
    return project;
  });

  ipcMain.handle('attachment:remove', (e, id, attId) => {
    const project = findProject(id);
    if (!project) return null;
    const idx = project.attachments.findIndex((a) => a.id === attId);
    if (idx >= 0) {
      const [item] = project.attachments.splice(idx, 1);
      try {
        fs.unlinkSync(item.path);
      } catch {}
      saveStore();
    }
    return project;
  });

  ipcMain.handle('attachment:open', (e, filePath) => {
    shell.openPath(filePath);
    return true;
  });

  ipcMain.handle('project:open-folder', (e, id) => {
    const p = findProject(id);
    if (!p) return false;
    const dir = ensureProjectDir(p);
    if (!dir) return false;
    shell.openPath(dir);
    return true;
  });

  ipcMain.handle('project:dir', (e, id) => projectDir(findProject(id)));

  ipcMain.handle('dir:pick', async () => {
    const r = await dialog.showOpenDialog(mainWindow, {
      title: '选择项目根目录',
      defaultPath: workspaceRoot(),
      properties: ['openDirectory', 'createDirectory']
    });
    if (r.canceled || !r.filePaths.length) return '';
    return r.filePaths[0];
  });

  ipcMain.handle('clipboard:write', (e, text) => {
    try {
      clipboard.writeText(String(text || ''));
      return true;
    } catch {
      return false;
    }
  });

  ipcMain.handle('dir:open', (e, target) => {
    const p = String(target || '');
    if (p) {
      try {
        if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
        shell.openPath(p);
      } catch {
        return false;
      }
    }
    return true;
  });

  ipcMain.handle('settings:update', (e, patch) => {
    store.settings = Object.assign(store.settings, patch || {});
    saveStore();
    return store.settings;
  });

  ipcMain.handle('prompt:preview', (e, draft, index, total) => buildPrompt(draft || {}, index || 1, total || 1));

  ipcMain.handle('target:sample-cursor', async () => {
    if (runner.running) return { ok: false, error: '批量执行中，暂不可取样' };
    const settings = store.settings;
    const res = await execJob(PS_SEND, {
      action: 'cursor',
      titleKeyword: settings.windowTitleKeyword || '',
      processName: settings.processName || '',
      hardTimeoutMs: 30000
    });
    if (!res || !res.ok) return { ok: false, error: res.error || '取样失败' };
    return res;
  });

  ipcMain.handle('target:test', async () => {
    if (runner.running) return { ok: false, error: '批量执行中，暂不可测试' };
    const res = await findTargetWindow();
    if (!res || !res.ok) return { ok: false, error: (res && res.error) || '检测失败' };
    if (!res.found) return { ok: true, found: false, title: '' };

    // 顺手唤醒一次：窗口可能被收进托盘（visible=false），这里会执行 SW_RESTORE
    const settings = store.settings;
    await execJob(PS_SEND, {
      action: 'activate',
      titleKeyword: settings.windowTitleKeyword || '',
      processName: settings.processName || '',
      hardTimeoutMs: 25000
    });
    return { ok: true, found: true, title: res.title || '' };
  });

  ipcMain.handle('run:start', (e, ids) => runner.start(ids));
  ipcMain.handle('run:pause', () => runner.pause());
  ipcMain.handle('run:resume', () => runner.resume());
  ipcMain.handle('run:skip', () => runner.skip());
  ipcMain.handle('run:stop', () => runner.stop());
  ipcMain.handle('run:status', () => ({ running: runner.running, paused: runner.paused }));

  ipcMain.handle('dialog:pick-exe', async () => {
    const res = await dialog.showOpenDialog(mainWindow, {
      title: '选择目标软件',
      properties: ['openFile'],
      filters: [{ name: '可执行文件', extensions: ['exe'] }]
    });
    if (res.canceled || !res.filePaths.length) return '';
    return res.filePaths[0];
  });

  ipcMain.handle('shell:open-data-dir', () => {
    shell.openPath(DATA_DIR);
    return true;
  });

  ipcMain.handle('win:minimize', () => mainWindow && mainWindow.minimize());
  ipcMain.handle('win:maximize', () => {
    if (!mainWindow) return;
    if (mainWindow.isMaximized()) mainWindow.unmaximize();
    else mainWindow.maximize();
  });
  ipcMain.handle('win:close', () => mainWindow && mainWindow.close());
}

/* ------------------------------------------------------------------ */
/* 启动                                                                */
/* ------------------------------------------------------------------ */

app.whenReady().then(() => {
  DATA_DIR = path.join(app.getPath('userData'), 'data');
  ATTACH_DIR = path.join(DATA_DIR, 'attachments');
  STORE_FILE = path.join(DATA_DIR, 'store.json');
  TMP_DIR = path.join(app.getPath('temp'), 'prompt-batch-studio');
  ensureDirs();
  loadStore();

  protocol.handle('media', (request) => {
    try {
      const url = new URL(request.url);
      let p = decodeURIComponent(url.pathname);
      if (/^\/[a-zA-Z]:/.test(p)) p = p.slice(1);
      return net.fetch(pathToFileURL(p).toString());
    } catch {
      return new Response('not found', { status: 404 });
    }
  });

  registerIpc();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  if (activeChild) {
    try {
      activeChild.kill();
    } catch {}
  }
});
