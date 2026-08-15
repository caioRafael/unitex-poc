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
    <>
      <button onClick={handleCompile} disabled={status === "compiling"}>
        Compile
      </button>
      <div className="flex flex-row justify-center items-center h-screen w-screen bg-gray-100">
        <LatexEditor latex={latex} setLatex={setLatex} />
        <div className="relative h-screen w-1/2">
          {pdf ? (
            <PdfPreview urlPdf={pdf} />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gray-100">
              <span>Waiting for preview...</span>
            </div>
          )}
          {status === "compiling" && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-100/70">
              <span>Compiling...</span>
            </div>
          )}
          {status === "error" && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded bg-red-600 px-3 py-1 text-white">
              Error
            </div>
          )}
        </div>
      </div>
    </>
  )
}

export default App
