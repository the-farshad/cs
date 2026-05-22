// @ts-check
import { defineConfig } from 'astro/config';

import react from '@astrojs/react';
import mdx from '@astrojs/mdx';
import tailwindcss from '@tailwindcss/vite';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

// https://astro.build/config
export default defineConfig({
  site: 'https://cs.thefarshad.com',
  integrations: [react(), mdx({ remarkPlugins: [remarkMath], rehypePlugins: [[rehypeKatex, { throwOnError: false }]] })],

  vite: {
    plugins: [tailwindcss()]
  }
});