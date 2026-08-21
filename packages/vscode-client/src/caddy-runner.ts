import { spawn } from "node:child_process";
import type { ChildProcessWithoutNullStreams, SpawnOptionsWithoutStdio } from "node:child_process";
import process from "node:process";

const defaultTimeoutMilliseconds = 10_000;
const defaultMaximumOutputBytes = 256 * 1024;
const forceKillDelayMilliseconds = 1_000;

export interface CaddyRunOptions {
  readonly command: readonly string[];
  readonly arguments: readonly string[];
  readonly cwd: string;
  readonly input?: string;
  readonly maximumOutputBytes?: number;
  readonly timeoutMilliseconds?: number;
}

export interface CaddyRunResult {
  readonly arguments: readonly string[];
  readonly cancelled: boolean;
  readonly executable: string;
  readonly exitCode: number | null;
  readonly stderr: string;
  readonly stdout: string;
  readonly timedOut: boolean;
  readonly truncated: boolean;
}

export async function runCaddy(
  options: CaddyRunOptions,
  signal: AbortSignal,
  isTrusted: () => boolean,
): Promise<CaddyRunResult> {
  if (!isTrusted()) throw new Error("Trust this workspace before running Caddy.");
  const invocation = caddyInvocation(options.command, options.arguments);
  if (signal.aborted) return emptyResult(invocation, true);
  const result = await runProcess(invocation, options, signal);
  if (!isTrusted()) throw new Error("Workspace trust was revoked while Caddy was running.");
  return result;
}

export function caddyInvocation(
  command: readonly string[],
  argumentsToAppend: readonly string[],
): Readonly<{ readonly executable: string; readonly arguments: readonly string[] }> {
  if (command.length === 0) throw new Error("Caddy command must include an executable.");
  if (command.length > 128) throw new Error("Caddy command contains too many arguments.");
  const [executable, ...prefixArguments] = command;
  if (executable === undefined || executable.trim() === "") {
    throw new Error("Caddy command must include a non-empty executable.");
  }
  const allArguments = [...prefixArguments, ...argumentsToAppend];
  for (const value of [executable, ...allArguments]) {
    if (value.includes("\0")) throw new Error("Caddy command entries cannot contain NUL bytes.");
  }
  return { arguments: allArguments, executable };
}

function runProcess(
  invocation: Readonly<{ readonly executable: string; readonly arguments: readonly string[] }>,
  options: CaddyRunOptions,
  signal: AbortSignal,
): Promise<CaddyRunResult> {
  return new Promise((resolve, reject): void => {
    const spawnOptions: SpawnOptionsWithoutStdio = {
      cwd: options.cwd,
      detached: process.platform !== "win32",
      shell: false,
      stdio: "pipe",
      windowsHide: true,
    };
    const child = spawn(invocation.executable, [...invocation.arguments], spawnOptions);
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    const maximumOutputBytes = boundedPositive(
      options.maximumOutputBytes,
      defaultMaximumOutputBytes,
    );
    let outputBytes = 0;
    let timedOut = false;
    let truncated = false;
    let cancelled = false;
    let settled = false;
    let forceKillTimer: ReturnType<typeof setTimeout> | undefined;

    const stop = (): void => {
      forceKillTimer ??= terminateProcessTree(child);
    };
    const collect = (target: Buffer[], chunk: Buffer): void => {
      const remaining = Math.max(0, maximumOutputBytes - outputBytes);
      const selected = chunk.subarray(0, remaining);
      if (selected.byteLength > 0) {
        target.push(selected);
        outputBytes += selected.byteLength;
      }
      if (selected.byteLength < chunk.byteLength) {
        truncated = true;
        stop();
      }
    };
    child.stdout.on("data", (chunk: Buffer): void => {
      collect(stdout, chunk);
    });
    child.stderr.on("data", (chunk: Buffer): void => {
      collect(stderr, chunk);
    });

    const timeout = setTimeout(
      (): void => {
        timedOut = true;
        stop();
      },
      boundedPositive(options.timeoutMilliseconds, defaultTimeoutMilliseconds),
    );
    timeout.unref();
    const abort = (): void => {
      cancelled = true;
      stop();
    };
    signal.addEventListener("abort", abort, { once: true });
    const cleanup = (): void => {
      clearTimeout(timeout);
      if (forceKillTimer !== undefined) clearTimeout(forceKillTimer);
      signal.removeEventListener("abort", abort);
    };
    child.stdin.on("error", (error): void => {
      if (!isBrokenPipe(error)) {
        child.emit("error", error);
      }
    });
    child.once("error", (error): void => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error);
    });
    child.once("close", (exitCode): void => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve({
        arguments: invocation.arguments,
        cancelled,
        executable: invocation.executable,
        exitCode,
        stderr: Buffer.concat(stderr).toString("utf8"),
        stdout: Buffer.concat(stdout).toString("utf8"),
        timedOut,
        truncated,
      });
    });
    child.stdin.end(options.input ?? "");
  });
}

function terminateProcessTree(
  child: ChildProcessWithoutNullStreams,
): ReturnType<typeof setTimeout> | undefined {
  const pid = child.pid;
  if (pid === undefined) {
    child.kill();
    return undefined;
  }
  if (process.platform === "win32") {
    const killer = spawn("taskkill", ["/pid", String(pid), "/T", "/F"], {
      shell: false,
      stdio: "ignore",
      windowsHide: true,
    });
    killer.unref();
    return undefined;
  }
  try {
    process.kill(-pid, "SIGTERM");
  } catch {
    child.kill("SIGTERM");
  }
  const timer = setTimeout((): void => {
    try {
      process.kill(-pid, "SIGKILL");
    } catch {
      child.kill("SIGKILL");
    }
  }, forceKillDelayMilliseconds);
  timer.unref();
  return timer;
}

function isBrokenPipe(error: Error): boolean {
  return "code" in error && (error as NodeJS.ErrnoException).code === "EPIPE";
}

function boundedPositive(value: number | undefined, fallback: number): number {
  return value === undefined || !Number.isFinite(value) || value <= 0
    ? fallback
    : Math.floor(value);
}

function emptyResult(
  invocation: Readonly<{ readonly executable: string; readonly arguments: readonly string[] }>,
  cancelled: boolean,
): CaddyRunResult {
  return {
    arguments: invocation.arguments,
    cancelled,
    executable: invocation.executable,
    exitCode: null,
    stderr: "",
    stdout: "",
    timedOut: false,
    truncated: false,
  };
}
