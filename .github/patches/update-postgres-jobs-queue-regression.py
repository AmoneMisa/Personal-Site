from pathlib import Path

path = Path('tests/regressions.test.mjs')
text = path.read_text()
old = '''test('hiring dispatcher skips disabled Telegram feeds and fast-tracks unfinished backfills', () => {
  const source = readFileSync(new URL('../server/utils/hiringSources.ts', import.meta.url), 'utf8')
  assert.match(source, /hiringChannelHandles[\\s\\S]*?filter\\(\\(channel\\)\\s*=>\\s*channel\\.enabled\\s*!==\\s*false\\)/u)

  const worker = readFileSync(new URL('../jobs-queue-worker/worker.py', import.meta.url), 'utf8')
  assert.match(worker, /HIRING_BACKFILL_SECONDS[\\s\\S]*?"300"/u)
  assert.match(worker, /jobs_due_at\\s*=\\s*0\\.0[\\s\\S]*?backfill_due_at\\s*=\\s*0\\.0/u)
  assert.match(worker, /queue_declare\\(queue=HIRING_QUEUE, passive=True\\)/u)
})
'''
new = '''test('hiring dispatcher skips disabled Telegram feeds and fast-tracks unfinished backfills', () => {
  const source = readFileSync(new URL('../server/utils/hiringSources.ts', import.meta.url), 'utf8')
  assert.match(source, /hiringChannelHandles[\\s\\S]*?filter\\(\\(channel\\)\\s*=>\\s*channel\\.enabled\\s*!==\\s*false\\)/u)

  const queue = readFileSync(new URL('../server/utils/jobsPgQueue.ts', import.meta.url), 'utf8')
  const dispatch = readFileSync(new URL('../server/routes/internal/jobs-queue-dispatch.post.ts', import.meta.url), 'utf8')
  assert.match(dispatch, /HIRING_QUEUE_BACKFILL_SECONDS[\\s\\S]*?300/u)
  assert.match(queue, /backfill_due_at/u)
  assert.match(queue, /type = 'hiring\\.refresh\\.channel'[\\s\\S]*?status IN \\('pending', 'running'\\)/u)
  assert.match(queue, /priority: 4/u)
})
'''
if old not in text:
    raise SystemExit('old hiring dispatcher regression block not found')
path.write_text(text.replace(old, new, 1))
