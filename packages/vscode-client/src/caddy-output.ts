export interface CaddyOutputMessage {
  readonly character: number;
  readonly line: number;
  readonly message: string;
  readonly severity: "error" | "warning";
}

export function parseCaddyOutput(
  stdout: string,
  stderr: string,
  lineCount: number,
): readonly CaddyOutputMessage[] {
  const output = `${stderr}\n${stdout}`.trim();
  if (output === "") return [];
  const lines = output
    .split(/\r\n|\n|\r/gu)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 200);
  return lines.map((line) => {
    const location = /(?:^|[\s'"])(?:-|[^\s:'"]+):(\d+)(?::(\d+))?(?=$|[\s:'",)}-])/u.exec(line);
    const reportedLine = Number(location?.[1] ?? 1);
    const reportedCharacter = Number(location?.[2] ?? 1);
    return {
      character: Math.max(0, reportedCharacter - 1),
      line: Math.max(0, Math.min(Math.max(0, lineCount - 1), reportedLine - 1)),
      message: safeOutputMessage(line),
      severity: /(?:^|\W)warning(?:\W|$)/iu.test(line) ? "warning" : "error",
    };
  });
}

export function caddyResultSummary(
  result: Readonly<{
    readonly exitCode: number | null;
    readonly stderr: string;
    readonly stdout: string;
    readonly timedOut: boolean;
    readonly truncated: boolean;
  }>,
  label = "Caddy",
): string {
  if (result.timedOut) return `${label} timed out after 10 seconds.`;
  if (result.truncated) return `${label} exceeded the 256 KiB output limit.`;
  const output = `${result.stderr}\n${result.stdout}`.trim();
  if (output !== "") return safeOutputMessage(output.split(/\r\n|\n|\r/u)[0] ?? output);
  return `${label} exited with code ${String(result.exitCode ?? "unknown")}.`;
}

function safeOutputMessage(value: string): string {
  const jsonMessage = /"msg":"((?:\\.|[^"\\])*)"/u.exec(value)?.[1];
  const selected =
    jsonMessage === undefined
      ? value
      : jsonMessage.replace(/\\(["\\/])/gu, "$1").replace(/\\n/gu, " ");
  return selected.replace(/[\r\n\0]+/gu, " ").slice(0, 500);
}
