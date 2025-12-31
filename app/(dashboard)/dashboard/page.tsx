"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import ARCChat from "@/shared/ui/arc/ARCChat";
import { extractFilesContent } from "@/app/lib/arc/fileExtraction";
import { RecipeFrame } from "@/shared/ui/arc/RecipeFrame";
import { resolveCanonicalRecipe, type CanonicalRecipe } from "@/app/lib/arc/recipe/resolveCanonicalRecipe";
import { RecipeFileTree, type RecipeFolder, type RecipeTreeSelection } from "@/shared/ui/arc/RecipeFileTree";
import { InvoiceFileTree, type InvoiceFolder, type InvoiceTreeSelection } from "@/shared/ui/arc/InvoiceFileTree";
import { NewProjectPage } from "@/shared/ui/arc/NewProjectPage";
import { EventFolderTree } from "@/shared/ui/arc/EventFolderTree";
import type { ARCState, EventFolder, EventProject, InvoiceIntelligence, UploadedFile } from "@/app/lib/core/shared/types";
import {
  loadArcState,
  loadEventFolders,
  loadEventProjects,
  loadInvoiceFolders,
  loadRecipeFolders,
  loadUploadedFiles,
  saveArcState,
  saveEventFolders,
  saveEventProjects,
  saveInvoiceFolders,
  saveRecipeFolders,
  saveUploadedFiles,
} from "./storage";
import { triggerRoleUpload as triggerRoleUploadController } from "./uploadController";

const STORAGE_KEY = "arc.state";
const UPLOADED_FILES_KEY = "arc.uploadedFiles.v1";
const RECIPE_FOLDERS_KEY = "arc.recipeFolders.v1";
const INVOICE_FOLDERS_KEY = "arc.invoiceFolders.v1";

const EVENT_PROJECTS_KEY = "arc.eventProjects.v1";
const EVENT_FOLDERS_KEY = "arc.eventFolders.v1";

export default function DashboardPage() {
  const [mounted, setMounted] = useState(false);
  const [arcState, setArcState] = useState<ARCState>({
    arcOutput: null,
  });
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [extractingFiles, setExtractingFiles] = useState(false);
  const [selectedRecipeId, setSelectedRecipeId] = useState<string | null>(null);
  const [isRecipeFrameOpen, setIsRecipeFrameOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [recipeFolders, setRecipeFolders] = useState<RecipeFolder[]>([]);
  const [recipeTreeSelection, setRecipeTreeSelection] = useState<RecipeTreeSelection>({ kind: "all" });
  const [isFolderEditMode, setIsFolderEditMode] = useState(false);
  const [selectedRecipeIds, setSelectedRecipeIds] = useState<Set<string>>(new Set());
  const [moveFolderTarget, setMoveFolderTarget] = useState<string>("");

  // Invoices mirror the recipe folder/edit model
  const [invoiceFolders, setInvoiceFolders] = useState<InvoiceFolder[]>([]);
  const [invoiceTreeSelection, setInvoiceTreeSelection] = useState<InvoiceTreeSelection>({ kind: "all" });
  const [isInvoiceEditMode, setIsInvoiceEditMode] = useState(false);
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<Set<string>>(new Set());
  const [moveInvoiceFolderTarget, setMoveInvoiceFolderTarget] = useState<string>("");
  // Invoice viewing (inline frame, like recipes)
  const [viewingInvoiceId, setViewingInvoiceId] = useState<string | null>(null);
  const [isInvoiceFrameOpen, setIsInvoiceFrameOpen] = useState(false);
  const [canvasTab, setCanvasTab] = useState<
    "verdict" | "financials" | "operations" | "risks" | "next"
  >("verdict");

  // ────────────────────────────────────────────────────────────────────────────
  // EVENT PROJECT STATE
  // ────────────────────────────────────────────────────────────────────────────
  const [eventProjects, setEventProjects] = useState<EventProject[]>([]);
  const [eventFolders, setEventFolders] = useState<EventFolder[]>([]);
  const [activeEventId, setActiveEventId] = useState<string | null>(null);
  const [showNewProjectPage, setShowNewProjectPage] = useState(false);
  // UI-only view state (does NOT affect OCR or logic)
  const [currentView, setCurrentView] = useState<
    "home" | "library" | "new-project"
  >("new-project");
  const [showChat, setShowChat] = useState(true);
  // Library internal routing (UI only)
  const [libraryTab, setLibraryTab] = useState<"recipes" | "invoices">("recipes");

  const confirmedRecipes = uploadedFiles.filter(
    f =>
      f.role === "recipe" &&
      f.recipeIntelligence?.lifecycleState === "user_confirmed" &&
      (f as any).canonicalRecipe
  );

  const categories = Array.from(
    new Set(
      confirmedRecipes
        .map(f => (f as any).canonicalRecipe!.occasion?.value)
        .filter(Boolean)
    )
  ) as string[];

  const visibleRecipes =
    selectedCategory === null
      ? uploadedFiles
      : uploadedFiles.filter(
          f =>
            (f as any).canonicalRecipe?.occasion?.value === selectedCategory
        );

  const recipeFiles = useMemo(
    () => visibleRecipes.filter((f) => f.role === "recipe"),
    [visibleRecipes]
  );

  const filteredRecipeFiles = useMemo(() => {
    const sel = recipeTreeSelection;
    if (sel.kind === "all") return recipeFiles;
    if (sel.kind === "unsorted") return recipeFiles.filter((r) => !r.recipeFolderId);
    if (sel.kind === "folder") return recipeFiles.filter((r) => r.recipeFolderId === sel.folderId);
    return recipeFiles;
  }, [recipeFiles, recipeTreeSelection]);

  const invoiceFiles = useMemo(
    () => uploadedFiles.filter((f) => f.role === "invoice"),
    [uploadedFiles]
  );

  const filteredInvoiceFiles = useMemo(() => {
    const sel = invoiceTreeSelection;
    if (sel.kind === "all") return invoiceFiles;
    if (sel.kind === "folder") return invoiceFiles.filter((i) => i.invoiceFolderId === sel.folderId);
    return invoiceFiles;
  }, [invoiceFiles, invoiceTreeSelection]);

  const selectedRecipeFile = useMemo(() => {
    if (!selectedRecipeId) return null;
    const found = uploadedFiles.find((f) => f.id === selectedRecipeId);
    return found ?? null;
  }, [uploadedFiles, selectedRecipeId]);

  const viewingInvoice = useMemo(() => {
    if (!viewingInvoiceId) return null;
    return uploadedFiles.find((f) => f.id === viewingInvoiceId) ?? null;
  }, [uploadedFiles, viewingInvoiceId]);

  const createRecipeFolder = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setRecipeFolders((prev) => [
      ...prev,
      { id: crypto.randomUUID(), name: trimmed, createdAt: Date.now() },
    ]);
  };

  const renameRecipeFolder = (folderId: string, nextName: string) => {
    const trimmed = nextName.trim();
    if (!trimmed) return;
    setRecipeFolders((prev) =>
      prev.map((f) => (f.id === folderId ? { ...f, name: trimmed } : f))
    );
  };

  const deleteRecipeFolder = (folderId: string) => {
    setRecipeFolders((prev) => prev.filter((f) => f.id !== folderId));
    setUploadedFiles((prev) =>
      prev.map((f) => {
        if (f.role !== "recipe") return f;
        if (f.recipeFolderId !== folderId) return f;
        return { ...f, recipeFolderId: null };
      })
    );
    setRecipeTreeSelection((sel) => {
      // Folder got deleted; keep the UI in a reachable state (folder tree no longer shows "Unsorted").
      if (sel.kind === "folder" && sel.folderId === folderId) return { kind: "all" };
      return sel;
    });
  };

  const createInvoiceFolder = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setInvoiceFolders((prev) => [
      ...prev,
      { id: crypto.randomUUID(), name: trimmed, createdAt: Date.now() },
    ]);
  };

  const renameInvoiceFolder = (folderId: string, nextName: string) => {
    const trimmed = nextName.trim();
    if (!trimmed) return;
    setInvoiceFolders((prev) =>
      prev.map((f) => (f.id === folderId ? { ...f, name: trimmed } : f))
    );
  };

  const deleteInvoiceFolder = (folderId: string) => {
    setInvoiceFolders((prev) => prev.filter((f) => f.id !== folderId));
    setUploadedFiles((prev) =>
      prev.map((f) => {
        if (f.role !== "invoice") return f;
        if (f.invoiceFolderId !== folderId) return f;
        return { ...f, invoiceFolderId: null };
      })
    );
    setInvoiceTreeSelection((sel) => {
      if (sel.kind === "folder" && sel.folderId === folderId) return { kind: "all" };
      return sel;
    });
  };

  const deleteSelectedRecipes = () => {
    if (selectedRecipeIds.size === 0) return;
    const ok = window.confirm(
      `Delete ${selectedRecipeIds.size} recipe(s)?\n\nThis permanently removes them from the library.`
    );
    if (!ok) return;

    setUploadedFiles((prev) =>
      prev.filter((f) => !(f.role === "recipe" && selectedRecipeIds.has(f.id)))
    );

    if (selectedRecipeId && selectedRecipeIds.has(selectedRecipeId)) {
      setSelectedRecipeId(null);
      setIsRecipeFrameOpen(false);
    }

    setSelectedRecipeIds(new Set());
    setMoveFolderTarget("");
  };

  const deleteSelectedInvoices = () => {
    if (selectedInvoiceIds.size === 0) return;
    const ok = window.confirm(
      `Delete ${selectedInvoiceIds.size} invoice(s)?\n\nThis permanently removes them from the library.`
    );
    if (!ok) return;
    setUploadedFiles((prev) =>
      prev.filter((f) => !(f.role === "invoice" && selectedInvoiceIds.has(f.id)))
    );
    setSelectedInvoiceIds(new Set());
    setMoveInvoiceFolderTarget("");
  };

  const toggleRecipeSelection = (id: string) => {
    setSelectedRecipeIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allFilteredSelected =
    filteredRecipeFiles.length > 0 &&
    filteredRecipeFiles.every((r) => selectedRecipeIds.has(r.id));

  const toggleSelectAllFiltered = () => {
    if (allFilteredSelected) {
      setSelectedRecipeIds(new Set());
    } else {
      setSelectedRecipeIds(new Set(filteredRecipeFiles.map((r) => r.id)));
    }
  };

  const moveSelectedRecipesToFolder = (target: string) => {
    if (!target || selectedRecipeIds.size === 0) return;
    if (selectedRecipeIds.size > 1) {
      const ok = window.confirm(
        `Move ${selectedRecipeIds.size} recipes to this folder?\n\n(This does not delete recipes.)`
      );
      if (!ok) return;
    }
    const nextFolderId = target === "__unsorted__" ? null : target;
    setUploadedFiles((prev) =>
      prev.map((f) => {
        if (f.role !== "recipe") return f;
        if (!selectedRecipeIds.has(f.id)) return f;
        return { ...f, recipeFolderId: nextFolderId };
      })
    );
    setMoveFolderTarget("");
    setSelectedRecipeIds(new Set());
  };

  const toggleInvoiceSelection = (id: string) => {
    setSelectedInvoiceIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allInvoicesSelected =
    filteredInvoiceFiles.length > 0 &&
    filteredInvoiceFiles.every((i) => selectedInvoiceIds.has(i.id));

  const toggleSelectAllInvoices = () => {
    if (allInvoicesSelected) {
      setSelectedInvoiceIds(new Set());
    } else {
      setSelectedInvoiceIds(new Set(filteredInvoiceFiles.map((i) => i.id)));
    }
  };

  const moveSelectedInvoicesToFolder = (target: string) => {
    if (!target || selectedInvoiceIds.size === 0) return;
    if (selectedInvoiceIds.size > 1) {
      const ok = window.confirm(
        `Move ${selectedInvoiceIds.size} invoices to this folder?\n\n(This does not delete invoices.)`
      );
      if (!ok) return;
    }
    const nextFolderId = target === "__unsorted__" ? null : target;
    setUploadedFiles((prev) =>
      prev.map((f) => {
        if (f.role !== "invoice") return f;
        if (!selectedInvoiceIds.has(f.id)) return f;
        return { ...f, invoiceFolderId: nextFolderId };
      })
    );
    setMoveInvoiceFolderTarget("");
    setSelectedInvoiceIds(new Set());
  };

  // ✅ Prevent server/client mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  // If the user changes the folder filter while in Edit mode, clear selection to avoid accidental bulk moves.
  useEffect(() => {
    if (!isFolderEditMode) return;
    setSelectedRecipeIds(new Set());
    setMoveFolderTarget(recipeTreeSelection.kind === "folder" ? recipeTreeSelection.folderId : "");
  }, [isFolderEditMode, recipeTreeSelection]);

  useEffect(() => {
    if (!isInvoiceEditMode) return;
    setSelectedInvoiceIds(new Set());
    setMoveInvoiceFolderTarget(invoiceTreeSelection.kind === "folder" ? invoiceTreeSelection.folderId : "");
  }, [isInvoiceEditMode, invoiceTreeSelection]);

  // Load persisted recipe folders (client-only)
  useEffect(() => {
    if (!mounted) return;
    const hydrated = loadRecipeFolders(RECIPE_FOLDERS_KEY);
    if (!hydrated) return;
    setRecipeFolders(hydrated);
  }, [mounted]);

  // Load persisted invoice folders (client-only)
  useEffect(() => {
    if (!mounted) return;
    const hydrated = loadInvoiceFolders(INVOICE_FOLDERS_KEY);
    if (!hydrated) return;
    setInvoiceFolders(hydrated);
  }, [mounted]);

  // Load persisted uploaded files (client-only)
  useEffect(() => {
    if (!mounted) return;
    const deduped = loadUploadedFiles(UPLOADED_FILES_KEY);
    if (!deduped) return;
    setUploadedFiles(deduped);
  }, [mounted]);

  // Load persisted state (client-only)
  useEffect(() => {
    if (!mounted) return;
    const parsed = loadArcState(STORAGE_KEY);
    if (parsed !== undefined) {
      setArcState(parsed as any);
    }
  }, [mounted]);

  // Persist state
  useEffect(() => {
    if (!mounted) return;
    saveArcState(STORAGE_KEY, arcState);
  }, [mounted, arcState]);

  // Persist uploaded files (exclude non-serializable File handles)
  useEffect(() => {
    if (!mounted) return;
    saveUploadedFiles(UPLOADED_FILES_KEY, uploadedFiles);
  }, [mounted, uploadedFiles]);

  // Persist recipe folders
  useEffect(() => {
    if (!mounted) return;
    saveRecipeFolders(RECIPE_FOLDERS_KEY, recipeFolders);
  }, [mounted, recipeFolders]);

  // Persist invoice folders
  useEffect(() => {
    if (!mounted) return;
    saveInvoiceFolders(INVOICE_FOLDERS_KEY, invoiceFolders);
  }, [mounted, invoiceFolders]);

  // Load persisted event projects
  useEffect(() => {
    if (!mounted) return;
    const parsed = loadEventProjects(EVENT_PROJECTS_KEY);
    if (!parsed) return;
    setEventProjects(parsed);
  }, [mounted]);

  // Load persisted event folders
  useEffect(() => {
    if (!mounted) return;
    const parsed = loadEventFolders(EVENT_FOLDERS_KEY);
    if (!parsed) return;
    setEventFolders(parsed);
  }, [mounted]);

  // Persist event projects
  useEffect(() => {
    if (!mounted) return;
    saveEventProjects(EVENT_PROJECTS_KEY, eventProjects);
  }, [mounted, eventProjects]);

  // Persist event folders
  useEffect(() => {
    if (!mounted) return;
    saveEventFolders(EVENT_FOLDERS_KEY, eventFolders);
  }, [mounted, eventFolders]);

  // Auto-create event when entering new-project view with no active event
  // This removes the intermediate "Planning" landing screen - always go straight to Idea canvas
  useEffect(() => {
    if (!mounted) return;
    if (currentView !== "new-project") return;
    if (showNewProjectPage && activeEventId) return; // Already have an active event open
    
    // Auto-create a new event and open the Idea canvas immediately
    const newEvent: EventProject = {
      id: crypto.randomUUID(),
      name: "New Event",
      createdAt: Date.now(),
      updatedAt: Date.now(),
      phase: "idea",
      freeformNotes: "",
      uploadedFileIds: [],
      details: {},
      unknowns: [],
      constraints: [],
      menu: { courses: [], guestCount: 0 },
      costBreakdown: null,
      operations: null,
      risks: [],
      verdict: null,
    };
    setEventProjects((prev) => [newEvent, ...prev]);
    setActiveEventId(newEvent.id);
    setShowNewProjectPage(true);
  }, [mounted, currentView, activeEventId, showNewProjectPage]);

  // Active event project
  const activeEvent = useMemo(() => {
    if (!activeEventId) return null;
    return eventProjects.find((e) => e.id === activeEventId) ?? null;
  }, [eventProjects, activeEventId]);

  // Create a new event project
  const createEventProject = () => {
    const newEvent: EventProject = {
      id: crypto.randomUUID(),
      name: "New Event",
      createdAt: Date.now(),
      updatedAt: Date.now(),
      phase: "idea",
      freeformNotes: "",
      uploadedFileIds: [],
      details: {},
      unknowns: [],
      constraints: [],
      menu: { courses: [], guestCount: 0 },
      costBreakdown: null,
      operations: null,
      risks: [],
      verdict: null,
    };
    setEventProjects((prev) => [newEvent, ...prev]);
    setActiveEventId(newEvent.id);
    setShowNewProjectPage(true);
    return newEvent;
  };

  // Update an event project
  const updateEventProject = (id: string, updates: Partial<EventProject>) => {
    setEventProjects((prev) =>
      prev.map((e) =>
        e.id === id ? { ...e, ...updates, updatedAt: Date.now() } : e
      )
    );
  };

  // Delete an event project
  const deleteEventProject = (id: string) => {
    setEventProjects((prev) => prev.filter((e) => e.id !== id));
    if (activeEventId === id) {
      setActiveEventId(null);
      setShowNewProjectPage(false);
    }
  };

  // Event folder management
  const createEventFolder = (name: string, parentId?: string | null, isHeader?: boolean) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setEventFolders((prev) => [
      ...prev,
      { id: crypto.randomUUID(), name: trimmed, createdAt: Date.now(), isHeader, parentId },
    ]);
  };

  const renameEventFolder = (id: string, newName: string) => {
    setEventFolders((prev) =>
      prev.map((f) => (f.id === id ? { ...f, name: newName.trim() } : f))
    );
  };

  const deleteEventFolder = (id: string) => {
    // Move events in this folder to no folder
    setEventProjects((prev) =>
      prev.map((e) => (e.folderId === id ? { ...e, folderId: null } : e))
    );
    // Delete child folders
    setEventFolders((prev) => prev.filter((f) => f.id !== id && f.parentId !== id));
  };

  const triggerRoleUpload = async (role: UploadedFile["role"]) => {
    return triggerRoleUploadController({
      role,
      resolveCanonicalRecipe,
      setExtractingFiles,
      setUploadedFiles,
    });
  };

  // 🔑 CRITICAL: render nothing on server
  if (!mounted) return null;

  return (
    <div className="w-full h-screen flex bg-[#F8F1E6]">
      {/* LEFT CANVAS */}
      <div className="flex-1 p-6">
        <div className="flex h-full">
          {/* LEFT RAIL */}
          <aside
            data-canvas="canvas-tools"
            className="w-[220px] shrink-0 px-3 py-4 text-sm text-[#4A331D] border-r border-[#E0D4BF]"
          >
            <div className="flex flex-col gap-3">
              {/* MENU */}
              <nav className="space-y-1">
                <button className="w-full text-left px-2 py-1 rounded hover:bg-[#EFE4D2]">
                  🔍 Search
                </button>
                <button
                  className="w-full text-left px-2 py-1 rounded hover:bg-[#EFE4D2]"
                  onClick={() => setCurrentView("home")}
                >
                  🏠 Home
                </button>
                <button
                  className="w-full text-left px-2 py-1 rounded hover:bg-[#EFE4D2]"
                  onClick={() => setCurrentView("library")}
                >
                  📚 Library
                </button>
                <button
                  className="w-full text-left px-2 py-1 rounded hover:bg-[#EFE4D2] font-medium"
                  onClick={() => {
                    setCurrentView("new-project");
                    createEventProject();
                  }}
                >
                  ➕ New Project
                </button>
              </nav>

              {currentView === "library" && (
                <div className="mt-3 text-[11px] uppercase tracking-wide text-[#8B7E6A]">
                  Library uploads
                </div>
              )}

              {currentView === "new-project" && (
                <>
                  <div className="mt-3 text-[11px] uppercase tracking-wide text-[#8B7E6A]">
                    Current Project
                  </div>
                  {activeEvent && (
                    <div className="pl-2 mt-1 text-sm font-medium text-[#2F2A25] truncate" title={activeEvent.name}>
                      {activeEvent.name}
                    </div>
                  )}
                  
                  {/* Past projects list for quick switching */}
                  {eventProjects.filter((e) => e.id !== activeEventId).length > 0 && (
                    <>
                      <div className="mt-4 text-[11px] uppercase tracking-wide text-[#8B7E6A]">
                        Past Projects
                      </div>
                      <div className="pl-2 mt-1 space-y-1 max-h-[200px] overflow-auto">
                        {eventProjects
                          .filter((e) => e.id !== activeEventId)
                          .slice(0, 10)
                          .map((e) => (
                            <button
                              key={e.id}
                              onClick={() => {
                                setActiveEventId(e.id);
                                setShowNewProjectPage(true);
                              }}
                              className="block w-full text-left text-xs text-[#6F6352] hover:text-[#2F2A25] truncate py-0.5"
                            >
                              {e.name}
                            </button>
                          ))}
                      </div>
                    </>
                  )}
                </>
              )}

              {/* Library uploads */}
              {currentView === "library" && (
                <div className="pl-2 mt-2 space-y-1">
                  <button onClick={() => triggerRoleUpload("recipe")} className="block text-left text-xs hover:underline">
                    + Add Recipe
                  </button>
                  <button onClick={() => triggerRoleUpload("invoice")} className="block text-left text-xs hover:underline">
                    + Add Invoice
                  </button>
                </div>
              )}

              {/* New project uploads */}
              {currentView === "new-project" && (
                <div className="pl-2 mt-2 space-y-1">
                  <button onClick={() => triggerRoleUpload("event")} className="block text-left text-xs hover:underline">
                    + Add Event Brief
                  </button>
                  <button onClick={() => triggerRoleUpload("note")} className="block text-left text-xs hover:underline">
                    + Add Notes
                  </button>
                </div>
              )}


              {extractingFiles && (
                <p className="text-xs text-[#8B7E6A] mb-2">Extracting…</p>
              )}

              {/* File logs intentionally removed.
                  Sidebar is reserved for project navigation only. */}
            </div>
          </aside>

          {/* MAIN DOCUMENT */}
          <main
            data-canvas="canvas-main"
            className="flex-1 overflow-auto px-6 py-4"
          >
            <div className="w-full max-w-none">
              {/* ===================== */}
              {/* LIBRARY CANVAS VIEW */}
              {/* ===================== */}
              {currentView === "library" && (
                <div className="space-y-6">

                  {/* Library internal tabs */}
                  <div className="flex gap-2 border-b pb-2 text-sm lg:pr-[300px]">
                    <button
                      onClick={() => setLibraryTab("recipes")}
                      className={`px-3 py-1 rounded-md ${
                        libraryTab === "recipes"
                          ? "bg-black text-white"
                          : "bg-gray-100 hover:bg-gray-200"
                      }`}
                    >
                      Recipes
                    </button>
                    <button
                      onClick={() => setLibraryTab("invoices")}
                      className={`px-3 py-1 rounded-md ${
                        libraryTab === "invoices"
                          ? "bg-black text-white"
                          : "bg-gray-100 hover:bg-gray-200"
                      }`}
                    >
                      Invoices
                    </button>
                  </div>

                  {/* Recipe Library */}
                  {libraryTab === "recipes" && (
                  <section className="space-y-3">
                    {/* Folder assignment (edit mode) */}
                    <div className="flex items-center justify-between lg:pr-[300px]">
                      <div className="flex items-center gap-3">
                        {isFolderEditMode && (
                          <>
                            <div className="text-xs text-[#6F6352]">
                              Selected:{" "}
                              <span className="font-medium text-[#2F2A25]">{selectedRecipeIds.size}</span>
                            </div>
                            <label className="flex items-center gap-1.5 cursor-pointer text-xs text-[#6F6352]">
                              <input
                                type="checkbox"
                                checked={allFilteredSelected}
                                onChange={toggleSelectAllFiltered}
                                className="w-4 h-4 rounded border-[#C5B8A5] text-[#2F2A25] focus:ring-[#C5B8A5]"
                              />
                              Select All
                            </label>
                            <div className="flex items-center gap-2">
                              <select
                                value={moveFolderTarget}
                                onChange={(e) => setMoveFolderTarget(e.target.value)}
                                className="px-2 py-1 text-xs rounded-md border border-[#C5B8A5] bg-white/60 text-[#4A331D]"
                              >
                                <option value="">Move to folder…</option>
                                <option value="__unsorted__">Unsorted</option>
                                {recipeFolders.map((f) => (
                                  <option key={f.id} value={f.id}>
                                    {f.name}
                                  </option>
                                ))}
                              </select>
                              <button
                                onClick={() => moveSelectedRecipesToFolder(moveFolderTarget)}
                                disabled={!moveFolderTarget || selectedRecipeIds.size === 0}
                                className={`px-3 py-1 text-xs rounded-md transition ${
                                  !moveFolderTarget || selectedRecipeIds.size === 0
                                    ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                                    : "bg-[#E8DFD0] hover:bg-[#DED4C3] text-[#4A331D]"
                                }`}
                              >
                                Move
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                      {!isRecipeFrameOpen && (
                        <div className="flex items-center gap-2">
                          {isFolderEditMode && (
                            <button
                              onClick={deleteSelectedRecipes}
                              disabled={selectedRecipeIds.size === 0}
                              className={`px-3 py-1 text-xs rounded-md transition ${
                                selectedRecipeIds.size === 0
                                  ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                                  : "bg-[#E8DFD0] hover:bg-[#DED4C3] text-[#4A331D]"
                              }`}
                            >
                              Delete
                            </button>
                          )}

                          <button
                            onClick={() => {
                              setIsFolderEditMode((v) => !v);
                              setSelectedRecipeIds(new Set());
                              setMoveFolderTarget("");
                            }}
                            className="px-3 py-1 text-xs rounded-md bg-[#E8DFD0] hover:bg-[#DED4C3] text-[#4A331D] transition"
                          >
                            {isFolderEditMode ? "Done" : "Edit"}
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="relative">
                      {/* Recipe table (wide). Leave space for fixed folder panel on desktop. */}
                      <div className="lg:pr-[300px]">
                        <div className="border border-[#E0D4BF] rounded-xl overflow-hidden bg-[#FBF4E8]">
                        {isRecipeFrameOpen ? (
                          <div className="grid grid-cols-[280px,1fr] min-h-[620px]">
                            {/* Left list */}
                            <div className="border-r border-[#E0D4BF] bg-[#FAF2E6]/60">
                              <div className="px-4 py-2.5 text-[10px] uppercase tracking-wider text-[#8B7E6A] border-b border-[#E0D4BF] bg-[#FAF2E6]">
                                Recipes
                              </div>
                              <div className="divide-y divide-[#E0D4BF] overflow-auto max-h-[620px]">
                                {filteredRecipeFiles.map((file) => {
                                  const active = file.id === selectedRecipeId;
                                  return (
                                    <button
                                      key={file.id}
                                      className={`w-full text-left px-4 py-3 transition focus:outline-none ${
                                        active ? "bg-[#F5ECDD]" : "hover:bg-[#F5ECDD]"
                                      }`}
                                      onClick={() => setSelectedRecipeId(file.id)}
                                    >
                                      <div className="text-sm font-medium truncate text-[#2F2A25]">
                                        {file.canonicalRecipe?.title ??
                                          file.recipeIntelligence?.recipeName ??
                                          file.name}
                                      </div>
                                      <div className="text-[11px] text-[#8B7E6A] truncate">
                                        {file.recipeIntelligence?.cuisine ?? "—"} ·{" "}
                                        {file.recipeIntelligence?.dishCategory ?? "—"}
                                      </div>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>

                            {/* Recipe frame (wide) */}
                            <div className="bg-[#FBF4E8]">
                              <RecipeFrame
                                file={selectedRecipeFile}
                                onHide={() => setIsRecipeFrameOpen(false)}
                                onUpdate={(next) => {
                                  setUploadedFiles((prev) =>
                                    prev.map((f) =>
                                      f.id === (next as any).id
                                        ? ({ ...f, ...(next as any) } as UploadedFile)
                                        : f
                                    )
                                  );
                                }}
                              />
                            </div>
                          </div>
                        ) : (
                          <>
                            <div
                              className={`grid ${
                                isFolderEditMode
                                  ? "grid-cols-[32px,2fr,1fr,1fr,1fr]"
                                  : "grid-cols-[2fr,1fr,1fr,1fr]"
                              } gap-2 px-4 py-2.5 text-[10px] uppercase tracking-wider text-[#8B7E6A] border-b border-[#E0D4BF] bg-[#FAF2E6]`}
                            >
                              {isFolderEditMode && <div />}
                              <div>Recipe</div>
                              <div>Cuisine</div>
                              <div>Occasion</div>
                              <div>Dietary</div>
                            </div>

                            {uploadedFiles.filter((f) => f.role === "recipe").length === 0 ? (
                              <div className="px-4 py-8 text-sm text-[#8B7E6A]">
                                No recipes yet. Add recipes to start building your working repertoire.
                              </div>
                            ) : (
                              <div className="divide-y divide-[#E0D4BF]">
                                {filteredRecipeFiles.map((file) => {
                                  const isSelected = selectedRecipeIds.has(file.id);
                                  return (
                                    <div
                                      key={file.id}
                                      className={`w-full text-left grid ${
                                        isFolderEditMode
                                          ? "grid-cols-[32px,2fr,1fr,1fr,1fr]"
                                          : "grid-cols-[2fr,1fr,1fr,1fr]"
                                      } gap-2 px-4 py-3 transition ${
                                        isSelected ? "bg-[#E8DFD0]" : "hover:bg-[#F5ECDD]"
                                      }`}
                                    >
                                      {isFolderEditMode && (
                                        <div className="flex items-center">
                                          <input
                                            type="checkbox"
                                            checked={isSelected}
                                            onChange={() => toggleRecipeSelection(file.id)}
                                            className="w-4 h-4 rounded border-[#C5B8A5] text-[#2F2A25] focus:ring-[#C5B8A5] cursor-pointer"
                                          />
                                        </div>
                                      )}
                                      <button
                                        className="min-w-0 text-left"
                                        onClick={() => {
                                          if (isFolderEditMode) {
                                            toggleRecipeSelection(file.id);
                                            return;
                                          }
                                          setIsFolderEditMode(false);
                                          setSelectedRecipeIds(new Set());
                                          setMoveFolderTarget("");
                                          setSelectedRecipeId(file.id);
                                          setIsRecipeFrameOpen(true);
                                        }}
                                      >
                                        <div className="text-sm font-medium truncate text-[#2F2A25]">
                                          {file.canonicalRecipe?.title ??
                                            file.recipeIntelligence?.recipeName ??
                                            file.name}
                                        </div>
                                        <div className="text-[11px] text-[#8B7E6A]">
                                          {file.recipeIntelligence?.dishStyle ?? "Recipe document"}
                                        </div>
                                      </button>
                                      <div className="text-xs text-[#6F6352] flex items-center">
                                        {file.recipeIntelligence?.cuisine ?? "—"}
                                      </div>
                                      <div className="text-xs text-[#6F6352] flex items-center">
                                        {file.recipeIntelligence?.dishCategory ?? "—"}
                                      </div>
                                      <div className="text-xs text-[#6F6352] flex items-center">
                                        {file.recipeIntelligence?.dietary?.join(", ") ?? "—"}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </>
                        )}
                        </div>
                      </div>

                      {/* Folder tree panel (fixed top-right, above chat on desktop) */}
                      <aside
                        className={`hidden lg:block fixed top-4 right-4 w-[280px] ${
                          showChat ? "bottom-[calc(50vh+24px)]" : "bottom-4"
                        } overflow-auto z-40`}
                      >
                        <RecipeFileTree
                          recipes={recipeFiles}
                          folders={recipeFolders}
                          selection={recipeTreeSelection}
                          onSelect={(next) => setRecipeTreeSelection(next)}
                          onCreateFolder={createRecipeFolder}
                          onRenameFolder={renameRecipeFolder}
                          onDeleteFolder={deleteRecipeFolder}
                        />
                      </aside>

                      {/* Mobile/tablet: show folder UI below table */}
                      <div className="mt-3 lg:hidden">
                        <RecipeFileTree
                          recipes={recipeFiles}
                          folders={recipeFolders}
                          selection={recipeTreeSelection}
                          onSelect={(next) => setRecipeTreeSelection(next)}
                          onCreateFolder={createRecipeFolder}
                          onRenameFolder={renameRecipeFolder}
                          onDeleteFolder={deleteRecipeFolder}
                        />
                      </div>
            </div>
          </section>
                  )}

                  {/* Invoice Library */}
                  {libraryTab === "invoices" && (
                  <section className="space-y-4">
                    {/* Invoice assignment (edit mode) — mirrors Recipes */}
                    <div className="flex items-center justify-between lg:pr-[300px]">
                      <div className="flex items-center gap-3">
                        {isInvoiceEditMode && (
                          <>
                            <div className="text-xs text-[#6F6352]">
                              Selected:{" "}
                              <span className="font-medium text-[#2F2A25]">{selectedInvoiceIds.size}</span>
                            </div>
                            <label className="flex items-center gap-1.5 cursor-pointer text-xs text-[#6F6352]">
                              <input
                                type="checkbox"
                                checked={allInvoicesSelected}
                                onChange={toggleSelectAllInvoices}
                                className="w-4 h-4 rounded border-[#C5B8A5] text-[#2F2A25] focus:ring-[#C5B8A5]"
                              />
                              Select All
                            </label>
                            <div className="flex items-center gap-2">
                              <select
                                value={moveInvoiceFolderTarget}
                                onChange={(e) => setMoveInvoiceFolderTarget(e.target.value)}
                                className="px-2 py-1 text-xs rounded-md border border-[#C5B8A5] bg-white/60 text-[#4A331D]"
                              >
                                <option value="">Move to folder…</option>
                                <option value="__unsorted__">Unsorted</option>
                                {invoiceFolders.map((f) => (
                                  <option key={f.id} value={f.id}>
                                    {f.name}
                                  </option>
                                ))}
                              </select>
                              <button
                                onClick={() => moveSelectedInvoicesToFolder(moveInvoiceFolderTarget)}
                                disabled={!moveInvoiceFolderTarget || selectedInvoiceIds.size === 0}
                                className={`px-3 py-1 text-xs rounded-md transition ${
                                  !moveInvoiceFolderTarget || selectedInvoiceIds.size === 0
                                    ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                                    : "bg-[#E8DFD0] hover:bg-[#DED4C3] text-[#4A331D]"
                                }`}
                              >
                                Move
                              </button>
                            </div>
                          </>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {isInvoiceEditMode && (
                          <button
                            onClick={deleteSelectedInvoices}
                            disabled={selectedInvoiceIds.size === 0}
                            className={`px-3 py-1 text-xs rounded-md transition ${
                              selectedInvoiceIds.size === 0
                                ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                                : "bg-[#E8DFD0] hover:bg-[#DED4C3] text-[#4A331D]"
                            }`}
                          >
                            Delete
                          </button>
                        )}

                        <button
                          onClick={() => {
                            setIsInvoiceEditMode((v) => !v);
                            setSelectedInvoiceIds(new Set());
                            setMoveInvoiceFolderTarget("");
                          }}
                          className="px-3 py-1 text-xs rounded-md bg-[#E8DFD0] hover:bg-[#DED4C3] text-[#4A331D] transition"
                        >
                          {isInvoiceEditMode ? "Done" : "Edit"}
                        </button>
                      </div>
                    </div>

                    <div className="relative">
                      {/* Invoice ledger table (wide). Leave space for fixed folder panel on desktop. */}
                      <div className="lg:pr-[300px]">
                        <div className="border border-[#E0D4BF] rounded-xl overflow-hidden bg-[#FBF4E8]">
                          {isInvoiceFrameOpen ? (
                            <div className="grid grid-cols-[280px,1fr] min-h-[620px]">
                              {/* Left list */}
                              <div className="border-r border-[#E0D4BF] bg-[#FAF2E6]/60">
                                <div className="px-4 py-2.5 text-[10px] uppercase tracking-wider text-[#8B7E6A] border-b border-[#E0D4BF] bg-[#FAF2E6]">
                                  Invoices
                                </div>
                                <div className="divide-y divide-[#E0D4BF] overflow-auto max-h-[620px]">
                                  {filteredInvoiceFiles.map((file) => {
                                    const active = file.id === viewingInvoiceId;
                                    return (
                                      <button
                                        key={file.id}
                                        className={`w-full text-left px-4 py-3 transition focus:outline-none ${
                                          active ? "bg-[#F5ECDD]" : "hover:bg-[#F5ECDD]"
                                        }`}
                                        onClick={() => setViewingInvoiceId(file.id)}
                                      >
                                        <div className="text-sm font-medium truncate text-[#2F2A25]">
                                          {file.invoiceIntelligence?.vendor || file.name}
                                        </div>
                                        <div className="text-[11px] text-[#8B7E6A] truncate">
                                          {file.invoiceIntelligence?.currency ?? "—"} ·{" "}
                                          {file.invoiceIntelligence?.date ?? "—"}
                                        </div>
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>

                              {/* Invoice detail frame (right side) */}
                              <div className="bg-[#FBF4E8] p-6 overflow-auto">
                                {viewingInvoice ? (
                                  <div className="space-y-4">
                                    {/* Header with hide button */}
                                    <div className="flex items-start justify-between">
                                      <div>
                                        <h2 className="text-lg font-semibold text-[#2F2A25]">
                                          {viewingInvoice.invoiceIntelligence?.vendor || viewingInvoice.name}
                                        </h2>
                                        <p className="text-sm text-[#8B7E6A]">
                                          {viewingInvoice.invoiceIntelligence?.date || "Invoice"}
                                        </p>
                                      </div>
                                      <button
                                        onClick={() => setIsInvoiceFrameOpen(false)}
                                        className="px-3 py-1.5 text-xs rounded-md bg-[#E8DFD0] hover:bg-[#DED4C3] text-[#4A331D] transition flex items-center gap-1"
                                      >
                                        <span>✕</span> Hide
                                      </button>
                                    </div>

                                    {/* Summary cards */}
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                      <div className="bg-[#F5ECDD] rounded-lg p-3">
                                        <div className="text-[10px] uppercase tracking-wider text-[#8B7E6A]">Country</div>
                                        <div className="text-sm font-medium text-[#2F2A25]">
                                          {viewingInvoice.invoiceIntelligence?.country || "—"}
                                        </div>
                                      </div>
                                      <div className="bg-[#F5ECDD] rounded-lg p-3">
                                        <div className="text-[10px] uppercase tracking-wider text-[#8B7E6A]">City</div>
                                        <div className="text-sm font-medium text-[#2F2A25]">
                                          {viewingInvoice.invoiceIntelligence?.city || "—"}
                                        </div>
                                      </div>
                                      <div className="bg-[#F5ECDD] rounded-lg p-3">
                                        <div className="text-[10px] uppercase tracking-wider text-[#8B7E6A]">Currency</div>
                                        <div className="text-sm font-medium text-[#2F2A25]">
                                          {viewingInvoice.invoiceIntelligence?.currency || "—"}
                                        </div>
                                      </div>
                                      <div className="bg-[#F5ECDD] rounded-lg p-3">
                                        <div className="text-[10px] uppercase tracking-wider text-[#8B7E6A]">Total</div>
                                        <div className="text-sm font-medium text-[#2F2A25]">
                                          {viewingInvoice.invoiceIntelligence?.total
                                            ? `${viewingInvoice.invoiceIntelligence.currency || ""} ${viewingInvoice.invoiceIntelligence.total}`.trim()
                                            : "—"}
                                        </div>
                                      </div>
                                    </div>

                                    {/* Missing info prompt */}
                                    {(!viewingInvoice.invoiceIntelligence?.city || !viewingInvoice.invoiceIntelligence?.country) && (
                                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                                        <p className="text-sm text-amber-800">
                                          Some information couldn&apos;t be detected automatically.
                                          {!viewingInvoice.invoiceIntelligence?.city && " City is missing."}
                                          {!viewingInvoice.invoiceIntelligence?.country && " Country is missing."}
                                        </p>
                                      </div>
                                    )}

                                    {/* Line Items Table */}
                                    {viewingInvoice.invoiceIntelligence?.items && viewingInvoice.invoiceIntelligence.items.length > 0 ? (
                                      <div>
                                        <div className="text-[10px] uppercase tracking-wider text-[#8B7E6A] mb-2">
                                          Line Items ({viewingInvoice.invoiceIntelligence.items.length})
                                        </div>
                                        <div className="bg-white rounded-lg border border-[#E0D4BF] overflow-hidden">
                                          {/* Table header */}
                                          <div className="grid grid-cols-[2fr,0.8fr,0.8fr,1fr,1fr] gap-2 px-4 py-2 text-[10px] uppercase tracking-wider text-[#8B7E6A] bg-[#FAF2E6] border-b border-[#E0D4BF]">
                                            <div>Ingredient</div>
                                            <div className="text-right">Qty</div>
                                            <div>Unit</div>
                                            <div className="text-right">Unit Price</div>
                                            <div className="text-right">Total</div>
                                          </div>
                                          {/* Table rows */}
                                          <div className="divide-y divide-[#E0D4BF] max-h-[280px] overflow-auto">
                                            {viewingInvoice.invoiceIntelligence.items.map((item, idx) => (
                                              <div
                                                key={idx}
                                                className="grid grid-cols-[2fr,0.8fr,0.8fr,1fr,1fr] gap-2 px-4 py-2.5 hover:bg-[#FAF8F4] transition"
                                              >
                                                <div className="min-w-0">
                                                  <div className="text-sm font-medium text-[#2F2A25] truncate">
                                                    {item.name}
                                                  </div>
                                                  {item.originalName && item.originalName !== item.name && (
                                                    <div className="text-[10px] text-[#8B7E6A] truncate">
                                                      {item.originalName}
                                                    </div>
                                                  )}
                                                </div>
                                                <div className="text-sm text-[#4A331D] text-right">
                                                  {item.quantity || "—"}
                                                </div>
                                                <div className="text-sm text-[#6F6352]">
                                                  {item.unit || "—"}
                                                </div>
                                                <div className="text-sm text-[#4A331D] text-right">
                                                  {item.unitPrice || item.price || "—"}
                                                </div>
                                                <div className="text-sm font-medium text-[#2F2A25] text-right">
                                                  {item.lineTotal || "—"}
                                                </div>
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      </div>
                                    ) : (
                                      <div className="bg-[#F5ECDD] rounded-lg p-4 text-center">
                                        <p className="text-sm text-[#8B7E6A]">
                                          No line items detected. Try re-uploading with a clearer image.
                                        </p>
                                      </div>
                                    )}

                                    {/* Raw extracted text (collapsed by default) */}
                                    <details className="group">
                                      <summary className="text-[10px] uppercase tracking-wider text-[#8B7E6A] cursor-pointer hover:text-[#6F6352] transition">
                                        <span className="group-open:hidden">▶</span>
                                        <span className="hidden group-open:inline">▼</span>
                                        {" "}Raw Extracted Text
                                      </summary>
                                      <div className="mt-2 bg-white rounded-lg p-4 border border-[#E0D4BF] max-h-[200px] overflow-auto">
                                        <pre className="text-xs text-[#4A331D] whitespace-pre-wrap font-mono">
                                          {viewingInvoice.extractedText || "(No text extracted)"}
                                        </pre>
                                      </div>
                                    </details>
                                  </div>
                                ) : (
                                  <div className="flex items-center justify-center h-full text-sm text-[#8B7E6A]">
                                    Select an invoice to view details
                                  </div>
                                )}
                              </div>
                            </div>
                          ) : (
                            <>
                              <div
                                className={`grid ${
                                  isInvoiceEditMode
                                    ? "grid-cols-[32px,1.6fr,0.9fr,0.9fr,0.8fr,0.8fr]"
                                    : "grid-cols-[1.6fr,0.9fr,0.9fr,0.8fr,0.8fr]"
                                } gap-2 px-4 py-2 text-[11px] uppercase tracking-wider text-[#8B7E6A] border-b border-[#E0D4BF]`}
                              >
                                {isInvoiceEditMode && <div />}
                                <div>Invoice</div>
                                <div>Country</div>
                                <div>City</div>
                                <div>Currency</div>
                                <div className="text-right">Date</div>
                              </div>

                              {invoiceFiles.length === 0 ? (
                                <div className="px-4 py-6 text-sm text-[#8B7E6A]">
                                  No invoices yet. Upload invoices to build market price memory.
                                </div>
                              ) : (
                                <div className="divide-y divide-[#E0D4BF]">
                                  {filteredInvoiceFiles.map((file) => {
                                    const isSelected = selectedInvoiceIds.has(file.id);
                                    return (
                                      <div
                                        key={file.id}
                                        className={`w-full text-left grid ${
                                          isInvoiceEditMode
                                            ? "grid-cols-[32px,1.6fr,0.9fr,0.9fr,0.8fr,0.8fr]"
                                            : "grid-cols-[1.6fr,0.9fr,0.9fr,0.8fr,0.8fr]"
                                        } gap-2 px-4 py-3 transition ${
                                          isSelected ? "bg-[#E8DFD0]" : "hover:bg-[#F5ECDD]"
                                        }`}
                                      >
                                        {isInvoiceEditMode && (
                                          <div className="flex items-center">
                                            <input
                                              type="checkbox"
                                              checked={isSelected}
                                              onChange={() => toggleInvoiceSelection(file.id)}
                                              className="w-4 h-4 rounded border-[#C5B8A5] text-[#2F2A25] focus:ring-[#C5B8A5] cursor-pointer"
                                            />
                                          </div>
                                        )}

                                        <button
                                          className="min-w-0 text-left"
                                          onClick={() => {
                                            if (isInvoiceEditMode) {
                                              toggleInvoiceSelection(file.id);
                                              return;
                                            }
                                            // Open invoice frame view
                                            setIsInvoiceEditMode(false);
                                            setSelectedInvoiceIds(new Set());
                                            setMoveInvoiceFolderTarget("");
                                            setViewingInvoiceId(file.id);
                                            setIsInvoiceFrameOpen(true);
                                          }}
                                        >
                                          <div className="text-sm font-medium truncate text-[#2F2A25]">
                                            {file.invoiceIntelligence?.vendor || file.name}
                                          </div>
                                          <div className="text-xs text-[#8B7E6A]">
                                            {file.invoiceIntelligence?.total
                                              ? `${file.invoiceIntelligence.currency || ""} ${file.invoiceIntelligence.total}`.trim()
                                              : "Invoice file"}
                                          </div>
                                        </button>

                                        <div className="text-xs text-[#6F6352] flex items-center">
                                          {file.invoiceIntelligence?.country || "—"}
                                        </div>
                                        <div className="text-xs text-[#6F6352] flex items-center">
                                          {file.invoiceIntelligence?.city || "—"}
                                        </div>
                                        <div className="text-xs text-[#6F6352] flex items-center">
                                          {file.invoiceIntelligence?.currency || "—"}
                                        </div>
                                        <div className="text-xs text-[#6F6352] text-right">
                                          {file.invoiceIntelligence?.date || "—"}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      </div>

                      {/* Invoice folder tree panel (fixed top-right, above chat on desktop) */}
                      <aside
                        className={`hidden lg:block fixed top-4 right-4 w-[280px] ${
                          showChat ? "bottom-[calc(50vh+24px)]" : "bottom-4"
                        } overflow-auto z-40`}
                      >
                        <InvoiceFileTree
                          invoices={invoiceFiles}
                          folders={invoiceFolders}
                          selection={invoiceTreeSelection}
                          onSelect={(next) => setInvoiceTreeSelection(next)}
                          onCreateFolder={createInvoiceFolder}
                          onRenameFolder={renameInvoiceFolder}
                          onDeleteFolder={deleteInvoiceFolder}
                        />
                      </aside>

                      {/* Mobile/tablet: show invoice folder UI below table */}
                      <div className="mt-3 lg:hidden">
                        <InvoiceFileTree
                          invoices={invoiceFiles}
                          folders={invoiceFolders}
                          selection={invoiceTreeSelection}
                          onSelect={(next) => setInvoiceTreeSelection(next)}
                          onCreateFolder={createInvoiceFolder}
                          onRenameFolder={renameInvoiceFolder}
                          onDeleteFolder={deleteInvoiceFolder}
                        />
                      </div>

                    </div>
                  </section>
                  )}
                </div>
              )}

              {/* New Project / Event View - always shows NewProjectPage (auto-created if needed) */}
              {currentView === "new-project" && (
                <div className="h-full">
                  {activeEvent ? (
                    <NewProjectPage
                      event={activeEvent}
                      onUpdate={(updates) => updateEventProject(activeEvent.id, updates)}
                      onClose={() => {
                        // When closing, create a fresh event for next time
                        setShowNewProjectPage(false);
                        setActiveEventId(null);
                      }}
                      onUpload={async (files) => {
                        // Upload files, run OCR, and extract event details
                        const newIds: string[] = [];
                        let combinedText = "";

                        for (const file of Array.from(files)) {
                          const id = `${file.name}-${file.size}-${file.lastModified}-${crypto.randomUUID()}`;
                          newIds.push(id);

                          try {
                            let extractedText = "";

                            // Text files: extract locally
                            if (file.type === "text/plain" || file.name.endsWith(".md") || file.name.endsWith(".txt")) {
                              extractedText = await file.text();
                            }
                            // Images: call OCR
                            else if (file.type.startsWith("image/")) {
                              const formData = new FormData();
                              formData.append("file", file);
                              formData.append("role", "event");
                              const res = await fetch("/api/arc/ocr", { method: "POST", body: formData });
                              if (res.ok) {
                                const data = await res.json();
                                extractedText = data.extractedText || "";
                              }
                            }
                            // PDFs: call PDF OCR
                            else if (file.type === "application/pdf" || file.name.endsWith(".pdf")) {
                              const formData = new FormData();
                              formData.append("file", file);
                              formData.append("role", "event");
                              const res = await fetch("/api/arc/ocr-pdf", { method: "POST", body: formData });
                              if (res.ok) {
                                const data = await res.json();
                                extractedText = data.extractedText || "";
                              }
                            }

                            // Add to combined text for detail extraction
                            if (extractedText) {
                              combinedText += `\n\n--- ${file.name} ---\n${extractedText}`;
                            }

                            // Store file in uploadedFiles for reference
                            setUploadedFiles((prev) => [
                              ...prev,
                              {
                                id,
                                name: file.name,
                                type: file.type,
                                size: file.size,
                                lastModified: file.lastModified,
                                role: "event" as const,
                                extractedText,
                                extractionMethod: file.type.startsWith("image/") ? "ocr" : file.type === "application/pdf" ? "ocr-pdf" : "text",
                              },
                            ]);
                          } catch (err) {
                            console.error("Error processing file:", file.name, err);
                          }
                        }

                        // Extract event details from combined text
                        if (combinedText.trim() && activeEvent) {
                          try {
                            const res = await fetch("/api/arc/extract-event-details", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({
                                text: combinedText,
                                existingDetails: activeEvent.details,
                              }),
                            });
                            if (res.ok) {
                              const { details, unknowns, constraints } = await res.json();
                              // Auto-fill event details
                              updateEventProject(activeEvent.id, {
                                details: { ...activeEvent.details, ...details },
                                unknowns: [...new Set([...activeEvent.unknowns, ...(unknowns || [])])],
                                constraints: [...new Set([...activeEvent.constraints, ...(constraints || [])])],
                              });
                            }
                          } catch (err) {
                            console.error("Error extracting event details:", err);
                          }
                        }

                        return newIds;
                      }}
                      uploadedFiles={uploadedFiles.map((f) => ({
                        id: f.id,
                        name: f.name,
                        extractedText: f.extractedText,
                      }))}
                      recipes={recipeFiles.map((f) => ({
                        id: f.id,
                        name: f.canonicalRecipe?.title || f.recipeIntelligence?.recipeName || f.name,
                        cuisine: f.recipeIntelligence?.cuisine,
                        category: f.recipeIntelligence?.dishCategory,
                        dietary: f.recipeIntelligence?.dietary,
                      }))}
                      invoices={invoiceFiles.map((f) => ({
                        id: f.id,
                        vendor: f.invoiceIntelligence?.vendor,
                        items: f.invoiceIntelligence?.items?.map((i) => ({
                          name: i.name,
                          unitPrice: i.unitPrice,
                          unit: i.unit,
                        })),
                      }))}
                    />
                  ) : (
                    /* Loading state while auto-creating event */
                    <div className="flex items-center justify-center h-full">
                      <div className="text-center">
                        <div className="animate-pulse text-4xl mb-4">📋</div>
                        <p className="text-sm text-[#8B7E6A]">Setting up your project...</p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </main>
        </div>
      </div>

      {!showChat && (
        <button
          onClick={() => setShowChat(true)}
          className="fixed right-2 top-1/2 z-50 bg-[#EADDC7] text-[11px] px-3 py-1 rounded-full shadow"
        >
          Show Chat
        </button>
      )}

      {/* RIGHT SIDEBAR */}
      {showChat && (
        <div className="fixed bottom-4 right-4 w-[280px] h-[50vh] rounded-xl border border-[#E0D4BF] bg-[#F3E6D3] p-3 flex flex-col shadow-sm overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-[13px] font-semibold" style={{ color: "#4A331D" }}>
          ARC — Conversation
        </h2>
            <button
              onClick={() => setShowChat(false)}
              className="text-[11px] text-[#8A6A3A] hover:underline"
            >
              Hide
            </button>
          </div>

        <div className="flex-1 min-h-0 overflow-hidden">
          <ARCChat
              uploadedFiles={uploadedFiles}
              setUploadedFiles={setUploadedFiles}
              arcState={arcState}
              setArcState={setArcState}
          />
        </div>
      </div>
      )}

    </div>
  );
}