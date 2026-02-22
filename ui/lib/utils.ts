export function pathToId(path: string, ext = ".md"): string {
  const filename = path.split("/").pop() ?? "";
  return filename.replace(ext, "");
}

export function generateTimestamp(): string {
  const now = new Date();
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}
