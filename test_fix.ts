// Simple test script for BatotoService URL fix logic
const fixUrl = (src: string) => {
  if (src.includes('//k') && src.includes('.mb')) {
    return src.replace(/\/\/k/g, '//n');
  }
  return src;
};

const testUrls = [
  { input: 'https://k01.at.bato.to/img/1.mb.jpg', expected: 'https://n01.at.bato.to/img/1.mb.jpg' },
  { input: 'https://k02.at.bato.to/img/2.mb.png', expected: 'https://n02.at.bato.to/img/2.mb.png' },
  { input: 'https://z01.at.bato.to/img/3.jpg', expected: 'https://z01.at.bato.to/img/3.jpg' }, // No change
  { input: 'https://k01.at.bato.to/no-mb.jpg', expected: 'https://k01.at.bato.to/no-mb.jpg' }, // No .mb, no change
];

let allPassed = true;
testUrls.forEach(({ input, expected }, index) => {
  const result = fixUrl(input);
  if (result === expected) {
    console.log(`Test ${index + 1} PASSED`);
  } else {
    console.error(`Test ${index + 1} FAILED: Expected ${expected}, got ${result}`);
    allPassed = false;
  }
});

if (allPassed) {
  console.log('\nAll URL fix tests passed!');
} else {
  process.exit(1);
}
