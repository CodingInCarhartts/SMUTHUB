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
   * Tries to find the fastest responding mirror that supports the API
   */
  public async initialize(): Promise<void> {
    if (this.activeMirror) return;

    log('[SmutHub] Resolving mirrors...');

    // Shuffle mirrors to avoid every device hitting the same "first" mirror
    const shuffledMirrors = [...BATO_MIRRORS].sort(() => Math.random() - 0.5);

    // Limit to checking a subset of mirrors to save time, or just check all if list is reasonable
    for (const mirror of shuffledMirrors) {
      let reqId: string | undefined;
      try {
        const probeUrl = `${mirror}${mirror.endsWith('/') ? '' : '/'}ap2/`;
        // Detect if this is a Bato-style mirror or something else (like Comiko/Mangatoto)
        const isBatoMirror =
          mirror.includes('bato.') ||
          mirror.includes('batoto.') ||
          mirror.includes('.to');

        log(`[SmutHub] Probing mirror API: ${probeUrl}`);

        const controller = new AbortController();
        const timeoutId = setTimeout(
          () => controller.abort(),
          MIRROR_TIMEOUT_MS,
        );

        // MOBILE DATA WORKAROUND:
        // Use a standard POST request with a minimal GraphQL query.
        // We ensure headers are clean and content-type is set.
        reqId = NetworkLogService.logRequest('POST', probeUrl, {
          'User-Agent': this.userAgent,
          'Content-Type': 'application/json',
        });

        // For non-Bato mirrors, we might want to try a simple GET first if POST fails,
        // but for now we'll stick to POST as it's the required API format.
        const res = await fetch(probeUrl, {
          method: 'POST',
          signal: controller.signal,
          headers: {
            'User-Agent': this.userAgent,
            'Content-Type': 'application/json',
            'Accept-Language': 'en-US,en;q=0.9',
          },
          body: JSON.stringify({ query: '{ __typename }' }),
        });

        clearTimeout(timeoutId);

        if (reqId) {
          NetworkLogService.logResponse(
            reqId,
            res.status,
            res.statusText,
            {},
            'API Probe (POST)',
          );
        }

        if (res.ok) {
          this.activeMirror = mirror;
          const setCookie = res.headers.get('set-cookie');
          this.saveCookies(setCookie);
          log(
            `[SmutHub] Active mirror verified and set to: ${this.activeMirror}`,
          );
          return;
        } else {
          logWarn(
            `[SmutHub] Mirror ${mirror} API probe returned status: ${res.status}`,
          );

          // If a Bato-compatible mirror is giving 502/403, we might want to
          // investigate if it's a permanent block or temporary.
        }
      } catch (e: any) {
        if (reqId) {
          NetworkLogService.logError(reqId, e.message || 'Timeout');
        }
        logError(`[SmutHub] Mirror probe failed for ${mirror}: ${e.message}`);
      }
    }

    // Fallback if all probes failed
    this.activeMirror = BATO_MIRRORS[0];
    logWarn(
      `[SmutHub] Could not verify any mirror API, defaulting to fallback ${this.activeMirror}`,
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
   * Core fetch wrapper with retry and rotation logic
   */
  public async fetch(
    path: string,
    options: RequestInit = {},
    retryOnMirrorFail: boolean = true,
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

      // Handle mirror failure (404, 403, 503, 400)
      if (!response.ok) {
        if (
          retryOnMirrorFail &&
          (response.status === 404 ||
            response.status === 403 ||
            response.status === 503 ||
            response.status === 400 ||
            response.status === 499)
        ) {
          logWarn(
            `[SmutHub] Mirror ${this.activeMirror} failed with ${response.status}. Attempting rotation...`,
          );
          // Invalidate current mirror and try another
          this.activeMirror = null;
          // Recursive call with retryOnMirrorFail = false to avoid infinite loops
          return this.fetch(path, options, false);
        }

        if (response.status === 403 || response.status === 503) {
          logWarn(`[SmutHub] Permanent block/fail encountered at ${url}`);
        }
      }
      return response;
    } catch (error: any) {
      logError(`[SmutHub] Network error for ${url}`, error);
      NetworkLogService.logError(reqId, error.message || 'Network Fail');

      if (retryOnMirrorFail) {
        logWarn(
          `[SmutHub] Network error on ${this.activeMirror}. Attempting rotation...`,
        );
        this.activeMirror = null;
        return this.fetch(path, options, false);
      }

      throw error;
    }
  }
}
