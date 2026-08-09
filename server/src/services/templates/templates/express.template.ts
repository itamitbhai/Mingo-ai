import { FileEntryType } from 'shared';
import type { StarterEntry } from '../template.service';

export function expressTemplate(): StarterEntry[] {
  return [
    { path: 'server', type: FileEntryType.FOLDER },
    { path: 'server/routes', type: FileEntryType.FOLDER },
    { path: 'server/controllers', type: FileEntryType.FOLDER },
    {
      path: 'server/index.js',
      type: FileEntryType.FILE,
      content:
        "const express = require('express');\n\nconst app = express();\napp.use(express.json());\n\napp.get('/', (req, res) => {\n  res.send('Welcome to your new Mingo AI project.');\n});\n\napp.listen(process.env.PORT || 3001);\n",
    },
  ];
}
