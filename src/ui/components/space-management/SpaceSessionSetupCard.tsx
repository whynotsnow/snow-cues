import { useState } from "react";
import {
  ActionGroup,
  Button,
  Card,
  SectionHeader,
  TextField
} from "../../design-system";
import type { AppController } from "../../useAppController";

type SpaceSessionSetupCardProps = {
  controller: AppController;
};

export function SpaceSessionSetupCard({
  controller
}: SpaceSessionSetupCardProps) {
  const { currentSpaceIsTemporary, migrationBatches, handleStartSpaceSession } =
    controller;
  const [spaceMasterPassword, setSpaceMasterPassword] = useState("");
  const hasMigrationQueue = migrationBatches.length > 0;

  async function submitSpaceMasterPassword() {
    const established = await handleStartSpaceSession(spaceMasterPassword);
    if (established) {
      setSpaceMasterPassword("");
    }
  }

  return (
    <Card aria-label="设置空间主密码">
      <SectionHeader
        description={
          hasMigrationQueue
            ? "这个目标空间已经带入配置和迁移队列。请先设置本次空间主密码，再继续开启迁移或写入正式密码条目。"
            : currentSpaceIsTemporary
              ? "这是新的临时空间。请先设置本次空间主密码，再初始化规则链或创建第一条密码。"
              : "当前空间还没有可用于校验的密码条目。请先设置本次空间主密码，再继续管理空间。"
        }
        title="设置空间主密码"
      />
      <div className="form-stack">
        <TextField
          autoComplete="new-password"
          label="空间主密码"
          onChange={(event) => setSpaceMasterPassword(event.target.value)}
          placeholder="仅用于当前浏览器会话，不会保存"
          type="password"
          value={spaceMasterPassword}
        />
        <ActionGroup variant="tool">
          <Button
            disabled={!spaceMasterPassword.trim()}
            onClick={() => void submitSpaceMasterPassword()}
          >
            建立空间会话
          </Button>
        </ActionGroup>
      </div>
    </Card>
  );
}
