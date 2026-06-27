# UI Design System 摸底与维护说明

## 当前 UI 现状

Snow Cues v2.3 当前是纯前端、本地优先应用，UI 由 React 组件和 `src/styles.css` 手写样式组成，没有第三方 UI 组件库。应用外壳是三栏工作台：左侧导航与 storageData / 空间状态，中间 hash 路由页面，右侧全局用户操作指引。

现有 UI 组件主要分布在 `src/ui/components/`、`src/ui/pages/` 和 `src/ui/notifications/`。当前主要表单、卡片、按钮组和只读信息展示已开始通过 `src/ui/design-system/` 组合；少量业务专用结构仍保留原 class，以便后续在不改业务流程的前提下继续收敛。

## 已识别的基础构件

- 按钮：普通按钮、主按钮、紧凑按钮、通知动作按钮。
- 表单：文本输入、密码输入、数字输入、下拉框、多行文本、复选框，以及 label + hint 模式。
- 卡片：`section-card`、`rule-card`、`entry-card`、`password-group-card`、`space-index-card`、`guidance-card` 等多套近似结构。
- 通知：系统通知、页面通知、区域反馈和浮动操作反馈，底层已由 `Notice` 承载。
- 布局：三栏工作台、页面主区域、按钮组、双列表单网格。
- 只读信息：`entry-readonly-grid` 被条目、空间索引等场景复用。
- 空状态：`.empty-state` 用于列表为空。
- 步骤指引：右侧 Guidance 使用步骤列表展示下一步、已完成和受阻状态。

## 设计 token 方向

当前已在 `src/styles.css` 中落地完整的 warm-earth-tone 设计 token 体系（基于 Anthropic 品牌灵感），并通过 legacy alias 保持现有 `var(--color-*)` 引用兼容。

核心 token 语义：

| Token              | 亮色                 | 暗色                 | 角色              |
| ------------------ | -------------------- | -------------------- | ----------------- |
| `--bg`             | `hsl(38, 28%, 91%)`  | `hsl(40, 15%, 12%)`  | 页面背景          |
| `--fg`             | `hsl(30, 15%, 15%)`  | `hsl(35, 20%, 88%)`  | 主文字            |
| `--card`           | `hsl(35, 22%, 85%)`  | `hsl(38, 12%, 18%)`  | 卡片/表面         |
| `--muted`          | `hsl(35, 20%, 87%)`  | `hsl(38, 10%, 22%)`  | 次级表面          |
| `--muted-fg`       | `hsl(30, 12%, 38%)`  | `hsl(35, 15%, 55%)`  | 次要文字          |
| `--border`         | `hsl(35, 18%, 80%)`  | `hsl(38, 10%, 25%)`  | 边框/分割线       |
| `--primary`        | `hsl(15, 65%, 52%)`  | `hsl(15, 65%, 58%)`  | 主色调（赤陶橙）  |
| `--primary-strong` | `hsl(15, 70%, 42%)`  | `hsl(15, 65%, 50%)`  | 主色 hover/active |
| `--success`        | `hsl(142, 71%, 38%)` | `hsl(142, 60%, 50%)` | 成功语义          |
| `--warning`        | `hsl(38, 92%, 45%)`  | `hsl(38, 90%, 58%)`  | 警告语义          |
| `--info`           | `hsl(220, 70%, 50%)` | `hsl(220, 75%, 65%)` | 信息语义          |

已落地的 token 类别：

- 颜色：页面背景、卡片面、弱背景、边框、正文、弱正文、主色、语义色（success / warning / info），全量亮色 + 暗色覆盖。
- 圆角：`--radius: 0.75rem` 为基准，`--radius-sm` 到 `--radius-3xl`（2rem）共 5 级。
- 阴影：`--shadow-sm` / `--shadow-md` / `--shadow-lg` / `--glow-primary` 四级。
- 缓动：`--ease: cubic-bezier(0, 0, 0.2, 1)`（Material Design decelerate）。
- 字体：`--font-sans`（Inter + 系统回退 + 中文回退）、`--font-mono`（Fira Code + 回退）。

暗色模式通过 `<html data-theme="dark">` 切换，由 `src/ui/components/ThemeToggle.tsx` 控制，偏好持久化到 `localStorage` key `sc-theme`。

新增样式时，必须使用语义 token（如 `var(--border)`、`var(--muted-fg)`），禁止新增长期硬编码 hex 颜色。

## 组件分层规则

- `src/ui/design-system/` 只放内部基础组件，不发布 npm 包，不引入第三方 UI 库。
- 基础组件不得引入业务 controller、WebCrypto、storageData / IndexedDB 兼容层、规则注册表、空间 policy 或存储模块。
- 基础组件只处理展示、语义、可访问性和轻量交互状态，例如 disabled、loading、label、hint。
- 业务组件负责组合基础组件并传入 handler，不把密码生成、解密、迁移、空间校验逻辑下沉到基础层。
- 新增 UI 模式前先判断是否可用现有基础组件组合；确实重复出现的展示模式再进入 design-system。

## 当前组件清单

- `Button`：统一主按钮、普通按钮、ghost 按钮、紧凑按钮和 loading 状态。
- `Card`：统一 section 级卡片基础外观，可通过外部组合标题和操作区。
- `SectionHeader`：统一区块标题、说明和右侧操作。
- `TextField`、`TextareaField`、`SelectField`、`NumberField`、`CheckboxField`：统一 label、hint、禁用态和输入控件结构。
- `ActionGroup`：统一普通、条目、工具和紧凑按钮组。
- `Notice`：从现有通知组件转出，保持通知语义和业务文案不变。
- `EmptyState`：统一列表空状态。
- `DescriptionList`：统一只读元数据网格。
- `Steps`：统一 Guidance 步骤列表。

## 迁移状态与路线

已完成：

- 基础层落地：已建立 design-system、README、barrel export 和最小渲染测试。
- 中间层迁移：规则管理、新建密码、密码组、输出策略字段、空间索引、游离密码、空间概览和测试工具已迁入基础组件。
- 复杂业务卡片迁移：`EntryCard`、迁移情况卡片和迁移条目卡片已替换基础展示件，业务 handler、门禁表达式和安全流程保持在原业务层。
- Token 体系落地：全局颜色、圆角、阴影、缓动、字体已通过 CSS 自定义属性统一管理，支持亮/暗双主题，所有硬编码 hex 颜色已替换为语义 token 引用。

后续路线：

1. 把 `GuidancePanel` 的卡片和步骤进一步迁到 `Card`、`Steps` 等基础组件。
2. 需要明显改变视觉风格时，先扩展 token 和组件 variant，再改业务页面。

## 维护与升级要求

- UI 重构不得改变安全边界：不得新增持久化敏感字段，不改变 entrySecret、master password、会话 key、迁移 session 的生命周期。
- 迁移时保持现有文案、按钮可用性、handler 调用顺序和测试前置条件。
- 每迁移一个页面或业务卡片，运行对应 UI 测试；每个阶段至少运行 `npm run typecheck`。
- 复杂组件继续演进时优先拆展示，再替换基础件，不在同一变更里重写业务流程。
