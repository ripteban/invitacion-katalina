// @ts-check
import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({
  // URL pública (Cloudflare Pages). Se usa para la imagen de vista previa de WhatsApp.
  site: 'https://katalina15.pages.dev',
  output: 'static',
  build: { inlineStylesheets: 'always' },
  devToolbar: { enabled: false },
});
