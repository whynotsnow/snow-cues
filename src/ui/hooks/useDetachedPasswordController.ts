import { useState } from "react";
import { generateDetachedPassword } from "../../crypto-engine/crypto-engine";
import type { EncodingMode } from "../../crypto-engine/encoding";
import {
  adaptPasswordOutput,
  DEFAULT_PASSWORD_OUTPUT_POLICY,
  type PasswordOutputPolicy,
  type PasswordOutputPresetId
} from "../../crypto-engine/output-policy";

type UseDetachedPasswordControllerInput = {
  setStatus: (message: string) => void;
  setError: (message: string) => void;
};

const DEFAULT_CUSTOM_CHARSET =
  "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%+=?";

export function useDetachedPasswordController({
  setStatus,
  setError
}: UseDetachedPasswordControllerInput) {
  const [detachedDerivationKey, setDetachedDerivationKey] = useState("");
  const [detachedEncodingMode, setDetachedEncodingMode] =
    useState<EncodingMode>("base62");
  const [detachedCustomCharset, setDetachedCustomCharset] = useState(
    DEFAULT_CUSTOM_CHARSET
  );
  const [detachedMaxLength, setDetachedMaxLength] = useState(24);
  const [detachedOutputPresetId, setDetachedOutputPresetId] = useState<
    PasswordOutputPresetId | "custom"
  >("strong");
  const [detachedOutputPolicy, setDetachedOutputPolicy] =
    useState<PasswordOutputPolicy>(DEFAULT_PASSWORD_OUTPUT_POLICY);
  const [detachedApplyOutputPolicy, setDetachedApplyOutputPolicy] =
    useState(true);
  const [detachedPasswordPreview, setDetachedPasswordPreview] = useState("");
  const [detachedPasswordVisible, setDetachedPasswordVisible] = useState(false);
  const [detachedGenerating, setDetachedGenerating] = useState(false);
  const [detachedCopyStatus, setDetachedCopyStatus] = useState("");
  const [pendingDetachedEntrySecret, setPendingDetachedEntrySecret] =
    useState("");
  const [detachedMigrationFormVisible, setDetachedMigrationFormVisible] =
    useState(false);

  async function handleGenerateDetachedPassword() {
    setError("");
    setStatus("");
    setDetachedCopyStatus("");
    setDetachedGenerating(true);
    try {
      const generated = await generateDetachedPassword(detachedDerivationKey, {
        mode: detachedEncodingMode,
        customCharset: detachedCustomCharset,
        maxLength: detachedMaxLength
      });
      const previewPassword = detachedApplyOutputPolicy
        ? await adaptPasswordOutput(
            generated.encodedPassword,
            detachedOutputPolicy
          )
        : generated.encodedPassword;
      setDetachedPasswordPreview(previewPassword);
      setDetachedPasswordVisible(true);
      setStatus(
        detachedApplyOutputPolicy
          ? "游离密码预览已生成并应用输出策略，仅保存在当前页面内存中。"
          : "游离密码核心预览已生成，仅保存在当前页面内存中。"
      );
    } catch (generateError) {
      setDetachedPasswordPreview("");
      setDetachedPasswordVisible(false);
      setError(
        generateError instanceof Error
          ? generateError.message
          : "无法生成游离密码。"
      );
    } finally {
      setDetachedGenerating(false);
    }
  }

  async function handleCopyDetachedPassword() {
    if (!detachedPasswordPreview) {
      return;
    }
    try {
      await navigator.clipboard?.writeText(detachedPasswordPreview);
      setDetachedCopyStatus("已复制。");
    } catch {
      setDetachedCopyStatus("当前浏览器不允许自动复制，请手动复制。");
    }
  }

  function handleClearDetachedPassword() {
    setDetachedDerivationKey("");
    setDetachedPasswordPreview("");
    setDetachedPasswordVisible(false);
    setDetachedCopyStatus("");
    setPendingDetachedEntrySecret("");
    setDetachedMigrationFormVisible(false);
    setStatus("已清空本次游离密码。");
  }

  function handleStartDetachedPasswordMigration() {
    if (!detachedDerivationKey.trim()) {
      setError("请先输入派生密钥。");
      return;
    }
    setPendingDetachedEntrySecret(detachedDerivationKey);
    setDetachedMigrationFormVisible(false);
    setStatus(
      "已准备迁移派生密钥。请进入目标空间后，在密码管理页按当前空间规则生成并保存正式密码。"
    );
  }

  function handleCancelDetachedPasswordMigration() {
    setPendingDetachedEntrySecret("");
    setDetachedMigrationFormVisible(false);
    setStatus("已取消派生密钥迁移。");
  }

  function clearDetachedPasswordAfterSave() {
    setDetachedDerivationKey("");
    setDetachedPasswordPreview("");
    setDetachedPasswordVisible(false);
    setDetachedCopyStatus("");
    setPendingDetachedEntrySecret("");
    setDetachedMigrationFormVisible(false);
  }

  return {
    detachedDerivationKey,
    setDetachedDerivationKey,
    detachedEncodingMode,
    setDetachedEncodingMode,
    detachedCustomCharset,
    setDetachedCustomCharset,
    detachedMaxLength,
    setDetachedMaxLength,
    detachedOutputPresetId,
    setDetachedOutputPresetId,
    detachedOutputPolicy,
    setDetachedOutputPolicy,
    detachedApplyOutputPolicy,
    setDetachedApplyOutputPolicy,
    detachedPasswordPreview,
    detachedPasswordVisible,
    setDetachedPasswordVisible,
    detachedGenerating,
    detachedCopyStatus,
    pendingDetachedEntrySecret,
    detachedMigrationFormVisible,
    setDetachedMigrationFormVisible,
    handleGenerateDetachedPassword,
    handleCopyDetachedPassword,
    handleClearDetachedPassword,
    handleStartDetachedPasswordMigration,
    handleCancelDetachedPasswordMigration,
    clearDetachedPasswordAfterSave
  };
}
