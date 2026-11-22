/* eslint-disable prefer-destructuring */
export const MODE = import.meta.env.MODE || 'production';
export const VITE_BUILD_TYPE = import.meta.env.VITE_BUILD_TYPE || 'web';
export const VITE_PLATFORM = import.meta.env.VITE_PLATFORM || 'web';
export const VITE_DISTRIBUTION = import.meta.env.VITE_DISTRIBUTION || 'web';
export const VITE_SITE_URL = import.meta.env.VITE_SITE_URL || '';
export const VITE_NAME = import.meta.env.VITE_NAME || 'Taminator';
export const VITE_VERSION = import.meta.env.VITE_VERSION || '6.33.0';
export const VITE_SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN || '';
export const VITE_SENTRY_ENVIRONMENT = import.meta.env.VITE_SENTRY_ENVIRONMENT || '';
export const VITE_GOOGLE_API_KEY = import.meta.env.VITE_GOOGLE_API_KEY || '';
export { prettyVersion, release } from './lib/version.js?inline';
