/**
 * Legal page content (§42–§48, §55, §56).
 *
 * Written from the backend-platform privacy audit (docs/privacy in
 * whiteslove.me-backend-platform), not from a template: every processing
 * activity, source, recipient and cookie named here exists in the code. Two
 * operator decisions are reflected: candidate gender and age are kept, and
 * people whose data comes from public sources are informed by this public
 * notice rather than individually (GDPR Art 14(5)(b)).
 *
 * Operator facts are never written here. Placeholders are filled from
 * configuration at render time:
 *   {controller}   PRIVACY_CONTROLLER_NAME
 *   {email}        PRIVACY_CONTACT_EMAIL
 *   {governingLaw} LEGAL_GOVERNING_LAW
 * A missing value renders as the locale's `unset` text and the page shows
 * that it requires operator review.
 */

export type LegalLocale = 'ru' | 'en'
export type LegalDocumentKey = 'privacy' | 'terms' | 'cookies' | 'legal' | 'dataRights'

export type LegalTable = { head: string[]; rows: string[][] }

export type LegalSection = {
  id: string
  title: string
  paragraphs?: string[]
  list?: string[]
  table?: LegalTable
}

export type LegalDocument = {
  title: string
  description: string
  sections: LegalSection[]
}

export const LEGAL_UPDATED_AT = '2026-09-17'

export const LEGAL_ROUTES: Record<LegalDocumentKey, string> = {
  privacy: '/privacy',
  terms: '/terms',
  cookies: '/cookies',
  legal: '/legal',
  dataRights: '/data-rights',
}

type LegalChrome = {
  navTitle: string
  nav: Record<LegalDocumentKey, string>
  updated: string
  contents: string
  unset: string
  reviewBanner: string
}

export const LEGAL_CHROME: Record<LegalLocale, LegalChrome> = {
  ru: {
    navTitle: 'Правовая информация',
    nav: {
      privacy: 'Конфиденциальность',
      terms: 'Условия использования',
      cookies: 'Cookies',
      legal: 'Правовая информация',
      dataRights: 'Мои данные',
    },
    updated: 'Обновлено',
    contents: 'Содержание',
    unset: '[не указано оператором]',
    reviewBanner: 'Часть сведений об операторе ещё не заполнена. Документ требует проверки оператором перед использованием.',
  },
  en: {
    navTitle: 'Legal',
    nav: {
      privacy: 'Privacy',
      terms: 'Terms of use',
      cookies: 'Cookies',
      legal: 'Legal notice',
      dataRights: 'Your data',
    },
    updated: 'Updated',
    contents: 'Contents',
    unset: '[not provided by the operator]',
    reviewBanner: 'Some operator details are not configured yet. This document requires operator review before it is relied on.',
  },
}

// ---------------------------------------------------------------------------
// Russian
// ---------------------------------------------------------------------------

const ru: Record<LegalDocumentKey, LegalDocument> = {
  privacy: {
    title: 'Политика конфиденциальности',
    description: 'Какие персональные данные обрабатывает WhitesLove, откуда они берутся, зачем и какие у вас права.',
    sections: [
      {
        id: 'controller',
        title: '1. Кто отвечает за данные',
        paragraphs: [
          'Контролёр данных — {controller}, физическое лицо, оператор сайта whiteslove.me и связанных сервисов (Flat Finder, поиск вакансий и резюме, Telegram-подписки).',
          'По любым вопросам о персональных данных пишите на {email}. Инспектор по защите данных (DPO) не назначен.',
        ],
      },
      {
        id: 'scope',
        title: '2. Что это за сервис',
        paragraphs: [
          'WhitesLove собирает публичные объявления об аренде и продаже жилья, вакансии и резюме из открытых источников и показывает их в одном месте. Также сервис проверяет объявления на признаки копирования, фиктивности и повторных публикаций.',
          'Большинство людей, чьи данные мы обрабатываем, не передавали их нам напрямую: данные взяты из публичных объявлений и профилей. Этот раздел и раздел 4 — информация, которую статья 14 GDPR требует предоставить таким людям.',
        ],
      },
      {
        id: 'sources',
        title: '3. Откуда берутся данные',
        list: [
          'Публичные объявления о жилье: OLX, публичные Telegram-каналы, публичные страницы и группы Facebook, сайты собственников и агентств.',
          'Публичные вакансии и резюме: сайты вакансий (например hh, work.ua, robota.ua, rabota.kz, enbek.kz, djinni.co, ejobs.ro, bestjobs.eu), публичные страницы LinkedIn, Telegram, Facebook и Threads.',
          'Публичные профили в мессенджерах и соцсетях, указанные в объявлениях: имя пользователя, отображаемое имя, описание профиля.',
          'Внутренний реестр оператора (ранее вёлся в Google Таблицах): заметки о риелторах, номерах и псевдонимах.',
          'Сообщения пользователей о неактуальных или неверных объявлениях.',
          'Производные сведения: признаки достоверности, которые система вычисляет из перечисленного выше.',
          'Данные, которые вы передаёте сами: Telegram-подписка на поиск, запрос о персональных данных.',
          'Технические данные посетителей сайта: IP-адрес и выбранные настройки (см. Политику cookies).',
        ],
      },
      {
        id: 'categories',
        title: '4. Какие данные и зачем',
        table: {
          head: ['Цель', 'Данные', 'Правовое основание'],
          rows: [
            ['Показ объявлений о жилье и кнопок связи', 'Текст и фото объявления, указанный контакт (телефон, Telegram и т. п.), ссылка на источник', 'Законный интерес (ст. 6(1)(f)): помочь людям найти жильё; контакт опубликован именно для связи'],
            ['Выявление копий, фиктивных и повторно публикуемых объявлений', 'История объявления, отпечатки фотографий, результаты проверок доступности', 'Законный интерес: защита от мошенничества'],
            ['Сопоставление одного рекламодателя в разных каналах', 'Телефоны, имена пользователей, отображаемые имена и их изменения, роль (собственник, агент)', 'Законный интерес: защита от мошенничества'],
            ['Оценка достоверности (профилирование)', 'Коды причин, доказательства, решения модераторов', 'Законный интерес: защита от мошенничества'],
            ['Показ вакансий', 'Компания, должность, текст вакансии, контакт рекрутера', 'Законный интерес: помочь найти работу'],
            ['Показ резюме', 'Имя, роль, город, опыт, навыки, языки, ожидания по зарплате, пол и возраст (если указаны кандидатом), ссылка на источник', 'Законный интерес: помочь работодателям найти кандидатов, опубликовавших резюме'],
            ['Устранение дублей резюме', 'Email, телефон, Telegram ID, ссылка на профиль', 'Законный интерес; объединение только по совпадению этих данных, никогда по имени'],
            ['Telegram-подписки', 'Telegram ID и чат, имя пользователя, имя, язык, сохранённые поиски', 'Договор (ст. 6(1)(b))'],
            ['Обработка запросов о данных и споров', 'Ваш email, указанные идентификаторы, текст запроса, решение', 'Юридическая обязанность (ст. 6(1)(c))'],
            ['Безопасность и защита от злоупотреблений', 'IP-адрес', 'Законный интерес'],
          ],
        },
        paragraphs: [
          'Мы не собираем намеренно и не выводим данные особых категорий: о здоровье, религии, политических взглядах, сексуальной ориентации, биометрии. Фотографии объявлений сравниваются только для поиска копий, а не для распознавания людей.',
        ],
      },
      {
        id: 'legitimate-interests',
        title: '5. Законный интерес',
        paragraphs: [
          'Объявления и резюме публикуются, чтобы их увидели и откликнулись. Сводный поиск по ним — ожидаемое использование. Проверка на мошенничество защищает тех, кто ищет жильё, и честных рекламодателей, чьи объявления копируют.',
          'Мы оценили, что эти интересы не перевешивают ваши права, с учётом мер защиты: сведения о риске и история идентичности не публикуются, решения с серьёзными последствиями принимает человек, данные хранятся ограниченное время, и вы можете возразить в любой момент (раздел 10).',
        ],
      },
      {
        id: 'profiling',
        title: '6. Автоматическая оценка и профилирование',
        paragraphs: [
          'Система оценивает объявления и рекламодателей по нескольким отдельным признакам (реальность объекта, актуальность, происхождение объявления, согласованность данных, платёжные риски, поведение) и хранит причины каждой оценки.',
          'Публично могут отображаться только нейтральные сведения об объявлении: «доступность не подтверждена», «объявление публикуется повторно», «данные источников расходятся». Мы не публикуем обвинений в адрес людей.',
          'Никакие решения с юридическими или сопоставимо значимыми последствиями — например, блокировка или скрытие всех объявлений человека — не принимаются только автоматически: их подтверждает модератор, и решение фиксируется. Вы можете оспорить любые сведения о себе (раздел 10).',
        ],
      },
      {
        id: 'recipients',
        title: '7. Кому передаются данные',
        list: [
          'Посетители сайта — объявления, вакансии и резюме в том виде, в каком они опубликованы в источнике.',
          'Хостинг-провайдер, на серверах которого работает сервис.',
          'Провайдеры ИИ для разбора текста и фото объявлений (через наш шлюз; в зависимости от настроек — Groq, Google Gemini, NVIDIA, Hugging Face, LLM7, OpenRouter, Mistral, Cloudflare Workers AI). Контакты удаляются из текста перед разбором; при переводе текст передаётся целиком.',
          'Telegram — для отправки уведомлений по подписке.',
          'OpenStreetMap — картографические плитки загружаются вашим браузером напрямую, поэтому OpenStreetMap получает ваш IP-адрес.',
          'Google — только для чтения внутреннего реестра оператора.',
        ],
        paragraphs: [
          'Сведения о рисках, история идентичности и внутренний реестр не передаются никому, кроме оператора и модераторов.',
        ],
      },
      {
        id: 'transfers',
        title: '8. Передача за пределы ЕЭЗ',
        paragraphs: [
          'Часть провайдеров ИИ находится за пределами Европейской экономической зоны, в том числе в США. Передача выполняется на условиях этих провайдеров. Чтобы узнать, какие меры защиты применяются к конкретной передаче, напишите на {email}.',
        ],
      },
      {
        id: 'retention',
        title: '9. Сколько хранятся данные',
        paragraphs: ['Мы не храним данные бессрочно. Ориентировочные сроки:'],
        list: [
          'Активные объявления — пока объявление опубликовано в источнике; история объявлений — 12 месяцев.',
          'История имён пользователей и отображаемых имён — 12 месяцев.',
          'Контакты, не встречавшиеся в объявлениях, — 18 месяцев.',
          'Сведения о рисках — от 6 месяцев (отклонённые) до 36 месяцев (подтверждённые модератором) с последнего наблюдения.',
          'Резюме — пока активно в источнике и 6 месяцев после.',
          'Telegram-подписки — до отписки; неактивные — 12 месяцев.',
          'Запросы о данных и споры — 36 месяцев после закрытия.',
          'Технические журналы — 30 дней.',
          'Данные, по которым открыт спор, хранятся до его решения.',
        ],
      },
      {
        id: 'rights',
        title: '10. Ваши права',
        list: [
          'Узнать, какие данные о вас есть, и получить их копию.',
          'Исправить неточные данные.',
          'Потребовать удаления.',
          'Ограничить обработку, например на время проверки точности.',
          'Возразить против обработки на основании законного интереса — в том числе против профилирования.',
          'Получить данные, которые вы предоставили сами (Telegram-подписка), в машиночитаемом виде.',
          'Оспорить сведения о своей личности, роли, контактах или рисках.',
        ],
        paragraphs: [
          'Подать запрос можно на странице «Мои данные» или по адресу {email}. Мы отвечаем в течение месяца; в сложных случаях срок может быть продлён ещё на два месяца с объяснением причин.',
          'Чтобы не раскрыть чужие данные, мы проверяем, что указанный телефон, аккаунт или email принадлежит вам. Документы, удостоверяющие личность, мы не запрашиваем.',
          'Вы вправе подать жалобу в надзорный орган по защите данных по месту жительства, работы или предполагаемого нарушения.',
        ],
      },
      {
        id: 'security',
        title: '11. Безопасность',
        paragraphs: [
          'Соединения шифруются, внутренние сведения доступны только по отдельному ключу администратора, каждое решение модератора записывается в журнал, а журналы ошибок не содержат персональных данных.',
        ],
      },
      {
        id: 'changes',
        title: '12. Изменения',
        paragraphs: ['Мы обновляем эту политику при изменении обработки. Дата последнего обновления указана вверху страницы.'],
      },
    ],
  },

  terms: {
    title: 'Условия использования',
    description: 'Правила использования WhitesLove: что предоставляет сервис, чего он не гарантирует и что запрещено.',
    sections: [
      {
        id: 'service',
        title: '1. Сервис',
        paragraphs: [
          'WhitesLove (whiteslove.me) — сервис, который собирает публичные объявления о жилье, вакансии и резюме из сторонних источников и показывает их в удобном виде. Оператор — {controller}.',
          'Пользуясь сайтом, вы соглашаетесь с этими условиями.',
        ],
      },
      {
        id: 'third-party',
        title: '2. Сторонние объявления',
        paragraphs: [
          'Объявления, вакансии и резюме созданы третьими лицами и опубликованы на других площадках. Мы не являемся стороной сделок, не проверяем объявления вручную и не представляем интересы рекламодателей.',
        ],
      },
      {
        id: 'no-guarantee',
        title: '3. Что мы не гарантируем',
        list: [
          'Актуальность объявления: объект может быть уже сдан или продан.',
          'Точность цены, описания, фотографий и адреса.',
          'Личность рекламодателя: имя и роль (собственник, агент) указаны им самим; проверка личности, если отображается, указана отдельно.',
          'Полноту и безошибочность автоматических отметок о достоверности. Они служат подсказкой, а не заключением.',
        ],
      },
      {
        id: 'contacts',
        title: '4. Кнопки связи и сторонние платформы',
        paragraphs: [
          'Кнопки «Позвонить», Telegram, WhatsApp, Viber, Facebook и Threads — лишь удобный способ открыть контакт, опубликованный рекламодателем. Переписка ведётся на сторонних платформах, и к ней применяются их условия и политики.',
        ],
      },
      {
        id: 'responsibility',
        title: '5. Ваша ответственность',
        paragraphs: [
          'Вы самостоятельно решаете, связываться ли с рекламодателем и заключать ли сделку. Не переводите деньги до осмотра объекта и проверки документов, не передавайте номер карты и коды из SMS.',
        ],
      },
      {
        id: 'abuse',
        title: '6. Что запрещено',
        list: [
          'Автоматический массовый сбор данных с сайта, обход ограничений частоты запросов и защиты.',
          'Массовая рассылка по контактам из объявлений.',
          'Использование данных для преследования, дискриминации или мошенничества.',
          'Попытки получить доступ к внутренним данным или административным функциям.',
          'Ложные сообщения о нарушениях и запросы о чужих данных.',
        ],
      },
      {
        id: 'reporting',
        title: '7. Сообщения о нарушениях',
        paragraphs: [
          'Сообщить о неактуальном или неверном объявлении, выдаче себя за другого или ошибке в ваших данных можно на странице «Мои данные» или по адресу {email}. Сообщения проверяются и не считаются доказательством сами по себе.',
        ],
      },
      {
        id: 'limitation',
        title: '8. Ограничение ответственности',
        paragraphs: [
          'Сервис предоставляется «как есть». В пределах, допустимых законом, оператор не отвечает за убытки, вызванные содержанием сторонних объявлений, сделками между пользователями и рекламодателями или временной недоступностью сервиса.',
        ],
      },
      {
        id: 'changes',
        title: '9. Изменения условий',
        paragraphs: ['Условия могут меняться; дата последнего обновления указана вверху страницы. Продолжая пользоваться сайтом, вы принимаете новую редакцию.'],
      },
      {
        id: 'law',
        title: '10. Применимое право и контакты',
        paragraphs: [
          'Применимое право: {governingLaw}. Это не ограничивает права, которые дают вам обязательные нормы закона страны вашего проживания.',
          'Контакт оператора: {email}.',
        ],
      },
    ],
  },

  cookies: {
    title: 'Политика cookies',
    description: 'Какие cookies и локальное хранилище использует WhitesLove.',
    sections: [
      {
        id: 'summary',
        title: 'Коротко',
        paragraphs: [
          'Мы не используем аналитику, рекламные или отслеживающие cookies. Сайт сохраняет только ваши собственные настройки, поэтому баннер согласия не нужен.',
        ],
      },
      {
        id: 'table',
        title: 'Что сохраняется',
        table: {
          head: ['Название', 'Тип', 'Зачем', 'Срок'],
          rows: [
            ['i18n_lang', 'Cookie', 'Запоминает выбранный язык', 'До очистки или истечения срока cookie'],
            ['nuxt-color-mode', 'Cookie и localStorage', 'Тема оформления', '1 год'],
            ['flats:*, настройки поиска вакансий и резюме', 'localStorage', 'Фильтры, пресеты, недавно просмотренное', 'До очистки браузера'],
            ['Ответы в квизах, черновики редакторов', 'localStorage', 'Сохраняет вашу работу в браузере', 'До очистки браузера'],
          ],
        },
        paragraphs: [
          'Данные localStorage остаются в вашем браузере и не отправляются на сервер.',
        ],
      },
      {
        id: 'third-party',
        title: 'Сторонние запросы',
        paragraphs: [
          'На страницах с картой браузер загружает плитки с серверов OpenStreetMap, которые получают ваш IP-адрес. OpenStreetMap не устанавливает cookies через наш сайт.',
        ],
      },
      {
        id: 'control',
        title: 'Как управлять',
        paragraphs: ['Вы можете удалить cookies и данные сайта в настройках браузера. Сайт продолжит работать, но забудет ваши настройки.'],
      },
    ],
  },

  legal: {
    title: 'Правовая информация',
    description: 'Сведения об операторе WhitesLove.',
    sections: [
      {
        id: 'operator',
        title: 'Оператор',
        table: {
          head: ['', ''],
          rows: [
            ['Оператор', '{controller}'],
            ['Статус', 'Физическое лицо'],
            ['Контакт', '{email}'],
            ['Применимое право', '{governingLaw}'],
          ],
        },
        paragraphs: [
          'Оператор — физическое лицо, поэтому сведения о регистрации компании (регистрационный номер, юридический адрес, ИНН) не применимы.',
        ],
      },
      {
        id: 'content',
        title: 'Содержание сайта',
        paragraphs: [
          'Объявления, вакансии и резюме принадлежат их авторам и опубликованы на сторонних площадках; ссылки на источники указаны на карточках.',
        ],
      },
      {
        id: 'documents',
        title: 'Документы',
        paragraphs: ['Политика конфиденциальности, Условия использования, Политика cookies и страница «Мои данные» доступны по ссылкам внизу сайта.'],
      },
    ],
  },

  dataRights: {
    title: 'Мои данные',
    description: 'Как узнать, исправить, удалить или оспорить данные о себе в WhitesLove.',
    sections: [
      {
        id: 'intro',
        title: 'Если ваши данные попали в WhitesLove',
        paragraphs: [
          'Мы показываем публичные объявления, вакансии и резюме, поэтому у нас могут быть ваш телефон, имя пользователя или профиль. Здесь можно узнать, что именно у нас есть, и распорядиться этим.',
        ],
      },
      {
        id: 'what',
        title: 'Что можно запросить',
        list: [
          'Какие данные у вас есть обо мне? — перечень и копия данных, включая причины автоматических оценок.',
          'Исправьте неточные данные — например, неверную роль или устаревшее имя.',
          'Удалите данные.',
          'Ограничьте обработку — например, пока проверяется точность.',
          'Прекратите обработку — возражение против обработки на основании законного интереса.',
          'Выгрузите данные — для данных, которые вы предоставили сами (Telegram-подписка).',
          'Оспорьте сведения о личности или рисках — ошибочно привязанный номер, объединение с другим человеком, неверная роль, чужое объявление, неверные сведения о риске.',
        ],
      },
      {
        id: 'verification',
        title: 'Как мы проверяем, что это вы',
        paragraphs: [
          'Данные у нас привязаны к телефонам, аккаунтам и email, а не к именам. Поэтому мы просим подтвердить, что указанный идентификатор ваш: например, ответить на сообщение или назвать код, отправленный на этот номер или адрес.',
          'Мы не просим паспорт или другие документы. Пока идентификатор не подтверждён, мы ничего не раскрываем — это защищает вас от того, кто укажет ваш номер.',
          'Если к вашему номеру ошибочно привязаны чужие контакты, мы не покажем их, но сообщим, что такая привязка есть, — чтобы вы могли её оспорить.',
        ],
      },
      {
        id: 'timeline',
        title: 'Сроки',
        paragraphs: [
          'Мы отвечаем в течение месяца. В сложных случаях срок может быть продлён ещё на два месяца — мы сообщим причину. Спорные сведения не удаляются автоматически, но и не используются публично, пока спор не решён.',
        ],
      },
      {
        id: 'contact',
        title: 'Другой способ',
        paragraphs: ['Если форма не подходит, напишите на {email}.'],
      },
    ],
  },
}

// ---------------------------------------------------------------------------
// English
// ---------------------------------------------------------------------------

const en: Record<LegalDocumentKey, LegalDocument> = {
  privacy: {
    title: 'Privacy notice',
    description: 'What personal data WhitesLove processes, where it comes from, why, and your rights.',
    sections: [
      {
        id: 'controller',
        title: '1. Who is responsible',
        paragraphs: [
          'The controller is {controller}, a natural person who operates whiteslove.me and its related services (Flat Finder, job and CV search, Telegram subscriptions).',
          'For any question about personal data, write to {email}. No Data Protection Officer has been appointed.',
        ],
      },
      {
        id: 'scope',
        title: '2. What the service does',
        paragraphs: [
          'WhitesLove collects public housing listings, job vacancies and CVs from open sources and shows them in one place. It also checks listings for signs of copying, fake availability and repeated reposting.',
          'Most people whose data we process did not give it to us directly: it comes from public advertisements and profiles. This section and section 4 are the information Article 14 GDPR requires us to give them.',
        ],
      },
      {
        id: 'sources',
        title: '3. Where the data comes from',
        list: [
          'Public housing listings: OLX, public Telegram channels, public Facebook pages and groups, owner and agency websites.',
          'Public vacancies and CVs: job boards (for example hh, work.ua, robota.ua, rabota.kz, enbek.kz, djinni.co, ejobs.ro, bestjobs.eu), public LinkedIn pages, Telegram, Facebook and Threads.',
          'Public messenger and social profiles named in listings: username, display name, profile description.',
          "The operator's internal registry (previously kept in Google Sheets): notes about realtors, numbers and aliases.",
          'Reports from users about outdated or incorrect listings.',
          'Derived information: integrity signals the system computes from the sources above.',
          'Data you give us yourself: a Telegram search subscription, a data request.',
          'Technical data from site visitors: IP address and chosen settings (see the Cookie policy).',
        ],
      },
      {
        id: 'categories',
        title: '4. What data, and why',
        table: {
          head: ['Purpose', 'Data', 'Legal basis'],
          rows: [
            ['Showing housing listings and contact buttons', 'Listing text and photos, the published contact (phone, Telegram, etc.), source link', 'Legitimate interests (Art 6(1)(f)): helping people find housing; the contact was published to be contacted'],
            ['Detecting copied, fake and repeatedly reposted listings', 'Listing history, photo fingerprints, availability check results', 'Legitimate interests: fraud prevention'],
            ['Recognising the same advertiser across channels', 'Phone numbers, usernames, display names and their changes, role (owner, agent)', 'Legitimate interests: fraud prevention'],
            ['Integrity assessment (profiling)', 'Reason codes, evidence, reviewer decisions', 'Legitimate interests: fraud prevention'],
            ['Showing vacancies', 'Company, job title, vacancy text, recruiter contact', 'Legitimate interests: helping people find work'],
            ['Showing CVs', 'Name, role, city, experience, skills, languages, salary expectations, gender and age (where stated by the candidate), source link', 'Legitimate interests: helping employers find candidates who published a CV'],
            ['De-duplicating CVs', 'Email, phone, Telegram ID, profile link', 'Legitimate interests; merged only when these match, never on a name'],
            ['Telegram subscriptions', 'Telegram ID and chat, username, first name, language, saved searches', 'Contract (Art 6(1)(b))'],
            ['Handling data requests and disputes', 'Your email, the identifiers you give, request text, outcome', 'Legal obligation (Art 6(1)(c))'],
            ['Security and abuse prevention', 'IP address', 'Legitimate interests'],
          ],
        },
        paragraphs: [
          'We do not intentionally collect or infer special-category data: health, religion, political opinions, sexual orientation, biometrics. Listing photos are compared only to find copies, never to recognise people.',
        ],
      },
      {
        id: 'legitimate-interests',
        title: '5. Legitimate interests',
        paragraphs: [
          'Listings and CVs are published in order to be seen and answered; searching them in one place is an expected use. Fraud checks protect people looking for housing, and honest advertisers whose listings are copied.',
          'We have assessed that these interests are not overridden by your rights, given the safeguards: risk information and identity history are never published, decisions with serious consequences are taken by a person, data is kept for limited periods, and you can object at any time (section 10).',
        ],
      },
      {
        id: 'profiling',
        title: '6. Automated assessment and profiling',
        paragraphs: [
          'The system assesses listings and advertisers on several separate dimensions (whether the property is real, availability, where the listing came from, consistency, payment risk, behaviour) and stores the reasons for each assessment.',
          'Only neutral statements about a listing may be shown publicly: "availability not confirmed", "listing appears repeatedly", "source information is inconsistent". We do not publish accusations about people.',
          "No decision with legal or similarly significant effect — such as blocking a person or hiding all of their listings — is taken solely by automated means: a reviewer confirms it and the decision is recorded. You can contest anything we hold about you (section 10).",
        ],
      },
      {
        id: 'recipients',
        title: '7. Who receives the data',
        list: [
          'Site visitors — listings, vacancies and CVs as published at the source.',
          'The hosting provider whose servers run the service.',
          'AI providers that analyse listing text and photos (through our gateway; depending on configuration: Groq, Google Gemini, NVIDIA, Hugging Face, LLM7, OpenRouter, Mistral, Cloudflare Workers AI). Contacts are removed from text before analysis; translation sends the full text.',
          'Telegram — to deliver subscription notifications.',
          'OpenStreetMap — map tiles are loaded by your browser directly, so OpenStreetMap receives your IP address.',
          "Google — only to read the operator's internal registry.",
        ],
        paragraphs: [
          'Risk information, identity history and the internal registry are not shared with anyone other than the operator and reviewers.',
        ],
      },
      {
        id: 'transfers',
        title: '8. Transfers outside the EEA',
        paragraphs: [
          'Some AI providers are located outside the European Economic Area, including in the United States. Transfers take place on those providers\' terms. To find out which safeguards apply to a particular transfer, write to {email}.',
        ],
      },
      {
        id: 'retention',
        title: '9. How long data is kept',
        paragraphs: ['Nothing is kept indefinitely. Indicative periods:'],
        list: [
          'Active listings — while published at the source; listing history — 12 months.',
          'Username and display-name history — 12 months.',
          'Contacts no longer seen in listings — 18 months.',
          'Risk information — from 6 months (dismissed) to 36 months (confirmed by a reviewer) after it was last observed.',
          'CVs — while active at the source and 6 months after.',
          'Telegram subscriptions — until you unsubscribe; inactive ones 12 months.',
          'Data requests and disputes — 36 months after closure.',
          'Technical logs — 30 days.',
          'Data under an open dispute is kept until the dispute is decided.',
        ],
      },
      {
        id: 'rights',
        title: '10. Your rights',
        list: [
          'Find out what data we hold about you and get a copy.',
          'Have inaccurate data corrected.',
          'Have data erased.',
          'Restrict processing, for example while accuracy is checked.',
          'Object to processing based on legitimate interests, including profiling.',
          'Receive data you provided yourself (Telegram subscription) in a machine-readable form.',
          'Contest information about your identity, role, contacts or risk.',
        ],
        paragraphs: [
          'Make a request on the "Your data" page or at {email}. We reply within one month; complex requests may take two further months, and we will tell you why.',
          'To avoid disclosing someone else\'s data, we check that the phone, account or email you give is yours. We do not ask for identity documents.',
          'You have the right to lodge a complaint with a data protection supervisory authority where you live, work, or where the alleged infringement took place.',
        ],
      },
      {
        id: 'security',
        title: '11. Security',
        paragraphs: [
          'Connections are encrypted, internal information requires a separate administrator key, every reviewer decision is written to an audit log, and error logs contain no personal data.',
        ],
      },
      {
        id: 'changes',
        title: '12. Changes',
        paragraphs: ['We update this notice when processing changes. The date of the last update is shown at the top of the page.'],
      },
    ],
  },

  terms: {
    title: 'Terms of use',
    description: 'Rules for using WhitesLove: what the service provides, what it does not guarantee, and what is prohibited.',
    sections: [
      {
        id: 'service',
        title: '1. The service',
        paragraphs: [
          'WhitesLove (whiteslove.me) collects public housing listings, vacancies and CVs from third-party sources and presents them in one place. It is operated by {controller}.',
          'By using the site you agree to these terms.',
        ],
      },
      {
        id: 'third-party',
        title: '2. Third-party listings',
        paragraphs: [
          'Listings, vacancies and CVs are created by third parties and published on other platforms. We are not a party to any transaction, do not review listings manually and do not represent advertisers.',
        ],
      },
      {
        id: 'no-guarantee',
        title: '3. What we do not guarantee',
        list: [
          'That a listing is still available: the property may already be let or sold.',
          'The accuracy of prices, descriptions, photos and addresses.',
          'The identity of the advertiser: name and role (owner, agent) are self-declared; identity verification, where shown, is shown separately.',
          'That automated integrity notes are complete or free of error. They are a hint, not a finding.',
        ],
      },
      {
        id: 'contacts',
        title: '4. Contact buttons and third-party platforms',
        paragraphs: [
          'The Call, Telegram, WhatsApp, Viber, Facebook and Threads buttons are only a convenient way to open a contact the advertiser published. Conversations take place on third-party platforms, whose own terms and policies apply.',
        ],
      },
      {
        id: 'responsibility',
        title: '5. Your responsibility',
        paragraphs: [
          'You decide whether to contact an advertiser and whether to enter into a transaction. Do not send money before viewing the property and checking documents, and never share a card number or SMS codes.',
        ],
      },
      {
        id: 'abuse',
        title: '6. Prohibited use',
        list: [
          'Automated bulk collection of data from the site, or circumventing rate limits and protections.',
          'Bulk messaging of contacts taken from listings.',
          'Using the data to harass, discriminate against or defraud anyone.',
          'Attempting to access internal data or administrative functions.',
          "False reports and requests for other people's data.",
        ],
      },
      {
        id: 'reporting',
        title: '7. Reporting',
        paragraphs: [
          'Report an outdated or incorrect listing, impersonation, or an error in your data on the "Your data" page or at {email}. Reports are reviewed and are not treated as proof on their own.',
        ],
      },
      {
        id: 'limitation',
        title: '8. Limitation of liability',
        paragraphs: [
          'The service is provided "as is". To the extent permitted by law, the operator is not liable for losses arising from the content of third-party listings, transactions between users and advertisers, or temporary unavailability of the service.',
        ],
      },
      {
        id: 'changes',
        title: '9. Changes to these terms',
        paragraphs: ['These terms may change; the date of the last update is shown at the top of the page. Continuing to use the site means accepting the updated terms.'],
      },
      {
        id: 'law',
        title: '10. Governing law and contact',
        paragraphs: [
          'Governing law: {governingLaw}. This does not limit rights given to you by mandatory law of the country where you live.',
          'Operator contact: {email}.',
        ],
      },
    ],
  },

  cookies: {
    title: 'Cookie policy',
    description: 'Which cookies and local storage WhitesLove uses.',
    sections: [
      {
        id: 'summary',
        title: 'In short',
        paragraphs: [
          'We use no analytics, advertising or tracking cookies. The site stores only your own settings, so no consent banner is needed.',
        ],
      },
      {
        id: 'table',
        title: 'What is stored',
        table: {
          head: ['Name', 'Type', 'Purpose', 'Lifetime'],
          rows: [
            ['i18n_lang', 'Cookie', 'Remembers your language', 'Until cleared or the cookie expires'],
            ['nuxt-color-mode', 'Cookie and localStorage', 'Colour theme', '1 year'],
            ['flats:*, job and CV search settings', 'localStorage', 'Filters, presets, recently viewed', 'Until you clear your browser'],
            ['Quiz answers, editor drafts', 'localStorage', 'Keeps your work in your browser', 'Until you clear your browser'],
          ],
        },
        paragraphs: ['localStorage data stays in your browser and is never sent to our server.'],
      },
      {
        id: 'third-party',
        title: 'Third-party requests',
        paragraphs: [
          'On pages with a map your browser loads tiles from OpenStreetMap servers, which receive your IP address. OpenStreetMap sets no cookies through our site.',
        ],
      },
      {
        id: 'control',
        title: 'Managing storage',
        paragraphs: ['You can delete cookies and site data in your browser settings. The site keeps working but forgets your settings.'],
      },
    ],
  },

  legal: {
    title: 'Legal notice',
    description: 'Information about the operator of WhitesLove.',
    sections: [
      {
        id: 'operator',
        title: 'Operator',
        table: {
          head: ['', ''],
          rows: [
            ['Operator', '{controller}'],
            ['Status', 'Natural person'],
            ['Contact', '{email}'],
            ['Governing law', '{governingLaw}'],
          ],
        },
        paragraphs: [
          'The operator is a natural person, so company registration details (registration number, registered office, tax ID) do not apply.',
        ],
      },
      {
        id: 'content',
        title: 'Site content',
        paragraphs: [
          'Listings, vacancies and CVs belong to their authors and are published on third-party platforms; each card links to its source.',
        ],
      },
      {
        id: 'documents',
        title: 'Documents',
        paragraphs: ['The Privacy notice, Terms of use, Cookie policy and the "Your data" page are linked at the bottom of every page.'],
      },
    ],
  },

  dataRights: {
    title: 'Your data',
    description: 'How to find out, correct, erase or contest the data WhitesLove holds about you.',
    sections: [
      {
        id: 'intro',
        title: 'If your data is on WhitesLove',
        paragraphs: [
          'We show public listings, vacancies and CVs, so we may hold your phone number, username or profile. Here you can find out exactly what we hold and decide what happens to it.',
        ],
      },
      {
        id: 'what',
        title: 'What you can ask for',
        list: [
          'What data do you have about me? — a list and a copy, including the reasons behind automated assessments.',
          'Correct inaccurate data — for example a wrong role or an outdated name.',
          'Remove my data.',
          'Restrict processing — for example while accuracy is being checked.',
          'Stop processing — an objection to processing based on legitimate interests.',
          'Export my data — for data you provided yourself (Telegram subscription).',
          'Challenge identity or risk information — a wrongly linked number, being merged with someone else, a wrong role, a listing that is not yours, incorrect risk information.',
        ],
      },
      {
        id: 'verification',
        title: 'How we check it is you',
        paragraphs: [
          'Our data is keyed on phone numbers, accounts and email addresses, not on names. So we ask you to show that the identifier you give is yours — for example by replying to a message or telling us a code sent to that number or address.',
          'We do not ask for a passport or other documents. Until an identifier is confirmed we disclose nothing, which protects you from someone who enters your number.',
          'If contacts that are not yours have been wrongly linked to your number, we will not show them, but we will tell you the link exists so you can contest it.',
        ],
      },
      {
        id: 'timeline',
        title: 'Timing',
        paragraphs: [
          'We reply within one month. Complex requests may take two further months, and we will tell you why. Disputed information is not erased automatically, but it is not used publicly until the dispute is decided.',
        ],
      },
      {
        id: 'contact',
        title: 'Another way',
        paragraphs: ['If the form does not suit you, write to {email}.'],
      },
    ],
  },
}

export const LEGAL_CONTENT: Record<LegalLocale, Record<LegalDocumentKey, LegalDocument>> = { ru, en }

export function legalLocale(value: unknown): LegalLocale {
  return value === 'en' ? 'en' : 'ru'
}

export type LegalPlaceholders = { controller: string; email: string; governingLaw: string }

/** Fills placeholders. Unknown placeholders are left visible rather than blanked. */
export function fillLegalText(text: string, values: LegalPlaceholders, unset: string): string {
  return text.replace(/\{(controller|email|governingLaw)\}/gu, (_match, key: keyof LegalPlaceholders) => values[key] || unset)
}
