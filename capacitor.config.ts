import type { CapacitorConfig } from '@capacitor/cli';

const serverUrl = process.env.CAPACITOR_SERVER_URL?.trim();

const config: CapacitorConfig = {
  appId: 'app.giftap.mobile',
  appName: 'GifTap',
  webDir: 'dist',
  backgroundColor: '#000000',
  server: serverUrl
    ? {
        url: serverUrl,
        cleartext: serverUrl.startsWith('http://'),
        androidScheme: 'https',
      }
    : {
        androidScheme: 'https',
      },
  android: {
    backgroundColor: '#000000',
    allowMixedContent: false,
  },
};

export default config;
