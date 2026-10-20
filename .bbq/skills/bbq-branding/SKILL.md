---
name: bbq-branding
description: Naming contract for this BBQ fork when merging upstream or changing the process name, CLI command, home path, or update channel. Use when a change writes a product name, command, env prefix, or install path.
---

# BBQ branding

The contract is [BBQ.md](../../../BBQ.md). Read it before renaming anything. This skill is the merge checklist. The naming table lives only in that file.

## Writes

- Write `bbq`, `BBQ`, `~/.bbq`, and `BBQ_*`. Read `orca`, `Orca`, `~/.orca`, and `ORCA_*` only as a fallback.
- Do not global-replace. Package names, function names, protocol fields, and envelope prefixes stay as they are.
- A new child-process export uses `BBQ_*` and drops inherited `ORCA_*` on that child. Do not rename a hook template variable until the writer and the reader change in the same edit.
- Install docs, casks, and the Electron Builder publish block point at `hufans/bbq`. Do not put `stablyai/orca` download URLs back.
- The Linux command is `bbq`. `orca-ide` is recognition and cleanup only. SSH relays still install a shim named `orca`.

## After a merge

Search for new writes, not for every occurrence of the old name:

```bash
rg -n "command: 'orca'|/usr/local/bin/orca|resources/bin/orca-ide|productName: 'Orca'|stablyai/orca/releases" \
  src config Casks README.md
```

A hit this app installs, execs, or publishes is a write. Change the write. Leave reads, and leave the residue list in BBQ.md.
