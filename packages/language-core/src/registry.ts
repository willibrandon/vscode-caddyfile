import type { LanguageItem, LanguageItemKind } from "./types.js";

const docs = "https://caddyserver.com/docs/caddyfile";

export const directives: readonly LanguageItem[] = [
  directive("abort", "Immediately abort the HTTP connection.", "abort [<matcher>]", "abort"),
  directive(
    "acme_server",
    "Serve an ACME server endpoint.",
    "acme_server [<matcher>]",
    "acme_server",
  ),
  directive(
    "basic_auth",
    "Require HTTP Basic Authentication.",
    "basic_auth [<matcher>] [<hash_algorithm>] { ... }",
    "basic_auth",
  ),
  directive(
    "basicauth",
    "Legacy name for basic_auth.",
    "basicauth [<matcher>] { ... }",
    "basic_auth",
    {
      replacement: "basic_auth",
      message: "Use basic_auth instead.",
    },
  ),
  directive(
    "bind",
    "Choose listener addresses and protocols.",
    "bind <addresses...> [{ ... }]",
    "bind",
  ),
  directive(
    "copy_response",
    "Copy a reverse proxy response into the current response.",
    "copy_response [<matcher>] [<status>]",
    "reverse_proxy",
  ),
  directive(
    "copy_response_headers",
    "Copy selected headers from a reverse proxy response.",
    "copy_response_headers [<matcher>] { ... }",
    "reverse_proxy",
  ),
  directive(
    "encode",
    "Encode responses with supported compression formats.",
    "encode [<matcher>] <formats...> [{ ... }]",
    "encode",
  ),
  directive(
    "error",
    "Raise an error for the current request.",
    "error [<matcher>] [<message>] [<status>]",
    "error",
  ),
  directive(
    "file_server",
    "Serve files from the configured site root.",
    "file_server [<matcher>] [browse] [{ ... }]",
    "file_server",
  ),
  directive(
    "forward_auth",
    "Delegate authentication to an HTTP service.",
    "forward_auth [<matcher>] <upstream> { ... }",
    "forward_auth",
  ),
  directive(
    "fs",
    "Select the filesystem used for request handling.",
    "fs [<matcher>] <module> [<args...>]",
    "fs",
  ),
  directive(
    "handle",
    "Group mutually exclusive request handlers.",
    "handle [<matcher>] { ... }",
    "handle",
  ),
  directive(
    "handle_errors",
    "Define routes that handle HTTP errors.",
    "handle_errors [<status...>] { ... }",
    "handle_errors",
  ),
  directive(
    "handle_path",
    "Handle a path prefix after stripping that prefix.",
    "handle_path <path_matcher> { ... }",
    "handle_path",
  ),
  directive(
    "header",
    "Set, add, delete, replace, or defer response headers.",
    "header [<matcher>] [defer] [<field> [<value>]] [{ ... }]",
    "header",
  ),
  directive(
    "import",
    "Include a snippet or another Caddyfile.",
    "import <pattern|snippet> [<args...>] [{ ... }]",
    "import",
  ),
  directive(
    "intercept",
    "Intercept and replace selected responses.",
    "intercept [<matcher>] { ... }",
    "intercept",
  ),
  directive("invoke", "Invoke a named route.", "invoke [<matcher>] <name>", "invoke"),
  directive("log", "Configure HTTP access logging.", "log [<name>] [{ ... }]", "log"),
  directive(
    "log_append",
    "Append a field to the access log.",
    "log_append [<matcher>] <key> <value>",
    "log_append",
  ),
  directive(
    "log_name",
    "Select one or more access loggers.",
    "log_name [<matcher>] <names...>",
    "log_name",
  ),
  directive(
    "log_skip",
    "Skip access logging for matching requests.",
    "log_skip [<matcher>]",
    "log_skip",
  ),
  directive("skip_log", "Legacy name for log_skip.", "skip_log [<matcher>]", "log_skip", {
    replacement: "log_skip",
    message: "Use log_skip instead.",
  }),
  directive(
    "map",
    "Map an input value to one or more output placeholders.",
    "map [<matcher>] <source> <destinations...> { ... }",
    "map",
  ),
  directive("method", "Change the request method.", "method [<matcher>] <method>", "method"),
  directive(
    "metrics",
    "Expose a Prometheus metrics endpoint.",
    "metrics [<matcher>] [<path>]",
    "metrics",
  ),
  directive(
    "php_fastcgi",
    "Proxy PHP requests to a FastCGI server.",
    "php_fastcgi [<matcher>] <upstream> [{ ... }]",
    "php_fastcgi",
  ),
  directive(
    "push",
    "Configure HTTP/2 server push.",
    "push [<matcher>] [<resources...>] [{ ... }]",
    "push",
  ),
  directive(
    "redir",
    "Redirect requests to another location.",
    "redir [<matcher>] <to> [<code>]",
    "redir",
  ),
  directive(
    "request_body",
    "Apply limits or transformations to request bodies.",
    "request_body [<matcher>] { ... }",
    "request_body",
  ),
  directive(
    "request_header",
    "Set, delete, or replace request headers.",
    "request_header [<matcher>] <field> [<value>]",
    "request_header",
  ),
  directive(
    "respond",
    "Write a static response.",
    "respond [<matcher>] [<body>] [<status>] [{ ... }]",
    "respond",
  ),
  directive(
    "reverse_proxy",
    "Proxy requests to one or more upstream servers.",
    "reverse_proxy [<matcher>] [<upstreams...>] [{ ... }]",
    "reverse_proxy",
  ),
  directive("rewrite", "Rewrite the request URI.", "rewrite [<matcher>] <to>", "rewrite"),
  directive(
    "root",
    "Set the site root used by file-related directives.",
    "root [<matcher>] <path>",
    "root",
  ),
  directive(
    "route",
    "Evaluate enclosed directives in literal order.",
    "route [<matcher>] { ... }",
    "route",
  ),
  directive(
    "templates",
    "Render response bodies as templates.",
    "templates [<matcher>] [{ ... }]",
    "templates",
  ),
  directive(
    "tls",
    "Configure TLS certificates and automation for a site.",
    "tls [<email>|internal|force_automate|<cert> <key>] [{ ... }]",
    "tls",
  ),
  directive(
    "tracing",
    "Add distributed tracing to matching requests.",
    "tracing [<matcher>] [{ ... }]",
    "tracing",
  ),
  directive(
    "try_files",
    "Rewrite to the first matching file candidate.",
    "try_files [<matcher>] <files...> [{ ... }]",
    "try_files",
  ),
  directive(
    "uri",
    "Manipulate the request URI.",
    "uri [<matcher>] <strip_prefix|strip_suffix|replace|path_regexp> <args...>",
    "uri",
  ),
  directive(
    "vars",
    "Set request-scoped variables and placeholders.",
    "vars [<matcher>] [<key> <value>] [{ ... }]",
    "vars",
  ),
];

export const globalOptions: readonly LanguageItem[] = [
  option(
    "acme_ca",
    "Set the default ACME certificate authority endpoint.",
    "acme_ca <directory_url>",
  ),
  option("acme_ca_root", "Trust a custom ACME CA root certificate.", "acme_ca_root <pem_file>"),
  option(
    "acme_dns",
    "Set the default ACME DNS challenge provider.",
    "acme_dns <provider> [<args...>]",
  ),
  option(
    "acme_eab",
    "Configure ACME External Account Binding.",
    "acme_eab { key_id <id>; mac_key <key> }",
  ),
  option("admin", "Configure or disable Caddy's admin endpoint.", "admin <address|off> [{ ... }]"),
  option(
    "auto_https",
    "Control automatic HTTPS behavior.",
    "auto_https <off|disable_redirects|disable_certs|ignore_loaded_certs|prefer_wildcard>",
  ),
  option(
    "cert_issuer",
    "Set the default certificate issuer module.",
    "cert_issuer <module> [<args...>]",
  ),
  option(
    "cert_lifetime",
    "Set the lifetime of internally issued certificates.",
    "cert_lifetime <duration>",
  ),
  option("debug", "Enable debug-level logging.", "debug"),
  option("default_bind", "Set default listener bind addresses.", "default_bind <addresses...>"),
  option("default_sni", "Set the default TLS Server Name Indication value.", "default_sni <name>"),
  option(
    "dns",
    "Set a default DNS provider for certificate automation.",
    "dns <provider> [<args...>]",
  ),
  option("ech", "Configure Encrypted ClientHello publication.", "ech { ... }"),
  option("email", "Set the default ACME account email.", "email <address>"),
  option("events", "Configure global event handlers.", "events { ... }"),
  option(
    "fallback_sni",
    "Set the fallback TLS Server Name Indication value.",
    "fallback_sni <name>",
  ),
  option(
    "filesystem",
    "Declare a named filesystem module.",
    "filesystem <name> <module> [<args...>]",
  ),
  option("grace_period", "Set the graceful shutdown duration.", "grace_period <duration>"),
  option("http_port", "Set the internal HTTP port.", "http_port <port>"),
  option("https_port", "Set the internal HTTPS port.", "https_port <port>"),
  option(
    "key_type",
    "Set the default certificate key type.",
    "key_type <p256|p384|ed25519|rsa2048|rsa4096>",
  ),
  option("local_certs", "Issue certificates from Caddy's local CA by default.", "local_certs"),
  option("log", "Configure Caddy process logs.", "log [<name>] { ... }"),
  option("metrics", "Configure global metrics behavior.", "metrics { ... }"),
  option("ocsp_interval", "Set how often OCSP staples are refreshed.", "ocsp_interval <duration>"),
  option(
    "ocsp_stapling",
    "Configure OCSP stapling behavior.",
    "ocsp_stapling <off|responder_urls...>",
  ),
  option(
    "on_demand_tls",
    "Configure global on-demand TLS safeguards.",
    "on_demand_tls { ask <endpoint> }",
  ),
  option(
    "order",
    "Change HTTP directive ordering.",
    "order <directive> <first|last|before|after> [<other>]",
  ),
  option(
    "persist_config",
    "Control persistence of the active configuration.",
    "persist_config <on|off>",
  ),
  option("pki", "Configure Caddy's public key infrastructure app.", "pki { ... }"),
  option("preferred_chains", "Set preferred certificate chains.", "preferred_chains { ... }"),
  option(
    "renew_interval",
    "Set how often certificate renewal is checked.",
    "renew_interval <duration>",
  ),
  option(
    "renewal_window_ratio",
    "Set the certificate renewal window ratio.",
    "renewal_window_ratio <ratio>",
  ),
  option(
    "servers",
    "Configure HTTP server listener behavior.",
    "servers [<listener_address>] { ... }",
  ),
  option("shutdown_delay", "Delay shutdown after stopping listeners.", "shutdown_delay <duration>"),
  option(
    "skip_install_trust",
    "Do not install Caddy's local CA into trust stores.",
    "skip_install_trust",
  ),
  option("storage", "Configure the certificate storage module.", "storage <module> [<args...>]"),
  option("storage_check", "Configure storage health checks.", "storage_check <off|duration>"),
  option(
    "storage_clean_interval",
    "Set the storage cleanup interval.",
    "storage_clean_interval <duration>",
  ),
  option(
    "tls_resolvers",
    "Set DNS resolvers used during TLS handshakes.",
    "tls_resolvers <addresses...>",
  ),
];

export const matchers: readonly LanguageItem[] = [
  matcher("client_ip", "Match the direct client's IP address.", "client_ip <ranges...>"),
  matcher("expression", "Match a CEL expression.", "expression <cel_expression>"),
  matcher("file", "Match requests that map to files.", "file [<paths...>] [{ ... }]"),
  matcher("header", "Match request header fields.", "header <field> [<values...>]"),
  matcher(
    "header_regexp",
    "Match a request header with a regular expression.",
    "header_regexp [<name>] <field> <regexp>",
  ),
  matcher("host", "Match request hostnames.", "host <hosts...>"),
  matcher("method", "Match HTTP request methods.", "method <methods...>"),
  matcher("not", "Negate one or more matcher sets.", "not <matcher> [<args...>] | not { ... }"),
  matcher("path", "Match request paths.", "path <paths...>"),
  matcher(
    "path_regexp",
    "Match a request path with a regular expression.",
    "path_regexp [<name>] <regexp>",
  ),
  matcher(
    "protocol",
    "Match the request protocol.",
    "protocol <http|https|grpc|http/1.1|http/2|http/3>",
  ),
  matcher("query", "Match URL query parameters.", "query <key> [<values...>]"),
  matcher(
    "remote_ip",
    "Match the apparent remote IP address.",
    "remote_ip [forwarded] <ranges...>",
  ),
  matcher("tls", "Match TLS properties such as client certificates.", "tls { ... }"),
  matcher("vars", "Match request-scoped variables.", "vars <key> <values...>"),
  matcher(
    "vars_regexp",
    "Match a variable with a regular expression.",
    "vars_regexp [<name>] <key> <regexp>",
  ),
];

export const subdirectives: readonly LanguageItem[] = [
  subdirective("to", "Add reverse proxy upstream addresses.", "to <upstreams...>", [
    "reverse_proxy",
  ]),
  subdirective(
    "transport",
    "Configure the reverse proxy transport.",
    "transport <module> { ... }",
    ["reverse_proxy"],
  ),
  subdirective(
    "lb_policy",
    "Select the reverse proxy load balancing policy.",
    "lb_policy <policy> [<args...>]",
    ["reverse_proxy"],
  ),
  subdirective("health_uri", "Set the active health check URI.", "health_uri <uri>", [
    "reverse_proxy",
  ]),
  subdirective(
    "health_interval",
    "Set the active health check interval.",
    "health_interval <duration>",
    ["reverse_proxy"],
  ),
  subdirective(
    "header_up",
    "Change a request header sent upstream.",
    "header_up <field> [<value>]",
    ["reverse_proxy"],
  ),
  subdirective(
    "header_down",
    "Change a response header received downstream.",
    "header_down <field> [<value>]",
    ["reverse_proxy"],
  ),
  subdirective(
    "handle_response",
    "Handle selected upstream responses.",
    "handle_response [<matcher>] { ... }",
    ["reverse_proxy"],
  ),
  subdirective("browse", "Enable a directory listing.", "browse [<template_file>]", [
    "file_server",
  ]),
  subdirective("hide", "Hide matching files from file listings and responses.", "hide <files...>", [
    "file_server",
  ]),
  subdirective(
    "precompressed",
    "Serve precompressed file sidecars.",
    "precompressed <formats...>",
    ["file_server"],
  ),
  subdirective("pass_thru", "Continue the route when a file is not found.", "pass_thru", [
    "file_server",
  ]),
  subdirective(
    "protocols",
    "Set minimum and optional maximum TLS versions.",
    "protocols <min> [<max>]",
    ["tls"],
  ),
  subdirective("issuer", "Configure a certificate issuer.", "issuer <module> [<args...>]", ["tls"]),
  subdirective("client_auth", "Configure TLS client authentication.", "client_auth { ... }", [
    "tls",
  ]),
  subdirective("output", "Configure a log output module.", "output <module> [<args...>]", ["log"]),
  subdirective("format", "Configure a log encoder module.", "format <module> [<args...>]", ["log"]),
  subdirective("level", "Set the minimum log level.", "level <level>", ["log"]),
  subdirective("include", "Include logger namespaces.", "include <namespaces...>", ["log"]),
  subdirective("exclude", "Exclude logger namespaces.", "exclude <namespaces...>", ["log"]),
  subdirective("max_size", "Set the maximum request body size.", "max_size <size>", [
    "request_body",
  ]),
  subdirective("set", "Replace a request body with fixed content.", "set <body>", ["request_body"]),
];

export const allLanguageItems: readonly LanguageItem[] = [
  ...directives,
  ...globalOptions,
  ...matchers,
  ...subdirectives,
];

export function languageItemFor(
  name: string,
  kinds?: readonly LanguageItemKind[],
): LanguageItem | undefined {
  return allLanguageItems.find(
    (item) => item.name === name && (kinds === undefined || kinds.includes(item.kind)),
  );
}

export function languageItemsFor(kind: LanguageItemKind): readonly LanguageItem[] {
  return allLanguageItems.filter((item) => item.kind === kind);
}

function directive(
  name: string,
  summary: string,
  syntax: string,
  page: string,
  deprecated?: Readonly<{ readonly replacement: string; readonly message: string }>,
): LanguageItem {
  return withDeprecated(
    { kind: "directive", name, summary, syntax, url: `${docs}/directives/${page}` },
    deprecated,
  );
}

function option(name: string, summary: string, syntax: string): LanguageItem {
  return { kind: "global-option", name, summary, syntax, url: `${docs}/options#${name}` };
}

function matcher(name: string, summary: string, syntax: string): LanguageItem {
  return { kind: "matcher", name, summary, syntax, url: `${docs}/matchers#${name}` };
}

function subdirective(
  name: string,
  summary: string,
  syntax: string,
  parents: readonly string[],
): LanguageItem {
  return {
    kind: "subdirective",
    name,
    parents,
    summary,
    syntax,
    url: `${docs}/directives/${parents[0]}`,
  };
}

function withDeprecated(
  item: LanguageItem,
  deprecated: Readonly<{ readonly replacement: string; readonly message: string }> | undefined,
): LanguageItem {
  return deprecated === undefined ? item : { ...item, deprecated };
}
