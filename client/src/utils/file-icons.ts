import {
  Braces,
  File,
  FileCode2,
  FileJson2,
  FileTerminal,
  FileText,
  Folder,
  FolderOpen,
  Palette,
  Settings,
  type LucideIcon,
} from 'lucide-react';

export function getFileIcon(language: string | undefined, name: string): LucideIcon {
  if (name.startsWith('.env')) return Settings;

  switch (language) {
    case 'javascript':
    case 'typescript':
    case 'html':
    case 'xml':
      return FileCode2;
    case 'json':
      return FileJson2;
    case 'css':
    case 'scss':
    case 'less':
      return Palette;
    case 'markdown':
      return FileText;
    case 'shell':
    case 'dockerfile':
      return FileTerminal;
    case 'python':
    case 'java':
    case 'cpp':
    case 'c':
    case 'csharp':
    case 'sql':
    case 'yaml':
      return Braces;
    default:
      return File;
  }
}

export function getFolderIcon(isOpen: boolean): LucideIcon {
  return isOpen ? FolderOpen : Folder;
}
