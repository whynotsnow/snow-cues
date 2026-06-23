# 编码与测试规则 / Coding Rules

## 编码边界

- 页面可见文案、README、测试描述和错误提示使用中文。代码标识、类型名、存储字段名和规格关键字保持英文。
- 尽量保持项目依赖简单。不要引入 UI 组件库；页面样式优先使用项目内 CSS 实现。只有在用户明确要求时才添加新的视觉依赖。
- 不要把逻辑堆回 `App.tsx` 或 `useAppController.ts`。如果新增 UI 逻辑导致单个组件或 hook 明显膨胀，优先按职责继续拆 hook 或子组件。
- 跨页面共享状态放在 `useAppController` 或其组合的 controller hook 中。表单输入、临时展开状态、条目可见状态应优先下放到局部 hook。
- 组件文件不要重新引入 WebCrypto、IndexedDB 或规则注册表等底层模块；需要业务能力时通过 hook 暴露的 handler 传入。
- 新增条目操作时，先扩展 `src/ui/entryCapabilities.ts` 和测试，再接入组件。
- 新增全局用户操作指引时，优先在 `src/ui/guidance.ts` 新增独立 builder，明确 card 是“下一步 / 可用操作 / 相关流程 / 受阻流程”，不要把业务判断塞进 `GuidancePanel`。

## 浏览器能力与移动端兼容

- 正式移动端兼容策略是 Cloudflare Pages HTTPS 分发，不是在代码中绕过 WebCrypto 安全上下文。不要为了普通局域网 HTTP、App 内置浏览器或直接打开 HTML 文件引入核心密码学降级实现。
- WebCrypto 核心能力缺失时，必须转化为明确中文环境错误；不要让 `Cannot read properties of undefined (reading 'digest')`、`crypto.subtle is undefined` 等底层异常直接暴露给用户。
- `crypto.randomUUID` 缺失可以由 `src/lib/random-id.ts` 使用 `crypto.getRandomValues()` 生成 UUID v4 兼容；禁止使用 `Math.random()` 生成 `storageDataId`、条目 ID、迁移 ID 或其他业务 ID。
- `crypto.subtle` 缺失不可用纯 JS SHA、PBKDF2、HMAC 或 AES-GCM 替代继续运行。后续应在应用启动、创建/打开 `storageData`、建立 session、密码生成、解密和比较工具入口前统一检测能力。
- File System Access API 缺失属于存储交互能力限制，应在 UI 中只展示当前可用的导入/下载操作；不要并列展示文件夹直接保存和文件导入导出两套策略，也不要和 WebCrypto 缺失混为同一个错误。

## 格式化与 Lint

- 代码格式化由 Prettier 负责，ESLint 只负责代码质量规则和可安全自动修复的问题。
- VS Code 保存代码时应等价于先执行 Prettier format，再执行 ESLint fix。项目级 `.vscode/settings.json` 已固定默认 formatter、`formatOnSave` 和 `source.fixAll.eslint`。
- Prettier 使用项目级 `.prettierrc`，不要依赖个人全局编辑器配置改变项目格式。
- 修改代码后优先运行 `npm run lint` 和 `npm run format:check`。需要自动修复时先运行 `npm run format`，再运行 `npm run lint:fix`。
- 提交前或跨项目维护任务应运行 `npm run validate`。

## 存储与业务修改规则

- 新增或调整 `PasswordEntry`、`PasswordGroup`、`spaceProfiles`、`migrationBatches` 或 `migrationEntries` 字段前，必须同时检查 `docs/security-boundaries.md`。
- 修改 storage schema、字段清理、canonical JSON、contentHash 或 diff 行为时，必须同步更新存储测试。
- 修改密码生成、加密、session、记忆提示或游离密码时，必须优先运行对应模块聚焦测试。
- 规则导入仍然只能是声明式 JSON 映射到允许的内置算法模板，不能导入、拼接、解释或执行代码。

## 测试归属

- `src/App.test.tsx` 只保留端到端冒烟主链路，例如进入存储空间、设置空间主密码、初始化规则链、新建保存、解密和基本存储边界检查。不要继续把新的 UI 流程用例堆回这个文件。
- `src/ui/__tests__/notifications.test.tsx` 覆盖系统通知、页面通知、浮动操作反馈和右侧全局用户操作指引去重。
- `src/ui/__tests__/space-access.test.tsx` 覆盖进入/离开空间、临时空间、设置空间主密码、已有密码空间校验、空间状态门禁和校验条目切换。
- `src/ui/__tests__/password-entries.test.tsx` 覆盖密码条目新建、解密、记忆提示、编辑、废弃和只读门禁等条目级流程。
- `src/ui/__tests__/password-groups.test.tsx` 覆盖密码组管理和解密后的输出适配流程。
- `src/ui/__tests__/space-index.test.tsx` 覆盖空间外本地空间索引、新建空间入口、创建方式和测试数据工具。
- `src/ui/__tests__/migration-ui.test.tsx` 覆盖迁移批次、来源空间校验、单条迁移/跳过、迁移完成后的来源空间流转等 UI 编排。
- `src/ui/__tests__/detached-password.test.tsx` 覆盖空间外游离密码生成、隐藏、迁入空间和迁入门禁。
- `src/session-manager/session-manager.test.ts` 覆盖 non-extractable key、空闲/绝对超时、touch 不超过绝对过期、wipe。
- `src/crypto-engine/crypto-engine.test.ts` 覆盖 AES-GCM 往返、不同 key 解密失败、`entrySecret` 参与条目加密 key 派生和游离密码生成。
- `src/recovery-aid/recovery-aid.test.ts` 覆盖同 session 往返、错误 master password 失败、不同 `spaceId` / `entryId` 失败、提示加密不依赖 `entrySecret`、空提示拒绝。
- `src/rule-registry/rules.test.ts` 覆盖不可用规则、确定性输出、salt/rule 改变输出变化、多规则链顺序影响输出、声明式导入规则和拒绝 JavaScript 算法。
- `src/storage-data/storage-data-service.test.ts` 覆盖字段白名单、持久化前剥离禁止派生字段、空间级规则链 profile 持久化和 `spaceId` 数据隔离。
- `src/space/migration.test.ts` 覆盖 clone 密码条目进入迁移队列、保持平台密码不变迁移、按新规则重新生成迁移、迁移完成后的自动/手动 `successor_of` 关系和来源空间状态流转。

## 测试执行策略

- 需要运行测试时，默认按改动影响面选择最小化模块测试，不直接运行全量 `npm run test`。
- 新增 UI 流程测试必须放入对应 `src/ui/__tests__/*.test.tsx` 文件。只有真正跨越多个核心流程、用于证明整站主链路仍可工作的冒烟用例，才允许放入 `src/App.test.tsx`。
- 编写测试时遵守最小化用例原则：一个测试优先验证一个模块或一个用户流程的核心行为。
- 需要前置数据时，优先使用存储层 seed 或专用 helper 构造稳定状态，而不是通过无关 UI 流程绕路创建。
- 测试不得无故耦合其他模块。断言应聚焦当前流程的稳定 UI 标识、存储结果或明确的 policy 输出。
- `src/test/appTestHelpers.tsx` 不应隐藏重要业务前置条件。涉及跨页面流程时，要么自行导航并等待稳定标识，要么在函数命名和调用点明确当前页面前置条件。
- 如果 Vitest 出现长时间无输出、测试挂起或只剩 `act(...)` 警告刷屏，应立即中断当前测试，改用单文件、`-t` 单用例或更小的复现测试定位。
- 临时 checkpoint、`console.log` 或调试断言只允许用于短时定位；定位后必须删除。
- 全量 `npm run test` 只在跨模块改动、提交前整体回归或用户明确要求时运行。
- 测试共享 `fake-indexeddb` 和浏览器全局状态，Vitest 关闭文件级并发。不要在未隔离 IndexedDB 名称和全局对象前重新开启 `fileParallelism`。

## 验证命令

```bash
npm install
npm run lint
npm run format:check
npm run typecheck
npm run test -- <受影响测试文件或 -t 过滤条件>
npm run build
```

当前依赖下载可能需要网络权限。若 `npm install` 失败，先处理依赖安装，再运行上述验证。提交前或文档规范化这类跨项目维护任务可以运行 `npm run validate`。
