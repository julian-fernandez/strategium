import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { SERVER_PORT } from "./shared/config.ts";

export default defineConfig({
  root: "web",
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: { "/api": `http://localhost:${SERVER_PORT}` },
  },
  build: { outDir: "../dist", emptyOutDir: true },
});
