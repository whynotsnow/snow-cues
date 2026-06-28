# Snow Cues v2.2 Design System / 设计系统

> **Design Authority** — AI agents and contributors MUST read this file before modifying any UI code.
> **设计权威** — AI agent 和贡献者在修改任何 UI 代码前必须读取此文件。
>
> Style: **Swiss Modernism 2.0 × Minimalism**  
> Color mood: **Glacier Blue / 冰川蓝**  
> Generated for: Snow Cues v2.2 — local-first password derivation & encryption system
>
> Replaces the previous warm-earth-tone (Anthropic-inspired) design system from v2.1.

---

## 1. Design Principles / 设计原则

| #   | Principle / 原则                               | Rationale / 理由                                                             |
| --- | ---------------------------------------------- | ---------------------------------------------------------------------------- |
| 1   | **Trust through precision / 精准确立信任**     | Security tools must look exact and intentional. Never ornamental.            |
| 2   | **Clarity over warmth / 清晰优于温暖**         | A password vault is not a lifestyle brand. Cool, neutral, readable.          |
| 3   | **Information hierarchy / 信息层级**           | Swiss style prioritizes content structure. Every surface has a purpose.      |
| 4   | **Less chrome, more content / 少装饰，多内容** | Eliminate visual noise. Shadows and borders serve structure, not decoration. |
| 5   | **Cool confidence / 冷静自信**                 | The "Snow" brand evokes clarity, ice, mountains — crisp and unshakeable.     |
| 6   | **Consistent rhythm / 一致的节奏**             | Systematic spacing, consistent rounding, predictable interactions.           |
| 7   | **Accessible contrast / 无障碍对比度**         | All text meets WCAG AA (4.5:1 minimum). Focus states are visible.            |

---

## 2. Style Reference / 风格参考

| Aspect / 维度         | Choice / 选择                                              | Why / 理由                                             |
| --------------------- | ---------------------------------------------------------- | ------------------------------------------------------ |
| **Primary style**     | Swiss Modernism 2.0                                        | Clean geometry, corporate trust, editorial precision   |
| **Secondary style**   | Minimalism & Swiss Style                                   | Tool interfaces need clear hierarchy, zero distraction |
| **Design philosophy** | "Form follows function"                                    | No decorative elements without structural purpose      |
| **Mood**              | Professional, calm, precise                                | Matches security/privacy product expectations          |
| **Best for**          | Enterprise apps, security tools, dashboards, documentation |                                                        |

### Key Style Characteristics / 关键风格特征

- **Rectilinear precision**: Rounded corners are subtle (0.375–0.5rem), never pillowy
- **Generous whitespace**: Content breathes; sections are clearly separated
- **Single accent**: One primary blue, no competing accent colors
- **Subtle elevation**: Shadows are minimal, used only to distinguish surface layers
- **Crisp borders**: `1px solid` borders define edges; dashed borders signal secondary/optional areas
- **Fast transitions**: 150–200ms; security tools must feel responsive, not sluggish

---

## 3. Color System / 色彩系统

### 3.1 Light Mode / 亮色模式

| Token              | Value                   | Role / 角色                                |
| ------------------ | ----------------------- | ------------------------------------------ |
| `--bg`             | `#F7F8FA`               | Page background / 页面背景                 |
| `--fg`             | `#1A1D23`               | Primary text / 主文字                      |
| `--card`           | `#FFFFFF`               | Card / surface background / 卡片背景       |
| `--card-fg`        | `#1A1D23`               | Card text / 卡片文字                       |
| `--muted`          | `#EEF1F5`               | Secondary surface / 次级表面               |
| `--muted-fg`       | `#5B6370`               | Secondary text / 次要文字                  |
| `--popover`        | `#FFFFFF`               | Popover / elevated surface / 弹出层        |
| `--border`         | `#DDE1E6`               | Borders & dividers / 边框与分割线          |
| `--input`          | `#DDE1E6`               | Input border / 输入框边框                  |
| `--primary`        | `#3E7CB1`               | Primary accent — Glacier Blue / 冰川蓝主色 |
| `--primary-fg`     | `#FFFFFF`               | Text on primary / 主色上文字               |
| `--primary-strong` | `#2F6492`               | Primary hover/active / 主色悬停/激活       |
| `--primary-muted`  | `rgba(62,124,177,0.08)` | Subtle primary background / 主色浅底       |
| `--ring`           | `#3E7CB1`               | Focus ring / 焦点环                        |

**Semantic / 语义色**:

| Token       | Value     | Role           |
| ----------- | --------- | -------------- |
| `--success` | `#2D8A5E` | Success / 成功 |
| `--warning` | `#C2842D` | Warning / 警告 |
| `--error`   | `#C74B4B` | Error / 错误   |
| `--info`    | `#4B7FC7` | Info / 信息    |

**Semantic surfaces / 语义表面色**:

| Semantic | Muted background | Border | Text |
| --- | --- | --- | --- |
| success | `--success-muted: rgba(45,138,94,0.08)` | `--success-border: rgba(45,138,94,0.18)` | `--success-fg: #1E5E40` |
| warning | `--warning-muted: rgba(194,132,45,0.07)` | `--warning-border: rgba(194,132,45,0.22)` | `--warning-fg: #6B4A1E` |
| error | `--error-muted: rgba(199,75,75,0.06)` | `--error-border: rgba(199,75,75,0.2)` | `--error-fg: #6B2E2E` |
| info | `--info-muted: rgba(75,127,199,0.06)` | `--info-border: rgba(75,127,199,0.18)` | `--info-fg: #2D4A78` |

### 3.2 Dark Mode / 暗色模式

| Token              | Value                   | Role / 角色                              |
| ------------------ | ----------------------- | ---------------------------------------- |
| `--bg`             | `#0F1724`               | Page background — Deep Arctic / 深极夜蓝 |
| `--fg`             | `#E8ECF2`               | Primary text / 主文字                    |
| `--card`           | `#1A2332`               | Card / surface / 卡片背景                |
| `--card-fg`        | `#E8ECF2`               | Card text                                |
| `--muted`          | `#243044`               | Secondary surface / 次级表面             |
| `--muted-fg`       | `#8B95A5`               | Secondary text / 次要文字                |
| `--popover`        | `#1A2332`               | Popover / 弹出层                         |
| `--border`         | `#2D3A4E`               | Borders & dividers / 边框                |
| `--input`          | `#2D3A4E`               | Input border / 输入框边框                |
| `--primary`        | `#5B9BD5`               | Primary accent — Ice Blue / 冰蓝主色     |
| `--primary-fg`     | `#FFFFFF`               | Text on primary                          |
| `--primary-strong` | `#4A8BC7`               | Primary hover/active                     |
| `--primary-muted`  | `rgba(91,155,213,0.12)` | Subtle primary background                |
| `--ring`           | `#5B9BD5`               | Focus ring                               |

**Semantic / 语义色 (dark)**:

| Token       | Value     | Role    |
| ----------- | --------- | ------- |
| `--success` | `#40A86E` | Success |
| `--warning` | `#D9A441` | Warning |
| `--error`   | `#D96363` | Error   |
| `--info`    | `#6B9FD9` | Info    |

**Semantic surfaces / 语义表面色 (dark)**:

| Semantic | Muted background | Border | Text |
| --- | --- | --- | --- |
| success | `--success-muted: rgba(64,168,110,0.12)` | `--success-border: rgba(64,168,110,0.3)` | `--success-fg: #8FD7AA` |
| warning | `--warning-muted: rgba(217,164,65,0.12)` | `--warning-border: rgba(217,164,65,0.3)` | `--warning-fg: #F0C978` |
| error | `--error-muted: rgba(217,99,99,0.12)` | `--error-border: rgba(217,99,99,0.3)` | `--error-fg: #F2A0A0` |
| info | `--info-muted: rgba(107,159,217,0.12)` | `--info-border: rgba(107,159,217,0.28)` | `--info-fg: #A8CFF5` |

### 3.3 Notice Backgrounds / 通知背景

Notice backgrounds use the semantic surface tokens:

| Class             | Background             | Border             | Text           |
| ----------------- | ---------------------- | ------------------ | -------------- |
| `.notice-info`    | `var(--info-muted)`    | `var(--info-border)`    | `var(--info-fg)`    |
| `.notice-success` | `var(--success-muted)` | `var(--success-border)` | `var(--success-fg)` |
| `.notice-warning` | `var(--warning-muted)` | `var(--warning-border)` | `var(--warning-fg)` |
| `.notice-error`   | `var(--error-muted)`   | `var(--error-border)`   | `var(--error-fg)`   |

Dark mode notice colors come from the same token names under `:root[data-theme="dark"]`.

### 3.4 Color Usage Rules / 用色规则

- **NEVER** hardcode hex colors in new CSS — always use `var(--token)` references.
- **Semantic tokens** (`--success`, `--warning`, `--error`, `--info`) are ONLY for their semantic purpose.
- **Primary** is used for: primary buttons, focus rings, active nav indicators, eyebrows, badges.
- **Muted surfaces** (`--muted`) are used for: secondary cards, nested panels, code blocks, read-only info grids.
- **Border** is also used for horizontal dividers (`border-top: 1px solid var(--border)`).
- **Info** tone is for neutral informational notices; do NOT use it as a secondary accent color.

---

## 4. Typography / 字体排版

### 4.1 Font Families / 字体族

| Token         | Stack                                                                                                        | Usage                                      |
| ------------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------ |
| `--font-sans` | `"Inter", "SF Pro Display", -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif` | UI text, headings, labels, body / 界面文字 |
| `--font-mono` | `"Fira Code", "JetBrains Mono", "SF Mono", monospace`                                                        | Passwords, codes, hashes, IDs / 密码与代码 |

**Google Fonts import** (in `index.html`):

```html
<link
  href="https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;500&family=Inter:wght@400;500;600;700&display=swap"
  rel="stylesheet"
/>
```

### 4.2 Font Weights / 字重

| Weight            | Usage                                    |
| ----------------- | ---------------------------------------- |
| `400` (regular)   | Body text, descriptions, code blocks     |
| `500` (medium)    | Secondary emphasis                       |
| `600` (semibold)  | Labels, button text, field hints         |
| `700` (bold)      | Headings, strong emphasis, active states |
| `800` (extrabold) | Badges, eyebrows, small caps accents     |

### 4.3 Type Scale / 字号层级

| Role                 | Size      | Weight | Line-height |
| -------------------- | --------- | ------ | ----------- |
| Page title (h1)      | `1.35rem` | `700`  | `1.15`      |
| Section heading (h2) | `1.05rem` | `700`  | `1.25`      |
| Body / description   | `1rem`    | `400`  | `1.5`       |
| Label                | `0.84rem` | `600`  | `1.4`       |
| Field hint / note    | `0.82rem` | `400`  | `1.45`      |
| Badge                | `0.72rem` | `800`  | `1`         |
| Caption / eyebrow    | `0.78rem` | `800`  | `1`         |
| Code / password      | `0.85rem` | `400`  | inherit     |

---

## 5. Spacing / 间距

Systematic spacing scale. All gaps and paddings use values from this scale:

| Token     | Value     | Usage                                     |
| --------- | --------- | ----------------------------------------- |
| `space-1` | `0.25rem` | Icon-to-text gap, tight inline            |
| `space-2` | `0.5rem`  | Button group gap, label-input gap         |
| `space-3` | `0.75rem` | Card content gap, section grid gap        |
| `space-4` | `1rem`    | Section padding, card padding (default)   |
| `space-5` | `1.25rem` | Large section padding, page-level gap     |
| `space-6` | `1.5rem`  | Content scroll padding, major section gap |

**Note**: CSS custom properties for spacing are optional. Use consistent values from this scale. Existing code uses raw values like `0.75rem` directly; continue this pattern for now.

### Content Layout Spacing

| Area                         | Value                 |
| ---------------------------- | --------------------- |
| Content scroll padding       | `1.5rem` (`space-6`)  |
| Section gap (workspace grid) | `0.75rem` (`space-3`) |
| Card internal padding        | `1rem` (`space-4`)    |
| Form field gap               | `0.75rem` (`space-3`) |
| Button group gap             | `0.5rem` (`space-2`)  |

---

## 6. Border Radius / 圆角

Swiss Modernism uses restrained, rectilinear geometry. Maximum radius is 0.75rem.

| Token           | Value      | Usage                                         |
| --------------- | ---------- | --------------------------------------------- |
| `--radius-sm`   | `0.375rem` | Buttons, inputs, small controls               |
| `--radius`      | `0.5rem`   | Default — cards, panels, form controls        |
| `--radius-md`   | `0.5rem`   | Same as `--radius` (kept for backward compat) |
| `--radius-lg`   | `0.625rem` | Larger cards, modals                          |
| `--radius-xl`   | `0.75rem`  | Maximum — special prominent cards only        |
| `--radius-pill` | `999px`    | Badges, chips, theme toggle                   |

**Rule**: Do NOT use `border-radius` values larger than `--radius-xl` (0.75rem). The previous `--radius-2xl` (1.5rem) and `--radius-3xl` (2rem) are **removed**.

---

## 7. Shadows / 阴影

Minimal. Only three elevation levels + a focus/glow ring. No decorative drop shadows.

| Token            | Value                            | Usage                                     |
| ---------------- | -------------------------------- | ----------------------------------------- |
| `--shadow-sm`    | `0 1px 2px rgba(0,0,0,0.06)`     | Subtle surface distinction / 细微表面区分 |
| `--shadow-md`    | `0 2px 8px rgba(0,0,0,0.08)`     | Elevated cards, popovers / 卡片/弹出层    |
| `--shadow-lg`    | `0 4px 16px rgba(0,0,0,0.1)`     | High elevation, modals / 高层级/模态框    |
| `--glow-primary` | `0 0 0 3px rgba(62,124,177,0.2)` | Focus ring glow / 焦点环光晕              |

Dark mode shadows use slightly higher opacity but same structure.

---

## 8. Transitions & Easing / 过渡与缓动

| Token               | Value                        | Usage                                    |
| ------------------- | ---------------------------- | ---------------------------------------- |
| `--ease`            | `cubic-bezier(0, 0, 0.2, 1)` | Standard decelerate (Material Design)    |
| `--duration-fast`   | `150ms`                      | Button hover, focus, active states       |
| `--duration-normal` | `200ms`                      | Panel open/close, card hover             |
| `--duration-slow`   | `300ms`                      | Drawer expand/collapse, page transitions |

**Transition usage rules**:

- **Hover states**: 150ms on `background`, `border-color`, `box-shadow`, `color`
- **Active states**: `transform: scale(0.97)` instant (no transition needed)
- **Drawer/overlay**: 300ms with `--ease`
- **Always respect** `prefers-reduced-motion: reduce` — disable all transitions
- **Never animate** `width`/`height` on non-composited properties; prefer `transform`

---

## 9. Component Specifications / 组件规范

### 9.1 Button / 按钮

| Variant   | Background       | Border          | Text                | Hover                                         |
| --------- | ---------------- | --------------- | ------------------- | --------------------------------------------- |
| Primary   | `var(--primary)` | transparent     | `var(--primary-fg)` | `var(--primary-strong)` bg                    |
| Secondary | `var(--card)`    | `var(--border)` | `var(--fg)`         | `var(--primary-strong)` border, `--shadow-sm` |
| Ghost     | transparent      | transparent     | `var(--fg)`         | `var(--muted)` bg, `var(--border)` border     |

**Base styles**:

```css
button {
  min-height: 2.5rem;
  padding: 0.5rem 0.875rem;
  border-radius: var(--radius-sm); /* 0.375rem */
  font-weight: 600;
  transition:
    background 150ms var(--ease),
    border-color 150ms var(--ease),
    box-shadow 150ms var(--ease);
  cursor: pointer;
}
button:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}
button:focus-visible {
  outline: 2px solid var(--ring);
  outline-offset: 2px;
}
```

**Primary button**:

```css
.primary-button {
  background: var(--primary);
  border-color: transparent;
  color: var(--primary-fg);
  box-shadow: 0 1px 3px rgba(62, 124, 177, 0.25);
}
.primary-button:hover:not(:disabled) {
  background: var(--primary-strong);
}
```

**Sizes**:

- `md` (default): `min-height: 2.5rem`, `padding: 0.5rem 0.875rem`
- `sm`: `min-height: 2.1rem`, `padding: 0.375rem 0.65rem`, `font-size: 0.88rem`

| Component | File                              |
| --------- | --------------------------------- |
| Button    | `src/ui/design-system/Button.tsx` |

### 9.2 Card / 卡片

| Tone              | Background     | Border          | Radius     | Shadow        | Padding   |
| ----------------- | -------------- | --------------- | ---------- | ------------- | --------- |
| Section (default) | `var(--card)`  | `var(--border)` | `--radius` | `--shadow-md` | `1rem`    |
| Subtle            | `var(--muted)` | `var(--border)` | `--radius` | none          | `0.85rem` |

```css
.section-card {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: var(--radius); /* 0.5rem */
  box-shadow: var(--shadow-md);
  padding: 1rem;
}

.ds-card-subtle {
  background: var(--muted);
  border: 1px solid var(--border);
  border-radius: var(--radius); /* 0.5rem */
  padding: 0.85rem;
}
```

**Dashed variant** (for secondary/optional areas):

```css
border: 1px dashed var(--border);
```

| Component | File                            |
| --------- | ------------------------------- |
| Card      | `src/ui/design-system/Card.tsx` |

### 9.3 Input / 输入框

```css
input,
select,
textarea {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm); /* 0.375rem */
  color: var(--fg);
  min-height: 2.5rem;
  padding: 0.5rem 0.7rem;
  width: 100%;
  font: inherit;
}
input:focus,
select:focus,
textarea:focus {
  outline: 2px solid var(--ring);
  outline-offset: 2px;
}
```

**Field label pattern**:

```css
.ds-field {
  display: grid;
  gap: 0.5rem;
}
.ds-field > label {
  color: var(--muted-fg);
  font-size: 0.84rem;
  font-weight: 600;
}
```

| Components                                                        | File                             |
| ----------------------------------------------------------------- | -------------------------------- |
| TextField, NumberField, SelectField, TextareaField, CheckboxField | `src/ui/design-system/Field.tsx` |

### 9.4 Semantic Notices / 语义通知

```css
.notice {
  align-items: center;
  border-radius: var(--radius);
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  justify-content: space-between;
  line-height: 1.5;
  padding: 0.85rem 1rem;
}
```

Each tone has its own background/border/text derived from the matching semantic token. See §3.3 for exact values.

| Component | File                              |
| --------- | --------------------------------- |
| Notice    | `src/ui/design-system/Notice.tsx` |

### 9.5 Navigation / 导航

**Nav Item** (left sidebar):

```css
.nav-item {
  border-radius: var(--radius-sm); /* 0.375rem */
}
.nav-item.active {
  background: var(--card);
  border-color: var(--border);
  box-shadow: var(--shadow-sm);
}
.nav-item.active::before {
  background: var(--primary);
  box-shadow: 0 0 0 3px var(--primary-muted);
  /* 6px × 6px dot indicator */
}
```

**Tabs**:

```css
.tabs {
  background: var(--muted);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 0.35rem;
  gap: 0.35rem;
}
.tabs button {
  border-radius: var(--radius-sm);
  transition: background 150ms var(--ease);
}
.tabs .tab-active {
  background: var(--card);
  border-color: var(--border);
  box-shadow: var(--shadow-sm);
}
```

### 9.6 Badges & Chips / 徽章与标签

```css
.badge {
  border-radius: var(--radius-pill); /* 999px */
  font-size: 0.72rem;
  font-weight: 800;
  padding: 0.24rem 0.5rem;
  white-space: nowrap;
}
```

| Class            | Background             | Border                  | Text Color       |
| ---------------- | ---------------------- | ----------------------- | ---------------- |
| Badge (primary)  | `var(--primary-muted)` | `rgba(62,124,177,0.15)` | `var(--primary)` |
| Badge (dirty)    | `rgba(194,132,45,0.1)` | `rgba(194,132,45,0.22)` | `#6B4A1E`        |
| Badge (clean)    | `rgba(45,138,94,0.08)` | `rgba(45,138,94,0.18)`  | `#1E5E40`        |
| Deprecated badge | `rgba(194,132,45,0.1)` | `rgba(194,132,45,0.22)` | `#6B4A1E`        |

### 9.7 Code & Password Display / 代码与密码展示

```css
.password-display {
  background: var(--muted);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  color: var(--fg);
  font-family: var(--font-mono);
  font-size: 0.85rem;
  min-height: 2.5rem;
  overflow-wrap: anywhere;
  padding: 0.65rem;
}

.inline-code {
  background: var(--muted);
  border-radius: var(--radius-sm);
  font-family: var(--font-mono);
  font-size: 0.82rem;
  padding: 0.15rem 0.4rem;
}
```

### 9.8 Other Design-System Components / 其他基础组件

| Component       | File                                       | Notes                                        |
| --------------- | ------------------------------------------ | -------------------------------------------- |
| SectionHeader   | `src/ui/design-system/SectionHeader.tsx`   | Title + description + trailing actions       |
| ActionGroup     | `src/ui/design-system/ActionGroup.tsx`     | Button groups: default, entry, tool, compact |
| DescriptionList | `src/ui/design-system/DescriptionList.tsx` | Read-only key-value grid                     |
| EmptyState      | `src/ui/design-system/EmptyState.tsx`      | Dashed border placeholder                    |
| Steps           | `src/ui/design-system/Steps.tsx`           | Done/current/blocked step indicators         |

---

## 10. Layout System / 布局系统

### 10.1 App Shell

```
┌────────────────────────────────────────────────────┐
│ System Notice Host (top banner, full width)        │
├──────────┬─────────────────────────────────────────┤
│          │ Storage Data Card (compact, sticky)      │
│ Nav Rail │ ─────────────────────────────────────── │
│  220px   │          │                    ┌───────┐│
│          │  Content │  Main Column       │Guidance││
│  Brand   │  Scroll  │  max-width:1050px  │Drawer  ││
│  Nav     │          │                    │ 300px  ││
│  Status  │          │                    │        ││
│  Actions │          │                    └───────┘│
└──────────┴──────────┴─────────────────────────────┘
```

**Structure**:

- `.app-shell`: `height: 100vh`, `flex-direction: column`, `overflow: hidden`
- `.app-workbench`: `display: grid`, `grid-template-columns: 220px minmax(0, 1fr)`
- `.content-column`: `display: flex`, `flex-direction: column`, `overflow: hidden`
- `.content-scroll`: `flex: 1`, `overflow-y: auto`, `padding: 1.5rem`
- `.content-area`: `display: flex`, `justify-content: safe center`
- `.main-column`: `flex: 1`, `max-width: 1050px`, `min-width: 0`

**Nav Rail**:

```css
.nav-rail {
  background: var(--card);
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1.25rem 1rem;
  overflow-y: auto;
}
```

**Guidance Drawer**:

```css
.guidance-drawer.expanded {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: var(--shadow-lg);
  width: 300px;
}
```

### 10.2 Responsive Breakpoint / 响应式断点

**Single breakpoint: `max-width: 960px`**

At mobile:

- Nav rail becomes full-width, horizontal layout
- Content column loses overflow constraints
- All multi-column grids collapse to single column
- Guidance drawer becomes static full-width
- Storage data compact card goes full-width

### 10.3 Max Width Constraints

| Element                                 | Max Width              |
| --------------------------------------- | ---------------------- |
| Main column                             | `1050px`               |
| Form fields (`.form-stack label`)       | `560px`                |
| Form textareas (`.form-stack textarea`) | `760px`                |
| Verification selector                   | `560px`                |
| Decrypt secret field                    | `calc(50% - 0.375rem)` |

---

## 11. Dark Mode / 暗色模式

### 11.1 Mechanism

```html
<html data-theme="dark"></html>
```

- Toggle: `src/ui/components/ThemeToggle.tsx`
- Persistence: `localStorage` key `sc-theme`
- Default: respects `prefers-color-scheme: dark`, falls back to `"light"`
- CSS: `:root[data-theme="dark"]` overrides all color tokens

### 11.2 Dark Mode Color Scheme

```css
:root[data-theme="dark"] {
  color-scheme: dark;
  /* All color tokens overridden — see §3.2 */
}
```

### 11.3 PWA Theme Colors

```html
<!-- index.html -->
<meta
  name="theme-color"
  content="#3E7CB1"
  media="(prefers-color-scheme: light)"
/>
<meta
  name="theme-color"
  content="#0F1724"
  media="(prefers-color-scheme: dark)"
/>
```

### 11.4 Dark Mode Specific Rules

- **Background**: Deep arctic blue (`#0F1724`), NOT pure black (`#000`)
- **Surface distinction**: Use `--card` and `--muted` with 1px borders; shadows are less visible in dark mode
- **Primary**: Lightened to `#5B9BD5` for visibility
- **Text contrast**: All text must maintain 4.5:1 minimum against its background
- **Code blocks**: `--muted` background with `--border` border
- **Notice backgrounds**: Slightly higher opacity than light mode (dark backgrounds absorb less)

---

## 12. Anti-Patterns / 反模式

| #   | Anti-Pattern                                          | Reason / 原因                                                            |
| --- | ----------------------------------------------------- | ------------------------------------------------------------------------ |
| 1   | **AI purple/pink gradients**                          | Destroys trust for a security product; looks like a toy, not a vault     |
| 2   | **Bright neon colors**                                | Disrupts the calm, professional mood; harms readability                  |
| 3   | **Glassmorphism / heavy transparency**                | Security tools should feel solid and opaque, not see-through             |
| 4   | **Excessive border-radius (> 0.75rem)**               | Pillowy shapes contradict Swiss precision and security tool expectations |
| 5   | **Decorative box-shadows**                            | Shadows should serve surface hierarchy, not ornament                     |
| 6   | **Emojis as icons**                                   | Use SVG icons (Lucide or Heroicons); emojis look unprofessional          |
| 7   | **Animations > 300ms**                                | Security tools need responsive, instant-feeling interactions             |
| 8   | **Pure black (#000) in dark mode**                    | Use `#0F1724` — deep blue-black is easier on eyes                        |
| 9   | **Hardcoded hex colors**                              | Always reference `var(--token)` from this design system                  |
| 10  | **Low contrast text**                                 | Minimum 4.5:1 for body text; 3:1 for large text (≥18px bold)             |
| 11  | **Missing focus states**                              | Every interactive element must have visible `:focus-visible` styling     |
| 12  | **Animating layout properties**                       | Never animate `width`, `height`, `top`, `left`; use `transform`          |
| 13  | **New CSS without light+dark coverage**               | Every new color usage must have a dark mode override                     |
| 14  | **Significant visual divergence from this Design.md** | This file is the single source of truth; deviations must be approved     |

---

## 13. Pre-Implementation Checklist / 实施前检查清单

Before marking any UI change as complete:

- [ ] No hardcoded hex colors — all colors use `var(--token)`
- [ ] Light mode and dark mode both tested
- [ ] Text contrast ≥ 4.5:1 (use browser DevTools accessibility panel)
- [ ] Focus states visible for keyboard navigation
- [ ] `cursor: pointer` on all clickable elements (buttons, links, interactive cards)
- [ ] Hover states with smooth transitions (150–200ms)
- [ ] `prefers-reduced-motion: reduce` respected
- [ ] Responsive: tested at 375px, 768px, 1024px, 1440px
- [ ] No border-radius values exceed `--radius-xl` (0.75rem)
- [ ] No emojis used as icons
- [ ] `npm run typecheck` passes
- [ ] `npm run test` passes
- [ ] No changes to security boundaries or data flow

---

## 14. Migration Notes / 迁移注意事项

### 14.1 From v2.1 (Warm Earth-Tone) to v2.2 (Glacier Blue)

| Change        | Old                            | New                    |
| ------------- | ------------------------------ | ---------------------- |
| Primary color | `hsl(15, 65%, 52%)` terracotta | `#3E7CB1` glacier blue |
| Background    | `hsl(38, 28%, 91%)` warm cream | `#F7F8FA` ice white    |
| Card          | `hsl(35, 22%, 85%)` beige      | `#FFFFFF` pure white   |
| Dark bg       | `hsl(40, 15%, 12%)` olive      | `#0F1724` arctic night |
| Max radius    | `2rem`                         | `0.75rem`              |
| Card radius   | `1.5rem`                       | `0.5rem`               |
| Button radius | `0.75rem`                      | `0.375rem`             |
| Shadows       | 4-layer soft shadows           | 3-layer minimal        |
| PWA theme     | `#d25636` / `#3a2f24`          | `#3E7CB1` / `#0F1724`  |

### 14.2 Files to Update

| File                    | Changes                                              |
| ----------------------- | ---------------------------------------------------- |
| `src/styles.css`        | Full token replacement + style updates               |
| `index.html`            | PWA theme-color meta tags                            |
| `vite.config.ts`        | PWA manifest colors                                  |
| `public/icons/icon.svg` | Recolor from terracotta to glacier blue              |
| `src/ui/design-system/` | No API changes needed; components consume CSS tokens |

### 14.3 Implementation Order

1. Update CSS custom properties in `:root` and `:root[data-theme="dark"]`
2. Replace all `var(--radius-2xl)` → `var(--radius)` and `var(--radius-3xl)` → `var(--radius-xl)`
3. Update shadow tokens
4. Update PWA theme colors in `index.html` and `vite.config.ts`
5. Regenerate icons (`npm run generate-icons`)
6. Run `npm run validate`
7. Visual review by human

### 14.4 Implementation Status / 实施状态

> ⚠️ **截至 v2.3 规划时，v2.1 → v2.2 的迁移尚未落地到代码。**
>
> `src/styles.css` 中的 CSS token 取值仍为 v2.1 warm-earth-tone（陶土橙）体系；`index.html` 和 `vite.config.ts` 的 PWA theme-color 仍为陶土橙/暖橄榄棕；`--radius-2xl` / `--radius-3xl` 仍在代码中定义且被大量引用；`--error` token 缺失；`--primary-muted` 缺失。
>
> `src/ui/design-system/README.md` 中已包含本实施状态备忘，指向本文件（Design.md）与 `docs/v2.3-plan.md` 为权威。后续 Agent 读到此备忘时应以 Design.md 为目标状态，不要把过渡取值当作设计意图。
>
> v2.3 阶段 1 负责完成 §14.3 的全部步骤，将本文件定义的 token 值真正写入代码。

---

## 15. Version History / 版本历史

| Version | Date       | Changes                                                                                                   |
| ------- | ---------- | --------------------------------------------------------------------------------------------------------- |
| 2.2.0   | 2026-06-26 | Complete redesign: Swiss Modernism 2.0 × Minimalism, Glacier Blue palette, reduced radii, minimal shadows |
| 2.1.0   | (prior)    | Warm earth-tone design system (Anthropic-inspired)                                                        |

---

_End of Design System — all UI changes must conform to this document._
