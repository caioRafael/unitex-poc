import type { FileTreeNode, ProjectFiles } from "./types"

const BINARY_EXTENSIONS = new Set([
  "png",
  "jpg",
  "jpeg",
  "gif",
  "webp",
  "pdf",
  "eps",
  "tif",
  "tiff",
  "bmp",
  "ico",
  "ttf",
  "otf",
  "woff",
  "woff2",
  "eot",
  "pfb",
  "pfa",
  "zip",
  "gz",
  "bz2",
  "xz",
  "7z",
  "rar",
  "wav",
  "mp3",
  "mp4",
  "mov",
  "avi",
  "bin",
  "dat",
  "dvi",
  "xdv",
  "fmt",
])

const IMAGE_EXTENSIONS = new Set([
  "png",
  "jpg",
  "jpeg",
  "gif",
  "webp",
  "bmp",
  "svg",
])

const IGNORED_DIRS = new Set([
  ".git",
  "__MACOSX",
  "node_modules",
  ".svn",
  ".hg",
  ".idea",
  ".vscode",
])

const DOCUMENTCLASS_RE = /\\documentclass\b/

export const VIRTUAL_DIR_FILENAME = ".virtualdir"

export function normalizePath(path: string) {
  return path.replaceAll("\\", "/").replace(/^\.\//, "").replace(/\/+/g, "/")
}

export function fileName(path: string) {
  const parts = normalizePath(path).split("/").filter(Boolean)
  return parts[parts.length - 1] ?? path
}

export function parentDir(path: string) {
  const parts = normalizePath(path).split("/").filter(Boolean)
  return parts.slice(0, -1).join("/")
}

export function joinPath(...parts: string[]) {
  return parts
    .flatMap((part) => normalizePath(part).split("/"))
    .filter(Boolean)
    .join("/")
}

export function ancestorDirs(path: string) {
  const parts = normalizePath(path).split("/").filter(Boolean)
  const dirs: string[] = []
  let acc = ""

  for (let index = 0; index < parts.length - 1; index++) {
    acc = acc ? `${acc}/${parts[index]}` : parts[index]
    dirs.push(acc)
  }

  return dirs
}

export function isVirtualDirMarker(path: string) {
  return fileName(path) === VIRTUAL_DIR_FILENAME
}

export function dirMarkerPath(dir: string) {
  return joinPath(dir, VIRTUAL_DIR_FILENAME)
}

export function isValidEntryName(name: string) {
  const trimmed = name.trim()
  return (
    trimmed.length > 0 &&
    trimmed !== "." &&
    trimmed !== ".." &&
    trimmed !== VIRTUAL_DIR_FILENAME &&
    !/[\\/]/.test(trimmed)
  )
}

export function pathExists(files: ProjectFiles, path: string) {
  const normalized = normalizePath(path)
  if (!normalized) return true
  if (normalized in files) return true
  const prefix = `${normalized}/`
  return Object.keys(files).some(
    (entry) => entry === normalized || entry.startsWith(prefix),
  )
}

export function allocatePath(files: ProjectFiles, path: string) {
  const normalized = normalizePath(path)
  if (!pathExists(files, normalized)) return normalized

  const name = fileName(normalized)
  const dir = parentDir(normalized)
  const dot = name.lastIndexOf(".")
  const stem = dot > 0 ? name.slice(0, dot) : name
  const ext = dot > 0 ? name.slice(dot) : ""
  let index = 1

  while (true) {
    const candidate = joinPath(dir, `${stem}-${index}${ext}`)
    if (!pathExists(files, candidate)) return candidate
    index += 1
  }
}

export function mergeProjectFiles(current: ProjectFiles, incoming: ProjectFiles) {
  const next = { ...current }
  const added: string[] = []

  for (const [path, content] of Object.entries(incoming)) {
    const dest = allocatePath(next, path)
    next[dest] = content
    added.push(dest)
  }

  return { files: next, added }
}

export function fileExtension(path: string) {
  const name = fileName(path)
  const dot = name.lastIndexOf(".")
  if (dot <= 0) return ""
  return name.slice(dot + 1).toLowerCase()
}

export function isTextFile(path: string) {
  const ext = fileExtension(path)
  return ext === "" || !BINARY_EXTENSIONS.has(ext)
}

export function isImageFile(path: string) {
  return IMAGE_EXTENSIONS.has(fileExtension(path))
}

export function isTexFile(path: string) {
  return fileExtension(path) === "tex"
}

const TEX_SEARCH_EXTENSIONS = new Set([
  "cls",
  "sty",
  "bst",
  "clo",
  "def",
  "fd",
  "cfg",
  "lbx",
  "bbx",
  "cbx",
  "ldf",
])

export function filesForCompile(files: ProjectFiles): ProjectFiles {
  const next: ProjectFiles = Object.fromEntries(
    Object.entries(files).filter(([path]) => !isVirtualDirMarker(path)),
  )
  const uniqueByName = new Map<string, string>()

  for (const path of Object.keys(next)) {
    const name = fileName(path)
    if (!TEX_SEARCH_EXTENSIONS.has(fileExtension(name))) continue
    const existing = uniqueByName.get(name)
    uniqueByName.set(name, existing === undefined ? path : "")
  }

  for (const [name, path] of uniqueByName) {
    if (!path || next[name] !== undefined) continue
    next[name] = files[path]
  }

  return next
}

export function extractLatexError(log: string) {
  const match = log.match(/^! .+$/m)
  return match?.[0] ?? null
}

export function mimeFromPath(path: string) {
  switch (fileExtension(path)) {
    case "png":
      return "image/png"
    case "jpg":
    case "jpeg":
      return "image/jpeg"
    case "gif":
      return "image/gif"
    case "webp":
      return "image/webp"
    case "bmp":
      return "image/bmp"
    case "svg":
      return "image/svg+xml"
    default:
      return "application/octet-stream"
  }
}

export function shouldIgnore(path: string) {
  const parts = normalizePath(path).split("/").filter(Boolean)
  if (parts.some((part) => IGNORED_DIRS.has(part))) return true
  const name = parts[parts.length - 1] ?? ""
  return name === ".DS_Store" || name === "Thumbs.db" || name.startsWith("._")
}

export function inferMainTexPath(files: ProjectFiles) {
  const texPaths = Object.keys(files)
    .filter((path) => isTexFile(path) && typeof files[path] === "string")
    .sort(
      (a, b) =>
        a.split("/").length - b.split("/").length || a.localeCompare(b),
    )

  if (texPaths.includes("main.tex")) return "main.tex"

  const withClass = texPaths.find((path) => {
    const content = files[path]
    return typeof content === "string" && DOCUMENTCLASS_RE.test(content)
  })

  return withClass ?? texPaths[0] ?? null
}

export function buildFileTree(paths: string[]): FileTreeNode[] {
  const root: FileTreeNode[] = []

  for (const filePath of paths) {
    const parts = normalizePath(filePath).split("/").filter(Boolean)
    let current = root
    let acc = ""

    for (let index = 0; index < parts.length; index++) {
      const name = parts[index]
      acc = acc ? `${acc}/${name}` : name
      const isFile = index === parts.length - 1

      if (isFile) {
        if (
          !isVirtualDirMarker(acc) &&
          !current.some((node) => node.kind === "file" && node.path === acc)
        ) {
          current.push({ kind: "file", name, path: acc })
        }
        continue
      }

      let dir = current.find(
        (node): node is Extract<FileTreeNode, { kind: "dir" }> =>
          node.kind === "dir" && node.path === acc,
      )

      if (!dir) {
        dir = { kind: "dir", name, path: acc, children: [] }
        current.push(dir)
      }

      current = dir.children
    }
  }

  sortTree(root)
  return root
}

export function collectDirPaths(nodes: FileTreeNode[]): string[] {
  const dirs: string[] = []

  for (const node of nodes) {
    if (node.kind === "dir") {
      dirs.push(node.path)
      dirs.push(...collectDirPaths(node.children))
    }
  }

  return dirs
}

function sortTree(nodes: FileTreeNode[]) {
  nodes.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === "dir" ? -1 : 1
    return a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
  })

  for (const node of nodes) {
    if (node.kind === "dir") sortTree(node.children)
  }
}
