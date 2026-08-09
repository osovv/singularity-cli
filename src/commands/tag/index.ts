// FILE: src/commands/tag/index.ts
// VERSION: 1.0.0
// PURPOSE: Register the `tag` command group for `singu`.

import { defineCommand } from "citty";

import { tagCreateCommand } from "./create.ts";
import { tagListCommand } from "./list.ts";

export const tagCommand = defineCommand({
  meta: {
    name: "tag",
    description: "Inspect and create Singularity tags",
  },
  subCommands: {
    list: tagListCommand,
    create: tagCreateCommand,
  },
});
