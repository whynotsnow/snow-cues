// 生成 Snow Cues PWA 占位图标。
// 普通图标：terracotta 底圆角矩形 + 白色 SC 字母。
// maskable 图标：底色填满整个画布（无圆角），SC 字母缩小到安全区内，
//                以适配 Android 自适应图标的裁剪。
//
// 运行：npm run generate-icons
// 生成的 PNG 视为源资产提交到仓库，不是 dist 构建产物。

import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ICONS_DIR = resolve(__dirname, "../public/icons");

// 原始 SVG viewBox 为 512x512，SC 字母字号 260。
const BASE_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <rect width="512" height="512" rx="96" ry="96" fill="#d25636" />
  <text
    x="50%" y="50%"
    text-anchor="middle"
    dominant-baseline="central"
    font-family="'Inter','SF Pro Display',-apple-system,BlinkMacSystemFont,'PingFang SC','Microsoft YaHei',sans-serif"
    font-size="260" font-weight="700" letter-spacing="-12" fill="#ffffff"
  >SC</text>
</svg>
`.trim();

// maskable 版：底色充满画布，SC 缩到安全区内（约占 60% 区域）。
// Android maskable 安全区约为画布中心 66% 半径，字号 180 保证不被裁掉。
const MASKABLE_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <rect width="512" height="512" fill="#d25636" />
  <text
    x="50%" y="50%"
    text-anchor="middle"
    dominant-baseline="central"
    font-family="'Inter','SF Pro Display',-apple-system,BlinkMacSystemFont,'PingFang SC','Microsoft YaHei',sans-serif"
    font-size="180" font-weight="700" letter-spacing="-8" fill="#ffffff"
  >SC</text>
</svg>
`.trim();

const outputs = [
  { svg: BASE_SVG, size: 192, name: "icon-192.png" },
  { svg: BASE_SVG, size: 512, name: "icon-512.png" },
  { svg: MASKABLE_SVG, size: 192, name: "icon-maskable-192.png" },
  { svg: MASKABLE_SVG, size: 512, name: "icon-maskable-512.png" },
  { svg: BASE_SVG, size: 180, name: "apple-touch-icon.png" },
  { svg: BASE_SVG, size: 32, name: "favicon-32.png" },
  { svg: BASE_SVG, size: 16, name: "favicon-16.png" }
];

async function main() {
  await mkdir(ICONS_DIR, { recursive: true });

  for (const { svg, size, name } of outputs) {
    const dest = resolve(ICONS_DIR, name);
    await sharp(Buffer.from(svg)).resize(size, size).png().toFile(dest);
    // eslint-disable-next-line no-console
    console.log(`generated ${name} (${size}x${size})`);
  }
  // eslint-disable-next-line no-console
  console.log("完成：所有 PWA 图标已生成到 public/icons/");
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error("图标生成失败：", error);
  process.exit(1);
});
