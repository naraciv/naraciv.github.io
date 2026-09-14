import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseShops } from './shops.ts'

const HEADER =
  'Timestamp,Input,Input_Lore,Output,Output_Lore,Coordinates,Exchanges_Available,City,Tags,Contact\n'

const parse = (...rows: string[]) => parseShops(HEADER + rows.join('\n'))

test('a row becomes a shop, coordinates and all', () => {
  const [shop] = parse(
    '2025-11-09T18:31:32,3 Iron Ingot,,1 Nara Shield,,"3183,70,4854",TRUE,Shiroyama,Blocks,_BaniShed',
  )
  assert.equal(shop.input.label, '3 Iron Ingot')
  assert.equal(shop.output.icon, 'https://mc.nerothe.com/img/1.21.8/minecraft_shield.png')
  assert.deepEqual(shop.position, { x: 3183, y: 70, z: 4854 })
  assert.equal(shop.inStock, true)
  assert.deepEqual(shop.tags, ['Blocks'])
})

test('FALSE means out of stock, and nothing else does', () => {
  const [out, missing] = parse(
    'x,1 Dirt,,1 Stone,,"1,2,3",FALSE,Orakuru,,someone',
    'x,1 Dirt,,1 Stone,,"1,2,3",,Orakuru,,someone',
  )
  assert.equal(out.inStock, false)
  assert.equal(missing.inStock, false)
})

test('lore markers move into the name and out of the lore', () => {
  const [shop] = parse(
    'x,1 Barrel,"Compacted Item|§aNine stacks",1 Stone,"Crate","1,2,3",TRUE,Orakuru,,someone',
  )
  assert.equal(shop.input.label, '1 Barrel (CI)')
  assert.equal(shop.input.lore, 'Nine stacks')
  assert.equal(shop.output.label, '1 Stone (Crate)')
  assert.equal(shop.output.lore, '')
})

test('an unreadable coordinate lists but does not map', () => {
  const [shop] = parse('x,1 Dirt,,1 Stone,,somewhere,TRUE,Orakuru,,someone')
  assert.equal(shop.position, null)
  assert.equal(shop.coordinates, 'somewhere')
})

test('short or headerless rows are dropped rather than yielding empty cells', () => {
  assert.deepEqual(parse('', 'x,1 Dirt,,1 Stone'), [])
})
