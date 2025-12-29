import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DebugLogService, logCapture } from './debugLog';

describe('DebugLogService', () => {
  beforeEach(() => {
    DebugLogService.clear();
  });

  describe('log capturing', () => {
    it('should capture logs using logCapture', () => {
      logCapture('log', 'test message', { data: 123 });
      const logs = DebugLogService.getLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0].level).toBe('log');
      expect(logs[0].args).toContain('test message');
      expect(logs[0].args).toContain('"data": 123');
    });

    it('should capture logs via console override', () => {
      console.log('console override test');
      const logs = DebugLogService.getLogs();
      // Note: There might be an initialization log, so we check if it includes our message
      expect(logs.some(l => l.args.includes('console override test'))).toBe(true);
    });

    it('should limit logs to MAX_LOGS', () => {
      for (let i = 0; i < 600; i++) {
        logCapture('log', `log ${i}`);
      }
      expect(DebugLogService.count()).toBe(500);
      expect(DebugLogService.getLogs()[0].args).toBe('log 100');
    });
  });

  describe('report generation', () => {
    it('should generate a debug report with environment info', () => {
      const report = DebugLogService.getDebugReport();
      expect(report).toContain('SMUTHUB DEBUG REPORT');
      expect(report).toContain('ENVIRONMENT');
      expect(report).toContain('SystemInfo available: true');
    });

    it('should include logs in text format', () => {
      logCapture('error', 'Critical failure');
      const text = DebugLogService.getLogsAsText();
      expect(text).toContain('[ERROR] Critical failure');
    });

    it('should capture console error and warn', () => {
      console.error('test error');
      console.warn('test warn');
      const text = DebugLogService.getLogsAsText();
      expect(text).toContain('[ERROR] test error');
      expect(text).toContain('[WARN] test warn');
    });
  });
});
