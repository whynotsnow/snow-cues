import type { AppPage } from "./appTypes";
import type { AppController } from "./useAppController";

export type GuidanceStepStatus = "done" | "current" | "blocked" | "pending";

export type GuidanceStep = {
  label: string;
  status: GuidanceStepStatus;
};

export type GuidanceAction =
  | { type: "navigate"; label: string; targetPage: AppPage }
  | { type: "open-create-space"; label: string }
  | { type: "open-create-password"; label: string };

export type GuidanceCardStatus = "active" | "ready" | "blocked";

export type GuidanceCard = {
  id: string;
  priority: number;
  title: string;
  body: string;
  status: GuidanceCardStatus;
  steps: GuidanceStep[];
  primaryAction?: GuidanceAction;
  secondaryAction?: GuidanceAction;
  blockedReason?: string;
};

export type UserGuidance = {
  cards: GuidanceCard[];
};

type GuidanceInput = Pick<
  AppController,
  | "activePage"
  | "currentSpaceStatus"
  | "entries"
  | "migrationBatches"
  | "migrationEntries"
  | "outsideSpace"
  | "pendingDetachedEntrySecret"
  | "ruleProfileConfirmed"
  | "selectedMigrationBatch"
  | "sessionAlive"
  | "currentSpaceId"
  | "sourceSessionVerified"
  | "spaceIndexItems"
  | "spaceRelations"
  | "verificationPending"
>;

const guidancePriority = {
  spaceRestriction: 100,
  spaceVerification: 90,
  sessionRequired: 85,
  ruleSetup: 80,
  migration: 70,
  detachedImport: 60,
  regularWork: 40
};

const setupSteps: GuidanceStep[] = [
  { label: "新建或进入空间", status: "current" },
  { label: "设置空间主密码", status: "pending" },
  { label: "初始化规则链", status: "pending" },
  { label: "创建第一条密码", status: "pending" }
];

export function getUserGuidance(input: GuidanceInput): UserGuidance {
  const cards = input.outsideSpace
    ? buildOutsideSpaceGuidance(input)
    : [
        buildSpaceRestrictionGuidance(input),
        buildDeprecatedSpaceDecryptGuidance(input),
        buildSpaceVerificationGuidance(input),
        buildSessionGuidance(input),
        buildRuleSetupGuidance(input),
        buildMigrationGuidance(input),
        buildReadySpaceGuidance(input)
      ].filter((card): card is GuidanceCard => Boolean(card));

  return {
    cards: cards.sort((a, b) => b.priority - a.priority)
  };
}

function buildOutsideSpaceGuidance(input: GuidanceInput): GuidanceCard[] {
  if (input.pendingDetachedEntrySecret) {
    return [
      {
        id: "detached-import",
        priority: guidancePriority.detachedImport,
        title: "迁移游离密码草稿",
        body: "游离密码只保存在当前页面内存中。进入目标空间后，需要按目标空间稳定规则链正式生成并保存。",
        status: "active",
        steps: [
          { label: "生成游离密码", status: "done" },
          { label: "进入目标空间", status: "current" },
          { label: "保存为正式密码", status: "pending" }
        ],
        primaryAction: { type: "open-create-space", label: "展开创建空间入口" }
      }
    ];
  }

  if (input.activePage === "detached") {
    return [
      {
        id: "detached-preview",
        priority: guidancePriority.regularWork,
        title: "生成临时游离密码",
        body: "在这里可以先做空间外临时预览。派生密钥和预览结果不会保存；需要长期使用时，再迁入目标空间保存为正式密码。",
        status: "active",
        steps: [
          { label: "输入派生密钥", status: "current" },
          { label: "生成临时预览", status: "pending" },
          { label: "按需迁入空间", status: "pending" }
        ],
        secondaryAction: { type: "open-create-space", label: "回到空间工作台" }
      }
    ];
  }

  if (input.spaceIndexItems.length === 0) {
    return [
      {
        id: "space-start",
        priority: guidancePriority.regularWork,
        title: "开始使用本地密码空间",
        body: "当前浏览器还没有本地空间记录。先创建一个空间，再设置空间主密码、初始化规则链并创建第一条密码。",
        status: "active",
        steps: setupSteps,
        primaryAction: { type: "open-create-space", label: "展开新建空间入口" }
      }
    ];
  }

  return [
    {
      id: "space-select",
      priority: guidancePriority.regularWork,
      title: "选择一个空间继续",
      body: "从本地空间索引进入已有空间，或创建新的空间。空间外只展示元数据，不会读取已保存密码条目。",
      status: "active",
      steps: [
        { label: "选择本地空间", status: "current" },
        { label: "完成必要校验", status: "pending" },
        { label: "管理密码", status: "pending" }
      ],
      primaryAction: { type: "open-create-space", label: "展开新建空间入口" }
    }
  ];
}

function buildSpaceRestrictionGuidance(input: GuidanceInput): GuidanceCard | null {
  if (input.currentSpaceStatus === "deprecated") {
    return {
      id: "deprecated-space",
      priority: guidancePriority.spaceRestriction,
      title: "历史空间可用操作",
      body: "当前可以查看历史列表、按需解密已有密码，或从空间主页 clone/export 到新的正常空间继续维护。",
      status: "ready",
      steps: [],
      primaryAction: { type: "navigate", label: "查看密码列表", targetPage: "passwords" },
      secondaryAction: { type: "navigate", label: "回到空间主页", targetPage: "space" }
    };
  }

  if (input.currentSpaceStatus === "archived") {
    return {
      id: "archived-space",
      priority: guidancePriority.spaceRestriction,
      title: "归档空间可用操作",
      body: "当前主要用于查看空间状态和已有列表；归档空间不支持密码解密、日常派生或写入维护。建立本次空间会话后，可按权限查看已保存的记忆提示。",
      status: "blocked",
      steps: [],
      primaryAction: { type: "navigate", label: "查看空间主页", targetPage: "space" },
      blockedReason: "当前空间已归档，写入类操作不可用。"
    };
  }

  return null;
}

function buildDeprecatedSpaceDecryptGuidance(input: GuidanceInput): GuidanceCard | null {
  if (input.currentSpaceStatus !== "deprecated" || input.entries.length === 0) {
    return null;
  }

  if (!input.sessionAlive) {
    return {
      id: "deprecated-decrypt-prep",
      priority: guidancePriority.regularWork,
      title: "准备解密历史密码",
      body: "查看历史列表不需要校验；若要解密历史密码，请先在空间主页的历史密码校验区域输入空间主密码和一条已知关键密钥，完成本次会话的解密准备。",
      status: "ready",
      steps: [],
      primaryAction: { type: "navigate", label: "前往历史密码校验", targetPage: "space" },
      secondaryAction: { type: "navigate", label: "查看密码列表", targetPage: "passwords" }
    };
  }

  if (input.verificationPending) {
    return {
      id: "deprecated-decrypt-prep",
      priority: guidancePriority.regularWork,
      title: "准备解密历史密码",
      body: "查看列表不需要校验。若要解密多条历史密码，请先用一条你记得关键密钥的条目完成一次解密准备；完成后，本次会话内可以继续按条目输入关键密钥解密其他历史密码。",
      status: "ready",
      steps: [],
      primaryAction: { type: "navigate", label: "前往历史密码校验", targetPage: "space" },
      secondaryAction: { type: "navigate", label: "查看密码列表", targetPage: "passwords" }
    };
  }

  return {
    id: "deprecated-decrypt-prep",
    priority: guidancePriority.regularWork,
    title: "准备解密历史密码",
    body: "本次会话已完成历史密码解密准备。你可以在密码列表中按条目输入关键密钥，继续解密其他历史密码。",
    status: "ready",
    steps: [],
    primaryAction: { type: "navigate", label: "查看密码列表", targetPage: "passwords" }
  };
}

function buildSpaceVerificationGuidance(input: GuidanceInput): GuidanceCard | null {
  if (input.currentSpaceStatus !== "active" || !input.verificationPending) {
    return null;
  }

  return {
    id: "space-verification",
    priority: guidancePriority.spaceVerification,
    title: "先完成空间校验",
    body: "请选择一条你记得关键密钥的密码，输入空间主密码和这条密码的关键密钥。能解密既有密码，就代表本次空间主密码校验成功。",
    status: "active",
    steps: [
      { label: "进入空间", status: "done" },
      { label: "完成空间校验", status: "current" },
      { label: "继续管理密码", status: "pending" }
    ],
    primaryAction: { type: "navigate", label: "查看空间校验", targetPage: "space" },
    blockedReason: "校验完成前只能查看列表状态和待校验条目的记忆提示。"
  };
}

function buildSessionGuidance(input: GuidanceInput): GuidanceCard | null {
  if (input.currentSpaceStatus !== "active" || input.verificationPending || input.sessionAlive) {
    return null;
  }

  return {
    id: "session-required",
    priority: guidancePriority.sessionRequired,
    title: "设置本次空间主密码",
    body: "当前空间还没有可用会话。先在空间主页设置空间主密码，本次浏览器会话内后续敏感操作会复用它。",
    status: "active",
    steps: [
      { label: "进入空间", status: "done" },
      { label: "设置空间主密码", status: "current" },
      { label: "初始化规则链或创建密码", status: "pending" }
    ],
    primaryAction: { type: "navigate", label: "前往空间主页", targetPage: "space" }
  };
}

function buildRuleSetupGuidance(input: GuidanceInput): GuidanceCard | null {
  if (
    input.currentSpaceStatus !== "active" ||
    input.verificationPending ||
    !input.sessionAlive ||
    input.ruleProfileConfirmed
  ) {
    return null;
  }

  return {
    id: "rule-setup",
    priority: guidancePriority.ruleSetup,
    title: "初始化空间规则链",
    body: "规则链是当前空间的全局密码生成路径。确认后会被冻结，单条密码不会保存自己的规则信息。",
    status: "active",
    steps: [
      { label: "设置空间主密码", status: "done" },
      { label: "确认规则链", status: "current" },
      { label: "创建密码", status: "pending" }
    ],
    primaryAction: { type: "navigate", label: "前往规则管理", targetPage: "rules" }
  };
}

function buildMigrationGuidance(input: GuidanceInput): GuidanceCard | null {
  const batch = input.selectedMigrationBatch;
  if (input.currentSpaceStatus !== "active" || input.migrationBatches.length === 0 || !batch) {
    return null;
  }

  const pendingEntries = input.migrationEntries.filter((entry) => entry.status === "pending");
  const batchIsDraft = batch.status === "draft";
  const sourceFinalized = Boolean(batch.sourceFinalizedAt);
  const allEntriesHandled = input.migrationEntries.length > 0 && pendingEntries.length === 0;
  const sourceAlreadyFinalizedByRelation = input.spaceRelations.some(
    (relation) =>
      relation.type === "successor_of" &&
      relation.fromSpaceId === input.currentSpaceId &&
      relation.toSpaceId === batch.sourceSpaceId
  );

  if (sourceAlreadyFinalizedByRelation || ((batch.status === "completed" || allEntriesHandled) && sourceFinalized)) {
    return null;
  }

  const blockedState = getMigrationBlockedState(input, batchIsDraft);
  const steps: GuidanceStep[] = [
    { label: "设置目标空间主密码", status: input.sessionAlive ? "done" : "blocked" },
    {
      label: "初始化目标规则链",
      status: !input.sessionAlive ? "pending" : input.ruleProfileConfirmed ? "done" : "blocked"
    },
    {
      label: "校验来源空间",
      status: !input.ruleProfileConfirmed || batchIsDraft ? "pending" : input.sourceSessionVerified ? "done" : "current"
    },
    {
      label: "逐条迁移或跳过",
      status: !input.sourceSessionVerified ? "pending" : pendingEntries.length > 0 ? "current" : "done"
    },
    { label: "完成来源空间流转", status: pendingEntries.length > 0 ? "pending" : sourceFinalized ? "done" : "current" }
  ];

  if (blockedState) {
    return {
      id: "migration",
      priority: guidancePriority.migration,
      title: blockedState.title,
      body: blockedState.body,
      status: "blocked",
      steps,
      primaryAction: blockedState.primaryAction,
      blockedReason: blockedState.blockedReason
    };
  }

  if (batchIsDraft) {
    return {
      id: "migration",
      priority: guidancePriority.migration,
      title: "等待迁移批次就绪",
      body: "目标规则链已经准备好，系统会自动把迁移批次切换到可迁移状态。就绪后下一步是校验来源空间。",
      status: "active",
      steps,
      primaryAction: { type: "navigate", label: "前往迁移情况", targetPage: "space" }
    };
  }

  if (!input.sourceSessionVerified) {
    return {
      id: "migration",
      priority: guidancePriority.migration,
      title: "校验来源空间",
      body: "选择一条旧空间密码，输入旧空间主密码和这条密码的旧关键密钥。校验通过后，迁移时只需为每条密码填写对应旧关键密钥。",
      status: "active",
      steps,
      primaryAction: { type: "navigate", label: "前往来源空间校验", targetPage: "space" }
    };
  }

  if (pendingEntries.length > 0) {
    return {
      id: "migration",
      priority: guidancePriority.migration,
      title: "逐条处理迁移密码",
      body: "为每条待迁移密码选择保持原平台密码或按目标规则重新生成。重新生成前请先确认外部平台已经更新。",
      status: "active",
      steps,
      primaryAction: { type: "navigate", label: "前往迁移列表", targetPage: "space" }
    };
  }

  return {
    id: "migration",
    priority: guidancePriority.migration,
    title: "手动流转来源空间状态",
    body: "所有迁移条目已经处理完成。你选择了手动流转，需要在空间主页点击“手动流转来源空间状态”来创建接替关系，并把来源空间标记为历史空间。",
    status: "active",
    steps,
    primaryAction: { type: "navigate", label: "前往迁移情况", targetPage: "space" }
  };
}

function getMigrationBlockedState(input: GuidanceInput, batchIsDraft: boolean): Pick<
  GuidanceCard,
  "title" | "body" | "primaryAction" | "blockedReason"
> | null {
  if (input.verificationPending) {
    return {
      title: "迁移流程待继续",
      body: "当前空间存在迁移批次，但需要先完成当前空间校验后才能继续处理迁移条目。",
      primaryAction: { type: "navigate", label: "查看空间校验", targetPage: "space" },
      blockedReason: "当前空间校验未完成，完成校验后才能继续迁移。"
    };
  }
  if (!input.sessionAlive) {
    return {
      title: "继续迁移前先设置目标空间主密码",
      body: "目标空间需要先建立本次会话，才能开启迁移批次或写入迁移后的正式密码。",
      primaryAction: { type: "navigate", label: "前往空间主页", targetPage: "space" },
      blockedReason: "目标空间主密码尚未设置，迁移写入前需要先建立本次空间会话。"
    };
  }
  if (!input.ruleProfileConfirmed) {
    return {
      title: "先初始化目标规则链",
      body: "目标空间规则链决定重新生成模式的输出，也会作为新空间后续密码的稳定生成路径。",
      primaryAction: { type: "navigate", label: "前往规则管理", targetPage: "rules" },
      blockedReason: "目标规则链尚未初始化，迁移前需要先确认目标空间规则链。"
    };
  }
  if (batchIsDraft) {
    return null;
  }
  return null;
}

function buildReadySpaceGuidance(input: GuidanceInput): GuidanceCard | null {
  if (
    input.currentSpaceStatus !== "active" ||
    input.verificationPending ||
    !input.sessionAlive ||
    !input.ruleProfileConfirmed
  ) {
    return null;
  }

  if (input.entries.length === 0) {
    return {
      id: "first-password",
      priority: guidancePriority.regularWork,
      title: "创建第一条密码",
      body: "规则链已经准备好。现在可以填写平台、普通备注和关键密钥，生成后只保存加密后的密码输出。",
      status: "ready",
      steps: [
        { label: "设置空间主密码", status: "done" },
        { label: "初始化规则链", status: "done" },
        { label: "创建第一条密码", status: "current" }
      ],
      primaryAction: { type: "open-create-password", label: "打开新建密码表单" },
      secondaryAction: { type: "navigate", label: "前往密码管理", targetPage: "passwords" }
    };
  }

  return getReadySpaceCard(input.activePage);
}

function getReadySpaceCard(activePage: AppPage): GuidanceCard {
  const baseSteps: GuidanceStep[] = [
    { label: "空间校验完成", status: "done" },
    { label: "规则链已初始化", status: "done" },
    { label: "按需管理密码", status: "current" }
  ];

  if (activePage === "rules") {
    return {
      id: "ready-space",
      priority: guidancePriority.regularWork,
      title: "查看已冻结规则链",
      body: "当前规则链已经初始化。为保持已有密码可追溯，本次会话内不再改动规则。",
      status: "ready",
      steps: baseSteps,
      primaryAction: { type: "navigate", label: "前往密码管理", targetPage: "passwords" }
    };
  }

  if (activePage === "groups") {
    return {
      id: "ready-space",
      priority: guidancePriority.regularWork,
      title: "维护输出适配策略",
      body: "可以创建密码组并设置声明式输出策略。适配只在解密核心密码后临时应用，不覆盖已保存密文。",
      status: "ready",
      steps: baseSteps,
      primaryAction: { type: "navigate", label: "前往密码管理", targetPage: "passwords" }
    };
  }

  if (activePage === "passwords") {
    return {
      id: "ready-space",
      priority: guidancePriority.regularWork,
      title: "管理当前空间密码",
      body: "你可以新建密码、解密已有密码、查看记忆提示或编辑普通元数据。每次解密仍需要输入对应关键密钥。",
      status: "ready",
      steps: baseSteps,
      primaryAction: { type: "open-create-password", label: "打开新建密码表单" },
      secondaryAction: { type: "navigate", label: "管理输出适配", targetPage: "groups" }
    };
  }

  return {
    id: "ready-space",
    priority: guidancePriority.regularWork,
    title: "空间已经准备好",
    body: "当前空间已经完成必要准备。你可以管理密码、维护输出适配，或在空间主页处理 clone、导出和迁移。",
    status: "ready",
    steps: baseSteps,
    primaryAction: { type: "navigate", label: "前往密码管理", targetPage: "passwords" },
    secondaryAction: { type: "navigate", label: "管理输出适配", targetPage: "groups" }
  };
}
