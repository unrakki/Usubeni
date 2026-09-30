import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "../locales/en.ts";

const resources = { en: { translation: en } } as const;

declare module "i18next" {
  interface CustomTypeOptions {
    defaultNS: "translation";
    resources: (typeof resources)["en"];
  }
}

i18n.on("languageChanged", (language) => {
  document.documentElement.lang = language;
});

await i18n.use(initReactI18next).init({
  resources,
  lng: "en",
  fallbackLng: "en",
  // Resources are bundled, so there is nothing to wait for.
  initAsync: false,
  // React already escapes rendered strings.
  interpolation: { escapeValue: false },
});

export default i18n;
