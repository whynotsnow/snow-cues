import { ActionGroup, Button, TextField } from "../design-system";
import type { AppController } from "../useAppController";

type TestDataToolsProps = {
  controller: AppController;
};

export function TestDataTools({ controller }: TestDataToolsProps) {
  const {
    outsideSpace,
    testCleanupAllowed,
    testToolSpaceId,
    setTestToolSpaceId,
    handleClearPasswords,
    handleClearProfile,
    handleResetLocalData,
    handleDeleteTestSpace
  } = controller;

  return (
    <section
      className="test-tools global-test-tools"
      aria-label="开发测试数据工具"
    >
      <div>
        <h2>开发测试数据工具</h2>
        <p>这些操作用于开发和验证流程，会修改当前打开的存储数据草稿。</p>
      </div>
      <div className="form-stack">
        <TextField
          autoComplete="off"
          label="测试目标存储空间 ID"
          onChange={(event) => setTestToolSpaceId(event.target.value)}
          placeholder="输入要删除的空间 ID"
          value={testToolSpaceId}
        />
        <ActionGroup variant="tool">
          <Button
            disabled={outsideSpace || !testCleanupAllowed}
            onClick={() => void handleClearPasswords()}
          >
            测试：清空当前空间密码数据
          </Button>
          <Button
            disabled={outsideSpace || !testCleanupAllowed}
            onClick={() => void handleClearProfile()}
          >
            测试：重置当前空间规则链配置
          </Button>
          <Button onClick={() => void handleDeleteTestSpace()}>
            测试：删除指定空间
          </Button>
          <Button onClick={() => void handleResetLocalData()}>
            测试：清空全部本地数据
          </Button>
        </ActionGroup>
      </div>
    </section>
  );
}
