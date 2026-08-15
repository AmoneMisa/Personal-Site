export interface SkillMeta {
  category: string
  subcategory: string
}

export interface SkillDefinition extends SkillMeta {
  name: string
  aliases: string[]
}

export interface SkillDetail extends SkillMeta {
  name: string
}

type SkillEntry = [name: string, aliases?: string[]]

// These canonical labels are ordinary words or one-letter tokens. Matching the
// label itself would create noisy results; only their explicit aliases are safe.
const AMBIGUOUS_CANONICALS = new Set(['C', 'Go', 'Make', 'REST', 'Spring'])

const group = (category: string, subcategory: string, entries: SkillEntry[]): SkillDefinition[] =>
  entries.map(([name, aliases = []]) => ({
    name,
    category,
    subcategory,
    aliases: [...(AMBIGUOUS_CANONICALS.has(name) ? [] : [name]), ...aliases],
  }))

// Shared by Nitro enrichment and the browser-only ATS scorer. Keep canonical
// labels readable; aliases hold abbreviations, spelling variants and local terms.
export const SKILL_CATALOG: SkillDefinition[] = [
  ...group('IT', 'Frontend', [
    ['HTML', ['html5']], ['CSS', ['css3']], ['Sass', ['scss']], ['Less', ['less css']],
    ['JavaScript', ['ecmascript', 'es6', 'js developer', 'js framework']], ['TypeScript', ['type script']],
    ['React', ['react.js', 'reactjs']], ['React Native', ['react-native']],
    ['Vue', ['vue.js', 'vuejs']], ['Nuxt', ['nuxt.js', 'nuxtjs']],
    ['Next.js', ['nextjs', 'next js']], ['Angular', ['angular.js', 'angularjs']],
    ['Svelte'], ['SvelteKit', ['svelte kit']], ['Astro', ['astro.js']], ['jQuery'],
    ['Knockout', ['knockout.js', 'knockout js']], ['AlpineJS', ['alpine.js', 'alpine js']],
    ['HTMX'], ['Web Components', ['custom elements']], ['Tailwind', ['tailwindcss', 'tailwind css']],
    ['Bootstrap'], ['Material UI', ['mui', '@mui/material']], ['Ant Design', ['antd']],
    ['Vuetify'], ['Nuxt UI'], ['Quasar'], ['PrimeVue', ['prime vue']], ['Storybook'],
    ['Redux'], ['Redux Toolkit', ['rtk', '@reduxjs/toolkit']], ['Zustand'], ['MobX'],
    ['Pinia'], ['Vuex'], ['RxJS'], ['React Query', ['tanstack query', '@tanstack/react-query']],
    ['Axios'], ['Fetch API', ['window.fetch']], ['Webpack'], ['Vite'], ['Rollup'], ['Babel'],
    ['ESLint'], ['Prettier'], ['Stylelint'], ['npm'], ['Yarn'], ['pnpm'],
    ['Freemarker'], ['Velocity'], ['Liquid'], ['Nunjucks'],
    ['Responsive Design', ['responsive web design', 'responsive layout', 'адаптивная верстка', 'адаптивний дизайн']],
    ['Cross-browser Development', ['cross-browser', 'cross browser', 'кроссбраузерность']],
    ['Accessibility', ['web accessibility', 'wcag', 'a11y']], ['BEM', ['бэм']],
    ['SEO', ['search engine optimization', 'поисковая оптимизация']],
    ['Technical SEO', ['техническое seo']], ['i18n', ['internationalization', 'localization', 'локализация']],
  ]),
  ...group('IT', 'Backend', [
    ['Node.js', ['nodejs', 'node js']], ['Express', ['express.js', 'expressjs']],
    ['NestJS', ['nest.js', 'nest js']], ['Fastify'], ['Python', ['python3']], ['Django'],
    ['Flask'], ['FastAPI', ['fast api']], ['PHP'], ['Laravel'], ['Symfony'], ['WordPress'],
    ['Java', ['java ee', 'jakarta ee']], ['Spring', ['spring framework']], ['Spring Boot', ['springboot']],
    ['Hibernate'], ['Maven'], ['Gradle'], ['Kotlin'], ['Ktor'], ['C#', ['c sharp', 'csharp']],
    ['.NET', ['dotnet', 'dot net']], ['ASP.NET', ['asp net', 'asp.net core']],
    ['Entity Framework', ['entityframework', 'ef core']], ['Tomcat'], ['Go', ['golang', 'go language']],
    ['Rust', ['rustlang']], ['C', ['c programming', 'c language']], ['C++', ['cpp', 'c plus plus']],
    ['Ruby'], ['Ruby on Rails', ['rails framework']], ['Scala'], ['Elixir'], ['Erlang'],
    ['OOP', ['object-oriented programming', 'object oriented programming']], ['SOLID', ['solid principles']],
  ]),
  ...group('IT', 'API & Architecture', [
    ['REST', ['rest api', 'restful api', 'rest services']], ['GraphQL'],
    ['Apollo GraphQL', ['apollo client', 'apollo server']], ['gRPC'], ['WebSocket', ['websockets', 'web socket']],
    ['Socket.IO', ['socketio']], ['API Integration', ['api integrations', 'third-party integration', 'интеграция api']],
    ['Webhooks', ['webhook']], ['SOAP', ['soap api', 'soap web service']], ['Microservices', ['micro services']],
    ['PWA', ['progressive web app']], ['SPA', ['single-page application']],
    ['SSR', ['server-side rendering']], ['SSG', ['static site generation']], ['JSON'], ['XML'], ['YAML', ['yml']],
  ]),
  ...group('IT', 'Mobile & Desktop', [
    ['Android'], ['Android Studio'], ['Jetpack Compose'], ['Android SDK'], ['iOS'], ['Swift'], ['Objective-C', ['objective c']],
    ['SwiftUI'], ['UIKit'], ['Xcode'], ['Flutter'], ['Dart'], ['Electron', ['electron.js', 'electronjs']],
    ['Tauri'], ['Qt'], ['WPF'], ['WinForms'], ['Unity', ['unity3d']], ['Unreal Engine', ['ue4', 'ue5']], ['Godot'],
  ]),
  ...group('IT', 'Databases', [
    ['SQL'], ['NoSQL', ['no sql', 'no-sql']], ['PostgreSQL', ['postgres', 'psql']], ['MySQL'], ['MariaDB', ['maria db']], ['SQLite'],
    ['Microsoft SQL Server', ['mssql', 'sql server']], ['Oracle Database', ['oracle db']],
    ['MongoDB', ['mongo db', 'mongo']], ['Redis'], ['Elasticsearch', ['elastic search']], ['OpenSearch'],
    ['ClickHouse', ['click house']], ['DynamoDB'], ['Firestore'], ['Firebase'], ['Neo4j'],
    ['Supabase'], ['Snowflake'], ['BigQuery'], ['Prisma', ['prisma orm']], ['TypeORM'], ['Sequelize'], ['SQLAlchemy'],
  ]),
  ...group('IT', 'DevOps & Cloud', [
    ['Git'], ['GitHub'], ['GitLab'], ['Bitbucket'], ['DevOps'], ['Docker'], ['Docker Compose', ['docker-compose']],
    ['Kubernetes', ['k8s']], ['Helm'], ['Terraform'], ['Ansible'], ['Jenkins'],
    ['GitHub Actions'], ['GitLab CI', ['gitlab ci/cd']], ['CircleCI'], ['TeamCity'], ['ArgoCD', ['argo cd']],
    ['CI/CD', ['ci cd', 'cicd', 'continuous integration', 'continuous delivery']],
    ['AWS', ['amazon web services']], ['Azure', ['microsoft azure']], ['Google Cloud', ['gcp', 'google cloud platform']],
    ['Cloudflare'], ['Vercel'], ['Netlify'], ['Nginx'], ['Apache'], ['Linux'], ['Ubuntu'], ['Windows Server'],
    ['Bash', ['shell scripting']], ['PowerShell'], ['SSH'], ['Active Directory'], ['VMware'], ['Grafana'],
    ['Prometheus'], ['Zabbix'], ['Sentry'], ['ELK', ['elastic stack']], ['Kibana'],
  ]),
  ...group('IT', 'QA & Security', [
    ['Jest'], ['Vitest'], ['Cypress'], ['Playwright'], ['Selenium'], ['Appium'], ['Postman'],
    ['Swagger', ['openapi']], ['TestRail'], ['TDD', ['test-driven development']], ['BDD', ['behavior-driven development']],
    ['Manual Testing', ['ручное тестирование']],
    ['Test Automation', ['automation testing', 'автоматизация тестирования']],
    ['Regression Testing', ['регрессионное тестирование']], ['Unit Testing', ['unit tests']],
    ['Integration Testing'], ['E2E Testing', ['end-to-end testing']], ['Cybersecurity', ['information security']],
    ['SIEM'], ['Splunk'], ['OAuth', ['oauth2']], ['JWT'], ['OWASP'], ['Penetration Testing', ['pentest', 'пентест']],
  ]),
  ...group('Data', 'Analytics & AI', [
    ['Data Analysis', ['analytics', 'data analytics', 'анализ данных']], ['Business Analytics'], ['Commercial Analytics'],
    ['Pandas'], ['NumPy'], ['Jupyter'], ['Power BI', ['powerbi']], ['Tableau'], ['Looker'], ['Qlik'],
    ['Apache Spark', ['pyspark']], ['Hadoop'], ['Airflow'], ['Kafka'], ['RabbitMQ'], ['ETL'],
    ['Data Warehouse'], ['Data Science'], ['Machine Learning', ['машинное обучение']], ['Deep Learning'], ['TensorFlow'],
    ['PyTorch'], ['Scikit-learn', ['sklearn']], ['NLP'], ['Computer Vision'], ['LLM', ['large language models']],
    ['Generative AI', ['genai', 'генеративный ии']], ['OpenAI'], ['LangChain'], ['RAG'], ['AI Tools', ['ai tools']],
  ]),
  ...group('Office', 'Productivity', [
    ['Microsoft Office', ['ms office', 'мс офис']], ['Microsoft 365', ['office 365', 'm365']],
    ['Microsoft Word', ['ms word', 'ворд']],
    ['Microsoft PowerPoint', ['ms powerpoint', 'powerpoint']], ['Microsoft Outlook', ['ms outlook']],
    ['Microsoft Access', ['ms access']], ['Microsoft Visio', ['ms visio']], ['Microsoft Project', ['ms project']],
    ['Microsoft Teams', ['ms teams']], ['SharePoint'], ['OneDrive'], ['Google Workspace', ['g suite']],
    ['Google Sheets'], ['Google Docs'], ['Google Slides'], ['LibreOffice'],
  ]),
  ...group('Office', 'Spreadsheets', [
    ['Microsoft Excel', ['ms excel', 'excel', 'эксель']], ['Excel Pivot Tables', ['pivot tables', 'сводные таблицы']],
    ['VLOOKUP', ['впр excel']], ['XLOOKUP'],
    ['Power Query', ['powerquery']], ['Power Pivot', ['powerpivot']], ['Excel Macros', ['макросы excel']], ['VBA'],
  ]),
  ...group('Design', 'UI & UX', [
    ['Figma'], ['Adobe Photoshop', ['photoshop']], ['Adobe Illustrator', ['illustrator']],
    ['Adobe XD'], ['Sketch', ['sketch app']], ['UI Design'], ['UX Design'], ['Design Systems'], ['Prototyping'],
  ]),
  ...group('Business', 'Management', [
    ['Business Strategy'], ['Strategic Planning'], ['Corporate Planning'], ['Business Planning'],
    ['Corporate Strategy'], ['Commercial Strategy'], ['Management Consulting'], ['M&A', ['mergers and acquisitions']],
    ['Project Management'], ['Portfolio Management'],
    ['Corporate Governance', ['group governance']], ['Business Process'], ['Process Improvement', ['process improvements']],
    ['Operational Efficiency'], ['Operations'], ['Stakeholder Management'], ['Negotiation'],
    ['Cross-functional Collaboration', ['cross-functional', 'cross functionally']], ['KPI', ['key performance indicators']],
    ['Dashboards'], ['Forecasting'], ['Risk Management'], ['Resource Planning'], ['Gantt Charts'],
    ['Agile'], ['Scrum'], ['Kanban'], ['Jira'], ['Confluence'], ['SDLC'],
  ]),
  ...group('Finance', 'Accounting Software', [
    ['1C', ['1с', '1c accounting', '1с бухгалтерия']], ['SAP', ['sap erp', 'sap fico']],
    ['SONO', ['соно']], ['M.E.Doc', ['medoc', 'медок']], ['Didox'], ['MySoliq', ['my soliq']],
    ['ProZorro', ['прозорро']], ['SAGA', ['saga accounting', 'saga software']],
  ]),
  ...group('Finance', 'Accounting & Banking', [
    ['Accounting', ['бухгалтерский учет', 'бухгалтерський облік']],
    ['Financial Analysis'], ['P&L', ['profit and loss']], ['Budgeting'], ['Management Accounting'],
    ['Tax Accounting'], ['Payroll'], ['IFRS', ['мсфо']], ['GAAP'], ['Audit'], ['Treasury'],
    ['Investment Banking'], ['Credit Analysis'], ['AML', ['anti-money laundering']], ['KYC', ['know your customer']],
  ]),
  ...group('Business Systems', 'CRM & ERP', [
    ['Microsoft Dynamics', ['dynamics 365']], ['HubSpot', ['hubspot crm']],
    ['Bitrix24', ['битрикс24']], ['amoCRM', ['амо срм']], ['Smartup', ['smart up']], ['Odoo'], ['Oracle ERP'],
  ]),
  ...group('Sales', 'Sales & Customer Service', [
    ['Sales', ['продажи', 'сотув', 'savdo']], ['Sales Pipeline'], ['Lead Generation', ['лидогенерация']],
    ['Cold Calling', ['холодные звонки']], ['Account Management'], ['Key Account Management'],
    ['CRM'], ['Customer Service', ['обслуживание клиентов']], ['Customer Support', ['поддержка клиентов']],
    ['Call Center', ['колл-центр']], ['Client Communication', ['переписка с клиентами', 'мижозлар билан ёзишмалар']],
    ['Complaint Handling'], ['Onboarding', ['employee onboarding', 'courier onboarding']], ['Conversion Funnel'],
  ]),
  ...group('Sales', 'CRM', [
    ['Salesforce', ['salesforce crm']],
  ]),
  ...group('Marketing', 'Digital Marketing', [
    ['Digital Marketing'], ['Content Marketing'], ['Social Media Marketing', ['smm']], ['Email Marketing'],
    ['Google Ads', ['google adwords']], ['Meta Ads', ['facebook ads']], ['Google Analytics', ['ga4']],
    ['Google Tag Manager', ['gtm']], ['Marketing Automation'], ['Copywriting', ['копирайтинг']],
    ['Market Research'], ['A/B Testing', ['ab testing']], ['Conversion Rate Optimization', ['cro']],
  ]),
  ...group('HR', 'Recruiting & People', [
    ['Recruitment', ['recruiting', 'подбор персонала']], ['Candidate Sourcing'], ['Boolean Search'],
    ['LinkedIn Recruiter'], ['Interviewing', ['проведение собеседований']], ['HR Administration'],
    ['HRIS'], ['Workday HCM'], ['Greenhouse ATS'], ['BambooHR'], ['SAP SuccessFactors'],
  ]),
  ...group('Legal', 'Legal & Compliance', [
    ['Legal Research', ['правовой анализ']], ['Contract Drafting', ['составление договоров']],
    ['Contract Management', ['договорная работа']], ['Due Diligence'], ['Corporate Law'], ['Commercial Law'],
    ['Labor Law', ['трудовое право']], ['Litigation'], ['Compliance', ['комплаенс']], ['GDPR'],
  ]),
  ...group('Administration', 'Office Work', [
    ['Document Management', ['документооборот']], ['Electronic Document Management', ['эдо']],
    ['Records Management', ['делопроизводство']], ['Business Correspondence', ['деловая переписка']],
    ['Data Entry', ['ввод данных']], ['Office Administration'], ['Calendar Management'], ['Meeting Coordination'],
  ]),
  ...group('Logistics', 'Supply Chain & Transport', [
    ['Logistics', ['логистика']], ['Supply Chain', ['управление цепями поставок']], ['Procurement', ['закупки']],
    ['Strategic Sourcing'], ['Tendering', ['тендеры']], ['Vendor Management'], ['Inventory Management'],
    ['Warehouse Management'], ['WMS'], ['TMS'], ['Incoterms'], ['Customs Clearance'], ['Import/Export'],
    ['Freight Forwarding'], ['Route Planning', ['маршрутизация']], ['Last-mile Logistics'],
    ['Driving License B', ['права категории b']], ['Driving License C', ['права категории c']],
    ['Forklift', ['водитель погрузчика']], ['Barcode Scanner', ['тсд', 'терминал сбора данных']],
  ]),
  ...group('Retail & Hospitality', 'Retail, POS & HoReCa', [
    ['POS', ['point of sale']], ['R-Keeper', ['rkeeper']], ['iiko', ['айко ресторан']],
    ['Poster POS', ['poster restaurant']], ['MICROS', ['oracle micros']], ['Cash Register', ['работа с кассой']],
    ['Merchandising', ['мерчандайзинг']], ['Stocktaking', ['инвентаризация']], ['HACCP', ['хассп']],
    ['Hotel Management'], ['Opera PMS', ['oracle hospitality opera']], ['Restaurant Management'],
  ]),
  ...group('Engineering', 'CAD', [
    ['AutoCAD', ['autocad civil 3d']], ['SolidWorks'], ['Revit'], ['ArchiCAD'], ['SketchUp'],
  ]),
  ...group('Engineering', 'Manufacturing', [
    ['CNC', ['чпу']], ['PLC', ['плк']], ['SCADA', ['асу тп']], ['TIA Portal'], ['Siemens S7'],
    ['Electrical Engineering'], ['Mechanical Engineering'], ['Mechatronics'], ['Welding', ['сварка']],
    ['Lean Manufacturing', ['бережливое производство']], ['Six Sigma'], ['Kaizen'], ['5S'],
    ['ISO 9001', ['iso9001']], ['ISO 14001'], ['ISO 45001'], ['Quality Management'], ['HSE', ['охрана труда']],
  ]),
  ...group('Construction', 'Construction & Design', [
    ['Construction Management'], ['Quantity Surveying'], ['Cost Estimation', ['сметное дело', 'составление смет']],
    ['Project Documentation'], ['Technical Drawings', ['технические чертежи']], ['BIM'],
  ]),
  ...group('Healthcare', 'Medical & Pharma', [
    ['EMR', ['electronic medical record']], ['EHR', ['electronic health record']],
    ['Medical Records', ['медицинская документация']], ['GMP'], ['GLP'],
    ['Good Clinical Practice', ['gcp clinical']], ['PCR', ['пцр']], ['ELISA', ['ифа анализ']],
    ['Laboratory Equipment'], ['Pharmacovigilance'], ['Clinical Research'], ['Patient Care'],
  ]),
  ...group('Education', 'Teaching & Learning', [
    ['Teaching', ['преподавание', 'викладання']], ['Curriculum Development'], ['Lesson Planning'],
    ['Classroom Management'], ['Moodle'], ['Google Classroom'], ['LMS', ['learning management system']],
  ]),
  ...group('Aviation', 'Aviation Operations', [
    ['Airport Operations'], ['Flight Operations'], ['Ground Handling'], ['Aviation Safety'],
    ['IATA'], ['ICAO'], ['Amadeus'], ['Sabre'],
  ]),
  ...group('E-commerce', 'Marketplaces', [
    ['E-commerce', ['ecommerce', 'электронная коммерция', 'онлайн савдо']], ['Shopify'], ['Magento'],
    ['OpenCart'], ['Amazon Seller Central'], ['Wildberries', ['вайлдберриз']], ['Ozon'],
    ['Kaspi', ['kaspi marketplace', 'kaspi магазин']], ['Uzum', ['uzum market']],
    ['Marketplace Management', ['ведение маркетплейсов']], ['Product Cards', ['карточки товаров']],
  ]),
  ...group('Automation', 'Low Code', [
    ['Automation'], ['Zapier'], ['Make', ['make.com', 'integromat']], ['n8n'], ['Power Automate'], ['Power Apps'],
    ['UiPath'], ['Automation Anywhere'], ['RPA', ['robotic process automation']],
  ]),
  ...group('Professional', 'Soft Skills', [
    ['Communication', ['communication skills', 'коммуникация', 'коммуникабельность', 'коммуникация кўникмалари']],
    ['Teamwork', ['team player', 'работа в команде', 'командная работа', 'жамоа билан']],
    ['Leadership'], ['Time Management'], ['Problem Solving', ['решение проблем']], ['Critical Thinking'],
    ['Analytical Thinking'], ['Multitasking', ['многозадачность']], ['Attention to Detail'],
    ['Presentation Skills'], ['Responsibility', ['ответственность', 'масъулиятлилик']],
    ['Adaptability', ['адаптивность', 'мослашувчан']], ['Fast Learner', ['быстрая обучаемость', 'тез ўрганувчи']],
    ['Goal Orientation', ['стремление к цели', 'мақсадларга эришиш']],
  ]),
]

export const SKILL_KEYWORDS: Readonly<Record<string, readonly string[]>> = Object.freeze(
  Object.fromEntries(SKILL_CATALOG.map(({ name, aliases }) => [name, Object.freeze([...new Set(aliases)])])),
)

export const SKILL_META: Readonly<Record<string, SkillMeta>> = Object.freeze(
  Object.fromEntries(SKILL_CATALOG.map(({ name, category, subcategory }) => [name, { category, subcategory }])),
)

export function normalizeSkillText(value: string): string {
  return value
    .normalize('NFKC')
    .toLocaleLowerCase('en')
    .replace(/[‘’`´]/g, "'")
    .replace(/[‐‑‒–—]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
}

export function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function buildSkillRegex(alias: string): RegExp {
  const normalized = normalizeSkillText(alias)
  const pattern = escapeRegex(normalized).replace(/\s+/g, '\\s+')
  // Unicode-aware boundaries prevent `react` matching `reactive`, `reaction`
  // or `interaction`, while still handling C++, C#, .NET, 1C and Vue.js.
  return new RegExp(`(?:^|[^\\p{L}\\p{N}_])${pattern}(?=$|[^\\p{L}\\p{N}_])`, 'iu')
}

const COMPILED_SKILLS = SKILL_CATALOG.map((definition) => ({
  definition,
  patterns: [...new Set(definition.aliases.map(normalizeSkillText))].map(buildSkillRegex),
}))

const CANONICAL_BY_ALIAS = new Map<string, string>()
for (const { name, aliases } of SKILL_CATALOG) {
  CANONICAL_BY_ALIAS.set(normalizeSkillText(name), name)
  for (const alias of aliases) CANONICAL_BY_ALIAS.set(normalizeSkillText(alias), name)
}

export function canonicalSkillName(value: string): string | undefined {
  const normalized = normalizeSkillText(value)
  return CANONICAL_BY_ALIAS.get(normalized) ?? extractSkillNames(normalized)[0]
}

export function extractSkillDetails(text: string): SkillDetail[] {
  const normalized = normalizeSkillText(text)
  const found: SkillDetail[] = []
  for (const { definition, patterns } of COMPILED_SKILLS) {
    if (!patterns.some((pattern) => pattern.test(normalized))) continue
    found.push({
      name: definition.name,
      category: definition.category,
      subcategory: definition.subcategory,
    })
  }
  return found
}

export function extractSkillNames(text: string): string[] {
  return extractSkillDetails(text).map(({ name }) => name)
}

export function getSkillMeta(name: string): SkillMeta | undefined {
  const canonical = canonicalSkillName(name)
  return canonical ? SKILL_META[canonical] : undefined
}
