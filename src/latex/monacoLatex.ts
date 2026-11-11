import type { Monaco } from "@monaco-editor/react"
import {
  monarchTokenizer,
  registerLaTeXLanguage as registerMonacoLatex,
} from "monaco-latex"
import type { languages } from "monaco-editor"
import type { ResolvedTheme } from "../theme/theme"

export const LATEX_LANGUAGE_ID = "latex"
export const LATEX_THEME_LIGHT_ID = "unitex-light"
export const LATEX_THEME_DARK_ID = "unitex-dark"

export function latexThemeId(theme: ResolvedTheme) {
  return theme === "dark" ? LATEX_THEME_DARK_ID : LATEX_THEME_LIGHT_ID
}

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

  monaco.editor.defineTheme(LATEX_THEME_LIGHT_ID, {
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

  monaco.editor.defineTheme(LATEX_THEME_DARK_ID, {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "comment", foreground: "878492", fontStyle: "italic" },
      { token: "keyword", foreground: "8ADBE3" },
      { token: "keyword.predefined", foreground: "8ADBE3", fontStyle: "bold" },
      { token: "keyword.at", foreground: "3EC4D4" },
      { token: "tag", foreground: "8ADBE3" },
      { token: "string", foreground: "A8B8F0" },
      { token: "string.math", foreground: "8ADBE3" },
      { token: "number", foreground: "C4BDD0" },
      { token: "delimiter", foreground: "3EC4D4" },
    ],
    colors: {
      "editor.background": "#17161D",
      "editor.foreground": "#F4F3F8",
      "editor.lineHighlightBackground": "#23222B",
      "editor.selectionBackground": "#1D4650",
      "editor.inactiveSelectionBackground": "#1A3338",
      "editorCursor.foreground": "#3EC4D4",
      "editorLineNumber.foreground": "#878492",
      "editorLineNumber.activeForeground": "#AEAAB8",
      "editorGutter.background": "#17161D",
      "editorIndentGuide.background1": "#393746",
      "editorIndentGuide.activeBackground1": "#5A5868",
      "editorWhitespace.foreground": "#393746",
      "editorWidget.background": "#17161D",
      "editorWidget.border": "#393746",
      "editorSuggestWidget.background": "#17161D",
      "editorSuggestWidget.border": "#393746",
      "editorSuggestWidget.selectedBackground": "#1A3338",
      "scrollbarSlider.background": "#5A586880",
      "scrollbarSlider.hoverBackground": "#878492",
      "scrollbarSlider.activeBackground": "#AEAAB8",
    },
  })
}
