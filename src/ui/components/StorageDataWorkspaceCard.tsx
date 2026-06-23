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
import { StorageDataSaveControls } from "./StorageDataSaveControls";

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
    storageDataMode,
    storageDataId,
    storageDataRevision,
    storageDataUpdatedAt,
    storageDataDownloadText,
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
    ? "打开和保存前请先确认 Syncthing 已完成同步。"
    : canUseCoreCrypto
      ? "已进入空间。为了避免会话与文件内容错位，切换或重新加载存储数据前需要先离开空间。"
      : "当前运行环境缺少核心加密能力，不能打开或创建存储数据。";

  if (!outsideSpace) {
    const compactItems = [
      { label: "数据集", value: formatCompactStorageDataId(storageDataId) },
      {
        label: "revision",
        value: storageDataOpened ? String(storageDataRevision) : "无"
      },
      {
        label: "保存模式",
        value:
          storageDataMode === "direct-folder"
            ? "直接保存"
            : storageDataMode === "download"
              ? "下载新版"
              : "待选择"
      },
      {
        label: "改动",
        value: storageDataDirty ? "未保存" : "已同步",
        tone: storageDataDirty ? "dirty" : "clean"
      }
    ];

    return (
      <Card
        className="storage-data-card storage-data-card-compact"
        aria-label="当前存储数据文件"
      >
        <div className="storage-data-compact-header">
          <div>
            <h2>存储数据</h2>
            <p>空间内已锁定当前加载文件；如需切换，请先离开空间。</p>
          </div>
          <span className="storage-data-lock-badge">空间内锁定</span>
        </div>
        <div className="storage-data-compact-body">
          <dl className="storage-data-compact-list">
            {compactItems.map((item) => (
              <div
                className={
                  item.tone
                    ? `storage-data-compact-item storage-data-compact-item-${item.tone}`
                    : "storage-data-compact-item"
                }
                key={item.label}
              >
                <dt>{item.label}</dt>
                <dd>{item.value}</dd>
              </div>
            ))}
          </dl>
          {storageDataOpened ? (
            <StorageDataSaveControls controller={controller} />
          ) : null}
        </div>
      </Card>
    );
  }

  return (
    <Card className="storage-data-card" aria-label="当前存储数据文件">
      <SectionHeader
        actions={
          <ActionGroup variant="tool">
            <Button
              disabled={!canChangeLoadedStorageData}
              onClick={() => void handleCreateStorageData()}
            >
              新建存储数据文件夹
            </Button>
            <Button
              disabled={!canUseFolderAccess}
              onClick={() => void handleOpenStorageDataFolder()}
            >
              打开存储数据文件夹
            </Button>
          </ActionGroup>
        }
        description={`Snow Cues 2.1 以你维护的 storageData 文件夹作为唯一业务数据源。${changeLockedHint}`}
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
              tone: "warning",
              title: "文件夹直接保存不可用",
              body: browserCapabilities.storageFolderAccessUnavailableMessage
            }}
          />
        ) : null}
        <TextField
          disabled={!canChangeLoadedStorageData}
          hint={
            !canUseCoreCrypto
              ? "当前环境不支持安全加密能力，无法读取或校验 current.json。"
              : !canChangeLoadedStorageData
                ? "请先离开空间，再更换或重新加载 current.json。"
                : undefined
          }
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
                {
                  label: "最近保存",
                  value: storageDataUpdatedAt
                    ? new Date(storageDataUpdatedAt).toLocaleString("zh-CN", {
                        hour12: false
                      })
                    : "未保存"
                },
                {
                  label: "保存模式",
                  value:
                    storageDataMode === "direct-folder"
                      ? "直接保存"
                      : "下载新版"
                },
                {
                  label: "改动状态",
                  value: storageDataDirty ? "有未保存改动" : "已同步到当前草稿"
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
