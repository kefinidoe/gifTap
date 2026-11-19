import 'dotenv/config';
import express, { type Request, type Response } from 'express';
import fs from 'fs';
import http from 'http';
import path from 'path';
import { Readable } from 'stream';
import { fileURLToPath } from 'url';
import {
  convertImageUrlToMp4,
  convertMediaUrlToGif,
  Mp4ConvertError,
} from './src/lib/convertToMp4.ts';
import {
  ExtractMediaError,
  extractMediaFromLink,
} from './src/lib/extractMedia.ts';
import {
  getKlipyCategories,
  getTrendingGifs,
  isSafePublicHttpUrl,
  KlipyConfigError,
  KlipyUpstreamError,
  resolveSharedMedia,
  searchGifs,
} from './src/lib/klipy.ts';
import { createZipBuffer } from './src/lib/zip.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function createApp() {
  const app = express();
  app.use(express.json());

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ ok: true });
  });

  app.get('/api/gifs/trending', async (req: Request, res: Response) => {
    try {
      const page = Number(req.query.page ?? 1) || 1;
      const perPage = Number(req.query.per_page ?? 24) || 24;
      const data = await getTrendingGifs(page, perPage);
      res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120');
      res.json(data);
    } catch (err) {
      if (err instanceof KlipyConfigError) {
        res.status(err.status).json({ error: err.message, code: err.code });
        return;
      }
      if (err instanceof KlipyUpstreamError) {
        res.status(err.status).json({ error: err.message, code: 'KLIPY_ERROR' });
        return;
      }
      res.status(500).json({ error: 'Unexpected error loading trending GIFs.' });
    }
  });

  app.get('/api/gifs/search', async (req: Request, res: Response) => {
    try {
      const q = String(req.query.q ?? '');
      const page = Number(req.query.page ?? 1) || 1;
      const perPage = Number(req.query.per_page ?? 24) || 24;
      const data = await searchGifs(q, page, perPage);
      res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120');
      res.json(data);
    } catch (err) {
      if (err instanceof KlipyConfigError) {
        res.status(err.status).json({ error: err.message, code: err.code });
        return;
      }
      if (err instanceof KlipyUpstreamError) {
        res.status(err.status).json({ error: err.message, code: 'KLIPY_ERROR' });
        return;
      }
      res.status(500).json({ error: 'Unexpected error searching GIFs.' });
    }
  });

  app.get('/api/gifs/categories', async (_req: Request, res: Response) => {
    try {
      const categories = await getKlipyCategories();
      res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
      res.json({ categories });
    } catch (err) {
      if (err instanceof KlipyConfigError) {
        res.status(err.status).json({ error: err.message, code: err.code });
        return;
      }
      if (err instanceof KlipyUpstreamError) {
        res.status(err.status).json({ error: err.message, code: 'KLIPY_ERROR' });
        return;
      }
      res.status(500).json({ error: 'Unexpected error loading categories.' });
    }
  });

  app.get('/api/extract', async (req: Request, res: Response) => {
    try {
      const targetUrl = String(req.query.url ?? '').trim();
      if (!targetUrl) {
        res.status(400).json({
          error: 'Could not find GIF. Make sure link is public and is a video/GIF comment.',
          code: 'INVALID_URL',
        });
        return;
      }
      const result = await extractMediaFromLink(targetUrl);
      res.json(result);
    } catch (err) {
      if (err instanceof ExtractMediaError) {
        res.status(err.status).json({ error: err.message, code: err.code });
        return;
      }
      res.status(500).json({
        error: 'Could not find GIF. Make sure link is public and is a video/GIF comment.',
        code: 'NOT_FOUND',
      });
    }
  });

  app.get('/api/gifs/resolve', async (req: Request, res: Response) => {
    try {
      const targetUrl = String(req.query.url ?? '').trim();
      if (!targetUrl) {
        res.status(400).json({ error: 'Missing url parameter.' });
        return;
      }
      const item = await resolveSharedMedia(targetUrl);
      res.json({ item });
    } catch (err) {
      if (err instanceof KlipyUpstreamError) {
        res.status(err.status).json({ error: err.message });
        return;
      }
      res.status(500).json({ error: 'Failed to resolve shared URL.' });
    }
  });

  app.get('/api/gifs/download', async (req: Request, res: Response) => {
    try {
      const mediaUrl = String(req.query.url ?? '').trim();
      const rawName = String(req.query.filename ?? 'giftap-clip')
        .replace(/[^a-zA-Z0-9_-]/g, '-')
        .slice(0, 48);

      if (!mediaUrl || !isSafePublicHttpUrl(mediaUrl)) {
        res.status(400).json({ error: 'Invalid media URL.' });
        return;
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

      if (!upstream.ok || !upstream.body) {
        res.status(502).json({ error: 'Could not download media from source.' });
        return;
      }

      const contentType = upstream.headers.get('content-type') || 'application/octet-stream';
      let ext = 'webp';
      if (contentType.includes('mp4')) ext = 'mp4';
      else if (contentType.includes('webm')) ext = 'webm';
      else if (contentType.includes('gif')) ext = 'gif';
      else if (contentType.includes('png')) ext = 'png';
      else if (contentType.includes('jpeg') || contentType.includes('jpg')) ext = 'jpg';

      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${rawName || 'giftap'}.${ext}"`);
      Readable.fromWeb(upstream.body as Parameters<typeof Readable.fromWeb>[0]).pipe(res);
    } catch {
      res.status(500).json({ error: 'Download proxy failed.' });
    }
  });

  app.get('/api/gifs/mp4', async (req: Request, res: Response) => {
    try {
      const mediaUrl = String(req.query.url ?? '').trim();
      if (!mediaUrl || !isSafePublicHttpUrl(mediaUrl)) {
        res.status(400).json({ error: 'Invalid media URL.' });
        return;
      }
      const mp4Buffer = await convertImageUrlToMp4(mediaUrl);
      res.setHeader('Content-Type', 'video/mp4');
      res.setHeader('Content-Disposition', 'inline; filename="giftap.mp4"');
      res.setHeader('Cache-Control', 'public, max-age=3600');
      res.send(mp4Buffer);
    } catch (err) {
      if (err instanceof Mp4ConvertError) {
        res.status(err.status).json({ error: err.message, code: err.code });
        return;
      }
      res.status(500).json({ error: 'MP4 conversion failed.' });
    }
  });

  app.get('/api/gifs/gif', async (req: Request, res: Response) => {
    try {
      const mediaUrl = String(req.query.url ?? '').trim();
      if (!mediaUrl || !isSafePublicHttpUrl(mediaUrl)) {
        res.status(400).json({ error: 'Invalid media URL.' });
        return;
      }
      const gifBuffer = await convertMediaUrlToGif(mediaUrl);
      res.setHeader('Content-Type', 'image/gif');
      res.setHeader('Content-Disposition', 'attachment; filename="giftap.gif"');
      res.setHeader('Cache-Control', 'public, max-age=3600');
      res.send(gifBuffer);
    } catch (err) {
      if (err instanceof Mp4ConvertError) {
        res.status(err.status).json({ error: err.message, code: err.code });
        return;
      }
      res.status(500).json({ error: 'GIF conversion failed.' });
    }
  });

  app.get('/api/extension.zip', (req: Request, res: Response) => {
    try {
      const extDir = path.resolve(__dirname, 'extension');
      if (!fs.existsSync(extDir)) {
        res.status(404).json({ error: 'Extension bundle not found.' });
        return;
      }

      const proto = (req.headers['x-forwarded-proto'] as string) || req.protocol || 'https';
      const host = req.get('host') || 'localhost:3000';
      const origin = `${proto}://${host}`;

      const files = ['manifest.json', 'background.js', 'content.js', 'popup.html', 'popup.js', 'icon-48.png', 'icon-128.png'];
      const entries = files
        .filter((file) => fs.existsSync(path.join(extDir, file)))
        .map((file) => {
          const fullPath = path.join(extDir, file);
          let data = fs.readFileSync(fullPath);
          if (file === 'background.js' || file === 'popup.js') {
            data = Buffer.from(data.toString('utf8').replace(/__GIFTAP_URL__/g, origin), 'utf8');
          }
          return { name: `giftap-x-extension/${file}`, data };
        });

      const zipBuf = createZipBuffer(entries);
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', 'attachment; filename="giftap-x-extension.zip"');
      res.send(zipBuf);
    } catch {
      res.status(500).json({ error: 'Failed to package extension.' });
    }
  });

  // Public CORS-enabled Developer API (/api/v1/*)
  app.use('/api/v1', (req: Request, res: Response, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }
    next();
  });

  app.get('/api/v1/trending', async (req: Request, res: Response) => {
    try {
      const page = Number(req.query.page ?? 1) || 1;
      const perPage = Number(req.query.per_page ?? 24) || 24;
      const data = await getTrendingGifs(page, perPage);
      res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120');
      res.json({
        data: data.items,
        pagination: { page: data.page, per_page: perPage, has_more: data.hasMore },
      });
    } catch (err) {
      if (err instanceof KlipyConfigError) {
        res.status(err.status).json({ error: err.message, code: err.code });
        return;
      }
      if (err instanceof KlipyUpstreamError) {
        res.status(err.status).json({ error: err.message, code: 'KLIPY_ERROR' });
        return;
      }
      res.status(500).json({ error: 'Unexpected error loading trending GIFs.' });
    }
  });

  app.get('/api/v1/search', async (req: Request, res: Response) => {
    try {
      const q = String(req.query.q ?? '');
      const page = Number(req.query.page ?? 1) || 1;
      const perPage = Number(req.query.per_page ?? 24) || 24;
      const data = await searchGifs(q, page, perPage);
      res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120');
      res.json({
        query: q,
        data: data.items,
        pagination: { page: data.page, per_page: perPage, has_more: data.hasMore },
      });
    } catch (err) {
      if (err instanceof KlipyConfigError) {
        res.status(err.status).json({ error: err.message, code: err.code });
        return;
      }
      if (err instanceof KlipyUpstreamError) {
        res.status(err.status).json({ error: err.message, code: 'KLIPY_ERROR' });
        return;
      }
      res.status(500).json({ error: 'Unexpected error searching GIFs.' });
    }
  });

  app.get('/api/v1/categories', async (_req: Request, res: Response) => {
    try {
      const categories = await getKlipyCategories();
      res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
      res.json({ data: categories });
    } catch (err) {
      if (err instanceof KlipyConfigError) {
        res.status(err.status).json({ error: err.message, code: err.code });
        return;
      }
      if (err instanceof KlipyUpstreamError) {
        res.status(err.status).json({ error: err.message, code: 'KLIPY_ERROR' });
        return;
      }
      res.status(500).json({ error: 'Unexpected error loading categories.' });
    }
  });

  app.get('/api/v1/resolve', async (req: Request, res: Response) => {
    try {
      const targetUrl = String(req.query.url ?? '').trim();
      if (!targetUrl) {
        res.status(400).json({ error: 'Missing url parameter.' });
        return;
      }
      const item = await resolveSharedMedia(targetUrl);
      res.json({ data: item });
    } catch (err) {
      if (err instanceof KlipyUpstreamError) {
        res.status(err.status).json({ error: err.message });
        return;
      }
      res.status(500).json({ error: 'Failed to resolve shared URL.' });
    }
  });

  return app;
}

async function startServer() {
  const app = createApp();
  const httpServer = http.createServer(app);
  const port = Number(process.env.PORT ?? 3000);
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
        ws: false,
      },
      appType: 'spa',
    });

    app.get('/@vite/client', async (_req: Request, res: Response, next) => {
      try {
        const result = await vite.transformRequest('/@vite/client');
        if (!result) {
          next();
          return;
        }
        const patched = result.code.replace(
          /let wsTransport = createWebSocketModuleRunnerTransport\(\{[\s\S]*?\}\);/,
          'const wsTransport = { async connect() {}, async disconnect() {}, send() {} };'
        );
        res.setHeader('Content-Type', 'application/javascript');
        res.send(patched);
      } catch (err) {
        next(err);
      }
    });

    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    if (fs.existsSync(distDir)) {
      app.use(express.static(distDir));
      app.get('*', (_req: Request, res: Response) => {
        res.sendFile(path.join(distDir, 'index.html'));
      });
    }
  }

  httpServer.listen(port, '0.0.0.0', () => {
    console.log(`GifTap server listening on http://localhost:${port}`);
  });
}

if (!process.env.VERCEL) {
  startServer();
}
