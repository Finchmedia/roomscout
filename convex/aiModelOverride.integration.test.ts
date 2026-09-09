import { afterEach, describe, expect, it } from "vitest";
import {
  getRoomScoutLanguageModel,
  roomScoutLanguageModel,
  withRoomScoutLanguageModelForTest,
} from "./ai";

const originalNodeEnv = process.env.NODE_ENV;
afterEach(() => {
  process.env.NODE_ENV = originalNodeEnv;
});

describe("RoomScout local model override", () => {
  it("keeps the production Gateway model as the default", () => {
    expect(getRoomScoutLanguageModel()).toBe(roomScoutLanguageModel);
  });

  it("rejects overrides outside the test runtime", async () => {
    process.env.NODE_ENV = "production";
    await expect(withRoomScoutLanguageModelForTest(roomScoutLanguageModel, async () => null))
      .rejects.toThrow("ROOMSCOUT_MODEL_OVERRIDE_FORBIDDEN");
  });

  it("restores the default after a throw and rejects overlapping scopes", async () => {
    process.env.NODE_ENV = "test";
    let release!: () => void;
    const held = new Promise<void>((resolve) => { release = resolve; });
    const active = withRoomScoutLanguageModelForTest(roomScoutLanguageModel, async () => held);
    await expect(withRoomScoutLanguageModelForTest(roomScoutLanguageModel, async () => null))
      .rejects.toThrow("ROOMSCOUT_MODEL_OVERRIDE_CONCURRENT");
    release();
    await active;
    await expect(withRoomScoutLanguageModelForTest(roomScoutLanguageModel, async () => {
      throw new Error("expected-test-failure");
    })).rejects.toThrow("expected-test-failure");
    expect(getRoomScoutLanguageModel()).toBe(roomScoutLanguageModel);
  });
});
