import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.orbis.carteira",
  appName: "Carteira Orbis",
  webDir: "dist-mobile",
  android: {
    allowMixedContent: false,
    backgroundColor: "#071322",
  },
  plugins: {
    CapacitorHttp: {
      enabled: true,
    },
  },
};

export default config;
