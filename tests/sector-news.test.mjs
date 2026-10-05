import test from 'node:test'
import assert from 'node:assert/strict'
import { matchesSector } from '../src/components/sectorNews.ts'
test('sector title classification covers English and Korean without substring AI matches', () => {
  assert.equal(matchesSector('Nvidia announces new chips', 'XLK'), true)
  assert.equal(matchesSector('반도체 기업 실적 발표', 'XLK'), true)
  assert.equal(matchesSector('Airlines report record holiday demand', 'XLK'), false)
  assert.equal(matchesSector('Oil prices rise as OPEC meets', 'XLE'), true)
  assert.equal(matchesSector('Banks report earnings', 'XLF'), true)
  assert.equal(matchesSector('Banks report earnings', 'XLRE'), false)
  assert.equal(matchesSector('주요 리츠의 부동산 매입', 'XLRE'), true)
  assert.equal(matchesSector('Nvidia gains', 'UNKNOWN'), false)
  assert.equal(matchesSector('Market update', null), true)
})
