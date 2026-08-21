import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { caddyInvocation, runCaddy } from "../src/caddy-runner.js";

describe("Caddy process runner", () => {
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
      expect(JSON.parse(result.stdout)).toEqual({
        args: ["wrapper argument", "adapt", "--config", "-", "--adapter", "caddyfile"],
        cwd: workingDirectory,
        input: ":80 {\n\trespond ok\n}\n",
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

  it.skipIf(process.platform === "win32")(
    "force-kills a process that ignores graceful termination",
    async () => {
      const controller = new AbortController();
      const result = runCaddy(
        {
          arguments: [],
          command: [
            process.execPath,
            "-e",
            "process.on('SIGTERM',()=>{});process.stdout.write('ready');setInterval(()=>{},1000)",
          ],
          cwd: process.cwd(),
        },
        controller.signal,
        () => true,
      );
      await new Promise((resolve) => setTimeout(resolve, 50));
      controller.abort();
      await expect(result).resolves.toMatchObject({ cancelled: true, stdout: "ready" });
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
