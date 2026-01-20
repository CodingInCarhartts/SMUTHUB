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
    // Batoto is dead. Disable probing.
    log('[SmutHub] Batoto is shutdown. Skipping mirror probe.');
    return;
  }

  public getBaseUrl(): string {
    return this.activeMirror || BATO_MIRRORS[0];
  }

  public async fetch(path: string, options: RequestInit = {}): Promise<Response> {
    if (!this.activeMirror) {
      await this.initialize();
      if (!this.activeMirror) {
         // Fail silently or throw, preferably throw so Service handles it
         throw new Error('Batoto is shutdown (No active mirror)');
      }
    }

    const url = `${this.activeMirror}${path.startsWith('/') ? path.substring(1) : path}`;
    const headers = new Headers(options.headers);

    // Add cookies
    const cookieHeader = this.getCookieHeader();
    if (cookieHeader) {
      headers.append('Cookie', cookieHeader);
    }

    // Add User-Agent if not present (though we usually set it)
    if (!headers.has('User-Agent')) {
      headers.set('User-Agent', this.userAgent);
    }
    
    // Add default Referer if not present
    if (!headers.has('Referer')) {
        headers.set('Referer', this.activeMirror!);
    }

    const finalOptions: RequestInit = {
      ...options,
      headers,
    };

    let reqId: string | undefined;
    
    // Only log write operations or significant ones to reduce noise?
    // For now keep standard logging
    if (options.method === 'POST') {
        reqId = NetworkLogService.logRequest('POST', url, Object.fromEntries(headers.entries()));
    }

    try {
      const res = await fetch(url, finalOptions);

      if (reqId) {
        NetworkLogService.logResponse(reqId, res.status, res.statusText, {}, 'API Call');
      }

      // Update cookies
      const setCookie = res.headers.get('set-cookie');
      if (setCookie) {
        this.saveCookies(setCookie);
      }

      return res;
    } catch (e: any) {
      if (reqId) {
        NetworkLogService.logError(reqId, e.message || 'Network Error');
      }
      throw e;
    }
  }
}
