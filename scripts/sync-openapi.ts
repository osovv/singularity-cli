import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const swaggerUiInitUrl = "https://api.singularity-app.com/v2/api/swagger-ui-init.js";
const outputFilePath = resolve(import.meta.dir, "..", "openapi", "swagger.json");

type SwaggerUiOptions = {
  swaggerDoc?: unknown;
};

function extractSwaggerDoc(source: string): unknown {
  const match = source.match(/let options = (\{[\s\S]*?\});\s+url = options\.swaggerUrl/);

  if (!match?.[1]) {
    throw new Error("Unable to locate swaggerDoc in swagger-ui-init.js");
  }

  const options = JSON.parse(match[1]) as SwaggerUiOptions;

  if (!options.swaggerDoc || typeof options.swaggerDoc !== "object") {
    throw new Error("swaggerDoc was missing from extracted Swagger UI options");
  }

  return options.swaggerDoc;
}

async function main(): Promise<void> {
  const response = await fetch(swaggerUiInitUrl);

  if (!response.ok) {
    throw new Error(`Failed to fetch Swagger UI init file: ${response.status} ${response.statusText}`);
  }

  const source = await response.text();
  const swaggerDoc = extractSwaggerDoc(source);

  await mkdir(dirname(outputFilePath), { recursive: true });
  await Bun.write(outputFilePath, `${JSON.stringify(swaggerDoc, null, 2)}\n`);

  console.log(`Saved OpenAPI snapshot to ${outputFilePath}`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);

  console.error(message);
  process.exitCode = 1;
});
