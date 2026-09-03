import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.claudecomms.voiceloop',
  appName: 'Claude Comms Voice Loop',
  webDir: 'dist',
  android: {
    keepRunning: false
  }
};

export default config;
