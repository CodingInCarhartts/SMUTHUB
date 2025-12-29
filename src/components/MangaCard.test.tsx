import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/react';
import { MangaCard } from './MangaCard';
import { StorageService } from '../services/storage';

vi.mock('../services/storage', () => ({
  StorageService: {
    isFavoriteSync: vi.fn(() => false),
    isFavorite: vi.fn(() => Promise.resolve(false)),
    addFavorite: vi.fn(() => Promise.resolve()),
    removeFavorite: vi.fn(() => Promise.resolve()),
  },
}));

// Mock @lynx-js/react hooks
vi.mock('@lynx-js/react', () => {
    const React = require('react');
    return {
        useState: React.useState,
        useEffect: React.useEffect,
        useMemo: React.useMemo,
        useCallback: React.useCallback,
    };
});

// Mock Lynx JSX intrinsic elements in global namespace for JSX transformation
// The JSX runtime will look for these when rendering <view>, <text>, <image> etc.
vi.mock('react/jsx-runtime', async () => {
    const actual = await vi.importActual<typeof import('react/jsx-runtime')>('react/jsx-runtime');
    const React = await import('react');
    
    const lynxToHtmlMap: Record<string, string> = {
        view: 'div',
        text: 'span',
        image: 'img',
    };
    
    return {
        ...actual,
        jsx: (type: any, props: any, key: any) => {
            const mappedType = typeof type === 'string' && lynxToHtmlMap[type] ? lynxToHtmlMap[type] : type;
            // Map Lynx-specific props to HTML equivalents
            const mappedProps = { ...props };
            if (mappedProps.bindtap) {
                mappedProps.onClick = mappedProps.bindtap;
                delete mappedProps.bindtap;
            }
            if (mappedProps.catchtap) {
                mappedProps.onClick = mappedProps.catchtap;
                delete mappedProps.catchtap;
            }
            if (mappedProps.mode) delete mappedProps.mode;
            return actual.jsx(mappedType, mappedProps, key);
        },
        jsxs: (type: any, props: any, key: any) => {
            const mappedType = typeof type === 'string' && lynxToHtmlMap[type] ? lynxToHtmlMap[type] : type;
            const mappedProps = { ...props };
            if (mappedProps.bindtap) {
                mappedProps.onClick = mappedProps.bindtap;
                delete mappedProps.bindtap;
            }
            if (mappedProps.catchtap) {
                mappedProps.onClick = mappedProps.catchtap;
                delete mappedProps.catchtap;
            }
            if (mappedProps.mode) delete mappedProps.mode;
            return actual.jsxs(mappedType, mappedProps, key);
        },
    };
});

describe('MangaCard', () => {
  const mockManga = {
    id: '123',
    title: 'Test Manga',
    cover: 'cover.jpg',
    url: '/path',
    latestChapter: 'Ch. 1',
  };

  const mockOnSelect = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render manga details', () => {
    render(<MangaCard manga={mockManga} onSelect={mockOnSelect} />);
    
    expect(screen.getByText('Test Manga')).toBeDefined();
    expect(screen.getByText('Ch. 1')).toBeDefined();
  });

  it('should render with correct structure', () => {
    const { container } = render(<MangaCard manga={mockManga} onSelect={mockOnSelect} />);
    
    // Check the card structure is rendered
    const card = container.querySelector('.MangaCard');
    expect(card).toBeTruthy();
    
    const coverContainer = container.querySelector('.MangaCard-cover-container');
    expect(coverContainer).toBeTruthy();
    
    const info = container.querySelector('.MangaCard-info');
    expect(info).toBeTruthy();
  });

  it('should render cover image', () => {
    const { container } = render(<MangaCard manga={mockManga} onSelect={mockOnSelect} />);
    
    const coverImage = container.querySelector('.MangaCard-cover');
    expect(coverImage).toBeTruthy();
    expect(coverImage?.getAttribute('src')).toBe('cover.jpg');
  });
});
