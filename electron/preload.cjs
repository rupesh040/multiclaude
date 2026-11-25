const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("multiclaudeDesktop", {
  isElectron: true,
  syncTabs: (payload) => ipcRenderer.invoke("tabs:sync", payload),
  reloadTab: (tabId) => ipcRenderer.invoke("tabs:reload", tabId),
  goBackTab: (tabId) => ipcRenderer.invoke("tabs:back", tabId),
  navigateTab: (tabId, url) => ipcRenderer.invoke("tabs:navigate", tabId, url),
  clearPartition: (tabId) => ipcRenderer.invoke("tabs:clearPartition", tabId),
  onTabStatus: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on("tabs:status", listener);
    return () => ipcRenderer.removeListener("tabs:status", listener);
  },
});
