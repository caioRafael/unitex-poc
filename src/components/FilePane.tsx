import { useEffect, useMemo } from "react"
import { isImageFile, isTextFile, mimeFromPath } from "../project/files"
import { LatexEditor } from "./LatexEditor"

interface FilePaneProps {
  path: string | null
  content: string | Uint8Array | undefined
  onChange: (value: string) => void
}

export function FilePane({ path, content, onChange }: FilePaneProps) {
  if (!path || content === undefined) {
    return (
      <div className="flex h-full items-center justify-center bg-[#1E1E2E] text-sm text-[#7F848E]">
        Select a file to edit.
      </div>
    )
  }

  if (typeof content !== "string" || !isTextFile(path)) {
    if (content instanceof Uint8Array && isImageFile(path)) {
      return <ImagePreview path={path} bytes={content} />
    }

    return (
      <div className="flex h-full items-center justify-center bg-[#1E1E2E] px-6 text-center text-sm text-[#7F848E]">
        {path} is a binary file and cannot be edited here.
      </div>
    )
  }

  return <LatexEditor path={path} value={content} onChange={onChange} />
}

function ImagePreview({ path, bytes }: { path: string; bytes: Uint8Array }) {
  const url = useMemo(() => {
    const copy = new Uint8Array(bytes)
    return URL.createObjectURL(new Blob([copy], { type: mimeFromPath(path) }))
  }, [path, bytes])

  useEffect(() => {
    return () => URL.revokeObjectURL(url)
  }, [url])

  return (
    <div className="flex h-full items-center justify-center bg-[#1E1E2E] p-6">
      <img
        src={url}
        alt={path}
        className="max-h-full max-w-full object-contain"
      />
    </div>
  )
}
