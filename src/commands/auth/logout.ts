// FILE: src/commands/auth/logout.ts
// VERSION: 1.0.0
// START_MODULE_CONTRACT
//   PURPOSE: Remove the saved auth token from local config storage.
//   SCOPE: Local token removal and environment override messaging.
//   DEPENDS: citty, src/lib/auth/index.ts
//   LINKS: M-AUTH-COMMANDS, M-AUTH-RUNTIME
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
//   logoutCommand - `singu auth logout` command definition.
// END_MODULE_MAP
//
// START_CHANGE_SUMMARY
//   LAST_CHANGE: [v1.0.0 - Added `singu auth logout` to remove the saved token.]
// END_CHANGE_SUMMARY

import { defineCommand } from "citty";

import { TOKEN_ENV_VAR, clearAuthToken, resolveAuthState } from "../../lib/auth/index.ts";

export const logoutCommand = defineCommand({
  meta: {
    name: "logout",
    description: "Remove the saved auth token",
  },
  // START_BLOCK_EXECUTE_AUTH_LOGOUT
  async run() {
    const result = await clearAuthToken();
    const authState = await resolveAuthState();

    console.log(
      result.hadSavedToken
        ? `Removed saved token from ${result.configFilePath}`
        : `No saved token was present at ${result.configFilePath}`,
    );

    if (authState.hasEnvToken) {
      console.log(`${TOKEN_ENV_VAR} is still set, so auth remains active from the environment.`);
    }
  },
  // END_BLOCK_EXECUTE_AUTH_LOGOUT
});
