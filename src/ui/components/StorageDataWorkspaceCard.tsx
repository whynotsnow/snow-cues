import {
  ActionGroup,
  Button,
  Card,
  DescriptionList,
  SectionHeader,
  TextareaField,
  TextField
} from "../design-system";
import { Notice } from "../notifications/Notice";
import type { AppController } from "../useAppController";
import {
  StorageDataSaveControls,
  StorageDataSaveFeedback
} from "./StorageDataSaveControls";

type StorageDataWorkspaceCardProps = {
  controller: AppController;
};

export function StorageDataWorkspaceCard({
  controller
}: StorageDataWorkspaceCardProps) {
  const {
    outsideSpace,
    storageDataOpened,
    storageDataDirty,
    storageDataId,
    storageDataRevision,
    storageDataUpdatedAt,
    storageDataDraftText,
    browserCapabilities,
    handleCreateStorageData,
    handleOpenStorageDataText,
    handleOpenStorageDataFolder
  } = controller;
  const canUseCoreCrypto = browserCapabilities.coreCryptoAvailable;
  const canChangeLoadedStorageData = outsideSpace && canUseCoreCrypto;
  const canUseFolderAccess =
    canChangeLoadedStorageData &&
    browserCapabilities.storageFolderAccessAvailable;
  const changeLockedHint = canChangeLoadedStorageData
    ? "打开和保存前请先确认外部同步已完成。"
    : canUseCoreCrypto
      ? "已进入空间。为了避免会话与文件内容错位，切换或重新加载存储数据前需要先离开空间。"
      : "当前运行环境缺少核心加密能力，不能打开或创建存储数据。";
  const savedAtText = formatStorageDataSavedAt(storageDataUpdatedAt);
  const dirtyStatusText = storageDataDirty ? "有未保存改动" : "已同步";

  if (!outsideSpace) {
    const compactItems = [
      {
        label: "数据集",
        value: (
          <span title={storageDataId || "未打开"}>
            {formatCompactStorageDataId(storageDataId)}
          </span>
        )
      },
      {
        label: "revision",
        value: storageDataOpened ? String(storageDataRevision) : "无"
      },
      {
        label: "最近保存",
        value: savedAtText
      },
      {
        label: "加载状态",
        value: "空间内已锁定"
      }
    ];

    return (
      <Card
        className="storage-data-card storage-data-card-compact"
        aria-label="当前存储数据文件"
      >
        <div className="storage-data-card-header">
          <div>
            <h2>存储数据</h2>
            <p>空间内已锁定当前加载文件；如需切换，请先离开空间。</p>
          </div>
          <div className="storage-data-status-group">
            <span
              className="storage-data-status-badge storage-data-status-locked"
              aria-label="加载状态：空间内锁定"
            >
              空间内锁定
            </span>
            <span
              className={
                storageDataDirty
                  ? "storage-data-status-badge storage-data-status-dirty"
                  : "storage-data-status-badge storage-data-status-clean"
              }
              aria-label={`改动状态：${dirtyStatusText}`}
            >
              {dirtyStatusText}
            </span>
          </div>
        </div>
        <div className="storage-data-layout">
          <DescriptionList
            className="storage-data-meta-grid storage-data-meta-grid-compact"
            items={compactItems}
          />
          {storageDataOpened ? (
            <StorageDataSaveControls controller={controller} />
          ) : null}
        </div>
        <StorageDataSaveFeedback controller={controller} />
      </Card>
    );
  }

  return (
    <Card className="storage-data-card" aria-label="当前存储数据文件">
      <SectionHeader
        actions={
          <div className="storage-data-header-tools">
            {storageDataOpened ? (
              <span
                className={
                  storageDataDirty
                    ? "storage-data-status-badge storage-data-status-dirty"
                    : "storage-data-status-badge storage-data-status-clean"
                }
                aria-label={`改动状态：${dirtyStatusText}`}
              >
                {dirtyStatusText}
              </span>
            ) : null}
            <ActionGroup variant="tool">
              <Button
                disabled={!canChangeLoadedStorageData}
                onClick={() => void handleCreateStorageData()}
              >
                新建存储数据
              </Button>
              {browserCapabilities.storageFolderAccessAvailable ? (
                <Button
                  disabled={!canUseFolderAccess}
                  onClick={() => void handleOpenStorageDataFolder()}
                >
                  打开存储数据
                </Button>
              ) : null}
            </ActionGroup>
          </div>
        }
        description={`Snow Cues 2.3 以你维护的 storageData 文件夹作为唯一业务数据源。${changeLockedHint}`}
        title="存储数据"
      />
      <div className="form-stack">
        {!canUseCoreCrypto ? (
          <Notice
            notice={{
              scope: "action",
              tone: "error",
              title: "当前环境不支持安全加密",
              body: browserCapabilities.coreCryptoUnavailableMessage
            }}
          />
        ) : null}
        {canUseCoreCrypto &&
        !browserCapabilities.storageFolderAccessAvailable ? (
          <Notice
            notice={{
              scope: "action",
              tone: "info",
              title: "当前使用文件导入导出",
              body: browserCapabilities.storageFolderAccessUnavailableMessage
            }}
          />
        ) : null}
        {!browserCapabilities.storageFolderAccessAvailable ? (
          <TextField
            disabled={!canChangeLoadedStorageData}
            hint={
              !canUseCoreCrypto
                ? "当前环境不支持安全加密能力，无法读取或校验 current.json。"
                : !canChangeLoadedStorageData
                  ? "请先离开空间，再更换或重新加载 current.json。"
                  : undefined
            }
            label="导入 current.json"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) {
                void file
                  .text()
                  .then((text) => handleOpenStorageDataText(text));
              }
            }}
            type="file"
          />
        ) : null}
        {storageDataOpened ? (
          <>
            <div className="storage-data-card-header storage-data-card-header-opened">
              <div>
                <h3>当前文件</h3>
                <p>保存前请确认外部同步已完成；空保存会被拒绝。</p>
              </div>
            </div>
            <div className="storage-data-layout">
              <DescriptionList
                className="storage-data-meta-grid"
                items={[
                  { label: "存储数据 ID", value: storageDataId },
                  {
                    label: "revision",
                    value: String(storageDataRevision)
                  },
                  {
                    label: "最近保存",
                    value: savedAtText
                  },
                  {
                    label: "加载状态",
                    value: canChangeLoadedStorageData
                      ? "可更换文件"
                      : "空间内已锁定"
                  }
                ]}
              />
              <StorageDataSaveControls controller={controller} />
            </div>
            <StorageDataSaveFeedback controller={controller} />
            {storageDataDraftText ? (
              <div className="storage-data-feedback">
                <TextareaField
                  className="storage-data-draft-field"
                  label="未保存草稿文件内容"
                  onChange={() => undefined}
                  value={storageDataDraftText}
                />
              </div>
            ) : null}
          </>
        ) : (
          <p className="login-note">
            尚未打开存储数据。打开后才会显示空间索引；浏览器 IndexedDB
            中的旧数据不会作为业务真源。
          </p>
        )}
      </div>
    </Card>
  );
}

function formatCompactStorageDataId(storageDataId: string): string {
  if (!storageDataId) {
    return "未打开";
  }
  if (storageDataId.length <= 22) {
    return storageDataId;
  }
  return `${storageDataId.slice(0, 14)}...${storageDataId.slice(-6)}`;
}

function formatStorageDataSavedAt(updatedAt: string | null): string {
  return updatedAt
    ? new Date(updatedAt).toLocaleString("zh-CN", {
        hour12: false
      })
    : "未保存";
}
