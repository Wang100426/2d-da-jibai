const { app, BrowserWindow, dialog, nativeImage } = require("electron");
const { spawn } = require("node:child_process");
const path = require("node:path");

let backend;
let backendUrl;
let mainWindow;
let quitting = false;

async function updateWindowIcon(window) {
  if (!window || window.isDestroyed() || mainWindow !== window) return;
  const language = await window.webContents.executeJavaScript(
    "document.documentElement.lang",
  );
  const iconName = language === "en"
    ? "2d_da_jibai_ico_en.ico"
    : "2d_da_jibai_ico.ico";
  const icon = nativeImage.createFromPath(path.join(app.getAppPath(), "assets", iconName));
  if (!window.isDestroyed() && mainWindow === window && !icon.isEmpty()) window.setIcon(icon);
}

function startBackend() {
  if (backendUrl && backend && backend.exitCode === null) return Promise.resolve(backendUrl);
  return new Promise((resolve, reject) => {
    const packaged = app.isPackaged;
    const executable = packaged
      ? path.join(process.resourcesPath, "backend", "desktop-server.exe")
      : path.join(__dirname, "..", "desktop_server.py");
    const command = packaged ? executable : process.env.PYTHON || "python";
    const args = packaged ? [] : [executable];

    backend = spawn(command, args, {
      cwd: packaged ? process.resourcesPath : path.join(__dirname, ".."),
      env: { ...process.env, PYTHONUNBUFFERED: "1" },
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
    });

    let output = "";
    let settled = false;
    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new Error("本地游戏服务启动超时。"));
    }, 45000);

    backend.stdout.setEncoding("utf8");
    backend.stdout.on("data", (chunk) => {
      output += chunk;
      const lines = output.split(/\r?\n/);
      output = lines.pop() || "";
      for (const line of lines) {
        try {
          const event = JSON.parse(line);
          if (event.event !== "ready" || settled) continue;
          settled = true;
          clearTimeout(timeout);
          backendUrl = `http://127.0.0.1:${event.port}`;
          resolve(backendUrl);
        } catch {
          // Ignore regular server log lines; the ready event is JSON.
        }
      }
    });
    backend.stderr.on("data", (chunk) => {
      console.error(`[game-server] ${String(chunk).trimEnd()}`);
    });
    backend.once("error", (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      reject(error);
    });
    backend.once("exit", (code) => {
      if (quitting) return;
      const error = new Error(`本地游戏服务意外退出（${code ?? "未知错误"}）。`);
      if (!settled) {
        settled = true;
        clearTimeout(timeout);
        reject(error);
      } else {
        backendUrl = undefined;
        dialog.showErrorBox("本地游戏服务已停止", error.message);
        app.quit();
      }
    });
  });
}

async function createWindow() {
  const serverUrl = await startBackend();
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 900,
    minHeight: 620,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: "#10131d",
    title: "2D大击败",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.once("ready-to-show", () => mainWindow.show());
  mainWindow.on("closed", () => {
    mainWindow = undefined;
  });
  mainWindow.webContents.on("did-finish-load", () => {
    void updateWindowIcon(mainWindow).catch((error) => {
      console.error("Could not update the application icon.", error);
    });
  });
  await mainWindow.loadURL(serverUrl);
}

app.whenReady().then(async () => {
  try {
    await createWindow();
  } catch (error) {
    dialog.showErrorBox(
      "2D大击败启动失败",
      error instanceof Error ? error.message : String(error),
    );
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) void createWindow();
});

app.on("before-quit", () => {
  quitting = true;
  if (backend && backend.exitCode === null) {
    backend.stdin.end();
    const shutdownTimeout = setTimeout(() => {
      if (backend && backend.exitCode === null) backend.kill();
    }, 3000);
    shutdownTimeout.unref();
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
