import { defineConfig, mergeConfig } from "vitest/config";
import appConfig from "../../vitest.config.ts";

export default mergeConfig(appConfig, defineConfig({
  test: { include: ["tools/i18n/gt-proof.tsx"] },
}));
