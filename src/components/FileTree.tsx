import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react"
import {
  allocatePath,
  ancestorDirs,
  buildFileTree,
  collectDirPaths,
  fileName,
  isTexFile,
  isValidEntryName,
  joinPath,
  parentDir,
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
  onAddFiles: (files: ProjectFiles) => void
  onCreateFile: (path: string) => void
  onCreateFolder: (path: string) => void
}

type Draft = { dir: string; kind: "file" | "dir"; name: string }

type ContextMenuState = {
  x: number
  y: number
  dir: string
  filePath: string | null
}

export function FileTree({
  files,
  activePath,
  mainTexPath,
  onSelect,
  onSetMain,
  onLoadProject,
  onAddFiles,
  onCreateFile,
  onCreateFolder,
}: FileTreeProps) {
  const openFolderRef = useRef<HTMLInputElement>(null)
  const addFilesRef = useRef<HTMLInputElement>(null)
  const addFolderRef = useRef<HTMLInputElement>(null)
  const importDirRef = useRef("")
  const dragCountRef = useRef(0)
  const [dragOver, setDragOver] = useState(false)
  const [dropDir, setDropDir] = useState<string | null>(null)
  const [targetDir, setTargetDir] = useState("")
  const [draft, setDraft] = useState<Draft | null>(null)
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)
  const pathKey = Object.keys(files).sort().join("\0")
  const tree = useMemo(
    () => buildFileTree(pathKey ? pathKey.split("\0") : []),
    [pathKey],
  )
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(collectDirPaths(tree)),
  )

  useEffect(() => {
    for (const input of [openFolderRef.current, addFolderRef.current]) {
      if (!input) continue
      input.setAttribute("webkitdirectory", "")
      input.setAttribute("directory", "")
    }
  }, [])

  const expandDirs = (dirs: string[]) => {
    setExpanded((current) => {
      const next = new Set(current)
      for (const dir of dirs) {
        if (dir) next.add(dir)
      }
      return next
    })
  }

  const loadProject = (next: ProjectFiles) => {
    if (Object.keys(next).length === 0) return
    setExpanded(new Set(collectDirPaths(buildFileTree(Object.keys(next)))))
    setTargetDir("")
    setDraft(null)
    setContextMenu(null)
    onLoadProject(next)
  }

  const mergeFiles = (incoming: ProjectFiles) => {
    if (Object.keys(incoming).length === 0) return
    expandDirs([
      ...Object.keys(incoming).flatMap((path) => ancestorDirs(path)),
      ...collectDirPaths(buildFileTree(Object.keys(incoming))),
    ])
    onAddFiles(incoming)
  }

  const toggleDir = (path: string) => {
    setTargetDir(path)
    setExpanded((current) => {
      const next = new Set(current)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }

  const startDraft = (kind: "file" | "dir", dir = targetDir) => {
    setTargetDir(dir)
    expandDirs(ancestorDirs(joinPath(dir, "placeholder")))
    if (dir) expandDirs([dir])
    setDraft({
      dir,
      kind,
      name: defaultDraftName(files, dir, kind),
    })
    setContextMenu(null)
  }

  const openContextMenu = (
    event: MouseEvent,
    dir: string,
    filePath: string | null = null,
  ) => {
    event.preventDefault()
    event.stopPropagation()
    setTargetDir(dir)
    setContextMenu({
      x: event.clientX,
      y: event.clientY,
      dir,
      filePath,
    })
  }

  const importInto = (dir: string, kind: "files" | "folder") => {
    importDirRef.current = dir
    setTargetDir(dir)
    setContextMenu(null)
    if (kind === "files") addFilesRef.current?.click()
    else addFolderRef.current?.click()
  }

  const submitDraft = (name: string) => {
    if (!draft) return
    const path = joinPath(draft.dir, name.trim())
    if (draft.kind === "dir") {
      expandDirs([path, ...ancestorDirs(`${path}/x`)])
      onCreateFolder(path)
    } else {
      expandDirs(ancestorDirs(path))
      onCreateFile(path)
    }
    setDraft(null)
  }

  return (
    <div
      className={`flex h-full w-64 shrink-0 flex-col border-r border-line bg-paper text-sm text-ink ${
        dragOver ? "outline-2 -outline-offset-2 outline-teal" : ""
      }`}
      onDragEnter={(event) => {
        event.preventDefault()
        dragCountRef.current += 1
        setDragOver(true)
      }}
      onDragOver={(event) => {
        event.preventDefault()
        setDropDir("")
      }}
      onDragLeave={() => {
        dragCountRef.current -= 1
        if (dragCountRef.current <= 0) {
          dragCountRef.current = 0
          setDragOver(false)
          setDropDir(null)
        }
      }}
      onDrop={(event) => {
        event.preventDefault()
        dragCountRef.current = 0
        setDragOver(false)
        const baseDir = dropDir ?? ""
        setDropDir(null)
        void filesFromDataTransfer(event.dataTransfer, {
          stripRoot: false,
          baseDir,
        }).then(mergeFiles)
      }}
      onContextMenu={(event) => openContextMenu(event, "")}
    >
      <div className="border-b border-line px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium tracking-wide text-muted">
            Arquivos
          </span>
          <button
            type="button"
            title="Substituir a árvore por uma pasta do disco"
            onClick={() => openFolderRef.current?.click()}
            className="rounded-md px-2 py-1 text-xs text-teal hover:bg-teal-wash"
          >
            Abrir pasta
          </button>
        </div>
        <p className="mt-2 text-[11px] leading-4 text-faint">
          Clique com o botão direito numa pasta para adicionar arquivos
        </p>
        <input
          ref={openFolderRef}
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
        <input
          ref={addFilesRef}
          type="file"
          multiple
          className="hidden"
          onChange={(event) => {
            const list = event.target.files
            const baseDir = importDirRef.current || targetDir
            if (list && list.length > 0) {
              void filesFromFileList(list, {
                stripRoot: false,
                baseDir,
              }).then(mergeFiles)
            }
            event.target.value = ""
          }}
        />
        <input
          ref={addFolderRef}
          type="file"
          multiple
          className="hidden"
          onChange={(event) => {
            const list = event.target.files
            const baseDir = importDirRef.current || targetDir
            if (list && list.length > 0) {
              void filesFromFileList(list, {
                stripRoot: false,
                baseDir,
              }).then(mergeFiles)
            }
            event.target.value = ""
          }}
        />
      </div>
      <div className="min-h-0 flex-1 overflow-auto py-1">
        {draft?.dir === "" && (
          <DraftInput
            depth={0}
            kind={draft.kind}
            initialName={draft.name}
            onSubmit={submitDraft}
            onCancel={() => setDraft(null)}
          />
        )}
        {tree.length === 0 && !draft ? (
          <p className="px-4 py-4 text-xs leading-5 text-muted">
            Clique com o botão direito aqui para criar um arquivo. As alterações
            ficam no navegador.
          </p>
        ) : (
          tree.map((node) => (
            <TreeItem
              key={node.path}
              node={node}
              depth={0}
              activePath={activePath}
              mainTexPath={mainTexPath}
              targetDir={targetDir}
              dropDir={dropDir}
              expanded={expanded}
              draft={draft}
              onSelect={(path) => {
                setTargetDir(parentDir(path))
                onSelect(path)
              }}
              onSetMain={onSetMain}
              onToggle={toggleDir}
              onContextMenu={openContextMenu}
              onDropDir={setDropDir}
              onMergeInto={(dir, dataTransfer) => {
                void filesFromDataTransfer(dataTransfer, {
                  stripRoot: false,
                  baseDir: dir,
                }).then(mergeFiles)
              }}
              onSubmitDraft={submitDraft}
              onCancelDraft={() => setDraft(null)}
            />
          ))
        )}
      </div>
      {contextMenu && (
        <TreeContextMenu
          menu={contextMenu}
          onNewFile={() => startDraft("file", contextMenu.dir)}
          onNewFolder={() => startDraft("dir", contextMenu.dir)}
          onAddFiles={() => importInto(contextMenu.dir, "files")}
          onAddFolder={() => importInto(contextMenu.dir, "folder")}
          onSetMain={
            contextMenu.filePath && isTexFile(contextMenu.filePath)
              ? () => {
                  const path = contextMenu.filePath
                  if (!path) return
                  onSetMain(path)
                  onSelect(path)
                  setContextMenu(null)
                }
              : undefined
          }
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  )
}

function defaultDraftName(
  files: ProjectFiles,
  dir: string,
  kind: "file" | "dir",
) {
  const base = kind === "file" ? "untitled.tex" : "untitled"
  return fileName(allocatePath(files, joinPath(dir, base)))
}

function TreeContextMenu({
  menu,
  onNewFile,
  onNewFolder,
  onAddFiles,
  onAddFolder,
  onSetMain,
  onClose,
}: {
  menu: ContextMenuState
  onNewFile: () => void
  onNewFolder: () => void
  onAddFiles: () => void
  onAddFolder: () => void
  onSetMain?: () => void
  onClose: () => void
}) {
  const menuRef = useRef<HTMLDivElement>(null)
  const left = Math.min(menu.x, window.innerWidth - 248)
  const top = Math.min(menu.y, window.innerHeight - 220)

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) onClose()
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose()
    }

    window.addEventListener("pointerdown", onPointerDown)
    window.addEventListener("keydown", onKeyDown)
    return () => {
      window.removeEventListener("pointerdown", onPointerDown)
      window.removeEventListener("keydown", onKeyDown)
    }
  }, [onClose])

  return (
    <div
      ref={menuRef}
      role="menu"
      style={{ left, top }}
      className="fixed z-50 min-w-60 rounded-md border border-line bg-paper py-1 text-xs text-ink shadow-sm"
      onPointerDown={(event) => event.stopPropagation()}
      onContextMenu={(event) => event.stopPropagation()}
    >
      <p className="truncate px-3 py-1.5 text-[10px] tracking-wide text-faint">
        {menu.dir || "/"}
      </p>
      <MenuItem onClick={onNewFile}>Novo arquivo</MenuItem>
      <MenuItem onClick={onNewFolder}>Nova pasta</MenuItem>
      <div className="my-1 border-t border-line" />
      <MenuItem onClick={onAddFiles}>Adicionar arquivos…</MenuItem>
      <MenuItem onClick={onAddFolder}>Adicionar pasta…</MenuItem>
      {onSetMain && (
        <>
          <div className="my-1 border-t border-line" />
          <MenuItem onClick={onSetMain}>Definir como arquivo principal</MenuItem>
        </>
      )}
    </div>
  )
}

function MenuItem({
  children,
  onClick,
}: {
  children: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className="block w-full px-3 py-1.5 text-left hover:bg-teal-wash"
    >
      {children}
    </button>
  )
}

function DraftInput({
  depth,
  kind,
  initialName,
  onSubmit,
  onCancel,
}: {
  depth: number
  kind: "file" | "dir"
  initialName: string
  onSubmit: (name: string) => void
  onCancel: () => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const doneRef = useRef(false)
  const [name, setName] = useState(initialName)

  useEffect(() => {
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [])

  const finish = (submit: boolean) => {
    if (doneRef.current) return
    doneRef.current = true

    const trimmed = name.trim()
    if (!submit || !trimmed || !isValidEntryName(trimmed)) {
      onCancel()
      return
    }

    onSubmit(trimmed)
  }

  return (
    <div
      style={{ paddingLeft: 8 + depth * 12 }}
      className="flex items-center gap-1 py-0.5 pr-2"
    >
      <span className="w-3" />
      {kind === "dir" ? <FolderIcon /> : <FileIcon />}
      <input
        ref={inputRef}
        value={name}
        aria-label={kind === "dir" ? "Nome da nova pasta" : "Nome do novo arquivo"}
        onChange={(event) => setName(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault()
            finish(true)
          }
          if (event.key === "Escape") {
            event.preventDefault()
            doneRef.current = true
            onCancel()
          }
        }}
        onBlur={() => finish(true)}
        className="min-w-0 flex-1 rounded bg-paper px-1 py-0.5 text-xs text-ink outline-none ring-1 ring-teal"
      />
    </div>
  )
}

function TreeItem({
  node,
  depth,
  activePath,
  mainTexPath,
  targetDir,
  dropDir,
  expanded,
  draft,
  onSelect,
  onSetMain,
  onToggle,
  onContextMenu,
  onDropDir,
  onMergeInto,
  onSubmitDraft,
  onCancelDraft,
}: {
  node: FileTreeNode
  depth: number
  activePath: string | null
  mainTexPath: string | null
  targetDir: string
  dropDir: string | null
  expanded: Set<string>
  draft: Draft | null
  onSelect: (path: string) => void
  onSetMain: (path: string) => void
  onToggle: (path: string) => void
  onContextMenu: (
    event: MouseEvent,
    dir: string,
    filePath?: string | null,
  ) => void
  onDropDir: (path: string | null) => void
  onMergeInto: (dir: string, dataTransfer: DataTransfer) => void
  onSubmitDraft: (name: string) => void
  onCancelDraft: () => void
}) {
  const paddingLeft = 8 + depth * 12

  if (node.kind === "dir") {
    const isOpen = expanded.has(node.path)
    const isTarget = targetDir === node.path
    const isDrop = dropDir === node.path

    return (
      <div>
        <button
          type="button"
          style={{ paddingLeft }}
          className={`flex w-full items-center gap-1 py-1 pr-2 text-left hover:bg-teal-wash ${
            isDrop ? "bg-teal-wash" : isTarget ? "bg-well" : ""
          }`}
          onClick={() => onToggle(node.path)}
          onContextMenu={(event) => onContextMenu(event, node.path)}
          onDragOver={(event) => {
            event.preventDefault()
            event.stopPropagation()
            onDropDir(node.path)
          }}
          onDrop={(event) => {
            event.preventDefault()
            event.stopPropagation()
            onDropDir(null)
            onMergeInto(node.path, event.dataTransfer)
          }}
        >
          <ChevronIcon open={isOpen} />
          <FolderIcon />
          <span className="truncate">{node.name}</span>
        </button>
        {isOpen && (
          <>
            {draft?.dir === node.path && (
              <DraftInput
                depth={depth + 1}
                kind={draft.kind}
                initialName={draft.name}
                onSubmit={onSubmitDraft}
                onCancel={onCancelDraft}
              />
            )}
            {node.children.map((child) => (
              <TreeItem
                key={child.path}
                node={child}
                depth={depth + 1}
                activePath={activePath}
                mainTexPath={mainTexPath}
                targetDir={targetDir}
                dropDir={dropDir}
                expanded={expanded}
                draft={draft}
                onSelect={onSelect}
                onSetMain={onSetMain}
                onToggle={onToggle}
                onContextMenu={onContextMenu}
                onDropDir={onDropDir}
                onMergeInto={onMergeInto}
                onSubmitDraft={onSubmitDraft}
                onCancelDraft={onCancelDraft}
              />
            ))}
          </>
        )}
      </div>
    )
  }

  const selected = node.path === activePath
  const isMain = node.path === mainTexPath
  const canBeMain = isTexFile(node.path)

  return (
    <div
      style={{ paddingLeft }}
      className={`group flex w-full items-center gap-1 py-1 pr-2 ${
        selected ? "bg-teal-wash text-teal" : "hover:bg-teal-wash"
      }`}
      onContextMenu={(event) =>
        onContextMenu(event, parentDir(node.path), node.path)
      }
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
          <span className="rounded bg-paper px-1 text-[10px] tracking-wide text-teal">
            principal
          </span>
        )}
      </button>
      {canBeMain && (
        <button
          type="button"
          title="Definir como arquivo principal"
          className={`shrink-0 text-xs ${
            isMain
              ? "text-teal"
              : "text-transparent group-hover:text-faint"
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
      className={`h-3 w-3 shrink-0 text-faint transition-transform ${
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
      className="h-3.5 w-3.5 shrink-0 text-teal-deep"
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
      className="h-3.5 w-3.5 shrink-0 text-faint"
      aria-hidden="true"
    >
      <path
        fill="currentColor"
        d="M4 1.5A1.5 1.5 0 0 0 2.5 3v10A1.5 1.5 0 0 0 4 14.5h8A1.5 1.5 0 0 0 13.5 13V6.2L9.8 1.5zM9 2.2 12.3 6H9z"
      />
    </svg>
  )
}
