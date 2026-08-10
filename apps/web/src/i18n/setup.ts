import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import { enResources } from './en';

if (!i18n.isInitialized) {
  void i18n.use(initReactI18next).init({
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false,
    },
    lng: 'en',
    resources: {
      en: {
        translation: enResources,
      },
    },
  });
}

export { i18n };
