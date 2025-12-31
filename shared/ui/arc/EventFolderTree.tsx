"use client";

import { useState, useRef, useEffect, useMemo } from "react";

// ────────────────────────────────────────────────────────────────────────────
// TYPES
// ────────────────────────────────────────────────────────────────────────────

type EventFolder = {
  id: string;
  name: string;
  createdAt: number;
  isHeader?: boolean;
  parentId?: string | null;
};

type EventProject = {
  id: string;
  name: string;
  phase: string;
  folderId?: string | null;
  verdict?: "proceed" | "adjust" | "decline" | null;
};

type TreeSelection =
  | { kind: "all" }
  | { kind: "folder"; folderId: string };

interface EventFolderTreeProps {
  events: EventProject[];
  folders: EventFolder[];
  selection: TreeSelection;
  onSelect: (selection: TreeSelection) => void;
  onCreateFolder: (name: string, parentId?: string | null, isHeader?: boolean) => void;
  onRenameFolder: (id: string, newName: string) => void;
  onDeleteFolder: (id: string) => void;
  onSelectEvent: (eventId: string) => void;
  onCreateEvent: () => void;
}

// ────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ────────────────────────────────────────────────────────────────────────────

export function EventFolderTree({
  events,
  folders,
  selection,
  onSelect,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
  onSelectEvent,
  onCreateEvent,
}: EventFolderTreeProps) {
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [expandedHeaders, setExpandedHeaders] = useState<Set<string>>(new Set());
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  
  // Inline header creation between items
  const [hoverZoneId, setHoverZoneId] = useState<string | null>(null);
  const [creatingHeaderAt, setCreatingHeaderAt] = useState<string | null>(null);
  const [newHeaderName, setNewHeaderName] = useState("");
  
  // Inline folder creation within header
  const [creatingFolderInHeader, setCreatingFolderInHeader] = useState<string | null>(null);
  const [newSubFolderName, setNewSubFolderName] = useState("");

  const newFolderInputRef = useRef<HTMLInputElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);
  const headerInputRef = useRef<HTMLInputElement>(null);
  const subFolderInputRef = useRef<HTMLInputElement>(null);

  // Focus inputs when they appear
  useEffect(() => {
    if (isCreatingFolder && newFolderInputRef.current) {
      newFolderInputRef.current.focus();
    }
  }, [isCreatingFolder]);

  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingId]);

  useEffect(() => {
    if (creatingHeaderAt && headerInputRef.current) {
      headerInputRef.current.focus();
    }
  }, [creatingHeaderAt]);

  useEffect(() => {
    if (creatingFolderInHeader && subFolderInputRef.current) {
      subFolderInputRef.current.focus();
    }
  }, [creatingFolderInHeader]);

  // Organize folders: headers at top level, regular folders under headers
  const headers = useMemo(() => 
    folders.filter((f) => f.isHeader && !f.parentId), 
    [folders]
  );

  const getFoldersInHeader = (headerId: string) =>
    folders.filter((f) => f.parentId === headerId && !f.isHeader);

  const getEventsInFolder = (folderId: string) =>
    events.filter((e) => e.folderId === folderId);

  const rootFolders = useMemo(() =>
    folders.filter((f) => !f.parentId && !f.isHeader),
    [folders]
  );

  // Unsorted events (not in any folder)
  const unsortedEvents = useMemo(() =>
    events.filter((e) => !e.folderId),
    [events]
  );

  const toggleHeader = (headerId: string) => {
    setExpandedHeaders((prev) => {
      const next = new Set(prev);
      if (next.has(headerId)) {
        next.delete(headerId);
      } else {
        next.add(headerId);
      }
      return next;
    });
  };

  const toggleFolder = (folderId: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
      }
      return next;
    });
  };

  const handleCreateFolder = () => {
    if (newFolderName.trim()) {
      onCreateFolder(newFolderName.trim());
      setNewFolderName("");
      setIsCreatingFolder(false);
    }
  };

  const handleStartEdit = (folder: EventFolder) => {
    setEditingId(folder.id);
    setEditingName(folder.name);
  };

  const handleSaveEdit = () => {
    if (editingId && editingName.trim()) {
      onRenameFolder(editingId, editingName.trim());
    }
    setEditingId(null);
    setEditingName("");
  };

  const handleCreateHeader = () => {
    if (newHeaderName.trim()) {
      onCreateFolder(newHeaderName.trim(), null, true);
      setNewHeaderName("");
      setCreatingHeaderAt(null);
    }
  };

  const handleCreateSubFolder = (headerId: string) => {
    if (newSubFolderName.trim()) {
      onCreateFolder(newSubFolderName.trim(), headerId, false);
      setNewSubFolderName("");
      setCreatingFolderInHeader(null);
    }
  };

  const getVerdictIcon = (verdict: EventProject["verdict"]) => {
    if (verdict === "proceed") return "✓";
    if (verdict === "adjust") return "↻";
    if (verdict === "decline") return "✗";
    return "○";
  };

  const getVerdictColor = (verdict: EventProject["verdict"]) => {
    if (verdict === "proceed") return "text-green-600";
    if (verdict === "adjust") return "text-amber-600";
    if (verdict === "decline") return "text-red-600";
    return "text-[#8B7E6A]";
  };

  // Render event item
  const renderEvent = (event: EventProject, indent = 0) => (
    <button
      key={event.id}
      onClick={() => onSelectEvent(event.id)}
      className="w-full flex items-center gap-2 px-3 py-1.5 text-left hover:bg-[#F5ECDD] rounded-lg transition"
      style={{ paddingLeft: `${12 + indent * 12}px` }}
    >
      <span className={`text-xs ${getVerdictColor(event.verdict)}`}>
        {getVerdictIcon(event.verdict)}
      </span>
      <span className="text-xs text-[#4A331D] truncate flex-1" title={event.name}>
        {event.name}
      </span>
    </button>
  );

  // Render folder (non-header)
  const renderFolder = (folder: EventFolder, indent = 0) => {
    const isSelected = selection.kind === "folder" && selection.folderId === folder.id;
    const isEditing = editingId === folder.id;
    const isExpanded = expandedFolders.has(folder.id);
    const eventsInFolder = getEventsInFolder(folder.id);

    return (
      <div key={folder.id}>
        {/* Folder row */}
        <div
          className={`group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition ${
            isSelected ? "bg-[#E8DFD0]" : "hover:bg-[#F5ECDD]"
          }`}
          style={{ paddingLeft: `${12 + indent * 12}px` }}
          onClick={() => {
            if (!isEditing) {
              onSelect({ kind: "folder", folderId: folder.id });
              if (eventsInFolder.length > 0) toggleFolder(folder.id);
            }
          }}
        >
          {eventsInFolder.length > 0 && (
            <span className="text-[#8B7E6A] text-xs w-4">
              {isExpanded ? "▼" : "▶"}
            </span>
          )}
          {eventsInFolder.length === 0 && (
            <span className="text-[#8B7E6A] text-xs w-4">▶</span>
          )}
          
          {isEditing ? (
            <input
              ref={editInputRef}
              type="text"
              value={editingName}
              onChange={(e) => setEditingName(e.target.value)}
              onBlur={handleSaveEdit}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSaveEdit();
                if (e.key === "Escape") {
                  setEditingId(null);
                  setEditingName("");
                }
              }}
              className="flex-1 px-2 py-0.5 text-sm bg-white border border-[#C5B8A5] rounded focus:outline-none min-w-0"
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span className="flex-1 text-sm text-[#4A331D] truncate min-w-0" title={folder.name}>
              {folder.name}
            </span>
          )}

          {/* Hover actions */}
          {!isEditing && (
            <div className="hidden group-hover:flex items-center gap-1 shrink-0">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleStartEdit(folder);
                }}
                className="p-1 text-[#8B7E6A] hover:text-[#4A331D] text-xs"
                title="Rename"
              >
                ✎
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteFolder(folder.id);
                }}
                className="p-1 text-[#8B7E6A] hover:text-red-500 text-xs"
                title="Delete"
              >
                🗑
              </button>
            </div>
          )}
        </div>

        {/* Events in folder */}
        {isExpanded && eventsInFolder.length > 0 && (
          <div className="ml-4 border-l border-[#E0D4BF]">
            {eventsInFolder.map((event) => renderEvent(event, indent + 1))}
          </div>
        )}
      </div>
    );
  };

  // Render header (collapsible section)
  const renderHeader = (header: EventFolder) => {
    const isExpanded = expandedHeaders.has(header.id);
    const childFolders = getFoldersInHeader(header.id);
    const isEditing = editingId === header.id;

    return (
      <div key={header.id} className="mb-1">
        {/* Header row */}
        <div
          className="group flex items-center gap-2 px-2 py-1.5 cursor-pointer hover:bg-[#F5ECDD] rounded-lg transition"
          onClick={() => !isEditing && toggleHeader(header.id)}
        >
          <span className="text-[#8B7E6A] text-xs w-4">
            {isExpanded ? "▼" : "▶"}
          </span>
          
          {isEditing ? (
            <input
              ref={editInputRef}
              type="text"
              value={editingName}
              onChange={(e) => setEditingName(e.target.value)}
              onBlur={handleSaveEdit}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSaveEdit();
                if (e.key === "Escape") {
                  setEditingId(null);
                  setEditingName("");
                }
              }}
              className="flex-1 px-2 py-0.5 text-xs font-semibold bg-white border border-[#C5B8A5] rounded focus:outline-none min-w-0"
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span className="flex-1 text-xs font-semibold text-[#4A331D] uppercase tracking-wider truncate min-w-0" title={header.name}>
              {header.name}
            </span>
          )}

          {/* Hover actions */}
          {!isEditing && (
            <div className="hidden group-hover:flex items-center gap-1 shrink-0">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setCreatingFolderInHeader(header.id);
                }}
                className="p-1 text-[#8B7E6A] hover:text-[#4A331D] text-xs"
                title="Add folder"
              >
                +
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleStartEdit(header);
                }}
                className="p-1 text-[#8B7E6A] hover:text-[#4A331D] text-xs"
                title="Rename"
              >
                ✎
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteFolder(header.id);
                }}
                className="p-1 text-[#8B7E6A] hover:text-red-500 text-xs"
                title="Delete"
              >
                🗑
              </button>
            </div>
          )}
        </div>

        {/* Child folders and inline creation */}
        {isExpanded && (
          <div className="ml-2">
            {childFolders.map((folder) => renderFolder(folder, 1))}
            
            {/* Inline folder creation */}
            {creatingFolderInHeader === header.id && (
              <div className="px-3 py-1" style={{ paddingLeft: "24px" }}>
                <input
                  ref={subFolderInputRef}
                  type="text"
                  value={newSubFolderName}
                  onChange={(e) => setNewSubFolderName(e.target.value)}
                  onBlur={() => {
                    if (!newSubFolderName.trim()) {
                      setCreatingFolderInHeader(null);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleCreateSubFolder(header.id);
                    if (e.key === "Escape") {
                      setCreatingFolderInHeader(null);
                      setNewSubFolderName("");
                    }
                  }}
                  placeholder="Folder name..."
                  className="w-full px-2 py-1 text-xs bg-white border border-[#C5B8A5] rounded focus:outline-none"
                />
              </div>
            )}
            
            {childFolders.length === 0 && creatingFolderInHeader !== header.id && (
              <button
                onClick={() => setCreatingFolderInHeader(header.id)}
                className="w-full px-6 py-2 text-xs text-[#8B7E6A] hover:text-[#4A331D] text-left"
              >
                + Add folder
              </button>
            )}
          </div>
        )}
      </div>
    );
  };

  // Render hover zone for creating headers inline between items
  const renderHoverZone = (position: string) => (
    <div
      className="relative h-2 -my-1"
      onMouseEnter={() => setHoverZoneId(position)}
      onMouseLeave={() => setHoverZoneId(null)}
    >
      {hoverZoneId === position && !creatingHeaderAt && (
        <button
          onClick={() => setCreatingHeaderAt(position)}
          className="absolute inset-x-2 top-1/2 -translate-y-1/2 h-0.5 bg-[#C5B8A5] opacity-50 hover:opacity-100 transition rounded"
          title="Insert header here"
        />
      )}
      {creatingHeaderAt === position && (
        <div className="absolute left-0 right-0 top-0 z-10">
          <input
            ref={headerInputRef}
            type="text"
            value={newHeaderName}
            onChange={(e) => setNewHeaderName(e.target.value)}
            onBlur={() => {
              if (!newHeaderName.trim()) {
                setCreatingHeaderAt(null);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCreateHeader();
              if (e.key === "Escape") {
                setCreatingHeaderAt(null);
                setNewHeaderName("");
              }
            }}
            placeholder="Header name..."
            className="w-full px-2 py-1 text-xs font-semibold uppercase bg-white border border-[#C5B8A5] rounded shadow-sm focus:outline-none"
          />
        </div>
      )}
    </div>
  );

  return (
    <div className="text-sm">
      {/* All Events button */}
      <button
        onClick={() => onSelect({ kind: "all" })}
        className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg transition text-left ${
          selection.kind === "all" ? "bg-[#E8DFD0]" : "hover:bg-[#F5ECDD]"
        }`}
      >
        <span className="text-[#8B7E6A]">📋</span>
        <span className="text-sm font-medium text-[#4A331D]">All Events</span>
        <span className="text-xs text-[#8B7E6A] ml-auto">{events.length}</span>
      </button>

      {/* New events are created only via + New Project (intentional, one entry point). */}

      <div className="my-3 border-t border-[#E0D4BF]" />

      {/* Hover zone at top for creating first header */}
      {renderHoverZone("top")}

      {/* Headers */}
      {headers.map((header, idx) => (
        <div key={header.id}>
          {renderHeader(header)}
          {renderHoverZone(`after-header-${header.id}`)}
        </div>
      ))}

      {/* Root folders (not under any header) */}
      {rootFolders.length > 0 && (
        <div className="mt-2">
          {rootFolders.map((folder) => (
            <div key={folder.id}>
              {renderHoverZone(`before-folder-${folder.id}`)}
              {renderFolder(folder)}
            </div>
          ))}
        </div>
      )}

      {/* Unsorted events (not in any folder) */}
      {unsortedEvents.length > 0 && (
        <div className="mt-2">
          <div className="px-2 py-1 text-[10px] uppercase tracking-wider text-[#8B7E6A]">
            Unsorted
          </div>
          {unsortedEvents.map((event) => renderEvent(event, 0))}
        </div>
      )}

      {/* Create new folder */}
      {isCreatingFolder ? (
        <div className="mt-2 px-3">
          <input
            ref={newFolderInputRef}
            type="text"
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            onBlur={() => {
              if (!newFolderName.trim()) setIsCreatingFolder(false);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCreateFolder();
              if (e.key === "Escape") {
                setIsCreatingFolder(false);
                setNewFolderName("");
              }
            }}
            placeholder="Folder name..."
            className="w-full px-2 py-1.5 text-sm bg-white border border-[#C5B8A5] rounded-lg focus:outline-none"
          />
        </div>
      ) : (
        <button
          onClick={() => setIsCreatingFolder(true)}
          className="w-full flex items-center gap-2 px-3 py-2 mt-2 rounded-lg text-[#8B7E6A] hover:text-[#4A331D] hover:bg-[#F5ECDD] transition text-left"
        >
          <span>+</span>
          <span className="text-sm">New Folder</span>
        </button>
      )}
    </div>
  );
}

export type { EventFolder, TreeSelection };
