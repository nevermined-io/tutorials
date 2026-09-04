// Public GitHub URL for a tutorial, derived from its repoPath.
const REPO_BASE = "https://github.com/nevermined-io/tutorials/tree/main";

export function repoUrl(repoPath: string): string {
  return `${REPO_BASE}/${repoPath.replace(/\/+$/, "")}`;
}

// Link to a specific file (or subdir) inside a tutorial on GitHub.
const REPO_ROOT = "https://github.com/nevermined-io/tutorials";
export function repoFileUrl(repoPath: string, filePath: string): string {
  const dir = repoPath.replace(/\/+$/, "");
  const file = filePath.replace(/^\/+/, "");
  const kind = file.endsWith("/") ? "tree" : "blob";
  return `${REPO_ROOT}/${kind}/main/${dir}/${file.replace(/\/+$/, "")}`;
}
