import { defineConfig } from "vitest/config";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      // vite-plugin-pwa 的虚拟模块只在 Vite 生产构建时由插件注入；
      // Vitest 无法解析，映射到空 mock 让 usePwaUpdate 安全降级。
      "virtual:pwa-register": resolve(
        __dirname,
        "src/__mocks__/virtual-pwa-register.js"
      )
    }
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    fileParallelism: false,
    globals: true
  }
});
