import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// Snow Cues 主色 terracotta orange 的近似十六进制 (hsl(15,65%,52%))。
const THEME_COLOR = "#d25636";
const BACKGROUND_COLOR = "#f3ece1";

export default defineConfig({
  base: "./",
  plugins: [
    react(),
    VitePWA({
      // 仅生成 SW，不自动注入注册脚本，改为在 src/ui/hooks/usePwaUpdate.ts 手动注册，
      // 便于精确控制生命周期和在测试环境安全降级。
      injectRegister: false,
      // prompt 模式：新版 SW 在后台安装，但只有用户点击“刷新”才激活，
      // 绝不打断进行中的解密 / 编辑会话。
      registerType: "prompt",
      strategies: "generateSW",
      // 开发期默认不启用 SW，避免污染本地开发体验。
      devOptions: { enabled: false },
      manifest: {
        name: "Snow Cues",
        short_name: "Snow Cues",
        description: "Snow Cues 安全本地优先密码系统",
        lang: "zh-CN",
        start_url: "./",
        scope: "./",
        display: "standalone",
        background_color: BACKGROUND_COLOR,
        theme_color: THEME_COLOR,
        categories: ["productivity", "utilities"],
        icons: [
          {
            src: "./icons/icon-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any"
          },
          {
            src: "./icons/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any"
          },
          {
            src: "./icons/icon-maskable-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "maskable"
          },
          {
            src: "./icons/icon-maskable-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable"
          }
        ]
      },
      workbox: {
        // 离线可打开应用外壳：SPA 导航回退到 index.html。
        navigateFallback: "index.html",
        navigateFallbackDenylist: [/^\/api\//],
        // 只缓存静态应用外壳资源。用户的 storageData 经由 File System Access API
        // 按需读写，从不经过 SW 的 Cache API。
        globPatterns: ["**/*.{js,css,html,woff,woff2,png,svg,ico,json}"],
        globIgnores: ["**/manifest.webmanifest"],
        cleanupOutdatedCaches: true
      }
    })
  ]
});
