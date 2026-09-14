import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseCsv } from './csv.ts'

test('quoted fields keep their commas, newlines and doubled quotes', () => {
  assert.deepEqual(parseCsv('a,"b,c",d'), [['a', 'b,c', 'd']])
  assert.deepEqual(parseCsv('"he said ""hi""",x'), [['he said "hi"', 'x']])
  assert.deepEqual(parseCsv('"two\nlines",x'), [['two\nlines', 'x']])
})

test('rows split on newlines, CRLF included, and empty fields survive', () => {
  assert.deepEqual(parseCsv('a,b\r\nc,d\r\n'), [
    ['a', 'b'],
    ['c', 'd'],
  ])
  assert.deepEqual(parseCsv('a,,b'), [['a', '', 'b']])
  assert.deepEqual(parseCsv(''), [])
})

/* Verbatim from the shop CSV, where an inner quote was dropped at export:
   `""mellohi"` closes the field instead of escaping, so the value keeps a stray
   opening quote. Parsed correctly here — the defect is upstream, and the item
   icon lookup strips it. */
test('a dropped inner quote in the shop CSV parses as written', () => {
  assert.deepEqual(parseCsv('1,"1 Music Disc ""mellohi",Shiroyama'), [
    ['1', '1 Music Disc "mellohi', 'Shiroyama'],
  ])
})

test('a genuinely unterminated quote runs to the end of the input', () => {
  assert.deepEqual(parseCsv('a,"b,c'), [['a', 'b,c']])
})
