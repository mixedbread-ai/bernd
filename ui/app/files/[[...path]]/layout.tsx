"use client";

import { useParams } from "next/navigation";
import type { ReactNode } from "react";
import { FilesProvider } from "@/components/files/files-context";
import { FilesToolbar } from "@/components/files/files-toolbar";
import { PATHS } from "@/lib/constants";

interface FilesLayoutProps {
  children: ReactNode;
}

export default function FilesLayout({ children }: FilesLayoutProps) {
  const params = useParams<{ path?: string[] }>();
  const decodedPath = params.path?.map(decodeURIComponent);
  const currentPath = decodedPath
    ? `${PATHS.FILES}/${decodedPath.join("/")}`
    : PATHS.FILES;

  return (
    <FilesProvider currentPath={currentPath}>
      <div className="min-h-screen p-4 md:p-12 bg-background">
        <div className="mx-auto max-w-3xl">
          <FilesToolbar />
          {children}
        </div>
      </div>
    </FilesProvider>
  );
}
