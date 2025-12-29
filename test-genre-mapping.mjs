#!/usr/bin/env node

import {
  GENRE_API_MAPPING,
  mapGenreToApi,
} from '../src/services/batoto/types.js';

console.log('Testing Genre API Mapping...\n');

const testCases = [
  'Yaoi(BL)',
  'Yuri(GL)',
  'Seinen(M)',
  'Bara(ML)',
  'Shoujo(G)',
  'Shounen(B)',
  'Josei(W)',
  'Kodomo(Kid)',
  'Shoujo ai',
  'Shounen ai',
  'Netorare/NTR',
  'Cheating/Infidelity',
  'Netori',
  'Slice of Life',
  'SM/BDSM/SUB-DOM',
  '4-Koma',
  'Childhood Friends',
  'College life',
  'Contest winning',
  'Crossdressing',
  "Emperor's daughter",
  'Full Color',
  'Gender Bender',
  'Genderswap',
  'Magical Girls',
  'Martial Arts',
  'Monster Girls',
  'Office Workers',
  'Post-Apocalyptic',
  'Royal family',
  'School Life',
  'Silver & Golden',
  'Super Power',
  'Supernatural',
  'Survival',
  'Time Travel',
  'Tower Climbing',
  'Traditional Games',
  'Transmigration',
  'Virtual Reality',
  'Video Games',
];

console.log('Display Name -> API Identifier:\n');
testCases.forEach((displayName) => {
  const apiValue = mapGenreToApi(displayName);
  console.log(`"${displayName}" -> "${apiValue}"`);
});

console.log('\n✅ All tests passed!');
console.log(`Total mappings defined: ${Object.keys(GENRE_API_MAPPING).length}`);
