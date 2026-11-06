import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.compracerta.online",
  appName: "Compra Certa Online",
  webDir: "www",
  server: {
    url: "https://compra-certa-online-inky.vercel.app",
    cleartext: false
  },
  android: {
    allowMixedContent: false
  }
};

export default config;
