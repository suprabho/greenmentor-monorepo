/**
 * Read / rewrite the `model:` line in a skill.md's YAML frontmatter, as raw text.
 *
 * Deliberately not gray-matter: `matter.stringify` reserializes the whole block,
 * reflowing the folded `description: >-` scalars and dropping comments — visible
 * churn in the very textarea the user is looking at, and a noisy git diff. These
 * helpers touch one line and leave every other byte alone.
 *
 * Pure string work, no node builtins, so the Studio's client components can use it.
 */

/** The leading `---` … `---` block: [full, opening fence, body, closing fence]. */
function frontmatterBlock(md: string): RegExpExecArray | null {
  const m = /^(---[ \t]*\r?\n)([\s\S]*?)(\r?\n---[ \t]*(?:\r?\n|$))/.exec(md);
  return m && m.index === 0 ? m : null;
}

// Column 0 only — continuation lines of a folded scalar are indented, so a `model:`
// mentioned inside a description can't be mistaken for the field.
const MODEL_LINE = /^model:[ \t]*(.*)$/m;
const NAME_LINE = /^name:[ \t]*.*$/m;

export function readFrontmatterModel(md: string): string | null {
  const block = frontmatterBlock(md);
  if (!block) return null;
  const line = MODEL_LINE.exec(block[2]);
  if (!line) return null;
  return line[1].trim().replace(/^["']|["']$/g, "") || null;
}

/** Returns `md` unchanged if it has no frontmatter block to edit. */
export function setFrontmatterModel(md: string, model: string): string {
  const block = frontmatterBlock(md);
  if (!block) return md;
  const [full, open, body, close] = block;

  const next = MODEL_LINE.test(body)
    ? body.replace(MODEL_LINE, `model: ${model}`)
    : NAME_LINE.test(body)
      ? body.replace(NAME_LINE, (l) => `${l}\nmodel: ${model}`)
      : `model: ${model}\n${body}`;

  return open + next + close + md.slice(full.length);
}
