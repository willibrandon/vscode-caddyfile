import { languageItemFor, languageItemsFor } from "./registry.js";
import type {
  CoreDiagnostic,
  CoreDiagnosticSeverity,
  LanguageItemKind,
  ParsedDocument,
} from "./types.js";

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
      const replacement = closestStandardName(statement.name, expected[0]);
      diagnostics.push({
        code: `unknown-${statement.kind}`,
        message:
          statement.kind === "directive"
            ? `'${statement.name}' is not included with standard Caddy. A custom module may provide it.${suggestion(replacement)}`
            : `'${statement.name}' is not a standard global option. A custom module may provide it.${suggestion(replacement)}`,
        ...(replacement === undefined ? {} : { replacement }),
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

function suggestion(replacement: string | undefined): string {
  return replacement === undefined ? "" : ` Did you mean '${replacement}'?`;
}

function closestStandardName(
  name: string,
  kind: Extract<LanguageItemKind, "directive" | "global-option">,
): string | undefined {
  if (name.length === 0 || name.length > 80) return undefined;
  const maximumDistance = name.length < 5 ? 1 : 2;
  let closest: string | undefined;
  let closestDistance = maximumDistance + 1;
  let tied = false;
  for (const item of languageItemsFor(kind)) {
    const distance = editDistance(name.toLocaleLowerCase(), item.name.toLocaleLowerCase());
    if (distance < closestDistance) {
      closest = item.name;
      closestDistance = distance;
      tied = false;
    } else if (distance === closestDistance) {
      tied = true;
    }
  }
  return closestDistance <= maximumDistance && !tied ? closest : undefined;
}

function editDistance(left: string, right: string): number {
  let previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    const current = [leftIndex];
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      current[rightIndex] = Math.min(
        (current[rightIndex - 1] ?? 0) + 1,
        (previous[rightIndex] ?? 0) + 1,
        (previous[rightIndex - 1] ?? 0) + (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1),
      );
    }
    previous = current;
  }
  return previous[right.length] ?? left.length;
}
