import type { StorageDataSaveSummary } from "../storage-data";

export function formatStorageDataSummary(summary: StorageDataSaveSummary): string {
  const items = [
    ["新增空间", summary.addedSpaces],
    ["修改空间状态", summary.modifiedSpaceStatus],
    ["新增密码条目", summary.addedPasswordEntries],
    ["修改密码条目", summary.modifiedPasswordEntries],
    ["废弃密码条目", summary.deprecatedPasswordEntries],
    ["修改记忆提示", summary.modifiedMemoryHints],
    ["新增密码组", summary.addedPasswordGroups],
    ["修改密码组", summary.modifiedPasswordGroups],
    ["删除密码组", summary.deletedPasswordGroups],
    ["规则链/profile 变化", summary.changedRuleProfiles],
    ["迁移批次状态变化", summary.changedMigrationBatches],
    ["迁移条目状态变化", summary.changedMigrationEntries]
  ].filter(([, count]) => Number(count) > 0);
  return items.length > 0 ? items.map(([label, count]) => `${label}：${count}`).join("；") : "无业务改动";
}
