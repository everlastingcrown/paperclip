# Sandbox shell variable selection

Sandbox and plugin Environments can select variable names through the CLI:

```sh
paperclipai environment update <environment-id> \
  --payload-json '{"config":{"shellEnvironmentKeys":["SERVICE_API_TOKEN","CUSTOM_CA_PATH"]}}'
```

The PATCH route merges configuration fields. Existing Environment permissions and
managed-environment restrictions apply. There is no UI control. An omitted list
means no additional names; set `shellEnvironmentKeys` to `[]` to remove selections.
No database migration is required.

Use exact variable names, with no patterns or duplicates and at most 128 entries.
Application secrets can be selected explicitly. The existing configured-environment
restrictions reject provider credentials, generated Paperclip variables,
observability credentials, and execution controls such as `NODE_OPTIONS` and
`LD_PRELOAD`.

Paperclip passes names through the legacy execution context or a reserved,
controller-generated Runner launch declaration. Agent, project, routine, and
Environment value bindings cannot supply that declaration. Native launch boundaries
validate it again. Codex shell policies exclude the declaration itself and disable
shell snapshots. Changing the selected names prevents reuse of a warm native
process with its previous policy. Previous configurations without the field remain
valid and behave like an empty list.

Values are read inside the execution environment at launch. Missing optional names
remain unset. Explicit Paperclip value bindings keep their existing precedence.
Inherited values are never written into Environment configuration or Codex arguments.

Broad process inheritance would also expose provider
credentials and runtime tokens. Remote discovery would add reads, lifecycle
coupling, and possible secret exposure. Copying controller values would also copy
paths that might not exist in the sandbox.
