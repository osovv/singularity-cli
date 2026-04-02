import { defineCommand, runMain } from "citty";

const main = defineCommand({
  meta: {
    name: "singularity",
    version: "0.1.0",
    description: "CLI client for the Singularity task manager API",
  },
  async run() {
    console.log("Singularity CLI scaffold is ready. Run `bun run spec:sync` to refresh the OpenAPI snapshot.");
  },
});

await runMain(main);
