# WhitesLove — Personal Site

Source code for [whiteslove.me](https://whiteslove.me) — a personal developer site featuring a set of small productivity tools (PDF editor, JSON merger, Markdown editor, SVG editor, DockerHub search, and more).

## Features
- Multi-language support (i18n)
- Country-fit quiz and job search tools
- Standalone dev utilities: PDF editor, Markdown editor, JSON merger, SVG editor, DockerHub search, email editor
- Server-side logic for dynamic features
- Dockerized deployment with CI/CD

## Tech Stack
- **Framework:** Nuxt.js (Vue.js)
- **Language:** TypeScript
- **Styling:** CSS
- **Containerization:** Docker
- **CI/CD:** GitHub Actions
- **i18n:** Multi-locale support

## Project Structure
├── app/ # Application code
├── server/ # Server-side logic/API routes
├── i18n/locales/ # Translation files
├── quizzData/country/ # Data for the country-fit quiz
├── public/ # Static assets
├── .github/workflows/ # CI/CD pipeline
└── Dockerfile

## Getting Started

### Prerequisites
- Node.js
- npm

### Setup
```bash
git clone https://github.com/AmoneMisa/Personal-Site.git
cd Personal-Site
npm install
```

### Development
```bash
npm run dev
```
Runs at [http://localhost:3000](http://localhost:3000).

### Production Build
```bash
npm run build
npm run preview
```

## Related
- Admin panel: [Personal-Site-Admin-Frontend](https://github.com/AmoneMisa/Personal-Site-Admin-Frontend)
- Backend: [Personal-Site-Backend](https://github.com/AmoneMisa/Personal-Site-Backend)
- Live site: [whiteslove.me](https://whiteslove.me)

## License
Personal project, shared for demonstration purposes.
