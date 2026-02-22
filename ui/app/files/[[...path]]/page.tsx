import { listFilesAction } from "@/actions/files";
import { FilesList } from "@/components/files/files-list";
import { PATHS } from "@/lib/constants";

function safeDecodeURIComponent(str: string): string {
  try {
    return decodeURIComponent(str);
  } catch {
    return str;
  }
}

export default async function FilesPage({
  params,
}: PageProps<"/files/[[...path]]">) {
  const { path } = await params;
  const decodedPath = path?.map(safeDecodeURIComponent);
  const currentPath = decodedPath
    ? `${PATHS.FILES}/${decodedPath.join("/")}`
    : PATHS.FILES;
  const items = await listFilesAction(currentPath);

  return <FilesList items={items} />;
}
