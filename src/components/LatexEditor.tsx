import { Editor } from "@monaco-editor/react"
import {
  LATEX_LANGUAGE_ID,
  LATEX_THEME_ID,
  registerLatexLanguage,
} from "../latex/monacoLatex"

interface LatexEditorProps {
  latex: string
  setLatex: (latex: string) => void
}

export function LatexEditor({ latex, setLatex }: LatexEditorProps) {
  return (
    <Editor
      language={LATEX_LANGUAGE_ID}
      path="main.tex"
      theme="vs-dark"
      value={latex}
      onChange={(value) => setLatex(value ?? "")}
      beforeMount={registerLatexLanguage}
      onMount={(editor, monaco) => {
        const model = editor.getModel()
        if (model) {
          monaco.editor.setModelLanguage(model, LATEX_LANGUAGE_ID)
        }
        monaco.editor.setTheme(LATEX_THEME_ID)
      }}
      options={{
        wordWrap: "on",
        wrappingIndent: "indent",
        fontSize: 14,
        fontFamily: "Menlo, Monaco, 'Courier New', monospace",
        lineHeight: 22,
        minimap: { enabled: false },
        padding: { top: 12, bottom: 12 },
        automaticLayout: true,
        renderLineHighlight: "all",
        matchBrackets: "always",
        bracketPairColorization: { enabled: true },
        scrollBeyondLastLine: false,
        smoothScrolling: true,
        cursorBlinking: "smooth",
        cursorSmoothCaretAnimation: "on",
      }}
      className="w-1/2 h-full bg-[#1E1E2E]"
    />
  )
}
