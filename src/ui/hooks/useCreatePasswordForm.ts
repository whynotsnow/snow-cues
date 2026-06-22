import { useState } from "react";
import type { EncodingMode } from "../../crypto-engine/encoding";

export type CreatePasswordInput = {
  masterPassword: string;
  entrySecret: string;
  platform: string;
  description: string;
  groupId: string;
  memoryHint: string;
  encodingMode: EncodingMode;
  customCharset: string;
  maxLength: number;
};

const DEFAULT_CUSTOM_CHARSET =
  "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%+=?";

export function useCreatePasswordForm() {
  // 新建表单输入仅停留在组件生命周期内，提交成功后由表单主动清空。
  const [masterPassword, setMasterPassword] = useState("");
  const [entrySecret, setEntrySecret] = useState("");
  const [platform, setPlatform] = useState("");
  const [description, setDescription] = useState("");
  const [groupId, setGroupId] = useState("");
  const [memoryHint, setMemoryHint] = useState("");
  const [encodingMode, setEncodingMode] = useState<EncodingMode>("base62");
  const [customCharset, setCustomCharset] = useState(DEFAULT_CUSTOM_CHARSET);
  const [maxLength, setMaxLength] = useState(24);

  function resetForm() {
    setMasterPassword("");
    setEntrySecret("");
    setPlatform("");
    setDescription("");
    setGroupId("");
    setMemoryHint("");
  }

  return {
    values: {
      masterPassword,
      entrySecret,
      platform,
      description,
      groupId,
      memoryHint,
      encodingMode,
      customCharset,
      maxLength
    },
    actions: {
      setMasterPassword,
      setEntrySecret,
      setPlatform,
      setDescription,
      setGroupId,
      setMemoryHint,
      setEncodingMode,
      setCustomCharset,
      setMaxLength,
      resetForm
    }
  };
}
