import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import { cardContactButtons, isSafeContactHref } from '../app/utils/flats/contactActions.ts'

const phoneActions = [
  { channel: 'phone', action: 'call', availability: 'declared', href: 'tel:+998901234567' },
  { channel: 'phone', action: 'copy', availability: 'declared', label: '+998901234567' },
  { channel: 'whatsapp', action: 'message', availability: 'linkable', href: 'https://wa.me/998901234567', derivedFromPhone: true },
  { channel: 'telegram', action: 'message', availability: 'linkable', href: 'tg://resolve?phone=998901234567', derivedFromPhone: true },
]

test('a phone listing shows call first, then derived messengers', () => {
  const buttons = cardContactButtons(phoneActions)
  assert.deepEqual(buttons.map((button) => button.channel), ['phone', 'telegram', 'whatsapp'])
  assert.equal(buttons[0].href, 'tel:+998901234567')
  assert.equal(buttons[2].derivedFromPhone, true)
  assert.equal(buttons[2].external, true)
})

test('actions without a link, such as copy, are not buttons', () => {
  assert.deepEqual(cardContactButtons([{ channel: 'phone', action: 'copy', availability: 'declared', label: '+1' }]), [])
})

test('a real account replaces one derived from the phone number', () => {
  const buttons = cardContactButtons([
    ...phoneActions,
    { channel: 'telegram', action: 'open_profile', availability: 'declared', href: 'https://t.me/owner_flat' },
  ])
  const telegram = buttons.find((button) => button.channel === 'telegram')
  assert.equal(telegram.href, 'https://t.me/owner_flat')
  assert.equal(telegram.derivedFromPhone, false)
})

test('unsafe or unknown hrefs never reach an anchor', () => {
  for (const href of ['javascript:alert(1)', 'data:text/html,x', 'http://insecure.example', 'tel:+99890 1234567', 'https://x.test/"onmouseover=1']) {
    assert.equal(isSafeContactHref(href), false, href)
  }
  assert.deepEqual(cardContactButtons([{ channel: 'phone', action: 'call', href: 'javascript:alert(1)' }]), [])
  assert.deepEqual(cardContactButtons([{ channel: 'sms', action: 'call', href: 'tel:+998901234567' }]), [])
  assert.deepEqual(cardContactButtons(null), [])
})

test('the card renders contact buttons that never trigger the card click', async () => {
  const card = await read('app/components/flats/FlatCard.vue')
  const buttons = await read('app/components/flats/FlatContactActions.vue')
  assert.match(card, /<flat-contact-actions :actions="listing\.contactActions" \/>/u)
  assert.match(buttons, /@click\.stop/u)
  assert.match(buttons, /noopener noreferrer nofollow/u)
  assert.doesNotMatch(buttons, /v-html/u)
})

async function read(path) {
  return readFile(new URL(`../${path}`, import.meta.url), 'utf8')
}
