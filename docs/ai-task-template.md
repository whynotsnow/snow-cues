# Codex 任务模板 / AI Task Template

## 普通功能修改模板

```md
目标：
用 1-3 句话描述要完成的用户可见行为或代码行为。

请先读取：

- AGENTS.md
- docs/product-rules.md
- docs/coding-rules.md

允许修改：

- src/ui/...
- src/...
- 相关测试文件

禁止修改：

- 与本任务无关的模块
- storage schema
- 安全边界

验收：

- npm run typecheck
- npm run test -- <受影响测试文件或 -t 过滤条件>
- npm run build

最后汇报：

- 改了哪些行为
- 跑了哪些验证
- 是否有未覆盖风险
```

## 安全或存储相关修改模板

```md
目标：
描述要调整的安全、加密、session、storageData 或字段白名单行为。

请先读取：

- AGENTS.md
- docs/security-boundaries.md
- docs/architecture.md
- docs/coding-rules.md

允许修改：

- src/session-manager/...
- src/crypto-engine/...
- src/recovery-aid/...
- src/storage-data/...
- 对应测试文件

禁止修改：

- UI 文案或流程，除非任务明确要求
- 未经说明的新持久化字段
- 任何可重建 `entrySecret` 或派生输入的结构化数据

验收：

- npm run typecheck
- npm run test -- <受影响测试文件或 -t 过滤条件>
- npm run build

最后汇报：

- 是否改变存储格式或安全边界
- 是否新增/删除持久化字段
- 跑了哪些验证
- 是否需要更新 AGENTS.md 或 docs
```
