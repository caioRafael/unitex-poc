import { BusyTexRunner, XeLatex } from "texlyre-busytex"
import { filesForCompile } from "../project/files"
import type { ProjectFiles } from "../project/types"

const BUSYTEX_BASE = "/core/busytex"
const TEXLIVE_REMOTE = "https://texlive2026.texlyre.org"

const runner = new BusyTexRunner({
    busytexBasePath: BUSYTEX_BASE,
    verbose: true,
    preloadDataPackages: [`${BUSYTEX_BASE}/texlive-basic.js`],
    catalogDataPackages: [
        `${BUSYTEX_BASE}/texlive-recommended.js`,
        `${BUSYTEX_BASE}/texlive-extra.js`,
    ],
})

export async function compileLatex(files: ProjectFiles, mainTexPath: string) {
    const projectFiles = filesForCompile(files)
    const input = projectFiles[mainTexPath]

    if (typeof input !== "string") {
        return {
            success: false,
            log: "Main TeX file is missing or is not a text file.",
            exitCode: 1,
            logs: [],
        }
    }

    await runner.initialize(true)

    const xelatex = new XeLatex(runner)
    const additionalFiles = Object.entries(projectFiles)
        .filter(([path]) => path !== mainTexPath)
        .map(([path, content]) => ({ path, content }))
    const hasBib = Object.keys(projectFiles).some((path) =>
        path.toLowerCase().endsWith(".bib"),
    )

    return xelatex.compile({
        input,
        mainTexPath,
        additionalFiles,
        bibtex: hasBib,
        rerun: hasBib,
        remoteEndpoint: TEXLIVE_REMOTE,
    })
}
