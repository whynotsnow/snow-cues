import { useCallback, useEffect, useState } from "react";
import {
  getSpace,
  listRelationsForSpace,
  listSpaces,
  type SpaceRecord,
  type SpaceRelation
} from "../../storage-data";
import { createMigrationBatchFromSpace } from "../../space/migration";
import { importSpacePackage } from "../../space/transfer";

export type SpaceIndexItem = {
  space: SpaceRecord;
  relations: SpaceRelation[];
};

export type OutsideCreateMode =
  | "blank"
  | "clone_profile"
  | "clone_with_entries"
  | "import_profile"
  | "import_with_entries";

export function useSpaceIndexController(
  outsideSpace: boolean,
  enterSpace: (input: { spaceId: string }) => Promise<boolean>,
  setError: (message: string) => void,
  setStatus: (message: string) => void
) {
  const [spaceIndexItems, setSpaceIndexItems] = useState<SpaceIndexItem[]>([]);
  const [outsideShowCreateSpaceOptions, setOutsideShowCreateSpaceOptions] =
    useState(false);
  const [outsideCreateMode, setOutsideCreateMode] =
    useState<OutsideCreateMode>("blank");
  const [outsideCreateTargetSpaceId, setOutsideCreateTargetSpaceId] =
    useState("");
  const [outsideCloneSourceSpaceId, setOutsideCloneSourceSpaceId] =
    useState("");
  const [outsideImportText, setOutsideImportText] = useState("");

  const refreshSpaceIndex = useCallback(async () => {
    try {
      const spaces = await listSpaces();
      const items = await Promise.all(
        spaces.map(async (space) => ({
          space,
          relations: await listRelationsForSpace(space.spaceId)
        }))
      );
      setSpaceIndexItems(items);
    } catch (refreshError) {
      setError(
        refreshError instanceof Error
          ? refreshError.message
          : "无法读取本地空间索引。"
      );
      setSpaceIndexItems([]);
    }
  }, [setError]);

  useEffect(() => {
    setOutsideCloneSourceSpaceId(
      (current) => current || spaceIndexItems[0]?.space.spaceId || ""
    );
  }, [spaceIndexItems]);

  useEffect(() => {
    if (outsideSpace) {
      void refreshSpaceIndex();
    }
  }, [outsideSpace, refreshSpaceIndex]);

  async function handleOutsideCreateBlankSpace() {
    setError("");
    setStatus("");
    try {
      const targetSpaceId = outsideCreateTargetSpaceId.trim().toLowerCase();
      if (!targetSpaceId) {
        throw new Error("请输入目标存储空间 ID。");
      }
      const existingSpace = await getSpace(targetSpaceId);
      if (existingSpace) {
        throw new Error("目标存储空间已存在，请更换空间 ID 或直接进入该空间。");
      }
      await enterCreatedSpace(
        targetSpaceId,
        "已进入临时存储空间。在空间主页设置空间主密码后，可初始化规则链或创建密码。"
      );
    } catch (createError) {
      setError(
        createError instanceof Error
          ? createError.message
          : "无法创建空白空间。"
      );
    }
  }

  async function handleOutsideCloneSpace(includeEntries: boolean) {
    setError("");
    setStatus("");
    try {
      const targetSpaceId = outsideCreateTargetSpaceId.trim().toLowerCase();
      const sourceSpaceId = outsideCloneSourceSpaceId.trim().toLowerCase();
      if (!targetSpaceId) {
        throw new Error("请输入目标存储空间 ID。");
      }
      if (!sourceSpaceId) {
        throw new Error("请选择来源存储空间。");
      }
      const batch = await createMigrationBatchFromSpace({
        sourceSpaceId,
        targetSpaceId,
        copyProfile: true,
        includeEntries
      });
      await refreshSpaceIndex();
      await enterCreatedSpace(
        targetSpaceId,
        batch
          ? "已创建目标空间和密码迁移队列，并进入目标空间主页。请先在空间主页设置空间主密码后继续。"
          : "已从已有空间 clone 配置并进入目标空间主页。请先在空间主页设置空间主密码后继续。"
      );
    } catch (cloneError) {
      setError(
        cloneError instanceof Error ? cloneError.message : "无法 clone 空间。"
      );
    }
  }

  async function handleOutsideImportSpace(importEntries: boolean) {
    setError("");
    setStatus("");
    try {
      const targetSpaceId = outsideCreateTargetSpaceId.trim().toLowerCase();
      if (!targetSpaceId) {
        throw new Error("请输入目标存储空间 ID。");
      }
      const batch = await importSpacePackage({
        targetSpaceId,
        packageText: outsideImportText,
        importProfile: true,
        importEntries
      });
      await refreshSpaceIndex();
      await enterCreatedSpace(
        targetSpaceId,
        batch
          ? "已从导入文件创建空间，密码条目已进入迁移队列，并进入空间主页。请先在空间主页设置空间主密码后继续。"
          : "已从导入文件创建空间并进入空间主页。请先在空间主页设置空间主密码后继续。"
      );
    } catch (importError) {
      setError(
        importError instanceof Error
          ? importError.message
          : "无法导入空间数据。"
      );
    }
  }

  async function handleOutsideCreateSpaceByMode() {
    if (outsideCreateMode === "blank") {
      await handleOutsideCreateBlankSpace();
      return;
    }
    if (
      outsideCreateMode === "clone_profile" ||
      outsideCreateMode === "clone_with_entries"
    ) {
      await handleOutsideCloneSpace(outsideCreateMode === "clone_with_entries");
      return;
    }
    await handleOutsideImportSpace(outsideCreateMode === "import_with_entries");
  }

  async function enterCreatedSpace(
    targetSpaceId: string,
    successMessage: string
  ) {
    setOutsideCreateTargetSpaceId("");
    setOutsideCreateMode("blank");
    setOutsideImportText("");
    setOutsideShowCreateSpaceOptions(false);
    const entered = await enterSpace({ spaceId: targetSpaceId });
    if (entered) {
      setStatus(successMessage);
    }
  }

  return {
    spaceIndexItems,
    refreshSpaceIndex,
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
    handleOutsideCreateBlankSpace,
    handleOutsideCloneSpace,
    handleOutsideImportSpace,
    handleOutsideCreateSpaceByMode
  };
}
