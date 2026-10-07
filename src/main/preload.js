const { contextBridge, ipcRenderer, webUtils } = require("electron");
contextBridge.exposeInMainWorld("scribble", {
  request: async (action, args = {}) => {
    const r = await ipcRenderer.invoke("scribble:request", { action, args });
    if (!r.ok) throw Error(r.error);
    return r.value;
  },
  on: (callback) => {
    const listener = (_, data) => callback(data);
    ipcRenderer.on("scribble:event", listener);
    return () => ipcRenderer.removeListener("scribble:event", listener);
  },
  filePath: (file) => webUtils.getPathForFile(file),
});
