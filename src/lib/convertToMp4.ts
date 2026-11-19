import { execFile } from 'child_process';
import crypto from 'crypto';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { promisify } from 'util';
import { isSafePublicHttpUrl } from './klipy.ts';

const execFileAsync = promisify(execFile);

const mp4Cache = new Map<string, Promise<Buffer>>();
const MAX_CACHE_ENTRIES = 16;

export class Mp4ConvertError extends Error {
  status: number;
  code: string;

  constructor(message: string, status = 500, code = 'CONVERT_FAILED') {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function computeWebpFps(inputPath: string): Promise<number> {
  try {
    const { stdout } = await execFileAsync('identify', ['-format', '%T\n', inputPath], {
      timeout: 8000,
    });
    const delaysCs = stdout
      .trim()
      .split(/\s+/)
      .map((line) => Number(line))
      .filter((n) => Number.isFinite(n) && n > 0);

    if (delaysCs.length === 0) return 25;
    const avgCs = delaysCs.reduce((sum, n) => sum + n, 0) / delaysCs.length;
    const fps = Math.round(100 / Math.max(1, avgCs));
    return Math.max(8, Math.min(50, fps));
  } catch {
    return 25;
  }
}

const MAX_WHATSAPP_GIF_DURATION = 5.0;

async function probeMp4Metadata(
  inputPath: string
): Promise<{ duration: number; hasAudio: boolean; isBaselineYuv420p: boolean } | null> {
  try {
    const { stdout } = await execFileAsync(
      'ffprobe',
      [
        '-v',
        'error',
        '-show_entries',
        'format=duration',
        '-show_entries',
        'stream=codec_type,codec_name,profile,pix_fmt,has_b_frames',
        '-of',
        'json',
        inputPath,
      ],
      { timeout: 8000 }
    );
    const parsed = JSON.parse(stdout) as {
      format?: { duration?: string };
      streams?: Array<{
        codec_type?: string;
        codec_name?: string;
        profile?: string;
        pix_fmt?: string;
        has_b_frames?: number;
      }>;
    };
    const duration = Number(parsed.format?.duration ?? 0);
    const streams = parsed.streams ?? [];
    const hasAudio = streams.some((s) => s.codec_type === 'audio');
    const videoStream = streams.find((s) => s.codec_type === 'video');
    const isBaselineYuv420p =
      videoStream?.codec_name === 'h264' &&
      videoStream?.pix_fmt === 'yuv420p' &&
      (videoStream?.has_b_frames ?? 0) === 0 &&
      /baseline/i.test(videoStream?.profile || '');
    return { duration, hasAudio, isBaselineYuv420p };
  } catch {
    return null;
  }
}

async function runConversion(mediaUrl: string): Promise<Buffer> {
  if (!isSafePublicHttpUrl(mediaUrl)) {
    throw new Mp4ConvertError('Invalid media URL.', 400, 'INVALID_URL');
  }

  const fetchHeaders: Record<string, string> = {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  };
  if (/tiktok|ibyte|byte/i.test(mediaUrl)) {
    fetchHeaders.Referer = 'https://www.tiktok.com/';
  }

  const upstream = await fetch(mediaUrl, {
    headers: fetchHeaders,
    signal: AbortSignal.timeout(15000),
  });

  if (!upstream.ok) {
    throw new Mp4ConvertError('Could not fetch source GIF.', 502, 'UPSTREAM_ERROR');
  }

  const contentType = (upstream.headers.get('content-type') || '').toLowerCase();
  const inputBuffer = Buffer.from(await upstream.arrayBuffer());

  if (inputBuffer.length === 0) {
    throw new Mp4ConvertError('Source GIF was empty.', 502, 'EMPTY_UPSTREAM');
  }

  const workDir = path.join(os.tmpdir(), `giftap-mp4-${crypto.randomUUID()}`);
  await fs.mkdir(workDir, { recursive: true });

  try {
    const isMp4 = contentType.includes('video/mp4') || /\.mp4(\?|$)/i.test(mediaUrl);
    if (isMp4) {
      const inputPath = path.join(workDir, 'input.mp4');
      const outputPath = path.join(workDir, 'output.mp4');
      await fs.writeFile(inputPath, inputBuffer);

      const meta = await probeMp4Metadata(inputPath);
      if (meta && meta.duration > 0 && meta.duration <= MAX_WHATSAPP_GIF_DURATION && !meta.hasAudio && meta.isBaselineYuv420p) {
        return inputBuffer;
      }

      await execFileAsync(
        'ffmpeg',
        [
          '-y',
          '-i',
          inputPath,
          '-t',
          String(MAX_WHATSAPP_GIF_DURATION),
          '-movflags',
          '+faststart',
          '-pix_fmt',
          'yuv420p',
          '-vf',
          'scale=trunc(iw/2)*2:trunc(ih/2)*2',
          '-an',
          '-c:v',
          'libx264',
          '-profile:v',
          'baseline',
          '-level',
          '3.1',
          '-preset',
          'fast',
          '-crf',
          '23',
          outputPath,
        ],
        { timeout: 25000 }
      );
      return await fs.readFile(outputPath);
    }

    const isGif = contentType.includes('gif') || /\.gif(\?|$)/i.test(mediaUrl);
    const ext = isGif ? 'gif' : contentType.includes('png') ? 'png' : 'webp';
    const inputPath = path.join(workDir, `input.${ext}`);
    const outputPath = path.join(workDir, 'output.mp4');
    await fs.writeFile(inputPath, inputBuffer);

    if (isGif) {
      await execFileAsync(
        'ffmpeg',
        [
          '-y',
          '-i',
          inputPath,
          '-movflags',
          '+faststart',
          '-pix_fmt',
          'yuv420p',
          '-vf',
          'scale=trunc(iw/2)*2:trunc(ih/2)*2',
          '-an',
          '-c:v',
          'libx264',
          '-profile:v',
          'baseline',
          '-level',
          '3.1',
          '-preset',
          'fast',
          '-crf',
          '23',
          '-t',
          String(MAX_WHATSAPP_GIF_DURATION),
          outputPath,
        ],
        { timeout: 25000 }
      );
    } else {
      const framesDir = path.join(workDir, 'frames');
      await fs.mkdir(framesDir, { recursive: true });

      const fps = await computeWebpFps(inputPath);
      await execFileAsync(
        'convert',
        [
          inputPath,
          '-coalesce',
          '-background',
          'black',
          '-alpha',
          'remove',
          '-alpha',
          'off',
          path.join(framesDir, 'f_%04d.jpg'),
        ],
        { timeout: 25000 }
      );

      const frameFiles = (await fs.readdir(framesDir)).filter((f) => f.endsWith('.jpg'));
      if (frameFiles.length === 0) {
        throw new Mp4ConvertError('Could not decode animated frames.', 500, 'DECODE_FAILED');
      }

      const ffmpegArgs =
        frameFiles.length === 1
          ? [
              '-y',
              '-loop',
              '1',
              '-i',
              path.join(framesDir, frameFiles[0]),
              '-t',
              '2',
              '-movflags',
              '+faststart',
              '-pix_fmt',
              'yuv420p',
              '-vf',
              'scale=trunc(iw/2)*2:trunc(ih/2)*2',
              '-an',
              '-c:v',
              'libx264',
              '-profile:v',
              'baseline',
              '-level',
              '3.1',
              '-preset',
              'fast',
              '-crf',
              '24',
              outputPath,
            ]
          : [
              '-y',
              '-framerate',
              String(fps),
              '-i',
              path.join(framesDir, 'f_%04d.jpg'),
              '-movflags',
              '+faststart',
              '-pix_fmt',
              'yuv420p',
              '-vf',
              'scale=trunc(iw/2)*2:trunc(ih/2)*2',
              '-an',
              '-c:v',
              'libx264',
              '-profile:v',
              'baseline',
              '-level',
              '3.1',
              '-preset',
              'fast',
              '-crf',
              '24',
              '-t',
              String(MAX_WHATSAPP_GIF_DURATION),
              outputPath,
            ];

      await execFileAsync('ffmpeg', ffmpegArgs, { timeout: 25000 });
    }

    return await fs.readFile(outputPath);
  } catch (err) {
    if (err instanceof Mp4ConvertError) throw err;
    const nodeErr = err as NodeJS.ErrnoException;
    if (nodeErr?.code === 'ENOENT') {
      throw new Mp4ConvertError(
        'MP4 converter binary unavailable in this environment.',
        501,
        'CONVERTER_UNAVAILABLE'
      );
    }
    throw new Mp4ConvertError('Failed to convert animated GIF to MP4.', 500, 'CONVERT_FAILED');
  } finally {
    await fs.rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}

export function convertImageUrlToMp4(mediaUrl: string): Promise<Buffer> {
  const existing = mp4Cache.get(mediaUrl);
  if (existing) return existing;

  const promise = runConversion(mediaUrl).catch((err) => {
    mp4Cache.delete(mediaUrl);
    throw err;
  });

  if (mp4Cache.size >= MAX_CACHE_ENTRIES) {
    const oldest = mp4Cache.keys().next().value;
    if (oldest) mp4Cache.delete(oldest);
  }
  mp4Cache.set(mediaUrl, promise);

  return promise;
}

const gifCache = new Map<string, Promise<Buffer>>();

async function runGifConversion(mediaUrl: string): Promise<Buffer> {
  const mp4Buffer = await convertImageUrlToMp4(mediaUrl);
  const workDir = path.join(os.tmpdir(), `giftap-gif-${crypto.randomUUID()}`);
  await fs.mkdir(workDir, { recursive: true });

  try {
    const inputPath = path.join(workDir, 'input.mp4');
    const outputPath = path.join(workDir, 'output.gif');
    await fs.writeFile(inputPath, mp4Buffer);

    await execFileAsync(
      'ffmpeg',
      [
        '-y',
        '-i',
        inputPath,
        '-t',
        String(MAX_WHATSAPP_GIF_DURATION),
        '-vf',
        'fps=14,scale=320:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=128[p];[s1][p]paletteuse=dither=bayer:bayer_scale=3',
        '-loop',
        '0',
        outputPath,
      ],
      { timeout: 25000 }
    );
    return await fs.readFile(outputPath);
  } catch (err) {
    if (err instanceof Mp4ConvertError) throw err;
    const nodeErr = err as NodeJS.ErrnoException;
    if (nodeErr?.code === 'ENOENT') {
      throw new Mp4ConvertError(
        'GIF converter binary unavailable in this environment.',
        501,
        'CONVERTER_UNAVAILABLE'
      );
    }
    throw new Mp4ConvertError('Failed to convert media to .gif.', 500, 'CONVERT_FAILED');
  } finally {
    await fs.rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}

export function convertMediaUrlToGif(mediaUrl: string): Promise<Buffer> {
  const existing = gifCache.get(mediaUrl);
  if (existing) return existing;

  const promise = runGifConversion(mediaUrl).catch((err) => {
    gifCache.delete(mediaUrl);
    throw err;
  });

  if (gifCache.size >= MAX_CACHE_ENTRIES) {
    const oldest = gifCache.keys().next().value;
    if (oldest) gifCache.delete(oldest);
  }
  gifCache.set(mediaUrl, promise);

  return promise;
}
