import { Types } from 'mongoose';
import { FileEntryType } from 'shared';
import { ProjectFileModel } from '../../models';
import { getProjectById } from '../project.service';

interface FileTreeNode extends Record<string, unknown> {
  path: string;
  name: string;
  type: FileEntryType;
  parentPath: string | null;
  children?: FileTreeNode[];
}

export async function getFileTree(owner: Types.ObjectId, projectId: string): Promise<FileTreeNode[]> {
  const project = await getProjectById(owner, projectId);

  const files = await ProjectFileModel.find({ project: project._id, owner })
    .select('-content')
    .sort({ path: 1 });

  const nodesByPath = new Map<string, FileTreeNode>();
  const roots: FileTreeNode[] = [];

  for (const file of files) {
    const node = file.toJSON() as FileTreeNode;
    if (file.type === FileEntryType.FOLDER) {
      node.children = [];
    }
    nodesByPath.set(file.path, node);
  }

  for (const file of files) {
    const node = nodesByPath.get(file.path);
    if (!node) continue;

    const parent = file.parentPath ? nodesByPath.get(file.parentPath) : undefined;
    if (parent?.children) {
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  }

  sortTree(roots);
  return roots;
}

function sortTree(nodes: FileTreeNode[]): void {
  nodes.sort((a, b) => {
    if (a.type !== b.type) {
      return a.type === FileEntryType.FOLDER ? -1 : 1;
    }
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
  });

  for (const node of nodes) {
    if (node.children) {
      sortTree(node.children);
    }
  }
}
