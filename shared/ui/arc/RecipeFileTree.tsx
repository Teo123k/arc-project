import React, { useMemo, useState } from "react";

const INSPIRATION_FOLDER_ID = "__inspiration__";

export type RecipeFolder = {
  id: string;
  name: string;
  createdAt: number;
};

export type RecipeTreeSelection =
  | { kind: "all" }
  | { kind: "unsorted" }
  | { kind: "folder"; folderId: string };

type RecipeLike = {
  id: string;
  role: "recipe" | "invoice" | "event" | "note";
  name: string;
  recipeFolderId?: string | null;
};

type Props = {
  recipes: RecipeLike[];
  folders: RecipeFolder[];
  selection: RecipeTreeSelection;
  onSelect: (next: RecipeTreeSelection) => void;
  onCreateFolder: (name: string) => void;
  onRenameFolder: (folderId: string, nextName: string) => void;
  onDeleteFolder: (folderId: string) => void;
};

function isActive(selection: RecipeTreeSelection, target: RecipeTreeSelection) {
  if (selection.kind !== target.kind) return false;
  switch (selection.kind) {
    case "all":
    case "unsorted":
      return true;
    case "folder":
      return selection.folderId === (target as any).folderId;
    default:
      return false;
  }
}

export function RecipeFileTree({
  recipes,
  folders,
  selection,
  onSelect,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
}: Props) {
  const [isCreating, setIsCreating] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const hasInspirationFolder = folders.some((f) => f.id === INSPIRATION_FOLDER_ID);

  const groupedFolders = useMemo(() => {
    const sorted = [...folders].sort((a, b) => a.name.localeCompare(b.name));
    const map = new Map<string, RecipeFolder[]>();

    for (const f of sorted) {
      const first = (f.name || "").trim()[0];
      const key = first ? first.toUpperCase() : "#";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(f);
    }

    return Array.from(map.entries()); // [ [header, folders[]], ... ]
  }, [folders]);

  return (
    <div className="p-2">
      <div className="flex items-center justify-between px-2 py-1">
        <div className="text-[11px] font-semibold text-[#4A331D]">Recipe folders</div>
        <button
          className="text-[11px] text-[#8A6A3A] hover:underline"
          onClick={() => {
            setIsCreating(true);
          }}
        >
          + New
        </button>
      </div>

      <div className="px-2 pb-1">
        {isCreating && (
          <div className="py-2 flex items-center gap-2">
            <input
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="Folder name"
              className="flex-1 px-2 py-1 text-xs rounded-md border border-[#C5B8A5] bg-white/60 text-[#4A331D]"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setIsCreating(false);
                  setNewFolderName("");
                }
                if (e.key === "Enter") {
                  const trimmed = newFolderName.trim();
                  if (!trimmed) return;
                  onCreateFolder(trimmed);
                  setIsCreating(false);
                  setNewFolderName("");
                }
              }}
            />
            <button
              className="px-2 py-1 text-xs rounded-md bg-[#E8DFD0] hover:bg-[#DED4C3] text-[#4A331D]"
              onClick={() => {
                const trimmed = newFolderName.trim();
                if (!trimmed) return;
                onCreateFolder(trimmed);
                setIsCreating(false);
                setNewFolderName("");
              }}
            >
              Create
            </button>
            <button
              className="px-2 py-1 text-xs rounded-md text-[#8A6A3A] hover:underline"
              onClick={() => {
                setIsCreating(false);
                setNewFolderName("");
              }}
            >
              Cancel
            </button>
          </div>
        )}

        <div className="text-[10px] uppercase tracking-wide text-[#8B7E6A] mb-1">Browse</div>
        <div className="space-y-0.5">
          <button
            className={`w-full text-left px-2 py-1 rounded text-[12px] ${
              isActive(selection, { kind: "all" }) ? "bg-[#E8DFD0] font-medium" : "hover:bg-[#F5ECDD]"
            }`}
            onClick={() => onSelect({ kind: "all" })}
          >
            My recipes
          </button>
          {hasInspirationFolder && (
            <button
              className={`w-full text-left px-2 py-1 rounded text-[12px] ${
                isActive(selection, { kind: "folder", folderId: INSPIRATION_FOLDER_ID })
                  ? "bg-[#E8DFD0] font-medium"
                  : "hover:bg-[#F5ECDD]"
              }`}
              onClick={() => onSelect({ kind: "folder", folderId: INSPIRATION_FOLDER_ID })}
            >
              Inspiration
            </button>
          )}
        </div>

        <div className="mt-3">
          <div className="text-[10px] uppercase tracking-wide text-[#8B7E6A] mb-1">Folders</div>
          {folders.length === 0 ? (
            <div className="text-[12px] text-[#8B7E6A] italic px-2 py-1">No folders yet</div>
          ) : (
            <div className="space-y-2">
              {groupedFolders.map(([header, list]) => (
                <div key={header}>
                  <div className="px-2 pt-1 pb-1 text-[10px] uppercase tracking-wider text-[#8B7E6A]">
                    {header}
                  </div>
                  <div className="space-y-0.5">
                    {list.map((f) => (
                      <div key={f.id} className="flex items-center gap-1 min-w-0">
                        <button
                          className={`flex-1 min-w-0 text-left px-2 py-1 rounded text-[12px] ${
                            isActive(selection, { kind: "folder", folderId: f.id })
                              ? "bg-[#E8DFD0] font-medium"
                              : "hover:bg-[#F5ECDD]"
                          }`}
                          onClick={() => onSelect({ kind: "folder", folderId: f.id })}
                          title={f.name}
                        >
                          <span className="truncate">{f.name}</span>
                        </button>
                        {f.id !== INSPIRATION_FOLDER_ID && (
                          <>
                            <button
                              className="shrink-0 text-[11px] text-[#8A6A3A] hover:underline px-1"
                              onClick={() => {
                                const nextName = window.prompt("Rename folder:", f.name);
                                if (!nextName) return;
                                const trimmed = nextName.trim();
                                if (!trimmed) return;
                                onRenameFolder(f.id, trimmed);
                              }}
                              title="Rename"
                            >
                              Edit
                            </button>
                            <button
                              className="shrink-0 text-[11px] text-[#8A6A3A] hover:underline px-1"
                              onClick={() => {
                                const ok = window.confirm(
                                  `Delete folder "${f.name}"?\n\nRecipes will be moved to Unsorted (not deleted).`
                                );
                                if (!ok) return;
                                onDeleteFolder(f.id);
                              }}
                              title="Delete folder"
                            >
                              Remove
                            </button>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}



