import { useEffect } from "react";
import { spaceStatusLabels } from "../appTypes";
import {
  ActionGroup,
  Button,
  Card,
  DescriptionList,
  SectionHeader,
  SelectField,
  TextareaField,
  TextField
} from "../design-system";
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
    storageDataOpened
  } = controller;
  const needsSourceSpace =
    outsideCreateMode === "clone_profile" ||
    outsideCreateMode === "clone_with_entries";
  const needsImportText =
    outsideCreateMode === "import_profile" ||
    outsideCreateMode === "import_with_entries";

  useEffect(() => {
    void refreshSpaceIndex();
  }, [refreshSpaceIndex]);

  if (!storageDataOpened) {
    return null;
  }

  return (
    <section className="rules-section" aria-label="空间外工作台">
      <Card aria-label="空间外创建空间">
        <SectionHeader
          actions={
            <Button
              onClick={() =>
                setOutsideShowCreateSpaceOptions(!outsideShowCreateSpaceOptions)
              }
            >
              {outsideShowCreateSpaceOptions ? "收起创建方式" : "新建空间"}
            </Button>
          }
          description="选择创建方式，创建完成后会直接进入空间主页。空间主密码将在空间内执行校验或敏感操作时输入。"
          title="创建空间"
        />
        {outsideShowCreateSpaceOptions ? (
          <div className="form-stack">
            <SelectField
              label="创建方式"
              onChange={(event) =>
                setOutsideCreateMode(
                  event.target.value as typeof outsideCreateMode
                )
              }
              value={outsideCreateMode}
            >
              <option value="blank">空白创建</option>
              <option value="clone_profile">从已有的空间 clone 配置</option>
              <option value="clone_with_entries">
                从已有的空间 clone 配置 + 密码迁移队列
              </option>
              <option value="import_profile">从导入文件创建空间</option>
              <option value="import_with_entries">
                从导入文件创建空间 + 密码迁移队列
              </option>
            </SelectField>
            <TextField
              autoComplete="off"
              label="目标存储空间 ID"
              onChange={(event) =>
                setOutsideCreateTargetSpaceId(event.target.value)
              }
              placeholder="例如 personal-next"
              value={outsideCreateTargetSpaceId}
            />
            {needsSourceSpace ? (
              <SelectField
                label="来源存储空间"
                onChange={(event) =>
                  setOutsideCloneSourceSpaceId(event.target.value)
                }
                value={outsideCloneSourceSpaceId}
              >
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
              <Card
                as="article"
                className="space-index-card"
                key={space.spaceId}
                tone="subtle"
              >
                <DescriptionList
                  items={[
                    { label: "空间 ID", value: space.spaceId },
                    {
                      label: "空间状态",
                      value: spaceStatusLabels[space.status]
                    },
                    {
                      label: "空间数据更新时间",
                      value: formatLocalTime(space.updatedAt)
                    },
                    {
                      label: "空间关系",
                      value:
                        relations.length > 0
                          ? relations
                              .map((relation) =>
                                formatSpaceRelationLabel(
                                  relation.fromSpaceId,
                                  relation.toSpaceId,
                                  relation.type
                                )
                              )
                              .join("；")
                          : "无"
                    }
                  ]}
                />
                <ActionGroup variant="entry">
                  <Button
                    disabled={loggingIn}
                    onClick={() =>
                      void handleEnterSpace({ spaceId: space.spaceId })
                    }
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
    </section>
  );
}

function formatLocalTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString("zh-CN", {
    hour12: false
  });
}
