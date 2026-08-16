import { useCallback, useEffect, useRef, useState } from "react"
import { LatexEditor } from "./components/LatexEditor"
import { PdfPreview } from "./components/PdfPreview"
import { compileLatex } from "./latex/compiler"

const PREVIEW_DEBOUNCE_MS = 800

function App() {
  const [status, setStatus] = useState<
    "idle" | "compiling" | "success" | "error"
  >("idle")
  const [pdf, setPdf] = useState<string | null>(null)
  const [latex, setLatex] = useState(String.raw`
\documentclass{article}

\begin{document}

\section{Introdução}

Olá mundo!

\end{document}
`.trim())

  const compileIdRef = useRef(0)
  const pdfRef = useRef<string | null>(null)
  const debounceRef = useRef<number>(undefined)

  const runCompile = useCallback(async (source: string) => {
    const compileId = ++compileIdRef.current
    setStatus("compiling")

    try {
      const result = await compileLatex(source)

      if (compileId !== compileIdRef.current) return

      if (!result.success || !result.pdf) {
        console.error("erro ao compilar: ", result.log)
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
      setStatus("success")
    } catch (error) {
      if (compileId !== compileIdRef.current) return
      console.error("erro ao compilar: ", error)
      setStatus("error")
    }
  }, [])

  useEffect(() => {
    debounceRef.current = window.setTimeout(() => {
      void runCompile(latex)
    }, PREVIEW_DEBOUNCE_MS)

    return () => {
      window.clearTimeout(debounceRef.current)
      compileIdRef.current += 1
    }
  }, [latex, runCompile])

  useEffect(() => {
    return () => {
      if (pdfRef.current) {
        URL.revokeObjectURL(pdfRef.current)
      }
    }
  }, [])

  const handleCompile = () => {
    window.clearTimeout(debounceRef.current)
    void runCompile(latex)
  }

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-gray-100">
      <div className="flex shrink-0 items-center border-b border-gray-200 bg-white px-3 py-2">
        <button
          onClick={handleCompile}
          disabled={status === "compiling"}
          className="rounded bg-gray-900 px-3 py-1 text-sm text-white disabled:opacity-50"
        >
          Compile
        </button>
      </div>
      <div className="flex min-h-0 min-w-0 flex-1">
        <div className="h-full w-1/2 min-w-0">
          <LatexEditor latex={latex} setLatex={setLatex} />
        </div>
        <div className="h-full w-1/2 min-w-0">
          {pdf ? (
            <PdfPreview urlPdf={pdf} />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-neutral-200 text-gray-500">
              Waiting for preview...
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default App
