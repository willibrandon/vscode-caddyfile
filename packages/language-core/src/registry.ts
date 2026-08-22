import type { LanguageItem, LanguageItemKind, LanguageValue } from "./types.js";

interface ValueGuidance {
  readonly values: readonly LanguageValue[];
  readonly valueArgument?: number;
  readonly repeatValues?: boolean;
}

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
    undefined,
    guidance([
      value("strip_prefix", "Remove a prefix from the request path."),
      value("strip_suffix", "Remove a suffix from the request path."),
      value("replace", "Replace matching URI text."),
      value("path_regexp", "Replace request path text matched by a regular expression."),
    ]),
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
    "auto_https <off|disable_redirects|disable_certs|ignore_loaded_certs...>",
    guidance(
      [
        value("off", "Disable automatic HTTPS."),
        value("disable_redirects", "Keep certificate automation but disable HTTP redirects."),
        value("disable_certs", "Disable automatic certificate management."),
        value(
          "ignore_loaded_certs",
          "Automate certificates even when matching certificates are loaded.",
        ),
      ],
      0,
      true,
    ),
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
    guidance([
      value("p256", "Use an ECDSA P-256 key."),
      value("p384", "Use an ECDSA P-384 key."),
      value("ed25519", "Use an Ed25519 key."),
      value("rsa2048", "Use a 2048-bit RSA key."),
      value("rsa4096", "Use a 4096-bit RSA key."),
    ]),
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
    guidance(
      [
        value("first", "Place the directive first in the default order."),
        value("last", "Place the directive last in the default order."),
        value("before", "Place the directive before another directive."),
        value("after", "Place the directive after another directive."),
      ],
      1,
    ),
  ),
  option(
    "persist_config",
    "Disable persistence of the active configuration.",
    "persist_config off",
    guidance([value("off", "Keep the active configuration only in memory.")]),
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
    guidance([
      value("http", "Match HTTP requests."),
      value("https", "Match HTTPS requests."),
      value("grpc", "Match gRPC requests."),
      value("http/1.1", "Match HTTP/1.1 requests."),
      value("http/2", "Match HTTP/2 requests."),
      value("http/3", "Match HTTP/3 requests."),
    ]),
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
  subdirective("dynamic", "Configure dynamic upstream discovery.", "dynamic <module> { ... }", [
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
  subdirective("lb_retries", "Set the number of load balancing retries.", "lb_retries <count>", [
    "reverse_proxy",
  ]),
  subdirective(
    "lb_try_duration",
    "Limit how long load balancing retries may continue.",
    "lb_try_duration <duration>",
    ["reverse_proxy"],
  ),
  subdirective(
    "lb_try_interval",
    "Set the delay between load balancing retries.",
    "lb_try_interval <duration>",
    ["reverse_proxy"],
  ),
  subdirective(
    "lb_retry_match",
    "Retry requests that match the enclosed request matchers.",
    "lb_retry_match { ... }",
    ["reverse_proxy"],
  ),
  subdirective("health_uri", "Set the active health check URI.", "health_uri <uri>", [
    "reverse_proxy",
  ]),
  subdirective(
    "health_upstream",
    "Override the active health check address.",
    "health_upstream <address>",
    ["reverse_proxy"],
  ),
  subdirective("health_port", "Override the active health check port.", "health_port <port>", [
    "reverse_proxy",
  ]),
  subdirective(
    "health_interval",
    "Set the active health check interval.",
    "health_interval <duration>",
    ["reverse_proxy"],
  ),
  subdirective(
    "health_timeout",
    "Set the active health check timeout.",
    "health_timeout <duration>",
    ["reverse_proxy"],
  ),
  subdirective(
    "health_status",
    "Set the expected active health check status.",
    "health_status <status>",
    ["reverse_proxy"],
  ),
  subdirective(
    "health_method",
    "Set the active health check HTTP method.",
    "health_method <method>",
    ["reverse_proxy"],
  ),
  subdirective(
    "health_request_body",
    "Set the active health check request body.",
    "health_request_body <body>",
    ["reverse_proxy"],
  ),
  subdirective(
    "health_body",
    "Require text in active health check responses.",
    "health_body <regexp>",
    ["reverse_proxy"],
  ),
  subdirective(
    "health_follow_redirects",
    "Follow redirects during active health checks.",
    "health_follow_redirects",
    ["reverse_proxy"],
  ),
  subdirective(
    "health_passes",
    "Set passes required to mark an upstream healthy.",
    "health_passes <count>",
    ["reverse_proxy"],
  ),
  subdirective(
    "health_fails",
    "Set failures required to mark an upstream unhealthy.",
    "health_fails <count>",
    ["reverse_proxy"],
  ),
  subdirective(
    "fail_duration",
    "Set the passive health check failure window.",
    "fail_duration <duration>",
    ["reverse_proxy"],
  ),
  subdirective(
    "max_fails",
    "Set failures allowed during the passive health window.",
    "max_fails <count>",
    ["reverse_proxy"],
  ),
  subdirective(
    "unhealthy_status",
    "Mark selected response statuses as upstream failures.",
    "unhealthy_status <statuses...>",
    ["reverse_proxy"],
  ),
  subdirective(
    "unhealthy_latency",
    "Mark slow upstream responses as failures.",
    "unhealthy_latency <duration>",
    ["reverse_proxy"],
  ),
  subdirective(
    "unhealthy_request_count",
    "Limit concurrent requests to each upstream.",
    "unhealthy_request_count <count>",
    ["reverse_proxy"],
  ),
  subdirective(
    "flush_interval",
    "Control response flushing to clients.",
    "flush_interval <duration>",
    ["reverse_proxy"],
  ),
  subdirective("request_buffers", "Set the request buffer size.", "request_buffers <size>", [
    "reverse_proxy",
  ]),
  subdirective("response_buffers", "Set the response buffer size.", "response_buffers <size>", [
    "reverse_proxy",
  ]),
  subdirective("stream_timeout", "Set a maximum streaming duration.", "stream_timeout <duration>", [
    "reverse_proxy",
  ]),
  subdirective(
    "stream_close_delay",
    "Delay closing streams after configuration changes.",
    "stream_close_delay <duration>",
    ["reverse_proxy"],
  ),
  subdirective(
    "trusted_proxies",
    "Configure trusted proxy address sources.",
    "trusted_proxies <module> [<args...>]",
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
  subdirective("method", "Change the method sent upstream.", "method <method>", ["reverse_proxy"]),
  subdirective("rewrite", "Rewrite the URI sent upstream.", "rewrite <uri>", ["reverse_proxy"]),
  subdirective(
    "handle_response",
    "Handle selected upstream responses.",
    "handle_response [<matcher>] { ... }",
    ["reverse_proxy"],
  ),
  subdirective(
    "replace_status",
    "Replace a selected upstream response status.",
    "replace_status <status>",
    ["reverse_proxy", "intercept"],
  ),
  subdirective("gzip", "Configure the gzip response encoder.", "gzip [<level>]", ["encode"]),
  subdirective("zstd", "Configure the Zstandard response encoder.", "zstd [<level>]", ["encode"]),
  subdirective(
    "minimum_length",
    "Set the smallest response eligible for encoding.",
    "minimum_length <bytes>",
    ["encode"],
  ),
  subdirective("match", "Select responses eligible for encoding.", "match { ... }", ["encode"]),
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
  subdirective("fs", "Select the filesystem implementation.", "fs <module> [<args...>]", [
    "file_server",
  ]),
  subdirective("root", "Set the root used by the enclosing handler.", "root <path>", [
    "file_server",
    "php_fastcgi",
    "templates",
  ]),
  subdirective("index", "Set index file names.", "index <files...>", [
    "file_server",
    "php_fastcgi",
  ]),
  subdirective("status", "Override the file server response status.", "status <status>", [
    "file_server",
  ]),
  subdirective(
    "disable_canonical_uris",
    "Disable canonical URI redirects.",
    "disable_canonical_uris",
    ["file_server"],
  ),
  subdirective(
    "protocols",
    "Set minimum and optional maximum TLS versions.",
    "protocols <min> [<max>]",
    ["tls"],
    guidance(
      [
        value("tls1.0", "Use TLS 1.0 at this boundary."),
        value("tls1.1", "Use TLS 1.1 at this boundary."),
        value("tls1.2", "Use TLS 1.2 at this boundary."),
        value("tls1.3", "Use TLS 1.3 at this boundary."),
      ],
      0,
      true,
    ),
  ),
  subdirective("ciphers", "Select TLS cipher suites.", "ciphers <suites...>", ["tls"]),
  subdirective("curves", "Select TLS key exchange curves.", "curves <curves...>", ["tls"]),
  subdirective("alpn", "Set advertised application protocols.", "alpn <protocols...>", ["tls"]),
  subdirective("load", "Load certificate files from a folder.", "load <folder>", ["tls"]),
  subdirective("ca", "Set the ACME certificate authority endpoint.", "ca <directory_url>", ["tls"]),
  subdirective("ca_root", "Trust an ACME CA root certificate.", "ca_root <pem_file>", ["tls"]),
  subdirective("dns", "Configure a DNS challenge provider.", "dns <provider> [<args...>]", ["tls"]),
  subdirective(
    "propagation_timeout",
    "Set the DNS challenge propagation timeout.",
    "propagation_timeout <duration>",
    ["tls"],
  ),
  subdirective(
    "propagation_delay",
    "Delay DNS challenge propagation checks.",
    "propagation_delay <duration>",
    ["tls"],
  ),
  subdirective("dns_ttl", "Set the DNS challenge record TTL.", "dns_ttl <duration>", ["tls"]),
  subdirective(
    "dns_challenge_override_domain",
    "Delegate DNS challenge records to another domain.",
    "dns_challenge_override_domain <domain>",
    ["tls"],
  ),
  subdirective(
    "resolvers",
    "Set DNS resolvers for certificate challenges.",
    "resolvers <addresses...>",
    ["tls", "acme_server"],
  ),
  subdirective("eab", "Set ACME External Account Binding credentials.", "eab <key_id> <mac_key>", [
    "tls",
  ]),
  subdirective("on_demand", "Enable on-demand certificate management.", "on_demand", ["tls"]),
  subdirective(
    "reuse_private_keys",
    "Reuse private keys when renewing certificates.",
    "reuse_private_keys",
    ["tls"],
  ),
  subdirective("issuer", "Configure a certificate issuer.", "issuer <module> [<args...>]", ["tls"]),
  subdirective("client_auth", "Configure TLS client authentication.", "client_auth { ... }", [
    "tls",
  ]),
  subdirective(
    "get_certificate",
    "Configure an external certificate manager.",
    "get_certificate <module> [<args...>]",
    ["tls"],
  ),
  subdirective(
    "insecure_secrets_log",
    "Write TLS session secrets for debugging.",
    "insecure_secrets_log <file>",
    ["tls"],
  ),
  subdirective(
    "renewal_window_ratio",
    "Set the certificate renewal window ratio for this site.",
    "renewal_window_ratio <ratio>",
    ["tls"],
  ),
  subdirective("force_automate", "Force automated certificate management.", "force_automate", [
    "tls",
  ]),
  subdirective("hostnames", "Restrict an access log to hostnames.", "hostnames <hosts...>", [
    "directive:log",
  ]),
  subdirective("no_hostname", "Disable automatic hostname association.", "no_hostname", [
    "directive:log",
  ]),
  subdirective("output", "Configure a log output module.", "output <module> [<args...>]", [
    "directive:log",
    "global-option:log",
  ]),
  subdirective("format", "Configure a log encoder module.", "format <module> [<args...>]", [
    "directive:log",
    "global-option:log",
  ]),
  subdirective(
    "level",
    "Set the minimum log level.",
    "level <DEBUG|INFO|WARN|ERROR>",
    ["directive:log", "global-option:log"],
    guidance([
      value("DEBUG", "Include debug, informational, warning, and error entries."),
      value("INFO", "Include informational, warning, and error entries."),
      value("WARN", "Include warning and error entries."),
      value("ERROR", "Include error entries."),
    ]),
  ),
  subdirective("include", "Include logger namespaces.", "include <namespaces...>", [
    "global-option:log",
  ]),
  subdirective("exclude", "Exclude logger namespaces.", "exclude <namespaces...>", [
    "global-option:log",
  ]),
  subdirective("sampling", "Configure access log entry sampling.", "sampling { ... }", [
    "directive:log",
  ]),
  subdirective("split", "Set the PHP path split expression.", "split <regexp>", ["php_fastcgi"]),
  subdirective("try_files", "Set PHP script path candidates.", "try_files <files...>", [
    "php_fastcgi",
  ]),
  subdirective("env", "Set an environment variable for FastCGI.", "env <key> <value>", [
    "php_fastcgi",
  ]),
  subdirective(
    "resolve_root_symlink",
    "Resolve the PHP root symlink before proxying.",
    "resolve_root_symlink",
    ["php_fastcgi"],
  ),
  subdirective("capture_stderr", "Write FastCGI stderr to the Caddy log.", "capture_stderr", [
    "php_fastcgi",
  ]),
  subdirective("dial_timeout", "Set the FastCGI dial timeout.", "dial_timeout <duration>", [
    "php_fastcgi",
  ]),
  subdirective("read_timeout", "Set the FastCGI read timeout.", "read_timeout <duration>", [
    "php_fastcgi",
  ]),
  subdirective("write_timeout", "Set the FastCGI write timeout.", "write_timeout <duration>", [
    "php_fastcgi",
  ]),
  subdirective("mime", "Select template response MIME types.", "mime <types...>", ["templates"]),
  subdirective("between", "Set template action delimiters.", "between <open> <close>", [
    "templates",
  ]),
  subdirective("uri", "Set the authentication request URI.", "uri <path>", ["forward_auth"]),
  subdirective(
    "copy_headers",
    "Copy selected authentication response headers.",
    "copy_headers <fields...>",
    ["forward_auth"],
  ),
  subdirective("max_size", "Set the maximum request body size.", "max_size <size>", [
    "request_body",
  ]),
  subdirective("set", "Replace a request body with fixed content.", "set <body>", ["request_body"]),
  subdirective("body", "Set the static response body.", "body <text>", ["respond"]),
  subdirective("close", "Close the connection after the static response.", "close", ["respond"]),
  subdirective("span", "Set the tracing span name.", "span <name>", ["tracing"]),
  subdirective("ca", "Select the ACME server certificate authority.", "ca <id>", ["acme_server"]),
  subdirective("lifetime", "Set issued certificate lifetimes.", "lifetime <duration>", [
    "acme_server",
  ]),
  subdirective("challenges", "Configure enabled ACME challenges.", "challenges <types...>", [
    "acme_server",
  ]),
  subdirective(
    "allow_wildcard_names",
    "Allow wildcard names in certificate requests.",
    "allow_wildcard_names",
    ["acme_server"],
  ),
  subdirective(
    "mode",
    "Set the TLS client authentication mode.",
    "mode <request|require|verify_if_given|require_and_verify>",
    ["client_auth"],
    guidance([
      value("request", "Request a client certificate without requiring one."),
      value("require", "Require a client certificate without verifying it."),
      value("verify_if_given", "Verify a client certificate when one is provided."),
      value("require_and_verify", "Require and verify a client certificate."),
    ]),
    "tls",
  ),
  subdirective(
    "trust_pool",
    "Configure trusted client certificate authorities.",
    "trust_pool <module> [<args...>]",
    ["client_auth"],
    undefined,
    "tls",
  ),
  subdirective(
    "versions",
    "Set HTTP transport protocol versions.",
    "versions <versions...>",
    ["transport"],
    guidance(
      [
        value("1.1", "Use HTTP/1.1 upstream."),
        value("2", "Use HTTP/2 upstream."),
        value("h2c", "Use cleartext HTTP/2 upstream."),
        value("3", "Use HTTP/3 upstream."),
      ],
      0,
      true,
    ),
    "reverse_proxy",
  ),
  subdirective(
    "tls",
    "Enable TLS for the HTTP transport.",
    "tls",
    ["transport"],
    undefined,
    "reverse_proxy",
  ),
  subdirective(
    "tls_server_name",
    "Set the upstream TLS server name.",
    "tls_server_name <name>",
    ["transport"],
    undefined,
    "reverse_proxy",
  ),
  subdirective(
    "tls_insecure_skip_verify",
    "Disable upstream TLS certificate verification.",
    "tls_insecure_skip_verify",
    ["transport"],
    undefined,
    "reverse_proxy",
  ),
  subdirective(
    "keepalive",
    "Configure HTTP transport keepalive behavior.",
    "keepalive <off|duration>",
    ["transport"],
    undefined,
    "reverse_proxy",
  ),
  subdirective(
    "keepalive_interval",
    "Set the upstream TCP keepalive interval.",
    "keepalive_interval <duration>",
    ["transport"],
    undefined,
    "reverse_proxy",
  ),
  subdirective(
    "keepalive_idle_conns",
    "Set the total upstream idle connection limit.",
    "keepalive_idle_conns <count>",
    ["transport"],
    undefined,
    "reverse_proxy",
  ),
  subdirective(
    "keepalive_idle_conns_per_host",
    "Set the idle connection limit for each upstream host.",
    "keepalive_idle_conns_per_host <count>",
    ["transport"],
    undefined,
    "reverse_proxy",
  ),
  subdirective(
    "dial_timeout",
    "Set the upstream connection timeout.",
    "dial_timeout <duration>",
    ["transport"],
    undefined,
    "reverse_proxy",
  ),
  subdirective(
    "response_header_timeout",
    "Limit the wait for upstream response headers.",
    "response_header_timeout <duration>",
    ["transport"],
    undefined,
    "reverse_proxy",
  ),
  subdirective(
    "expect_continue_timeout",
    "Limit the wait for an upstream 100 Continue response.",
    "expect_continue_timeout <duration>",
    ["transport"],
    undefined,
    "reverse_proxy",
  ),
  subdirective(
    "max_conns_per_host",
    "Limit connections to each upstream host.",
    "max_conns_per_host <count>",
    ["transport"],
    undefined,
    "reverse_proxy",
  ),
  subdirective(
    "proxy_protocol",
    "Send PROXY protocol headers upstream.",
    "proxy_protocol <v1|v2>",
    ["transport"],
    guidance([
      value("v1", "Send a PROXY protocol version 1 header."),
      value("v2", "Send a PROXY protocol version 2 header."),
    ]),
    "reverse_proxy",
  ),
  subdirective(
    "tls_trusted_ca_certs",
    "Trust custom certificate authority files upstream.",
    "tls_trusted_ca_certs <pem_files...>",
    ["transport"],
    undefined,
    "reverse_proxy",
  ),
  subdirective(
    "tls_client_auth",
    "Use a client certificate with the upstream.",
    "tls_client_auth <cert> <key>",
    ["transport"],
    undefined,
    "reverse_proxy",
  ),
  subdirective(
    "compression",
    "Control upstream response compression.",
    "compression <off>",
    ["transport"],
    undefined,
    "reverse_proxy",
  ),
  subdirective(
    "read_buffer",
    "Set the HTTP transport read buffer size.",
    "read_buffer <size>",
    ["transport"],
    undefined,
    "reverse_proxy",
  ),
  subdirective(
    "write_buffer",
    "Set the HTTP transport write buffer size.",
    "write_buffer <size>",
    ["transport"],
    undefined,
    "reverse_proxy",
  ),
  subdirective(
    "reveal_symlinks",
    "Show symlink targets in directory listings.",
    "reveal_symlinks",
    ["browse"],
    undefined,
    "file_server",
  ),
  subdirective(
    "sort",
    "Set directory listing sort order.",
    "sort <name|namedirfirst|size|time> [<asc|desc>]",
    ["browse"],
    guidance(
      [
        value("name", "Sort entries by name."),
        value("namedirfirst", "Sort directories first, then by name."),
        value("size", "Sort entries by size."),
        value("time", "Sort entries by modification time."),
        value("asc", "Sort in ascending order."),
        value("desc", "Sort in descending order."),
      ],
      0,
      true,
    ),
    "file_server",
  ),
  subdirective(
    "file_limit",
    "Limit entries shown in a directory listing.",
    "file_limit <count>",
    ["browse"],
    undefined,
    "file_server",
  ),
  subdirective("origins", "Set allowed admin API origins.", "origins <origins...>", [
    "global-option:admin",
  ]),
  subdirective(
    "enforce_origin",
    "Require an allowed Origin header for admin requests.",
    "enforce_origin",
    ["global-option:admin"],
  ),
  subdirective("key_id", "Set the ACME EAB key identifier.", "key_id <id>", [
    "global-option:acme_eab",
  ]),
  subdirective("mac_key", "Set the ACME EAB MAC key.", "mac_key <key>", ["global-option:acme_eab"]),
  subdirective("dns", "Configure ECH DNS publication.", "dns <provider> [<args...>]", [
    "global-option:ech",
  ]),
  subdirective(
    "ask",
    "Authorize on-demand certificate names through an endpoint.",
    "ask <endpoint>",
    ["global-option:on_demand_tls"],
  ),
  subdirective(
    "permission",
    "Authorize on-demand certificate names through a module.",
    "permission <module> [<args...>]",
    ["global-option:on_demand_tls"],
  ),
  subdirective(
    "root_common_name",
    "Prefer chains with a matching root common name.",
    "root_common_name <names...>",
    ["global-option:preferred_chains"],
  ),
  subdirective(
    "any_common_name",
    "Prefer chains containing a matching common name.",
    "any_common_name <names...>",
    ["global-option:preferred_chains"],
  ),
  subdirective("name", "Set the HTTP server name.", "name <name>", ["global-option:servers"]),
  subdirective(
    "listener_wrappers",
    "Configure HTTP listener wrappers.",
    "listener_wrappers { ... }",
    ["global-option:servers"],
  ),
  subdirective("timeouts", "Configure HTTP server timeouts.", "timeouts { ... }", [
    "global-option:servers",
  ]),
  subdirective(
    "keepalive_interval",
    "Set the HTTP connection keepalive interval.",
    "keepalive_interval <duration>",
    ["global-option:servers"],
  ),
  subdirective(
    "trusted_proxies",
    "Configure trusted client proxy sources.",
    "trusted_proxies <module> [<args...>]",
    ["global-option:servers"],
  ),
  subdirective(
    "trusted_proxies_strict",
    "Use strict trusted proxy parsing.",
    "trusted_proxies_strict",
    ["global-option:servers"],
  ),
  subdirective(
    "client_ip_headers",
    "Set headers used to determine client IP addresses.",
    "client_ip_headers <fields...>",
    ["global-option:servers"],
  ),
  subdirective(
    "max_header_size",
    "Set the maximum HTTP request header size.",
    "max_header_size <size>",
    ["global-option:servers"],
  ),
  subdirective(
    "enable_full_duplex",
    "Enable full-duplex HTTP/1 request handling.",
    "enable_full_duplex",
    ["global-option:servers"],
  ),
  subdirective("log_credentials", "Include request credentials in HTTP logs.", "log_credentials", [
    "global-option:servers",
  ]),
  subdirective(
    "protocols",
    "Set enabled HTTP server protocols.",
    "protocols <h1|h2|h2c|h3...>",
    ["global-option:servers"],
    guidance(
      [
        value("h1", "Enable HTTP/1."),
        value("h2", "Enable HTTP/2."),
        value("h2c", "Enable cleartext HTTP/2."),
        value("h3", "Enable HTTP/3."),
      ],
      0,
      true,
    ),
  ),
  subdirective(
    "strict_sni_host",
    "Require the TLS server name to match the HTTP Host header.",
    "strict_sni_host [<on|insecure_off>]",
    ["global-option:servers"],
    guidance([
      value("on", "Reject requests whose TLS server name and Host header differ."),
      value("insecure_off", "Disable strict SNI host checks with client authentication."),
    ]),
  ),
  subdirective(
    "keepalive_idle",
    "Set the idle time before TCP keepalive probes.",
    "keepalive_idle <duration>",
    ["global-option:servers"],
  ),
  subdirective(
    "keepalive_count",
    "Set the number of failed TCP keepalive probes allowed.",
    "keepalive_count <count>",
    ["global-option:servers"],
  ),
  subdirective("trace", "Log each HTTP handler invocation at debug level.", "trace", [
    "global-option:servers",
  ]),
  subdirective("per_host", "Label global metrics by host.", "per_host", ["global-option:metrics"]),
  subdirective(
    "observe_catchall_hosts",
    "Collect metrics for catch-all hosts.",
    "observe_catchall_hosts",
    ["global-option:metrics"],
  ),
  subdirective("otlp", "Configure OpenTelemetry metrics export.", "otlp { ... }", [
    "global-option:metrics",
  ]),
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
  valueGuidance?: ValueGuidance,
): LanguageItem {
  return withGuidance(
    withDeprecated(
      { kind: "directive", name, summary, syntax, url: `${docs}/directives/${page}` },
      deprecated,
    ),
    valueGuidance,
  );
}

function option(
  name: string,
  summary: string,
  syntax: string,
  valueGuidance?: ValueGuidance,
): LanguageItem {
  return withGuidance(
    { kind: "global-option", name, summary, syntax, url: `${docs}/options#${name}` },
    valueGuidance,
  );
}

function matcher(
  name: string,
  summary: string,
  syntax: string,
  valueGuidance?: ValueGuidance,
): LanguageItem {
  return withGuidance(
    { kind: "matcher", name, summary, syntax, url: `${docs}/matchers#${name}` },
    valueGuidance,
  );
}

function subdirective(
  name: string,
  summary: string,
  syntax: string,
  parents: readonly string[],
  valueGuidance?: ValueGuidance,
  page?: string,
): LanguageItem {
  const firstParent = parents[0] ?? "";
  const [parentKind, parentName = firstParent] = firstParent.split(":");
  const url =
    parentKind === "global-option"
      ? `${docs}/options#${parentName}`
      : `${docs}/directives/${page ?? parentName}`;
  return withGuidance(
    {
      kind: "subdirective",
      name,
      parents,
      summary,
      syntax,
      url,
    },
    valueGuidance,
  );
}

function value(name: string, summary: string): LanguageValue {
  return { name, summary };
}

function guidance(
  values: readonly LanguageValue[],
  valueArgument?: number,
  repeatValues?: boolean,
): ValueGuidance {
  return {
    ...(repeatValues === undefined ? {} : { repeatValues }),
    ...(valueArgument === undefined ? {} : { valueArgument }),
    values,
  };
}

function withGuidance(item: LanguageItem, valueGuidance: ValueGuidance | undefined): LanguageItem {
  return valueGuidance === undefined ? item : { ...item, ...valueGuidance };
}

function withDeprecated(
  item: LanguageItem,
  deprecated: Readonly<{ readonly replacement: string; readonly message: string }> | undefined,
): LanguageItem {
  return deprecated === undefined ? item : { ...item, deprecated };
}
