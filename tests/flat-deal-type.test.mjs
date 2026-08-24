import assert from 'node:assert/strict'
import test from 'node:test'

import { normalizeFlatDealType, normalizeFlatPrice, normalizeFlatRoomOnly } from '../server/utils/flatDealType.ts'

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

test('uses conservative price bands when the listing has no deal wording', () => {
  assert.equal(normalizeFlatDealType({ source: 'telegram', price: 200_000_000, currency: 'UZS' }), 'sale')
  assert.equal(normalizeFlatDealType({ source: 'olx', price: 500, currency: 'USD' }), 'longRent')
  assert.equal(normalizeFlatRoomOnly({ source: 'telegram', price: 1_200_000, currency: 'UZS' }), true)
  assert.equal(normalizeFlatRoomOnly({ source: 'telegram', price: 500, currency: 'USD' }), false)
})

test('room-only offers are rentals unless upstream explicitly says otherwise', () => {
  assert.equal(normalizeFlatDealType({ roomOnly: true }), 'longRent')
  assert.equal(normalizeFlatDealType({ roomOnly: true, dealType: 'sale' }), 'sale')
})

test('restores the omitted dollar rent from a compact Telegram title', () => {
  const listing = {
    source: 'telegram',
    title: 'Шайхонтохур 500',
    price: null,
    currency: 'UZS',
    url: 'https://t.me/TOSHKENT_IJARAGA_UYLAR_SERGELI/2733012',
  }
  const normalizedPrice = normalizeFlatPrice(listing)
  assert.deepEqual(normalizedPrice, { price: 500, currency: 'USD' })
  assert.equal(normalizeFlatDealType({ ...listing, ...normalizedPrice }), 'longRent')
})

test('recognizes an OLX student room offered at a per-person Uzbek price', () => {
  const listing = {
    source: 'olx',
    title: 'Student qizlarga GULZOR chorahada 900.mingdan',
    price: 900_000,
    currency: 'UZS',
    roomOnly: false,
    description: 'Gulzor chorrahani yonida 3ta o‘qiydigan qiz olinadi. 900 mingdan',
  }
  assert.equal(normalizeFlatRoomOnly(listing), true)
  assert.equal(normalizeFlatDealType(listing), 'longRent')
})

test('does not invent a price from ordinary OLX titles or Uzbek thousand prices', () => {
  assert.deepEqual(normalizeFlatPrice({ source: 'olx', title: 'Шайхонтохур 500', currency: 'UZS' }), { price: null, currency: 'UZS' })
  assert.deepEqual(normalizeFlatPrice({ source: 'telegram', title: 'Kvartira 900 mingdan', currency: 'UZS' }), { price: null, currency: 'UZS' })
})

test('does not join floor notation to the explicit dollar price', () => {
  assert.deepEqual(normalizeFlatPrice({
    source: 'telegram',
    title: 'Oqtepa krug 3/4/5 500$',
    price: 5_500,
    currency: 'USD',
  }), { price: 500, currency: 'USD' })
})

test('recovers an explicit dollar price from a Telegram description', () => {
  assert.deepEqual(normalizeFlatPrice({
    source: 'telegram',
    title: 'Ташкент Сити',
    price: null,
    currency: 'UZS',
    description: 'Комнат 2\nЭтаж 6\nЭтажность 9\n700$\nОила Кизла',
  }), { price: 700, currency: 'USD' })
})

test('recognizes Uzbek dormitory wording as a room rental', () => {
  const listing = {
    source: 'telegram',
    title: 'Tuman Chilonzor 4 kv',
    description: 'Opshijit dom\nXona 1 xona\nNarx 300$',
  }
  assert.equal(normalizeFlatRoomOnly(listing), true)
  assert.equal(normalizeFlatDealType(listing), 'longRent')
})
