import type { ProjectFiles } from "./types"

export const DEFAULT_MAIN_TEX = "main.tex"

export const DEFAULT_FILES: ProjectFiles = {
  [DEFAULT_MAIN_TEX]: String.raw`
\documentclass{article}

\begin{document}

\input{intro.tex}

\end{document}
`.trim(),
  "intro.tex": String.raw`
\section{Introdução}

Olá mundo!
`.trim(),
}
