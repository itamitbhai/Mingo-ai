import { SANDBOX_ALLOWED_COMMANDS } from 'shared';
import { SandboxCommand } from './sandbox.types';

/**
 * The command policy (Phase 11 spec §9/§10/§11) — every command a sandbox ever runs is dispatched via
 * Docker's own argv exec model (`Cmd: [binary, ...args]`), never through a shell. That alone makes
 * classic shell metacharacters (`&&`, `|`, backticks, `$()`) inert as far as *execution* goes — they'd
 * just be literal argv bytes passed to the binary, not interpreted. This file exists anyway for two
 * real reasons: (1) the terminal UI accepts one free-text line from a human, which has to be parsed
 * into `{command, args}` *before* anything happens, and rejecting shell-looking input there gives an
 * honest, specific error instead of silently mis-tokenizing it; (2) defense-in-depth — a fixed,
 * closed-world binary allowlist means "shell chaining doesn't even matter" is true by construction,
 * not by hoping every future caller remembers not to add `bash -c`.
 */

const DANGEROUS_SUBSTRINGS: { pattern: RegExp; reason: string }[] = [
  { pattern: /&&/, reason: 'Command chaining ("&&") is not allowed.' },
  { pattern: /\|\|/, reason: 'Command chaining ("||") is not allowed.' },
  { pattern: /\|/, reason: 'Piping ("|") is not allowed.' },
  { pattern: /;/, reason: 'Command separators (";") are not allowed.' },
  { pattern: /`/, reason: 'Command substitution (backticks) is not allowed.' },
  { pattern: /\$\(/, reason: 'Command substitution ("$(...)") is not allowed.' },
  { pattern: /[\r\n]/, reason: 'Multi-line commands are not allowed.' },
  { pattern: /[<>]/, reason: 'Redirection ("<"/">") is not allowed.' },
  { pattern: /&\s*$/, reason: 'Background execution ("&") is not allowed.' },
];

/** Explicit, named denylist — checked before the allowlist purely so a blocked user gets "docker is
 *  not an allowed command" instead of a generic "unrecognized command" (spec §58's UX). The allowlist
 *  below is the actual enforcement; this only improves the error message. */
const EXPLICITLY_DENIED_COMMANDS = new Set([
  'rm', 'sudo', 'su', 'docker', 'systemctl', 'mount', 'umount', 'iptables', 'passwd', 'useradd',
  'userdel', 'curl', 'wget', 'nc', 'netcat', 'ssh', 'scp', 'shutdown', 'reboot', 'kill', 'killall',
  'chmod', 'chown', 'bash', 'sh', 'zsh', 'eval', 'exec', 'crontab', 'dd', 'mkfs', 'fdisk',
]);

export type ParseCommandLineResult = { success: true; data: SandboxCommand } | { success: false; error: string };

/** Simple quote-aware tokenizer — splits on whitespace, treats `'...'`/`"..."` as one token each. */
function tokenize(input: string): string[] {
  const tokens: string[] = [];
  let current = '';
  let quote: '"' | "'" | null = null;

  for (const char of input) {
    if (quote) {
      if (char === quote) {
        quote = null;
      } else {
        current += char;
      }
      continue;
    }

    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }

    if (/\s/.test(char)) {
      if (current.length > 0) {
        tokens.push(current);
        current = '';
      }
      continue;
    }

    current += char;
  }

  if (current.length > 0) tokens.push(current);
  return tokens;
}

function isUnsafePathArgument(arg: string): boolean {
  return arg.startsWith('/') || arg.startsWith('~') || arg.split(/[/\\]/).includes('..');
}

/** Parses one free-text command line from the terminal UI (spec §10/§57) into a structured
 *  `{command, args}` — or a specific rejection reason. Never returns something that could still be
 *  shell-interpreted, because nothing downstream ever invokes a shell either way. */
export function parseCommandLine(input: string): ParseCommandLineResult {
  const trimmed = input.trim();
  if (trimmed.length === 0) {
    return { success: false, error: 'Enter a command.' };
  }

  for (const { pattern, reason } of DANGEROUS_SUBSTRINGS) {
    if (pattern.test(trimmed)) {
      return { success: false, error: reason };
    }
  }

  const tokens = tokenize(trimmed);
  const [command, ...args] = tokens;

  return validateCommand(command, args);
}

/** The same validation `parseCommandLine` applies, exposed directly for trusted internal callers
 *  (the Testing Agent, the Orchestrator) that already have a real `{command, args}` — never
 *  re-tokenized, but still checked against the allowlist/path rules so a bug upstream can't smuggle
 *  something unsafe through. */
export function validateCommand(command: string, args: string[]): ParseCommandLineResult {
  if (EXPLICITLY_DENIED_COMMANDS.has(command)) {
    return { success: false, error: `"${command}" is not an allowed command.` };
  }

  if (!(SANDBOX_ALLOWED_COMMANDS as readonly string[]).includes(command)) {
    return {
      success: false,
      error: `"${command}" is not an allowed command. Allowed: ${SANDBOX_ALLOWED_COMMANDS.join(', ')}.`,
    };
  }

  for (const arg of args) {
    if (isUnsafePathArgument(arg)) {
      return { success: false, error: `"${arg}" is not a safe argument — paths must stay inside the workspace.` };
    }
  }

  return { success: true, data: { command, args } };
}

/** Env the container actually receives — never `process.env` passed through (spec §29/§79). */
export function buildSandboxEnv(): Record<string, string> {
  return {
    NODE_ENV: 'test',
    CI: 'true',
    NPM_CONFIG_CACHE: '/tmp/.npm-cache',
    NPM_CONFIG_AUDIT: 'false',
    NPM_CONFIG_FUND: 'false',
    HOME: '/tmp',
  };
}

/**
 * SSRF protection (spec §28) — Docker Desktop resolves `host.docker.internal` inside any container by
 * default regardless of network mode, a Desktop-VM gateway feature that plain `--network none` doesn't
 * defeat for DNS purposes. Pinning it (and common cloud-metadata hostnames) to `127.0.0.1` via
 * `HostConfig.ExtraHosts` closes that specific hole; combined with `NetworkMode: none` for every phase
 * except install, there's no route to a Mingo-internal service either way.
 *
 * Honest limitation: `ExtraHosts` only overrides *hostname* resolution, not a literal IP address used
 * directly (e.g. `fetch('http://169.254.169.254/...')` from an npm lifecycle script during install,
 * when network is necessarily present to reach the registry). True IP-level egress filtering needs a
 * network policy or proxy, out of scope this pass — the same disclosed residual risk Phase 9 already
 * carries for its own install step. On a real cloud host this endpoint can serve real instance
 * credentials; on this local Docker Desktop dev environment nothing is listening there.
 */
export function getSandboxExtraHosts(): string[] {
  return [
    'host.docker.internal:127.0.0.1',
    'host.containers.internal:127.0.0.1',
    'metadata.google.internal:127.0.0.1',
    'metadata:127.0.0.1',
  ];
}
