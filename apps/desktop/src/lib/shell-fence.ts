// Which fenced code blocks are safe to offer a one-click "Run in terminal" for,
// and what exactly gets sent to the shell.
//
// Deliberately narrow. The button executes immediately (the terminal pane
// receives the text with a trailing CR), so anything ambiguous must fall
// through to Copy instead:
//
//   - only shell dialects, never a language whose fence merely LOOKS runnable
//     (python, sql, dockerfile);
//   - `console` / `shell-session` transcripts qualify ONLY through their `$`
//     prompt lines, because the rest of such a block is output, not input;
//   - a fence with no prompts and more than one statement-bearing line is
//     still offered, but a fence that reads as a file (shebang, heredoc) is
//     not: writing a script's body into an interactive shell is never what the
//     reader meant.

const SHELL_LANGUAGES = new Set(['bash', 'fish', 'sh', 'shell', 'shellscript', 'zsh'])
// Transcript fences: the block interleaves commands with their output, so only
// the prompted lines are runnable.
const TRANSCRIPT_LANGUAGES = new Set(['bash-session', 'console', 'sh-session', 'shell-session', 'terminal'])

const PROMPT_RE = /^\s*[$>%]\s+(?=\S)/

// A fence that is a FILE, not a command line. Running these would paste a
// script body into an interactive shell one line at a time.
const FILE_SHAPED_RE = /^\s*#!|<<-?\s*['"]?[A-Za-z_]/m

/**
 * The command to run for a fence, or null when the fence isn't offered a Run.
 *
 * @param language the fence's info string (may be undefined for a bare fence)
 * @param code the fence body, already trimmed by the caller
 */
export function shellCommandToRun(language: string | undefined, code: string): null | string {
  const lang = (language ?? '').toLowerCase().trim()
  const body = code.trim()

  if (!body) {
    return null
  }

  if (TRANSCRIPT_LANGUAGES.has(lang)) {
    // Keep only the prompted lines, stripped of their prompt: everything else
    // in a transcript is output that would be nonsense as input.
    const commands = body
      .split('\n')
      .filter(line => PROMPT_RE.test(line))
      .map(line => line.replace(PROMPT_RE, '').trim())
      .filter(Boolean)

    return commands.length > 0 ? commands.join('\n') : null
  }

  if (!SHELL_LANGUAGES.has(lang)) {
    return null
  }

  if (FILE_SHAPED_RE.test(body)) {
    return null
  }

  // A shell fence may still carry `$ ` prompts by habit; strip them when EVERY
  // non-empty line has one, so the same block doesn't run `$` as a command.
  const lines = body.split('\n')
  const meaningful = lines.filter(line => line.trim().length > 0)

  return meaningful.every(line => PROMPT_RE.test(line))
    ? meaningful.map(line => line.replace(PROMPT_RE, '').trim()).join('\n')
    : body
}
