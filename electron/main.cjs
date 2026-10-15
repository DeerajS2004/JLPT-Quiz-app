const { app, BrowserWindow } = require("electron");
const path = require("path");
const { spawn } = require("child_process");

let mainWindow;
let serverProcess;

function startServer() {
  return new Promise((resolve, reject) => {
    // Packaged app: files unpacked from the asar live under app.asar.unpacked.
    const packedServerPath = path.join(
      process.resourcesPath,
      "app.asar.unpacked",
      ".output",
      "server",
      "index.mjs"
    );
    // Unpacked development / local builds.
    const devServerPath = path.join(__dirname, "..", ".output", "server", "index.mjs");
    const entry = require("fs").existsSync(packedServerPath) ? packedServerPath : devServerPath;

    // Use a random OS-assigned port so multiple instances don't collide.
    // ELECTRON_RUN_AS_NODE is required so that spawning process.execPath runs
    // this file as a plain Node script instead of launching another Electron
    // app instance (which would open a new window and recurse infinitely).
    // Fixed port (not "0"/random) so the app always runs at the same origin.
    // Browser storage (localStorage/IndexedDB) is scoped per-origin, so a
    // random port each launch was wiping quiz history every time.
    const env = { ...process.env, NITRO_PORT: "47823", ELECTRON_RUN_AS_NODE: "1" };

    serverProcess = spawn(process.execPath, [entry], {
      env,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let resolved = false;
    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        reject(new Error("Timed out waiting for the SSR server to start."));
      }
    }, 15000);

    const onData = (data) => {
      const text = data.toString();
      const match = text.match(/Listening on:?\s+(http:\/\/[^\s]+)/);
      if (match && !resolved) {
        resolved = true;
        clearTimeout(timeout);
        resolve(match[1]);
      }
    };

    serverProcess.stdout.on("data", onData);
    serverProcess.stderr.on("data", onData);

    serverProcess.on("error", (err) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeout);
        reject(err);
      }
    });

    serverProcess.on("exit", (code) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeout);
        reject(new Error(`SSR server exited early with code ${code}.`));
      }
    });
  });
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 900,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.cjs"),
    },
  });

  try {
    const serverUrl = await startServer();
    mainWindow.loadURL(serverUrl);
  } catch (err) {
    console.error("Failed to start SSR server:", err);
    mainWindow.webContents.executeJavaScript(`
      document.body.innerHTML = '<h1>JLPT Practice</h1><p>Could not start the local server. Please try restarting the app.</p>';
    `);
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// Prevent a second copy of the app from launching and colliding on the
// fixed port above.
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(createWindow);
}

app.on("window-all-closed", () => {
  if (serverProcess) {
    serverProcess.kill();
    serverProcess = null;
  }
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (mainWindow == null) {
    createWindow();
  }
});

app.on("before-quit", () => {
  if (serverProcess) {
    serverProcess.kill();
    serverProcess = null;
  }
});
