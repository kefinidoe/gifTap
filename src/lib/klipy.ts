import type { GifFeedResponse, GifItem } from '../types/gif.ts';

interface KlipyMediaVariant {
  url?: string;
  width?: number;
  height?: number;
  dims?: [number, number];
}

interface KlipySizeBucket {
  webp?: KlipyMediaVariant;
  mp4?: KlipyMediaVariant;
  webm?: KlipyMediaVariant;
  jpg?: KlipyMediaVariant;
  png?: KlipyMediaVariant;
  gif?: KlipyMediaVariant;
}

interface RawKlipyItem {
  id?: string | number;
  slug?: string;
  title?: string;
  content_description?: string;
  url?: string;
  itemurl?: string;
  tags?: string[];
  file?: {
    hd?: KlipySizeBucket;
    md?: KlipySizeBucket;
    sm?: KlipySizeBucket;
    xs?: KlipySizeBucket;
  };
  media_formats?: Record<string, KlipyMediaVariant>;
  images?: Record<string, { url?: string; webp?: string; mp4?: string; width?: string | number; height?: string | number }>;
}

const PRIVATE_IP_PATTERNS = [
  /^localhost$/i,
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2\d|3[0-1])\./,
  /^192\.168\./,
  /^169\.254\./,
  /^0\./,
  /^\[?::1\]?$/,
  /^\[?fc/i,
  /^\[?fd/i,
  /^\[?fe80:/i,
];

export function isSafePublicHttpUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return false;
    }
    const hostname = parsed.hostname;
    if (!hostname || PRIVATE_IP_PATTERNS.some((pattern) => pattern.test(hostname))) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

function toPositiveInt(value: unknown, fallback: number): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : fallback;
}

function pickFromBucket(
  buckets: Array<KlipySizeBucket | undefined>,
  format: keyof KlipySizeBucket
): KlipyMediaVariant | undefined {
  for (const bucket of buckets) {
    const variant = bucket?.[format];
    if (variant?.url) {
      return variant;
    }
  }
  return undefined;
}

export function normalizeKlipyItem(raw: RawKlipyItem, index: number): GifItem | null {
  const id = String(raw.id ?? raw.slug ?? `klipy-${index}`);
  const title = (raw.title || raw.content_description || 'Animated GIF').trim();
  const slug = String(raw.slug || id);

  // 1. Klipy v1 `file` structure (hd/md/sm/xs -> webp/mp4/jpg)
  const fileBuckets = [raw.file?.md, raw.file?.sm, raw.file?.hd, raw.file?.xs];
  const hdBuckets = [raw.file?.hd, raw.file?.md, raw.file?.sm, raw.file?.xs];

  const webpVariant =
    pickFromBucket(fileBuckets, 'webp') ||
    raw.media_formats?.mediumwebp ||
    raw.media_formats?.webp ||
    raw.media_formats?.tinywebp;

  const mp4Variant =
    pickFromBucket(hdBuckets, 'mp4') ||
    raw.media_formats?.mp4 ||
    raw.media_formats?.tinymp4 ||
    raw.media_formats?.loopedmp4;

  const stillVariant =
    pickFromBucket(fileBuckets, 'jpg') ||
    pickFromBucket(fileBuckets, 'png') ||
    raw.media_formats?.jpg;

  // 2. Fallback to Giphy-style `images` if returned by compatibility endpoints
  const giphyWebp = raw.images?.fixed_width?.webp || raw.images?.original?.webp;
  const giphyMp4 = raw.images?.original?.mp4 || raw.images?.fixed_width?.mp4;
  const giphyStill = raw.images?.fixed_width_still?.url || raw.images?.original_still?.url;

  const webpUrl = webpVariant?.url || giphyWebp || '';
  const mp4Url = mp4Variant?.url || giphyMp4 || '';
  const stillUrl = stillVariant?.url || giphyStill || webpUrl;

  // Last-resort fallback if a specific item only supplies a gif URL
  const fallbackGif = pickFromBucket(fileBuckets, 'gif')?.url || raw.images?.fixed_width?.url || '';
  const effectiveWebp = webpUrl || fallbackGif;

  if (!effectiveWebp && !mp4Url) {
    return null;
  }

  const width = toPositiveInt(
    webpVariant?.width ?? webpVariant?.dims?.[0] ?? mp4Variant?.width ?? mp4Variant?.dims?.[0] ?? raw.images?.fixed_width?.width,
    480
  );
  const height = toPositiveInt(
    webpVariant?.height ?? webpVariant?.dims?.[1] ?? mp4Variant?.height ?? mp4Variant?.dims?.[1] ?? raw.images?.fixed_width?.height,
    360
  );

  const shareUrl = raw.url || raw.itemurl || mp4Url || effectiveWebp;

  return {
    id,
    slug,
    title,
    url: shareUrl,
    webpUrl: effectiveWebp,
    mp4Url: mp4Url || '',
    stillUrl,
    width,
    height,
    tags: Array.isArray(raw.tags) ? raw.tags.slice(0, 6) : [],
  };
}

export class KlipyConfigError extends Error {
  status = 503;
  code = 'MISSING_API_KEY';
}

export class KlipyUpstreamError extends Error {
  status: number;
  constructor(message: string, status = 502) {
    super(message);
    this.status = status;
  }
}

function getKlipyApiKey(): string {
  const key = process.env.KLIPY_API_KEY?.trim();
  if (!key || key === 'MY_KLIPY_API_KEY') {
    throw new KlipyConfigError('KLIPY_API_KEY is not configured on the server.');
  }
  return key;
}

function extractItemsAndPagination(payload: Record<string, unknown>, page: number, perPage: number): GifFeedResponse {
  const dataLevel1 = payload.data as Record<string, unknown> | RawKlipyItem[] | undefined;
  let rawList: RawKlipyItem[] = [];
  let hasNext: boolean | undefined;

  if (Array.isArray(dataLevel1)) {
    rawList = dataLevel1;
  } else if (dataLevel1 && typeof dataLevel1 === 'object') {
    if (Array.isArray(dataLevel1.data)) {
      rawList = dataLevel1.data as RawKlipyItem[];
    } else if (Array.isArray(dataLevel1.results)) {
      rawList = dataLevel1.results as RawKlipyItem[];
    }
    if (typeof dataLevel1.has_next === 'boolean') {
      hasNext = dataLevel1.has_next;
    } else if (typeof dataLevel1.current_page === 'number' && typeof dataLevel1.last_page === 'number') {
      hasNext = dataLevel1.current_page < dataLevel1.last_page;
    }
  } else if (Array.isArray(payload.results)) {
    rawList = payload.results as RawKlipyItem[];
  } else if (Array.isArray(payload.gifs)) {
    rawList = payload.gifs as RawKlipyItem[];
  }

  if (hasNext === undefined) {
    if (typeof payload.has_next === 'boolean') {
      hasNext = payload.has_next;
    } else if (typeof payload.next === 'string' && payload.next.length > 0) {
      hasNext = true;
    } else {
      hasNext = rawList.length >= perPage;
    }
  }

  const items = rawList
    .map((item, idx) => normalizeKlipyItem(item, (page - 1) * perPage + idx))
    .filter((item): item is GifItem => item !== null);

  return {
    items,
    page,
    hasMore: Boolean(hasNext && items.length > 0),
  };
}

async function fetchKlipyJson(urls: string[]): Promise<Record<string, unknown>> {
  let lastStatus = 502;
  let lastMessage = 'Unable to reach Klipy API.';

  for (const url of urls) {
    try {
      const response = await fetch(url, {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'GifTap/1.0',
        },
        signal: AbortSignal.timeout(8000),
      });

      if (response.status === 404) {
        lastStatus = 404;
        continue;
      }

      if (!response.ok) {
        lastStatus = response.status;
        const text = await response.text().catch(() => '');
        lastMessage = text || `Klipy API responded with status ${response.status}`;
        continue;
      }

      const data = (await response.json()) as Record<string, unknown>;
      return data;
    } catch (err) {
      lastMessage = err instanceof Error ? err.message : 'Klipy request failed';
    }
  }

  throw new KlipyUpstreamError(lastMessage, lastStatus);
}

export async function getTrendingGifs(page = 1, perPage = 24): Promise<GifFeedResponse> {
  const apiKey = getKlipyApiKey();
  const safePage = Math.max(1, Math.min(100, page));
  const safePerPage = Math.max(1, Math.min(50, perPage));

  const urls = [
    `https://api.klipy.com/api/v1/trending?api_key=${encodeURIComponent(apiKey)}&page=${safePage}&per_page=${safePerPage}&content_filter=medium`,
    `https://api.klipy.com/api/v1/${encodeURIComponent(apiKey)}/gifs/trending?page=${safePage}&per_page=${safePerPage}&content_filter=medium`,
  ];

  const payload = await fetchKlipyJson(urls);
  return extractItemsAndPagination(payload, safePage, safePerPage);
}

export async function searchGifs(query: string, page = 1, perPage = 24): Promise<GifFeedResponse> {
  const trimmed = query.trim();
  if (!trimmed) {
    return getTrendingGifs(page, perPage);
  }

  const apiKey = getKlipyApiKey();
  const safePage = Math.max(1, Math.min(100, page));
  const safePerPage = Math.max(1, Math.min(50, perPage));

  const urls = [
    `https://api.klipy.com/api/v1/search?api_key=${encodeURIComponent(apiKey)}&q=${encodeURIComponent(trimmed)}&page=${safePage}&per_page=${safePerPage}&content_filter=medium`,
    `https://api.klipy.com/api/v1/${encodeURIComponent(apiKey)}/gifs/search?q=${encodeURIComponent(trimmed)}&page=${safePage}&per_page=${safePerPage}&content_filter=medium`,
  ];

  const payload = await fetchKlipyJson(urls);
  return extractItemsAndPagination(payload, safePage, safePerPage);
}

export interface GifCategory {
  label: string;
  query: string;
}

function toTitleCase(text: string): string {
  return text
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export async function getKlipyCategories(): Promise<GifCategory[]> {
  const apiKey = getKlipyApiKey();
  const urls = [
    `https://api.klipy.com/api/v1/${encodeURIComponent(apiKey)}/gifs/categories`,
    `https://api.klipy.com/api/v1/categories?api_key=${encodeURIComponent(apiKey)}`,
  ];

  const payload = await fetchKlipyJson(urls);
  const dataObj = payload.data as { categories?: Array<{ category?: string; query?: string }> } | undefined;
  const rawCats = Array.isArray(dataObj?.categories) ? dataObj.categories : [];

  return rawCats
    .map((entry) => {
      const query = (entry.query || entry.category || '').trim();
      const label = toTitleCase((entry.category || entry.query || '').trim());
      return { label, query };
    })
    .filter((item) => item.label.length > 0 && item.query.length > 0);
}

export function extractMetaContent(html: string, property: string): string {
  const escaped = property.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(
    `<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']+)["'][^>]*>|<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${escaped}["'][^>]*>`,
    'i'
  );
  const match = html.match(pattern);
  return match?.[1] || match?.[2] || '';
}

export function extractTwitterStatusId(rawUrl: string): string | null {
  try {
    const parsed = new URL(rawUrl);
    const host = parsed.hostname.replace(/^www\./, '').toLowerCase();
    const xHosts = new Set([
      'x.com',
      'twitter.com',
      'mobile.twitter.com',
      'vxtwitter.com',
      'fxtwitter.com',
      'fixupx.com',
      'fixvx.com',
      'xcancel.com',
    ]);
    if (!xHosts.has(host)) {
      return null;
    }
    const match = parsed.pathname.match(/\/status\/(\d+)/);
    return match?.[1] || null;
  } catch {
    return null;
  }
}

export async function resolveTweetMedia(tweetId: string, originalUrl: string): Promise<GifItem | null> {
  // 1. Official Twitter Syndication JSON endpoint (fast, no auth required)
  try {
    const syndToken = ((Number(tweetId) / 1e15) * Math.PI)
      .toString(36)
      .replace(/(0+|\.)/g, '');
    const syndRes = await fetch(
      `https://cdn.syndication.twimg.com/tweet-result?id=${encodeURIComponent(tweetId)}&token=${encodeURIComponent(syndToken || 'x')}`,
      {
        headers: { 'User-Agent': 'GifTap/1.0', Accept: 'application/json' },
        signal: AbortSignal.timeout(5000),
      }
    );
    if (syndRes.ok) {
      type SyndMedia = {
        type?: string;
        media_url_https?: string;
        original_info?: { width?: number; height?: number };
        video_info?: {
          aspect_ratio?: [number, number];
          variants?: Array<{ bitrate?: number; content_type?: string; url?: string }>;
        };
      };
      const data = (await syndRes.json()) as {
        text?: string;
        user?: { name?: string; screen_name?: string };
        mediaDetails?: SyndMedia[];
        quoted_tweet?: {
          mediaDetails?: SyndMedia[];
        };
      };

      const allMedia = [
        ...(data.mediaDetails || []),
        ...(data.quoted_tweet?.mediaDetails || []),
      ];
      const media =
        allMedia.find((m) => m.video_info?.variants?.some((v) => v.content_type === 'video/mp4')) ||
        allMedia[0];
      const variants = media?.video_info?.variants || [];
      const mp4Variants = variants
        .filter((v) => v.content_type === 'video/mp4' && v.url)
        .sort((a, b) => (b.bitrate ?? 0) - (a.bitrate ?? 0));

      const bestMp4 = mp4Variants[0]?.url || '';
      const poster = media?.media_url_https || '';

      if (bestMp4 || poster) {
        const title = data.user?.screen_name
          ? `@${data.user.screen_name}: ${(data.text || 'X GIF').slice(0, 60)}`
          : (data.text || 'X GIF').slice(0, 80);

        return {
          id: `x-${tweetId}`,
          slug: `x-${tweetId}`,
          title,
          url: bestMp4 || originalUrl,
          webpUrl: poster,
          mp4Url: bestMp4,
          stillUrl: poster,
          width: media?.original_info?.width || 480,
          height: media?.original_info?.height || 360,
          tags: [],
        };
      }
    }
  } catch {
    // Fall through to fxtwitter
  }

  // 2. Fallback to fxtwitter public JSON resolver
  try {
    const fxRes = await fetch(`https://api.fxtwitter.com/status/${encodeURIComponent(tweetId)}`, {
      headers: { 'User-Agent': 'GifTap/1.0', Accept: 'application/json' },
      signal: AbortSignal.timeout(5000),
    });
    if (fxRes.ok) {
      const fxData = (await fxRes.json()) as {
        tweet?: {
          text?: string;
          author?: { screen_name?: string };
          media?: {
            videos?: Array<{ url?: string; thumbnail_url?: string; width?: number; height?: number }>;
            photos?: Array<{ url?: string; width?: number; height?: number }>;
          };
          quote?: {
            media?: {
              videos?: Array<{ url?: string; thumbnail_url?: string; width?: number; height?: number }>;
              photos?: Array<{ url?: string; width?: number; height?: number }>;
            };
          };
        };
      };
      const video =
        fxData.tweet?.media?.videos?.[0] || fxData.tweet?.quote?.media?.videos?.[0];
      const photo =
        fxData.tweet?.media?.photos?.[0] || fxData.tweet?.quote?.media?.photos?.[0];
      const mp4Url = video?.url || '';
      const imageUrl = video?.thumbnail_url || photo?.url || '';

      if (mp4Url || imageUrl) {
        const handle = fxData.tweet?.author?.screen_name;
        const text = (fxData.tweet?.text || 'X GIF').slice(0, 60);
        return {
          id: `x-${tweetId}`,
          slug: `x-${tweetId}`,
          title: handle ? `@${handle}: ${text}` : text,
          url: mp4Url || originalUrl,
          webpUrl: imageUrl,
          mp4Url,
          stillUrl: imageUrl,
          width: video?.width || photo?.width || 480,
          height: video?.height || photo?.height || 360,
          tags: [],
        };
      }
    }
  } catch {
    // Fall through to generic HTML meta resolution
  }

  return null;
}

export async function resolveSharedMedia(rawUrl: string): Promise<GifItem> {
  if (!isSafePublicHttpUrl(rawUrl)) {
    throw new KlipyUpstreamError('Invalid or unsupported share URL.', 400);
  }

  const lower = rawUrl.split('?')[0].toLowerCase();
  const isDirectVideo = /\.(mp4|webm|mov)$/.test(lower);
  const isDirectImage = /\.(webp|gif|png|jpe?g|avif)$/.test(lower);

  if (isDirectVideo || isDirectImage) {
    return {
      id: `shared-${Buffer.from(rawUrl).toString('base64url').slice(0, 16)}`,
      slug: 'shared-gif',
      title: 'Shared GIF',
      url: rawUrl,
      webpUrl: isDirectImage ? rawUrl : '',
      mp4Url: isDirectVideo ? rawUrl : '',
      stillUrl: isDirectImage ? rawUrl : '',
      width: 480,
      height: 360,
      tags: [],
    };
  }

  const tweetId = extractTwitterStatusId(rawUrl);
  if (tweetId) {
    const resolvedTweet = await resolveTweetMedia(tweetId, rawUrl);
    if (resolvedTweet) {
      return resolvedTweet;
    }
  }

  try {
    const response = await fetch(rawUrl, {
      headers: {
        Accept: 'text/html,application/xhtml+xml',
        'User-Agent': 'GifTap/1.0',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(5000),
    });

    const contentType = response.headers.get('content-type') || '';
    if (contentType.startsWith('video/')) {
      return {
        id: `shared-${Date.now()}`,
        slug: 'shared-gif',
        title: 'Shared GIF',
        url: rawUrl,
        webpUrl: '',
        mp4Url: rawUrl,
        stillUrl: '',
        width: 480,
        height: 360,
        tags: [],
      };
    }

    if (contentType.startsWith('image/')) {
      return {
        id: `shared-${Date.now()}`,
        slug: 'shared-gif',
        title: 'Shared GIF',
        url: rawUrl,
        webpUrl: rawUrl,
        mp4Url: '',
        stillUrl: rawUrl,
        width: 480,
        height: 360,
        tags: [],
      };
    }

    const html = await response.text();
    const ogVideo =
      extractMetaContent(html, 'og:video:secure_url') ||
      extractMetaContent(html, 'og:video') ||
      extractMetaContent(html, 'twitter:player:stream');
    const ogImage =
      extractMetaContent(html, 'og:image:secure_url') ||
      extractMetaContent(html, 'og:image') ||
      extractMetaContent(html, 'twitter:image');
    const ogTitle = extractMetaContent(html, 'og:title') || 'Shared GIF';

    return {
      id: `shared-${Buffer.from(rawUrl).toString('base64url').slice(0, 16)}`,
      slug: 'shared-gif',
      title: ogTitle.slice(0, 80),
      url: rawUrl,
      webpUrl: ogImage,
      mp4Url: ogVideo,
      stillUrl: ogImage,
      width: 480,
      height: 360,
      tags: [],
    };
  } catch {
    return {
      id: `shared-${Buffer.from(rawUrl).toString('base64url').slice(0, 16)}`,
      slug: 'shared-gif',
      title: 'Shared Link',
      url: rawUrl,
      webpUrl: '',
      mp4Url: '',
      stillUrl: '',
      width: 480,
      height: 360,
      tags: [],
    };
  }
}
