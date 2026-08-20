import { isTextFile, joinPath, normalizePath, shouldIgnore } from "./files"
import type { ProjectFiles } from "./types"

type CollectedFile = {
  path: string
  file: File
}

type ReadOptions = {
  stripRoot?: boolean
  baseDir?: string
}

export async function filesFromFileList(
  fileList: FileList,
  options: ReadOptions = {},
) {
  const collected = Array.from(fileList).map((file) => ({
    path: normalizePath(file.webkitRelativePath || file.name),
    file,
  }))

  return filesFromCollected(collected, options)
}

export async function filesFromDataTransfer(
  dataTransfer: DataTransfer,
  options: ReadOptions = {},
) {
  const entries = Array.from(dataTransfer.items)
    .map((item) => item.webkitGetAsEntry?.())
    .filter((entry): entry is FileSystemEntry => Boolean(entry))

  if (entries.length > 0) {
    const collected = (
      await Promise.all(entries.map((entry) => collectEntry(entry, "")))
    ).flat()
    return filesFromCollected(collected, options)
  }

  if (dataTransfer.files.length > 0) {
    return filesFromFileList(dataTransfer.files, options)
  }

  return {}
}

async function filesFromCollected(
  collected: CollectedFile[],
  options: ReadOptions = {},
) {
  const visible = collected.filter(
    (item) => item.path && !shouldIgnore(item.path),
  )
  const prefix =
    options.stripRoot === false
      ? ""
      : commonRootPrefix(visible.map((item) => item.path))
  const files: ProjectFiles = {}

  await Promise.all(
    visible.map(async ({ path, file }) => {
      const relative = joinPath(
        options.baseDir ?? "",
        normalizePath(path.slice(prefix.length)),
      )
      if (!relative || shouldIgnore(relative)) return
      files[relative] = isTextFile(relative)
        ? await file.text()
        : new Uint8Array(await file.arrayBuffer())
    }),
  )

  return files
}

function commonRootPrefix(paths: string[]) {
  if (paths.length === 0) return ""

  const firstSegments = paths.map((path) => path.split("/")[0] ?? "")
  const shared = firstSegments[0]
  const allShareRoot =
    Boolean(shared) &&
    firstSegments.every((segment) => segment === shared) &&
    paths.every((path) => path.includes("/"))

  return allShareRoot ? `${shared}/` : ""
}

async function collectEntry(
  entry: FileSystemEntry,
  parent: string,
): Promise<CollectedFile[]> {
  const path = parent ? `${parent}/${entry.name}` : entry.name

  if (entry.isFile) {
    const file = await fileFromEntry(entry as FileSystemFileEntry)
    return [{ path: normalizePath(path), file }]
  }

  if (entry.isDirectory) {
    const children = await readDirectoryEntries(
      entry as FileSystemDirectoryEntry,
    )
    const nested = await Promise.all(
      children.map((child) => collectEntry(child, path)),
    )
    return nested.flat()
  }

  return []
}

function fileFromEntry(entry: FileSystemFileEntry) {
  return new Promise<File>((resolve, reject) => {
    entry.file(resolve, reject)
  })
}

function readDirectoryEntries(entry: FileSystemDirectoryEntry) {
  const reader = entry.createReader()

  return new Promise<FileSystemEntry[]>((resolve, reject) => {
    const entries: FileSystemEntry[] = []

    const readBatch = () => {
      reader.readEntries((batch) => {
        if (batch.length === 0) {
          resolve(entries)
          return
        }

        entries.push(...batch)
        readBatch()
      }, reject)
    }

    readBatch()
  })
}
