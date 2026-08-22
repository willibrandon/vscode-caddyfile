const { spawn } = require("node:child_process");
const { writeFileSync } = require("node:fs");

const [mode, readyFile, pidFile] = process.argv.slice(2);
if (mode === "child") {
  writeFileSync(readyFile, "ready");
  globalThis.setInterval(() => undefined, 1_000);
} else {
  const child = spawn(process.execPath, [process.argv[1], "child", readyFile, pidFile], {
    stdio: "ignore",
    windowsHide: true,
  });
  if (child.pid === undefined) throw new Error("The descendant process did not start.");
  writeFileSync(pidFile, String(child.pid));
  globalThis.setInterval(() => undefined, 1_000);
}
