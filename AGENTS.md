# Snow Cues v2.3 Agent 入口

## 项目定位

Snow Cues 是一个纯前端、本地优先的密码派生与加密存储系统。正式推荐通过 Cloudflare Pages 分发静态构建产物，以 HTTPS 安全上下文解决移动端 WebCrypto 可用性问题。Cloudflare Pages 只用于分发前端代码，不承载用户业务数据、账号系统或后端同步。

v2.3 版本以用户显式维护的 `storageData` 文件夹作为唯一业务数据源。UI 采用 Swiss Modernism × Minimalism 冰川蓝方向，项目级设计规范以 `design/Design.md` 为准，样式实现以 `src/styles.css` 的 design tokens 为准，内部基础组件维护以 `src/ui/design-system/README.md` 为准。Syncthing、Git 同步和冲突自动合并不属于应用逻辑。不要在应用内实现本地目录监听、自动同步、自动合并、后端同步、账号系统或云端服务。

本地开发可使用 `localhost` / `127.0.0.1`。不要把普通局域网 HTTP（例如 `http://192.168.x.x`）、移动端 App 内置浏览器或直接打开打包 HTML 文件视为可靠运行环境；这些环境可能不提供 `crypto.subtle`、File System Access API 或完整模块加载能力。

## Context Loading Rules / 上下文读取规则

默认只读取本文件。根据任务范围按需读取下列文档，避免一次性吞入全部项目上下文。

- 涉及架构、模块边界、目录结构或数据流时，读取 `docs/architecture.md`。
- 涉及用户可见行为、空间流程、密码流程、迁移流程或 UI 状态时，读取 `docs/product-rules.md`。
- 涉及编码风格、React/TypeScript 拆分、测试归属、重构边界时，读取 `docs/coding-rules.md`。
- 涉及密码、加密、session、`storageData`、IndexedDB、隐私字段或安全红线时，读取 `docs/security-boundaries.md`。
- 需要给 Codex 派发后续任务时，可参考 `docs/ai-task-template.md`。
- 涉及 UI 设计、页面布局、组件外观、颜色、字体、间距、圆角、阴影、主题或安全文案呈现时，读取 `design/Design.md`。涉及具体 token 或样式实现时，再读取 `src/styles.css`。涉及内部基础组件复用、扩展或迁移时，再读取 `src/ui/design-system/README.md`。
- 大范围任务、需求不清或跨越多个领域时，组合读取相关 docs。

## 技术栈与命令

技术栈是 Vite + React 19 + TypeScript。测试使用 Vitest、Testing Library、jsdom 和 `fake-indexeddb`。项目没有后端代码，也没有 UI 组件库。

常用脚本：

- `npm run typecheck`：执行 `tsc -b --pretty false`。
- `npm run test`：执行 `vitest run`。
- `npm run build`：先执行 `tsc -b`，再执行 `vite build`。
- `npm run validate`：依次执行 typecheck、lint、format:check、test 和 build。

修改文件后不需要启动本地预览项目或浏览器预览验证；用户会亲自做这一步。可以运行类型检查、测试和构建，但不要为了视觉检查启动 `npm run dev` 或 `npm run preview`。

## 必须遵守的安全摘要

- 不持久化 `master_password`。
- 不持久化 `entrySecret`、`runtime_salt` 或任何可重建派生输入的结构化字段。
- 不持久化密码校验材料。
- 密码输出必须先用 AES-GCM 加密，再进入 `storageData`。
- 新建密码和解密密码都必须输入 `entrySecret`。
- 条目加密 key 必须由当前 session key 与本次输入的 `entrySecret` 临时派生。
- Session 中的 `CryptoKey` 必须是 non-extractable，并且只保存在内存中。
- 单条密码不得保存 `ruleId`、scene/context 或任何可重建派生输入的元数据。
- 空间外“游离密码”只允许作为当前页面内存中的临时预览，不得写入 `storageData` 或迁移队列。
- 更多安全规则见 `docs/security-boundaries.md`。

## 关键路径索引

- `src/session-manager/`：master password 到 WebCrypto key 的生命周期、超时和 wipe。
- `src/rule-registry/`：静态 pure function registry，禁止运行时用户 JS。
- `src/crypto-engine/`：规则执行、输出编码、AES-GCM 加解密。
- `src/recovery-aid/`：关键密钥记忆提示的专用加密与解密。
- `src/storage-data/`：2.1 `storageData` 文件格式、schema、hash、diff、repository、存储类型、字段白名单和文件夹访问。
- `src/space/`：空间 policy、诊断、克隆、导入导出和迁移编排。
- `src/ui/`：React UI 层，页面、组件和业务 controller hooks。
- `src/ui/icons/`：本地 SVG React 图标系统，纯展示组件，使用 `currentColor`，不得承载安全关键含义。
- `design/Design.md`：项目级 UI 设计规范，记录布局、视觉 token 使用原则、组件原则、页面模式、Guidance/通知、安全文案保护和反模式。
- `src/styles.css`：当前 Glacier Blue 设计 token、双主题、布局和组件 class 的实现权威。
- `src/ui/design-system/README.md`：内部基础组件、设计系统维护边界和迁移状态说明。
- `src/App.tsx`：薄入口，只装配 `useAppController` 与 `AppView`。
- `src/ui/hooks/usePwaUpdate.ts`：Service Worker prompt 注册逻辑，测试环境安全降级。
- `src/ui/components/PwaUpdateBanner.tsx`：PWA 版本更新横幅组件，独立于系统通知通道。
- `vite.config.ts`：`VitePWA` 插件配置（`generateSW` + `prompt` 模式）。

## 后续开发红线

- 不添加后端依赖。
- 不添加 UI 组件库。
- 不添加远程规则市场。
- 不执行用户上传的 JavaScript 规则。
- 导入规则只能使用声明式 JSON 映射到允许的内置算法模板，不能导入、拼接、解释或执行代码。
- 不用纯 JavaScript 密码学库替代核心 WebCrypto 链路，不为了兼容非安全上下文而降低 PBKDF2、HMAC、AES-GCM、SHA-256 或 non-extractable `CryptoKey` 安全边界。
- 遇到 `crypto.subtle`、安全上下文或文件夹访问能力缺失时，应在 UI 中给出明确中文阻断提示，引导使用 Cloudflare Pages HTTPS 正式地址或受信任的本机 `localhost` 环境。
- 不把派生输入或单条密码可重建派生输入的元数据写入 `storageData`、IndexedDB、localStorage、sessionStorage、URL 或其他文件。
- 不为了视觉极简删除安全关键文案；`storageData`、`master_password`、`entrySecret`、`encrypted_memory_hint`、空间校验、规则链、输出适配、迁移模式、历史空间和归档空间必须在首次出现或关键操作前保留必要中文说明。
- 不把 `dist/` 作为源码提交，除非用户明确要求提交构建产物。

## Git 提交规则

Git 提交身份以本文档记录为准，不要在每次提交前重新查询本机 Git 配置。

收到用户要求“提交代码”时，必须先检查本次改动是否需要维护 README、`AGENTS.md` 或 `docs/`：如果新增或调整了安全边界、交互流程、迁移/存储规则、测试维护经验、提交约定或其他项目上下文，先更新对应文档，再执行提交。

Git 提交红线：

- 禁止使用 Codex、AI Agent、工具默认身份或临时构造身份提交代码，例如 `Author/Commit: Codex <codex@openai.com>`。
- 禁止绕过本文档记录的提交身份。提交时必须显式使用下方记录的用户名和邮箱。
- Commit message 必须遵循 Conventional Commits。

当前提交身份：

- 用户名：`whynotsnow`
- 邮箱：`whynotsnow@163.com`

提交时直接读取本节记录的用户名和邮箱，并通过 `git -c user.name=... -c user.email=... commit ...` 使用它们。Commit message 示例：`feat: implement local password workspace`、`fix: handle decrypt failure state`、`docs: update project context`。
