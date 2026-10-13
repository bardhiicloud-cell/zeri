/** Regenerates docs/PERMISSIONS_MATRIX.md from the real decision functions. */
import { writeFileSync } from 'node:fs';
import { renderMatrix } from '../server/permissionsMatrix';

writeFileSync('docs/PERMISSIONS_MATRIX.md', renderMatrix(), 'utf8');
console.log('docs/PERMISSIONS_MATRIX.md u shkrua.');
