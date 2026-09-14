import { test } from 'node:test'
import assert from 'node:assert/strict'
import { itemRegistryName, itemIconUrl } from './minecraft.ts'

const name = (item: string, lore = '') => itemRegistryName(item, lore)

test('a count and a player label are stripped, the item is not', () => {
  assert.equal(name('3 Iron Ingot'), 'iron_ingot')
  assert.equal(name('42-62 Cobblestone'), 'cobblestone')
  assert.equal(name('1 Barrel "Repair Kit"'), 'barrel')
  assert.equal(name(''), null)
  assert.equal(name('7'), null)
})

test('the special cases the data actually contains', () => {
  assert.equal(name('1 Potion of Fire Resistance'), 'potion')
  assert.equal(name('1 Sculk Orb Banner'), 'white_banner')
  assert.equal(name('1 Nara Shield'), 'shield')
  assert.equal(name('1 Book', 'Author: someone'), 'written_book')
  assert.equal(name('1 Bucket of Axolotl'), 'axolotl_bucket')
  assert.equal(name('1 Block of Iron'), 'iron_block')
  assert.equal(name('1 Slimeball'), 'slime_ball')
})

/* Each of these is easy to get wrong. Verified against the icon host. */
test('lapis lazuli and music disc ids', () => {
  assert.equal(name('12 Lapis Lazuli'), 'lapis_lazuli')
  assert.equal(name('1 Deepslate Lapis Lazuli Ore'), 'deepslate_lapis_ore')
  assert.equal(name('1 Music Disc "pigstep"'), 'music_disc_pigstep')
  assert.equal(name('1 Music Disc "Creator (Music Box)"'), 'music_disc_creator_music_box')
  /* The source CSV drops one quote here, so the value arrives half-quoted. */
  assert.equal(name('1 Music Disc "mellohi'), 'music_disc_mellohi')
})

test('the URL is the registry name, or nothing at all', () => {
  assert.equal(itemIconUrl('3 Diamond'), 'https://mc.nerothe.com/img/1.21.8/minecraft_diamond.png')
  assert.equal(itemIconUrl(undefined), null)
})
