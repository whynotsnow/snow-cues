import "@testing-library/jest-dom/vitest";
import "fake-indexeddb/auto";

import { webcrypto } from "node:crypto";

Object.defineProperty(globalThis, "crypto", {
  value: webcrypto,
  configurable: true
});

Object.defineProperty(window, "isSecureContext", {
  value: true,
  configurable: true
});

if (!("btoa" in globalThis)) {
  Object.defineProperty(globalThis, "btoa", {
    value: (value: string) => Buffer.from(value, "binary").toString("base64")
  });
}

if (!("atob" in globalThis)) {
  Object.defineProperty(globalThis, "atob", {
    value: (value: string) => Buffer.from(value, "base64").toString("binary")
  });
}
