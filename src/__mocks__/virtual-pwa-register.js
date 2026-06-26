/**
 * Vitest mock for virtual:pwa-register.
 *
 * vite-plugin-pwa 的虚拟模块只在 Vite 生产构建时由插件注入；
 * Vitest 运行时无法解析该模块。提供空实现，让 usePwaUpdate 的
 * loadDefaultRegister 在测试中 resolve 为 null，安全降级。
 *
 * 真实行为通过注入 registerFn props 在测试中覆盖。
 */
export function registerSW() {
  return () => Promise.resolve();
}
