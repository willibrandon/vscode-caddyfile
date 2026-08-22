# Security model

Normal editing is local and does not require Caddy or network access. Files are read through VS
Code, with limits on file count, file size, and total indexed text.

Optional Caddy checks run only after a user command or an enabled check-on-save setting. They are
blocked in untrusted workspaces and browser hosts. Commands are arrays, no shell parses them, and
document text is sent on standard input.

The extension never starts Caddy, contacts its admin API, downloads executables, provisions modules,
or uses `sudo`.

Release checks include CodeQL, dependency review, Picket, secret scanning, npm audit, package and
license allowlists, reproducible artifacts, checksums, SBOMs, and GitHub attestations. Actions are
pinned to commit SHAs with narrow permissions.

Report extension vulnerabilities through GitHub private vulnerability reporting. Caddy server
vulnerabilities belong to the Caddy project.
