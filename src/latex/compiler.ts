import { BusyTexRunner, XeLatex } from "texlyre-busytex"

const BUSYTEX_BASE = "/core/busytex"

const runner = new BusyTexRunner({
    busytexBasePath: BUSYTEX_BASE,
    verbose: true,
    preloadDataPackages: [`${BUSYTEX_BASE}/texlive-basic.js`],
})

export async function compileLatex(latex: string) {
    await runner.initialize(true)

    const xelatex = new XeLatex(runner)

    const result = await xelatex.compile({
        input: latex,
    })

    return result
}