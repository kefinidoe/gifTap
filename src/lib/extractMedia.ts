import type { GifItem, SourcePlatform } from '../types/gif.ts';
import {
  extractMetaContent,
  extractTwitterStatusId,
  isSafePublicHttpUrl,
  resolveTweetMedia,
} from './klipy.ts';

const INVALID_OR_NOT_FOUND_MESSAGE =
  'Could not find GIF. Make sure link is public and is a video/GIF comment.';
const INSTAGRAM_PRIVATE_MESSAGE = "Instagram private posts can't be downloaded.";

export type ExtractErrorCode = 'INVALID_URL' | 'INSTAGRAM_PRIVATE' | 'NOT_FOUND';

export class ExtractMediaError extends Error {
  status: number;
  code: ExtractErrorCode;

  constructor(message: string, status: number, code: ExtractErrorCode) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export interface ExtractMediaResult {
  item: GifItem;
  platform: SourcePlatform;
  sourceUrl: string;
}

const BROWSER_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
};

const MOBILE_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
};

const CRAWLER_HEADERS = {
  'User-Agent': 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
};

const REDIRECT_HEADERS = {
  'User-Agent': 'WhatsApp/2.23.20.0 A',
  Accept: '*/*',
};

function normalizeCandidateUrl(rawInput: string): string {
  const trimmed = rawInput.trim();
  if (!trimmed) return '';

  const embeddedUrl = trimmed.match(/https?:\/\/[^\s"'<>]+/i)?.[0];
  if (embeddedUrl) {
    return embeddedUrl.replace(/[),.;!?]+$/, '');
  }

  if (/^(?:www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)+\/\S*/i.test(trimmed)) {
    return `https://${trimmed}`;
  }

  return trimmed;
}

function isShortLinkUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    const host = parsed.hostname.replace(/^www\./, '').toLowerCase();
    if (
      host === 't.co' ||
      host === 'vm.tiktok.com' ||
      host === 'vt.tiktok.com' ||
      host === 'm.tiktok.com' ||
      host === 'instagr.am'
    ) {
      return true;
    }
    if ((host === 'tiktok.com' || host.endsWith('.tiktok.com')) && /^\/t\/[A-Za-z0-9_-]+/i.test(parsed.pathname)) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

async function resolveShortLinkIfNeeded(rawUrl: string): Promise<string> {
  if (!isShortLinkUrl(rawUrl)) {
    return rawUrl;
  }

  let current = rawUrl;
  for (let hop = 0; hop < 6; hop++) {
    try {
      const res = await fetch(current, {
        method: 'GET',
        headers: hop === 0 ? REDIRECT_HEADERS : MOBILE_HEADERS,
        redirect: 'manual',
        signal: AbortSignal.timeout(5000),
      });

      const location = res.headers.get('location');
      if (!location) {
        // Fallback: try follow once if manual returned 200 without Location
        if (hop === 0) {
          const followed = await fetch(current, {
            method: 'GET',
            headers: MOBILE_HEADERS,
            redirect: 'follow',
            signal: AbortSignal.timeout(5000),
          });
          if (
            followed.url &&
            isSafePublicHttpUrl(followed.url) &&
            !/\/login\b|\/verify\b/i.test(followed.url)
          ) {
            return followed.url;
          }
        }
        break;
      }

      const nextUrl = new URL(location, current).toString();
      if (!isSafePublicHttpUrl(nextUrl) || /\/login\b|\/verify\b/i.test(nextUrl)) {
        break;
      }
      current = nextUrl;
      if (!isShortLinkUrl(current)) {
        break;
      }
    } catch {
      break;
    }
  }

  return current;
}

function isKnownMediaCdnHost(rawUrl: string): boolean {
  try {
    const host = new URL(rawUrl).hostname.toLowerCase();
    return (
      host.includes('tiktokcdn') ||
      host.includes('ibyteimg') ||
      host.includes('byteimg') ||
      host.includes('byteoversea') ||
      host.includes('ibytedtos') ||
      host.includes('muscdn') ||
      host.includes('pstatp') ||
      host === 'video.twimg.com' ||
      host === 'pbs.twimg.com' ||
      host.includes('fbcdn.net') ||
      host.includes('cdninstagram.com') ||
      (host.includes('giphy.com') && host.startsWith('media')) ||
      host === 'media.tenor.com' ||
      host === 'static.klipy.com'
    );
  } catch {
    return false;
  }
}

async function probeDirectMediaResponse(rawUrl: string): Promise<GifItem | null> {
  const lower = rawUrl.split('?')[0].toLowerCase();
  const isDirectVideo = /\.(mp4|webm|mov|m4v)$/.test(lower);
  const isDirectImage = /\.(awebp|webp|gif|apng|png|jpe?g|avif)$/.test(lower);

  if (isDirectVideo || isDirectImage) {
    return {
      id: `media-${Buffer.from(rawUrl).toString('base64url').slice(0, 16)}`,
      slug: 'direct-gif',
      title: isDirectImage ? 'Comment GIF' : 'Direct GIF',
      url: rawUrl,
      webpUrl: isDirectImage ? rawUrl : '',
      mp4Url: isDirectVideo ? rawUrl : '',
      stillUrl: isDirectImage ? rawUrl : '',
      width: 480,
      height: 360,
      tags: [],
    };
  }

  if (!isKnownMediaCdnHost(rawUrl)) {
    return null;
  }

  try {
    const probeHeaders: Record<string, string> = {
      ...BROWSER_HEADERS,
      Range: 'bytes=0-0',
    };
    if (/tiktok|ibyte|byte/i.test(rawUrl)) {
      probeHeaders.Referer = 'https://www.tiktok.com/';
    }

    const res = await fetch(rawUrl, {
      method: 'GET',
      headers: probeHeaders,
      redirect: 'follow',
      signal: AbortSignal.timeout(5000),
    });
    const contentType = (res.headers.get('content-type') || '').toLowerCase();
    if (contentType.startsWith('video/')) {
      return {
        id: `media-${Buffer.from(rawUrl).toString('base64url').slice(0, 16)}`,
        slug: 'direct-gif',
        title: 'Direct Video GIF',
        url: rawUrl,
        webpUrl: '',
        mp4Url: rawUrl,
        stillUrl: '',
        width: 480,
        height: 480,
        tags: [],
      };
    }
    if (contentType.startsWith('image/')) {
      return {
        id: `media-${Buffer.from(rawUrl).toString('base64url').slice(0, 16)}`,
        slug: 'direct-gif',
        title: 'Comment GIF',
        url: rawUrl,
        webpUrl: rawUrl,
        mp4Url: '',
        stillUrl: rawUrl,
        width: 480,
        height: 480,
        tags: [],
      };
    }
  } catch {
    // Fall through to normal extractors
  }

  return null;
}

export function detectSourcePlatform(rawUrl: string): SourcePlatform {
  try {
    const host = new URL(rawUrl).hostname.replace(/^www\./, '').toLowerCase();
    if (
      host === 'tiktok.com' ||
      host.endsWith('.tiktok.com') ||
      host.includes('ibyteimg') ||
      host.includes('byteimg') ||
      host.includes('ibytedtos') ||
      host.includes('byteoversea') ||
      host.includes('tiktokcdn')
    ) {
      return 'tiktok';
    }
    if (host === 'instagram.com' || host.endsWith('.instagram.com') || host === 'instagr.am') {
      return 'instagram';
    }
    if (
      host === 'x.com' ||
      host === 'twitter.com' ||
      host === 'mobile.twitter.com' ||
      host === 'fxtwitter.com' ||
      host === 'vxtwitter.com' ||
      host === 'fixupx.com' ||
      host === 'fixvx.com'
    ) {
      return 'x';
    }
    return 'web';
  } catch {
    return 'web';
  }
}

function unescapeExtractedUrl(raw: string): string {
  if (!raw) return '';
  return raw
    .replace(/\\u002F/gi, '/')
    .replace(/\\u0026/gi, '&')
    .replace(/\\\//g, '/')
    .replace(/&amp;/gi, '&')
    .trim();
}

function extractVideoTagSrc(html: string): string {
  const videoMatch = html.match(/<video[^>]+src=["']([^"']+)["'][^>]*>/i);
  if (videoMatch?.[1]) return unescapeExtractedUrl(videoMatch[1]);
  const sourceMatch = html.match(/<source[^>]+src=["']([^"']+\.(?:mp4|webm|mov)[^"']*)["'][^>]*>/i);
  if (sourceMatch?.[1]) return unescapeExtractedUrl(sourceMatch[1]);
  return '';
}

async function fetchHtml(
  url: string,
  headers: Record<string, string> = BROWSER_HEADERS
): Promise<{ html: string; finalUrl: string; status: number }> {
  const response = await fetch(url, {
    headers,
    redirect: 'follow',
    signal: AbortSignal.timeout(8000),
  });
  const html = await response.text();
  return {
    html,
    finalUrl: response.url || url,
    status: response.status,
  };
}

function findUrlInUnknown(value: unknown, depth = 0): string {
  if (depth > 5) return '';
  if (typeof value === 'string' && value.startsWith('http')) {
    return unescapeExtractedUrl(value);
  }
  if (Array.isArray(value)) {
    for (const entry of value) {
      const found = findUrlInUnknown(entry, depth + 1);
      if (found) return found;
    }
  }
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if (Array.isArray(record.UrlList)) {
      const found = findUrlInUnknown(record.UrlList, depth + 1);
      if (found) return found;
    }
    if (Array.isArray(record.url_list)) {
      const found = findUrlInUnknown(record.url_list, depth + 1);
      if (found) return found;
    }
    if (record.PlayAddr) {
      const found = findUrlInUnknown(record.PlayAddr, depth + 1);
      if (found) return found;
    }
    if (record.playAddr) {
      const found = findUrlInUnknown(record.playAddr, depth + 1);
      if (found) return found;
    }
  }
  return '';
}

function deepFindTikTokVideo(node: unknown, depth = 0): {
  videoUrl: string;
  coverUrl: string;
  title: string;
} {
  if (!node || typeof node !== 'object' || depth > 10) {
    return { videoUrl: '', coverUrl: '', title: '' };
  }

  const record = node as Record<string, unknown>;
  const hasPlay = 'playAddr' in record || 'downloadAddr' in record || 'bitrateInfo' in record;
  if (hasPlay) {
    const videoUrl =
      findUrlInUnknown(record.playAddr) ||
      findUrlInUnknown(record.downloadAddr) ||
      findUrlInUnknown(record.bitrateInfo);
    const coverUrl =
      findUrlInUnknown(record.originCover) ||
      findUrlInUnknown(record.cover) ||
      findUrlInUnknown(record.dynamicCover);
    if (videoUrl) {
      return { videoUrl, coverUrl, title: '' };
    }
  }

  const title = typeof record.desc === 'string' ? record.desc.trim() : '';

  const values = Array.isArray(node) ? node : Object.values(record);
  for (const child of values) {
    if (child && typeof child === 'object') {
      const result = deepFindTikTokVideo(child, depth + 1);
      if (result.videoUrl) {
        return {
          videoUrl: result.videoUrl,
          coverUrl: result.coverUrl,
          title: result.title || title,
        };
      }
    }
  }

  return { videoUrl: '', coverUrl: '', title: '' };
}

function extractTikTokVideoId(rawUrl: string): string | null {
  try {
    const parsed = new URL(rawUrl);
    const pathMatch = parsed.pathname.match(/\/(?:video|photo|v)\/(\d{12,24})/i);
    if (pathMatch?.[1]) return pathMatch[1];
    const itemId = parsed.searchParams.get('item_id') || parsed.searchParams.get('aweme_id');
    if (itemId && /^\d{12,24}$/.test(itemId)) return itemId;
  } catch {
    // Ignore parse error
  }
  return null;
}

function extractTikTokCommentId(rawUrl: string): string | null {
  try {
    const parsed = new URL(rawUrl);
    const cid =
      parsed.searchParams.get('comment_id') ||
      parsed.searchParams.get('cid') ||
      parsed.searchParams.get('focus_comment_id');
    return cid && /^\d{10,24}$/.test(cid) ? cid : null;
  } catch {
    return null;
  }
}

async function extractTikTokCommentAttachment(
  awemeId: string,
  commentId: string,
  sourceUrl: string
): Promise<GifItem | null> {
  try {
    const apiUrl = `https://www.tiktok.com/api/comment/list/?aid=1988&aweme_id=${encodeURIComponent(awemeId)}&count=20&cursor=0&focus_comment_id=${encodeURIComponent(commentId)}`;
    const res = await fetch(apiUrl, {
      headers: { ...BROWSER_HEADERS, Accept: 'application/json' },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;

    type TikTokComment = {
      cid?: string;
      text?: string;
      image_list?: Array<{
        origin_url?: { url_list?: string[] };
        medium_url?: { url_list?: string[] };
        crop_url?: { url_list?: string[] };
      }>;
      sticker_info?: {
        url?: string;
        sticker_url?: { url_list?: string[] };
      };
    };

    const data = (await res.json()) as { comments?: TikTokComment[] };
    const comment = data.comments?.find((c) => c.cid === commentId) || data.comments?.[0];
    if (!comment) return null;

    const imgObj = comment.image_list?.[0];
    const imageUrl =
      imgObj?.origin_url?.url_list?.[0] ||
      imgObj?.medium_url?.url_list?.[0] ||
      imgObj?.crop_url?.url_list?.[0] ||
      comment.sticker_info?.sticker_url?.url_list?.[0] ||
      comment.sticker_info?.url ||
      '';

    if (!imageUrl || !isSafePublicHttpUrl(imageUrl)) {
      return null;
    }

    const isVideo = /\.(mp4|webm|mov)(\?|$)/i.test(imageUrl);
    return {
      id: `tt-comment-${commentId}`,
      slug: `tiktok-comment-${commentId}`,
      title: (comment.text || 'TikTok Comment GIF').slice(0, 80),
      url: sourceUrl,
      webpUrl: isVideo ? '' : imageUrl,
      mp4Url: isVideo ? imageUrl : '',
      stillUrl: isVideo ? '' : imageUrl,
      width: 480,
      height: 480,
      tags: ['tiktok', 'comment'],
    };
  } catch {
    return null;
  }
}

function normalizeTikwmMediaUrl(rawPath: string | undefined): string {
  if (!rawPath) return '';
  if (rawPath.startsWith('/')) {
    return `https://www.tikwm.com${rawPath}`;
  }
  return rawPath;
}

async function resolveViaTikwm(targetUrl: string): Promise<GifItem | null> {
  const tryOnce = async (usePost: boolean) => {
    const response = usePost
      ? await fetch('https://www.tikwm.com/api/', {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': 'GifTap/1.0',
          },
          body: new URLSearchParams({ url: targetUrl, hd: '1' }),
          signal: AbortSignal.timeout(8000),
        })
      : await fetch(
          `https://www.tikwm.com/api/?url=${encodeURIComponent(targetUrl)}&hd=1`,
          {
            headers: { Accept: 'application/json', 'User-Agent': 'GifTap/1.0' },
            signal: AbortSignal.timeout(8000),
          }
        );

    if (!response.ok) return { retry: false, item: null as GifItem | null };
    const payload = (await response.json()) as {
      code?: number;
      msg?: string;
      data?: {
        id?: string;
        play?: string;
        hdplay?: string;
        wmplay?: string;
        cover?: string;
        origin_cover?: string;
        ai_dynamic_cover?: string;
        title?: string;
        images?: string[];
      };
    };

    if (payload.code !== 0 || !payload.data) {
      const rateLimited = Boolean(payload.msg && /limit|second/i.test(payload.msg));
      return { retry: rateLimited, item: null as GifItem | null };
    }

    const d = payload.data;
    const candidates = [d.hdplay, d.play, d.wmplay]
      .map(normalizeTikwmMediaUrl)
      .filter((u) => Boolean(u) && !/\.mp3(\?|$)/i.test(u));

    const mp4Url = candidates[0] || '';
    const coverUrl = normalizeTikwmMediaUrl(
      d.origin_cover || d.cover || d.ai_dynamic_cover || d.images?.[0]
    );
    const imageSlide = !mp4Url && d.images?.[0] ? normalizeTikwmMediaUrl(d.images[0]) : '';

    if (!mp4Url && !imageSlide) {
      return { retry: false, item: null as GifItem | null };
    }

    return {
      retry: false,
      item: {
        id: `tt-${d.id || Buffer.from(targetUrl).toString('base64url').slice(0, 16)}`,
        slug: 'tiktok-gif',
        title: (d.title || 'TikTok GIF').slice(0, 80),
        url: targetUrl,
        webpUrl: imageSlide || coverUrl,
        mp4Url,
        stillUrl: coverUrl || imageSlide,
        width: 480,
        height: 640,
        tags: ['tiktok'],
      },
    };
  };

  try {
    const first = await tryOnce(false);
    if (first.item) return first.item;
    if (first.retry) {
      await new Promise((resolve) => setTimeout(resolve, 1150));
      const retried = await tryOnce(true);
      if (retried.item) return retried.item;
    }
  } catch {
    // Ignore tikwm failure and fall back to HTML extraction
  }

  return null;
}

async function extractTikTokMedia(resolvedUrl: string, originalUrl: string): Promise<GifItem | null> {
  const videoId = extractTikTokVideoId(resolvedUrl) || extractTikTokVideoId(originalUrl);
  const commentId = extractTikTokCommentId(resolvedUrl) || extractTikTokCommentId(originalUrl);

  // 1. If link points directly to a TikTok comment, check if the comment itself carries an attached GIF/sticker
  if (videoId && commentId) {
    const commentItem = await extractTikTokCommentAttachment(videoId, commentId, resolvedUrl);
    if (commentItem) {
      return commentItem;
    }
  }

  // 2. Try tikwm first so we get a cookie-free CDN video/mp4 URL that plays & downloads reliably in browsers
  const tikwmTargets = Array.from(
    new Set([
      resolvedUrl,
      originalUrl,
      videoId ? `https://www.tiktok.com/@tiktok/video/${videoId}` : '',
    ].filter(Boolean))
  );

  for (const candidate of tikwmTargets) {
    const tikwmItem = await resolveViaTikwm(candidate);
    if (tikwmItem) {
      return tikwmItem;
    }
  }

  // 3. Fallback: Parse TikTok HTML (__UNIVERSAL_DATA_FOR_REHYDRATION__ / SIGI_STATE / og:video)
  let videoUrl = '';
  let coverUrl = '';
  let title = '';

  const htmlTargets = Array.from(
    new Set([
      resolvedUrl,
      videoId ? `https://www.tiktok.com/@tiktok/video/${videoId}` : '',
    ].filter(Boolean))
  );

  for (const target of htmlTargets) {
    for (const headers of [BROWSER_HEADERS, MOBILE_HEADERS]) {
      try {
        const { html } = await fetchHtml(target, headers);

        const scriptPatterns = [
          /<script[^>]+id=["']__UNIVERSAL_DATA_FOR_REHYDRATION__["'][^>]*>([\s\S]*?)<\/script>/i,
          /<script[^>]+id=["']__UNIVERSAL_DATA__["'][^>]*>([\s\S]*?)<\/script>/i,
          /<script[^>]+id=["']SIGI_STATE["'][^>]*>([\s\S]*?)<\/script>/i,
        ];

        for (const pattern of scriptPatterns) {
          const match = html.match(pattern);
          if (match?.[1]) {
            try {
              const parsed = JSON.parse(match[1]) as unknown;
              const found = deepFindTikTokVideo(parsed);
              if (found.videoUrl) {
                videoUrl = found.videoUrl;
                coverUrl = found.coverUrl;
                title = found.title;
                break;
              }
            } catch {
              // Continue to regex checks
            }
          }
        }

        if (!videoUrl) {
          const playMatch = html.match(/"playAddr"\s*:\s*"([^"]+)"/i);
          const downloadMatch = html.match(/"downloadAddr"\s*:\s*"([^"]+)"/i);
          const ogVideo =
            extractMetaContent(html, 'og:video:secure_url') ||
            extractMetaContent(html, 'og:video');
          videoUrl = unescapeExtractedUrl(playMatch?.[1] || downloadMatch?.[1] || ogVideo || '');
        }

        if (!coverUrl) {
          const coverMatch = html.match(/"(?:originCover|cover)"\s*:\s*"([^"]+)"/i);
          const ogImage =
            extractMetaContent(html, 'og:image:secure_url') ||
            extractMetaContent(html, 'og:image');
          coverUrl = unescapeExtractedUrl(coverMatch?.[1] || ogImage || '');
        }

        if (!title) {
          title = extractMetaContent(html, 'og:title') || extractMetaContent(html, 'description');
        }

        if (videoUrl) break;
      } catch {
        // Try next UA/target
      }
    }
    if (videoUrl) break;
  }

  if (!videoUrl) {
    return null;
  }

  if (!coverUrl) {
    try {
      const oembedRes = await fetch(
        `https://www.tiktok.com/oembed?url=${encodeURIComponent(resolvedUrl)}`,
        { signal: AbortSignal.timeout(4000) }
      );
      if (oembedRes.ok) {
        const oembed = (await oembedRes.json()) as { thumbnail_url?: string; title?: string };
        coverUrl = oembed.thumbnail_url || '';
        title = title || oembed.title || '';
      }
    } catch {
      // Optional thumbnail enrichment
    }
  }

  return {
    id: `tt-${videoId || Buffer.from(resolvedUrl).toString('base64url').slice(0, 16)}`,
    slug: 'tiktok-gif',
    title: (title || 'TikTok GIF').slice(0, 80),
    url: resolvedUrl,
    webpUrl: coverUrl,
    mp4Url: videoUrl,
    stillUrl: coverUrl,
    width: 480,
    height: 640,
    tags: ['tiktok'],
  };
}

function isInstagramPrivateHtml(html: string): boolean {
  return (
    /"is_private"\s*:\s*true/i.test(html) ||
    /this account is private/i.test(html) ||
    /restricted video/i.test(html)
  );
}

function buildInstagramEmbedUrl(rawUrl: string): string | null {
  try {
    const parsed = new URL(rawUrl);
    const match = parsed.pathname.match(/\/(p|reel|reels|tv)\/([A-Za-z0-9_-]+)/);
    if (!match) return null;
    const kind = match[1] === 'reels' ? 'reel' : match[1];
    return `https://www.instagram.com/${kind}/${match[2]}/embed/captioned/`;
  } catch {
    return null;
  }
}

async function extractInstagramMedia(rawUrl: string): Promise<GifItem | null> {
  const attempts: Array<{ url: string; headers: Record<string, string> }> = [
    { url: rawUrl, headers: CRAWLER_HEADERS },
    { url: rawUrl, headers: BROWSER_HEADERS },
  ];
  const embedUrl = buildInstagramEmbedUrl(rawUrl);
  if (embedUrl) {
    attempts.push({ url: embedUrl, headers: BROWSER_HEADERS });
  }

  let sawPrivateIndicator = false;

  for (const attempt of attempts) {
    try {
      const { html } = await fetchHtml(attempt.url, attempt.headers);

      if (isInstagramPrivateHtml(html)) {
        sawPrivateIndicator = true;
      }

      const ogVideo =
        extractMetaContent(html, 'og:video:secure_url') ||
        extractMetaContent(html, 'og:video') ||
        extractMetaContent(html, 'twitter:player:stream');

      const jsonVideoMatch =
        html.match(/"video_url"\s*:\s*"([^"]+)"/i) ||
        html.match(/"contentUrl"\s*:\s*"([^"]+)"/i) ||
        html.match(/"video_versions"\s*:\s*\[\s*\{[^}]*"url"\s*:\s*"([^"]+)"/i);

      const videoTagSrc = extractVideoTagSrc(html);

      const mp4Url = unescapeExtractedUrl(ogVideo || jsonVideoMatch?.[1] || videoTagSrc || '');
      if (mp4Url && isSafePublicHttpUrl(mp4Url)) {
        const ogImage =
          extractMetaContent(html, 'og:image:secure_url') ||
          extractMetaContent(html, 'og:image');
        const jsonThumbMatch =
          html.match(/"display_url"\s*:\s*"([^"]+)"/i) ||
          html.match(/"thumbnail_src"\s*:\s*"([^"]+)"/i);
        const stillUrl = unescapeExtractedUrl(ogImage || jsonThumbMatch?.[1] || '');
        const title = extractMetaContent(html, 'og:title') || 'Instagram Reel / GIF';

        return {
          id: `ig-${Buffer.from(rawUrl).toString('base64url').slice(0, 16)}`,
          slug: 'instagram-gif',
          title: title.slice(0, 80),
          url: rawUrl,
          webpUrl: stillUrl,
          mp4Url,
          stillUrl,
          width: 480,
          height: 640,
          tags: ['instagram'],
        };
      }
    } catch {
      // Try next attempt
    }
  }

  if (sawPrivateIndicator) {
    throw new ExtractMediaError(INSTAGRAM_PRIVATE_MESSAGE, 403, 'INSTAGRAM_PRIVATE');
  }

  return null;
}

async function extractXMedia(rawUrl: string): Promise<GifItem | null> {
  // 1. Check X syndication + fxtwitter resolvers immediately for status URLs
  const tweetId = extractTwitterStatusId(rawUrl);
  if (tweetId) {
    const resolved = await resolveTweetMedia(tweetId, rawUrl);
    if (resolved && (resolved.mp4Url || resolved.webpUrl)) {
      return resolved;
    }
  }

  // 2. Fallback: fetch HTML and inspect <article>, <video>, and og:video meta tags
  try {
    const { html } = await fetchHtml(rawUrl, CRAWLER_HEADERS);
    const articleMatch = html.match(/<article[\s\S]*?<\/article>/i);
    const scopedHtml = articleMatch?.[0] || html;
    const videoSrc = extractVideoTagSrc(scopedHtml) || extractVideoTagSrc(html);
    const ogVideo =
      extractMetaContent(html, 'og:video:secure_url') ||
      extractMetaContent(html, 'og:video') ||
      extractMetaContent(html, 'twitter:player:stream');
    const mp4Url = unescapeExtractedUrl(ogVideo || videoSrc || '');
    if (mp4Url && isSafePublicHttpUrl(mp4Url)) {
      const poster =
        extractMetaContent(html, 'og:image:secure_url') ||
        extractMetaContent(html, 'og:image') ||
        extractMetaContent(html, 'twitter:image');
      return {
        id: `x-${Buffer.from(rawUrl).toString('base64url').slice(0, 16)}`,
        slug: 'x-gif',
        title: (extractMetaContent(html, 'og:title') || 'X GIF').slice(0, 80),
        url: rawUrl,
        webpUrl: unescapeExtractedUrl(poster),
        mp4Url,
        stillUrl: unescapeExtractedUrl(poster),
        width: 480,
        height: 360,
        tags: ['x'],
      };
    }
  } catch {
    // Nothing found
  }

  return null;
}

async function extractGenericWebMedia(rawUrl: string): Promise<GifItem | null> {
  // Try crawler headers first (works for Giphy/Tenor/Klipy/social meta tags), then browser headers
  for (const headers of [CRAWLER_HEADERS, BROWSER_HEADERS]) {
    try {
      const response = await fetch(rawUrl, {
        headers,
        redirect: 'follow',
        signal: AbortSignal.timeout(8000),
      });
      const contentType = (response.headers.get('content-type') || '').toLowerCase();
      if (contentType.startsWith('video/')) {
        return {
          id: `web-${Buffer.from(rawUrl).toString('base64url').slice(0, 16)}`,
          slug: 'extracted-gif',
          title: 'Extracted Video GIF',
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
          id: `web-${Buffer.from(rawUrl).toString('base64url').slice(0, 16)}`,
          slug: 'extracted-gif',
          title: 'Extracted GIF',
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
        extractMetaContent(html, 'twitter:player:stream') ||
        extractVideoTagSrc(html);

      const mp4Url = unescapeExtractedUrl(ogVideo);
      const ogImage =
        extractMetaContent(html, 'og:image:secure_url') ||
        extractMetaContent(html, 'og:image');

      if (mp4Url && isSafePublicHttpUrl(mp4Url)) {
        return {
          id: `web-${Buffer.from(rawUrl).toString('base64url').slice(0, 16)}`,
          slug: 'extracted-gif',
          title: (extractMetaContent(html, 'og:title') || 'Extracted GIF').slice(0, 80),
          url: rawUrl,
          webpUrl: unescapeExtractedUrl(ogImage),
          mp4Url,
          stillUrl: unescapeExtractedUrl(ogImage),
          width: 480,
          height: 360,
          tags: [],
        };
      }
    } catch {
      // Try next UA
    }
  }

  return null;
}

export async function extractMediaFromLink(rawInput: string): Promise<ExtractMediaResult> {
  const normalized = normalizeCandidateUrl(rawInput);
  if (!normalized || !isSafePublicHttpUrl(normalized)) {
    throw new ExtractMediaError(INVALID_OR_NOT_FOUND_MESSAGE, 400, 'INVALID_URL');
  }

  const directFirst = await probeDirectMediaResponse(normalized);
  if (directFirst) {
    return {
      item: directFirst,
      platform: detectSourcePlatform(normalized),
      sourceUrl: normalized,
    };
  }

  const resolvedUrl = await resolveShortLinkIfNeeded(normalized);
  const directResolved =
    resolvedUrl !== normalized ? await probeDirectMediaResponse(resolvedUrl) : null;
  if (directResolved) {
    return {
      item: directResolved,
      platform: detectSourcePlatform(resolvedUrl),
      sourceUrl: resolvedUrl,
    };
  }

  const platform = detectSourcePlatform(resolvedUrl);
  let item: GifItem | null = null;

  if (platform === 'tiktok') {
    item = await extractTikTokMedia(resolvedUrl, normalized);
  } else if (platform === 'instagram') {
    item = await extractInstagramMedia(resolvedUrl);
  } else if (platform === 'x') {
    item = await extractXMedia(resolvedUrl);
  } else {
    item = await extractGenericWebMedia(resolvedUrl);
  }

  if (!item || (!item.mp4Url && !item.webpUrl)) {
    throw new ExtractMediaError(INVALID_OR_NOT_FOUND_MESSAGE, 404, 'NOT_FOUND');
  }

  return {
    item,
    platform,
    sourceUrl: resolvedUrl,
  };
}
