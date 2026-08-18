interface CompileOverlayProps {
  message?: string
}

export function CompileOverlay({ message = "Compiling..." }: CompileOverlayProps) {
  return (
    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-neutral-200/75 backdrop-blur-[2px]">
      <div className="relative h-12 w-12">
        <div className="absolute inset-0 rounded-full border-[3px] border-gray-300" />
        <div className="absolute inset-0 animate-spin rounded-full border-[3px] border-transparent border-t-gray-900" />
      </div>
      <div className="flex flex-col items-center gap-1">
        <p className="text-sm font-medium text-gray-800">{message}</p>
        <p className="animate-pulse text-xs text-gray-500">
          Generating PDF preview
        </p>
      </div>
    </div>
  )
}
