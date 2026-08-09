import { FileEntryType } from 'shared';
import type { StarterEntry } from '../template.service';

export function nextjsTemplate(): StarterEntry[] {
  return [
    { path: 'app', type: FileEntryType.FOLDER },
    {
      path: 'app/layout.tsx',
      type: FileEntryType.FILE,
      content:
        "export default function RootLayout({ children }: { children: React.ReactNode }) {\n  return (\n    <html lang=\"en\">\n      <body>{children}</body>\n    </html>\n  );\n}\n",
    },
    {
      path: 'app/page.tsx',
      type: FileEntryType.FILE,
      content:
        'export default function Page() {\n  return <main>Welcome to your new Mingo AI project.</main>;\n}\n',
    },
  ];
}
