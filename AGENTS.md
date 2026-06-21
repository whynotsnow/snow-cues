# Snow Cues v2.0 项目上下文

## 项目定位

这是一个纯前端、本地优先的密码派生与加密存储系统。应用必须可以作为静态站点部署到 GitHub Pages。2.0 版本以用户显式维护的 `storageData` 文件夹作为唯一业务数据源，项目代码和构建产物仍可由 Syncthing 等外部工具同步。

Syncthing、Git 同步和冲突自动合并不属于应用逻辑。不要在应用内实现本地目录监听、自动同步、自动合并、后端同步、账号系统或云端服务。

## 安全边界

- 不持久化 `master_password`。
- 不持久化 `entrySecret`（关键密钥）；`runtime_salt` 是旧命名，也不得进入存储。
- 不持久化 `entrySecret` 的可逆副本、`encrypted_entry_secret`、明文 `memory_hint`、关键密钥模板或可被系统自动拼接成关键密钥的结构化字段。
- 允许保存用户自愿填写的 `encrypted_memory_hint`，但它必须加密保存，不参与密码生成，不参与密码解密，不被系统解析，也不能用于自动恢复 `entrySecret`。
- 不持久化密码校验材料。进入空间不会因为校验失败被阻止；若当前空间已有密码，必须在进入后临时使用用户输入的 `entrySecret` 解密被标记的当前空间已有密码条目来验证当前会话 key。
- 当前空间已有密码且校验尚未完成时，允许进入空间查看状态和执行解密校验，但禁止创建、修改、废弃、变更规则或执行测试清理操作。
- 单条密码不持久化 `ruleId`、scene/context 或任何可重建派生输入的元数据。
- 空间外“游离密码”只允许作为当前页面内存中的临时预览；不得持久化派生密钥、游离规则输入、预览结果、生成历史或可重建材料，也不得写入迁移队列。
- `storageData` 正式文件、revision 和 draft 中的密码条目只允许保存 `PasswordEntry` 中定义的字段。
- 单条密码允许保存 `groupId` 作为密码组 UI 归属；`groupId` 不参与密码生成、解密或密码输出适配。
- 密码组属于空间内明文管理元数据，允许保存组名、普通说明和声明式 `outputPolicy`。组名、平台和备注都视为隐私元数据，不要填写账号、关键密钥或敏感规则。
- 密码输出适配只在核心密码解密后临时应用：核心密码仍由规则链生成并加密保存，适配策略公开、可审计，不作为安全秘密，不覆盖 `encrypted_password`。
- `storageData` 的空间 profile 可以按 `spaceId` 保存全局初始化配置：`ruleChain` 和参与规则链的声明式导入规则 manifest。不要把这些字段写入单条 `PasswordEntry`。
- `storageData` 的迁移批次和迁移条目必须与正式 `PasswordEntry` 分离。待迁移条目保存旧空间密文和非敏感元数据，不得直接出现在正式密码列表中。
- 密码输出必须先用 AES-GCM 加密，再进入 `storageData`。
- 新建密码和解密密码都必须输入 `entrySecret`。条目加密 key 需要由当前会话 key 与本次输入的 `entrySecret` 临时派生，不能只依赖会话 key。
- Session 中的 `CryptoKey` 必须是 non-extractable，并且只保存在内存中。

## 模块分工

- `src/session-manager/`：负责 master password 到 WebCrypto key 的生命周期、超时和 wipe。
- `src/rule-registry/`：负责静态 pure function registry。禁止 `eval`、`new Function`、动态脚本注入和运行时用户 JS。
- `src/crypto-engine/`：负责规则执行、输出编码、AES-GCM 加解密。包含 `encoding.ts`（base62/base64/自定义字符集编码，模运算字节映射）。
- `src/recovery-aid/`：负责关键密钥记忆提示的专用加密与解密。提示 key 由 session `cryptoKey`、`spaceId`、`entryId` 和固定 purpose 派生，不依赖 `entrySecret`，不复用条目密码加密 key。
- `src/storage-data/`：负责 2.0 存储数据文件格式、正式/草稿区分、schema 校验、字段清理、canonical JSON、`sha256:<hex>` contentHash、安全摘要 diff、内存 repository、File System Access API 封装、显式保存和只读比较。
- `src/storage-engine/`：保留存储类型、字段白名单和兼容导出层。业务 CRUD 当前委托到 `src/storage-data/` 的内存 repository，不再把 IndexedDB 作为业务真源。
- `src/space/`：负责空间 policy、诊断、克隆、导入导出和迁移编排。迁移服务集中处理双空间 session、旧密文解密、新空间加密和迁移完成后的关系/状态流转。
- `src/lib/bytes.ts`：纯函数工具模块，提供 `utf8ToBytes`、`bytesToUtf8`、`bytesToBase64`、`base64ToBytes`、`concatBytes`，被 crypto-engine 和 session-manager 共用。
- `src/App.tsx`：React 应用薄入口，只装配 `useAppController` 与 `AppView`。
- `src/ui/`：UI 层。路由页面、展示组件、卡片和全局操作指引按目录拆分，状态和业务逻辑按 hook 拆分。
- `src/ui/useAppController.ts`：顶层组合 hook，汇总空间、规则、条目和页面动作；不要重新堆回大组件式逻辑。
- `src/ui/hooks/useSpaceAccessController.ts`：负责进入/离开空间、空间检测、刷新条目、会话存活检查和 `withLiveSession`。
- `src/ui/hooks/useRuleProfileController.ts`：负责规则链草稿、导入规则、profile 恢复和规则链初始化。
- `src/ui/hooks/usePasswordEntryController.ts`：负责新建密码、解密、记忆提示、条目编辑和废弃。
- `src/ui/hooks/useSpaceIndexController.ts`：负责空间外本地空间索引、空间外创建空间和创建后进入空间主页。
- `src/ui/hooks/useDetachedPasswordController.ts`：负责空间外游离密码表单、临时预览、复制状态和待迁入派生密钥内存状态；不得读写 `storageData` 或迁移队列。
- `src/ui/hooks/useSpaceManagementController.ts`：负责空间主页中的当前空间操作、导入导出、迁移批次、来源空间内存 session 和单条迁移。
- `src/ui/hooks/useWorkspaceActions.ts`：负责全局测试数据工具、当前空间测试清理和新建密码入口跳转。
- `src/ui/hooks/useCreatePasswordForm.ts`、`useSpaceEntryForm.ts`、`useEntryRuntimeState.ts`：只保存局部 UI 状态；不得把这些状态持久化。
- `src/ui/entryCapabilities.ts`：聚合条目级 UI 能力和禁用原因。组件应优先消费聚合结果，不要在展示层分散拼接底层 policy。
- `src/ui/guidance.ts`：负责根据顶层 controller 状态生成右侧全局用户操作指引多卡片队列；只做状态推导，不持久化用户进度。新增流程时优先新增独立 builder，明确 card 是“下一步 / 可用操作 / 相关流程 / 受阻流程”，不要把业务判断塞进 `GuidancePanel`。
- `src/ui/pages/`：hash 路由承载的页面入口，例如空间主页、规则管理、输出适配、密码管理和游离密码页面。页面负责组合 controller 状态和展示组件，不承载底层业务逻辑。
- `src/ui/components/`：三栏工作台、全局操作指引、空间主页卡片、密码管理、规则管理、条目卡片等展示组件。组件应尽量只渲染 props 和派发事件。

## 当前实现快照

技术栈是 Vite + React 19 + TypeScript，测试使用 Vitest、Testing Library、jsdom 和 `fake-indexeddb`。项目没有后端代码，也没有 UI 组件库。

`package.json` 中的主要脚本：

- `npm run typecheck`：执行 `tsc -b --pretty false`。
- `npm run test`：执行 `vitest run`。
- `npm run build`：先执行 `tsc -b`，再执行 `vite build`。

TypeScript 配置拆分为三个文件：`tsconfig.json`（根配置，引用子项目）、`tsconfig.app.json`（应用源码配置）、`tsconfig.node.json`（Vite/Vitest 配置文件类型检查）。`tsc -b` 使用项目引用模式编译。

Vite 配置位于 `vite.config.ts`，使用 `@vitejs/plugin-react` 插件，`base` 设为 `"./"` 以确保构建产物使用相对路径，适配 GitHub Pages 等非根路径部署。

Vitest 配置位于 `vitest.config.ts`，使用 jsdom 环境，通过 `src/test/setup.ts` 注入 polyfill：
- `fake-indexeddb/auto` 在 Node.js 中模拟 IndexedDB。
- `node:crypto` 的 `webcrypto` 替换 `globalThis.crypto`。
- 补充 `btoa`/`atob`（Node.js 原生不提供，通过 `Buffer` 实现）。

应用入口 `src/main.tsx` 使用 React 19 的 `createRoot` API 配合 `StrictMode` 渲染 `<App />`。`src/App.tsx` 只装配 `src/ui/useAppController.ts` 和 `src/ui/AppView.tsx`；路由页面入口位于 `src/ui/pages/`，展示组件和空间主页卡片位于 `src/ui/components/`，共享状态和业务操作被拆分到 `src/ui/hooks/`。应用外壳为三栏后台布局：左侧菜单区、中间页面主内容、右侧全局用户操作指引。所有样式由 `src/styles.css` 手写提供，未引入任何 UI 组件库。

UI 层维护约定：

- 跨页面共享状态放在 `useAppController` 或其组合的 controller hook 中；表单输入、临时展开状态、条目可见状态应优先下放到局部 hook。
- 全局用户操作指引由 `guidance.ts` 根据 `useAppController` 暴露的状态集中生成，`GuidancePanel` 只负责展示和派发动作。页面通知负责状态、警告和操作反馈；操作指引负责“下一步做什么”和阻塞原因。
- 涉及空间进入/离开、会话存活和 `withLiveSession` 的逻辑维护在 `useSpaceAccessController`。
- 涉及规则导入、规则链草稿、冻结规则链和 profile 恢复的逻辑维护在 `useRuleProfileController`。
- 涉及密码创建、解密、记忆提示、条目修改和废弃的逻辑维护在 `usePasswordEntryController`。
- 涉及空间外索引、空间外创建空间、空白临时空间进入、clone/import 创建空间的逻辑维护在 `useSpaceIndexController`。
- 涉及空间主页、当前空间 clone、导入导出和迁移队列的逻辑维护在 `useSpaceManagementController`。
- 涉及全局测试数据工具、当前空间测试清理和新建密码入口跳转的逻辑维护在 `useWorkspaceActions`。
- 条目按钮和字段是否可用由 `entryCapabilities.ts` 聚合；新增条目操作时先扩展能力层和测试，再接入组件。
- 组件文件不要重新引入 WebCrypto、IndexedDB 或规则注册表等底层模块；需要业务能力时通过 hook 暴露的 handler 传入。
- 如果新增 UI 逻辑导致单个组件或 hook 明显膨胀，优先按职责继续拆 hook 或子组件，而不是回到 `App.tsx` 或 `useAppController.ts`。

会话实现：

- `createSession(masterPassword)` 使用 PBKDF2-SHA256，迭代次数为 `310_000`。
- 会话派生两个 non-extractable key：`cryptoKey` 是 HMAC-SHA256 signing key，`storageKey` 是 AES-GCM key。
- 当前条目加密实际使用 `deriveRuntimeStorageKey(liveSession.cryptoKey, entrySecret)` 生成的临时 AES-GCM key；不要退回只使用 `session.storageKey` 加密条目。
- 默认空闲超时为 5 分钟，绝对超时为 30 分钟。过期或离开空间时会清空敏感 UI 状态、条目列表和会话引用。
- 进入空间表单不提供“是否校验”开关。该流程不在进入表单收集关键密钥；只要当前空间已有密码，进入成功后密码列表都会默认标记一条待校验条目（当前取 `storedEntries[0]`，即按 `updatedAt` 倒序的第一条），空间主页会自动展开该条目的校验输入。用户可以在空间主页改选另一条已知关键密钥的密码作为校验条目。校验失败不得离开空间，校验完成前只能查看列表状态，并在空间主页查看待校验条目的提示或解密完成校验。
- 所有敏感操作（创建密码、解密、废弃、规则导入/确认、测试清理）都通过 `withLiveSession` 包装执行：先检查会话是否过期，若过期则调用 `leaveSpace` 拒绝操作；若存活则 `touchSession` 续期空闲计时器，再将 live session 引用传给回调。这个模式确保了每次操作前会话状态的一致性。
- 迁移期间会额外创建来源空间 session。来源 session 只保存在内存中，用于解密旧空间密文；离开空间、切换迁移批次、过期或完成迁移后必须清除。不要把来源 `master_password`、旧 `entrySecret`、新 `entrySecret` 或平台密码明文写入存储。

规则实现：

- 内置规则位于 `src/rule-registry/rules.ts`：`v1-hmac`（稳定 HMAC）、`v2-pbkdf2`（增强 PBKDF2）可用，`v3-argon2` 只是预留且不可用。
- 默认规则链是双规则 `["v1-hmac", "v2-pbkdf2"]`，即“稳定 HMAC → 增强 PBKDF2”顺序执行。`DEFAULT_RULE_ID = "v1-hmac"` 仅作为规则不可用时的 fallback。
- 导入规则在初始化前可批量导入；如果参与已确认的 `ruleChain`，其声明式 manifest 会随空间 profile 持久化，用于后续进入同一空间恢复规则链。
- 导入规则 manifest 只允许 JSON 对象，`id` 必须匹配 `imported-[a-z0-9-]{3,40}`，`algorithm` 只允许 `hmac-sha256` 或 `pbkdf2-sha256`。
- 导入 PBKDF2 规则的 `iterations` 会被限制在 `100_000` 到 `600_000` 之间，默认 `210_000`。
- 导入规则在创建时会通过 namespace 前缀注入 salt（HMAC 用 `${namespace}:${salt}`，PBKDF2 用 `${namespace}:material:${salt}` 和 `${namespace}:salt:${salt}`），确保不同导入规则即使算法相同也产生不同输出。
- 可见规则列表使用 `availableRules` 加上当前启用的导入规则。系统 profile 初始化后，本次会话内不再允许导入、停用、重命名或删除规则。

密码生成与加密实现：

- `generatePasswordWithRuleChain` 要求非空 `entrySecret` 和至少一条规则；规则链按顺序执行，上一条规则的输出作为下一条规则的输入材料，最后再按编码策略输出。
- `generateDetachedPassword` 用派生密钥临时导入 non-extractable HMAC key，并固定使用默认内置规则链生成空间外预览材料；它不创建 session，不读写存储，不支持空间外导入规则。
- 输出编码支持 `base62`、`base64` 和 `custom`。自定义字符集会去重，且至少需要两个不同字符。
- `mapBytesToCharset` 使用 `byte % charset.length` 的逐字节模运算映射到字符集——这种简单映射不保证密码学均匀分布，仅用于将规则输出的 base64 材料转为目标字符集。
- `decodeRuleMaterial` 先尝试 base64 解码，失败时回退到 UTF-8 编码。这意味着规则输出必须先产生可被 base64 解码的材料（当前所有内置规则输出都是 base64）。
- 默认输出长度是 24，UI 允许 8 到 64。
- `encryptPassword` 使用 AES-GCM，随机 12 字节 IV，存储格式是 `base64(iv + ciphertext)`。
- `decryptPassword` 会拆出前 12 字节作为 IV，剩余部分作为 ciphertext；解密失败时 UI 应提示检查关键密钥。

关键密钥记忆提示实现：

- `encryptMemoryHint(session, spaceId, entryId, memoryHint)` 会 trim 提示文本，空提示不生成 `encrypted_memory_hint`。
- `decryptMemoryHint(session, spaceId, entryId, encryptedMemoryHint)` 只依赖当前空间会话能力，不要求用户输入 `entrySecret`。
- 记忆提示使用 AES-GCM 和随机 12 字节 IV，存储格式为 `base64(iv + ciphertext)`。
- 不同 `master_password`、`spaceId` 或 `entryId` 都不能互相解密提示。

存储实现：

- 2.0 正式文件格式为 `format: "snow-cues-storage-data"`、`schemaVersion: 1`。草稿文件格式为 `format: "snow-cues-storage-data-draft"`、`schemaVersion: 1`。主打开流程必须拒绝 draft 文件。
- `storageDataId` 是数据集 ID，不等于单个 `spaceId`。`spaceId` 仍只是数据集内的本地分区标识，不是派生输入。
- `contentHash` 使用 canonical JSON + WebCrypto SHA-256，格式为 `sha256:<hex>`，计算时必须排除 `contentHash` 自身。序列化正式文件时保持 canonical JSON，方便外部同步和人工比对。
- 文件夹结构为 `current.json`、`revisions/`、`drafts/`、`conflicts/`。第一版不创建 `manifest.json`，不保存 `deviceId`、`updatedBy` 或 `updatedByLabel`。
- 新建 storageData 默认生成 revision `1`，并写入初始 `current.json`；直接保存模式必须先写 `revisions/storage-data-rev-xxxxxx.json`，成功后再更新 `current.json`。
- 所有业务操作只修改浏览器内存 repository 草稿。保存必须由用户显式触发；空保存必须拒绝；保存前必须展示摘要 diff 二次确认。
- 保存前必须重读 `current.json`，用打开时的 revision/hash 检测外部变化。若检测到变化，必须拒绝覆盖，保留内存草稿，并提供重新打开和导出 draft 的路径。
- 下载模式只生成新版正式文件内容，由用户手动替换 `current.json` 或放置 revision，并确认外部同步已完成；应用不自动写入同步文件夹。
- 安全摘要 diff 和比较工具只展示集合数量级摘要，不展示密文字段、明文秘密或隐私元数据全文。只读比较工具不得合并、不得写文件。
- `PasswordEntry` 当前字段为：`id`、`spaceId`、`encrypted_password`、`encrypted_memory_hint`、`groupId`、`platform`、`description`、`deprecatedAt`、`createdAt`、`updatedAt`。`groupId` 只是 UI 归属，不参与密码生成、解密或输出适配。
- `PasswordGroup` 当前字段为：`id`、`spaceId`、`name`、`description`、`outputPolicy`、`createdAt`、`updatedAt`。`outputPolicy` 是解密后的输出适配策略，不参与核心密码生成。
- `allowedStorageFields`、`sanitizePasswordEntry` 与 `sanitizeStorageDataContent` 是存储边界的重要保护；新增字段前必须确认是否违反安全边界，并同步测试。
- `createPasswordEntry` 会 trim `platform` 和 `description`，空字符串会转成 `undefined`。
- `listPasswordEntriesBySpace(spaceId)` 按 `updatedAt` 倒序返回当前空间条目；兼容包装 `listPasswordEntries()` 只返回 `default` 空间。
- `updatePasswordEntry` 不更新密码内容；条目废弃后禁止修改 `platform`，仍允许修改 `description`、`groupId` 和记忆提示。
- `deletePasswordEntry` 在存储兼容层中存在，但当前 UI 删除按钮是禁用的，不要在 UI 中启用删除，除非用户明确要求重新讨论。
- `spaceProfiles` 按 `spaceId` 保存空间级 profile：`spaceId`、`ruleChain`、`importedRuleManifests`、`createdAt`、`updatedAt`。这是空间初始化配置，不是密码条目字段。
- `migrationBatches` 和 `migrationEntries` 保存迁移队列。它们用于暂存旧空间密文、迁移进度和来源空间流转偏好，不是正式密码条目；迁移成功后才创建新的 `PasswordEntry`。
- 旧 IndexedDB 模块不再作为业务真源。残留旧浏览器数据不得出现在 2.0 UI 业务流；清空或忽略 IndexedDB 不应影响通过 storageData 打开的业务状态。

UI 状态与交互：

- `UiState` 当前包含 `OUT_OF_SPACE`、`IN_SPACE`、`ACTIVE`、`LEFT_SPACE`，只作为内部 UI 状态机使用。不要把 `IN_SPACE`、`ACTIVE` 等内部状态直接展示为用户状态标签；用户可见状态优先展示空间外范围、当前 `spaceId`、临时空间状态和持久状态“正常 / 历史 / 归档”。
- 顶栏空间持久状态必须通过中文映射展示：`active` 为“正常”、`deprecated` 为“历史”、`archived` 为“归档”，不要直接展示 raw enum。
- 进入空间时 `spaceId` 会经过 `normalizeSpaceId()` 处理（trim + toLowerCase），确保同一空间标识的大小写和前后空格变体映射到同一数据分区。
- 未打开 storageData 时，不从 IndexedDB 或其他旧本地存储加载业务数据，不展示旧空间索引。空间工作台应优先展示“新建存储数据文件夹 / 打开存储数据文件夹 / 比较两个存储数据文件”。游离密码仍可作为纯内存功能使用。
- 打开 storageData 后，空间工作台展示 `storageDataId`、revision、updatedAt、保存模式、dirty 状态、保存、draft 导出和比较工具。保存按钮必须先弹出摘要 diff 确认；空保存不可执行。
- 未进入空间或已离开空间时不加载、展示已存储密码列表。
- 空间外页面展示本地空间索引和创建空间入口。空间索引只展示本地空间元数据，不展示密码条目。
- 空间外主菜单包含“空间工作台”和“游离密码”两个平级页面。“空间工作台”展示本地空间索引和创建空间入口；“游离密码”页面只包含派生密钥、核心编码、核心材料长度和声明式输出策略，不包含平台、备注、密码组或记忆提示等正式条目元信息。输出策略只影响空间外预览，用户可以选择是否应用。
- 进入不存在的空间 ID 或空间外空白创建时，先进入临时空间；只有初始化规则链或创建密码后，才会持久保存空间记录。
- 进入空间后默认进入“空间主页”，中间工作区使用 hash 路由承载“空间主页 / 规则管理 / 输出适配 / 密码管理”，左侧菜单承载主导航且顺序保持一致。空空间只有初始化规则链、创建密码、创建密码组、clone/import 创建空间数据或创建迁移批次后才会持久化本地数据。
- 当前空间没有可校验密码条目且本次 session 尚未建立时，空间主页必须优先展示“设置空间主密码”入口。该操作只调用 `handleStartSpaceSession` 建立当前浏览器内存 session，不持久化 `master_password` 或校验材料；session 有效期内后续初始化规则链、创建密码组、创建密码、迁移等操作不应重复要求空间主密码。
- 通知按系统级、页面级、区域级和操作反馈分层展示。系统级通知优先使用浏览器 Notification API，用户拒绝或浏览器不可用时降级为站内组件；系统通知文案不得包含 `spaceId`、平台、备注、关键密钥、密码或记忆提示等隐私信息。页面级通知统一承载在中间工作区路由页面顶部，并允许携带受控页面跳转动作；历史空间和归档空间的受限状态必须在进入空间后的每个页面顶部展示。页面级通知只承载页面级门禁、风险、状态和限制，不承担普通操作指导；历史空间顶部通知只说明“空间已标记为历史、通常表示已有后继空间接替、哪些维护能力不可用”，不要写“可以查看 / 可以 clone / 前往某页”等操作建议。空间校验、规则链初始化、迁移步骤、历史空间解密准备等“下一步做什么 / 现在能做什么”由右侧全局用户操作指引负责。密码管理页在空间校验未完成时只展示页面级通知和“前往空间主页”动作，不在页面主体重复堆叠通知块，也不提供校验输入入口。右侧全局用户操作指引以动态多卡片展示当前下一步、可用操作、相关流程和受阻流程；已完成或不存在的流程不生成 card，不保存已读状态或任何敏感信息。
- `loginVerificationEntryId` 的赋值逻辑：进入空间时取 `listPasswordEntriesBySpace` 返回结果的第一条（即按 `updatedAt` 倒序的最新条目）作为默认校验目标。如果密码列表为空则不触发校验流程。空间主页允许用户切换校验目标，切换时必须清空旧条目的空间主密码和关键密钥输入、已显示密码和错误状态。
- `handleReveal` 同时承担普通解密和空间校验双重职责：当解密条目 ID 等于 `loginVerificationEntryId` 时，解密成功会清除校验标记并显示“空间校验已完成。”。
- 历史空间（`deprecated`）不复用 active 空间“先完成空间校验”的写入门禁指引。历史空间已有条目且 `verificationPending` 时，右侧指引应显示“准备解密历史密码”，说明查看列表不需要校验；若要解密多条历史密码，需要在空间主页的历史密码校验区域输入空间主密码和一条已知关键密钥完成本次会话解密准备。历史空间仍禁止创建、编辑、废弃、规则变更、迁移管理和测试清理。
- 归档空间（`archived`）不显示“准备解密历史密码”或任何解密流程指引。归档空间右侧只展示受限状态和可查看范围，文案必须明确归档空间不支持密码解密、日常派生或写入维护；可以提及建立本次空间会话后按权限查看已保存的记忆提示。
- 未初始化规则链时，“新建密码”入口应引导跳转到规则管理；规则链初始化后才展开新建表单、当前生效规则链预览和创建流程说明。
- 规则管理页承载规则链初始化、声明式规则导入/批量导入和测试规则样例。
- 空间主页承载空间概览、空间指向关系、空间校验、空间主密码设置、迁移情况和当前空间操作，迁移情况卡片应位于当前空间操作卡片之前。当前空间已有密码且校验未完成时，空间主页在当前空间操作之前复制展示待校验条目用于优先完成校验，并默认自动展开校验输入；若有多条密码，用户可以选择用于校验的密码条目。当前空间没有可校验密码条目且 session 未建立时，空间主页在当前空间操作之前展示设置空间主密码卡片。密码管理列表仍完整展示所有条目，不因校验区域复制展示而过滤，但密码管理页不展示校验输入，只通过页面级通知指引到空间主页。当前空间操作先选择操作方式，再按方式展示目标空间；clone 当前空间完成后直接进入目标空间主页。
- 空间外创建空间必须先点击“新建空间”按钮，再选择创建方式。创建方式包括空白创建、从已有空间 clone 配置、从已有空间 clone 配置 + 密码迁移队列、从导入文件创建空间、从导入文件创建空间 + 密码迁移队列。
- 游离密码点击“迁移到空间”后只保留内存中的待迁入派生密钥草稿。进入目标空间后，用户必须填写平台、密码组、普通备注和可选记忆提示，可沿用或修改带入的 `entrySecret`；保存时按目标空间稳定 `ruleChain` 走正式新建密码逻辑。
- 全局测试数据工具始终展示在页面底部，和是否进入空间无关；用于测试的按钮文案必须明确标注“测试”。这些操作修改当前打开的 storageData 内存草稿，不直接写正式文件。空间外可删除指定空间或清空当前 storageData 草稿，空间内且策略允许时可清空当前空间密码数据或重置当前空间规则链配置。
- 仅克隆配置不得创建空间指向关系，不得流转旧空间状态；克隆或导入密码条目只创建迁移批次和迁移条目，不直接写入正式密码条目。
- 游离密码迁入空间不使用 `migration_batches` 或 `migration_entries`，不创建 `space_relations`，不修改任何来源空间状态。
- 克隆或导入密码条目创建的迁移批次应先处于 `draft` 状态。若带有来源规则快照，目标空间规则管理页可以载入来源规则草稿，但必须由用户手动确认初始化目标空间规则链；规则链初始化后系统自动把迁移批次置为 `ready`，不得在执行单条迁移或跳过条目时自动流转批次状态。右侧全局指引只在存在未完成迁移批次时按“设置目标空间主密码 → 初始化目标规则链 → 校验来源空间 → 逐条迁移或跳过 → 完成来源空间流转”的顺序提示当前迁移步骤；如果迁移已完成且存在当前空间指向来源空间的 `successor_of` 接替关系，不再展示迁移流程指引。
- 迁移批次默认 `autoFinalizeSource: true`，即全部迁移条目完成后自动创建 `successor_of` 关系并把来源空间流转为 `deprecated`。用户可在迁移开始前取消勾选，改为迁移完成后手动点击“手动流转来源空间状态”；手动流转完成后记录 `sourceFinalizedAt`，避免重复流转。
- 来源空间校验应复用“选择一条已有密码条目 + 旧空间主密码 + 该条目旧关键密钥”的空间校验模型。来源空间校验完成后，校验卡片保留在迁移区域但不再显示表单和按钮，只展示已校验提示；校验中、失败和成功都必须在卡片内有局部通知，失败和成功还需要进入系统通知层。系统通知文案不得包含 `spaceId`、平台、备注、关键密钥、密码或记忆提示等隐私信息。
- 迁移按钮禁用时必须展示明确原因，例如目标规则链未初始化、迁移批次正在等待自动就绪、目标空间会话未建立、当前空间校验未完成或来源空间校验未完成；不要只禁用按钮而不解释。
- 迁移支持“保持平台密码不变”和“按新规则重新生成”。重新生成模式必须提示平台密码会改变，并要求用户确认外部平台已更新后才保存。
- 全部迁移条目完成后才允许创建 `successor_of` 关系，并将来源空间流转为 `deprecated`。该动作默认自动执行，也可由用户在迁移前选择手动执行。关系只用于展示来源和接替，不跨空间继承密钥、规则运行时或密码条目。
- 新建密码表单展示“关键密钥”和“关键密钥记忆提示，可选”。已存储密码列表不要常驻展示记忆提示输入框；只有点击“编辑条目”后，才进入单条目的编辑态。
- 新建成功后会隐藏新建表单，清空平台、描述、`entrySecret` 和记忆提示，刷新条目列表；不要在新建表单底部常驻显示密码输出。
- 已存储密码列表默认只读展示平台、密码组和普通备注；解密需要先点击“解密”显示单条目的关键密钥输入，再点击“确认解密”。每次打开解密输入框都应清空该条目的上次关键密钥输入。解密关键密钥输入框不应占满整张条目卡片宽度，移动端除外。
- 若条目保存了 `encrypted_memory_hint`，列表中展示“查看记忆提示”按钮；点击后解密并展示提示，再点击“隐藏记忆提示”收起。空间校验未完成时，只允许在空间主页查看当前待校验条目的提示。
- 空间校验完成后，允许点击“编辑条目”进入单条目编辑态；同一时间只允许一条密码处于编辑态，有未保存修改时切换到另一条必须先保存或取消。编辑态不展示“解密/隐藏/废弃/删除/正在编辑”等非编辑态操作。
- 编辑条目时平台、密码组和普通备注回填为草稿；密码内容暂不支持编辑，原密码显示位置应显示“当前不支持编辑密码”以保持布局稳定。
- 记忆提示是敏感字段。编辑条目时该字段默认隐藏并显示掩码；用户点击“显示提示”只读查看，点击“隐藏提示”收起并清除编辑态明文，点击“解锁编辑 / 添加提示”后才可编辑。保存时重新加密写入 `encrypted_memory_hint`。清除提示必须通过明确的“清除提示”按钮完成，不要用空输入隐式删除。废弃条目仍允许编辑普通备注、密码组和记忆提示，但平台输入禁用。
- 解密失败且存在提示时显示“该条目保存了关键密钥记忆提示，你可以查看提示后重试。”；查看提示后仍失败时，建议用户重置平台密码并将当前条目标记为废弃，不得自动废弃。
- 创建和解密已有 loading 状态：按钮文案分别为“生成中...”和“解密中...”。
- 废弃条目会显示“已废弃”，平台输入被禁用，描述输入仍可编辑。

测试覆盖：

- `src/App.test.tsx` 只保留端到端冒烟主链路，例如进入存储空间、设置空间主密码、初始化规则链、新建保存、解密和基本存储边界检查；不要继续把新的 UI 流程用例堆回这个文件。
- `src/ui/__tests__/notifications.test.tsx` 覆盖系统通知、页面通知、浮动操作反馈和右侧全局用户操作指引去重。
- `src/ui/__tests__/space-access.test.tsx` 覆盖进入/离开空间、临时空间、设置空间主密码、已有密码空间校验、空间状态门禁和校验条目切换。
- `src/ui/__tests__/password-entries.test.tsx` 覆盖密码条目新建、解密、记忆提示、编辑、废弃和只读门禁等条目级流程。
- `src/ui/__tests__/password-groups.test.tsx` 覆盖密码组管理和解密后的输出适配流程。
- `src/ui/__tests__/space-index.test.tsx` 覆盖空间外本地空间索引、新建空间入口、创建方式和测试数据工具。
- `src/ui/__tests__/migration-ui.test.tsx` 覆盖迁移批次、来源空间校验、单条迁移/跳过、迁移完成后的来源空间流转等 UI 编排。
- `src/ui/__tests__/detached-password.test.tsx` 覆盖空间外游离密码生成、隐藏、迁入空间和迁入门禁。
- `src/test/appTestHelpers.tsx` 提供 UI 集成测试共享 helper。helper 不应隐藏重要业务前置条件；涉及跨页面流程时，要么自行导航并等待稳定标识，要么在函数命名和调用点明确当前页面前置条件。
- `src/space/policy.test.ts` 覆盖底层空间 policy 和条目 UI 能力聚合。
- `src/session-manager/session-manager.test.ts` 覆盖 non-extractable key、空闲/绝对超时、touch 不超过绝对过期、wipe。
- `src/crypto-engine/crypto-engine.test.ts` 覆盖 AES-GCM 往返、不同 key 解密失败、`entrySecret` 参与条目加密 key 派生和游离密码生成。
- `src/recovery-aid/recovery-aid.test.ts` 覆盖同 session 往返、错误 master password 失败、不同 `spaceId` / `entryId` 失败、提示加密不依赖 `entrySecret`、空提示拒绝。
- `src/rule-registry/rules.test.ts` 覆盖不可用规则、确定性输出、salt/rule 改变输出变化、多规则链顺序影响输出、声明式导入规则和拒绝 JavaScript 算法。
- `src/storage-engine/storage-engine.test.ts` 覆盖字段白名单、持久化前剥离禁止派生字段、空间级规则链 profile 持久化和 `spaceId` 数据隔离。
- `src/space/migration.test.ts` 覆盖 clone 密码条目进入迁移队列、保持平台密码不变迁移、按新规则重新生成迁移、迁移完成后的自动/手动 `successor_of` 关系和来源空间状态流转。

测试执行策略：

- 需要运行测试时，默认按改动影响面选择最小化模块测试，不直接运行全量 `npm run test`。例如只改 `crypto-engine` 时优先运行对应 `src/crypto-engine/*.test.ts`，只改迁移服务时优先运行 `src/space/migration.test.ts`，只改 UI 某个流程时优先运行该流程对应的聚焦测试。
- 编写测试时必须遵守最小化用例原则：一个测试优先验证一个模块或一个用户流程的核心行为，不为了覆盖无关页面而串联完整应用链路。需要前置数据时，优先使用存储层 seed 或专用 helper 构造稳定状态，而不是通过无关 UI 流程绕路创建。
- 新增 UI 流程测试必须放入对应 `src/ui/__tests__/*.test.tsx` 文件；只有真正跨越多个核心流程、用于证明整站主链路仍可工作的冒烟用例，才允许放入 `src/App.test.tsx`。
- 测试不得无故耦合其他模块：不要依赖无关页面的 toast、上一测试留下的 hash、列表偶然排序、非目标模块的按钮文案或完整业务链路作为断言基础。断言应聚焦当前流程的稳定 UI 标识、存储结果或明确的 policy 输出。
- 如果当前测试文件过大，导致无法只验证本次改动相关流程，应先改造测试结构：补充可按模块或流程单独运行的测试文件、拆分臃肿的集成测试，或使用明确的 `-t` 用例过滤。不要为了小改动反复依赖全量测试定位问题。
- 全量 `npm run test` 只在跨模块改动、提交前需要整体回归、或用户明确要求时运行；若全量测试暴露与本次改动无关的慢测、挂起或历史警告，应记录现象并优先回到最小复现测试定位。
- UI 路由、菜单或页面层级调整容易踩到 `AppView` hash 同步、空间内外页面纠偏、测试 helper 默认页面位置等隐性假设。遇到这类改动时，不要只在 `src/App.test.tsx` 里追加等待或临时日志；应先把路由规则提炼为可单测的纯函数或小 hook，再为具体页面补充独立测试。
- 如果 Vitest 出现长时间无输出、测试挂起或只剩 `act(...)` 警告刷屏，应立即中断当前测试，改用单文件、`-t` 单用例或更小的复现测试定位。禁止在未缩小范围前反复运行全量测试。
- 临时 checkpoint、`console.log` 或调试断言只允许用于短时定位；定位后必须删除，不能随功能提交进入代码库。
- 测试 helper 不应假设当前一定停留在某个页面。涉及跨页面流程时，helper 要么自己导航到所需页面并等待稳定标识，要么由调用方显式完成导航后再调用；等待条件优先选择稳定 UI 状态，例如侧栏当前空间信息、目标页面标题或表单区域，不依赖容易被消息覆盖的 toast 文案。
- 如果局部功能实现被测试结构阻塞，先暂停功能推进，说明阻塞点，并优先提交或完成测试结构改造；测试结构稳定后再继续业务改动。

## UI 与文档语言

页面可见文案、README、测试描述和错误提示使用中文。面向用户的实现总结、变更说明和验证结果也使用简体中文，不使用英文小标题或英文总结。代码标识、类型名、存储字段名和规格关键字保持英文，例如 `master_password`、`entrySecret`、`encrypted_password`、`encrypted_memory_hint`。`runtime_salt` 只作为历史兼容命名出现，不作为新增 UI 文案。

产品文案使用“进入存储空间 / 离开空间 / 未进入空间 / 已进入空间”这套语义，不使用“登录 / 退出 / 未登录 / 已登录”或“锁定 / 解锁”作为页面文案。空间外不得展示已经存储的密码列表。

进入空间后的页面应像常规后台系统：桌面端使用三栏布局，左侧展示品牌、空间外范围或当前 `spaceId`、空间持久状态、离开空间按钮和主菜单，中间展示当前页面主内容，右侧展示全局用户操作指引；移动端三栏上下堆叠，菜单变为可换行按钮组。左侧不要展示内部 `UiState` 调试式标签。主体通过 `src/ui/pages/` 下的页面入口区分空间主页、规则管理、输出适配和密码管理，菜单顺序为“空间主页 / 规则管理 / 输出适配 / 密码管理”。新建密码和已存储密码列表上下排布，不使用左右分栏。

规则链是空间级全局初始化配置，没有“某一条密码自己的 rule”的概念。新建密码前必须先初始化当前空间的 `ruleChain`；单条密码不得保存 rule 信息。新建按钮在未初始化时应提示并引导到规则管理页，初始化后才展示新建流程、当前生效规则链预览和创建流程说明。

规则管理需要独立页面，可查看系统内置规则，管理导入规则的启用状态、名称和删除。导入规则仍然只能是声明式 JSON 或声明式 JSON 数组，不允许执行代码。规则链初始化后，导入规则管理操作应被限制，避免破坏已确认规则链的可追溯性。

当前密码列表展示创建时的平台、密码组和普通备注。平台、密码组和普通备注可以修改；密码内容暂不支持修改；删除功能先禁用，后续再讨论。密码可以标记为废弃，废弃不会删除数据；废弃后平台不可修改，普通备注和密码组仍可修改。记忆提示不常驻编辑，列表态只能查看/隐藏；编辑条目时也默认隐藏，需显式显示或解锁后才能查看或修改。

密码组管理位于独立的“输出适配”页，不要把创建密码组和策略编辑表单塞回密码管理页。密码组用于同一平台或系统的多个账号归类，并保存默认密码输出适配策略。内置策略只提供常见密码策略预设，不提供主流平台官方策略；选择内置预设时策略字段应锁定，切换到“自定义当前策略”后才允许基于当前参数调整。自定义策略只能是声明式参数，不能执行用户代码、正则脚本或远程规则。

创建密码和解密密码都需要 loading 状态。解密失败必须给出明确提示，通常提示用户检查关键密钥。

## UI 与依赖约束

尽量保持项目依赖简单。不要引入 UI 组件库；页面样式优先使用项目内 CSS 实现。只有在用户明确要求时才添加新的视觉依赖。

## 验证命令

```bash
npm install
npm run typecheck
npm run test -- <受影响测试文件或 -t 过滤条件>
npm run build
```

当前依赖下载可能需要网络权限。若 `npm install` 失败，先处理依赖安装，再运行上述验证。测试命令应优先使用受影响模块的最小集合；只有跨模块回归或提交前确认需要时，才运行不带过滤的 `npm run test`。

修改文件后不需要启动本地预览项目或进行浏览器预览验证；用户会亲自做这一步。可以运行类型检查、测试和构建，但不要为了视觉检查启动 `npm run dev` 或 `npm run preview`。

## Git 提交规则

Git 提交身份以本文档记录为准，不要在每次提交前重新查询本机 Git 配置。

收到用户要求“提交代码”时，必须先检查本次改动是否需要维护 README 和 AGENTS.md：如果新增或调整了安全边界、交互流程、迁移/存储规则、测试维护经验、提交约定或其他项目上下文，先更新 README 和 AGENTS.md，再执行提交。提交时注意代码颗粒度和提交规范，优先按同一业务目的组织提交，并使用 Conventional Commits。

当前提交身份：

- 用户名：`whynotsnow`
- 邮箱：`whynotsnow@163.com`

只有在需要初始化或更新本文档中的提交身份时，才查询当前电脑的 Git 配置，并把查询结果写回本节。提交时直接读取本节记录的用户名和邮箱，并通过 `git -c user.name=... -c user.email=... commit ...` 使用它们。

Commit message 必须遵循 Conventional Commits，例如 `feat: implement local password workspace`、`fix: handle decrypt failure state`、`docs: update project context`。

## 后续开发红线

- 不添加后端依赖。
- 不添加 UI 组件库。
- 不添加远程规则市场。
- 不执行用户上传的 JavaScript 规则。
- 导入规则只能使用声明式 JSON 映射到允许的内置算法模板，不能导入、拼接、解释或执行代码。
- 不把派生输入或单条密码可重建派生输入的元数据写入 storageData、IndexedDB、localStorage、sessionStorage、URL 或其他文件。例外：空间级 profile 可以保存初始化后的全局 `ruleChain` 和参与规则链的声明式导入规则 manifest，密码条目可以保存非敏感 `spaceId` 用于本地分区，并可保存加密后的 `encrypted_memory_hint`。
- 不把 `dist/` 作为源码提交，除非用户明确要求提交构建产物。
