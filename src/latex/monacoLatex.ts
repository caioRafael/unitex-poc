import type { Monaco } from "@monaco-editor/react"
import {
  monarchTokenizer,
  registerLaTeXLanguage as registerMonacoLatex,
} from "monaco-latex"
import type { languages } from "monaco-editor"

export const LATEX_LANGUAGE_ID = "latex"
export const LATEX_THEME_ID = "unitex-light"

const latexTokenizer: languages.IMonarchLanguage = {
  ...monarchTokenizer,
  tokenizer: {
    ...monarchTokenizer.tokenizer,
    root: [
      ["\\$\\$", { token: "string.math", next: "@displayMath" }],
      ["\\\\\\[", { token: "string.math", next: "@displayMathBracket" }],
      ["\\\\\\(", { token: "string.math", next: "@inlineMathParen" }],
      ["\\$", { token: "string.math", next: "@inlineMath" }],
      ...monarchTokenizer.tokenizer.root,
    ],
    displayMath: [
      ["\\\\[a-zA-Z@]+", "keyword"],
      ["\\\\[^a-zA-Z@\\s]", "keyword"],
      ["\\$\\$", { token: "string.math", next: "@pop" }],
      ["[{}]", "@brackets"],
      [".", "string.math"],
    ],
    displayMathBracket: [
      ["\\\\[a-zA-Z@]+", "keyword"],
      ["\\\\\\]", { token: "string.math", next: "@pop" }],
      ["[{}]", "@brackets"],
      [".", "string.math"],
    ],
    inlineMathParen: [
      ["\\\\[a-zA-Z@]+", "keyword"],
      ["\\\\\\)", { token: "string.math", next: "@pop" }],
      ["[{}]", "@brackets"],
      [".", "string.math"],
    ],
    inlineMath: [
      ["\\\\[a-zA-Z@]+", "keyword"],
      ["\\\\[^a-zA-Z@\\s]", "keyword"],
      ["\\$", { token: "string.math", next: "@pop" }],
      ["[{}]", "@brackets"],
      [".", "string.math"],
    ],
  },
}

export function registerLatexLanguage(monaco: Monaco) {
  const alreadyRegistered = monaco.languages
    .getLanguages()
    .some((language: { id: string }) => language.id === LATEX_LANGUAGE_ID)

  if (!alreadyRegistered) {
    registerMonacoLatex(monaco)
  }

  monaco.languages.setMonarchTokensProvider(LATEX_LANGUAGE_ID, latexTokenizer)

  monaco.editor.defineTheme(LATEX_THEME_ID, {
    base: "vs",
    inherit: true,
    rules: [
      { token: "comment", foreground: "979BAD", fontStyle: "italic" },
      { token: "keyword", foreground: "1D6C76" },
      { token: "keyword.predefined", foreground: "1D6C76", fontStyle: "bold" },
      { token: "keyword.at", foreground: "239DAD" },
      { token: "tag", foreground: "1D6C76" },
      { token: "string", foreground: "4B69C6" },
      { token: "string.math", foreground: "1D6C76" },
      { token: "number", foreground: "565565" },
      { token: "delimiter", foreground: "239DAD" },
    ],
    colors: {
      "editor.background": "#FDFDFD",
      "editor.foreground": "#19181F",
      "editor.lineHighlightBackground": "#EFF0F3",
      "editor.selectionBackground": "#C9EBE8",
      "editor.inactiveSelectionBackground": "#E7F6F6",
      "editorCursor.foreground": "#239DAD",
      "editorLineNumber.foreground": "#979BAD",
      "editorLineNumber.activeForeground": "#666675",
      "editorGutter.background": "#FDFDFD",
      "editorIndentGuide.background1": "#E4E5EA",
      "editorIndentGuide.activeBackground1": "#CACCD6",
      "editorWhitespace.foreground": "#E4E5EA",
      "editorWidget.background": "#FDFDFD",
      "editorWidget.border": "#E4E5EA",
      "editorSuggestWidget.background": "#FDFDFD",
      "editorSuggestWidget.border": "#E4E5EA",
      "editorSuggestWidget.selectedBackground": "#E7F6F6",
      "scrollbarSlider.background": "#CACCD680",
      "scrollbarSlider.hoverBackground": "#B0B3C2",
      "scrollbarSlider.activeBackground": "#979BAD",
    },
  })
}
