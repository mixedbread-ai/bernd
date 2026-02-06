"use client";

import { useRouter } from "next/navigation";
import {
  createContext,
  type ReactNode,
  type RefObject,
  useContext,
  useRef,
  useState,
} from "react";

interface NewFile {
  name: string;
  content: string;
}

interface FilesContextValue {
  currentPath: string;
  showNewFolder: boolean;
  setShowNewFolder: (show: boolean) => void;
  newFile: NewFile | null;
  setNewFile: (file: NewFile | null) => void;
  uploading: boolean;
  setUploading: (uploading: boolean) => void;
  fileInputRef: RefObject<HTMLInputElement | null>;
  refresh: () => void;
}

const FilesContext = createContext<FilesContextValue | null>(null);

interface FilesProviderProps {
  children: ReactNode;
  currentPath: string;
}

export function FilesProvider({ children, currentPath }: FilesProviderProps) {
  const router = useRouter();
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFile, setNewFile] = useState<NewFile | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function refresh() {
    router.refresh();
  }

  return (
    <FilesContext.Provider
      value={{
        currentPath,
        showNewFolder,
        setShowNewFolder,
        newFile,
        setNewFile,
        uploading,
        setUploading,
        fileInputRef,
        refresh,
      }}
    >
      {children}
    </FilesContext.Provider>
  );
}

export function useFilesContext() {
  const context = useContext(FilesContext);
  if (!context) {
    throw new Error("useFilesContext must be used within a FilesProvider");
  }
  return context;
}
