export type SourcePlatform = 'tiktok' | 'instagram' | 'x' | 'web';

export interface GifItem {
  id: string;
  slug: string;
  title: string;
  url: string;
  webpUrl: string;
  mp4Url: string;
  stillUrl: string;
  width: number;
  height: number;
  tags: string[];
}

export interface GifFeedResponse {
  items: GifItem[];
  page: number;
  hasMore: boolean;
}

export interface SharePayload {
  url: string;
  text: string;
  title: string;
}

export interface ExtractHistoryEntry {
  id: string;
  sourceUrl: string;
  platform: SourcePlatform;
  downloadedAt: number;
  item: GifItem;
}
