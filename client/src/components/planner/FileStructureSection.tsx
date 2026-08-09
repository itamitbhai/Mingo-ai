import { File, Folder } from 'lucide-react';
import { FileEntryType, type IPlanFileEntry } from 'shared';

import { Badge } from '@/components/ui/badge';

interface FileStructureSectionProps {
  files: IPlanFileEntry[] | undefined;
}

export function FileStructureSection({ files }: FileStructureSectionProps) {
  if (!files || files.length === 0) {
    return <p className="text-sm text-muted-foreground">No file structure was proposed.</p>;
  }

  return (
    <ul className="flex flex-col gap-1 font-mono text-sm">
      {files.map((file) => {
        const depth = file.path.split('/').length - 1;
        const Icon = file.type === FileEntryType.FOLDER ? Folder : File;

        return (
          <li
            key={file.path}
            style={{ paddingLeft: `${depth * 16}px` }}
            className="flex items-center gap-2 py-0.5"
          >
            <Icon className="size-3.5 shrink-0 text-muted-foreground" />
            <span>{file.path.split('/').pop()}</span>
            {file.exists ? (
              <Badge variant="outline" className="font-sans text-[10px]">
                already exists
              </Badge>
            ) : (
              <Badge variant="success" className="font-sans text-[10px]">
                new
              </Badge>
            )}
            {file.description && (
              <span className="truncate text-xs font-sans text-muted-foreground">{file.description}</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
