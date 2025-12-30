// src/services/batoto/client.ts

import { BATO_MIRRORS, USER_AGENTS, MIRROR_TIMEOUT_MS } from '../../config';

export class BatotoClient {
  private static instance: BatotoClient;
  private activeMirror: string | null = null;
  private userAgent: string;
  private cookies: Map<string, string> = new Map();

  private constructor() {
    this.userAgent =
      USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
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

    console.log('[SmutHub] Resolving mirrors...');

    // Safer updated logic with timeouts:
    for (const mirror of BATO_MIRRORS) {
      try {
        console.log(`[SmutHub] Checking mirror: ${mirror}`);
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), MIRROR_TIMEOUT_MS);

        const res = await fetch(mirror, {
          method: 'GET',
          signal: controller.signal,
          headers: {
            'User-Agent': this.userAgent,
            'Accept-Language': 'en-US,en;q=0.9',
          },
        });

        clearTimeout(timeoutId);

        if (res.ok || res.status < 500) {
          this.activeMirror = mirror;
          const setCookie = res.headers.get('set-cookie');
          this.saveCookies(setCookie);
          console.log(`[SmutHub] Active mirror set to: ${this.activeMirror}`);
          return;
        } else {
          console.warn(
            `[SmutHub] Mirror ${mirror} returned status: ${res.status}`,
          );
        }
      } catch (e: any) {
        console.error(
          `[SmutHub] Mirror check failed for ${mirror}: ${e.message}`,
        );
      }
    }

    // Fallback
    this.activeMirror = BATO_MIRRORS[0];
    console.warn(
      `[SmutHub] Could not verify any mirror, defaulting to ${this.activeMirror}`,
    );
  }

  public getBaseUrl(): string {
    return this.activeMirror || BATO_MIRRORS[0];
  }

  private getHeaders(): HeadersInit {
    const headers: Record<string, string> = {
      'User-Agent': this.userAgent,
      Referer: this.getBaseUrl() + '/',
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
  public async fetch(
    path: string,
    options: RequestInit = {},
  ): Promise<Response> {
    if (!this.activeMirror) await this.initialize();

    const url = `${this.activeMirror}${path.startsWith('/') ? path : '/' + path}`;

    const mergedOptions = {
      ...options,
      headers: {
        ...this.getHeaders(),
        ...options.headers,
      },
    };

    console.log(`[SmutHub] Fetching ${url} with ${this.cookies.size} cookies`);

    try {
      const response = await fetch(url, mergedOptions);
      console.log(`[SmutHub] Response Status: ${response.status} (${response.statusText})`);
      response.headers.forEach((value, key) => {
        console.log(`[SmutHub] Header: ${key} = ${value}`);
      });

      // Capture new cookies
      this.saveCookies(response.headers.get('set-cookie'));
      if (response.headers.get('set-cookie')) {
        console.log(
          `[SmutHub] Received new cookies, total: ${this.cookies.size}`,
        );
      }

      if (!response.ok) {
        // Handle specific error codes relevant to blocking?
        if (response.status === 403 || response.status === 503) {
          console.warn(`[SmutHub] Encountered ${response.status} at ${url}`);
          // Might implement aggressive rotation here later
        }
      }
      return response;
    } catch (error) {
      console.error(`[SmutHub] Network error for ${url}`, error);
      throw error;
    }
  }
}
