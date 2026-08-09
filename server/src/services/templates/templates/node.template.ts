import { FileEntryType } from 'shared';
import type { StarterEntry } from '../template.service';

export function nodeTemplate(): StarterEntry[] {
  return [
    { path: 'server', type: FileEntryType.FOLDER },
    {
      path: 'server/index.js',
      type: FileEntryType.FILE,
      content:
        "const http = require('http');\n\nconst server = http.createServer((req, res) => {\n  res.writeHead(200, { 'Content-Type': 'text/plain' });\n  res.end('Welcome to your new Mingo AI project.');\n});\n\nserver.listen(process.env.PORT || 3001);\n",
    },
  ];
}
