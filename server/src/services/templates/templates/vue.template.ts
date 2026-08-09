import { FileEntryType } from 'shared';
import type { StarterEntry } from '../template.service';

export function vueTemplate(): StarterEntry[] {
  return [
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
