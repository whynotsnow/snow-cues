import { ActionGroup, Button, Card, SectionHeader } from "../design-system";
import { formatStorageDataSummary } from "../storageDataSummary";
import type { AppController } from "../useAppController";

type StorageDataSaveControlsProps = {
  controller: AppController;
};

export function StorageDataSaveControls({
  controller
}: StorageDataSaveControlsProps) {
  const {
    storageDataDirty,
    storageDataDownloadPackage,
    storageDataSaveSummary,
    handleCancelStorageDataSave,
    handleConfirmStorageDataSave,
    handleExportStorageDataDraft,
    handlePrepareStorageDataSave
  } = controller;

  return (
    <div className="storage-save-controls" aria-label="存储数据保存操作">
      <ActionGroup variant="tool">
        <Button
          disabled={!storageDataDirty}
          onClick={() => handlePrepareStorageDataSave()}
          variant="primary"
        >
          保存存储数据
        </Button>
        <Button
          disabled={!storageDataDirty}
          onClick={() => void handleExportStorageDataDraft()}
        >
          导出未保存草稿
        </Button>
      </ActionGroup>

      {storageDataSaveSummary ? (
        <Card tone="subtle" aria-label="保存摘要">
          <SectionHeader
            description="摘要不会展示密文、关键密钥、平台或备注全文。"
            title="保存前摘要"
          />
          <p className="login-note">
            {formatStorageDataSummary(storageDataSaveSummary)}
          </p>
          <ActionGroup variant="tool">
            <Button
              onClick={() => void handleConfirmStorageDataSave()}
              variant="primary"
            >
              确认保存存储数据
            </Button>
            <Button onClick={() => handleCancelStorageDataSave()}>取消</Button>
          </ActionGroup>
        </Card>
      ) : null}

      {storageDataDownloadPackage ? (
        <Card tone="subtle" aria-label="下载保存包">
          <SectionHeader
            description={
              storageDataDownloadPackage.desktopScriptsIncluded
                ? "桌面保存包包含固定脚本模板。先编辑 storageData-path.txt，再运行对应系统脚本。"
                : "移动端保存包不包含脚本。请按 README 手动放置 current 和 revision 文件。"
            }
            title="保存包已生成"
          />
          <a
            className="download-link primary-button"
            download={storageDataDownloadPackage.fileName}
            href={storageDataDownloadPackage.downloadUrl}
          >
            下载保存包 .zip
          </a>
        </Card>
      ) : null}
    </div>
  );
}
