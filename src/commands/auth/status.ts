// FILE: src/commands/auth/status.ts
// VERSION: 1.0.0
// START_MODULE_CONTRACT
//   PURPOSE: Report the current auth token source and optionally validate it against the API.
//   SCOPE: Auth state inspection, optional remote validation, and terminal-friendly status output.
//   DEPENDS: citty, src/lib/auth/index.ts
//   LINKS: M-AUTH-COMMANDS, M-AUTH-RUNTIME
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
//   statusCommand - `singu auth status` command definition.
// END_MODULE_MAP
//
// START_CHANGE_SUMMARY
//   LAST_CHANGE: [v1.0.0 - Added `singu auth status` with optional remote validation.]
// END_CHANGE_SUMMARY

import { defineCommand } from "citty";

import { TOKEN_ENV_VAR, resolveAuthState, validateToken } from "../../lib/auth/index.ts";

export const statusCommand = defineCommand({
  meta: {
    name: "status",
    description: "Show the current auth token source and health",
  },
  args: {
    check: {
      type: "boolean",
      description: "Validate the active token against the API",
      default: false,
    },
  },
  // START_BLOCK_EXECUTE_AUTH_STATUS
  async run({ args }) {
    const authState = await resolveAuthState();

    console.log(`Binary: singu`);
    console.log(`Config file: ${authState.configFilePath}`);
    console.log(`Saved token: ${authState.hasSavedToken ? "present" : "missing"}`);
    console.log(`Environment token: ${authState.hasEnvToken ? `present (${TOKEN_ENV_VAR})` : "missing"}`);
    console.log(`Active token source: ${authState.source}`);
    console.log(`Active token: ${authState.maskedToken ?? "missing"}`);

    if (authState.hasEnvToken && authState.hasSavedToken) {
      console.log(`${TOKEN_ENV_VAR} currently overrides the saved token.`);
    }

    if (!authState.token) {
      if (args.check) {
        process.exitCode = 1;
        console.log("Validation: skipped (no token available)");
      }

      return;
    }

    if (!args.check) {
      return;
    }

    const validation = await validateToken(authState.token);

    if (validation.ok) {
      console.log(`Validation: ok (${validation.status} ${validation.statusText})`);
      return;
    }

    process.exitCode = 1;

    if (validation.status === 0) {
      console.log(`Validation: failed (${validation.errorMessage ?? validation.statusText})`);
      return;
    }

    console.log(`Validation: failed (${validation.status} ${validation.statusText})`);
  },
  // END_BLOCK_EXECUTE_AUTH_STATUS
});
