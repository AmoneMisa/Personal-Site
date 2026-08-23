import assert from 'node:assert/strict'
import test from 'node:test'

import { parseUzJobsRows } from '../shared/hiring/uzJobsFields.ts'

test('UzJobs public resume rows parse without server runtime dependencies', () => {
  const html = `
    <table>
      <tr>
        <td class="td_left_id">99924</td>
        <td>Наука, образование / Главный специалист<br>Наука, образование / Преподаватель</td>
        <td class="td_region" align="center">Ташкент</td>
        <td class="td_kol_vak">16.08.2026 13:25:13</td>
      </tr>
    </table>
  `

  const [row] = parseUzJobsRows(html)
  assert.ok(row)
  assert.equal(row.id, '99924')
  assert.deepEqual(row.roles, ['Главный специалист', 'Преподаватель'])
  assert.equal(row.region, 'Ташкент')
  assert.equal(row.activityAt, '2026-08-16T08:25:13.000Z')
})
