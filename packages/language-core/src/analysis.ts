import { languageItemFor } from "./registry.js";
import type { CoreDiagnostic, CoreDiagnosticSeverity, ParsedDocument } from "./types.js";

export interface AnalysisOptions {
  readonly maxProblems?: number;
  readonly unknownItems?: "off" | "hint" | "warning";
}

export function analyzeCaddyfile(
  document: ParsedDocument,
  options: AnalysisOptions = {},
): readonly CoreDiagnostic[] {
  const diagnostics: CoreDiagnostic[] = [...document.diagnostics];
  const unknown = options.unknownItems ?? "hint";
  for (const statement of document.statements) {
    const expected =
      statement.kind === "global-option"
        ? (["global-option"] as const)
        : statement.kind === "directive"
          ? (["directive"] as const)
          : undefined;
    if (expected === undefined) continue;
    const item = languageItemFor(statement.name, expected);
    if (item === undefined && unknown !== "off") {
      diagnostics.push({
        code: `unknown-${statement.kind}`,
        message:
          statement.kind === "directive"
            ? `'${statement.name}' is not included with standard Caddy. A custom module may provide it.`
            : `'${statement.name}' is not a standard global option. A custom module may provide it.`,
        severity: unknownSeverity(unknown),
        span: statement.nameSpan,
      });
    } else if (item?.deprecated !== undefined) {
      diagnostics.push({
        code: "deprecated-item",
        message: item.deprecated.message,
        severity: "warning",
        span: statement.nameSpan,
      });
    }
  }
  return diagnostics.slice(0, options.maxProblems ?? 200);
}

function unknownSeverity(value: "hint" | "warning"): CoreDiagnosticSeverity {
  return value;
}
