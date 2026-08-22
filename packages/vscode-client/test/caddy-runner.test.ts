import { spawn } from "node:child_process";
import { access, mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { caddyInvocation, runCaddy } from "../src/caddy-runner.js";

describe("Caddy process runner", () => {
  it.skipIf(process.env["CADDY_BIN"] === undefined)(
    "runs the pinned Caddy binary through the production process boundary",
    async () => {
      const executable = process.env["CADDY_BIN"];
      expect(executable).toBeDefined();
      const command = executable === undefined ? [] : [executable];
      const valid = await runCaddy(
        {
          arguments: ["adapt", "--config", "-", "--adapter", "caddyfile"],
          command,
          cwd: process.cwd(),
          input: ':80 {\n\trespond "ok"\n}\n',
        },
        new AbortController().signal,
        () => true,
      );
      expect(valid).toMatchObject({
        cancelled: false,
        exitCode: 0,
        timedOut: false,
        truncated: false,
      });
      expect(JSON.parse(valid.stdout)).toMatchObject({ apps: { http: { servers: {} } } });

      const invalid = await runCaddy(
        {
          arguments: ["adapt", "--config", "-", "--adapter", "caddyfile"],
          command,
          cwd: process.cwd(),
          input: ":80 {\n\trespond one two three four\n}\n",
        },
        new AbortController().signal,
        () => true,
      );
      expect(invalid.exitCode).not.toBe(0);
      expect(invalid.stderr).toContain("respond");
    },
  );

  it("appends adapt arguments literally and sends the in-memory source over stdin", async () => {
    const workingDirectory = await mkdtemp(join(tmpdir(), "caddy-runner-"));
    const script =
      "let input='';process.stdin.on('data',c=>input+=c);process.stdin.on('end',()=>process.stdout.write(JSON.stringify({args:process.argv.slice(1),cwd:process.cwd(),input})))";
    try {
      const result = await runCaddy(
        {
          arguments: ["adapt", "--config", "-", "--adapter", "caddyfile"],
          command: [process.execPath, "-e", script, "--", "wrapper argument"],
          cwd: workingDirectory,
          input: ":80 {\n\trespond ok\n}\n",
        },
        new AbortController().signal,
        () => true,
      );
      expect(result).toMatchObject({
        cancelled: false,
        exitCode: 0,
        timedOut: false,
        truncated: false,
      });
      const probe = parseProcessProbe(result.stdout);
      expect(probe).toMatchObject({
        args: ["wrapper argument", "adapt", "--config", "-", "--adapter", "caddyfile"],
        input: ":80 {\n\trespond ok\n}\n",
      });
      const [expectedDirectory, actualDirectory] = await Promise.all([
        stat(workingDirectory),
        stat(probe.cwd),
      ]);
      expect({ dev: actualDirectory.dev, ino: actualDirectory.ino }).toEqual({
        dev: expectedDirectory.dev,
        ino: expectedDirectory.ino,
      });
    } finally {
      await rm(workingDirectory, { force: true, recursive: true });
    }
  });

  it("refuses untrusted execution and invalid command arrays", async () => {
    await expect(
      runCaddy(
        { arguments: ["version"], command: ["caddy"], cwd: process.cwd() },
        new AbortController().signal,
        () => false,
      ),
    ).rejects.toThrow("Trust this workspace");
    expect(() => caddyInvocation([], [])).toThrow("include an executable");
    expect(() => caddyInvocation([""], [])).toThrow("non-empty executable");
    expect(() => caddyInvocation(["caddy", "bad\0argument"], [])).toThrow("NUL");
    expect(() =>
      caddyInvocation(["caddy", ...Array.from({ length: 128 }, () => "arg")], []),
    ).toThrow("too many arguments");
  });

  it("preserves Windows paths and wrapper command arrays literally", () => {
    expect(caddyInvocation([String.raw`C:\Program Files\Caddy\caddy.exe`], ["version"])).toEqual({
      arguments: ["version"],
      executable: String.raw`C:\Program Files\Caddy\caddy.exe`,
    });
    expect(
      caddyInvocation(
        ["flatpak-spawn", "--host", "podman", "run", "--rm", "-i", "caddy:2.11.4", "caddy"],
        ["adapt", "--config", "-", "--adapter", "caddyfile"],
      ),
    ).toEqual({
      arguments: [
        "--host",
        "podman",
        "run",
        "--rm",
        "-i",
        "caddy:2.11.4",
        "caddy",
        "adapt",
        "--config",
        "-",
        "--adapter",
        "caddyfile",
      ],
      executable: "flatpak-spawn",
    });
  });

  it("reports a missing executable without hanging", async () => {
    await expect(
      runCaddy(
        {
          arguments: [],
          command: [join(tmpdir(), "definitely-missing-caddy")],
          cwd: process.cwd(),
        },
        new AbortController().signal,
        () => true,
      ),
    ).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("returns immediately when already cancelled", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      runCaddy(
        { arguments: [], command: ["/definitely/not/executed"], cwd: process.cwd() },
        controller.signal,
        () => true,
      ),
    ).resolves.toMatchObject({
      cancelled: true,
      exitCode: null,
      stderr: "",
      stdout: "",
    });
  });

  it("captures stderr and a nonzero exit", async () => {
    const result = await runCaddy(
      {
        arguments: [],
        command: [
          process.execPath,
          "-e",
          "process.stderr.write('invalid Caddyfile');process.exit(7)",
        ],
        cwd: process.cwd(),
      },
      new AbortController().signal,
      () => true,
    );
    expect(result).toMatchObject({
      exitCode: 7,
      stderr: "invalid Caddyfile",
      stdout: "",
    });
  });

  it("cancels an active process tree", async () => {
    const controller = new AbortController();
    const result = runCaddy(
      {
        arguments: [],
        command: [process.execPath, "-e", "setInterval(()=>{},1000)"],
        cwd: process.cwd(),
      },
      controller.signal,
      () => true,
    );
    setTimeout(() => controller.abort(), 30);
    await expect(result).resolves.toMatchObject({ cancelled: true, timedOut: false });
  });

  it("cancels a descendant process tree after both processes are running", async () => {
    const workingDirectory = await mkdtemp(join(tmpdir(), "caddy-runner-tree-"));
    const readyFile = join(workingDirectory, "descendant-ready");
    const pidFile = join(workingDirectory, "descendant-pid");
    const fixture = join(import.meta.dirname, "fixtures", "process-tree.cjs");
    const controller = new AbortController();
    const result = runCaddy(
      {
        arguments: ["parent", readyFile, pidFile],
        command: [process.execPath, fixture],
        cwd: workingDirectory,
      },
      controller.signal,
      () => true,
    );
    let descendantPid: number | undefined;
    try {
      await waitForFile(readyFile);
      descendantPid = Number(await readFile(pidFile, "utf8"));
      expect(Number.isSafeInteger(descendantPid)).toBe(true);
      controller.abort();
      await expect(result).resolves.toMatchObject({ cancelled: true, timedOut: false });
      await waitForProcessExit(descendantPid);
    } finally {
      controller.abort();
      await result.catch(() => undefined);
      if (descendantPid !== undefined) terminateTestProcess(descendantPid);
      await rm(workingDirectory, { force: true, recursive: true });
    }
  });

  it.skipIf(process.platform === "win32")(
    "force-kills a process that ignores graceful termination",
    async () => {
      const workingDirectory = await mkdtemp(join(tmpdir(), "caddy-runner-"));
      const readyFile = join(workingDirectory, "ready");
      const controller = new AbortController();
      const result = runCaddy(
        {
          arguments: [],
          command: [
            process.execPath,
            "-e",
            "process.on('SIGTERM',()=>{});process.stdout.write('ready',()=>require('node:fs').writeFileSync(process.argv[1],''));setInterval(()=>{},1000)",
            readyFile,
          ],
          cwd: workingDirectory,
        },
        controller.signal,
        () => true,
      );
      try {
        await waitForFile(readyFile);
        controller.abort();
        await expect(result).resolves.toMatchObject({ cancelled: true, stdout: "ready" });
      } finally {
        controller.abort();
        await result.catch(() => undefined);
        await rm(workingDirectory, { force: true, recursive: true });
      }
    },
  );

  it("enforces timeout and combined output limits", async () => {
    const timed = await runCaddy(
      {
        arguments: [],
        command: [process.execPath, "-e", "setInterval(()=>{},1000)"],
        cwd: process.cwd(),
        timeoutMilliseconds: 30,
      },
      new AbortController().signal,
      () => true,
    );
    expect(timed).toMatchObject({ timedOut: true });

    const noisy = await runCaddy(
      {
        arguments: [],
        command: [
          process.execPath,
          "-e",
          "process.stdout.write('x'.repeat(4096));setInterval(()=>{},1000)",
        ],
        cwd: process.cwd(),
        maximumOutputBytes: 128,
      },
      new AbortController().signal,
      () => true,
    );
    expect(noisy).toMatchObject({ truncated: true });
    expect(Buffer.byteLength(noisy.stdout)).toBe(128);

    const defaulted = await runCaddy(
      {
        arguments: [],
        command: [process.execPath, "-e", "process.stdout.write('ok')"],
        cwd: process.cwd(),
        maximumOutputBytes: Number.NaN,
      },
      new AbortController().signal,
      () => true,
    );
    expect(defaulted.stdout).toBe("ok");
  });
});

function parseProcessProbe(serialized: string): {
  args: string[];
  cwd: string;
  input: string;
} {
  const value: unknown = JSON.parse(serialized);
  if (typeof value !== "object" || value === null) throw new TypeError("Expected an object");
  const record = value as Record<string, unknown>;
  const args = record["args"];
  const cwd = record["cwd"];
  const input = record["input"];
  if (
    !Array.isArray(args) ||
    !args.every((argument: unknown) => typeof argument === "string") ||
    typeof cwd !== "string" ||
    typeof input !== "string"
  ) {
    throw new TypeError("Expected a valid process probe");
  }
  return { args, cwd, input };
}

async function waitForFile(path: string): Promise<void> {
  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline) {
    try {
      await access(path);
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
  }
  throw new Error(`Timed out waiting for child process readiness: ${path}`);
}

async function waitForProcessExit(pid: number): Promise<void> {
  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline) {
    if (!processExists(pid)) return;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error(`Descendant process ${String(pid)} survived cancellation.`);
}

function processExists(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code !== "ESRCH";
  }
}

function terminateTestProcess(pid: number): void {
  if (!processExists(pid)) return;
  if (process.platform === "win32") {
    const killer = spawn("taskkill", ["/pid", String(pid), "/T", "/F"], {
      shell: false,
      stdio: "ignore",
      windowsHide: true,
    });
    killer.unref();
    return;
  }
  try {
    process.kill(pid, "SIGKILL");
  } catch {
    // The process exited between the existence check and the signal.
  }
}
