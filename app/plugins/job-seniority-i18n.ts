export default defineNuxtPlugin((nuxtApp) => {
  const i18n = nuxtApp.$i18n as any
  const merge = i18n?.mergeLocaleMessage?.bind(i18n)
    || i18n?.global?.mergeLocaleMessage?.bind(i18n.global)
  if (!merge) return

  merge('en', {
    jobs: {
      seniorityIntern: 'Intern',
      seniorityStaff: 'Staff',
      seniorityPrincipal: 'Principal',
      seniorityHead: 'Head',
      seniorityDirector: 'Director',
      seniorityVp: 'VP',
      seniorityChief: 'Chief',
      empProject: 'Project work',
      empFreelance: 'Freelance',
      empVolunteer: 'Volunteer',
      empSeasonal: 'Seasonal',
      scheduleShift: 'Shift work',
      scheduleFlexible: 'Flexible schedule',
      scheduleDay: 'Day shift',
      scheduleNight: 'Night shift',
      scheduleRotational: 'Rotational schedule',
      contractEmployment: 'Employment contract',
      contractCivil: 'Civil contract',
      contractFreelance: 'Freelance',
      contractContractor: 'Contractor',
      contractB2b: 'B2B',
      requirementRequired: 'Required',
      requirementPreferred: 'Preferred',
      requirementNotRequired: 'Not required',
    },
  })
  merge('ru', {
    jobs: {
      seniorityIntern: 'Стажёр',
      seniorityStaff: 'Staff-инженер',
      seniorityPrincipal: 'Principal-инженер',
      seniorityHead: 'Руководитель направления',
      seniorityDirector: 'Директор',
      seniorityVp: 'Вице-президент',
      seniorityChief: 'Руководитель высшего уровня',
      empProject: 'Проектная работа',
      empFreelance: 'Фриланс',
      empVolunteer: 'Волонтёрство',
      empSeasonal: 'Сезонная работа',
      scheduleShift: 'Сменный график',
      scheduleFlexible: 'Гибкий график',
      scheduleDay: 'Дневная смена',
      scheduleNight: 'Ночная смена',
      scheduleRotational: 'Вахтовый график',
      contractEmployment: 'Трудовой договор',
      contractCivil: 'Гражданско-правовой договор',
      contractFreelance: 'Фриланс',
      contractContractor: 'Подрядчик',
      contractB2b: 'B2B',
      requirementRequired: 'Обязательно',
      requirementPreferred: 'Желательно',
      requirementNotRequired: 'Не обязательно',
    },
  })
})
