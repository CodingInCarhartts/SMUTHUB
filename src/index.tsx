import '@lynx-js/preact-devtools';
import '@lynx-js/react/debug';
import { root } from '@lynx-js/react';

import { App } from './App.js';

console.log('[Index] Starting root render...');
root.render(<App />);
console.log('[Index] root.render called');

if (import.meta.webpackHot) {
  import.meta.webpackHot.accept();
}
