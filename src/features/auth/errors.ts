export const MIN_PASSWORD_LENGTH = 10;
export const MAX_PASSWORD_LENGTH = 100;

export type AuthUserError = {
  error: string;
  minimumLength?: number;
  maximumLength?: number;
  retryAfterMs?: number;
};

export function authErrorMessage(userError: AuthUserError) {
  switch (userError.error) {
    case "PASSWORD_TOO_SHORT":
      return `Use at least ${userError.minimumLength ?? MIN_PASSWORD_LENGTH} characters.`;
    case "PASSWORD_TOO_LONG":
      return `Use no more than ${userError.maximumLength ?? MAX_PASSWORD_LENGTH} characters.`;
    case "PASSWORD_HAS_SURROUNDING_WHITESPACE":
      return "Remove spaces from the beginning or end of the password.";
    case "PASSWORD_TOO_COMMON":
      return "Choose a less common password.";
    case "USERNAME_TOO_SHORT":
      return `Use at least ${userError.minimumLength ?? 1} character for the username.`;
    case "USERNAME_HAS_SURROUNDING_WHITESPACE":
      return "Remove spaces from the beginning or end of the username.";
    case "USERNAME_HAS_INVALID_CHARACTERS":
      return "The username contains unsupported or invisible characters.";
    case "USERNAME_TAKEN":
      return "That username is already in use.";
    case "USER_NOT_FOUND":
      return "No account exists for that username.";
    case "INVALID_CREDENTIALS":
      return "The username or password is incorrect.";
    case "RATE_LIMITED": {
      const seconds = Math.max(1, Math.ceil((userError.retryAfterMs ?? 1_000) / 1_000));
      return `Too many attempts. Try again in ${seconds} second${seconds === 1 ? "" : "s"}.`;
    }
    case "INVALID_PASSWORD":
      return "Choose a valid password.";
    case "INVALID_USERNAME":
      return "Choose a valid username.";
    case "OTHER_ERROR":
      return "An unexpected authentication error occurred. Please try again.";
    default:
      return "Authentication failed. Please try again.";
  }
}
