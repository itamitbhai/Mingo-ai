import { ApiError } from '../../utils/ApiError';

export { assertSafePath, escapeRegExp, getBaseName, getParentPath } from '../files/file-validation.service';

/**
 * Guards `moveFile`/`moveFolder` against the two ways a move can corrupt the tree: moving
 * something into itself, or into one of its own descendants (which would orphan the subtree).
 */
export function assertValidMove(sourcePath: string, destinationPath: string): void {
  if (destinationPath === sourcePath) {
    throw ApiError.badRequest('Source and destination are the same');
  }

  if (destinationPath.startsWith(`${sourcePath}/`)) {
    throw ApiError.badRequest('Cannot move a folder into itself or one of its own descendants');
  }
}
