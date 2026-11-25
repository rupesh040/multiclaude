const {
  app,
  BrowserWindow,
  WebContentsView,
  ipcMain,
  protocol,
  session,
} = require("electron");
const fs = require("node:fs");
const path = require("node:path");

const DEFAULT_CLAUDE_URL = "https://claude.ai/new";
const DEV_URL = process.env.MULTICLAUDE_URL || "";
const APP_SCHEME = "app";
const APP_ORIGIN = `${APP_SCHEME}://multiclaude`;
const OUT_DIR = path.resolve(__dirname, "..", "out");

// Use one consistent userData directory across dev and installed Windows builds
const USER_DATA_DIR = path.join(app.getPath("appData"), "MultiClaude");
fs.mkdirSync(USER_DATA_DIR, { recursive: true });
app.setName("MultiClaude");
app.setPath("userData", USER_DATA_DIR);
if (process.platform === "win32") {
  app.setAppUserModelId("com.multiclaude.desktop");
}

protocol.registerSchemesAsPrivileged([
  {
    scheme: APP_SCHEME,
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
    },
  },
]);

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".txt": "text/plain; charset=utf-8",
};

/** @type {BrowserWindow | null} */
let mainWindow = null;
let isFlushingBeforeQuit = false;

/** @type {Map<string, WebContentsView>} */
const tabViews = new Map();

/** @type {Set<string>} */
const knownPartitions = new Set();

/** @type {{ activeTabId: string | null; topOffset: number; modalOpen: boolean }} */
const layoutState = {
  activeTabId: null,
  topOffset: 54,
  modalOpen: false,
};

function sanitizeTabId(rawId) {
  return (
    String(rawId || "tab-1")
      .toLowerCase()
      .replace(/[^a-z0-9-_]+/g, "-")
      .replace(/^-+|-+$/g, "") || "tab-1"
  );
}

function isAllowedTargetUrl(rawUrl) {
  try {
    const parsed = new URL(rawUrl);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

async function flushAllCookieStores() {
  session.defaultSession.flushStorageData();
  const tasks = [session.defaultSession.cookies.flushStore().catch(() => undefined)];
  for (const partitionName of knownPartitions) {
    const ses = session.fromPartition(partitionName);
    ses.flushStorageData();
    tasks.push(ses.cookies.flushStore().catch(() => undefined));
  }
  await Promise.all(tasks);
}

function registerStaticExportProtocol() {
  protocol.handle(APP_SCHEME, async (request) => {
    try {
      const reqUrl = new URL(request.url);
      let relPath = decodeURIComponent(reqUrl.pathname || "/");
      if (relPath === "/" || relPath === "") {
        relPath = "/index.html";
      }

      const trimmedRel = relPath.replace(/^\/+/, "");
      let candidate = path.resolve(OUT_DIR, trimmedRel);
      const outPrefix = OUT_DIR.endsWith(path.sep) ? OUT_DIR : `${OUT_DIR}${path.sep}`;
      if (candidate !== OUT_DIR && !candidate.startsWith(outPrefix)) {
        return new Response("Forbidden", { status: 403 });
      }

      if (!fs.existsSync(candidate) || fs.statSync(candidate).isDirectory()) {
        const htmlCandidate = `${candidate}.html`;
        if (fs.existsSync(htmlCandidate)) {
          candidate = htmlCandidate;
        } else {
          candidate = path.join(OUT_DIR, "index.html");
        }
      }

      const ext = path.extname(candidate).toLowerCase();
      const contentType = MIME_TYPES[ext] || "application/octet-stream";
      const data = await fs.promises.readFile(candidate);
      return new Response(data, {
        status: 200,
        headers: { "content-type": contentType },
      });
    } catch {
      return new Response("Not Found", { status: 404 });
    }
  });
}

function getContentBounds() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return { x: 0, y: 54, width: 1200, height: 800 };
  }
  const { width, height } = mainWindow.getContentBounds();
  const top = Math.max(0, Math.round(layoutState.topOffset));
  return {
    x: 0,
    y: top,
    width: Math.max(0, width),
    height: Math.max(0, height - top),
  };
}

function syncViewVisibilityAndBounds() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const bounds = getContentBounds();
  for (const [tabId, view] of tabViews.entries()) {
    const shouldShow =
      !layoutState.modalOpen && tabId === layoutState.activeTabId;
    if (shouldShow) {
      view.setBounds(bounds);
    }
    view.setVisible(shouldShow);
  }
}

function sendTabUpdate(payload) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents.send("tabs:status", payload);
}

function ensureTabView(tab) {
  const tabId = sanitizeTabId(tab.id);
  const existing = tabViews.get(tabId);
  if (existing) return existing;

  const partitionName = `persist:${tabId}`;
  knownPartitions.add(partitionName);
  const tabSession = session.fromPartition(partitionName);

  const view = new WebContentsView({
    webPreferences: {
      session: tabSession,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  const wc = view.webContents;

  wc.setWindowOpenHandler(() => ({
    action: "allow",
    overrideBrowserWindowOptions: {
      width: 540,
      height: 700,
      autoHideMenuBar: true,
      backgroundColor: "#212120",
      webPreferences: {
        session: tabSession,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    },
  }));

  wc.on("did-start-loading", () => {
    sendTabUpdate({ tabId, loading: true, url: wc.getURL() });
  });

  wc.on("did-stop-loading", () => {
    sendTabUpdate({ tabId, loading: false, url: wc.getURL() });
    tabSession.cookies.flushStore().catch(() => undefined);
  });

  wc.on("did-navigate", (_event, url) => {
    sendTabUpdate({ tabId, url });
  });

  wc.on("did-navigate-in-page", (_event, url) => {
    sendTabUpdate({ tabId, url });
  });

  wc.on("page-title-updated", (_event, title) => {
    sendTabUpdate({ tabId, title });
  });

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.contentView.addChildView(view);
  }

  tabViews.set(tabId, view);

  const targetUrl = isAllowedTargetUrl(tab.url) ? tab.url : DEFAULT_CLAUDE_URL;
  wc.loadURL(targetUrl).catch(() => undefined);

  return view;
}

function destroyTabView(tabId) {
  const view = tabViews.get(tabId);
  if (!view) return;
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.contentView.removeChildView(view);
  }
  if (!view.webContents.isDestroyed()) {
    view.webContents.close();
  }
  tabViews.delete(tabId);
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 760,
    minHeight: 540,
    backgroundColor: "#212120",
    title: "MultiClaude",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.on("resize", syncViewVisibilityAndBounds);
  mainWindow.on("close", () => {
    void flushAllCookieStores();
  });
  mainWindow.on("closed", () => {
    for (const tabId of [...tabViews.keys()]) {
      destroyTabView(tabId);
    }
    mainWindow = null;
  });

  const entryUrl = DEV_URL || `${APP_ORIGIN}/index.html`;
  mainWindow.loadURL(entryUrl);
}

ipcMain.handle("tabs:sync", (_event, payload) => {
  const tabs = Array.isArray(payload?.tabs) ? payload.tabs : [];
  const nextIds = new Set(tabs.map((t) => sanitizeTabId(t.id)));

  for (const existingId of [...tabViews.keys()]) {
    if (!nextIds.has(existingId)) {
      destroyTabView(existingId);
    }
  }

  for (const tab of tabs) {
    ensureTabView(tab);
  }

  layoutState.activeTabId = payload?.activeTabId
    ? sanitizeTabId(payload.activeTabId)
    : tabs[0]
      ? sanitizeTabId(tabs[0].id)
      : null;

  if (typeof payload?.topOffset === "number" && payload.topOffset >= 36) {
    layoutState.topOffset = payload.topOffset;
  }

  layoutState.modalOpen = Boolean(payload?.modalOpen);
  syncViewVisibilityAndBounds();
  return { ok: true };
});

ipcMain.handle("tabs:reload", (_event, rawTabId) => {
  const view = tabViews.get(sanitizeTabId(rawTabId));
  if (view && !view.webContents.isDestroyed()) {
    view.webContents.reload();
  }
});

ipcMain.handle("tabs:back", (_event, rawTabId) => {
  const view = tabViews.get(sanitizeTabId(rawTabId));
  if (
    view &&
    !view.webContents.isDestroyed() &&
    view.webContents.navigationHistory.canGoBack()
  ) {
    view.webContents.navigationHistory.goBack();
  }
});

ipcMain.handle("tabs:navigate", (_event, rawTabId, targetUrl) => {
  const view = tabViews.get(sanitizeTabId(rawTabId));
  const safeUrl = isAllowedTargetUrl(targetUrl) ? targetUrl : DEFAULT_CLAUDE_URL;
  if (view && !view.webContents.isDestroyed()) {
    view.webContents.loadURL(safeUrl).catch(() => undefined);
  }
});

ipcMain.handle("tabs:clearPartition", async (_event, rawTabId) => {
  const tabId = sanitizeTabId(rawTabId);
  const ses = session.fromPartition(`persist:${tabId}`);
  await ses.clearStorageData();
  await ses.clearCache();
  await ses.cookies.flushStore().catch(() => undefined);
  const view = tabViews.get(tabId);
  if (view && !view.webContents.isDestroyed()) {
    await view.webContents.loadURL(DEFAULT_CLAUDE_URL).catch(() => undefined);
  }
  return { ok: true };
});

const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    if (!DEV_URL) {
      registerStaticExportProtocol();
    }
    createMainWindow();

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createMainWindow();
      }
    });
  });

  app.on("before-quit", (event) => {
    if (isFlushingBeforeQuit) return;
    isFlushingBeforeQuit = true;
    event.preventDefault();
    flushAllCookieStores().finally(() => {
      app.quit();
    });
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
      app.quit();
    }
  });
}
