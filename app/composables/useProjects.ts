// Full project catalog for the /projects page — grouped, bilingual. Single source
// of truth for the complete list (the home page shows a curated teaser subset).

export interface ProjectItem {
  name: string;
  stack: string;
  href: string | null;
  downloadHref?: string;
  description: string;
}
export interface ProjectGroup {
  title: string;
  items: ProjectItem[];
}

interface RawItem {
  id: string;
  name: string;
  stack: string;
  href: string;
  downloadHref?: string;
}
// Group titles and item descriptions live in i18n/locales/*.json under
// `projects`; what stays here is the structure and the things that are the
// same in every language.
interface RawGroup {
  id: string;
  items: RawItem[];
}

const GROUPS: RawGroup[] = [
  {
    "id": "web-tools",
    "items": [
      {
        "id": "whiteslove",
        "name": "WhitesLove — services",
        "stack": "Vue.js · Nuxt.js · SSR",
        "href": "/services"
      }
    ]
  },
  {
    "id": "backend",
    "items": [
      {
        "id": "personal-site-backend",
        "name": "Personal Site Backend",
        "stack": "Python · FastAPI · PostgreSQL · Redis",
        "href": "https://github.com/AmoneMisa/Personal-Site/tree/master/backend"
      },
      {
        "id": "account-status-api-lost-ark",
        "name": "Account Status API (Lost Ark)",
        "stack": "Node.js",
        "href": "https://github.com/AmoneMisa/serverApi_AccountStatusLA"
      }
    ]
  },
  {
    "id": "desktop-electron",
    "items": [
      {
        "id": "i18n-properties-manager",
        "name": "i18n Properties Manager",
        "stack": "Electron.js · Vite",
        "href": "https://github.com/AmoneMisa/i18nPropertiesManager"
      },
      {
        "id": "lost-ark",
        "name": "Lost Ark character manager",
        "stack": "Electron.js · Vue.js",
        "href": null
      },
      {
        "id": "account-status-lost-ark",
        "name": "Account Status (Lost Ark)",
        "stack": "Electron.js · Vue.js",
        "href": "https://github.com/AmoneMisa/accountStatusLA"
      }
    ]
  },
  {
    "id": "mobile",
    "items": [
      {
        "id": "medikit",
        "name": "MediKit",
        "stack": "React Native · TypeScript",
        "href": "https://github.com/AmoneMisa/MediKit"
      },
      {
        "id": "fun-things-tracker",
        "name": "Fun Things Tracker",
        "stack": "React Native (Expo) · TypeScript",
        "href": "https://github.com/AmoneMisa/FunThingsTracker"
      },
      {
        "id": "rustic-price-converter",
        "name": "Rustic Price Converter",
        "stack": "Kotlin (native Android)",
        "href": "https://github.com/AmoneMisa/RusticPriceConvertor",
        "downloadHref": "/files/RusticPriceConvertor_v1.0_WhitesLove.apk"
      },
      {
        "id": "flat-finder",
        "name": "Flat Finder",
        "stack": "Dart · Flutter",
        "href": "https://github.com/AmoneMisa/flat-finder",
        "downloadHref": "/files/FlatFinder_v1.1_WhitesLove.apk"
      }
    ]
  },
  {
    "id": "bots",
    "items": [
      {
        "id": "genshin-impact-bot",
        "name": "Genshin Impact bot",
        "stack": "Node.js · Telegram",
        "href": "https://github.com/AmoneMisa/Genshin-Impact-tg-bot"
      },
      {
        "id": "amorality-discord-bot",
        "name": "Amorality Discord bot",
        "stack": "Node.js · Discord",
        "href": "https://github.com/AmoneMisa/amorality-discord-bot"
      },
      {
        "id": "lost-ark-trading-discord-bot",
        "name": "Lost Ark trading Discord bot",
        "stack": "Node.js · Discord",
        "href": "https://github.com/AmoneMisa/discord-LA-commercial-bot"
      },
      {
        "id": "file-telegram-bot",
        "name": "File Telegram bot",
        "stack": "Node.js · Telegram",
        "href": "https://github.com/AmoneMisa/file-telegram-bot"
      }
    ]
  },
  {
    "id": "game-mods-patchers-c",
    "items": [
      {
        "id": "increase-hard-mod-r-e-p-o",
        "name": "Increase Hard Mod — R.E.P.O.",
        "stack": "C# · BepInEx / HarmonyLib",
        "href": "https://github.com/AmoneMisa/Repo-Increase-Difficulty-Mod"
      },
      {
        "id": "autotranslatetexts",
        "name": "AutoTranslateTexts",
        "stack": "C# · Skyrim SE/AE",
        "href": "https://github.com/AmoneMisa/AutoTranslateTexts"
      },
      {
        "id": "freefasttravel",
        "name": "FreeFastTravel",
        "stack": "C# · Synthesis / Mutagen",
        "href": "https://github.com/AmoneMisa/FreeFastTravel"
      },
      {
        "id": "allbookshaveperks",
        "name": "AllBooksHavePerks",
        "stack": "C# · Skyrim SE/AE",
        "href": "https://github.com/AmoneMisa/AllBooksHavePerks"
      },
      {
        "id": "moregoldformerchants",
        "name": "MoreGoldForMerchants",
        "stack": "C# · Skyrim",
        "href": "https://github.com/AmoneMisa/MoreGoldForMerchants"
      }
    ]
  }
];

// Most project names are the same in every language, so they live with the
// rest of the structure. The few that are not get a `projects.names.<id>`
// message in the locale that differs, rather than all of them being restated
// per locale for the sake of two.
export function useProjects() {
  const { t, te } = useI18n();
  const nameFor = (it: RawItem) => {
    const key = `projects.names.${it.id}`;
    return te(key) ? t(key) : it.name;
  };
  return computed<ProjectGroup[]>(() =>
    GROUPS.map((g) => ({
      title: t(`projects.groups.${g.id}`),
      items: g.items.map((it) => ({
        name: nameFor(it),
        stack: it.stack,
        href: it.href,
        downloadHref: it.downloadHref,
        description: t(`projects.descriptions.${it.id}`),
      })),
    }))
  );
}
