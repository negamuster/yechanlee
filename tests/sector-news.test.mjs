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

test('actual feed titles previously missed by the rules are included', () => {
  for (const [title, sector] of [
    ['S&P 500 Closes In on Record High as Tech Rallies', 'XLK'],
    ['오픈AI, MGX·블랙록서 40조원 규모 투자 유치 추진', 'XLK'],
    ['Wall Street banks launch record $60bn chip deal for Broadcom and Anthropic', 'XLK'],
    ['금융권 AI 해킹 뚫리자, 보안 관련주 일제히 급등', 'XLF'],
    ['“목표가 깎았지만 여기서 50%는 오른다”…기다림 필요한 현대차 주주', 'XLY'],
    ['롯데칠성, 퓨린 90% 낮춘 클라우드 퓨린 컷다운 출시', 'XLP'],
    ['TotalEnergies boss hails opportunities created by global market turmoil', 'XLE'],
    ['Why are data centres such a big deal in Scotland?', 'XLK'],
  ]) assert.equal(matchesSector(title, sector), true, title)
})
test('ambiguous words do not imply a sector but other relevant evidence remains', () => {
  for (const [title, sector] of [
    ['French central bank head warns country at risk of being strangled by interest rates', 'XLF'],
    ['Student visa restrictions change travel plans', 'XLF'],
    ['Visa-free travel rules change', 'XLF'],
    ['Olive oil prices rise', 'XLE'],
    ['Apple pie and potato chips become popular snacks', 'XLK'],
    ['Blue-chip stocks rise', 'XLK'],
    ['Retailer Walmart posts higher sales', 'XLY'],
    ['서울 소재 대학 연구 결과', 'XLB'],
  ]) assert.equal(matchesSector(title, sector), false, title)
  assert.equal(matchesSector('Visa payment network reports earnings', 'XLF'), true)
  assert.equal(matchesSector('Central bank warns commercial banks about losses', 'XLF'), true)
  assert.equal(matchesSector('Apple launches new software while apple pie sales fall', 'XLK'), true)
  assert.equal(matchesSector('Walmart and Amazon expand retail operations', 'XLY'), true)
  assert.equal(matchesSector('Retailer Walmart posts higher sales', 'XLP'), true)
})
