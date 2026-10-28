import { useCallback, useEffect, useRef, useState } from "react"
import { CompileLog } from "./components/CompileLog"
import { CompileOverlay } from "./components/CompileOverlay"
import { FilePane } from "./components/FilePane"
import { FileTree } from "./components/FileTree"
import { PdfPreview } from "./components/PdfPreview"
import { compileLatex } from "./latex/compiler"
import { DEFAULT_FILES, DEFAULT_MAIN_TEX } from "./project/defaultProject"
import {
  allocatePath,
  dirMarkerPath,
  extractLatexError,
  inferMainTexPath,
  isTextFile,
  mergeProjectFiles,
} from "./project/files"
import type { ProjectFiles } from "./project/types"

const PREVIEW_DEBOUNCE_MS = 800

function App() {
  const [status, setStatus] = useState<
    "idle" | "compiling" | "success" | "error"
  >("idle")
  const [pdf, setPdf] = useState<string | null>(null)
  const [compileLog, setCompileLog] = useState<string | null>(null)
  const [files, setFiles] = useState<ProjectFiles>(DEFAULT_FILES)
  const [activePath, setActivePath] = useState(DEFAULT_MAIN_TEX)
  const [mainTexPath, setMainTexPath] = useState<string | null>(DEFAULT_MAIN_TEX)

  const compileIdRef = useRef(0)
  const pdfRef = useRef<string | null>(null)
  const debounceRef = useRef<number>(undefined)

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

        const blob = new Blob(
          [result.pdf.buffer as ArrayBuffer],
          { type: "application/pdf" },
        )
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

  useEffect(() => {
    debounceRef.current = window.setTimeout(() => {
      void runCompile(files, mainTexPath)
    }, PREVIEW_DEBOUNCE_MS)

    return () => {
      window.clearTimeout(debounceRef.current)
      compileIdRef.current += 1
    }
  }, [files, mainTexPath, runCompile])

  useEffect(() => {
    return () => {
      if (pdfRef.current) {
        URL.revokeObjectURL(pdfRef.current)
      }
    }
  }, [])

  const handleCompile = () => {
    window.clearTimeout(debounceRef.current)
    void runCompile(files, mainTexPath)
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
        <span className="text-base font-medium tracking-tight text-teal">
          Unitex
        </span>
        <button
          onClick={handleCompile}
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

export default App
