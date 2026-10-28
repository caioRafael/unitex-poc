import { useEffect, useRef } from "react"
import {
  getDocument,
  GlobalWorkerOptions,
  RenderingCancelledException,
} from "pdfjs-dist"
import pdfWorker from "pdfjs-dist/build/pdf.worker.mjs?url"

GlobalWorkerOptions.workerSrc = pdfWorker

interface PdfPreviewProps {
  urlPdf: string
}

export function PdfPreview({ urlPdf }: PdfPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container || !urlPdf) return

    let cancelled = false
    const loadingTask = getDocument({ url: urlPdf })
    const renderTasks: Array<{ cancel: () => void }> = []
    const scrollTop = container.scrollTop

    const renderPdf = async () => {
      const pdf = await loadingTask.promise
      if (cancelled) return

      const width = Math.max(container.clientWidth - 32, 100)
      const canvases: HTMLCanvasElement[] = []

      for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
        const page = await pdf.getPage(pageNumber)
        if (cancelled) return

        const unscaled = page.getViewport({ scale: 1 })
        const viewport = page.getViewport({ scale: width / unscaled.width })
        const outputScale = window.devicePixelRatio || 1

        const canvas = document.createElement("canvas")
        canvas.className = "mx-auto mb-4 bg-paper shadow-sm"
        canvas.width = Math.floor(viewport.width * outputScale)
        canvas.height = Math.floor(viewport.height * outputScale)
        canvas.style.width = `${Math.floor(viewport.width)}px`
        canvas.style.height = `${Math.floor(viewport.height)}px`

        const renderTask = page.render({
          canvas,
          viewport,
          transform:
            outputScale !== 1
              ? [outputScale, 0, 0, outputScale, 0, 0]
              : undefined,
        })
        renderTasks.push(renderTask)
        await renderTask.promise

        canvases.push(canvas)
      }

      if (cancelled) return

      container.replaceChildren(...canvases)
      container.scrollTop = scrollTop
      await pdf.cleanup()
    }

    void renderPdf().catch((error: unknown) => {
      if (cancelled || error instanceof RenderingCancelledException) return
      console.error("erro ao renderizar pdf: ", error)
    })

    return () => {
      cancelled = true
      for (const task of renderTasks) {
        task.cancel()
      }
      void loadingTask.destroy()
    }
  }, [urlPdf])

  return (
    <div
      ref={containerRef}
      className="h-full w-full overflow-auto bg-well p-6"
    />
  )
}
