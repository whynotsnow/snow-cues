import { useCallback, useEffect } from "react";
import {
  createSession,
  isSessionExpired,
  touchSession,
  wipeSession,
  type Session
} from "../../session-manager/session-manager";
import {
  getSpace,
  listPasswordEntriesBySpace,
  listSpaceProfile,
  saveSpace,
  type PasswordEntry,
  type SpaceRecord
} from "../../storage-data";
import { normalizeSpaceId, type AppPage, type UiState } from "../appTypes";

type SpaceEntryInput = {
  spaceId: string;
};

type SpaceState = "unknown" | "new" | "existing";

type UseSpaceAccessControllerInput = {
  clearSensitiveState: () => void;
  currentSpaceId: string;
  loadSpaceProfile: (spaceId: string) => Promise<void>;
  resetRuleProfile: () => void;
  session: Session | null;
  setActivePage: (page: AppPage) => void;
  setCurrentSpace: (space: SpaceRecord | null) => void;
  setCurrentSpaceId: (spaceId: string) => void;
  setCurrentSpaceIsTemporary: (temporary: boolean) => void;
  setEntries: (entries: PasswordEntry[]) => void;
  setError: (message: string) => void;
  setLoggingIn: (loggingIn: boolean) => void;
  setLoginVerificationEntryId: (entryId: string | null) => void;
  setRuleProfileConfirmed: (confirmed: boolean) => void;
  setSession: (session: Session | null) => void;
  setShowCreateForm: (show: boolean) => void;
  setStatus: (message: string) => void;
  setUiState: (state: UiState) => void;
};

export function useSpaceAccessController({
  clearSensitiveState,
  currentSpaceId,
  loadSpaceProfile,
  resetRuleProfile,
  session,
  setActivePage,
  setCurrentSpace,
  setCurrentSpaceId,
  setCurrentSpaceIsTemporary,
  setEntries,
  setError,
  setLoggingIn,
  setLoginVerificationEntryId,
  setRuleProfileConfirmed,
  setSession,
  setShowCreateForm,
  setStatus,
  setUiState
}: UseSpaceAccessControllerInput) {
  // 空间边界变化必须同时清理会话、条目和规则 profile，避免空间间状态串用。
  const leaveSpace = useCallback(
    (nextState: UiState = "LEFT_SPACE") => {
      setSession(wipeSession());
      clearSensitiveState();
      setEntries([]);
      setCurrentSpaceId("");
      setCurrentSpace(null);
      setCurrentSpaceIsTemporary(false);
      setActivePage("space");
      setShowCreateForm(false);
      setRuleProfileConfirmed(false);
      resetRuleProfile();
      setUiState(nextState);
      setStatus("已离开存储空间。");
    },
    [
      clearSensitiveState,
      resetRuleProfile,
      setActivePage,
      setCurrentSpace,
      setCurrentSpaceId,
      setCurrentSpaceIsTemporary,
      setEntries,
      setRuleProfileConfirmed,
      setSession,
      setShowCreateForm,
      setStatus,
      setUiState
    ]
  );

  const refreshEntries = useCallback(async () => {
    if (!currentSpaceId) {
      setEntries([]);
      return;
    }
    setEntries(await listPasswordEntriesBySpace(currentSpaceId));
  }, [currentSpaceId, setEntries]);

  const inspectSpace = useCallback(
    async (spaceId: string): Promise<SpaceState> => {
      const normalizedSpaceId = normalizeSpaceId(spaceId);
      if (!normalizedSpaceId) {
        return "unknown";
      }
      const [space, profile, storedEntries] = await Promise.all([
        getSpace(normalizedSpaceId),
        listSpaceProfile(normalizedSpaceId),
        listPasswordEntriesBySpace(normalizedSpaceId)
      ]);
      return space || profile || storedEntries.length > 0 ? "existing" : "new";
    },
    []
  );

  useEffect(() => {
    if (!session) {
      return;
    }

    const timer = window.setInterval(() => {
      if (isSessionExpired(session)) {
        leaveSpace();
      }
    }, 1000);

    return () => window.clearInterval(timer);
  }, [leaveSpace, session]);

  const withLiveSession = useCallback(
    <T>(operation: (liveSession: Session) => Promise<T>): Promise<T> => {
      if (!session) {
        return Promise.reject(new Error("请先输入空间主密码。"));
      }
      if (isSessionExpired(session)) {
        leaveSpace();
        return Promise.reject(new Error("空间会话已过期，请重新进入。"));
      }

      // 每次敏感操作前刷新 idle 计时，但仍受绝对过期时间限制。
      const liveSession = touchSession(session);
      setSession(liveSession);
      return operation(liveSession);
    },
    [leaveSpace, session, setSession]
  );

  const ensureLiveSession = useCallback(
    async (masterPassword?: string): Promise<Session> => {
      if (session && !isSessionExpired(session)) {
        const liveSession = touchSession(session);
        setSession(liveSession);
        return liveSession;
      }
      if (session && isSessionExpired(session)) {
        leaveSpace();
        throw new Error("空间会话已过期，请重新进入。");
      }
      const nextSession = await createSession(masterPassword ?? "");
      setSession(nextSession);
      return nextSession;
    },
    [leaveSpace, session, setSession]
  );

  async function handleEnterSpace(input: SpaceEntryInput): Promise<boolean> {
    setError("");
    setStatus("");
    setLoggingIn(true);

    try {
      const nextSpaceId = normalizeSpaceId(input.spaceId);
      if (!nextSpaceId) {
        throw new Error("请输入存储空间 ID。");
      }
      const [storedEntries, profile, storedSpace] = await Promise.all([
        listPasswordEntriesBySpace(nextSpaceId),
        listSpaceProfile(nextSpaceId),
        getSpace(nextSpaceId)
      ]);
      const nextSpaceState =
        storedSpace || profile || storedEntries.length > 0 ? "existing" : "new";
      const nextSpace =
        storedSpace ??
        (nextSpaceState === "existing"
          ? await saveSpace({
              spaceId: nextSpaceId,
              status: "active"
            })
          : {
              // 新空间先保持临时记录形态，初始化规则或创建密码后才真正持久化。
              spaceId: nextSpaceId,
              status: "active" as const,
              createdAt: Date.now(),
              updatedAt: Date.now()
            });
      const verificationEntry = storedEntries[0];

      setSession(wipeSession());
      clearSensitiveState();
      setCurrentSpaceId(nextSpaceId);
      setCurrentSpace(nextSpace);
      setCurrentSpaceIsTemporary(nextSpaceState === "new");
      setUiState("IN_SPACE");
      setActivePage("space");
      setEntries(storedEntries);
      setLoginVerificationEntryId(verificationEntry?.id ?? null);
      await loadSpaceProfile(nextSpaceId);
      setStatus(
        verificationEntry
          ? "已进入存储空间。当前空间已有密码，请先输入空间主密码并完成空间校验。"
          : nextSpaceState === "new"
            ? "已进入临时存储空间。在空间主页设置空间主密码后，可初始化规则链或创建密码。"
            : "已进入存储空间。输入空间主密码后，可继续操作。"
      );
      return true;
    } catch (loginError) {
      const message = loginError instanceof Error ? loginError.message : "";
      setSession(wipeSession());
      setLoginVerificationEntryId(null);
      setError(message || "无法进入存储空间。");
      return false;
    } finally {
      setLoggingIn(false);
    }
  }

  async function handleStartSpaceSession(
    masterPassword: string
  ): Promise<boolean> {
    setError("");
    setStatus("");

    try {
      if (!masterPassword.trim()) {
        throw new Error("请输入空间主密码。");
      }
      await ensureLiveSession(masterPassword);
      setStatus("空间主密码已设置，本次空间会话已建立。");
      return true;
    } catch (sessionError) {
      setSession(wipeSession());
      setError(
        sessionError instanceof Error
          ? sessionError.message
          : "无法校验空间主密码。"
      );
      return false;
    }
  }

  return {
    leaveSpace,
    refreshEntries,
    inspectSpace,
    ensureLiveSession,
    withLiveSession,
    handleEnterSpace,
    handleStartSpaceSession
  };
}
