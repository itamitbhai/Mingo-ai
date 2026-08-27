import { FileEntryType } from 'shared';
import type { StarterEntry } from '../template.service';

export function reactTemplate(): StarterEntry[] {
  return [
    {
      path: 'index.html',
      type: FileEntryType.FILE,
      content:
        '<!doctype html>\n<html lang="en">\n  <head>\n    <meta charset="UTF-8" />\n    <title>Mingo AI Project</title>\n  </head>\n  <body>\n    <div id="root"></div>\n    <script type="module" src="/src/main.jsx"></script>\n  </body>\n</html>\n',
    },
    {
      path: 'vite.config.js',
      type: FileEntryType.FILE,
      content:
        "import { defineConfig } from 'vite';\nimport react from '@vitejs/plugin-react';\n\nexport default defineConfig({\n  plugins: [react()],\n});\n",
    },
    { path: 'src', type: FileEntryType.FOLDER },
    { path: 'src/components', type: FileEntryType.FOLDER },
    {
      path: 'src/main.jsx',
      type: FileEntryType.FILE,
      content:
        "import React from 'react';\nimport ReactDOM from 'react-dom/client';\nimport App from './App';\n\nReactDOM.createRoot(document.getElementById('root')).render(\n  <React.StrictMode>\n    <App />\n  </React.StrictMode>\n);\n",
    },
    {
      path: 'src/App.jsx',
      type: FileEntryType.FILE,
      content: "export default function App() {\n  return <div>Welcome to your new Mingo AI project.</div>;\n}\n",
    },
  ];
}
