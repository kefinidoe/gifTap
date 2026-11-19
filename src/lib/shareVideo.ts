import type { GifItem } from '../types/gif';

const filePromiseCache = new Map<string, Promise<File>>();
const MAX_CACHE_ENTRIES = 12;

export function getPreferredMp4Url(gif: GifItem): string {
  return gif.mp4Url || gif.webpUrl || gif.url || '';
}

async function fetchBlobWithCorsFallback(mediaUrl: string): Promise<Blob> {
  try {
    const directRes = await fetch(mediaUrl);
    if (directRes.ok) {
      return await directRes.blob();
    }
  } catch {
    // Fall through to same-origin proxy when CDN blocks CORS
  }

  const proxyUrl = `/api/gifs/download?url=${encodeURIComponent(mediaUrl)}&filename=giftap`;
  const proxyRes = await fetch(proxyUrl);
  if (!proxyRes.ok) {
    throw new Error('Could not fetch GIF video file.');
  }
  return await proxyRes.blob();
}

async function fetchConvertedMp4Blob(imageUrl: string): Promise<Blob | null> {
  try {
    const res = await fetch(`/api/gifs/mp4?url=${encodeURIComponent(imageUrl)}`);
    if (!res.ok) return null;
    const blob = await res.blob();
    return blob.size > 0 ? blob : null;
  } catch {
    return null;
  }
}

export function getMp4FilePromise(gif: GifItem): Promise<File> {
  const mediaUrl = getPreferredMp4Url(gif);
  if (!mediaUrl) {
    return Promise.reject(new Error('No video URL available for this GIF.'));
  }

  const cacheKey = `v2:${mediaUrl}`;
  const cached = filePromiseCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const promise = (async () => {
    const normalized = await fetchConvertedMp4Blob(mediaUrl);
    if (normalized) {
      const mp4Blob =
        normalized.type === 'video/mp4'
          ? normalized
          : new Blob([normalized], { type: 'video/mp4' });
      return new File([mp4Blob], 'giftap.mp4', { type: 'video/mp4' });
    }

    const rawBlob = await fetchBlobWithCorsFallback(mediaUrl);
    if (rawBlob.type.startsWith('image/')) {
      const ext = rawBlob.type.includes('gif')
        ? 'gif'
        : rawBlob.type.includes('png')
          ? 'png'
          : 'webp';
      return new File([rawBlob], `giftap.${ext}`, { type: rawBlob.type || 'image/webp' });
    }

    const mp4Blob =
      rawBlob.type === 'video/mp4' ? rawBlob : new Blob([rawBlob], { type: 'video/mp4' });
    return new File([mp4Blob], 'giftap.mp4', { type: 'video/mp4' });
  })().catch((err) => {
    filePromiseCache.delete(cacheKey);
    throw err;
  });

  if (filePromiseCache.size >= MAX_CACHE_ENTRIES) {
    const oldestKey = filePromiseCache.keys().next().value;
    if (oldestKey) {
      filePromiseCache.delete(oldestKey);
    }
  }
  filePromiseCache.set(cacheKey, promise);

  return promise;
}

export async function getGifFilePromise(gif: GifItem): Promise<File> {
  const mediaUrl = getPreferredMp4Url(gif);
  if (!mediaUrl) {
    throw new Error('No media URL available for this GIF.');
  }

  const res = await fetch(`/api/gifs/gif?url=${encodeURIComponent(mediaUrl)}`);
  if (!res.ok) {
    throw new Error('Could not generate .gif file.');
  }
  const blob = await res.blob();
  if (blob.size === 0) {
    throw new Error('Generated .gif file was empty.');
  }
  const gifBlob = blob.type === 'image/gif' ? blob : new Blob([blob], { type: 'image/gif' });
  return new File([gifBlob], 'giftap.gif', { type: 'image/gif' });
}

export function prefetchMp4File(gif: GifItem): void {
  if (typeof window === 'undefined') return;
  const mediaUrl = getPreferredMp4Url(gif);
  if (!mediaUrl) return;
  getMp4FilePromise(gif).catch(() => {
    // Silent prefetch failure; interactive tap will retry cleanly
  });
}

export function getBlobVideoDurationSeconds(blob: Blob): Promise<number | null> {
  if (typeof document === 'undefined' || typeof URL === 'undefined') {
    return Promise.resolve(null);
  }
  if (!blob.type.startsWith('video/')) {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    const objectUrl = URL.createObjectURL(blob);
    const video = document.createElement('video');
    let settled = false;

    const finish = (duration: number | null) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      video.removeAttribute('src');
      video.load();
      URL.revokeObjectURL(objectUrl);
      resolve(duration);
    };

    const timer = window.setTimeout(() => finish(null), 2000);
    video.preload = 'metadata';
    video.muted = true;
    video.onloadedmetadata = () => {
      const d = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : null;
      finish(d);
    };
    video.onerror = () => finish(null);
    video.src = objectUrl;
  });
}

export function downloadVideoFile(file: File, filenameOverride?: string): void {
  const objectUrl = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = filenameOverride || file.name || 'giftap.mp4';
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1500);
}
