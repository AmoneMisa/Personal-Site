import assert from 'node:assert/strict';
import test from 'node:test';

globalThis.defineEventHandler = handler => handler;
globalThis.getRequestURL = event => event.url;
globalThis.setHeader = (event, key, value) => { event.headers[key] = value; };
globalThis.setResponseStatus = (event, status) => { event.status = status; };
const handler = (await import('../server/routes/flats-map.get.ts')).default;
const event = query => ({ url: new URL(`https://site.example/flats-map?${query}`), headers: {} });

test('equivalent map queries share one request and preserve backend/custom source values', async () => {
  let resolve;
  const urls = [];
  globalThis.$fetch = url => { urls.push(new URL(url)); return new Promise(r => { resolve = r; }); };
  const first = handler(event('city=CacheCity&countries=UZ&sources=custom,telegram&limit=20'));
  const second = handler(event('sources=telegram,custom&countries=UZ&city=CacheCity&offset=40'));
  assert.equal(urls.length, 1);
  assert.equal(urls[0].searchParams.get('city'), 'CacheCity');
  assert.equal(urls[0].searchParams.get('sources'), 'custom,telegram');
  assert.equal(urls[0].searchParams.get('limit'), null);
  const data = { count: 1, mapPoints: [{ id: 'one' }] };
  resolve(data);
  assert.deepEqual(await first, data);
  assert.deepEqual(await second, data);
  await handler(event('city=CacheCity&countries=UZ&sources=custom,telegram'));
  assert.equal(urls.length, 1);
});

test('stale maps expire even when the upstream request fails after expiry', async (t) => {
  let now = 10_000;
  t.mock.method(Date, 'now', () => now);
  globalThis.$fetch = async () => ({ count: 1, mapPoints: [{ id: 'old' }] });
  await handler(event('city=ExpiryCity'));
  now += 31_000;
  globalThis.$fetch = async () => { throw new Error('offline'); };
  assert.equal((await handler(event('city=ExpiryCity'))).stale, true);
  now += 80_000;
  globalThis.$fetch = async () => { now += 10_000; throw new Error('offline'); };
  const expired = event('city=ExpiryCity');
  const result = await handler(expired);
  assert.equal(expired.status, 503);
  assert.equal(expired.headers['Cache-Control'], 'no-store');
  assert.deepEqual(result.mapPoints, []);
  assert.equal(result.stale, undefined);
});

test('map cache evicts old keys and bounds simultaneous upstream work', async () => {
  let calls = 0;
  globalThis.$fetch = async () => { calls++; return { count: 0, mapPoints: [] }; };
  for (let index = 0; index < 65; index++) await handler(event(`city=Eviction${index}`));
  await handler(event('city=Eviction0'));
  assert.equal(calls, 66);

  const resolvers = [];
  globalThis.$fetch = () => new Promise(resolve => resolvers.push(resolve));
  const work = Array.from({ length: 16 }, (_, index) => handler(event(`city=Pending${index}`)));
  const duplicate = handler(event('city=Pending0'));
  const overloaded = event('city=OverCapacity');
  await handler(overloaded);
  assert.equal(overloaded.status, 503);
  assert.equal(resolvers.length, 16);
  for (const resolve of resolvers) resolve({ count: 0, mapPoints: [] });
  await Promise.all([...work, duplicate]);
  globalThis.$fetch = async () => ({ count: 1, mapPoints: [] });
  assert.equal((await handler(event('city=AfterCapacity'))).count, 1);
});
