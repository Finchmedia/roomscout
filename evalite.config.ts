import { defineConfig } from "evalite/config";
import { createInMemoryStorage } from "evalite/in-memory-storage";

export default defineConfig({
  storage: () => createInMemoryStorage(),
  maxConcurrency: 1,
  testTimeout: 180_000,
  hideTable: false,
});
