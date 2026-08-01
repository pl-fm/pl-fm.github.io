// @ts-check
import { defineConfig } from 'astro/config';
import { SITE } from './site.config.mjs';

// https://astro.build/config
export default defineConfig({
  site: SITE.url,
  base: SITE.base,
  trailingSlash: 'ignore',
  output: 'static',
  // The three sections became tabs on one page. Old links land on the tab they
  // used to be.
  redirects: {
    '/deadlines': '/#deadlines',
    '/events': '/#events',
    '/schools': '/#schools',
  },
  build: {
    format: 'directory',
    // Keep the single stylesheet as a real file rather than inlining it into
    // every page.
    inlineStylesheets: 'never',
  },
  devToolbar: {
    enabled: false,
  },
  vite: {
    build: {
      // The pages ship a few kilobytes of hand-written scripts. Splitting them
      // into shared chunks costs more requests than it saves.
      assetsInlineLimit: 0,
    },
  },
});
