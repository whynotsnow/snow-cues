# 安全边界 / Security Boundaries

## 禁止持久化

- 不持久化 `master_password`。
- 不持久化 `entrySecret`（关键密钥）；`runtime_salt` 是旧命名，也不得进入存储。
- 不持久化 `entrySecret` 的可逆副本、`encrypted_entry_secret`、明文 `memory_hint`、关键密钥模板或可被系统自动拼接成关键密钥的结构化字段。
- 不持久化密码校验材料。进入空间不会因为校验失败被阻止。
- 单条密码不持久化 `ruleId`、scene/context 或任何可重建派生输入的元数据。
- 空间外“游离密码”不得持久化派生密钥、游离规则输入、预览结果、生成历史或可重建材料，也不得写入迁移队列。
- 不把派生输入或单条密码可重建派生输入的元数据写入 `storageData`、IndexedDB、localStorage、sessionStorage、URL 或其他文件。

允许的例外：

- 空间级 profile 可以保存初始化后的全局 `ruleChain` 和参与规则链的声明式导入规则 manifest。
- 密码条目可以保存非敏感 `spaceId` 用于本地分区。
- 允许保存用户自愿填写的 `encrypted_memory_hint`，但它必须加密保存，不参与密码生成，不参与密码解密，不被系统解析，也不能用于自动恢复 `entrySecret`。

## Session 与 key 生命周期

- `createSession(masterPassword)` 使用 PBKDF2-SHA256，迭代次数为 `310_000`。
- 会话派生两个 non-extractable key：`cryptoKey` 是 HMAC-SHA256 signing key，`storageKey` 是 AES-GCM key。
- Session 中的 `CryptoKey` 必须是 non-extractable，并且只保存在内存中。
- 当前条目加密实际使用 `deriveRuntimeStorageKey(liveSession.cryptoKey, entrySecret)` 生成的临时 AES-GCM key；不要退回只使用 `session.storageKey` 加密条目。
- 默认空闲超时为 5 分钟，绝对超时为 30 分钟。过期或离开空间时会清空敏感 UI 状态、条目列表和会话引用。
- 所有敏感操作都通过 `withLiveSession` 包装执行：先检查会话是否过期，若过期则调用 `leaveSpace` 拒绝操作；若存活则 `touchSession` 续期空闲计时器，再将 live session 引用传给回调。
- 迁移期间的来源空间 session 只保存在内存中，用于解密旧空间密文；离开空间、切换迁移批次、过期或完成迁移后必须清除。

## WebCrypto 与安全上下文

- Snow Cues 核心密码学链路必须依赖浏览器原生 WebCrypto：PBKDF2、HMAC-SHA256、AES-GCM、SHA-256 和 non-extractable `CryptoKey`。不得用纯 JavaScript 密码学库替代核心链路，也不得为了兼容非安全上下文降低 key 生命周期边界。
- 导入规则的 `algorithm` 必须映射到源码/构建期已注册的算法模板。`params` 只能包含算法模板允许的公开、非秘密参数，不得保存 `master_password`、`entrySecret`、平台、账号、scene/context、远程 URL、代码片段、表达式或任何单条密码可重建派生输入。官方构建只包含经过项目维护者审计的注册算法；自部署扩展算法属于自部署构建责任，不得通过运行时导入、URL 参数、`storageData` 或远程配置动态加载任意算法代码。
- 正式推荐通过 Cloudflare Pages HTTPS 地址运行，以满足移动端浏览器对 WebCrypto 安全上下文的要求。Cloudflare Pages 只分发静态前端代码，不保存用户 `storageData`、主密码、关键密钥或业务数据。
- `crypto.randomUUID` 缺失可以退回到基于 `crypto.getRandomValues()` 的 UUID v4 生成，因为这不改变核心密码学边界；不得退回到 `Math.random()`。
- `crypto.subtle` 缺失不可降级继续执行。应用应在启动或执行敏感操作前检测并给出中文阻断提示，引导用户使用 Cloudflare Pages HTTPS 正式地址、已安装 PWA 或受信任的 `localhost` / `127.0.0.1` 环境。
- 普通局域网 HTTP、移动端 App 内置浏览器和直接打开打包 HTML 文件可能缺少 `crypto.subtle` 或 File System Access API，不作为安全可靠的正式运行环境。

## 密码生成与加密

- `generatePasswordWithRuleChain` 要求非空 `entrySecret` 和至少一条规则。
- 规则链按顺序执行，上一条规则的输出作为下一条规则的输入材料，最后再按编码策略输出。
- `generateDetachedPassword` 用派生密钥临时导入 non-extractable HMAC key，并固定使用默认内置规则链生成空间外预览材料；它不创建 session，不读写存储，不支持空间外导入规则。
- 输出编码支持 `base62`、`base64` 和 `custom`。自定义字符集会去重，且至少需要两个不同字符。
- `mapBytesToCharset` 使用 `byte % charset.length` 的逐字节模运算映射到字符集。这种简单映射不保证密码学均匀分布，仅用于将规则输出的 base64 材料转为目标字符集。
- `decodeRuleMaterial` 先尝试 base64 解码，失败时回退到 UTF-8 编码。规则输出必须先产生可被 base64 解码的材料，当前所有内置规则输出都是 base64。
- 默认输出长度是 24，UI 允许 8 到 64。
- 密码输出必须先用 AES-GCM 加密，再进入 `storageData`。
- `encryptPassword` 使用 AES-GCM，随机 12 字节 IV，存储格式是 `base64(iv + ciphertext)`。
- `decryptPassword` 会拆出前 12 字节作为 IV，剩余部分作为 ciphertext；解密失败时 UI 应提示检查关键密钥。

## 记忆提示安全

- `encryptMemoryHint(session, spaceId, entryId, memoryHint)` 会 trim 提示文本，空提示不生成 `encrypted_memory_hint`。
- `decryptMemoryHint(session, spaceId, entryId, encryptedMemoryHint)` 只依赖当前空间会话能力，不要求用户输入 `entrySecret`。
- 记忆提示使用 AES-GCM 和随机 12 字节 IV，存储格式为 `base64(iv + ciphertext)`。
- 不同 `master_password`、`spaceId` 或 `entryId` 都不能互相解密提示。
- 记忆提示是敏感字段，显示、编辑和清除都必须由用户显式触发。

## storageData 边界

- 2.1 正式文件格式为 `format: "snow-cues-storage-data"`、`schemaVersion: 1`。草稿文件格式为 `format: "snow-cues-storage-data-draft"`、`schemaVersion: 1`。主打开流程必须拒绝 draft 文件。
- `storageDataId` 是数据集 ID，不等于单个 `spaceId`。`spaceId` 仍只是数据集内的本地分区标识，不是派生输入。
- `contentHash` 使用 canonical JSON + WebCrypto SHA-256，格式为 `sha256:<hex>`，计算时必须排除 `contentHash` 自身。
- 文件夹结构为 `current.json`、`revisions/`、`drafts/`、`conflicts/`。第一版不创建 `manifest.json`，不保存 `deviceId`、`updatedBy` 或 `updatedByLabel`。
- 新建 `storageData` 默认生成 revision `1`，并写入初始 `current.json`。
- 直接保存模式必须先写 `revisions/storage-data-rev-xxxxxx.json`，成功后再更新 `current.json`。
- 保存前必须重读 `current.json`，用打开时的 revision/hash 检测外部变化。若检测到变化，必须拒绝覆盖，保留内存草稿，并将本次待保存的正式文件写入 `conflicts/` 作为冲突候选版本。
- 下载模式生成 zip 保存包，由用户手动放置文件，或在桌面端使用保存包内固定脚本模板辅助复制。应用不自动写入同步文件夹。
- 桌面保存包脚本模板必须来自 `src/storage-data/save-package-templates/`，页面只把模板原样打入 zip，不动态拼接脚本逻辑。脚本只能读取同目录 `manifest.json`、`storageData-path.txt`、候选文件和目标 `storageData/current.json` 的 `revision/contentHash`，匹配后才覆盖 `current.json` 并写入 `revisions/`；不匹配时只能写入 `conflicts/`，不得覆盖当前文件。脚本不得联网、不得读取主密码或关键密钥、不得扫描无关目录、不得删除 `current.json` 或 `conflicts/`。
- 移动端或类移动端保存包不得包含 `.sh`、`.command`、`.ps1` 等可执行脚本。
- 安全摘要 diff 和比较工具只展示集合数量级摘要，不展示密文字段、明文秘密或隐私元数据全文。只读比较工具不得合并、不得写文件。
- 旧 IndexedDB 模块不再作为业务真源。残留旧浏览器数据不得出现在 2.1 UI 业务流；清空或忽略 IndexedDB 不应影响通过 `storageData` 打开的业务状态。

## 字段白名单

`storageData` 正式文件、revision 和 draft 中的密码条目只允许保存 `PasswordEntry` 中定义的字段：

- `id`
- `spaceId`
- `encrypted_password`
- `encrypted_memory_hint`
- `groupId`
- `platform`
- `description`
- `deprecatedAt`
- `createdAt`
- `updatedAt`

`PasswordGroup` 当前字段为：

- `id`
- `spaceId`
- `name`
- `description`
- `outputPolicy`
- `createdAt`
- `updatedAt`

维护要求：

- `allowedStorageFields`、`sanitizePasswordEntry` 与 `sanitizeStorageDataContent` 是存储边界的重要保护。
- 新增字段前必须确认是否违反安全边界，并同步测试。
- `groupId` 只是 UI 归属，不参与密码生成、解密或输出适配。
- `outputPolicy` 是解密后的输出适配策略，不参与核心密码生成。
- `spaceProfiles` 按 `spaceId` 保存空间级 profile：`spaceId`、`ruleChain`、`importedRuleManifests`、`createdAt`、`updatedAt`。
- `migrationBatches` 和 `migrationEntries` 保存迁移队列，与正式 `PasswordEntry` 分离。待迁移条目保存旧空间密文和非敏感元数据，不得直接出现在正式密码列表中。

## PWA Service Worker 缓存边界

Snow Cues 的 Service Worker 采用 Workbox `generateSW` 生成，仅缓存 `workbox.globPatterns` 中列出的静态应用外壳资源（JS、CSS、HTML、字体、图标）。以下数据**永远不会**进入 SW 的 Cache API：

- 用户的 `storageData`（`current.json`、`revisions/`、`drafts/`、`conflicts/` 等文件）。`storageData` 始终由 File System Access API 按需读写，驻留在用户本机磁盘上。
- `master_password`、`entrySecret`、派生的 `CryptoKey`、Session 中的 `cryptoKey` 和 `storageKey`。密钥只保存在浏览器内存（non-extractable `CryptoKey`），绝不会被 SW 缓存。
- `encrypted_password`、`encrypted_memory_hint`、密码校验材料或任何可重建派生输入的元数据。

SW 的 `prompt` 更新模式保证：新版 Service Worker 只在后台安装，不会自动 `skipWaiting`；只有用户点击“立即刷新”后才激活。进行中的解密会话绝不会因 SW 自动更新而中断。该设计确保了会话安全性与代码可更新性之间的平衡。
