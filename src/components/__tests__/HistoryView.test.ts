import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { timeAgo } from '../../utils/formatters';

describe('HistoryView Logic', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return "Just now" for times < 1 minute ago', () => {
    const now = new Date('2024-01-01T12:00:00Z');
    vi.setSystemTime(now);

    // 30 seconds ago
    const past = new Date('2024-01-01T11:59:30Z').toISOString();
    expect(timeAgo(past)).toBe('Just now');
  });

  it('should format minutes correctly', () => {
    const now = new Date('2024-01-01T12:00:00Z');
    vi.setSystemTime(now);

    // 10 minutes ago
    const past = new Date('2024-01-01T11:50:00Z').toISOString();
    expect(timeAgo(past)).toBe('10m ago');
  });

  it('should format hours correctly', () => {
    const now = new Date('2024-01-01T12:00:00Z');
    vi.setSystemTime(now);

    // 5 hours ago
    const past = new Date('2024-01-01T07:00:00Z').toISOString();
    expect(timeAgo(past)).toBe('5h ago');
  });

  it('should format days correctly', () => {
    const now = new Date('2024-01-01T12:00:00Z');
    vi.setSystemTime(now);

    // 3 days ago
    const past = new Date('2023-12-29T12:00:00Z').toISOString();
    expect(timeAgo(past)).toBe('3d ago');
  });

  it('should format weeks correctly', () => {
    const now = new Date('2024-01-01T12:00:00Z');
    vi.setSystemTime(now);

    // 2 weeks ago (14 days)
    const past = new Date('2023-12-18T12:00:00Z').toISOString();
    expect(timeAgo(past)).toBe('2w ago');
  });

  it('should format months correctly', () => {
    const now = new Date('2024-01-01T12:00:00Z');
    vi.setSystemTime(now);

    // 2 months ago (60 days)
    const past = new Date('2023-11-02T12:00:00Z').toISOString();
    expect(timeAgo(past)).toBe('2mo ago');
  });
});
