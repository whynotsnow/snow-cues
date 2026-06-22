import { describe, expect, it } from "vitest";
import { diagnoseSpace } from "./diagnostics";

describe("Space diagnostics", () => {
  it("结构完整时返回 healthy", () => {
    expect(
      diagnoseSpace({
        space: {
          spaceId: "default",
          status: "active",
          createdAt: 1,
          updatedAt: 2
        },
        profile: {
          spaceId: "default",
          ruleChain: ["v1-hmac"],
          importedRuleManifests: [],
          createdAt: 1,
          updatedAt: 2
        },
        entries: [
          {
            id: "entry-1",
            spaceId: "default",
            encrypted_password: "sealed",
            createdAt: 1,
            updatedAt: 2
          }
        ]
      })
    ).toBe("healthy");
  });

  it("缺失 Space 本体或结构不匹配时返回 corrupted", () => {
    expect(diagnoseSpace({ space: null })).toBe("corrupted");
    expect(
      diagnoseSpace({
        space: {
          spaceId: "default",
          status: "active",
          createdAt: 1,
          updatedAt: 2
        },
        profile: {
          spaceId: "other",
          ruleChain: ["v1-hmac"],
          importedRuleManifests: [],
          createdAt: 1,
          updatedAt: 2
        }
      })
    ).toBe("corrupted");
  });

  it("不会把解密失败等运行时状态当作 corrupted", () => {
    expect(
      diagnoseSpace({
        space: {
          spaceId: "default",
          status: "active",
          createdAt: 1,
          updatedAt: 2
        }
      })
    ).toBe("healthy");
  });
});
