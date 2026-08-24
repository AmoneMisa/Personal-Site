import assert from 'node:assert/strict'
import test from 'node:test'

import { normalizeFlatDealType } from '../server/utils/flatDealType.ts'

test('keeps explicit deal types even when a low price resembles rent', () => {
  assert.equal(normalizeFlatDealType({ dealType: 'sale', source: 'telegram', price: 500, currency: 'USD' }), 'sale')
  assert.equal(normalizeFlatDealType({ dealType: 'shortRent' }), 'shortRent')
  assert.equal(normalizeFlatDealType({ dealType: 'longRent' }), 'longRent')
})

test('recognizes common rental and sale wording in social listings', () => {
  assert.equal(normalizeFlatDealType({ description: 'Сдаётся квартира на долгий срок' }), 'longRent')
  assert.equal(normalizeFlatDealType({ description: 'Квартира посуточно, оплата за сутки' }), 'shortRent')
  assert.equal(normalizeFlatDealType({ description: 'Kvartira ijaraga beriladi' }), 'longRent')
  assert.equal(normalizeFlatDealType({ description: 'Kvartira sotiladi' }), 'sale')
})

test('restores rent for compact Telegram cards whose text omits the deal word', () => {
  assert.equal(normalizeFlatDealType({ source: 'Telegram', title: 'Uchtepa 500', price: 500, currency: 'USD' }), 'longRent')
  assert.equal(normalizeFlatDealType({ source: 'telegram', title: 'Юнусобод', price: 3_500_000, currency: 'UZS' }), 'longRent')
})

test('does not guess rent from high social prices or unknown OLX cards', () => {
  assert.equal(normalizeFlatDealType({ source: 'telegram', price: 200_000_000, currency: 'UZS' }), null)
  assert.equal(normalizeFlatDealType({ source: 'olx', price: 500, currency: 'USD' }), null)
})

test('room-only offers are rentals unless upstream explicitly says otherwise', () => {
  assert.equal(normalizeFlatDealType({ roomOnly: true }), 'longRent')
  assert.equal(normalizeFlatDealType({ roomOnly: true, dealType: 'sale' }), 'sale')
})
