# 架构说明 / Architecture

## 项目快照

Snow Cues 是一个 Vite + React 19 + TypeScript 的纯前端应用。应用入口为 `src/main.tsx`，通过 React 19 `createRoot` 和 `StrictMode` 渲染 `src/App.tsx`。`src/App.tsx` 只装配 `src/ui/useAppController.ts` 与 `src/ui/AppView.tsx`。

构建配置：

- `vite.config.ts` 使用 `@vitejs/plugin-react`，`base` 为 `"./"`，适配 Cloudflare Pages 和其他静态托管的非根路径部署。
- TypeScript 使用项目引用：`tsconfig.json`、`tsconfig.app.json`、`tsconfig.node.json`。
- Vitest 使用 jsdom，通过 `src/test/setup.ts` 注入 `fake-indexeddb/auto`、`node:crypto` 的 `webcrypto`，并补充 `btoa` / `atob`。

## 运行环境与分发

- 正式推荐分发环境是 Cloudflare Pages。Cloudflare Pages 只提供 HTTPS 静态前端代码分发，不保存用户业务数据，不引入账号系统、后端同步或云端服务。
- Snow Cues 仍是本地优先应用：`storageData` 由用户显式维护，密钥只存在浏览器内存，业务数据不上传到 Cloudflare。
- 移动端推荐通过 Cloudflare Pages HTTPS 地址或由该地址安装的 PWA 使用。不要把普通局域网 HTTP（例如 `http://192.168.x.x`）作为移动端可靠运行环境；移动端 Chrome 和 App 内置浏览器可能因非安全上下文不暴露 `crypto.subtle`。
- 直接打开打包后的 `file://` HTML、移动端文件管理器预览和微信/QQ 等内置浏览器只作为不保证可用的临时方式。后续功能设计不得依赖这些环境完整支持 WebCrypto、ES module 或 File System Access API。
- 本地开发和调试优先使用 `localhost` 或 `127.0.0.1`，它们通常被浏览器视为受信任本机来源。

## 模块边界

- `src/session-manager/`：负责 `master_password` 到 WebCrypto key 的生命周期、空闲/绝对超时和 wipe。
- `src/rule-registry/`：负责静态 pure function registry。禁止 `eval`、`new Function`、动态脚本注入和运行时用户 JS。
- `src/crypto-engine/`：负责规则执行、输出编码、AES-GCM 加解密。`encoding.ts` 提供 base62/base64/custom charset 编码和模运算字节映射。
- `src/recovery-aid/`：负责关键密钥记忆提示的专用加密与解密。提示 key 由 session `cryptoKey`、`spaceId`、`entryId` 和固定 purpose 派生，不依赖 `entrySecret`，不复用条目密码加密 key。
- `src/storage-data/`：负责 2.1 存储数据文件格式、正式/草稿区分、schema 校验、字段清理、字段白名单、存储类型、canonical JSON、`sha256:<hex>` contentHash、安全摘要 diff、内存 repository、File System Access API 封装、下载保存包、显式保存和只读比较。业务数据不再经过额外兼容层。
- `src/space/`：负责空间 policy、诊断、克隆、导入导出和迁移编排。迁移服务集中处理双空间 session、旧密文解密、新空间加密和迁移完成后的关系/状态流转。
- `src/lib/bytes.ts`：纯函数工具模块，提供 `utf8ToBytes`、`bytesToUtf8`、`bytesToBase64`、`base64ToBytes`、`concatBytes`，被 crypto-engine 和 session-manager 共用。
- `src/lib/random-id.ts`：提供业务 ID 生成。优先使用 `crypto.randomUUID()`；缺失时只允许退回到基于 `crypto.getRandomValues()` 的 UUID v4 生成，不得使用 `Math.random()` 生成业务 ID。
- `src/lib/browser-capabilities.ts`：集中检测运行环境能力，包括安全上下文、WebCrypto 核心能力和 File System Access API。UI 层应消费该模块结果，不要在组件或业务 hook 中散落重复检测文案。
- 下载模式会生成 zip 保存包。桌面环境保存包包含 `src/storage-data/save-package-templates/` 下固定、开源可审计的三平台脚本模板；移动端或类移动端保存包不包含脚本，只包含数据文件、manifest、路径占位文件和 README。
- `storageData` 相关文件名由 `src/storage-data/storage-data-file-names.ts` 统一生成。正式历史文件使用 `storage-data-rev-000003.json`，下载候选 current 使用包含基线 revision 和短 hash 的 `storage-data-current-o000002-hxxxxxxxx-n000003.json`。

## UI 分层

应用外壳是三栏后台布局：左侧菜单区、中间页面主内容、右侧全局用户操作指引。所有样式由 `src/styles.css` 手写提供，未引入 UI 组件库。

- `src/ui/useAppController.ts`：顶层组合 hook，汇总空间、规则、条目和页面动作；不要重新堆回大组件式逻辑。
- `src/ui/hooks/useSpaceAccessController.ts`：进入/离开空间、空间检测、刷新条目、会话存活检查和 `withLiveSession`。
- `src/ui/hooks/useRuleProfileController.ts`：规则链草稿、导入规则、profile 恢复和规则链初始化。
- `src/ui/hooks/usePasswordEntryController.ts`：新建密码、解密、记忆提示、条目编辑和废弃。
- `src/ui/hooks/useSpaceIndexController.ts`：空间外本地空间索引、空间外创建空间和创建后进入空间主页。
- `src/ui/hooks/useDetachedPasswordController.ts`：空间外游离密码表单、临时预览、复制状态和待迁入派生密钥内存状态；不得读写 `storageData` 或迁移队列。
- `src/ui/hooks/useSpaceManagementController.ts`：空间主页中的当前空间操作、导入导出、迁移批次、来源空间内存 session 和单条迁移。
- `src/ui/hooks/useWorkspaceActions.ts`：全局测试数据工具、当前空间测试清理和新建密码入口跳转。
- `src/ui/hooks/useCreatePasswordForm.ts`、`useEntryRuntimeState.ts`：只保存局部 UI 状态；不得把这些状态持久化。
- `src/ui/entryCapabilities.ts`：聚合条目级 UI 能力和禁用原因。组件应优先消费聚合结果，不要在展示层分散拼接底层 policy。
- `src/ui/guidance.ts`：根据顶层 controller 状态生成右侧全局用户操作指引多卡片队列；只做状态推导，不持久化用户进度。
- `src/ui/pages/`：hash 路由页面入口，例如空间主页、规则管理、输出适配、密码管理和游离密码页面。
- `src/ui/components/`：三栏工作台、全局操作指引、空间主页卡片、密码管理、规则管理、条目卡片等展示组件。组件应尽量只渲染 props 和派发事件。

## 数据流原则

- 业务数据源是用户显式打开的 `storageData`，不是 IndexedDB。
- 空间 profile 按 `spaceId` 保存空间级规则链配置，不属于单条密码。
- 密码组是空间内明文管理元数据，只影响 UI 归属和解密后的输出适配。
- 迁移批次和迁移条目与正式 `PasswordEntry` 分离，迁移成功后才创建新的正式密码条目。
- UI 组件不要重新引入 WebCrypto、IndexedDB 或规则注册表等底层模块；需要业务能力时通过 hook 暴露的 handler 传入。
