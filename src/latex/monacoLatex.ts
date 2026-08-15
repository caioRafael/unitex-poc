import type { Monaco } from "@monaco-editor/react"
import {
  monarchTokenizer,
  registerLaTeXLanguage as registerMonacoLatex,
} from "monaco-latex"
import type { languages } from "monaco-editor"

export const LATEX_LANGUAGE_ID = "latex"
export const LATEX_THEME_ID = "unitex-dark"

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
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "comment", foreground: "7F848E", fontStyle: "italic" },
      { token: "keyword", foreground: "C678DD" },
      { token: "keyword.predefined", foreground: "C678DD", fontStyle: "bold" },
      { token: "keyword.at", foreground: "56B6C2" },
      { token: "tag", foreground: "E5C07B" },
      { token: "string", foreground: "98C379" },
      { token: "number", foreground: "D19A66" },
      { token: "delimiter", foreground: "56B6C2" },
    ],
    colors: {
      "editor.background": "#1E1E2E",
      "editor.foreground": "#ABB2BF",
      "editor.lineHighlightBackground": "#2A2B3C",
      "editor.selectionBackground": "#3E4452",
      "editor.inactiveSelectionBackground": "#3E445280",
      "editorCursor.foreground": "#528BFF",
      "editorLineNumber.foreground": "#495162",
      "editorLineNumber.activeForeground": "#ABB2BF",
      "editorGutter.background": "#1E1E2E",
      "editorIndentGuide.background1": "#3B3C4A",
      "editorIndentGuide.activeBackground1": "#5C5D6B",
      "editorWhitespace.foreground": "#3B3C4A",
      "editorWidget.background": "#252536",
      "editorWidget.border": "#3B3C4A",
      "editorSuggestWidget.background": "#252536",
      "editorSuggestWidget.border": "#3B3C4A",
      "editorSuggestWidget.selectedBackground": "#3E4452",
      "scrollbarSlider.background": "#4B526380",
      "scrollbarSlider.hoverBackground": "#5C6370",
      "scrollbarSlider.activeBackground": "#747D8C",
    },
  })
}
