import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.tahafirat.zihinharitam',
  appName: 'ZihinHaritam',
  webDir: 'dist',
  ios: {
    contentInset: 'never',
    backgroundColor: '#FAF9F5',
    allowsLinkPreview: false,
    scrollEnabled: false,
    preferredContentMode: 'mobile',
  },
  android: {
    backgroundColor: '#FAF9F5',
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false,
  },
  plugins: {
    Keyboard: {
      resize: 'none',
      resizeOnFullScreen: false,
    },
    StatusBar: {
      overlaysWebView: true,
      style: 'DEFAULT',
    },
  },
};

export default config;
