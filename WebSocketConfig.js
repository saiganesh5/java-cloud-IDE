import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import pty from "node-pty";
import { WebSocketServer } from "ws";

const wss = new WebSocketServer({ port: 8081 });

// Projects directory - each project gets a folder that's mounted into Docker
const projectsDir = path.join(process.cwd(), "projects");
if (!fs.existsSync(projectsDir)) {
  fs.mkdirSync(projectsDir, { recursive: true });
}

/**
 * Read files and directories from local project folder
 */
function readFilesFromDisk(projectPath) {
  const files = [];
  const directories = [];

  function walk(dir, relativePath = "") {
    if (!fs.existsSync(dir)) return;

    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      // Skip hidden files and node_modules
      if (entry.name.startsWith(".") || entry.name === "node_modules") continue;

      const fullPath = path.join(dir, entry.name);
      const relPath = relativePath ? `${relativePath}/${entry.name}` : entry.name;

      if (entry.isDirectory()) {
        directories.push(relPath);
        walk(fullPath, relPath);
      } else if (entry.isFile()) {
        try {
          const content = fs.readFileSync(fullPath, "utf-8");
          files.push({ path: relPath, content });
        } catch { /* skip binary files */ }
      }
    }
  }

  walk(projectPath);
  return { files, directories };
}

/**
 * Write files and directories to local project folder
 */
function writeFilesToDisk(projectPath, files, directories = []) {
  // Create directories first
  for (const dir of directories) {
    const fullPath = path.join(projectPath, dir);
    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(fullPath, { recursive: true });
    }
  }

  // Write files
  for (const file of files) {
    const fullPath = path.join(projectPath, file.path);
    const dir = path.dirname(fullPath);

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(fullPath, file.content, "utf-8");
  }
}

wss.on("connection", (ws, req) => {
  const url = new URL(req.url, "ws://localhost");
  const projectId = url.searchParams.get("project");

  if (!projectId) {
    ws.close();
    return;
  }

  const containerName = `ide-${projectId}`;
  const projectPath = path.join(projectsDir, projectId);
  let shell = null;
  let fileWatcher = null;
  let debounceTimer = null;
  let ignoreNextChange = false; // Flag to ignore fs.watch events from our own writes

  // Ensure project folder exists
  if (!fs.existsSync(projectPath)) {
    fs.mkdirSync(projectPath, { recursive: true });
  }

  function ensureContainer() {
    try {
      execSync(`docker inspect ${containerName}`, { stdio: "ignore", windowsHide: true });
    } catch {
      console.log(`Creating container ${containerName} with volume mount`);
      // Convert Windows path to Docker-compatible format
      const dockerPath = projectPath.replace(/\\/g, "/");
      execSync(
        `docker run -dit --name ${containerName} --cpus=1 --memory=1g --network=none -v "${dockerPath}:/workspace" eclipse-temurin:17-jdk /bin/bash`,
        { stdio: "inherit" }
      );
    }
  }

  function sendFilesToFrontend() {
    const result = readFilesFromDisk(projectPath);
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify({
        type: "fileChange",
        files: result.files,
        directories: result.directories
      }));
      console.log(`📤 Sent ${result.files.length} files and ${result.directories.length} directories to frontend`);
    }
  }

  function startFileWatcher() {
    if (fileWatcher) return;

    // Use fs.watch for instant file change detection
    try {
      fileWatcher = fs.watch(projectPath, { recursive: true }, (eventType, filename) => {
        if (!filename || filename.startsWith(".") || filename.includes("node_modules")) {
          return;
        }

        // Debounce to avoid rapid-fire updates
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          // Skip if this change was caused by our own write
          if (ignoreNextChange) {
            ignoreNextChange = false;
            return;
          }
          console.log(`📁 File change detected: ${filename}`);
          sendFilesToFrontend();
        }, 500);
      });
      console.log(`👀 Watching ${projectPath} for changes`);
    } catch (e) {
      console.error("Failed to start file watcher:", e.message);
    }
  }

  function attachPty() {
    if (shell) return;

    ensureContainer();

    shell = pty.spawn(
      "docker",
      ["exec", "-it", "-w", "/workspace", containerName, "/bin/bash"],
      { name: "xterm-color", cols: 80, rows: 24 }
    );

    shell.onData((data) => {
      if (ws.readyState === ws.OPEN) {
        ws.send(data);
      }
    });

    startFileWatcher();
    ws.send("\r\n✅ Connected to container. Working directory: /workspace\r\n\r\n");
  }

  ws.on("message", (msg) => {
    const text = msg.toString();
    try {
      const json = JSON.parse(text);

      // Initial sync from frontend - write files to disk
      if (json.type === "sync" && json.files) {
        console.log(`📥 Received ${json.files.length} files and ${json.directories?.length || 0} directories from frontend`);
        ignoreNextChange = true;
        writeFilesToDisk(projectPath, json.files, json.directories || []);
        attachPty();
        return;
      }

      if (json.type === "resize" && shell) {
        shell.resize(json.cols, json.rows);
        return;
      }

      // Force sync from frontend (when user edits files in IDE)
      if (json.type === "forceSync" && json.files) {
        ignoreNextChange = true;
        writeFilesToDisk(projectPath, json.files, json.directories || []);
        return;
      }

      // Read files request
      if (json.type === "readFiles") {
        sendFilesToFrontend();
        return;
      }
    } catch { }

    if (shell) {
      shell.write(text);
    }
  });

  ws.on("close", () => {
    if (fileWatcher) {
      fileWatcher.close();
    }
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
    if (shell) {
      shell.kill();
    }
  });
});

console.log("✅ Terminal backend running on ws://localhost:8081");
console.log(`📁 Projects directory: ${projectsDir}`);
