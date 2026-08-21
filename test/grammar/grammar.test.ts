import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { directives, globalOptions } from "@caddyfile/language-core";
import { describe, expect, it } from "vitest";
import { loadGrammar, tokenAt } from "./tokenize.js";

const root = resolve(import.meta.dirname, "../..");

describe("packaged Caddyfile grammar", () => {
  it("tokenizes the syntax developers use in real Caddyfiles", async () => {
    const grammar = await loadGrammar("source.caddyfile");
    const source = `{
  debug
}
(shared) {
  encode zstd gzip
}
&(api) {
  respond "api"
}
:{$PORT:8080} {
  @assets path /assets/*
  reverse_proxy @assets localhost:3000
  header +Cache-Control "public"
  redir / /some/#/path
  respond <<BODY
Hello {http.request.host}
BODY
}
`;
    expect(scopesAt(grammar, source, 1, "debug")).toContain(
      "support.type.property-name.global-option.caddyfile",
    );
    expect(scopesAt(grammar, source, 3, "(shared)")).toContain(
      "entity.name.function.snippet.caddyfile",
    );
    expect(scopesAt(grammar, source, 6, "&(api)")).toContain(
      "entity.name.function.route.caddyfile",
    );
    expect(scopesAt(grammar, source, 9, "{$PORT", 2)).toContain(
      "variable.other.environment.caddyfile",
    );
    expect(scopesAt(grammar, source, 9, ":")).toContain(
      "entity.name.namespace.site-address.caddyfile",
    );
    expect(scopesAt(grammar, source, 10, "@assets")).toContain("entity.name.tag.matcher.caddyfile");
    expect(scopesAt(grammar, source, 10, "path")).toContain("keyword.control.matcher.caddyfile");
    expect(scopesAt(grammar, source, 11, "reverse_proxy")).toContain(
      "keyword.control.directive.caddyfile",
    );
    expect(scopesAt(grammar, source, 11, "@assets")).toContain("variable.other.matcher.caddyfile");
    expect(scopesAt(grammar, source, 12, "+Cache-Control")).toContain(
      "keyword.operator.header.caddyfile",
    );
    expect(scopesAt(grammar, source, 13, "#")).not.toContain("comment.line.number-sign.caddyfile");
    expect(scopesAt(grammar, source, 14, "<<BODY")).toContain(
      "punctuation.definition.string.begin.caddyfile",
    );
    expect(scopesAt(grammar, source, 15, "Hello")).toContain("string.unquoted.heredoc.caddyfile");
    expect(scopesAt(grammar, source, 15, "{http", 2)).toContain(
      "variable.other.placeholder.caddyfile",
    );
  });

  it("injects Caddyfile highlighting into caddy and caddyfile Markdown fences", async () => {
    const grammar = await loadGrammar("source.caddyfile.markdown");
    for (const fence of ["caddy", "caddyfile"]) {
      const source = `\`\`\`${fence}\n:80 {\n  respond ok\n}\n\`\`\`\n`;
      expect(scopesAt(grammar, source, 2, "respond")).toContain(
        "keyword.control.directive.caddyfile",
      );
    }
  });

  it("switches Caddy adapter fixtures to JSON after the separator", async () => {
    const grammar = await loadGrammar("source.caddyfile.test");
    const source = ':80 {\n  respond "ok"\n}\n----------\n{"apps": {"http": true}}\n';
    expect(scopesAt(grammar, source, 1, "respond")).toContain(
      "keyword.control.directive.caddyfile",
    );
    expect(scopesAt(grammar, source, 4, '"apps"', 1)).toContain("string.quoted.double.json");
    expect(scopesAt(grammar, source, 4, "true")).toContain("constant.language.json");
  });

  it("keeps grammar registries synchronized with language metadata", async () => {
    const grammar = JSON.parse(
      await readFile(resolve(root, "syntaxes/caddyfile.tmLanguage.json"), "utf8"),
    ) as GrammarShape;
    const directivePattern = new RegExp(
      grammar.repository.directives.patterns[0]?.match ?? "",
      "u",
    );
    const optionPattern = new RegExp(
      grammar.repository.globalOptionLine.patterns[0]?.match ?? "",
      "u",
    );
    for (const { name } of directives) expect(directivePattern.test(name + " ")).toBe(true);
    for (const { name } of globalOptions) expect(optionPattern.test(name + " ")).toBe(true);
  });

  it("uses VS Code's current line-comment configuration shape", async () => {
    const configuration = JSON.parse(
      await readFile(resolve(root, "language-configuration.json"), "utf8"),
    ) as LanguageConfiguration;
    expect(configuration.comments.lineComment).toEqual({
      comment: "#",
      noIndent: false,
    });
  });
});

function scopesAt(
  grammar: Awaited<ReturnType<typeof loadGrammar>>,
  source: string,
  line: number,
  needle: string,
  relativeCharacter = 0,
): readonly string[] {
  const text = source.split("\n")[line] ?? "";
  return tokenAt(grammar, source, line, text.indexOf(needle) + relativeCharacter).scopes;
}

interface GrammarShape {
  readonly repository: {
    readonly directives: {
      readonly patterns: readonly Readonly<{ readonly match?: string }>[];
    };
    readonly globalOptionLine: {
      readonly patterns: readonly Readonly<{ readonly match?: string }>[];
    };
  };
}

interface LanguageConfiguration {
  readonly comments: {
    readonly lineComment: {
      readonly comment: string;
      readonly noIndent: boolean;
    };
  };
}
