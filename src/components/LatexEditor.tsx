import { Editor } from "@monaco-editor/react"
import {
  LATEX_LANGUAGE_ID,
  LATEX_THEME_ID,
  registerLatexLanguage,
} from "../latex/monacoLatex"
import { fileExtension } from "../project/files"

interface LatexEditorProps {
  path: string
  value: string
  onChange: (value: string) => void
}

export function LatexEditor({ path, value, onChange }: LatexEditorProps) {
  const language = languageForPath(path)

  return (
    <Editor
      language={language}
      path={path}
      theme={LATEX_THEME_ID}
      value={value}
      onChange={(next) => onChange(next ?? "")}
      beforeMount={registerLatexLanguage}
      onMount={(editor, monaco) => {
        const model = editor.getModel()
        if (model) {
          monaco.editor.setModelLanguage(model, language)
        }
        monaco.editor.setTheme(LATEX_THEME_ID)
      }}
      options={{
        wordWrap: "on",
        wrappingIndent: "indent",
        fontSize: 14,
        fontFamily: "'Cascadia Mono', ui-monospace, monospace",
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
      className="h-full w-full bg-paper"
    />
  )
}

function languageForPath(path: string) {
  switch (fileExtension(path)) {
    case "tex":
    case "sty":
    case "cls":
    case "clo":
    case "ltx":
    case "dtx":
    case "def":
    case "bib":
      return LATEX_LANGUAGE_ID
    case "json":
      return "json"
    case "md":
      return "markdown"
    default:
      return "plaintext"
  }
}
