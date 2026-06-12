"use client";

import { useState, useRef, useEffect } from "react";
import {
  Settings,
  Plus,
  Trash2,
  ChevronRight,
  ChevronDown,
  X,
  Check,
  Pencil,
} from "lucide-react";
import type { Folder, Meeting } from "@/types";

interface Props {
  meetings: Meeting[];
  selectedId: string | null;
  selectedFolder: Folder;
  folders: string[];
  onSelectFolder: (f: Folder) => void;
  onSelectMeeting: (id: string) => void;
  onOpenSettings: () => void;
  onMoveMeeting: (id: string, folder: Folder) => void;
  onDeleteMeeting: (id: string) => void;
  onRenameMeeting: (id: string, title: string) => void;
  onCreateFolder: (name: string) => void;
  onRenameFolder: (oldName: string, newName: string) => void;
  onDeleteFolder: (name: string) => void;
  transcriptionProvider?: string;
}

interface FolderNode {
  name: string;
  path: string;
  children: FolderNode[];
  totalCount: number;
}

function buildTree(folders: string[], meetings: Meeting[]): FolderNode[] {
  const sorted = [...folders].sort();

  function countAll(path: string): number {
    return meetings.filter(
      (m) => m.folder === path || m.folder.startsWith(path + "/")
    ).length;
  }

  function kids(parent: string | null): FolderNode[] {
    return sorted
      .filter((f) =>
        parent === null
          ? !f.includes("/")
          : f.startsWith(parent + "/") &&
            !f.slice(parent.length + 1).includes("/")
      )
      .map((path) => ({
        name: parent ? path.slice(parent.length + 1) : path,
        path,
        children: kids(path),
        totalCount: countAll(path),
      }));
  }

  return kids(null);
}

function getAncestors(path: string): string[] {
  const parts = path.split("/");
  const ancestors: string[] = [];
  for (let i = 1; i < parts.length; i++) {
    ancestors.push(parts.slice(0, i).join("/"));
  }
  return ancestors;
}

function DeleteFolderDialog({
  folder,
  count,
  onConfirm,
  onCancel,
}: {
  folder: string;
  count: number;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const displayName = folder.split("/").pop() ?? folder;
  return (
    <div className="mx-1 my-0.5 p-2.5 rounded-lg bg-red-50 border border-red-200 text-xs space-y-2">
      <p className="font-medium text-red-700">Delete &ldquo;{displayName}&rdquo;?</p>
      <p className="text-red-600">
        {count > 0
          ? `This will permanently delete ${count} meeting${count !== 1 ? "s" : ""} inside. This cannot be undone.`
          : "This folder is empty and will be removed."}
      </p>
      <div className="flex gap-2 pt-0.5">
        <button
          type="button"
          onClick={onConfirm}
          className="flex items-center gap-1 px-2 py-1 rounded-md bg-red-600 text-white hover:bg-red-700 transition-colors font-medium text-[11px]"
        >
          <Trash2 className="w-3 h-3" />
          Delete
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-2 py-1 rounded-md bg-white border border-red-200 text-red-600 hover:bg-red-50 transition-colors text-[11px]"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

interface TreeNodeProps {
  node: FolderNode;
  depth: number;
  selectedFolder: Folder;
  expandedPaths: Set<string>;
  onToggleExpand: (path: string) => void;
  onSelectFolder: (f: Folder) => void;
  onCreateFolder: (name: string) => void;
  onRenameFolder: (oldName: string, newName: string) => void;
  onDeleteFolder: (name: string) => void;
  meetings: Meeting[];
}

function TreeNode({
  node,
  depth,
  selectedFolder,
  expandedPaths,
  onToggleExpand,
  onSelectFolder,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
  meetings,
}: TreeNodeProps) {
  const isSelected = selectedFolder === node.path;
  const isExpanded = expandedPaths.has(node.path);
  const hasChildren = node.children.length > 0;

  const [hovered, setHovered] = useState(false);
  const [renamingThis, setRenamingThis] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [creatingChild, setCreatingChild] = useState(false);
  const [newChildName, setNewChildName] = useState("");

  const renameRef = useRef<HTMLInputElement>(null);
  const newChildRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (renamingThis) setTimeout(() => renameRef.current?.select(), 20);
  }, [renamingThis]);

  useEffect(() => {
    if (creatingChild) setTimeout(() => newChildRef.current?.focus(), 20);
  }, [creatingChild]);

  function commitRename() {
    const trimmed = renameValue.trim();
    if (trimmed && trimmed !== node.name) {
      const parentPath = node.path.slice(0, node.path.length - node.name.length);
      const newPath = parentPath + trimmed;
      onRenameFolder(node.path, newPath);
    }
    setRenamingThis(false);
    setRenameValue("");
  }

  function submitChild() {
    const name = newChildName.trim();
    if (name) {
      onCreateFolder(node.path + "/" + name);
      onSelectFolder(node.path + "/" + name);
      if (!isExpanded) onToggleExpand(node.path);
    }
    setCreatingChild(false);
    setNewChildName("");
  }

  const indentPx = depth * 12;

  return (
    <div>
      <div
        className="relative"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {renamingThis ? (
          <div
            className="flex items-center gap-1 py-1 pr-1"
            style={{ paddingLeft: indentPx + 4 }}
          >
            <span className="w-3.5 h-3.5 flex-shrink-0" />
            <input
              ref={renameRef}
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onBlur={commitRename}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitRename();
                if (e.key === "Escape") {
                  setRenamingThis(false);
                  setRenameValue("");
                }
              }}
              className="flex-1 text-xs bg-input border border-primary/50 rounded px-1.5 py-0.5
                focus:outline-none focus:ring-1 focus:ring-primary text-foreground min-w-0"
            />
            <button type="button" onClick={commitRename} className="text-primary p-0.5 flex-shrink-0">
              <Check className="w-3 h-3" />
            </button>
            <button
              type="button"
              onClick={() => { setRenamingThis(false); setRenameValue(""); }}
              className="text-muted-foreground p-0.5 flex-shrink-0"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-0.5 pr-1">
            <button
              type="button"
              onClick={() => {
                onSelectFolder(node.path);
                if (hasChildren && !isExpanded) onToggleExpand(node.path);
              }}
              className={`flex-1 flex items-center gap-1.5 py-1.5 rounded-lg text-xs transition-colors min-w-0 ${
                isSelected
                  ? "bg-violet-50 text-violet-700 font-semibold"
                  : "text-muted-foreground hover:text-foreground hover:bg-gray-50"
              }`}
              style={{ paddingLeft: indentPx + 4 }}
            >
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (hasChildren) onToggleExpand(node.path);
                }}
                className="flex-shrink-0 w-3.5 h-3.5 flex items-center justify-center text-current"
                tabIndex={-1}
              >
                {hasChildren ? (
                  isExpanded ? (
                    <ChevronDown className="w-3 h-3" />
                  ) : (
                    <ChevronRight className="w-3 h-3" />
                  )
                ) : (
                  <span className="w-3 h-3 block" />
                )}
              </button>
              <span className="flex-1 text-left truncate leading-none">{node.name}</span>
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded-full flex-shrink-0 leading-none ${
                  isSelected
                    ? "bg-violet-100 text-violet-600"
                    : "bg-gray-100 text-muted-foreground"
                }`}
              >
                {node.totalCount}
              </span>
            </button>

            {/* Hover actions */}
            {hovered && !renamingThis && (
              <div className="flex items-center gap-0 flex-shrink-0">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setCreatingChild(true);
                    if (!isExpanded) onToggleExpand(node.path);
                  }}
                  className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-gray-100 transition-colors"
                  aria-label={`Add subfolder under ${node.name}`}
                  title="Add subfolder"
                >
                  <Plus className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setRenamingThis(true);
                    setRenameValue(node.name);
                    setConfirmDelete(false);
                  }}
                  className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-gray-100 transition-colors"
                  aria-label={`Rename ${node.name}`}
                  title="Rename"
                >
                  <Pencil className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setConfirmDelete((v) => !v);
                    setRenamingThis(false);
                  }}
                  className="p-1 rounded text-muted-foreground hover:text-red-500 hover:bg-red-50 transition-colors"
                  aria-label={`Delete ${node.name}`}
                  title="Delete"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {confirmDelete && (
        <DeleteFolderDialog
          folder={node.path}
          count={node.totalCount}
          onConfirm={() => {
            setConfirmDelete(false);
            onDeleteFolder(node.path);
          }}
          onCancel={() => setConfirmDelete(false)}
        />
      )}

      {/* Inline new-child input */}
      {creatingChild && (
        <div
          className="flex items-center gap-1 py-1 pr-1"
          style={{ paddingLeft: (depth + 1) * 12 + 4 }}
        >
          <span className="w-3.5 h-3.5 flex-shrink-0" />
          <input
            ref={newChildRef}
            type="text"
            value={newChildName}
            onChange={(e) => setNewChildName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submitChild();
              if (e.key === "Escape") {
                setCreatingChild(false);
                setNewChildName("");
              }
            }}
            placeholder="Subfolder name…"
            className="flex-1 text-xs bg-input border border-primary/50 rounded px-1.5 py-0.5
              focus:outline-none focus:ring-1 focus:ring-primary text-foreground min-w-0"
          />
          <button
            type="button"
            onClick={submitChild}
            className="text-primary hover:text-primary/80 transition-colors p-0.5 flex-shrink-0"
          >
            <Check className="w-3 h-3" />
          </button>
          <button
            type="button"
            onClick={() => { setCreatingChild(false); setNewChildName(""); }}
            className="text-muted-foreground hover:text-foreground transition-colors p-0.5 flex-shrink-0"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* Children */}
      {isExpanded && node.children.length > 0 && (
        <div>
          {node.children.map((child) => (
            <TreeNode
              key={child.path}
              node={child}
              depth={depth + 1}
              selectedFolder={selectedFolder}
              expandedPaths={expandedPaths}
              onToggleExpand={onToggleExpand}
              onSelectFolder={onSelectFolder}
              onCreateFolder={onCreateFolder}
              onRenameFolder={onRenameFolder}
              onDeleteFolder={onDeleteFolder}
              meetings={meetings}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function Sidebar({
  meetings,
  selectedId: _selectedId,
  selectedFolder,
  folders,
  onSelectFolder,
  onSelectMeeting: _onSelectMeeting,
  onOpenSettings,
  onMoveMeeting: _onMoveMeeting,
  onDeleteMeeting: _onDeleteMeeting,
  onRenameMeeting: _onRenameMeeting,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
}: Props) {
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (creatingFolder) inputRef.current?.focus();
  }, [creatingFolder]);

  // Auto-expand ancestors when selectedFolder changes
  useEffect(() => {
    if (selectedFolder) {
      const ancestors = getAncestors(selectedFolder);
      if (ancestors.length > 0) {
        setExpandedPaths((prev) => {
          const next = new Set(prev);
          ancestors.forEach((a) => next.add(a));
          return next;
        });
      }
    }
  }, [selectedFolder]);

  function toggleExpand(path: string) {
    setExpandedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }

  function submitNewFolder() {
    const name = newFolderName.trim();
    if (name) {
      onCreateFolder(name);
      onSelectFolder(name);
    }
    setCreatingFolder(false);
    setNewFolderName("");
  }

  const tree = buildTree(folders, meetings);
  const totalCount = meetings.length;

  return (
    <div className="flex flex-col h-full">
      {/* Logo / Brand */}
      <div className="px-4 py-4 border-b border-border flex-shrink-0">
        <h1 className="text-base font-bold tracking-tight text-foreground font-mono leading-tight">
          MeetingMind
        </h1>
        <p className="text-[11px] text-muted-foreground mt-0.5">Apple Watch → AI</p>
      </div>

      {/* New Folder button */}
      <div className="px-3 pt-3 pb-2 flex-shrink-0">
        <button
          type="button"
          onClick={() => setCreatingFolder(true)}
          className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium
            bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          New Folder
        </button>
      </div>

      {/* New root folder input */}
      {creatingFolder && (
        <div className="px-3 pb-2 flex-shrink-0">
          <div className="flex items-center gap-1">
            <input
              ref={inputRef}
              type="text"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submitNewFolder();
                if (e.key === "Escape") {
                  setCreatingFolder(false);
                  setNewFolderName("");
                }
              }}
              placeholder="Folder name…"
              className="flex-1 text-xs bg-input border border-primary/50 rounded px-2 py-1.5
                focus:outline-none focus:ring-1 focus:ring-primary text-foreground min-w-0"
            />
            <button
              type="button"
              onClick={submitNewFolder}
              className="text-primary hover:text-primary/80 transition-colors p-1 flex-shrink-0"
            >
              <Check className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => { setCreatingFolder(false); setNewFolderName(""); }}
              className="text-muted-foreground hover:text-foreground transition-colors p-1 flex-shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Folder tree */}
      <div className="flex-1 overflow-y-auto px-2 pb-2">
        {/* All Recordings root item */}
        <button
          type="button"
          onClick={() => onSelectFolder("")}
          className={`w-full flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs transition-colors mb-0.5 ${
            selectedFolder === ""
              ? "bg-violet-50 text-violet-700 font-semibold"
              : "text-muted-foreground hover:text-foreground hover:bg-gray-50"
          }`}
        >
          <span className="w-3.5 h-3.5 flex-shrink-0" />
          <span className="flex-1 text-left truncate">All Recordings</span>
          <span
            className={`text-[10px] px-1.5 py-0.5 rounded-full flex-shrink-0 leading-none ${
              selectedFolder === ""
                ? "bg-violet-100 text-violet-600"
                : "bg-gray-100 text-muted-foreground"
            }`}
          >
            {totalCount}
          </span>
        </button>

        {tree.map((node) => (
          <TreeNode
            key={node.path}
            node={node}
            depth={0}
            selectedFolder={selectedFolder}
            expandedPaths={expandedPaths}
            onToggleExpand={toggleExpand}
            onSelectFolder={onSelectFolder}
            onCreateFolder={onCreateFolder}
            onRenameFolder={onRenameFolder}
            onDeleteFolder={onDeleteFolder}
            meetings={meetings}
          />
        ))}
      </div>

      {/* Footer */}
      <div className="flex-shrink-0 px-4 py-3 border-t border-border">
        <button
          type="button"
          onClick={onOpenSettings}
          className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors w-full"
        >
          <Settings className="w-4 h-4" />
          Settings
        </button>
      </div>
    </div>
  );
}
