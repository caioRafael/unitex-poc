interface CompileLogProps {
  log: string
}

export function CompileLog({ log }: CompileLogProps) {
  return (
    <div className="flex h-full w-full flex-col bg-paper">
      <p className="shrink-0 bg-error-wash px-4 py-3 text-sm text-log">
        Não foi possível gerar o PDF.
      </p>
      <pre className="min-h-0 flex-1 overflow-auto p-4 font-mono text-xs leading-5 whitespace-pre-wrap text-log">
        {log}
      </pre>
    </div>
  )
}
