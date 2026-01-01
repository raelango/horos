import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 8500,
    proxy: {
      "/auth": "http://localhost:7500",
      "/preferences": "http://localhost:7500",
      "/profile": "http://localhost:7500",
      "/guidance": "http://localhost:7500",
      "/ui": "http://localhost:7500"
    }
  }
});
