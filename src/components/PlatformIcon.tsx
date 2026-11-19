import { Globe } from 'lucide-react';
import type { SourcePlatform } from '../types/gif';

interface PlatformIconProps {
  platform: SourcePlatform;
  className?: string;
}

export function getPlatformLabel(platform: SourcePlatform): string {
  if (platform === 'tiktok') return 'TikTok';
  if (platform === 'instagram') return 'Instagram';
  if (platform === 'x') return 'X';
  return 'Web';
}

export function PlatformIcon({ platform, className = 'h-4 w-4' }: PlatformIconProps) {
  if (platform === 'tiktok') {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden="true"
        className={className}
      >
        <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64c.298 0 .595.047.88.14V9.4a6.33 6.33 0 0 0-.88-.06A6.34 6.34 0 0 0 3.14 15.7a6.34 6.34 0 0 0 10.82 4.48 6.27 6.27 0 0 0 1.86-4.48V8.81a8.18 8.18 0 0 0 4.77 1.52V6.88a4.85 4.85 0 0 1-1-.19Z" />
      </svg>
    );
  }

  if (platform === 'instagram') {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className={className}
      >
        <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
        <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
        <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
      </svg>
    );
  }

  if (platform === 'x') {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden="true"
        className={className}
      >
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    );
  }

  return <Globe className={className} aria-hidden="true" />;
}
