import type { InvoiceFolder } from "@/shared/ui/arc/InvoiceFileTree";
import type { RecipeFolder } from "@/shared/ui/arc/RecipeFileTree";
import type { ARCState, EventFolder, EventProject, UploadedFile } from "@/app/lib/core/shared/types";

export function loadRecipeFolders(key: string): RecipeFolder[] | null {
  const saved = localStorage.getItem(key);
  if (!saved) return null;
  try {
    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed)) return null;
    const hydrated: RecipeFolder[] = parsed
      .filter(Boolean)
      .map((f: any) => ({
        id: typeof f?.id === "string" && f.id ? f.id : crypto.randomUUID(),
        name: typeof f?.name === "string" && f.name.trim() ? f.name.trim() : "Folder",
        createdAt: typeof f?.createdAt === "number" ? f.createdAt : Date.now(),
      }));
    return hydrated;
  } catch {
    return null;
  }
}

export function loadInvoiceFolders(key: string): InvoiceFolder[] | null {
  const saved = localStorage.getItem(key);
  if (!saved) return null;
  try {
    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed)) return null;
    const hydrated: InvoiceFolder[] = parsed
      .filter(Boolean)
      .map((f: any) => ({
        id: typeof f?.id === "string" && f.id ? f.id : crypto.randomUUID(),
        name: typeof f?.name === "string" && f.name.trim() ? f.name.trim() : "Folder",
        createdAt: typeof f?.createdAt === "number" ? f.createdAt : Date.now(),
      }));
    return hydrated;
  } catch {
    return null;
  }
}

export function loadUploadedFiles(key: string): UploadedFile[] | null {
  const saved = localStorage.getItem(key);
  if (!saved) return null;
  try {
    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed)) return null;
    // Defensive: ensure each file has an id, and dedupe IDs
    const hydrated = parsed
      .filter(Boolean)
      .map((f: any) => {
        const name = typeof f?.name === "string" ? f.name : "Unknown";
        const size = typeof f?.size === "number" ? f.size : 0;
        const lastModified = typeof f?.lastModified === "number" ? f.lastModified : 0;
        const id = typeof f?.id === "string" && f.id ? f.id : `${name}-${size}-${lastModified}-${crypto.randomUUID()}`;
        return { ...f, id, lastModified };
      });
    // Deduplicate IDs - keep first occurrence, assign new IDs to duplicates
    const seen = new Set<string>();
    const deduped = hydrated.map((f: any) => {
      if (!seen.has(f.id)) {
        seen.add(f.id);
        return f;
      }
      // Duplicate ID found - assign a new unique ID
      const newId = `${f.id}-${crypto.randomUUID()}`;
      seen.add(newId);
      return { ...f, id: newId };
    });
    return deduped;
  } catch {
    return null;
  }
}

export function loadArcState(key: string): ARCState | null | undefined {
  const saved = localStorage.getItem(key);
  if (!saved) return undefined;
  try {
    return JSON.parse(saved);
  } catch {
    return undefined;
  }
}

export function saveArcState(key: string, arcState: ARCState) {
  localStorage.setItem(key, JSON.stringify(arcState));
}

export function saveUploadedFiles(key: string, uploadedFiles: UploadedFile[]) {
  // Persist uploaded files (exclude non-serializable File handles)
  const serializable = uploadedFiles.map((f) => {
    const { file, ...rest } = f;
    return rest;
  });
  localStorage.setItem(key, JSON.stringify(serializable));
}

export function saveRecipeFolders(key: string, recipeFolders: RecipeFolder[]) {
  localStorage.setItem(key, JSON.stringify(recipeFolders));
}

export function saveInvoiceFolders(key: string, invoiceFolders: InvoiceFolder[]) {
  localStorage.setItem(key, JSON.stringify(invoiceFolders));
}

export function loadEventProjects(key: string): EventProject[] | null {
  const saved = localStorage.getItem(key);
  if (!saved) return null;
  try {
    const parsed = JSON.parse(saved);
    if (Array.isArray(parsed)) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

export function loadEventFolders(key: string): EventFolder[] | null {
  const saved = localStorage.getItem(key);
  if (!saved) return null;
  try {
    const parsed = JSON.parse(saved);
    if (Array.isArray(parsed)) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

export function saveEventProjects(key: string, eventProjects: EventProject[]) {
  localStorage.setItem(key, JSON.stringify(eventProjects));
}

export function saveEventFolders(key: string, eventFolders: EventFolder[]) {
  localStorage.setItem(key, JSON.stringify(eventFolders));
}


