const resources = {
  en: { common: { appName: 'FocusWeave' } },
  de: { common: { appName: 'FocusWeave' } },
  fr: { common: { appName: 'FocusWeave' } },
  es: { common: { appName: 'FocusWeave' } },
  ja: { common: { appName: 'FocusWeave' } },
  zh: { common: { appName: 'FocusWeave' } },
} as const;

type SupportedLanguage = keyof typeof resources;

const i18n = {
  language: 'en' as SupportedLanguage,
  async changeLanguage(nextLanguage: SupportedLanguage) {
    this.language = nextLanguage;
    return this.language;
  },
  t(key: string) {
    return key;
  },
  use() {
    return this;
  },
  async init() {
    return this;
  },
  resources,
};

export { resources };
export default i18n;
