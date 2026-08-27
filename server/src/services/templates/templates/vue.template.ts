import { FileEntryType } from 'shared';
import type { StarterEntry } from '../template.service';

export function vueTemplate(): StarterEntry[] {
  return [
    {
      path: 'index.html',
      type: FileEntryType.FILE,
      content:
        '<!doctype html>\n<html lang="en">\n  <head>\n    <meta charset="UTF-8" />\n    <title>Mingo AI Project</title>\n  </head>\n  <body>\n    <div id="app"></div>\n    <script type="module" src="/src/main.js"></script>\n  </body>\n</html>\n',
    },
    {
      path: 'vite.config.js',
      type: FileEntryType.FILE,
      content:
        "import { defineConfig } from 'vite';\nimport vue from '@vitejs/plugin-vue';\n\nexport default defineConfig({\n  plugins: [vue()],\n});\n",
    },
    { path: 'src', type: FileEntryType.FOLDER },
    { path: 'src/components', type: FileEntryType.FOLDER },
    {
      path: 'src/main.js',
      type: FileEntryType.FILE,
      content: "import { createApp } from 'vue';\nimport App from './App.vue';\n\ncreateApp(App).mount('#app');\n",
    },
    {
      path: 'src/App.vue',
      type: FileEntryType.FILE,
      content:
        '<template>\n  <div>Welcome to your new Mingo AI project.</div>\n</template>\n\n<script setup>\n</script>\n',
    },
  ];
}
