import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { byCategoryPriority, floorName, headCost, headRenderUrl, parseHeads } from './heads.ts'

const TEXTURE = btoa(
  JSON.stringify({
    textures: { SKIN: { url: 'http://textures.minecraft.net/texture/1591b61529d25a7e' } },
  }),
)
const HEADER = 'Timestamp,Input,Output,Coordinates,Exchanges_Available,Category,Tags,Texture,Name\n'

test('a row becomes a head with its texture hash pulled out of the blob', () => {
  const [head] = parseHeads(
    `${HEADER}t,1 Diamond,1 Player Head,"3378,62,5090",F,Food,,${TEXTURE},Crate of Food `,
  )
  assert.equal(head.name, 'Crate of Food')
  assert.equal(head.textureId, '1591b61529d25a7e')
  assert.deepEqual(head.position, { x: 3378, y: 62, z: 5090 })
  assert.equal(head.inStock, false)
  assert.equal(headRenderUrl(head.textureId, 512), 'https://vzge.me/head/512/1591b61529d25a7e.png')
  assert.equal(headRenderUrl(null, 64), 'https://vzge.me/head/64/steve.png?no=shadow')
})

test('the committed CSV parses whole, and every texture decodes', () => {
  const heads = parseHeads(
    readFileSync(new URL('../../../data/head_shop_data.csv', import.meta.url), 'utf8'),
  )
  assert.equal(heads.length, 446)
  assert.equal(heads.filter((h) => !h.textureId).length, 0)
})

test('prices, floors and category order', () => {
  assert.deepEqual(headCost('3 Iron Ingot'), { diamonds: 0, iron: 3 })
  assert.deepEqual(headCost('10 Diamond'), { diamonds: 10, iron: 0 })
  assert.equal(floorName(56), 'Basement')
  assert.equal(floorName(65), 'Middle Floor')
  assert.deepEqual(['Halloween', 'Food', 'Player', 'Blocks'].sort(byCategoryPriority), [
    'Player',
    'Blocks',
    'Food',
    'Halloween',
  ])
})
