import { useCallback, useEffect, useRef, useState } from "react"
import { compileLatex } from "../latex/compiler"
import {
  allocatePath,
  dirMarkerPath,
  extractLatexError,
  inferMainTexPath,
  isTextFile,
  mergeProjectFiles,
} from "../project/files"
import {
  getProject,
  saveProjectContent,
  type ProjectRecord,
} from "../project/library"
import type { ProjectFiles } from "../project/types"
import { openWorkspace } from "../workspace/navigation"
import { CompileLog } from "./CompileLog"
import { CompileOverlay } from "./CompileOverlay"
import { FilePane } from "./FilePane"
import { FileTree } from "./FileTree"
import { PdfPreview } from "./PdfPreview"

const SAVE_DEBOUNCE_MS = 400

type EditorProps = {
  projectId: string
}

export function Editor({ projectId }: EditorProps) {
  const [record, setRecord] = useState<ProjectRecord | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    getProject(projectId)
      .then((project) => {
        if (!active) return
        if (!project) {
          openWorkspace()
          return
        }
        setRecord(project)
      })
      .catch((loadError: unknown) => {
        if (!active) return
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Não foi possível abrir o projeto",
        )
      })

    return () => {
      active = false
    }
  }, [projectId])

  if (error) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center gap-4 bg-paper px-6 text-center font-sans text-ink">
        <p className="text-sm text-muted">{error}</p>
        <button
          type="button"
          onClick={openWorkspace}
          className="rounded-md bg-teal px-3 py-1.5 text-sm font-medium text-white hover:bg-teal-deep"
        >
          Voltar aos projetos
        </button>
      </div>
    )
  }

  if (!record) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-paper font-sans text-sm text-muted">
        Abrindo projeto…
      </div>
    )
  }

  return <EditorSession key={record.id} project={record} />
}

function EditorSession({ project }: { project: ProjectRecord }) {
  const [status, setStatus] = useState<
    "idle" | "compiling" | "success" | "error"
  >("idle")
  const [pdf, setPdf] = useState<string | null>(null)
  const [compileLog, setCompileLog] = useState<string | null>(null)
  const [files, setFiles] = useState<ProjectFiles>(project.files)
  const [activePath, setActivePath] = useState(project.activePath)
  const [mainTexPath, setMainTexPath] = useState<string | null>(
    project.mainTexPath,
  )
  const [saveError, setSaveError] = useState(false)

  const compileIdRef = useRef(0)
  const pdfRef = useRef<string | null>(null)
  const saveTimerRef = useRef<number>(undefined)
  const dirtyRef = useRef(false)
  const mountedRef = useRef(true)
  const writeChainRef = useRef<Promise<void>>(Promise.resolve())
  const originRef = useRef({
    files: project.files,
    mainTexPath: project.mainTexPath,
    activePath: project.activePath,
  })
  const latestRef = useRef({
    files: project.files,
    mainTexPath: project.mainTexPath,
    activePath: project.activePath,
  })

  const runCompile = useCallback(
    async (projectFiles: ProjectFiles, mainPath: string | null) => {
      if (!mainPath) {
        setStatus("error")
        return
      }

      const compileId = ++compileIdRef.current
      setStatus("compiling")

      try {
        const result = await compileLatex(projectFiles, mainPath)

        if (compileId !== compileIdRef.current) return

        if (!result.success || !result.pdf) {
          console.error("erro ao compilar: ", result.log)
          setCompileLog(result.log)
          setStatus("error")
          return
        }

        const blob = new Blob([result.pdf.buffer as ArrayBuffer], {
          type: "application/pdf",
        })
        const url = URL.createObjectURL(blob)

        if (pdfRef.current) {
          URL.revokeObjectURL(pdfRef.current)
        }

        pdfRef.current = url
        setPdf(url)
        setCompileLog(null)
        setStatus("success")
      } catch (error) {
        if (compileId !== compileIdRef.current) return
        console.error("erro ao compilar: ", error)
        setCompileLog(error instanceof Error ? error.message : String(error))
        setStatus("error")
      }
    },
    [],
  )

  const compileNow = useCallback(() => {
    void runCompile(files, mainTexPath)
  }, [files, mainTexPath, runCompile])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat || event.altKey || event.shiftKey) return
      if (event.key.toLowerCase() !== "s") return
      if (!event.metaKey && !event.ctrlKey) return

      event.preventDefault()
      event.stopPropagation()
      compileNow()
    }

    window.addEventListener("keydown", onKeyDown, true)
    return () => window.removeEventListener("keydown", onKeyDown, true)
  }, [compileNow])

  useEffect(() => {
    return () => {
      if (pdfRef.current) {
        URL.revokeObjectURL(pdfRef.current)
      }
    }
  }, [])

  const flush = useCallback(() => {
    window.clearTimeout(saveTimerRef.current)
    const job = writeChainRef.current.then(async () => {
      while (dirtyRef.current) {
        const snapshot = latestRef.current
        dirtyRef.current = false
        try {
          await saveProjectContent(project.id, {
            files: snapshot.files,
            mainTexPath: snapshot.mainTexPath,
            activePath: snapshot.activePath,
          })
          if (mountedRef.current) setSaveError(false)
        } catch (error) {
          dirtyRef.current = true
          if (mountedRef.current) setSaveError(true)
          console.error("erro ao salvar projeto", error)
          return
        }
      }
    })
    writeChainRef.current = job.then(
      () => undefined,
      () => undefined,
    )
    return job
  }, [project.id])

  useEffect(() => {
    latestRef.current = { files, mainTexPath, activePath }
    const origin = originRef.current
    if (
      files === origin.files &&
      mainTexPath === origin.mainTexPath &&
      activePath === origin.activePath
    ) {
      return
    }

    dirtyRef.current = true
    window.clearTimeout(saveTimerRef.current)
    saveTimerRef.current = window.setTimeout(() => {
      void flush()
    }, SAVE_DEBOUNCE_MS)

    return () => window.clearTimeout(saveTimerRef.current)
  }, [files, mainTexPath, activePath, flush])

  useEffect(() => {
    mountedRef.current = true
    const onPageHide = () => {
      void flush()
    }
    window.addEventListener("pagehide", onPageHide)
    return () => {
      mountedRef.current = false
      window.removeEventListener("pagehide", onPageHide)
      void flush()
    }
  }, [flush])

  const handleBack = () => {
    void flush().then(() => openWorkspace())
  }

  const handleLoadProject = (nextFiles: ProjectFiles) => {
    const mainPath = inferMainTexPath(nextFiles)
    setFiles(nextFiles)
    setMainTexPath(mainPath)
    setActivePath(mainPath ?? Object.keys(nextFiles)[0] ?? "")
  }

  const handleAddFiles = (incoming: ProjectFiles) => {
    let first = ""
    setFiles((current) => {
      const { files: next, added } = mergeProjectFiles(current, incoming)
      first = added.find((path) => isTextFile(path)) ?? added[0] ?? ""
      return next
    })
    if (first) setActivePath(first)
  }

  const handleCreateFile = (path: string) => {
    let created = path
    setFiles((current) => {
      created = allocatePath(current, path)
      return { ...current, [created]: "" }
    })
    setActivePath(created)
  }

  const handleCreateFolder = (path: string) => {
    setFiles((current) => {
      const dir = allocatePath(current, path)
      return { ...current, [dirMarkerPath(dir)]: "" }
    })
  }

  const handleEditorChange = (value: string) => {
    if (!activePath || !isTextFile(activePath)) return

    setFiles((current) => {
      if (current[activePath] === value) return current
      return { ...current, [activePath]: value }
    })
  }

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-paper font-sans text-ink">
      <div className="flex h-12 shrink-0 items-center gap-4 border-b border-line bg-paper px-4">
        <button
          type="button"
          onClick={handleBack}
          className="rounded-md px-2 py-1 text-sm text-muted hover:bg-well hover:text-ink"
        >
          Projetos
        </button>
        <span className="text-base font-medium tracking-tight text-teal">
          Unitex
        </span>
        <span className="min-w-0 truncate text-sm text-ink">{project.name}</span>
        <button
          type="button"
          onClick={compileNow}
          disabled={status === "compiling"}
          className="rounded-md bg-teal px-3 py-1.5 text-sm font-medium text-white hover:bg-teal-deep disabled:opacity-50"
        >
          Compilar
        </button>
        <span
          className={`min-w-0 truncate text-xs ${
            status === "success" ? "text-teal" : "text-muted"
          }`}
        >
          {statusLabel(status, compileLog)}
          {mainTexPath ? ` · principal: ${mainTexPath}` : " · sem .tex principal"}
          {saveError ? " · não foi possível salvar" : ""}
        </span>
      </div>
      <div className="flex min-h-0 min-w-0 flex-1">
        <FileTree
          files={files}
          activePath={activePath}
          mainTexPath={mainTexPath}
          onSelect={setActivePath}
          onSetMain={setMainTexPath}
          onLoadProject={handleLoadProject}
          onAddFiles={handleAddFiles}
          onCreateFile={handleCreateFile}
          onCreateFolder={handleCreateFolder}
        />
        <div className="h-full min-w-0 flex-1">
          <FilePane
            path={activePath}
            content={activePath ? files[activePath] : undefined}
            onChange={handleEditorChange}
          />
        </div>
        <div className="relative h-full w-1/2 min-w-0 border-l border-line">
          {status === "error" && compileLog ? (
            <CompileLog log={compileLog} />
          ) : pdf ? (
            <PdfPreview urlPdf={pdf} />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-well text-sm text-muted">
              Aguardando a pré-visualização
            </div>
          )}
          {status === "compiling" && <CompileOverlay />}
        </div>
      </div>
    </div>
  )
}

function statusLabel(
  status: "idle" | "compiling" | "success" | "error",
  compileLog: string | null,
) {
  switch (status) {
    case "compiling":
      return "Compilando"
    case "success":
      return "Pronto"
    case "error":
      return extractLatexError(compileLog ?? "") ?? "Erro"
    default:
      return "Ocioso"
  }
}
