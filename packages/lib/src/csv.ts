/**
 * RFC 4180 CSV, as a table of strings.
 *
 * Quoting matters: the shop data has a quoted comma on every row, because
 * coordinates are written `"3183,70,4854"`. This is the quoting rules and
 * nothing else — no dependency for a ten-column file.
 *
 * Unbalanced quotes are not an error — the real shop CSV contains
 * `"1 Music Disc ""mellohi"` — the field simply runs to the end of the row.
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false

  for (let i = 0; i < text.length; i++) {
    const char = text[i]

    if (quoted) {
      if (char !== '"') field += char
      else if (text[i + 1] === '"') ((field += '"'), i++)
      else quoted = false
      continue
    }

    if (char === '"') quoted = true
    else if (char === ',') (row.push(field), (field = ''))
    else if (char === '\n') (row.push(field), rows.push(row), (row = []), (field = ''))
    else if (char !== '\r') field += char
  }

  /* A file with no trailing newline still has a last row. */
  if (field || row.length) (row.push(field), rows.push(row))

  return rows
}
