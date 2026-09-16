# Source catalog copy changelog (light editorial)

Date: 2026-09-16

| Source id | Field | Old | New | Why |
|---|---|---|---|---|
| `app_servers` | `customerSummary`, counting `howToCount`, measurement `helperText` | Truncated “J2EE containers, .” | Java/.NET runtimes (Tomcat, WebSphere, WebLogic, IIS) | Cut-off AI string |
| `app_servers_nonprod` | same | Truncated “staging J2EE, .” | Dev/test/stage Java/.NET runtimes | Same truncation |
| `sso_pam` | unit labels, example quantity, input label | “identity management platforms” / example 3500 | “PAM / vault platforms” / example 2 | Question counts platforms, not users |
| `firewalls` | `name` | Firewalls (Next-Gen Firewalls) | Next-Gen Firewalls | Drop redundant parenthetical |
| `dns` | `whyItMatters` | “most underutilized yet valuable” | “highest-signal, often-missed” | Same meaning, less filler |
