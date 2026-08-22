import { describe, expect, it, vi } from "vitest";

interface RetryModule {
  isTransientExtensionServiceError(error: unknown): boolean;
  retryTransient<T>(
    operation: (attempt: number) => Promise<T>,
    options?: {
      attempts?: number;
      delayForAttempt?: (attempt: number) => number;
      isRetryable?: (error: unknown) => boolean;
      onRetry?: (event: { attempt: number; delayMilliseconds: number; error: unknown }) => void;
      wait?: (milliseconds: number) => Promise<void>;
    },
  ): Promise<T>;
}

const moduleUrl = new URL("../retry-transient.mjs", import.meta.url);
const retry = (await import(moduleUrl.href)) as RetryModule;

describe("transient retries", () => {
  it("retries a transient failure with bounded delays", async () => {
    const unavailable = Object.assign(new Error("install failed"), {
      stderr: "Server returned 503",
    });
    const operation = vi
      .fn<(attempt: number) => Promise<string>>()
      .mockRejectedValueOnce(unavailable)
      .mockRejectedValueOnce(unavailable)
      .mockResolvedValue("installed");
    const wait = vi.fn<(milliseconds: number) => Promise<void>>().mockResolvedValue(undefined);
    const onRetry = vi.fn();

    await expect(
      retry.retryTransient(operation, {
        attempts: 3,
        delayForAttempt: (attempt) => attempt * 100,
        isRetryable: (error) => retry.isTransientExtensionServiceError(error),
        onRetry,
        wait,
      }),
    ).resolves.toBe("installed");
    expect(operation.mock.calls.map(([attempt]) => attempt)).toEqual([1, 2, 3]);
    expect(wait.mock.calls.map(([milliseconds]) => milliseconds)).toEqual([100, 200]);
    expect(onRetry).toHaveBeenCalledTimes(2);
  });

  it("does not retry a permanent install error", async () => {
    const error = new Error("Extension is incompatible with this version of VS Code");
    const operation = vi.fn<() => Promise<void>>().mockRejectedValue(error);
    const wait = vi.fn<(milliseconds: number) => Promise<void>>();

    await expect(
      retry.retryTransient(operation, {
        isRetryable: (candidate) => retry.isTransientExtensionServiceError(candidate),
        wait,
      }),
    ).rejects.toBe(error);
    expect(operation).toHaveBeenCalledOnce();
    expect(wait).not.toHaveBeenCalled();
  });

  it("recognizes service throttling and common network failures", () => {
    expect(retry.isTransientExtensionServiceError({ stderr: "Server returned 429" })).toBe(true);
    expect(retry.isTransientExtensionServiceError(new Error("read ECONNRESET"))).toBe(true);
    expect(retry.isTransientExtensionServiceError("Server returned 404")).toBe(false);
  });
});
