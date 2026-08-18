interface CompileLogProps {
  log: string
}

export function CompileLog({ log }: CompileLogProps) {
  return (
    <div className="h-full w-full overflow-auto bg-[#1E1E2E] p-4">
      <pre className="whitespace-pre-wrap font-mono text-xs leading-5 text-[#E06C75]">
        {log}
      </pre>
    </div>
  )
}
