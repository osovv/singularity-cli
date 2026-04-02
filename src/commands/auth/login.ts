// FILE: src/commands/auth/login.ts
// VERSION: 1.0.0
// START_MODULE_CONTRACT
//   PURPOSE: Save a Singularity API token after optionally validating it against the upstream API.
//   SCOPE: Token collection, optional validation, persistence, and auth override messaging.
//   DEPENDS: citty, src/lib/auth/index.ts
//   LINKS: M-AUTH-COMMANDS, M-AUTH-RUNTIME
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
//   loginCommand - `singu auth login` command definition.
// END_MODULE_MAP
//
// START_CHANGE_SUMMARY
//   LAST_CHANGE: [v1.0.0 - Added `singu auth login` with optional remote token validation.]
// END_CHANGE_SUMMARY

import { defineCommand } from "citty";

import { TOKEN_ENV_VAR, maskToken, promptForToken, resolveAuthState, saveAuthToken, validateToken } from "../../lib/auth/index.ts";

function formatValidationFailure(status: number, statusText: string, errorMessage?: string): string {
  if (status === 0) {
    return errorMessage ? `Token validation failed: ${errorMessage}` : "Token validation failed.";
  }

  return `Token validation failed: ${status} ${statusText}.`;
}

export const loginCommand = defineCommand({
  meta: {
    name: "login",
    description: "Save a Singularity API token locally",
  },
  args: {
    token: {
      type: "string",
      description: "Bearer token to store in the local config file",
    },
    check: {
      type: "boolean",
      description: "Validate the token against the API before saving",
      default: true,
    },
  },
  // START_BLOCK_EXECUTE_AUTH_LOGIN
  async run({ args }) {
    const token = args.token?.trim() || (await promptForToken());

    if (args.check) {
      const validation = await validateToken(token);

      if (!validation.ok) {
        throw new Error(formatValidationFailure(validation.status, validation.statusText, validation.errorMessage));
      }
    }

    const { configFilePath } = await saveAuthToken(token);
    const authState = await resolveAuthState();

    console.log(`Saved token to ${configFilePath}`);
    console.log(`Saved token: ${maskToken(token)}`);

    if (authState.hasEnvToken) {
      console.log(`${TOKEN_ENV_VAR} is set, so the environment token currently overrides the saved token.`);
    }
  },
  // END_BLOCK_EXECUTE_AUTH_LOGIN
});
