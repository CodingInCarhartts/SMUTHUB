// src/services/batoto/client.ts

import { BATO_MIRRORS, MIRROR_TIMEOUT_MS, USER_AGENTS } from '../../config';
import { logCapture } from '../debugLog';
import { NetworkLogService } from '../networkLog';

// Helper for debug logging that we know works in Lynx
const log = (...args: any[]) => logCapture('log', ...args);
const logError = (...args: any[]) => logCapture('error', ...args);
const logWarn = (...args: any[]) => logCapture('warn', ...args);

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

    log('[SmutHub] Resolving mirrors...');

    // Shuffle mirrors to avoid every device hitting the same "first" mirror
    // which might be slow or blocked for some users.
    const shuffledMirrors = [...BATO_MIRRORS].sort(() => Math.random() - 0.5);

    for (const mirror of shuffledMirrors) {
      let reqId: string | undefined;
      try {
        log(`[SmutHub] Checking mirror: ${mirror}`);
        const controller = new AbortController();
        const timeoutId = setTimeout(
          () => controller.abort(),
          MIRROR_TIMEOUT_MS,
        );

        // Log initialization checks
        reqId = NetworkLogService.logRequest('GET', mirror, {
          'User-Agent': this.userAgent,
          'Accept-Language': 'en-US,en;q=0.9',
        });

        const res = await fetch(mirror, {
          method: 'GET',
          signal: controller.signal,
          headers: {
            'User-Agent': this.userAgent,
            'Accept-Language': 'en-US,en;q=0.9',
          },
        });

        clearTimeout(timeoutId);

        if (reqId) {
          NetworkLogService.logResponse(
            reqId,
            res.status,
            res.statusText,
            {},
            'Mirror Check',
          );
        }

        // Restrict to successful responses (2xx)
        // If it's a 403 or 503, it might be a block page
        if (res.ok) {
          this.activeMirror = mirror;
          const setCookie = res.headers.get('set-cookie');
          this.saveCookies(setCookie);
          log(`[SmutHub] Active mirror set to: ${this.activeMirror}`);
          return;
        } else {
          logWarn(`[SmutHub] Mirror ${mirror} returned status: ${res.status}`);
        }
      } catch (e: any) {
        if (reqId) {
          NetworkLogService.logError(reqId, e.message || 'Timeout');
        }
        logError(`[SmutHub] Mirror check failed for ${mirror}: ${e.message}`);
      }
    }

    // Fallback if all shuffled checks failed
    this.activeMirror = BATO_MIRRORS[0];
    logWarn(
      `[SmutHub] Could not verify any mirror, defaulting to fallback ${this.activeMirror}`,
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

    // Safe header merging
    const baseHeaders = this.getHeaders() as Record<string, string>;
    const optHeaders = options.headers || {};
    let extraHeaders: Record<string, string> = {};

    if (optHeaders instanceof Headers) {
      optHeaders.forEach((v, k) => {
        extraHeaders[k] = v;
      });
    } else if (Array.isArray(optHeaders)) {
      optHeaders.forEach(([k, v]) => {
        extraHeaders[k] = v;
      });
    } else {
      extraHeaders = optHeaders as Record<string, string>;
    }

    const mergedHeaders = {
      ...baseHeaders,
      ...extraHeaders,
    };

    const mergedOptions = {
      ...options,
      headers: mergedHeaders,
    };

    log(`[SmutHub] Fetching ${url} with ${this.cookies.size} cookies`);

    const method = options.method || 'GET';
    const reqId = NetworkLogService.logRequest(method, url, mergedHeaders);

    try {
      const response = await fetch(url, mergedOptions);
      log(
        `[SmutHub] Response Status: ${response.status} (${response.statusText})`,
      );

      const resHeaders: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        resHeaders[key] = value;
      });

      NetworkLogService.logResponse(
        reqId,
        response.status,
        response.statusText,
        resHeaders,
      );

      // Capture new cookies
      this.saveCookies(response.headers.get('set-cookie'));
      if (response.headers.get('set-cookie')) {
        log(`[SmutHub] Received new cookies, total: ${this.cookies.size}`);
      }

      if (!response.ok) {
        if (response.status === 403 || response.status === 503) {
          logWarn(`[SmutHub] Encountered ${response.status} at ${url}`);
          // If the active mirror starts failing with 403, we might want to trigger re-init
          // but for now we just log it.
        }
      }
      return response;
    } catch (error: any) {
      logError(`[SmutHub] Network error for ${url}`, error);
      NetworkLogService.logError(reqId, error.message || 'Network Fail');
      throw error;
    }
  }
}
