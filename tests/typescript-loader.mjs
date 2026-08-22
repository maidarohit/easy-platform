import { existsSync, statSync } from "node:fs";
import { resolve as resolvePath } from "node:path";
import { pathToFileURL } from "node:url";

function resolveAlias(specifier) {
  const basePath = resolvePath(process.cwd(), specifier.slice(2));
  const candidates = [
    basePath,
    `${basePath}.ts`,
    `${basePath}.tsx`,
    resolvePath(basePath, "index.ts"),
    resolvePath(basePath, "index.tsx"),
  ];

  const match = candidates.find(
    (candidate) => existsSync(candidate) && statSync(candidate).isFile(),
  );

  return match ? pathToFileURL(match).href : null;
}

export async function resolve(specifier, context, nextResolve) {
  if (specifier === "server-only") {
    return { url: "data:text/javascript,export%20{}", shortCircuit: true };
  }

  if (specifier === "next/headers") {
    return nextResolve("next/headers.js", context);
  }

  if (specifier.startsWith("@/")) {
    const url = resolveAlias(specifier);
    if (url) return { url, shortCircuit: true };
  }

  try {
    return await nextResolve(specifier, context);
  } catch (error) {
    if (
      error?.code === "ERR_UNSUPPORTED_DIR_IMPORT" &&
      (specifier.startsWith("./") || specifier.startsWith("../"))
    ) {
      return nextResolve(`${specifier}/index.ts`, context);
    }

    if (
      error?.code === "ERR_MODULE_NOT_FOUND" &&
      (specifier.startsWith("./") || specifier.startsWith("../")) &&
      !specifier.endsWith(".ts")
    ) {
      return nextResolve(`${specifier}.ts`, context);
    }

    throw error;
  }
}
