import { compileLatex } from "./compiler";

const latex = String.raw`
\documentclass{article}

\usepackage{amsmath}

\begin{document}

\section{Introdução}

Olá mundo!

\begin{equation}
E = mc^2
\end{equation}

\end{document}
`;

compileLatex({ "main.tex": latex }, "main.tex").then((result) => {
  console.log("Resultado:", result);

  if (result.success && result.pdf) {
    const blob = new Blob(
      [result.pdf.buffer as ArrayBuffer],
      { type: "application/pdf" }
    );

    const url = URL.createObjectURL(blob);

    window.open(url);
  }
});
