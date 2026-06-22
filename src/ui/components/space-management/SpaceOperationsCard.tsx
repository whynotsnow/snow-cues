import { ActionGroup, Button, Card, SectionHeader, SelectField, TextareaField, TextField } from "../../design-system";
import type { AppController } from "../../useAppController";

type SpaceOperationsCardProps = {
  controller: AppController;
};

export function SpaceOperationsCard({ controller }: SpaceOperationsCardProps) {
  const {
    exportText,
    spaceOperationMode,
    setSpaceOperationMode,
    createTargetSpaceId,
    setCreateTargetSpaceId,
    handleCurrentSpaceOperation
  } = controller;
  const needsTargetSpace = spaceOperationMode === "clone_current_profile" || spaceOperationMode === "clone_current_with_entries";
  const actionLabel = spaceOperationMode === "export_profile" || spaceOperationMode === "export_full"
    ? "生成导出 JSON"
    : spaceOperationMode
      ? "创建并进入目标空间"
      : "执行当前空间操作";

  return (
    <Card aria-label="当前空间操作">
      <SectionHeader
        description="这些操作只针对当前已进入空间。clone 完成后会直接进入目标空间主页，再输入空间主密码建立目标空间会话。"
        title="当前空间操作"
      />
      <div className="form-stack">
        <SelectField label="操作方式" onChange={(event) => setSpaceOperationMode(event.target.value as typeof spaceOperationMode)} value={spaceOperationMode}>
          <option value="">选择当前空间操作</option>
          <option value="clone_current_profile">clone 当前空间配置到新的空间</option>
          <option value="clone_current_with_entries">从当前的空间 clone 配置 + 密码迁移队列</option>
          <option value="export_profile">导出当前空间配置 JSON</option>
          <option value="export_full">导出当前空间完整备份 JSON</option>
        </SelectField>
        {needsTargetSpace ? (
          <TextField
            autoComplete="off"
            label="目标存储空间 ID"
            onChange={(event) => setCreateTargetSpaceId(event.target.value)}
            placeholder="例如 personal-next"
            value={createTargetSpaceId}
          />
        ) : null}
        <ActionGroup variant="tool">
          <Button disabled={!spaceOperationMode} onClick={() => void handleCurrentSpaceOperation()}>
            {actionLabel}
          </Button>
        </ActionGroup>
      </div>
      {exportText ? (
        <TextareaField label="导出结果" readOnly value={exportText} />
      ) : null}
    </Card>
  );
}
