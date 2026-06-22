import { spaceStatusLabels } from "../../appTypes";
import { Card, DescriptionList, SectionHeader } from "../../design-system";
import { formatSpaceRelationLabel } from "../../displayLabels";
import type { AppController } from "../../useAppController";

type SpaceOverviewCardProps = {
  controller: AppController;
};

export function SpaceOverviewCard({ controller }: SpaceOverviewCardProps) {
  const {
    currentSpaceId,
    currentSpaceStatus,
    currentSpaceIsTemporary,
    ruleProfileConfirmed,
    spaceRelations
  } = controller;

  return (
    <Card aria-label="空间概览">
      <SectionHeader
        description="这里汇总当前空间详情、迁移情况和当前空间操作。"
        title="空间主页"
      />
      <DescriptionList
        items={[
          { label: "当前空间", value: currentSpaceId },
          {
            label: "空间状态",
            value: currentSpaceIsTemporary
              ? "临时空间，尚未持久化"
              : spaceStatusLabels[currentSpaceStatus]
          },
          {
            label: "规则链",
            value: ruleProfileConfirmed ? "已初始化" : "未初始化"
          }
        ]}
      />
      {currentSpaceIsTemporary ? (
        <div className="effective-rule">
          <span>临时空间</span>
          <strong>当前空间尚未写入本地空间索引</strong>
          <small>
            初始化规则链或创建第一条密码后，才会持久保存空间 profile
            和空间记录。
          </small>
        </div>
      ) : null}
      {spaceRelations.length > 0 ? (
        <div className="effective-rule">
          <span>空间指向关系</span>
          <strong>
            {spaceRelations
              .map((relation) =>
                formatSpaceRelationLabel(
                  relation.fromSpaceId,
                  relation.toSpaceId,
                  relation.type
                )
              )
              .join("；")}
          </strong>
          <small>关系只用于展示来源和接替，不跨空间继承密钥或密码条目。</small>
        </div>
      ) : (
        <div className="effective-rule">
          <span>空间指向关系</span>
          <strong>无</strong>
          <small>当前空间没有记录来源或接替关系。</small>
        </div>
      )}
    </Card>
  );
}
