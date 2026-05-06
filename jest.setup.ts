import '@testing-library/jest-dom';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

Object.defineProperty(globalThis, 'import.meta', {
  value: {
    env: {
      VITE_API_URL: '',
    },
  },
});

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: {} },
    ru: { translation: {} },
  },
  lng: 'en',
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false,
  },
});
