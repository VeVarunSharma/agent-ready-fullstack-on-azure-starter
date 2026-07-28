import { cp } from "node:fs/promises";
import { fileURLToPath, URL } from "node:url";

const source = fileURLToPath(new URL("../.next/static", import.meta.url));
const destination = fileURLToPath(
  new URL("../.next/standalone/apps/web/.next/static", import.meta.url),
);

await cp(source, destination, { recursive: true });
