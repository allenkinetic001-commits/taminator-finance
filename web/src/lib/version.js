export const release = import.meta.env.DEV ? 'app.local.local.local@0.0.0'
  : (import.meta.env.VITE_NAME || 'Taminator') + '.'
  + (import.meta.env.VITE_BUILD_TYPE || 'web') + '.'
  + (import.meta.env.VITE_PLATFORM || 'web') + '.'
  + (import.meta.env.VITE_DISTRIBUTION || 'web') + '@'
  + (import.meta.env.VITE_VERSION || '6.33.0');

const COMMIT = (import.meta.env.VITE_COMMIT || 'local').substring(0, 7);
export const prettyVersion = `v${import.meta.env.VITE_VERSION || '6.33.0'}@${import.meta.env.VITE_DISTRIBUTION || 'web'} (${COMMIT})`;
