'use strict';

const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('api', {
  getStore: () => ipcRenderer.invoke('store:get'),
  createProject: () => ipcRenderer.invoke('project:create'),
  createProjects: (list) => ipcRenderer.invoke('project:create-many', list),
  updateProject: (id, patch) => ipcRenderer.invoke('project:update', id, patch),
  deleteProject: (id) => ipcRenderer.invoke('project:delete', id),
  duplicateProject: (id) => ipcRenderer.invoke('project:duplicate', id),
  moveProject: (id, dir) => ipcRenderer.invoke('project:move', id, dir),
  resetStatus: () => ipcRenderer.invoke('project:reset-status'),
  openProjectFolder: (id) => ipcRenderer.invoke('project:open-folder', id),
  projectDir: (id) => ipcRenderer.invoke('project:dir', id),
  pickDir: () => ipcRenderer.invoke('dir:pick'),
  openDir: (p) => ipcRenderer.invoke('dir:open', p),
  copyText: (t) => ipcRenderer.invoke('clipboard:write', t),

  pickAttachments: (id) => ipcRenderer.invoke('attachment:pick', id),
  addAttachmentPaths: (id, paths) => ipcRenderer.invoke('attachment:add-paths', id, paths),
  removeAttachment: (id, attId) => ipcRenderer.invoke('attachment:remove', id, attId),
  openAttachment: (path) => ipcRenderer.invoke('attachment:open', path),

  updateSettings: (patch) => ipcRenderer.invoke('settings:update', patch),
  previewPrompt: (draft, index, total) => ipcRenderer.invoke('prompt:preview', draft, index, total),
  testTarget: () => ipcRenderer.invoke('target:test'),
  sampleCursor: () => ipcRenderer.invoke('target:sample-cursor'),

  startRun: (ids) => ipcRenderer.invoke('run:start', ids),
  pauseRun: () => ipcRenderer.invoke('run:pause'),
  resumeRun: () => ipcRenderer.invoke('run:resume'),
  skipRun: () => ipcRenderer.invoke('run:skip'),
  stopRun: () => ipcRenderer.invoke('run:stop'),
  runStatus: () => ipcRenderer.invoke('run:status'),

  pickExe: () => ipcRenderer.invoke('dialog:pick-exe'),
  openDataDir: () => ipcRenderer.invoke('shell:open-data-dir'),

  minimize: () => ipcRenderer.invoke('win:minimize'),
  maximize: () => ipcRenderer.invoke('win:maximize'),
  close: () => ipcRenderer.invoke('win:close'),

  onRunEvent: (cb) => {
    const handler = (_e, payload) => cb(payload);
    ipcRenderer.on('run:event', handler);
    return () => ipcRenderer.removeListener('run:event', handler);
  },

  getPathForFile: (file) => {
    try {
      return webUtils.getPathForFile(file);
    } catch {
      return file.path || '';
    }
  }
});
