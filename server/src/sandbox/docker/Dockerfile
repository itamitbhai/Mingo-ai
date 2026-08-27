# Mingo AI sandbox image (Phase 11) — pinned base, never `latest` (spec §62).
#
# Runs every AI-generated/untrusted command Mingo executes on a project. Nothing Mingo-specific lives
# in here: no source code, no secrets, no production configuration (spec §61) — just a minimal,
# non-root Node.js runtime the sandbox manager bind-mounts a project into at /workspace.
FROM node:22.11-slim

# Non-root user (spec §4/§60) — uid/gid 10001, arbitrary but fixed so `HostConfig.User` in
# sandbox.executor.ts can reference it by number without needing to inspect the image at runtime.
RUN groupadd --gid 10001 sandbox \
  && useradd --uid 10001 --gid sandbox --shell /usr/sbin/nologin --no-create-home sandbox

WORKDIR /workspace

USER 10001:10001

# No ENTRYPOINT/CMD — sandbox.executor.ts always supplies an explicit argv (`npm`, `node`, `npx`, or
# `git`, plus args), matching the "no shell" execution model in sandbox.security.ts.
