from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    p = Path(path)
    text = p.read_text(encoding='utf-8')
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f'{path}: expected one match, found {count}: {old[:120]!r}')
    p.write_text(text.replace(old, new, 1), encoding='utf-8')


def replace_between(path: str, start: str, end: str, replacement: str) -> None:
    p = Path(path)
    text = p.read_text(encoding='utf-8')
    a = text.find(start)
    if a < 0:
        raise RuntimeError(f'{path}: start marker not found')
    b = text.find(end, a + len(start))
    if b < 0:
        raise RuntimeError(f'{path}: end marker not found')
    p.write_text(text[:a] + replacement + text[b + len(end):], encoding='utf-8')

jobs = 'app/pages/jobs/index.vue'
hiring = 'app/pages/hiring/index.vue'

# Jobs: bilingual group headings and keep salary controls together.
replace_once(
    jobs,
    'const { t: translate } = useI18n();\nconst t = (key: string, params: Record<string, unknown> = {}) =>\n  translate(`jobs.${key}`, params);\n',
    'const { t: translate, locale } = useI18n();\nconst t = (key: string, params: Record<string, unknown> = {}) =>\n  translate(`jobs.${key}`, params);\nconst label = (ru: string, en: string) => String(locale.value).toLowerCase().startsWith("ru") ? ru : en;\n',
)
replace_once(
    jobs,
    '      <u-input v-model.number="salaryMin" type="number" icon="i-lucide-banknote" :label="`${t(\'salaryMin\')} (${displayCurrency}/${periodLabel(displayPeriod)})`" />\n',
    '',
)

jobs_advanced = '''      <div v-if="showAdvanced" class="jobs__advanced">
        <section class="jobs-filter-group">
          <div class="jobs-filter-group__title"><u-icon name="i-lucide-map-pin" /> {{ label("Местоположение", "Location") }}</div>
          <div class="jobs-filter-group__grid jobs-filter-group__grid_location">
            <div class="jobs__field">
              <u-select-menu :label="t('country')" v-model="countries" :items="countryItems" value-key="value" label-key="label"
                  multiple :placeholder="t('countryPlaceholder')" class="jobs__select" @update:model-value="scheduleLoad()" />
            </div>
            <div class="jobs__field jobs__field_wide">
              <u-input v-model="cities" icon="i-lucide-map-pin" :label="t('cities')" :placeholder="t('citiesPlaceholder')"
                  @keyup.enter="load(1)" @change="scheduleLoad()" />
            </div>
          </div>
        </section>

        <section class="jobs-filter-group jobs-filter-group_salary">
          <div class="jobs-filter-group__title"><u-icon name="i-lucide-banknote" /> {{ label("Зарплата", "Salary") }}</div>
          <div class="jobs-filter-group__grid jobs-filter-group__grid_salary">
            <div class="jobs__field">
              <u-input v-model.number="salaryMin" type="number" min="0" icon="i-lucide-banknote"
                  :label="`${t('salaryMin')} (${displayCurrency}/${periodLabel(displayPeriod)})`" @change="scheduleLoad()" />
            </div>
            <div class="jobs__field">
              <u-select-menu :label="t('currency')" v-model="displayCurrency" :items="currencyItems" value-key="value" label-key="label"
                  class="jobs__select" @update:model-value="salaryMin && scheduleLoad()" />
            </div>
            <div class="jobs__field">
              <u-select-menu :label="t('period')" v-model="displayPeriod" :items="periodItems" value-key="value" label-key="label"
                  :search-input="false" class="jobs__select" @update:model-value="salaryMin && scheduleLoad()" />
            </div>
            <label class="jobs__remote jobs__field_inline">
              <u-switch v-model="hasSalary" @update:model-value="scheduleLoad()" />
              <span>{{ t("hasSalary") }}</span>
            </label>
          </div>
        </section>

        <section class="jobs-filter-group">
          <div class="jobs-filter-group__title"><u-icon name="i-lucide-briefcase-business" /> {{ label("Условия работы", "Work conditions") }}</div>
          <div class="jobs-filter-group__grid">
            <div class="jobs__field"><u-select-menu :label="t('workMode')" v-model="workModeSelect" :items="workModeItems" value-key="value" label-key="label" :search-input="false" class="jobs__select" @update:model-value="scheduleLoad()" /></div>
            <div class="jobs__field"><u-select-menu :label="t('relocation')" v-model="relocationSelect" :items="relocationItems" value-key="value" label-key="label" :search-input="false" class="jobs__select" @update:model-value="scheduleLoad()" /></div>
            <div class="jobs__field"><u-select-menu :label="t('employment')" v-model="employmentKindSelect" :items="employmentKindItems" value-key="value" label-key="label" :search-input="false" class="jobs__select" @update:model-value="scheduleLoad()" /></div>
            <div class="jobs__field"><u-input v-model.number="maxExperience" type="number" min="0" max="40" icon="i-lucide-briefcase" :label="t('experienceMax')" :placeholder="t('experienceMaxPlaceholder')" @keyup.enter="load(1)" @change="scheduleLoad()" /></div>
            <label class="jobs__remote jobs__field_inline"><u-switch v-model="noExperience" @update:model-value="scheduleLoad()" /><span>{{ t("noExperience") }}</span></label>
            <label class="jobs__remote jobs__field_inline"><u-switch v-model="foreignerOnly" @update:model-value="scheduleLoad()" /><span>{{ t("foreigner") }}</span></label>
          </div>
        </section>

        <section class="jobs-filter-group">
          <div class="jobs-filter-group__title"><u-icon name="i-lucide-languages" /> {{ label("Навыки и языки", "Skills & languages") }}</div>
          <div class="jobs-filter-group__grid">
            <div class="jobs__field"><u-select-menu :label="t('language')" v-model="languageSelect" :items="languageItems" value-key="value" label-key="label" class="jobs__select" @update:model-value="scheduleLoad()" /></div>
            <div class="jobs__field"><u-select-menu :label="t('languageLevel')" v-model="languageLevelSelect" :items="levelItems" value-key="value" label-key="label" :search-input="false" :disabled="!language" class="jobs__select" @update:model-value="scheduleLoad()" /></div>
            <div class="jobs__field"><u-select-menu :label="t('excludeLanguage')" v-model="excludeLanguages" :items="excludeLanguageItems" value-key="value" label-key="label" multiple :placeholder="t('excludeLangPlaceholder')" class="jobs__select" @update:model-value="scheduleLoad()" /></div>
            <div class="jobs__field jobs__field_wide"><u-input v-model="skills" icon="i-lucide-wrench" :label="t('skills')" :placeholder="t('skillsPlaceholder')" @keyup.enter="load(1)" /></div>
          </div>
        </section>

        <section class="jobs-filter-group jobs-filter-group_flags">
          <div class="jobs-filter-group__title"><u-icon name="i-lucide-shield-check" /> {{ label("Исключения и охват", "Exclusions & coverage") }}</div>
          <div class="jobs-filter-group__flags">
            <label class="jobs__remote" :title="t('hideRiskyHint')"><u-switch v-model="hideRisky" @update:model-value="scheduleLoad()" /><span>{{ t("hideRisky") }}</span></label>
            <label class="jobs__remote"><u-switch v-model="includeRu" @update:model-value="scheduleLoad()" /><span>{{ t("includeRu") }}</span></label>
            <label class="jobs__remote"><u-switch v-model="includeBy" @update:model-value="scheduleLoad()" /><span>{{ t("includeBy") }}</span></label>
          </div>
        </section>

        <div class="jobs-filter-actions">
          <u-button type="button" variant="ghost" color="neutral" size="sm" icon="i-lucide-rotate-ccw" @click="resetFilters">{{ t("reset") }}</u-button>
        </div>
      </div>
'''
replace_between(jobs, '      <div v-if="showAdvanced" class="jobs__advanced">\n', '      </div>\n    </form>', jobs_advanced)

replace_once(
    jobs,
    '    <p v-else class="jobs__count text-muted">{{ t("jobsFound", { n: displayedTotal }) }}</p>\n',
    '    <p v-else-if="loading && !stats && !jobs.length" class="jobs__count text-muted">{{ t("searching") }}…</p>\n    <p v-else class="jobs__count text-muted">{{ t("jobsFound", { n: displayedTotal }) }}</p>\n',
)

old_jobs_css = '''.jobs__advanced {
  grid-column: 1 / -1; display: grid; gap: 12px 14px; align-items: end;
  grid-template-columns: 1fr;
  padding: 14px; border-radius: 8px; border: 1px solid var(--line); background: rgba(255,255,255,0.02);
  @media (min-width: 700px) { grid-template-columns: repeat(3, 1fr); }
  @media (min-width: 1000px) { grid-template-columns: repeat(4, 1fr); }
}
.jobs__field { display: flex; flex-direction: column; gap: 5px; }
.jobs__field-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; opacity: 0.7; }
.jobs__field_wide { @media (min-width: 700px) { grid-column: span 2; } }
.jobs__field_inline { align-self: center; margin-top: 14px; }
'''
new_jobs_css = '''.jobs__advanced {
  grid-column: 1 / -1; display: grid; grid-template-columns: 1fr; gap: 12px;
  padding: 14px; border-radius: 10px; border: 1px solid var(--line); background: rgba(255,255,255,0.02);
}
.jobs-filter-group { min-width: 0; padding: 14px; border: 1px solid var(--line); border-radius: 9px; background: rgba(255,255,255,0.025); }
.jobs-filter-group__title { display: flex; align-items: center; gap: 7px; margin-bottom: 12px; color: var(--ui-text-muted); font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: .04em; }
.jobs-filter-group__title :deep(svg) { color: var(--accent-pink); }
.jobs-filter-group__grid { display: grid; grid-template-columns: 1fr; gap: 12px; align-items: end; }
.jobs-filter-group__flags { display: flex; flex-wrap: wrap; gap: 14px 24px; align-items: center; }
.jobs-filter-actions { display: flex; justify-content: flex-end; }
.jobs__field { display: flex; flex-direction: column; gap: 5px; min-width: 0; }
.jobs__field-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; opacity: 0.7; }
.jobs__field_inline { align-self: center; min-height: var(--ui-control-h-md); }
@media (min-width: 700px) {
  .jobs__advanced { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .jobs-filter-group__grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .jobs-filter-group__grid_salary { grid-template-columns: minmax(0, 1.4fr) minmax(110px, .7fr) minmax(130px, .8fr); }
  .jobs-filter-group__grid_salary .jobs__field_inline { grid-column: 1 / -1; }
  .jobs__field_wide { grid-column: span 2; }
  .jobs-filter-actions { grid-column: 1 / -1; }
}
@media (min-width: 1200px) {
  .jobs__advanced { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .jobs-filter-group__grid_location { grid-template-columns: minmax(180px, .8fr) minmax(0, 1.6fr); }
}
'''
replace_once(jobs, old_jobs_css, new_jobs_css)

# Hiring: same grouped mental model, with salary range + currency in one card.
hiring_advanced = '''      <div v-if="showAdvanced" class="hiring__advanced">
        <div class="hiring__presets">
          <span class="hiring__field-label">{{ t("presets") }}</span>
          <button v-for="preset in presets" :key="preset.name" type="button" class="hiring__preset" @click="applyPreset(preset)">
            <span>{{ preset.name }}</span><span class="hiring__preset-remove" role="button" :aria-label="t('deletePreset')" @click.stop="removePreset(preset.name)">×</span>
          </button>
          <u-button type="button" variant="outline" color="neutral" size="sm" icon="i-lucide-bookmark-plus" @click="presetModalOpen = true">{{ t("savePreset") }}</u-button>
          <u-button type="button" variant="outline" color="neutral" size="sm" icon="i-lucide-share-2" @click="sharedLinkOpened = false; shareModalOpen = true">{{ t("shareSearch") }}</u-button>
        </div>

        <section class="hiring-filter-group">
          <div class="hiring-filter-group__title"><u-icon name="i-lucide-map-pin" /> {{ label("Местоположение", "Location") }}</div>
          <div class="hiring-filter-group__grid">
            <div class="hiring__field"><u-select-menu :label="t('country')" v-model="countries" :items="countryItems" value-key="value" label-key="label" multiple :placeholder="t('countryAny')" class="hiring__select" @update:model-value="scheduleLoad()" /></div>
            <div class="hiring__field"><u-select-menu :label="t('city')" v-model="citySel" :items="cityItems" value-key="value" label-key="label" class="hiring__select" @update:model-value="scheduleLoad()" /></div>
            <div class="hiring__field"><u-select-menu :label="t('remote')" v-model="remoteSel" :items="remoteItems" value-key="value" label-key="label" :search-input="false" class="hiring__select" @update:model-value="scheduleLoad()" /></div>
          </div>
        </section>

        <section class="hiring-filter-group hiring-filter-group_salary">
          <div class="hiring-filter-group__title"><u-icon name="i-lucide-banknote" /> {{ label("Желаемая зарплата", "Desired salary") }}</div>
          <div class="hiring-filter-group__grid hiring-filter-group__grid_salary">
            <div class="hiring__field hiring__salary-range">
              <u-input v-model.number="salaryFrom" type="number" min="0" icon="i-lucide-banknote" :label="label('От', 'From')" @change="scheduleLoad()" />
              <u-input v-model.number="salaryTo" type="number" min="0" icon="i-lucide-banknote" :label="label('До', 'To')" @change="scheduleLoad()" />
            </div>
            <div class="hiring__field"><u-select-menu :label="label('Валюта', 'Currency')" v-model="salaryCurrency" :items="salaryCurrencyItems" value-key="value" label-key="label" :search-input="false" class="hiring__select" @update:model-value="(salaryFrom != null || salaryTo != null || sort.startsWith('salary')) && scheduleLoad(0)" /></div>
          </div>
        </section>

        <section class="hiring-filter-group">
          <div class="hiring-filter-group__title"><u-icon name="i-lucide-user-round" /> {{ label("Профиль кандидата", "Candidate profile") }}</div>
          <div class="hiring-filter-group__grid">
            <div class="hiring__field"><u-input v-model.number="experienceMin" type="number" min="0" icon="i-lucide-briefcase" :label="t('experienceMin')" @change="scheduleLoad()" /></div>
            <div class="hiring__field hiring__age-range"><u-input v-model.number="ageMin" type="number" min="14" max="99" icon="i-lucide-user-round" :label="label('Возраст от', 'Age from')" @change="scheduleLoad()" /><u-input v-model.number="ageMax" type="number" min="14" max="99" icon="i-lucide-user-round" :label="label('Возраст до', 'Age to')" @change="scheduleLoad()" /></div>
            <div class="hiring__field"><u-select-menu :label="label('Пол', 'Gender')" v-model="genderSel" :items="genderItems" value-key="value" label-key="label" :search-input="false" class="hiring__select" @update:model-value="scheduleLoad()" /></div>
            <div class="hiring__field"><u-select-menu :label="t('seniority')" v-model="senioritySel" :items="seniorityItems" value-key="value" label-key="label" :search-input="false" class="hiring__select" @update:model-value="scheduleLoad()" /></div>
          </div>
        </section>

        <section class="hiring-filter-group hiring-filter-group_role">
          <div class="hiring-filter-group__title"><u-icon name="i-lucide-briefcase-business" /> {{ label("Должность и навыки", "Role & skills") }}</div>
          <div class="hiring-filter-group__grid">
            <div class="hiring__field hiring__field_wide hiring__profession-field">
              <u-select-menu :label="label('Желаемые должности', 'Desired positions')" v-model="professions" :items="professionItems" value-key="value" label-key="label" multiple searchable :placeholder="label('Любые должности', 'Any positions')" class="hiring__select" @update:model-value="scheduleLoad()" />
              <button v-if="professions.length" type="button" class="hiring__profession-clear" @click="clearProfessions"><u-icon name="i-lucide-x" /> {{ label("Сбросить профессии", "Clear positions") }} · {{ professions.length }}</button>
            </div>
            <div class="hiring__field hiring__field_wide"><u-input v-model="skills" icon="i-lucide-code" :label="t('skills')" :placeholder="t('skillsPlaceholder')" @change="scheduleLoad()" /></div>
          </div>
        </section>

        <div class="hiring-filter-actions"><u-button type="button" variant="ghost" color="neutral" size="sm" icon="i-lucide-rotate-ccw" @click="resetFilters">{{ t("reset") }}</u-button></div>
      </div>
'''
replace_between(hiring, '      <div v-if="showAdvanced" class="hiring__advanced">\n', '      </div>\n    </form>', hiring_advanced)

old_hiring_css = '''.hiring__advanced {
  grid-column: 1 / -1; display: grid; gap: 12px 14px; align-items: end; grid-template-columns: 1fr;
  padding: 14px; border-radius: 8px; border: 1px solid var(--line); background: rgba(255,255,255,0.02);
}
.hiring__presets {
  grid-column: 1 / -1; display: flex; flex-wrap: wrap; align-items: center; gap: 8px;
  padding-bottom: 12px; border-bottom: 1px solid var(--line);
}
.hiring__preset {
  display: inline-flex; align-items: center; gap: 8px; min-height: 32px; padding: 0 8px 0 11px;
  border: 1px solid var(--line); border-radius: 6px; background: var(--bg-panel); color: var(--text-primary); cursor: pointer;
}
.hiring__preset-remove { color: var(--text-muted); font-size: 18px; line-height: 1; }
.hiring__preset-remove:hover { color: var(--accent-pink); }
@media (min-width: 700px) { .hiring__advanced { grid-template-columns: repeat(3, 1fr); } }
@media (min-width: 1000px) { .hiring__advanced { grid-template-columns: repeat(4, 1fr); } .hiring__field_wide { grid-column: span 2; } }
.hiring__field { display: flex; flex-direction: column; gap: 5px; min-width: 0; }
.hiring__age-range, .hiring__salary-range { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
'''
new_hiring_css = '''.hiring__advanced {
  grid-column: 1 / -1; display: grid; grid-template-columns: 1fr; gap: 12px;
  padding: 14px; border-radius: 10px; border: 1px solid var(--line); background: rgba(255,255,255,0.02);
}
.hiring__presets {
  grid-column: 1 / -1; display: flex; flex-wrap: wrap; align-items: center; gap: 8px;
  padding-bottom: 12px; border-bottom: 1px solid var(--line);
}
.hiring__preset {
  display: inline-flex; align-items: center; gap: 8px; min-height: 32px; padding: 0 8px 0 11px;
  border: 1px solid var(--line); border-radius: 6px; background: var(--bg-panel); color: var(--text-primary); cursor: pointer;
}
.hiring__preset-remove { color: var(--text-muted); font-size: 18px; line-height: 1; }
.hiring__preset-remove:hover { color: var(--accent-pink); }
.hiring-filter-group { min-width: 0; padding: 14px; border: 1px solid var(--line); border-radius: 9px; background: rgba(255,255,255,0.025); }
.hiring-filter-group__title { display: flex; align-items: center; gap: 7px; margin-bottom: 12px; color: var(--ui-text-muted); font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: .04em; }
.hiring-filter-group__title :deep(svg) { color: var(--accent-pink); }
.hiring-filter-group__grid { display: grid; grid-template-columns: 1fr; gap: 12px; align-items: end; }
.hiring-filter-actions { display: flex; justify-content: flex-end; }
@media (min-width: 700px) {
  .hiring__advanced { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .hiring-filter-group__grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .hiring-filter-group__grid_salary { grid-template-columns: minmax(0, 1.5fr) minmax(110px, .6fr); }
  .hiring__field_wide { grid-column: span 2; }
  .hiring-filter-actions { grid-column: 1 / -1; }
}
.hiring__field { display: flex; flex-direction: column; gap: 5px; min-width: 0; }
.hiring__age-range, .hiring__salary-range { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
'''
replace_once(hiring, old_hiring_css, new_hiring_css)

# The candidate modal CTA should use the shared pink site accent rather than a blue override.
replace_once(hiring, '.hiring-modal-footer { --modal-footer-accent: #7189d9; --modal-footer-accent-text: #101428; }\n', '')

print('Grouped jobs/hiring filters applied')
