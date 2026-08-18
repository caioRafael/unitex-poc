import { useCallback, useEffect, useRef, useState } from "react"
import { CompileLog } from "./components/CompileLog"
import { CompileOverlay } from "./components/CompileOverlay"
import { FilePane } from "./components/FilePane"
import { FileTree } from "./components/FileTree"
import { PdfPreview } from "./components/PdfPreview"
import { compileLatex } from "./latex/compiler"
import { DEFAULT_FILES, DEFAULT_MAIN_TEX } from "./project/defaultProject"
import { extractLatexError, inferMainTexPath, isTextFile } from "./project/files"
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

  const handleEditorChange = (value: string) => {
    if (!activePath || !isTextFile(activePath)) return

    setFiles((current) => {
      if (current[activePath] === value) return current
      return { ...current, [activePath]: value }
    })
  }

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-gray-100">
      <div className="flex shrink-0 items-center gap-3 border-b border-gray-200 bg-white px-3 py-2">
        <button
          onClick={handleCompile}
          disabled={status === "compiling"}
          className="rounded bg-gray-900 px-3 py-1 text-sm text-white disabled:opacity-50"
        >
          Compile
        </button>
        <span className="min-w-0 truncate text-xs text-gray-500">
          {statusLabel(status, compileLog)}
          {mainTexPath ? ` · main: ${mainTexPath}` : " · no main .tex"}
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
        />
        <div className="h-full min-w-0 flex-1">
          <FilePane
            path={activePath}
            content={activePath ? files[activePath] : undefined}
            onChange={handleEditorChange}
          />
        </div>
        <div className="relative h-full w-1/2 min-w-0">
          {status === "error" && compileLog ? (
            <CompileLog log={compileLog} />
          ) : pdf ? (
            <PdfPreview urlPdf={pdf} />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-neutral-200 text-gray-500">
              Waiting for preview...
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
      return "Compiling..."
    case "success":
      return "Ready"
    case "error":
      return extractLatexError(compileLog ?? "") ?? "Error"
    default:
      return "Idle"
  }
}

export default App
