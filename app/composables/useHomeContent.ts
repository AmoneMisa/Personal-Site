// Homepage content. The copy itself lives in i18n/locales/*.json under `home`,
// alongside every other translated string, rather than in a pair of RU/EN maps
// here; this module supplies the shape and the locale-independent data.
// The hero years stat uses a %years% token replaced in the component from
// useExperienceYears (auto-counted, so it never goes stale). Deliberately not
// {years}: vue-i18n reads braces as an interpolation slot and would blank it.
import type { ComputedRef } from 'vue';

export interface DropdownItem { label: string; sub: string; href: string }
export interface SkillCard { title: string; items: string[] }
export interface ExperienceItem { period: string; title: string; meta: string; description: string; tags: string[] }
export interface PetProject { kind: string; title: string; description: string; linkLabel: string; href: string | null; span2?: boolean }
export interface NavLinkT { label: string; href: string }
export interface HeroStat { value: string; label: string }

// ---- Shared structural data (locale-independent) ----
export const CONTACTS = {
  telegram: "https://t.me/WhitesLove",
  whatsapp: "https://wa.me/whiteslove",
  linkedin: "https://www.linkedin.com/in/whiteslove-marharyta-kubai",
  github: "https://github.com/AmoneMisa",
  email: "kubai.rita5@gmail.com",
};

export const TOOLS = [
  "Vue.js", "Nuxt.js", "JavaScript", "TypeScript", "SCSS", "Freemarker",
  "REST API", "Git", "Docker", "GitLab CI/CD", "PostgreSQL", "Jira", "Confluence",
];

export const EMOJI = { shark: "1f988", cat: "1f63b" };

// The homepage copy lives in i18n/locales/*.json under `home`, so a translator
// has one place to work and the text is not split between the locale files and
// this module. The shape below mirrors that namespace.
export interface HomeContent {
  nav: {
    skills: string;
    experience: string;
    petProjects: string;
    tools: string;
    cv: string;
    aboutMe: string;
    contact: string;
    dropdown: {
      petTitle: string;
      pet: {
        label: string;
        sub: string;
        href: string;
      }[];
      pagesTitle: string;
      pages: {
        label: string;
        sub: string;
        href: string;
      }[];
    };
  };
  fastnav: string[];
  hero: {
    eyebrow: string;
    h1before: string;
    h1accent: string;
    lead: string;
    ctaPrimary: string;
    ctaText: string;
    stats: {
      value: string;
      label: string;
    }[];
    portraitCaption: string;
  };
  skillsSection: {
    eyebrow: string;
    title: string;
    subtitle: string;
    ctaLead: string;
    ctaText: string;
    cards: {
      title: string;
      items: string[];
    }[];
  };
  experienceSection: {
    eyebrow: string;
    title: string;
    subtitle: string;
    items: {
      period: string;
      title: string;
      meta: string;
      description: string;
      tags: string[];
    }[];
  };
  petSection: {
    eyebrow: string;
    title: string;
    subtitle: string;
    allLabel: string;
    items: {
      kind: string;
      title: string;
      span2: boolean;
      description: string;
      linkLabel: string;
      href: string;
    }[];
  };
  toolsSection: {
    eyebrow: string;
    title: string;
  };
  closingCta: {
    text: string;
    contactLabel: string;
    cvLabel: string;
  };
  footer: {
    tag: string;
    navTitle: string;
    navLinks: {
      label: string;
      href: string;
    }[];
    contactsTitle: string;
    appsTitle: string;
    apps: {
      label: string;
      sub: string;
      href: string;
    }[];
    copyright: string;
    motto: string;
  };
}

export function useHomeContent(): ComputedRef<HomeContent> {
  const { tm, rt } = useI18n();

  // tm() returns the message tree for the active locale. Depending on how the
  // build compiles the locale files a leaf may be a plain string or a compiled
  // message node, so rt() resolves the latter; either way the components get
  // plain data.
  const resolve = (node: unknown): unknown => {
    if (Array.isArray(node)) return node.map(resolve);
    if (node !== null && typeof node === 'object') {
      const record = node as Record<string, unknown>;
      if ('type' in record || 'body' in record || 'loc' in record) return rt(node as never);
      return Object.fromEntries(Object.entries(record).map(([k, v]) => [k, resolve(v)]));
    }
    return node;
  };

  return computed(() => resolve(tm('home')) as HomeContent);
}
