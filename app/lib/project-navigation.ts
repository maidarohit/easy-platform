export function withProjectId(path: string, projectId: string) {
  const trimmedProjectId = projectId.trim();
  if (!trimmedProjectId) return path;

  const [pathWithoutHash, hash = ""] = path.split("#", 2);
  const [pathname, query = ""] = pathWithoutHash.split("?", 2);
  const params = new URLSearchParams(query);
  params.set("projectId", trimmedProjectId);
  const search = params.toString();

  return `${pathname}${search ? `?${search}` : ""}${hash ? `#${hash}` : ""}`;
}
