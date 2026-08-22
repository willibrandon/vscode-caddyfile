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

  it("covers the applicable upstream syntax regressions", async () => {
    const grammar = await loadGrammar("source.caddyfile");

    const singleSite = `localhost
root * src
file_server
reverse_proxy /api/* 127.0.0.1:4444
`;
    expect(scopesAt(grammar, singleSite, 1, "root")).toContain(
      "keyword.control.directive.caddyfile",
    );
    expect(scopesAt(grammar, singleSite, 3, "127.0.0.1")).toContain(
      "constant.numeric.ipv4.caddyfile",
    );

    const addresses = `https://one.example {
  handle_path /assets/* {
    file_server
  }
}
https://two.example {
  reverse_proxy @api http://[2001:db8::1]:3000
}
`;
    expect(scopesAt(grammar, addresses, 5, "https://two.example")).toContain(
      "entity.name.namespace.site-address.caddyfile",
    );
    expect(scopesAt(grammar, addresses, 6, "reverse_proxy")).toContain(
      "keyword.control.directive.caddyfile",
    );
    expect(scopesAt(grammar, addresses, 6, "@api")).toContain("variable.other.matcher.caddyfile");
    expect(scopesAt(grammar, addresses, 6, "[2001:db8::1]")).toContain(
      "constant.numeric.ipv6.caddyfile",
    );

    const contentTypes = `(encode) {
  encode {
    match {
      header Content-Type text/*
    }
  }
}
:80 {
  respond ok
}
`;
    expect(
      scopesAt(grammar, contentTypes, 3, "text/*").some((scope) => scope.startsWith("comment.")),
    ).toBe(false);
    expect(scopesAt(grammar, contentTypes, 8, "respond")).toContain(
      "keyword.control.directive.caddyfile",
    );

    const escapedQuotes = String.raw`example.com {
  respond "\"hello"
  map x y {
    default "unknown domain" \"""
  }
  respond ok
}
`;
    expect(scopesAt(grammar, escapedQuotes, 1, String.raw`\"`)).toContain(
      "constant.character.escape.caddyfile",
    );
    expect(scopesAt(grammar, escapedQuotes, 3, String.raw`\"`)).toContain(
      "constant.character.escape.caddyfile",
    );
    expect(scopesAt(grammar, escapedQuotes, 5, "respond")).toContain(
      "keyword.control.directive.caddyfile",
    );

    const variables = `{$DOMAIN:localhost} {
  import block {args[0]} {block[1]}
  header +One value
  header -Two
  header ?Three value
  header >Four value
}
`;
    expect(scopesAt(grammar, variables, 0, "{$DOMAIN")).toContain(
      "variable.other.environment.caddyfile",
    );
    expect(scopesAt(grammar, variables, 1, "{args[0]}")).toContain(
      "variable.other.placeholder.caddyfile",
    );
    expect(scopesAt(grammar, variables, 1, "{block[1]}")).toContain(
      "variable.other.placeholder.caddyfile",
    );
    const headerPlaceholder = `dotsider.dev {
  reverse_proxy localhost:5100 {
    header_up X-Forwarded-For {remote_host}
  }
}
`;
    expect(scopesAt(grammar, headerPlaceholder, 2, "X-Forwarded-For")).not.toContain(
      "entity.name.namespace.site-address.caddyfile",
    );
    expect(scopesAt(grammar, headerPlaceholder, 2, "{remote_host}")).toContain(
      "variable.other.placeholder.caddyfile",
    );
    const cel = '  @post expression `{http.request.method} == "POST"`';
    expect(scopesAt(grammar, cel + "\n", 0, "expression")).toContain(
      "keyword.control.matcher.caddyfile",
    );
    expect(scopesAt(grammar, cel + "\n", 0, "{http.request.method}")).toContain(
      "variable.other.placeholder.caddyfile",
    );
    for (const [line, operator] of [
      [2, "+One"],
      [3, "-Two"],
      [4, "?Three"],
      [5, ">Four"],
    ] as const) {
      expect(scopesAt(grammar, variables, line, operator)).toContain(
        "keyword.operator.header.caddyfile",
      );
    }
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
