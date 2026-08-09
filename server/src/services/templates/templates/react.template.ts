import { FileEntryType } from 'shared';
import type { StarterEntry } from '../template.service';

export function reactTemplate(): StarterEntry[] {
  return [
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
