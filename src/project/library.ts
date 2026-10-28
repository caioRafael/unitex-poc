import type { ProjectFiles } from "./types"

const DB_NAME = "unitex"
const DB_VERSION = 1
const PROJECTS_STORE = "projects"
const FILES_STORE = "files"

export type ProjectSummary = {
  id: string
  name: string
  createdAt: number
  updatedAt: number
  mainTexPath: string | null
  activePath: string
}

export type ProjectRecord = ProjectSummary & {
  files: ProjectFiles
}

export type ProjectDraft = {
  name: string
  files: ProjectFiles
  mainTexPath: string | null
  activePath: string
}

export type ProjectContent = {
  files: ProjectFiles
  mainTexPath: string | null
  activePath: string
}

type StoredFiles = {
  projectId: string
  files: ProjectFiles
}

let databasePromise: Promise<IDBDatabase> | null = null
let chain: Promise<void> = Promise.resolve()

function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const run = chain.then(task, task)
  chain = run.then(
    () => undefined,
    () => undefined,
  )
  return run
}

function openDatabase() {
  if (!databasePromise) {
    databasePromise = new Promise((resolve, reject) => {
      if (typeof indexedDB === "undefined") {
        databasePromise = null
        reject(new Error("IndexedDB indisponível"))
        return
      }

      const request = indexedDB.open(DB_NAME, DB_VERSION)

      request.onupgradeneeded = () => {
        const db = request.result
        if (!db.objectStoreNames.contains(PROJECTS_STORE)) {
          db.createObjectStore(PROJECTS_STORE, { keyPath: "id" })
        }
        if (!db.objectStoreNames.contains(FILES_STORE)) {
          db.createObjectStore(FILES_STORE, { keyPath: "projectId" })
        }
      }

      request.onsuccess = () => {
        const db = request.result
        db.onversionchange = () => {
          db.close()
          databasePromise = null
        }
        db.onclose = () => {
          databasePromise = null
        }
        resolve(db)
      }

      request.onerror = () => {
        databasePromise = null
        reject(request.error ?? new Error("Falha ao abrir os projetos locais"))
      }

      request.onblocked = () => {
        databasePromise = null
        reject(new Error("O banco local está bloqueado em outra aba"))
      }
    })
  }

  return databasePromise
}

function settleTransaction(tx: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    let settled = false

    const fail = () => {
      if (settled) return
      settled = true
      const error = tx.error
      reject(error instanceof Error ? error : new Error("Falha no IndexedDB"))
    }

    tx.oncomplete = () => {
      if (settled) return
      settled = true
      resolve()
    }
    tx.onabort = fail
    tx.onerror = fail
  })
}

function projectName(name: string) {
  const trimmed = name.trim()
  return trimmed || "Sem título"
}

function byRecent(a: ProjectSummary, b: ProjectSummary) {
  return b.updatedAt - a.updatedAt || b.createdAt - a.createdAt
}

export function listProjects() {
  return enqueue(async () => {
    const db = await openDatabase()
    const tx = db.transaction(PROJECTS_STORE, "readonly")
    const request = tx.objectStore(PROJECTS_STORE).getAll()
    const done = settleTransaction(tx)
    await done
    const rows = request.result as ProjectSummary[]
    return rows.sort(byRecent)
  })
}

export function getProject(id: string) {
  return enqueue(async () => {
    const db = await openDatabase()
    const tx = db.transaction([PROJECTS_STORE, FILES_STORE], "readonly")
    const projectRequest = tx.objectStore(PROJECTS_STORE).get(id)
    const filesRequest = tx.objectStore(FILES_STORE).get(id)
    await settleTransaction(tx)

    const summary = projectRequest.result as ProjectSummary | undefined
    if (!summary) return null

    const stored = filesRequest.result as StoredFiles | undefined
    return {
      ...summary,
      files: stored?.files ?? {},
    }
  })
}

export function createProject(draft: ProjectDraft) {
  return enqueue(async () => {
    const db = await openDatabase()
    const now = Date.now()
    const summary: ProjectSummary = {
      id: crypto.randomUUID(),
      name: projectName(draft.name),
      createdAt: now,
      updatedAt: now,
      mainTexPath: draft.mainTexPath,
      activePath: draft.activePath,
    }
    const stored: StoredFiles = {
      projectId: summary.id,
      files: { ...draft.files },
    }

    const tx = db.transaction([PROJECTS_STORE, FILES_STORE], "readwrite")
    tx.objectStore(PROJECTS_STORE).put(summary)
    tx.objectStore(FILES_STORE).put(stored)
    await settleTransaction(tx)
    return summary
  })
}

export function saveProjectContent(id: string, content: ProjectContent) {
  return enqueue(async () => {
    const db = await openDatabase()
    const tx = db.transaction([PROJECTS_STORE, FILES_STORE], "readwrite")
    const projects = tx.objectStore(PROJECTS_STORE)
    const getRequest = projects.get(id)
    let missing = false

    getRequest.onsuccess = () => {
      const current = getRequest.result as ProjectSummary | undefined
      if (!current) {
        missing = true
        return
      }

      const next: ProjectSummary = {
        ...current,
        mainTexPath: content.mainTexPath,
        activePath: content.activePath,
        updatedAt: Date.now(),
      }
      projects.put(next)
      const stored: StoredFiles = {
        projectId: id,
        files: content.files,
      }
      tx.objectStore(FILES_STORE).put(stored)
    }

    await settleTransaction(tx)
    if (missing) throw new Error("Projeto não encontrado")
  })
}

export function renameProject(id: string, name: string) {
  return enqueue(async () => {
    const db = await openDatabase()
    const tx = db.transaction(PROJECTS_STORE, "readwrite")
    const projects = tx.objectStore(PROJECTS_STORE)
    const getRequest = projects.get(id)
    const found: { summary: ProjectSummary | null } = { summary: null }

    getRequest.onsuccess = () => {
      const current = getRequest.result as ProjectSummary | undefined
      if (!current) return

      const summary: ProjectSummary = {
        ...current,
        name: projectName(name),
        updatedAt: Date.now(),
      }
      projects.put(summary)
      found.summary = summary
    }

    await settleTransaction(tx)
    if (!found.summary) throw new Error("Projeto não encontrado")
    return found.summary
  })
}

export function deleteProject(id: string) {
  return enqueue(async () => {
    const db = await openDatabase()
    const tx = db.transaction([PROJECTS_STORE, FILES_STORE], "readwrite")
    tx.objectStore(PROJECTS_STORE).delete(id)
    tx.objectStore(FILES_STORE).delete(id)
    await settleTransaction(tx)
  })
}
