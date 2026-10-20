# BBQ

This repository is a fork of Orca. The product name is BBQ. Internal package names, function names, and protocol fields stay on their upstream spelling. [`docs/rename-playbook.md`](docs/rename-playbook.md) is the method. This file is the contract.

Default paths, the process name, and the CLI command this app installs are `bbq`. The residue listed below is intentional. This is not a completed playbook rename.

## Naming contract

There is no intermediate name.

| Surface                        | Old                             | New                                             |
| ------------------------------ | ------------------------------- | ----------------------------------------------- |
| Command                        | `orca`, and on Linux `orca-ide` | `bbq` (`.exe` / `.cmd` on Windows)              |
| Dev command                    | `orca-dev`                      | `bbq-dev`                                       |
| Display / process name         | Orca                            | BBQ                                             |
| Version line                   | `orca <ver>`                    | `bbq <ver>`                                     |
| Home                           | `~/.orca`                       | `~/.bbq`                                        |
| Home env, first non-empty wins | `ORCA_HOME`, `ORCA_USER_DATA`   | `BBQ_HOME`, `BBQ_USER_DATA`, then the old names |
| XDG data dir                   | `$XDG_DATA_HOME/Orca`           | `$XDG_DATA_HOME/BBQ`                            |
| App id                         | `com.stablyai.orca`             | `com.hufans.bbq`                                |
| Publish                        | `stablyai/orca`                 | `hufans/bbq`                                    |
| macOS bundle                   | `Orca.app`                      | `BBQ.app`                                       |
| URL scheme                     | `orca://`                       | `bbq://` ( `orca://` still accepted)            |
| Shell builtin                  | —                               | `bbq` is not a bash or zsh builtin              |

An empty home env var is unset. `BBQ_HOME` wins over `ORCA_HOME`.

## Export policy

The target is playbook option A: a child process gets `BBQ_*` only for the names this app exports, and those old names are removed from that child.

That policy is finished for the names a process list scans on the desktop app:

- Launchers export `BBQ_NODE_OPTIONS` and `BBQ_NODE_REPL_EXTERNAL_MODULE`.
- The main process sets `BBQ_USER_DATA_PATH` and `BBQ_APP_VERSION`.
- Terminals export `BBQ_IMAGE_PROTOCOL`, `TERM_PROGRAM=BBQ`, and pane identity as `BBQ_PANE_KEY`, `BBQ_TAB_ID`, `BBQ_WORKTREE_ID`, `BBQ_AGENT_LAUNCH_TOKEN`. The scrub-safe aliases are `BBQ_AGENT_PANE` and `BBQ_AGENT_LAUNCH`.
- Hook scripts read `$BBQ_AGENT_HOOK_*`. Curl sends `X-Bbq-Agent-Hook-Token`.
- Shell startup argv uses `__bbq_*` functions, `bbq-shell-start`, and `bbq-shell-ready`.
- The CLI path exported to a child is `BBQ_CLI_COMMAND`. A parent that still sets `ORCA_CLI_COMMAND` is read once, then that name is removed from children this app spawns.
- Hermes startup text rides in `BBQ_HERMES_STARTUP_QUERY`. The packaged CLI redirect fence is `BBQ_CLI_LAUNCH_REDIRECTED`. The Windows desktop launcher sets `BBQ_WINDOWS_PACKAGED_CLI_LAUNCHER` and `BBQ_CLI_COMMAND=bbq`. That launcher binary looks for `bbq.exe` and has to be rebuilt before an installed copy does.
- `stripLegacyExportedProductEnv` drops the old names from terminal, daemon, CLI, orcad, and packaged CLI child environments. If only the old name is set, the value moves to the `BBQ_` name first. An empty `BBQ_HOME` or `BBQ_USER_DATA` still counts as unset, so a legacy home can fill it.
- Home resolution still understands `ORCA_HOME` and `ORCA_USER_DATA` until that strip runs. After it, the process and its children keep `BBQ_HOME` and `BBQ_USER_DATA` only.
- Agent homes and shell startup use `BBQ_CODEX_HOME`, `BBQ_MIMOCODE_HOME`, `BBQ_OMP_FRESH_CONFIG`, `BBQ_OMP_CODING_AGENT_DIR`, `BBQ_OMP_SOURCE_AGENT_DIR`, `BBQ_OMP_STATUS_EXTENSION`, `BBQ_AGENT_TEAMS_SHIM_DIR`, `BBQ_SHELL_READY_ROOT`, `BBQ_APP_EXECUTABLE`, `BBQ_DISABLE_HTTP2`, `BBQ_ELECTRON_NO_SANDBOX`, `BBQ_TERMINAL_HANDLE`, and the other names in that strip list. Draft text rides in `BBQ_PI_PREFILL` and `BBQ_OMP_PREFILL`, including the shell command that clears them. Inline chat visuals use `BBQ_CHAT_SCRATCH_DIR`. `ORCA_CHAT_VISUALS_DIR` is only deleted, not written. `ORCA_DEV_*` stays on the dev checkout. The opt-in OMP proof gate `ORCA_OMP_PROOF_BINARY` stays.
- The same strip also covers serve, hook, login-probe, icon, shell-startup, and git-attribution names: `ORCA_SERVE_RUNTIME`, `ORCA_SERVE_SUPERVISOR_APP_ROOT`, `ORCA_POSIX_SHELL_STARTUP_COMMAND`, `ORCA_SHELL_PATH_PROBE`, `ORCA_COPILOT_HOOK_EVENT`, `ORCA_CURSOR_HOOK_RESPONSE`, `ORCA_ANTIGRAVITY_EVENT`, `ORCA_APP_BUNDLE_PATH`, `ORCA_APP_ICON_PATH`, `ORCA_LOGIN_PROBE_USERNAME`, `ORCA_ENABLE_GIT_ATTRIBUTION`, `ORCA_GIT_COMMIT_TRAILER`, `ORCA_GH_PR_FOOTER`, `ORCA_GH_ISSUE_FOOTER`, `ORCA_ATTRIBUTION_SHIM_DIR`, `ORCA_ATTRIBUTION_BYPASS`, `ORCA_REAL_GIT`, and `ORCA_REAL_GH`. `ORCA_LOGIN_PREFLIGHT_OK` is a printf marker, not an env name. `ORCA_REAL_*` test gates other than those two git keys stay.

The provider supervisor is a file under the temp directory, `bbq-provider-supervisor.cjs`. The launch spec is a separate mode-0600 file, removed when the supervisor reads it. The process command line does not contain `-e`, the script source, or a base64 spec. The supervisor still stops the provider process group with SIGTERM and then SIGKILL. A behavior rule that watches that kill can still match. The signal is not on the command line.

The Antigravity Google sign-in helper is a mode-0600 file, `bbq-antigravity-browser.cjs`, under the temp directory. `BROWSER` runs that file. It does not pass `-e` or the helper source. `ELECTRON_RUN_AS_NODE=1` stays on that helper command only, because the supervisor removes it from the server.

## Home migration

On startup outside Vitest, missing files are copied from `~/.orca` and `$XDG_DATA_HOME/Orca` into the new home.

- The copy runs only when no home env var is set.
- A file that already exists in the new home is left alone.
- Symlinks are not copied.
- The old directory is not moved or deleted.

`brew uninstall --zap` for the BBQ cask removes `~/.bbq`. It does not remove `~/.orca`.

Changing the dev safeStorage app name from `Orca Dev` to `BBQ Dev` orphans dev keychain items created under the old name.

## Update channel

Electron Builder publishes to `hufans/bbq`, including the dev channel. It must not download `stablyai/orca` binaries.

`Casks/orca.rb` and `Casks/orca@rc.rb` are removed because they installed upstream Orca. `Casks/bbq.rb` and `Casks/bbq@rc.rb` point at `hufans/bbq` artifacts named `bbq-macos-*.dmg`, app `BBQ.app`, and binary `Contents/Resources/bin/bbq`. Their `sha256` is the digest of the empty string until the first release. `brew install` fails closed until that digest and the version are replaced. Do not copy an Orca digest into these casks.

## Residue that stays

- npm package name `orca`, `@orca/*`, and function names such as `getOrcaDir` and `readOrcaCliVersion`.
- Envelope prefixes such as `orca-minimax-cookie:v1:` and `orca-zcode-plan-api-key:v1:`.
- `orcad` and the Windows slot file `bin/orca.exe` inside an orcad install root. The profile command written for the user is `bbq.exe`.
- `orca.yaml` is not dual-read. Project directory discovery does not prefer `.bbq` over `.orca`.
- Cloud Terraform and `stablyai/orca-cloud`.
- Most UI copy, skill guides, and translated README prose.
- Other CLI spec usage lines that still say `orca <subcommand>`. `serve` help says `bbq`.
- User-Agent `Orca`.
- SSH and local launches both emit `bbq` / `bbq.cmd`. Detection still accepts a process that is already `orca`, `orca-ide`, or `orca-dev`. A remote that only has the old shim on `PATH` fails until it is redeployed.
- Launcher script filenames `resources/*/bin/orca`, `orca-ide`, and `orca.cmd` remain on disk and are not the packaged command. Their exports use `BBQ_NODE_*`.
- Hook scripts are written under `$HOME/.bbq/agent-hooks`. A command is still treated as ours when it contains `agent-hooks/<script>`, including an older `$HOME/.orca/agent-hooks` path, so an upgrade replaces that entry.
- Linux PTY shims are only named `bbq`, under `linux-bbq-cli-shim`. An older `orca` file in that directory is removed. Typing `orca` in a BBQ terminal can run GNOME's `/usr/bin/orca`.
- Service units are `com.hufans.bbq.serve` and `bbq-serve.service`. `bbq serve service` install and uninstall also boot out `com.stablyai.orca.serve` (and the same profile suffix) and disable `orca-serve.service`. Other profiles' old units stay until that profile is installed again.
- macOS helper processes are `bbq-notification-status`, `bbq-keyboard-layout`, and `BBQ Computer Use.app` (`bbq-computer-use-macos`). The Wayland helper is `bbq-wayland-clipboard`. An already installed app keeps the old helper filenames until it is rebuilt. macOS permission entries for "Orca Computer Use" do not follow the new bundle id `com.hufans.bbq.computer-use`.
- Packaged Electron `userData` follows the product name `BBQ`. There is no copy from `Application Support/Orca` into `Application Support/BBQ`.
- `ORCA_DEV_*` env names used by the dev checkout.
- `ORCA_CLAUDE_AGENT_STATUS_SETTINGS` is a retired path. PTY spawn deletes it, and a structured child deletes it too. It is not copied to a `BBQ_` name.
- Fish vendor snippets are `bbq-shell-integration.fish`. Writing that file removes a leftover `orca-shell-integration.fish` in the same directory, because fish loads every `vendor_conf.d/*.fish`. `XDG_DATA_DIRS` points at the data directory.
- WSL, login-shell, and setup markers on the command line are `__BBQ_AGENT_PATH__`, `__BBQ_DIRECTORY_EXISTS__`, `__BBQ_DIRECTORY_MISSING__`, `__BBQ_LOGIN_SHELL_ENV_START__`, `__BBQ_LOGIN_SHELL_ENV_END__`, and `__BBQ_SETUP_COMPLETE__`. The macOS login probe prints `BBQ_LOGIN_PREFLIGHT_OK`.
- Git attribution tombstones read and clear `BBQ_*` names, and they also unset the old `ORCA_*` attribution names so a parent that still has them does not pass them to `git`. Those unset lines still contain the old names. That is cleanup. Cmd locals in the Windows tombstone are `bbq_*`. The on-disk directory stays `orca-terminal-attribution`, and it is rewritten only when that directory already exists. An old `PATH` entry can still contain that directory name.

## Not done

- Playbook completion: release `strings` check, clean-`HOME` install smoke, and a real upstream merge check.
- `app.asar` still contains upstream spellings that are package names, function names, `orcad`, `orca.yaml`, `orca://`, error codes, and UI copy. Those are not process arguments. A `strings` scan of the archive still finds them.
- `ORCA_DEV_*`, `ORCA_E2E_*`, and `ORCA_REAL_*` test and dev gates.
- Dual-read of `orca.yaml` and `.orca/` project directories.
- Rewriting UI strings, skill guides, and translated README prose. Install links in those READMEs do point at `hufans/bbq`.
- Mobile App Store id `orca-ide` and `onorca.dev` doc links. This fork has no store listing.
- Discord and `x.com/orca_build`.
