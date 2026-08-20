# UniTeX POC

Editor LaTeX no navegador: árvore de arquivos virtual, compilação XeLaTeX via WebAssembly e preview do PDF. Tudo roda no cliente — não há backend.

Esta é uma **prova de conceito**. O código demonstra que o fluxo cabe no browser; não é um produto. Use este documento para entender o core, instalar as dependências e reproduzir a ideia com práticas adequadas de engenharia.

## O que a POC demonstra

- Compilar um projeto LaTeX **no browser** (XeLaTeX + TeX Live 2026 via BusyTeX/WASM).
- Manter um **sistema de arquivos virtual** em memória (`Record<path, conteúdo>`).
- Abrir pastas do disco, arrastar arquivos, criar arquivos/pastas e escolher o `.tex` principal.
- Editar com syntax highlighting LaTeX (Monaco) e mostrar o PDF (PDF.js).
- Recompilar com debounce ao editar, sem servidor de TeX.

## O que a POC não faz

- Persistência (reload apaga o projeto).
- Autenticação, colaboração, histórico ou sync.
- Compilação em worker isolado da UI além do que o BusyTeX já oferece.
- Testes automatizados, CI, observabilidade.
- Tratamento robusto de erros, cancelamento de compile visível ao usuário, ou cache próprio de pacotes TeX.

---

## Stack

| Camada | Tecnologia | Papel nesta POC |
| --- | --- | --- |
| UI | React 19 + TypeScript | Estado do projeto, layout em 3 painéis |
| Bundler | Vite 8 | Dev server, HMR, assets estáticos em `public/` |
| Estilo | Tailwind CSS 4 | Layout e tema (plugin `@tailwindcss/vite`) |
| Editor | Monaco (`@monaco-editor/react`) + `monaco-latex` | Edição de `.tex` / `.bib` / texto |
| Compilador | `texlyre-busytex` | XeLaTeX em WASM no browser |
| Preview | `pdfjs-dist` | Rasteriza o PDF em canvas |

Não há banco, API nem runtime Node no fluxo de compilação. O Vite só serve o app e os binários WASM em `public/core/busytex`.

---

## Arquitetura

```
┌─────────────────────────────────────────────────────────────────┐
│  App.tsx                                                        │
│  estado: files, activePath, mainTexPath, status, pdf, log       │
│  debounce 800ms → compileLatex() → Blob URL → PdfPreview        │
└────────────┬──────────────────────────┬─────────────────────────┘
             │                          │
             ▼                          ▼
┌────────────────────────┐   ┌────────────────────────────────────┐
│  project/              │   │  latex/                            │
│  types, files, upload, │   │  compiler.ts  → BusyTexRunner      │
│  defaultProject        │   │  monacoLatex.ts → highlighter      │
└────────────────────────┘   └────────────────────────────────────┘
             │                          │
             ▼                          ▼
┌────────────────────────┐   ┌────────────────────────────────────┐
│  FileTree / FilePane   │   │  PdfPreview / CompileLog / Overlay │
└────────────────────────┘   └────────────────────────────────────┘
```

Três módulos de domínio, UI só consome:

1. **`src/project/`** — modelo de arquivos, importação do disco, árvore, inferência do main.
2. **`src/latex/`** — compilação e linguagem do editor.
3. **`src/components/`** — árvore, editor, preview, log e overlay.

Essa separação é o principal ativo da POC: o compilador não conhece React; a árvore não conhece BusyTeX.

### Estado (fonte da verdade)

O projeto vive em `App.tsx`:

| Estado | Tipo | Significado |
| --- | --- | --- |
| `files` | `ProjectFiles` | Mapa `caminho → string \| Uint8Array` |
| `activePath` | `string` | Arquivo aberto no painel central |
| `mainTexPath` | `string \| null` | Entrada da compilação |
| `status` | `idle \| compiling \| success \| error` | Ciclo de compile |
| `pdf` | `string \| null` | Object URL do último PDF |
| `compileLog` | `string \| null` | Log TeX em caso de erro |

`ProjectFiles` é um filesystem plano. Pastas vazias existem como marcador `.virtualdir`. Binários (imagens, fontes) entram como `Uint8Array`; texto como `string`.

### Fluxo de compilação

1. Qualquer mudança em `files` ou `mainTexPath` agenda um compile após **800 ms**.
2. `runCompile` incrementa `compileIdRef`. Se um compile antigo terminar depois, o resultado é descartado.
3. `compileLatex(files, mainTexPath)` em `src/latex/compiler.ts`:
   - filtra marcadores de pasta (`filesForCompile`);
   - se necessário, **espelha** `.cls` / `.sty` / `.bst` etc. na raiz (TeX busca por nome de arquivo);
   - inicializa o `BusyTexRunner` (Web Worker);
   - monta `XeLatex` com `additionalFiles`, `bibtex`/`rerun` se existir `.bib`, e endpoint remoto TeX Live.
4. PDF vira `Blob` + `URL.createObjectURL`. A URL anterior é revogada.
5. Sucesso → `PdfPreview`. Falha → `CompileLog` (primeira linha `! ...` do log, se houver).

O runner é **singleton de módulo**. Os WASM/dados TeX Live são baixados uma vez (e o BusyTeX ainda usa IndexedDB internamente). Não recrie `BusyTexRunner` a cada compile.

### Filesystem virtual (`src/project/files.ts`)

Funções que um produto deve reaproveitar ou reimplementar com testes:

| Função | Comportamento |
| --- | --- |
| `normalizePath` / `joinPath` / `ancestorDirs` | Caminhos POSIX, sem `..` |
| `allocatePath` | Evita colisão (`foo.tex` → `foo-1.tex`) |
| `mergeProjectFiles` | Importa sem sobrescrever |
| `inferMainTexPath` | Prefere `main.tex`, senão o primeiro `\documentclass` |
| `filesForCompile` | Remove `.virtualdir` e achata pacotes TeX na raiz |
| `isTextFile` / `isImageFile` | Heurística por extensão |
| `shouldIgnore` | Ignora `.git`, `node_modules`, `.DS_Store`, etc. |
| `buildFileTree` | Lista plana → árvore para a UI |

Importação (`src/project/upload.ts`): `FileList` (input `webkitdirectory`) ou `DataTransfer` (drag-and-drop via File System Access / `webkitGetAsEntry`). A pasta raiz comum é removida no “Open folder”; no drop/add, `stripRoot: false` e `baseDir` colocam os arquivos na pasta alvo.

### UI

- **FileTree** — open folder (substitui o projeto), add files/folder, criar arquivo/pasta, set main, drag-and-drop.
- **FilePane** — Monaco para texto; preview de imagem; mensagem para outros binários.
- **PdfPreview** — PDF.js, uma página por canvas, escala pela largura do container, worker via `?url`.
- **CompileOverlay** — bloqueio visual durante compile.
- **CompileLog** — log cru em caso de erro.

---

## Pacotes

Instalação padrão (já listada em `package.json`):

```bash
npm install
```

Abaixo: por que cada dependência existe, o que a POC usa, e o que mudar ao sair da POC.

### Runtime

#### `react` / `react-dom` (^19)

UI e estado. Sem Redux/Zustand: `useState` + `useCallback` bastam para o tamanho atual.

**Ao reproduzir:** extraia o estado do projeto para um store ou um hook (`useProject`) testável. Evite deixar compile + filesystem + UI no mesmo componente.

```bash
npm install react react-dom
npm install -D @types/react @types/react-dom
```

#### `texlyre-busytex` (^1.4.0)

Núcleo da compilação. Empacota TeX Live 2026 (XeLaTeX, pdfLaTeX, LuaLaTeX) em WASM. Licença **AGPL-3.0-or-later** — um produto derivado precisa cumprir AGPL (código-fonte da rede, etc.) ou isolar o compilador como serviço/processo com política jurídica clara.

Uso nesta POC (`src/latex/compiler.ts`):

```ts
const runner = new BusyTexRunner({
  busytexBasePath: "/core/busytex",
  verbose: true,
  preloadDataPackages: [`${BUSYTEX_BASE}/texlive-basic.js`],
  catalogDataPackages: [
    `${BUSYTEX_BASE}/texlive-recommended.js`,
    `${BUSYTEX_BASE}/texlive-extra.js`,
  ],
})

await runner.initialize(true) // Web Worker
const xelatex = new XeLatex(runner)
return xelatex.compile({
  input,
  mainTexPath,
  additionalFiles,
  bibtex: hasBib,
  rerun: hasBib,
  remoteEndpoint: "https://texlive2026.texlyre.org",
})
```

| Opção | Por quê |
| --- | --- |
| `busytexBasePath: '/core/busytex'` | Vite serve `public/` na raiz; os WASM precisam estar aí |
| `preloadDataPackages: texlive-basic` | Pacote mínimo no boot (~menor download inicial) |
| `catalogDataPackages` | recommended/extra disponíveis sob demanda |
| `initialize(true)` | Compile fora da thread da UI |
| `XeLatex` | Engine da POC (fontes do sistema / Unicode mais naturais que pdfLaTeX) |
| `remoteEndpoint` | Pacotes TeX Live on-demand se não estiverem no basic |

O npm **não** traz os WASM (~32 MB) nem os dados TeX Live (90–400 MB). Depois do `npm install`:

```bash
npx texlyre-busytex download-assets
```

Isso grava em `public/core/busytex/` (gitignored em `public/core/*`). Sem esse passo, a compilação falha ao buscar `/core/busytex/...`.

**Ao reproduzir:**

- Trate download de assets como passo de setup (script `postinstall` ou `setup:busytex`), documentado no README.
- Não commite os binários; versionar só o lockfile e o comando de download.
- Encapsule BusyTeX atrás de uma interface (`LatexCompiler`) para poder trocar engine (pdfLaTeX, servidor TeX, Overleaf-like) sem reescrever a UI.
- `verbose: true` é para debug da POC; em produto use nível configurável e telemetria de falhas (sem vazar o `.tex` do usuário).
- Avalie AGPL antes de distribuir.

```bash
npm install texlyre-busytex
npx texlyre-busytex download-assets
```

#### `@monaco-editor/react` (^4.7.0)

Wrapper do Monaco (editor do VS Code). `path={path}` cria um model por arquivo; `beforeMount` registra a linguagem.

**Ao reproduzir:** lazy-load do Monaco (`@monaco-editor/loader`) para não inflar o bundle inicial. Considere `monaco-editor` como peer explícito.

```bash
npm install @monaco-editor/react
```

#### `monaco-latex` (^0.1.1)

Tokenizer Monarch para LaTeX. A POC estende o tokenizer (`src/latex/monacoLatex.ts`) para math (`$`, `$$`, `\(`, `\[`) e aplica o tema `unitex-dark`.

**Ao reproduzir:** mantenha o registro de linguagem **idempotente** (já há `getLanguages().some(...)`) — o Monaco pode chamar `beforeMount` mais de uma vez no Strict Mode.

```bash
npm install monaco-latex
```

#### `pdfjs-dist` (^6.2.108)

Renderiza o PDF. O worker é importado com `?url` do Vite para o `GlobalWorkerOptions.workerSrc` apontar para um arquivo servido corretamente.

**Ao reproduzir:** cancele renders ao trocar de URL (já feito). Para documentos longos, virtualize páginas (só renderizar o viewport). PDF.js 6 pede Node ≥ 22 no ecossistema do pacote; no browser isso não se aplica.

```bash
npm install pdfjs-dist
```

#### `tailwindcss` + `@tailwindcss/vite` (^4.3.3)

CSS utilitário. Entrada: `@import "tailwindcss"` em `src/index.css`; plugin no `vite.config.ts`.

```bash
npm install tailwindcss @tailwindcss/vite
```

### Desenvolvimento

| Pacote | Uso |
| --- | --- |
| `vite` + `@vitejs/plugin-react` | Dev server e build |
| `typescript` | Typecheck (`tsc -b` no `build`) |
| `eslint` + `typescript-eslint` + plugins React | Lint |
| `@types/node` | Tipos do `vite.config.ts` |

```bash
npm install -D vite @vitejs/plugin-react typescript typescript-eslint eslint @eslint/js eslint-plugin-react-hooks eslint-plugin-react-refresh globals @types/node
```

---

## Como rodar

Requisitos: **Node.js 22+** (alinhado ao Vite 8 / PDF.js 6) e npm.

```bash
git clone <repo>
cd unitex-poc
npm install
npx texlyre-busytex download-assets   # obrigatório na primeira vez
npm run dev
```

Abre o endereço que o Vite imprimir (em geral `http://localhost:5173`).

| Script | Função |
| --- | --- |
| `npm run dev` | Dev server + HMR |
| `npm run build` | `tsc -b` + bundle de produção |
| `npm run preview` | Serve o `dist/` |
| `npm run lint` | ESLint |

Primeiro compile é lento: baixa WASM + `texlive-basic` (e depois pacotes remotos conforme o documento). Compiles seguintes reusam cache do BusyTeX (IndexedDB).

### Uso rápido

1. O projeto default tem `main.tex` + `intro.tex`.
2. Edite no painel central — preview atualiza ~800 ms depois.
3. **Open folder** substitui a árvore por uma pasta do disco (só na memória).
4. Clique direito: New File / Folder, Add Files / Folder.
5. Estrela ou “Set as Main File” define o `.tex` de entrada.
6. **Compile** força um compile imediato (cancela o debounce).

---

## Mapa do código

```
src/
  App.tsx                 orquestração: estado, debounce, compile, layout
  main.tsx                bootstrap React
  index.css               Tailwind
  latex/
    compiler.ts           BusyTexRunner + XeLatex (único ponto de I/O TeX)
    monacoLatex.ts        linguagem + tema Monaco
    test.ts               smoke manual (não é teste automatizado)
  project/
    types.ts              ProjectFiles, FileTreeNode
    files.ts              paths, árvore, main, compile prep
    upload.ts             FileList / DataTransfer → ProjectFiles
    defaultProject.ts     seed da POC
  components/
    FileTree.tsx          explorer + import
    FilePane.tsx          editor vs preview de binário
    LatexEditor.tsx       Monaco
    PdfPreview.tsx        PDF.js
    CompileLog.tsx
    CompileOverlay.tsx
public/
  core/busytex/           WASM + dados TeX Live (não versionado)
```

Contrato do compilador, para reimplementar atrás da mesma função:

```ts
compileLatex(
  files: Record<string, string | Uint8Array>,
  mainTexPath: string,
): Promise<{
  success: boolean
  pdf?: Uint8Array
  log: string
  exitCode: number
  logs: unknown[]
}>
```

A UI só precisa disso. Trocar BusyTeX por um POST `/compile` não deveria exigir reescrever `FileTree` ou `PdfPreview`.

---

## Da POC para um produto

Use a POC como **especificação executável**, não como base para copiar e colar. Reproduza o comportamento com limites claros.

### 1. Bounded contexts

| Contexto | Responsabilidade | Na POC | No produto |
| --- | --- | --- | --- |
| Workspace | CRUD de arquivos, main, import | `project/` + estado no `App` | persistência (IndexedDB / backend), paths canônicos, undo |
| Compile | TeX → PDF + log | `latex/compiler.ts` | fila, timeout, engine configurável, cache de artefatos |
| Editor | models, highlight, (futuro) SyncTeX | Monaco + `monaco-latex` | LSP / chktex, jump to error |
| Preview | PDF → pixels | PDF.js canvases | virtualização, zoom, SyncTeX |

Não misture React com WASM. O compilador deve ser uma função/serviço puro do ponto de vista da UI.

### 2. Estado e efeitos

Hoje compile, debounce e object URLs convivem no `App`. Extraia:

- `useDebouncedCompile(files, mainTexPath)` com abort/id (já há `compileIdRef` — preserve essa ideia).
- Sempre `URL.revokeObjectURL` no PDF anterior (já feito).
- Não compile se `mainTexPath` for `null`.

Evite Strict Mode disparando dois initializes pesados: o runner singleton ajuda; ainda assim, `initialize()` deve ser idempotente (o BusyTeX já guarda `initialized`).

### 3. Assets WASM como dependência de deploy

`public/core/*` está no `.gitignore`. Em CI/produção:

```text
npm ci
npx texlyre-busytex download-assets
npm run build
```

Versionar a **versão do pacote** (`texlyre-busytex@1.4.0`) e o comando de download. Documentar tamanho aproximado e que a primeira visita baixa dezenas/centenas de MB.

### 4. Testes (ausentes na POC)

Mínimo ao reescrever:

| Camada | O quê |
| --- | --- |
| Unitário | `inferMainTexPath`, `allocatePath`, `filesForCompile`, `shouldIgnore`, `buildFileTree` |
| Integração | upload de `File`/`DataTransfer` mockados → `ProjectFiles` |
| Contrato | `compileLatex` com fixture `.tex` pequeno (ou mock do runner) |
| E2E | abrir app, editar, esperar canvas de PDF (lento; rodar pouco) |

`src/latex/test.ts` é um script manual no browser — substitua por teste de contrato.

### 5. Qualidade de software

- **Erros:** parsear o `.log` (já há `extractLatexError`) e mapear linha → editor.
- **Performance:** debounce (já 800 ms); não recompilar se o hash dos arquivos relevantes não mudou; virtualizar PDF.
- **Segurança:** o TeX no browser é mais isolado que um shell no servidor, mas `shellEscape` do BusyTeX **não** deve ser ligado sem handlers explícitos. Não execute `\write18` nativo. Sanitize nomes de arquivo no import.
- **Acessibilidade:** árvore e menus ainda são botões simples; produto precisa de teclado, ARIA tree, anúncio de status de compile.
- **i18n / encoding:** XeLaTeX foi escolhido em parte por Unicode; mantenha UTF-8 no filesystem virtual.
- **Licenças:** React/Vite/Monaco/PDF.js (MIT/Apache) vs BusyTeX (AGPL). Trate isso no kickoff jurídico, não no fim.

### 6. O que não levar adiante sem redesenho

- Estado global no `App.tsx`.
- `verbose: true` e `console.error` como observabilidade.
- Inferência de binário só por extensão.
- Pasta vazia via arquivo sentinela `.virtualdir` — funciona; em produto um `kind: 'dir'` no modelo é mais claro.
- Endpoint TeX Live de terceiros (`texlive2026.texlyre.org`) — em produção hospede ou pinne a política de rede (CSP, fallback offline).
- Sem persistência: defina IndexedDB (rascunho local) e/ou backend antes de usuários reais.

### 7. Sequência sugerida de reprodução

1. Recriar `ProjectFiles` + funções de path com testes.
2. Adaptador `LatexCompiler` (primeiro um fake que devolve PDF fixture).
3. UI de 3 painéis ligada ao fake.
4. Trocar o fake por BusyTeX + script de assets.
5. Importação de pasta e main file.
6. Preview PDF.js + log de erro.
7. Persistência e identidade de projeto.
8. Só então: SyncTeX, colaboração, múltiplas engines.

Cada passo deve deixar o app utilizável. Não comece pelo WASM.

---

## Limitações conhecidas do core atual

- Compilação só com **XeLaTeX** (pdfLaTeX/LuaLaTeX existem no pacote, não estão ligados).
- Pacotes TeX além do `basic` dependem de rede (`remoteEndpoint`) ou dos catálogos recommended/extra.
- Sem Biber/biblatex explícito (`biber: true`); só `bibtex` se houver `.bib`.
- Sem SyncTeX (o runner pode devolver `synctex`; a UI ignora).
- Sem salvar no disco; “Open folder” é one-shot para memória.
- Highlight LaTeX é tokenizer, não grammar completa nem diagnostics.
- `filesForCompile` assume nomes únicos para `.sty`/`.cls` em pastas diferentes — colisão zera o alias.

---

## Licença desta POC

O repositório da POC segue a licença que o time definir. O compilador **texlyre-busytex** é AGPL-3.0. Qualquer distribuição em rede que incorpore esse código precisa respeitar essa licença.
