import { readFile } from "node:fs/promises";
import ts from "typescript";
import { resolve as baseResolve } from "./typescript-loader.mjs";

export async function resolve(specifier, context, nextResolve) {
  if (specifier === "next/link" || specifier === "next/image") {
    const target = await nextResolve(`${specifier}.js`, context);
    // Match Next's compiler interop when rendering its CJS modules under native ESM.
    return { url: `data:text/javascript,${encodeURIComponent(`import component from ${JSON.stringify(target.url)}; export default component.default ?? component;`)}`, shortCircuit: true };
  }
  try { return await baseResolve(specifier, context, nextResolve); }
  catch (error) {
    if (specifier.startsWith(".") && !/\.[a-z]+$/.test(specifier)) return nextResolve(`${specifier}.tsx`, context);
    throw error;
  }
}

export async function load(url, context, nextLoad) {
  if (!url.endsWith(".tsx")) return nextLoad(url, context);
  const source = await readFile(new URL(url), "utf8");
  return { format: "module", shortCircuit: true, source: ts.transpileModule(source, {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  }).outputText };
}
