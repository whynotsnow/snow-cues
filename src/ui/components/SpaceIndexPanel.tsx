import { useEffect, useState } from "react";
import { spaceStatusLabels } from "../appTypes";
import { ActionGroup, Button, Card, DescriptionList, SectionHeader, SelectField, TextareaField, TextField } from "../design-system";
import { formatSpaceRelationLabel } from "../displayLabels";
import type { AppController } from "../useAppController";

type SpaceIndexPanelProps = {
  controller: AppController;
};

export function SpaceIndexPanel({ controller }: SpaceIndexPanelProps) {
  const {
    spaceIndexItems,
    outsideShowCreateSpaceOptions,
    setOutsideShowCreateSpaceOptions,
    outsideCreateMode,
    setOutsideCreateMode,
    outsideCreateTargetSpaceId,
    setOutsideCreateTargetSpaceId,
    outsideCloneSourceSpaceId,
    setOutsideCloneSourceSpaceId,
    outsideImportText,
    setOutsideImportText,
    handleOutsideCreateSpaceByMode,
    handleEnterSpace,
    refreshSpaceIndex,
    loggingIn,
    storageDataOpened,
    storageDataDirty,
    storageDataMode,
    storageDataId,
    storageDataRevision,
    storageDataUpdatedAt,
    storageDataSaveSummary,
    storageDataDownloadText,
    storageDataDraftText,
    storageDataCompareSummary,
    storageDataCompareWarning,
    handleCreateStorageData,
    handleOpenStorageDataText,
    handleOpenStorageDataFolder,
    handlePrepareStorageDataSave,
    handleConfirmStorageDataSave,
    handleCancelStorageDataSave,
    handleExportStorageDataDraft,
    handleCompareStorageDataText
  } = controller;
  const [compareLeft, setCompareLeft] = useState("");
  const [compareRight, setCompareRight] = useState("");
  const needsSourceSpace = outsideCreateMode === "clone_profile" || outsideCreateMode === "clone_with_entries";
  const needsImportText = outsideCreateMode === "import_profile" || outsideCreateMode === "import_with_entries";

  useEffect(() => {
    void refreshSpaceIndex();
  }, [refreshSpaceIndex]);

  return (
    <section className="rules-section" aria-label="空间外工作台">
      <Card aria-label="存储数据文件夹">
        <SectionHeader
          actions={
            <ActionGroup variant="tool">
              <Button onClick={() => void handleCreateStorageData()}>新建存储数据文件夹</Button>
              <Button onClick={() => void handleOpenStorageDataFolder()}>打开存储数据文件夹</Button>
            </ActionGroup>
          }
          description="Snow Cues 2.0 以你维护的存储数据文件夹作为唯一业务数据源。打开和保存前请先确认 Syncthing 已完成同步。"
          title="存储数据"
        />
        <div className="form-stack">
          <TextField
            label="打开 current.json（下载新版模式）"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) {
                void file.text().then((text) => handleOpenStorageDataText(text));
              }
            }}
            type="file"
          />
          {storageDataOpened ? (
            <>
              <DescriptionList
                items={[
                  { label: "存储数据 ID", value: storageDataId },
                  { label: "当前 revision", value: String(storageDataRevision) },
                  { label: "最近保存", value: storageDataUpdatedAt ? new Date(storageDataUpdatedAt).toLocaleString("zh-CN", { hour12: false }) : "未保存" },
                  { label: "保存模式", value: storageDataMode === "direct-folder" ? "直接保存" : "下载新版" },
                  { label: "未保存状态", value: storageDataDirty ? "有未保存改动" : "无未保存改动" }
                ]}
              />
              <ActionGroup variant="tool">
                <Button disabled={!storageDataDirty} onClick={() => handlePrepareStorageDataSave()} variant="primary">
                  保存存储数据
                </Button>
                <Button disabled={!storageDataDirty} onClick={() => void handleExportStorageDataDraft()}>
                  导出未保存草稿
                </Button>
              </ActionGroup>
              {storageDataSaveSummary ? (
                <Card tone="subtle" aria-label="保存摘要">
                  <SectionHeader description="摘要不会展示密文、关键密钥、平台或备注全文。" title="保存前摘要" />
                  <p className="login-note">{formatSummary(storageDataSaveSummary)}</p>
                  <ActionGroup variant="tool">
                    <Button onClick={() => void handleConfirmStorageDataSave()} variant="primary">确认保存</Button>
                    <Button onClick={() => handleCancelStorageDataSave()}>取消</Button>
                  </ActionGroup>
                </Card>
              ) : null}
              {storageDataDownloadText ? (
                <TextareaField
                  label="生成的新版 current.json"
                  onChange={() => undefined}
                  value={storageDataDownloadText}
                />
              ) : null}
              {storageDataDraftText ? (
                <TextareaField
                  label="未保存草稿文件内容"
                  onChange={() => undefined}
                  value={storageDataDraftText}
                />
              ) : null}
            </>
          ) : (
            <p className="login-note">尚未打开存储数据。打开后才会显示空间索引；浏览器 IndexedDB 中的旧数据不会作为业务真源。</p>
          )}
        </div>
      </Card>

      <Card aria-label="比较两个存储数据文件">
        <SectionHeader
          description="比较工具只展示摘要差异，不会修改任何文件，也不会自动合并 Syncthing 冲突。"
          title={storageDataOpened ? "比较其他存储数据文件" : "比较两个存储数据文件"}
        />
        <div className="form-stack">
          <TextField
            label="文件 A"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) {
                void file.text().then(setCompareLeft);
              }
            }}
            type="file"
          />
          <TextField
            label="文件 B"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) {
                void file.text().then(setCompareRight);
              }
            }}
            type="file"
          />
          <ActionGroup variant="tool">
            <Button disabled={!compareLeft || !compareRight} onClick={() => void handleCompareStorageDataText(compareLeft, compareRight)}>
              比较摘要
            </Button>
          </ActionGroup>
          {storageDataCompareWarning ? <p className="login-note">{storageDataCompareWarning}</p> : null}
          {storageDataCompareSummary ? <p className="login-note">{formatSummary(storageDataCompareSummary)}</p> : null}
        </div>
      </Card>

      {!storageDataOpened ? null : (
        <>
      <Card aria-label="空间外创建空间">
        <SectionHeader
          actions={
            <Button onClick={() => setOutsideShowCreateSpaceOptions(!outsideShowCreateSpaceOptions)}>
              {outsideShowCreateSpaceOptions ? "收起创建方式" : "新建空间"}
            </Button>
          }
          description="选择创建方式，创建完成后会直接进入空间主页。空间主密码将在空间内执行校验或敏感操作时输入。"
          title="创建空间"
        />
        {outsideShowCreateSpaceOptions ? (
          <div className="form-stack">
            <SelectField label="创建方式" onChange={(event) => setOutsideCreateMode(event.target.value as typeof outsideCreateMode)} value={outsideCreateMode}>
              <option value="blank">空白创建</option>
              <option value="clone_profile">从已有的空间 clone 配置</option>
              <option value="clone_with_entries">从已有的空间 clone 配置 + 密码迁移队列</option>
              <option value="import_profile">从导入文件创建空间</option>
              <option value="import_with_entries">从导入文件创建空间 + 密码迁移队列</option>
            </SelectField>
            <TextField
              autoComplete="off"
              label="目标存储空间 ID"
              onChange={(event) => setOutsideCreateTargetSpaceId(event.target.value)}
              placeholder="例如 personal-next"
              value={outsideCreateTargetSpaceId}
            />
            {needsSourceSpace ? (
              <SelectField label="来源存储空间" onChange={(event) => setOutsideCloneSourceSpaceId(event.target.value)} value={outsideCloneSourceSpaceId}>
                <option value="">选择已有空间</option>
                {spaceIndexItems.map(({ space }) => (
                  <option key={space.spaceId} value={space.spaceId}>
                    {space.spaceId} · {spaceStatusLabels[space.status]}
                  </option>
                ))}
              </SelectField>
            ) : null}
            {needsImportText ? (
              <TextareaField
                label="导入 JSON"
                onChange={(event) => setOutsideImportText(event.target.value)}
                placeholder='{"format":"snow-cues-space-export","version":1,...}'
                value={outsideImportText}
              />
            ) : null}
            <ActionGroup variant="tool">
              <Button onClick={() => void handleOutsideCreateSpaceByMode()}>
                创建并进入空间
              </Button>
            </ActionGroup>
          </div>
        ) : null}
      </Card>

      <Card className="space-index-section" aria-label="本地空间索引">
        <SectionHeader
          description="这里仅展示本地空间元数据，不需要空间主密码。"
          title="本地空间索引"
        />
        {spaceIndexItems.length > 0 ? (
          <div className="space-index-grid">
            {spaceIndexItems.map(({ space, relations }) => (
              <Card as="article" className="space-index-card" key={space.spaceId} tone="subtle">
                <DescriptionList
                  items={[
                    { label: "空间 ID", value: space.spaceId },
                    { label: "空间状态", value: spaceStatusLabels[space.status] },
                    { label: "更新时间", value: formatLocalTime(space.updatedAt) },
                    {
                      label: "空间关系",
                      value: relations.length > 0
                        ? relations.map((relation) => formatSpaceRelationLabel(relation.fromSpaceId, relation.toSpaceId, relation.type)).join("；")
                        : "无"
                    }
                  ]}
                />
                <ActionGroup variant="entry">
                  <Button
                    disabled={loggingIn}
                    onClick={() => void handleEnterSpace({ spaceId: space.spaceId })}
                    variant="primary"
                  >
                    {loggingIn ? "进入中..." : "进入空间"}
                  </Button>
                </ActionGroup>
              </Card>
            ))}
          </div>
        ) : (
          <p className="login-note">当前浏览器还没有本地空间记录。</p>
        )}
      </Card>
        </>
      )}

    </section>
  );
}

function formatLocalTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString("zh-CN", {
    hour12: false
  });
}

function formatSummary(summary: {
  addedSpaces: number;
  modifiedSpaceStatus: number;
  addedPasswordEntries: number;
  modifiedPasswordEntries: number;
  deprecatedPasswordEntries: number;
  modifiedMemoryHints: number;
  addedPasswordGroups: number;
  modifiedPasswordGroups: number;
  deletedPasswordGroups: number;
  changedRuleProfiles: number;
  changedMigrationBatches: number;
  changedMigrationEntries: number;
}): string {
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
