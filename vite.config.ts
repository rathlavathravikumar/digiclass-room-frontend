import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    proxy: {
      '/api': {
        target: 'http://digiclassroomserver-env.eba-hsh37kmu.ap-south-1.elasticbeanstalk.com/',
        changeOrigin: true,
        secure: false,
      },
      '/healthcheck': {
        target: 'http://digiclassroomserver-env.eba-hsh37kmu.ap-south-1.elasticbeanstalk.com/healthcheck',
        changeOrigin: true,
        secure: false,
      },
      '/upload': {
        target: 'http://digiclassroomserver-env.eba-hsh37kmu.ap-south-1.elasticbeanstalk.com/upload',
        changeOrigin: true,
        secure: false,
      }
    }
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
