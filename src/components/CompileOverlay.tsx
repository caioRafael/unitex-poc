interface CompileOverlayProps {
  message?: string
}

export function CompileOverlay({ message = "Compilando" }: CompileOverlayProps) {
  return (
    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-well/80 backdrop-blur-[2px]">
      <div className="relative h-12 w-12">
        <div className="absolute inset-0 rounded-full border-[3px] border-line" />
        <div className="absolute inset-0 animate-spin rounded-full border-[3px] border-transparent border-t-teal" />
      </div>
      <div className="flex flex-col items-center gap-1">
        <p className="text-sm font-medium text-ink">{message}</p>
        <p className="animate-pulse text-xs text-muted">
          Gerando a pré-visualização
        </p>
      </div>
    </div>
  )
}
