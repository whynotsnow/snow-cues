import { useState } from "react";
import {
  ActionGroup,
  Button,
  Card,
  SectionHeader,
  TextField
} from "../design-system";
import { formatStorageDataSummary } from "../storageDataSummary";
import type { AppController } from "../useAppController";

type StorageDataCompareToolProps = {
  controller: AppController;
  conflictMode?: boolean;
};

export function StorageDataCompareTool({
  controller,
  conflictMode = false
}: StorageDataCompareToolProps) {
  const {
    storageDataCompareSummary,
    storageDataCompareWarning,
    handleCompareStorageDataText
  } = controller;
  const [compareLeft, setCompareLeft] = useState("");
  const [compareRight, setCompareRight] = useState("");

  return (
    <Card className="storage-compare-block" aria-label="比较两个存储数据文件">
      <SectionHeader
        description={
          conflictMode
            ? "检测到当前存储数据可能已被其他设备更新。选择当前 current.json 与本次草稿或冲突文件，先比较摘要差异再决定如何处理。"
            : "比较工具只展示摘要差异，不会修改文件，也不会自动合并 Syncthing 冲突。"
        }
        title="比较两个存储数据文件"
      />
      <div className="field-grid">
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
      </div>
      <ActionGroup variant="tool">
        <Button
          disabled={!compareLeft || !compareRight}
          onClick={() =>
            void handleCompareStorageDataText(compareLeft, compareRight)
          }
        >
          比较摘要
        </Button>
      </ActionGroup>
      {storageDataCompareWarning ? (
        <p className="login-note">{storageDataCompareWarning}</p>
      ) : null}
      {storageDataCompareSummary ? (
        <p className="login-note">
          {formatStorageDataSummary(storageDataCompareSummary)}
        </p>
      ) : null}
    </Card>
  );
}
