import { defineConfig } from '@lynx-js/rspeedy'

import { pluginQRCode } from '@lynx-js/qrcode-rsbuild-plugin'
import { pluginReactLynx } from '@lynx-js/react-rsbuild-plugin'
import { pluginTypeCheck } from '@rsbuild/plugin-type-check'

export default defineConfig({
  /**
   * Production bundle URL:
   * https://codingincarhartts.github.io/SMUTHUB/main.lynx.bundle
   */
  server: {
    host: '0.0.0.0', // Listen on all interfaces
    port: 3002,
  },
  plugins: [
    pluginQRCode({
      schema(url) {
        // We use `?fullscreen=true` to open the page in LynxExplorer in full screen mode
        return `${url}?fullscreen=false`
      },
    }),
    pluginReactLynx(),
    pluginTypeCheck(),
  ],
})
