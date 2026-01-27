// Semantic filesystem backed by Mixedbread
import Mixedbread from "@mixedbread/sdk";

export interface FileMetadata {
  path?: string;
  type?: string;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

export interface FileResult {
  path: string;
  content: string;
  metadata: FileMetadata;
}

export interface FileError {
  error: string;
}

export interface FileListItem {
  path: string;
  metadata: FileMetadata;
}

export interface SearchResult {
  path: string;
  content: string;
  score: number;
  metadata: FileMetadata;
}

export class SemanticFS {
  private client: Mixedbread;
  private storeName: string;
  private initialized = false;

  constructor(apiKey: string, storeName = "bernd") {
    this.client = new Mixedbread({ apiKey });
    this.storeName = storeName;
  }

  private async ensureStore(): Promise<void> {
    if (this.initialized) return;

    const stores = await this.client.stores.list({ q: this.storeName });
    if (!stores.data || stores.data.length === 0) {
      await this.client.stores.create({
        name: this.storeName,
        description: "Semantic filesystem for Bernd",
        config: {
          contextualization: {
            with_metadata: [
              "type",
              "created_at",
              "updated_at",
              "priority",
              "status",
              "due_date",
              "tags",
            ],
          },
        },
      });
    }
    this.initialized = true;
  }

  private pathToId(path: string): string {
    let p = path.trim();
    if (p.startsWith("/")) {
      p = p.slice(1);
    }
    return p.replace(/\//g, "__");
  }

  private idToPath(fileId: string): string {
    return `/${fileId.replace(/__/g, "/")}`;
  }

  async write(
    path: string,
    content: string,
    metadata?: Record<string, unknown>,
  ): Promise<{ status: string; path: string }> {
    await this.ensureStore();
    const fileId = this.pathToId(path);
    const now = new Date().toISOString();

    // Preserve created_at if file exists
    let createdAt = now;
    try {
      const existing = await this.client.stores.files.retrieve(fileId, {
        store_identifier: this.storeName,
      });
      createdAt =
        ((existing.metadata as Record<string, unknown> | undefined)
          ?.created_at as string) ?? now;
      await this.client.stores.files.delete(fileId, {
        store_identifier: this.storeName,
      });
    } catch {
      // File doesn't exist, use current time
    }

    const filename = path.split("/").pop() ?? "file";
    const mimeType = filename.endsWith(".json")
      ? "text/plain"
      : "text/markdown";

    // Ensure content is not empty - Mixedbread API rejects 0-byte files
    const fileContent = content || " ";
    const blob = new Blob([fileContent], { type: mimeType });
    const file = new File([blob], filename, { type: mimeType });

    await this.client.stores.files.upload(this.storeName, file, {
      external_id: fileId,
      overwrite: true,
      metadata: {
        ...(metadata ?? {}),
        filename,
        size: blob.size,
        path,
        created_at: createdAt,
        updated_at: now,
      },
    });

    // Store metadata separately via update if supported
    // For now, encode metadata in the file content or use a different approach

    return { status: "ok", path };
  }

  async read(path: string): Promise<FileResult | FileError> {
    await this.ensureStore();
    const fileId = this.pathToId(path);

    try {
      const resp = await this.client.stores.files.retrieve(fileId, {
        store_identifier: this.storeName,
      });

      const contentResp = await this.client.files.content(resp.id);
      const content = await contentResp.text();

      return {
        path,
        content,
        metadata: (resp.metadata as FileMetadata) ?? {},
      };
    } catch (e) {
      console.error(`[SemanticFS] Error reading ${path}:`, e);
      return { error: `Not found: ${path}` };
    }
  }

  async delete(
    path: string,
  ): Promise<{ status: string; path: string } | FileError> {
    await this.ensureStore();
    const fileId = this.pathToId(path);

    try {
      await this.client.stores.files.delete(fileId, {
        store_identifier: this.storeName,
      });
      return { status: "deleted", path };
    } catch {
      return { error: `Not found: ${path}` };
    }
  }

  async list(prefix = "/", limit = 100): Promise<FileListItem[]> {
    await this.ensureStore();
    const prefixId = prefix !== "/" ? this.pathToId(prefix) : "";
    const files: FileListItem[] = [];
    let cursor: string | undefined;

    while (files.length < limit) {
      const resp = await this.client.stores.files.list(this.storeName, {
        limit: Math.min(100, limit - files.length),
        after: cursor,
      });

      for (const item of resp.data ?? []) {
        const externalId = item.external_id ?? "";
        if (prefix === "/" || externalId.startsWith(prefixId)) {
          files.push({
            path: this.idToPath(externalId),
            metadata: (item.metadata as FileMetadata) ?? {},
          });
        }
      }

      if (!resp.pagination?.has_more) break;
      cursor = resp.pagination?.last_cursor ?? undefined;
    }

    return files;
  }

  async search(
    query: string,
    prefix = "/",
    topK = 10,
  ): Promise<SearchResult[]> {
    await this.ensureStore();

    // Build metadata filter for prefix
    const filters =
      prefix !== "/"
        ? {
            key: "path",
            operator: "starts_with" as const,
            value: prefix,
          }
        : undefined;

    try {
      const resp = await this.client.stores.search({
        store_identifiers: [this.storeName],
        query,
        top_k: topK,
        filters,
      });

      return (resp.data ?? []).map((item) => {
        const metadata = (item.metadata as FileMetadata) ?? {};
        const path = metadata.path ?? `/${item.filename ?? ""}`;

        // Handle different chunk types
        let content = "";
        if ("text" in item && typeof item.text === "string") {
          content = item.text;
        }

        return {
          path,
          content,
          score: item.score ?? 0,
          metadata,
        };
      });
    } catch (e) {
      console.error("[SemanticFS] Search error:", e);
      return [];
    }
  }

  async clearPrefix(
    prefix: string,
  ): Promise<{ status: string; prefix: string; deleted: number }> {
    const files = await this.list(prefix, 1000);
    let deleted = 0;

    for (const f of files) {
      await this.delete(f.path);
      deleted++;
    }

    return { status: "cleared", prefix, deleted };
  }

  async writeBinary(
    path: string,
    data: ArrayBuffer,
    mimeType: string,
    metadata?: Record<string, unknown>,
  ): Promise<{ status: string; path: string }> {
    await this.ensureStore();
    const fileId = this.pathToId(path);
    const now = new Date().toISOString();

    // Delete existing file if present
    try {
      await this.client.stores.files.delete(fileId, {
        store_identifier: this.storeName,
      });
    } catch {
      // File doesn't exist
    }

    const filename = path.split("/").pop() ?? "file";
    const blob = new Blob([data], { type: mimeType });
    const file = new File([blob], filename, { type: mimeType });

    await this.client.stores.files.upload(this.storeName, file, {
      external_id: fileId,
      overwrite: true,
      metadata: {
        ...(metadata ?? {}),
        path,
        created_at: now,
        type: "binary",
      },
    });

    return { status: "ok", path };
  }

  async readBinary(
    path: string,
  ): Promise<
    { path: string; data: ArrayBuffer; metadata: FileMetadata } | FileError
  > {
    await this.ensureStore();
    const fileId = this.pathToId(path);

    try {
      const resp = await this.client.stores.files.retrieve(fileId, {
        store_identifier: this.storeName,
      });

      const contentResp = await this.client.files.content(resp.id);
      const data = await contentResp.arrayBuffer();

      return {
        path,
        data,
        metadata: (resp.metadata as FileMetadata) ?? {},
      };
    } catch (e) {
      console.error(`[SemanticFS] Error reading binary ${path}:`, e);
      return { error: `Not found: ${path}` };
    }
  }
}
