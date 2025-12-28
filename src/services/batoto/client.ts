// src/services/batoto/client.ts

// bato.si is the primary working mirror
const BATO_MIRRORS = [
  "https://bato.si",
  "https://mto.to",
  "https://dto.to",
  "https://mangatoto.com",
  "https://battwo.com",
  "https://wto.to",
  "https://hto.to",
  "https://xbato.com",
  "https://zbato.com",
  "https://comiko.net",
];

const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
];

export class BatotoClient {
  private static instance: BatotoClient;
  private activeMirror: string | null = null;
  private userAgent: string;
  private cookies: Map<string, string> = new Map();

  private constructor() {
    this.userAgent = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
  }

  public static getInstance(): BatotoClient {
    if (!BatotoClient.instance) {
      BatotoClient.instance = new BatotoClient();
    }
    return BatotoClient.instance;
  }

  private saveCookies(setCookieHeader: string | null) {
    if (!setCookieHeader) return;
    
    // In many environments, multiple Set-Cookie headers are joined with ', '
    // but dates also use commas. We need to split carefully.
    // Real Set-Cookie values usually don't have commas except in dates.
    const cookies = setCookieHeader.split(/,(?=[^;]*=)/);
    
    for (const cookie of cookies) {
      const parts = cookie.trim().split(';')[0].split('=');
      if (parts.length >= 2) {
        const name = parts[0].trim();
        const value = parts.slice(1).join('=').trim();
        this.cookies.set(name, value);
      }
    }
  }

  private getCookieHeader(): string {
    return Array.from(this.cookies.entries())
      .map(([name, value]) => `${name}=${value}`)
      .join('; ');
  }

  /**
   * Initialize dynamic mirror resolution
   * Tries to find the fastest responding mirror
   */
  public async initialize(): Promise<void> {
    if (this.activeMirror) return;

    console.log("[BatotoClient] resolving mirrors...");
    
            // Simple race to find first working mirror
    const checks = BATO_MIRRORS.map(async (url) => {
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 3000);
            // Switch to GET because Lynx native fetch crashes on HEAD
            const res = await fetch(url, { method: 'GET', signal: controller.signal });
            clearTimeout(timeout);
            if (res.ok || res.status === 403) { 
                return url;
            }
        } catch (e) { /* ignore */ }
        return null;
    });

    const result = await Promise.race(checks.filter(p => p !== null));
    
    // Safer updated logic:
    for (const mirror of BATO_MIRRORS) {
        try {
            console.log(`[BatotoClient] Checking mirror: ${mirror}`);
            const res = await fetch(mirror, { 
                method: 'GET',
                headers: {
                    'User-Agent': this.userAgent,
                    'Accept-Language': 'en-US,en;q=0.9',
                }
            }); 
            
            if (res.ok || res.status < 500) {
                this.activeMirror = mirror;
                const setCookie = res.headers.get('set-cookie');
                this.saveCookies(setCookie);
                console.log(`[BatotoClient] Active mirror set to: ${this.activeMirror}. Cookies captured: ${!!setCookie}`);
                return;
            }
        } catch (e) {
            console.error(`[BatotoClient] Mirror check failed for ${mirror}`, e);
        }
    }

    // Fallback
    this.activeMirror = BATO_MIRRORS[0]; 
    console.warn(`[BatotoClient] Could not verify any mirror, defaulting to ${this.activeMirror}`);
  }

  public getBaseUrl(): string {
     return this.activeMirror || BATO_MIRRORS[0];
  }

  private getHeaders(): HeadersInit {
      const headers: Record<string, string> = {
          'User-Agent': this.userAgent,
          'Referer': this.getBaseUrl() + '/',
          'Accept-Language': 'en-US,en;q=0.9',
      };
      
      const cookieHeader = this.getCookieHeader();
      if (cookieHeader) {
          headers['Cookie'] = cookieHeader;
      }
      
      return headers;
  }

  /**
   * Core fetch wrapper with retry and rotation logic potential
   */
  public async fetch(path: string, options: RequestInit = {}): Promise<Response> {
      if (!this.activeMirror) await this.initialize();

      const url = `${this.activeMirror}${path.startsWith('/') ? path : '/' + path}`;
      
      const mergedOptions = {
          ...options,
          headers: {
              ...this.getHeaders(),
              ...options.headers,
          }
      };

      console.log(`[BatotoClient] Fetching ${url} with ${this.cookies.size} cookies`);

      try {
          const response = await fetch(url, mergedOptions);
          
          // Debugging headers
          console.log(`[BatotoClient] Response Status: ${response.status}`);
          response.headers.forEach((value, key) => {
              console.log(`[BatotoClient] Header: ${key} = ${value}`);
          });

          // Capture new cookies
          this.saveCookies(response.headers.get('set-cookie'));
          if (response.headers.get('set-cookie')) {
              console.log(`[BatotoClient] Received new cookies, total: ${this.cookies.size}`);
          }
          
          if (!response.ok) {
               // Handle specific error codes relevant to blocking?
               if (response.status === 403 || response.status === 503) {
                   console.warn(`[BatotoClient] Encountered ${response.status} at ${url}`);
                   // Might implement aggressive rotation here later
               }
          }
          return response;
      } catch (error) {
          console.error(`[BatotoClient] Network error for ${url}`, error);
          throw error;
      }
  }
}
