import { useEffect, useMemo, useRef, useState } from "react"
import {
  buildFileTree,
  collectDirPaths,
  isTexFile,
} from "../project/files"
import type { FileTreeNode, ProjectFiles } from "../project/types"
import { filesFromDataTransfer, filesFromFileList } from "../project/upload"

interface FileTreeProps {
  files: ProjectFiles
  activePath: string | null
  mainTexPath: string | null
  onSelect: (path: string) => void
  onSetMain: (path: string) => void
  onLoadProject: (files: ProjectFiles) => void
}

export function FileTree({
  files,
  activePath,
  mainTexPath,
  onSelect,
  onSetMain,
  onLoadProject,
}: FileTreeProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const dragCountRef = useRef(0)
  const [dragOver, setDragOver] = useState(false)
  const pathKey = Object.keys(files).sort().join("\0")
  const tree = useMemo(
    () => buildFileTree(pathKey ? pathKey.split("\0") : []),
    [pathKey],
  )
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(collectDirPaths(tree)),
  )

  useEffect(() => {
    const input = inputRef.current
    if (!input) return
    input.setAttribute("webkitdirectory", "")
    input.setAttribute("directory", "")
  }, [])

  const loadProject = (next: ProjectFiles) => {
    if (Object.keys(next).length === 0) return
    setExpanded(new Set(collectDirPaths(buildFileTree(Object.keys(next)))))
    onLoadProject(next)
  }

  const toggleDir = (path: string) => {
    setExpanded((current) => {
      const next = new Set(current)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }

  return (
    <div
      className={`flex h-full w-64 shrink-0 flex-col border-r border-[#2A2B3C] bg-[#181825] text-sm text-[#ABB2BF] ${
        dragOver ? "outline-2 -outline-offset-2 outline-[#528BFF]" : ""
      }`}
      onDragEnter={(event) => {
        event.preventDefault()
        dragCountRef.current += 1
        setDragOver(true)
      }}
      onDragOver={(event) => {
        event.preventDefault()
      }}
      onDragLeave={() => {
        dragCountRef.current -= 1
        if (dragCountRef.current <= 0) {
          dragCountRef.current = 0
          setDragOver(false)
        }
      }}
      onDrop={(event) => {
        event.preventDefault()
        dragCountRef.current = 0
        setDragOver(false)
        void filesFromDataTransfer(event.dataTransfer).then(loadProject)
      }}
    >
      <div className="flex items-center justify-between gap-2 border-b border-[#2A2B3C] px-3 py-2">
        <span className="text-xs font-medium uppercase tracking-wide text-[#7F848E]">
          Files
        </span>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="rounded bg-[#2A2B3C] px-2 py-1 text-xs text-[#ABB2BF] hover:bg-[#3E4452]"
        >
          Upload folder
        </button>
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(event) => {
            const list = event.target.files
            if (list && list.length > 0) {
              void filesFromFileList(list).then(loadProject)
            }
            event.target.value = ""
          }}
        />
      </div>
      <div className="min-h-0 flex-1 overflow-auto py-1">
        {tree.length === 0 ? (
          <p className="px-3 py-4 text-xs text-[#7F848E]">
            Upload a LaTeX project folder to get started.
          </p>
        ) : (
          tree.map((node) => (
            <TreeItem
              key={node.path}
              node={node}
              depth={0}
              activePath={activePath}
              mainTexPath={mainTexPath}
              expanded={expanded}
              onSelect={onSelect}
              onSetMain={onSetMain}
              onToggle={toggleDir}
            />
          ))
        )}
      </div>
    </div>
  )
}

function TreeItem({
  node,
  depth,
  activePath,
  mainTexPath,
  expanded,
  onSelect,
  onSetMain,
  onToggle,
}: {
  node: FileTreeNode
  depth: number
  activePath: string | null
  mainTexPath: string | null
  expanded: Set<string>
  onSelect: (path: string) => void
  onSetMain: (path: string) => void
  onToggle: (path: string) => void
}) {
  const paddingLeft = 8 + depth * 12

  if (node.kind === "dir") {
    const isOpen = expanded.has(node.path)

    return (
      <div>
        <button
          type="button"
          style={{ paddingLeft }}
          className="flex w-full items-center gap-1 py-0.5 pr-2 text-left hover:bg-[#2A2B3C]"
          onClick={() => onToggle(node.path)}
        >
          <ChevronIcon open={isOpen} />
          <FolderIcon />
          <span className="truncate">{node.name}</span>
        </button>
        {isOpen &&
          node.children.map((child) => (
            <TreeItem
              key={child.path}
              node={child}
              depth={depth + 1}
              activePath={activePath}
              mainTexPath={mainTexPath}
              expanded={expanded}
              onSelect={onSelect}
              onSetMain={onSetMain}
              onToggle={onToggle}
            />
          ))}
      </div>
    )
  }

  const selected = node.path === activePath
  const isMain = node.path === mainTexPath
  const canBeMain = isTexFile(node.path)

  return (
    <div
      style={{ paddingLeft }}
      className={`group flex w-full items-center gap-1 py-0.5 pr-2 ${
        selected ? "bg-[#3E4452] text-white" : "hover:bg-[#2A2B3C]"
      }`}
    >
      <button
        type="button"
        title={node.path}
        className="flex min-w-0 flex-1 items-center gap-1 text-left"
        onClick={() => onSelect(node.path)}
      >
        <span className="w-3" />
        <FileIcon />
        <span className="truncate">{node.name}</span>
        {isMain && (
          <span className="rounded bg-[#528BFF]/20 px-1 text-[10px] uppercase tracking-wide text-[#528BFF]">
            main
          </span>
        )}
      </button>
      {canBeMain && (
        <button
          type="button"
          title="Set as main file"
          className={`shrink-0 text-xs ${
            isMain
              ? "text-amber-400"
              : "text-transparent group-hover:text-[#7F848E]"
          }`}
          onClick={() => {
            onSetMain(node.path)
            onSelect(node.path)
          }}
        >
          ★
        </button>
      )}
    </div>
  )
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 16 16"
      className={`h-3 w-3 shrink-0 text-[#7F848E] transition-transform ${
        open ? "rotate-90" : ""
      }`}
      aria-hidden="true"
    >
      <path fill="currentColor" d="M6 4l6 4-6 4z" />
    </svg>
  )
}

function FolderIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      className="h-3.5 w-3.5 shrink-0 text-[#E5C07B]"
      aria-hidden="true"
    >
      <path
        fill="currentColor"
        d="M2 3.5A1.5 1.5 0 0 1 3.5 2h3.1c.4 0 .77.2 1 .53L8.3 3.5H12.5A1.5 1.5 0 0 1 14 5v6.5A1.5 1.5 0 0 1 12.5 13h-9A1.5 1.5 0 0 1 2 11.5z"
      />
    </svg>
  )
}

function FileIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      className="h-3.5 w-3.5 shrink-0 text-[#ABB2BF]"
      aria-hidden="true"
    >
      <path
        fill="currentColor"
        d="M4 1.5A1.5 1.5 0 0 0 2.5 3v10A1.5 1.5 0 0 0 4 14.5h8A1.5 1.5 0 0 0 13.5 13V6.2L9.8 1.5zM9 2.2 12.3 6H9z"
      />
    </svg>
  )
}
