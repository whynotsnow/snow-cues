import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within
} from "@testing-library/react";
import { expect, vi } from "vitest";
import App from "../App";
import {
  decryptPassword,
  deriveRuntimeStorageKey,
  encryptPassword,
  generatePasswordWithRuleChain
} from "../crypto-engine/crypto-engine";
import { createSession } from "../session-manager/session-manager";
import { createPasswordEntry, getSpace, resetLocalData } from "../storage-data";

export async function resetAppTestEnvironment() {
  cleanup();
  vi.restoreAllMocks();
  Reflect.deleteProperty(window, "Notification");
  window.history.replaceState(null, "", "/");
  await resetLocalData();
  vi.spyOn(window, "confirm").mockReturnValue(true);
}

export function renderApp() {
  return render(<App />);
}

export async function ensureStorageDataOpened() {
  const button = screen.queryByRole("button", { name: "新建存储数据" });
  if (button) {
    fireEvent.click(button);
    await screen.findByText(/存储数据 ID/);
  }
}

export async function enterSpace(spaceId = "default") {
  await ensureStorageDataOpened();
  const existingSpace = await getSpace(spaceId);
  let spaceCard: HTMLElement | undefined;
  if (existingSpace) {
    await waitFor(() => {
      spaceCard = screen
        .getAllByRole("article")
        .find((article) => article.textContent?.includes(spaceId));
      expect(spaceCard).toBeTruthy();
    });
  }
  if (spaceCard) {
    fireEvent.click(
      within(spaceCard).getByRole("button", { name: "进入空间" })
    );
  } else {
    fireEvent.click(screen.getByRole("button", { name: "新建空间" }));
    fireEvent.change(screen.getByLabelText("目标存储空间 ID"), {
      target: { value: spaceId }
    });
    fireEvent.click(screen.getByRole("button", { name: "创建并进入空间" }));
  }
  await screen.findByText(`空间：${spaceId}`, undefined, { timeout: 5000 });
}

export async function establishSpaceSession(masterPassword = "master") {
  if (!screen.queryByRole("button", { name: "建立空间会话" })) {
    fireEvent.click(screen.getByRole("button", { name: "空间主页" }));
    await screen.findByRole("button", { name: "建立空间会话" });
  }
  const setupPanel = screen
    .queryByRole("button", { name: "建立空间会话" })
    ?.closest("section");
  if (!setupPanel) {
    return;
  }
  fireEvent.change(
    within(setupPanel as HTMLElement).getByLabelText("空间主密码"),
    {
      target: { value: masterPassword }
    }
  );
  fireEvent.click(
    within(setupPanel as HTMLElement).getByRole("button", {
      name: "建立空间会话"
    })
  );
  await waitFor(() =>
    expect(
      screen.getByText("空间主密码已设置，本次空间会话已建立。")
    ).toBeInTheDocument()
  );
}

export async function confirmRuleProfileWithMaster(masterPassword = "master") {
  if (
    screen.getByRole("button", { name: "确认初始化" }).hasAttribute("disabled")
  ) {
    await establishSpaceSession(masterPassword);
    fireEvent.click(screen.getByRole("button", { name: "规则管理" }));
  }
  const masterPasswordInput = screen.queryByLabelText("空间主密码");
  if (masterPasswordInput) {
    fireEvent.change(masterPasswordInput, {
      target: { value: masterPassword }
    });
  }
  fireEvent.click(screen.getByRole("button", { name: "确认初始化" }));
  await waitFor(() =>
    expect(
      screen.getByText(
        "规则链已初始化并保存。本空间后续进入会继续使用这组规则。"
      )
    ).toBeInTheDocument()
  );
  fireEvent.click(screen.getByRole("button", { name: "密码管理" }));
  await screen.findByRole("heading", { name: "密码管理" });
}

export function fillFirstSpaceMasterPassword(masterPassword = "master") {
  fireEvent.change(screen.getAllByLabelText("空间主密码")[0], {
    target: { value: masterPassword }
  });
}

export async function seedEncryptedPasswordEntry(
  spaceId: string,
  entryId: string,
  platform: string,
  entrySecret: string
) {
  const encrypted_password = await encryptPasswordForEntrySecret(entrySecret);
  await createPasswordEntry({
    id: entryId,
    spaceId,
    encrypted_password,
    platform
  });
}

export async function encryptPasswordForEntrySecret(entrySecret: string) {
  const seedSession = await createSession("master");
  const result = await generatePasswordWithRuleChain(
    seedSession.cryptoKey,
    entrySecret,
    ["v1-hmac"],
    {
      mode: "base62",
      maxLength: 24
    }
  );
  const runtimeStorageKey = await deriveRuntimeStorageKey(
    seedSession.cryptoKey,
    entrySecret
  );
  return encryptPassword(runtimeStorageKey, result.encodedPassword);
}

export async function decryptPasswordForEntrySecret(
  encryptedPassword: string,
  entrySecret: string
) {
  const session = await createSession("master");
  const runtimeKey = await deriveRuntimeStorageKey(
    session.cryptoKey,
    entrySecret
  );
  return decryptPassword(runtimeKey, encryptedPassword);
}

export function getSourceVerificationPanel() {
  return screen
    .getByRole("heading", { name: "来源空间校验" })
    .closest(".verification-panel") as HTMLElement;
}

export function expectPageNotice(text: string) {
  const topbar = screen.getByLabelText("应用状态");
  expect(within(topbar).queryByLabelText("页面通知")).not.toBeInTheDocument();
  const currentPage = screen.getByLabelText("当前页面");
  const pageNotice = within(currentPage).getByLabelText("页面通知");
  expect(within(pageNotice).getByText(text)).toBeInTheDocument();
}

export function expectNoPageNotice() {
  const currentPage = screen.queryByLabelText("当前页面");
  if (!currentPage) {
    return;
  }
  expect(
    within(currentPage).queryByLabelText("页面通知")
  ).not.toBeInTheDocument();
}

export function getGuidancePanel() {
  return screen.getByLabelText("用户操作指引");
}

export function mockBrowserNotification(permission: NotificationPermission) {
  const notificationSpy = vi.fn();
  const requestPermissionSpy = vi.fn().mockResolvedValue(permission);
  class MockNotification {
    static permission = permission;
    static requestPermission = requestPermissionSpy;

    constructor(title: string, options?: NotificationOptions) {
      notificationSpy(title, options);
    }
  }

  Object.defineProperty(window, "Notification", {
    configurable: true,
    writable: true,
    value: MockNotification
  });

  return { notificationSpy, requestPermissionSpy };
}
