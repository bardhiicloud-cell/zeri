import type { HeritageEntry, HeritageSource } from '../types';
import { KOSOVA_PART1 } from './kosova1';
import { KOSOVA_PART2 } from './kosova2';
import { KOSOVA_PART3 } from './kosova3';
import { UCK_PART1 } from './uck1';
import { UCK_PART2 } from './uck2';
import { SEED_SOURCES } from './sources';

export const SEED_ENTRIES: HeritageEntry[] = [
  ...KOSOVA_PART1, ...KOSOVA_PART2, ...KOSOVA_PART3, ...UCK_PART1, ...UCK_PART2,
];
export { SEED_SOURCES };
export type { HeritageEntry, HeritageSource };
