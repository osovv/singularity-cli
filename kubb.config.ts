import { defineConfig } from "@kubb/core";
import { pluginClient } from "@kubb/plugin-client";
import { pluginOas } from "@kubb/plugin-oas";
import { pluginTs } from "@kubb/plugin-ts";

export default defineConfig({
  name: "singularity-v2",
  root: ".",
  input: {
    path: "./openapi/swagger.json",
  },
  output: {
    path: "./src/api/generated",
    clean: true,
    format: false,
    barrelType: "named",
  },
  plugins: [
    pluginOas(),
    pluginTs({
      output: {
        path: "./models",
        barrelType: "named",
      },
    }),
    pluginClient({
      output: {
        path: "./clients",
        barrelType: "named",
      },
      client: "fetch",
      baseURL: "https://api.singularity-app.com",
      paramsType: "object",
      pathParamsType: "object",
      operations: true,
      urlType: "export",
    }),
  ],
});
