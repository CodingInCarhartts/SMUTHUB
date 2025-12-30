// Centralized Configuration
// All magic numbers, URLs, and environment constants in one place

// ============================================================
// SUPABASE
// ============================================================
export const SUPABASE_URL = 'https://exymyvbkjsttqsnifedq.supabase.co';
export const SUPABASE_REST_URL = `${SUPABASE_URL}/rest/v1`;
export const SUPABASE_ANON_KEY = 'sb_publishable_tyLE5ronU6B5LAGta5GBjA_ZSqpzHyz';

// ============================================================
// GITHUB / OTA
// ============================================================
export const GITHUB_REPO = 'CodingInCarhartts/SMUTHUB';
export const GITHUB_RAW_BASE = `https://raw.githubusercontent.com/${GITHUB_REPO}`;
export const DEFAULT_OTA_BUNDLE_URL = `${GITHUB_RAW_BASE}/main/main.lynx.bundle`;

// ============================================================
// BATO MIRRORS
// ============================================================
export const BATO_MIRRORS = [
  'https://bato.si',
  'https://mto.to',
  'https://dto.to',
  'https://mangatoto.com',
  'https://battwo.com',
  'https://wto.to',
  'https://hto.to',
  'https://xbato.com',
  'https://zbato.com',
  'https://comiko.net',
];

// ============================================================
// STORAGE LIMITS
// ============================================================
export const HISTORY_LIMIT_LOCAL = 50;
export const HISTORY_LIMIT_CLOUD = 999;
export const MAX_DEBUG_LOGS = 1000;

// ============================================================
// TIMEOUTS (in milliseconds)
// ============================================================
export const MIRROR_TIMEOUT_MS = 5000;           // Timeout for each mirror check
export const NATIVE_DEVICE_ID_TIMEOUT_MS = 2000; // Timeout for native getDeviceId
export const STORAGE_INIT_TIMEOUT_MS = 5000;     // Timeout for storage initialization
export const UPDATE_CHECK_COOLDOWN_MS = 30000;   // Cooldown between update checks
export const SYNC_HEARTBEAT_INTERVAL_MS = 30000; // Background sync interval
export const READER_POSITION_SAVE_DELAY_MS = 1000; // Debounce for saving reader position
export const READER_RESTORE_DELAY_MS = 100;      // Delay before allowing position tracking
export const STATUS_CLEAR_DELAY_MS = 3000;       // Clear status messages after this time
export const PANEL_RETRY_DELAY_MS = 500;         // Delay between panel load retries

// ============================================================
// UI / UX CONSTANTS
// ============================================================
export const SWIPE_THRESHOLD_PX = 50;            // Minimum pixels for swipe detection
export const KEY_DEBOUNCE_MS = 300;              // Debounce for keyboard/remote input
export const SCROLL_PERCENT = 0.1;               // Scroll 10% of screen per key press
export const PANEL_MAX_RETRIES = 5;              // Max retries for loading a panel image
export const REMOTE_TOUCH_DIVIDER_X = 500;       // X coordinate threshold for up/down detection

// ============================================================
// CONTACT INFO
// ============================================================
export const SUPPORT_EMAIL = 'yumlabs.team@gmail.com';

// ============================================================
// USER AGENTS (for scraping)
// ============================================================
export const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
];
