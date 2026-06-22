import { storageDataFileToDownloadUrl } from "../../storage-data";
import { ActionGroup, Button, Card, SectionHeader } from "../design-system";
import { formatStorageDataSummary } from "../storageDataSummary";
import type { AppController } from "../useAppController";

type StorageDataSaveControlsProps = {
  controller: AppController;
};

export function StorageDataSaveControls({ controller }: StorageDataSaveControlsProps) {
  const {
    storageDataDirty,
    storageDataDownloadText,
    storageDataMode,
    storageDataSaveSummary,
    handleCancelStorageDataSave,
    handleConfirmStorageDataSave,
    handleExportStorageDataDraft,
    handlePrepareStorageDataSave
  } = controller;
  const saveActionLabel = storageDataMode === "direct-folder" ? "保存到文件夹" : "生成新版 current.json";
  const confirmActionLabel = storageDataMode === "direct-folder" ? "确认保存到文件夹" : "确认生成新版 current.json";
  const downloadUrl = storageDataDownloadText ? storageDataFileToDownloadUrl(storageDataDownloadText) : "";

  return (
    <div className="storage-save-controls" aria-label="存储数据保存操作">
      <ActionGroup variant="tool">
        <Button disabled={!storageDataDirty} onClick={() => handlePrepareStorageDataSave()} variant="primary">
          {saveActionLabel}
        </Button>
        <Button disabled={!storageDataDirty} onClick={() => void handleExportStorageDataDraft()}>
          导出未保存草稿
        </Button>
      </ActionGroup>

      {storageDataSaveSummary ? (
        <Card tone="subtle" aria-label="保存摘要">
          <SectionHeader description="摘要不会展示密文、关键密钥、平台或备注全文。" title="保存前摘要" />
          <p className="login-note">{formatStorageDataSummary(storageDataSaveSummary)}</p>
          <ActionGroup variant="tool">
            <Button onClick={() => void handleConfirmStorageDataSave()} variant="primary">
              {confirmActionLabel}
            </Button>
            <Button onClick={() => handleCancelStorageDataSave()}>取消</Button>
          </ActionGroup>
        </Card>
      ) : null}

      {downloadUrl ? (
        <a className="download-link primary-button" download="current.json" href={downloadUrl}>
          下载 current.json
        </a>
      ) : null}
    </div>
  );
}
