import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function projectFile(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("AgentMail component environment bridge", () => {
  it("keeps the official component patch reproducible after installs", () => {
    const packageJson = JSON.parse(projectFile("package.json")) as {
      scripts?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const dependencyPatch = projectFile(
      "patches/@agentmail+convex+0.1.0.patch",
    );

    expect(packageJson.scripts?.postinstall).toBe("patch-package");
    expect(packageJson.devDependencies?.["patch-package"]).toBeTruthy();
    expect(dependencyPatch).toContain("AGENTMAIL_API_KEY: v.string()");
    expect(dependencyPatch).toContain(
      "AGENTMAIL_BASE_URL: v.optional(v.string())",
    );
    expect(dependencyPatch).toContain(
      "export const listInboxes = action({",
    );
    expect(dependencyPatch).toContain(
      "export const getMessage = action({",
    );
  });

  it("binds root deployment secrets into the isolated component", () => {
    const config = projectFile("convex/convex.config.ts");

    expect(config).toContain("AGENTMAIL_API_KEY: v.string()");
    expect(config).toContain("AGENTMAIL_BASE_URL: v.optional(v.string())");
    expect(config).toContain(
      "AGENTMAIL_API_KEY: app.env.AGENTMAIL_API_KEY",
    );
    expect(config).toContain(
      "AGENTMAIL_BASE_URL: app.env.AGENTMAIL_BASE_URL",
    );
  });
});
