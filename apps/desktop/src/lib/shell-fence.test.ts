import { describe, expect, it } from 'vitest'

import { shellCommandToRun } from './shell-fence'

describe('shellCommandToRun', () => {
  it('runs a plain shell fence verbatim', () => {
    expect(shellCommandToRun('bash', 'npm run build')).toBe('npm run build')
    expect(shellCommandToRun('sh', 'ls -la')).toBe('ls -la')
    expect(shellCommandToRun('zsh', 'echo hi')).toBe('echo hi')
  })

  it('keeps a multi-line shell fence whole', () => {
    expect(shellCommandToRun('bash', 'cd apps/desktop\nnpm test')).toBe('cd apps/desktop\nnpm test')
  })

  it('offers nothing for a non-shell language', () => {
    expect(shellCommandToRun('python', 'print("hi")')).toBeNull()
    expect(shellCommandToRun('sql', 'select 1')).toBeNull()
    expect(shellCommandToRun(undefined, 'ls')).toBeNull()
  })

  it('strips habitual prompts when every line carries one', () => {
    expect(shellCommandToRun('bash', '$ git status\n$ git log -1')).toBe('git status\ngit log -1')
  })

  it('leaves a lone $ inside a real command alone', () => {
    expect(shellCommandToRun('bash', 'echo $HOME')).toBe('echo $HOME')
  })

  // A transcript is commands INTERLEAVED with output; running the output would
  // be nonsense, so only the prompted lines survive.
  it('takes only the prompted lines out of a console transcript', () => {
    const transcript = ['$ git status', 'On branch main', 'nothing to commit', '$ git log -1', 'commit abc'].join('\n')

    expect(shellCommandToRun('console', transcript)).toBe('git status\ngit log -1')
  })

  it('offers nothing for a transcript with no prompts (pure output)', () => {
    expect(shellCommandToRun('console', 'error: something failed\n  at line 3')).toBeNull()
  })

  // Pasting a script body into an interactive shell line-by-line is never what
  // the reader meant.
  it('refuses a fence that is a file, not a command', () => {
    expect(shellCommandToRun('bash', '#!/usr/bin/env bash\nset -euo pipefail\necho hi')).toBeNull()
    expect(shellCommandToRun('bash', "cat <<'EOF' > f\nbody\nEOF")).toBeNull()
  })

  it('offers nothing for an empty fence', () => {
    expect(shellCommandToRun('bash', '   ')).toBeNull()
  })
})
