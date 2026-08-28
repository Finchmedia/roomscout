import { describe, expect, it } from "vitest";
import { authErrorMessage } from "./errors";

describe("authErrorMessage", () => {
  it.each([
    [{ error: "PASSWORD_TOO_SHORT", minimumLength: 10 }, "Use at least 10 characters."],
    [{ error: "PASSWORD_TOO_LONG", maximumLength: 100 }, "Use no more than 100 characters."],
    [{ error: "PASSWORD_HAS_SURROUNDING_WHITESPACE" }, "Remove spaces from the beginning or end of the password."],
    [{ error: "PASSWORD_TOO_COMMON" }, "Choose a less common password."],
    [{ error: "USERNAME_TOO_SHORT", minimumLength: 1 }, "Use at least 1 character for the username."],
    [{ error: "USERNAME_HAS_SURROUNDING_WHITESPACE" }, "Remove spaces from the beginning or end of the username."],
    [{ error: "USERNAME_HAS_INVALID_CHARACTERS" }, "The username contains unsupported or invisible characters."],
    [{ error: "USERNAME_TAKEN" }, "That username is already in use."],
    [{ error: "USER_NOT_FOUND" }, "No account exists for that username."],
    [{ error: "INVALID_CREDENTIALS" }, "The username or password is incorrect."],
    [{ error: "RATE_LIMITED", retryAfterMs: 2_100 }, "Too many attempts. Try again in 3 seconds."],
    [{ error: "OTHER_ERROR" }, "An unexpected authentication error occurred. Please try again."],
  ] as const)("maps $error.error", (error, message) => {
    expect(authErrorMessage(error)).toBe(message);
  });

  it("keeps a safe fallback for a future Auth v2 error", () => {
    expect(authErrorMessage({ error: "NEW_ALPHA_ERROR" })).toBe(
      "Authentication failed. Please try again.",
    );
  });
});
