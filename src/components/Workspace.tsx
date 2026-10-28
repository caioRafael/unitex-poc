import { useEffect, useRef, useState, type FormEvent } from "react"
import { DEFAULT_FILES, DEFAULT_MAIN_TEX } from "../project/defaultProject"
import { inferMainTexPath } from "../project/files"
import {
  createProject,
  deleteProject,
  listProjects,
  renameProject,
  type ProjectSummary,
} from "../project/library"
import { filesFromFileList } from "../project/upload"
import { openProject } from "../workspace/navigation"

const updatedAtLabel = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "medium",
  timeStyle: "short",
})

export function Workspace() {
  const importRef = useRef<HTMLInputElement>(null)
  const [projects, setProjects] = useState<ProjectSummary[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState("Novo projeto")
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const input = importRef.current
    if (!input) return
    input.setAttribute("webkitdirectory", "")
    input.setAttribute("directory", "")
  }, [])

  useEffect(() => {
    let active = true

    listProjects()
      .then((rows) => {
        if (active) setProjects(rows)
      })
      .catch((loadError: unknown) => {
        if (!active) return
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Não foi possível carregar os projetos",
        )
        setProjects([])
      })

    return () => {
      active = false
    }
  }, [])

  const handleCreate = (event: FormEvent) => {
    event.preventDefault()
    if (busy) return

    setBusy(true)
    setError(null)
    void createProject({
      name,
      files: DEFAULT_FILES,
      mainTexPath: DEFAULT_MAIN_TEX,
      activePath: DEFAULT_MAIN_TEX,
    })
      .then((project) => {
        openProject(project.id)
      })
      .catch((createError: unknown) => {
        setError(
          createError instanceof Error
            ? createError.message
            : "Não foi possível criar o projeto",
        )
        setBusy(false)
      })
  }

  const handleImport = (list: FileList | null) => {
    if (!list || list.length === 0 || busy) return

    const importedName = folderName(list)
    setBusy(true)
    setError(null)
    const pending = filesFromFileList(list)
    if (importRef.current) importRef.current.value = ""

    void pending
      .then(async (files) => {
        if (Object.keys(files).length === 0) {
          setError("A pasta não tem arquivos para importar.")
          setBusy(false)
          return
        }

        const mainTexPath = inferMainTexPath(files)
        const project = await createProject({
          name: importedName,
          files,
          mainTexPath,
          activePath: mainTexPath ?? Object.keys(files)[0] ?? "",
        })
        openProject(project.id)
      })
      .catch((importError: unknown) => {
        setError(
          importError instanceof Error
            ? importError.message
            : "Não foi possível importar a pasta",
        )
        setBusy(false)
      })
  }

  return (
    <div className="h-screen overflow-y-auto bg-paper font-sans text-ink">
      <div className="mx-auto flex min-h-full w-full max-w-5xl flex-col px-8 py-8">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-6">
          <div>
            <p className="text-base font-medium tracking-tight text-teal">
              Unitex
            </p>
            <h1 className="mt-1 text-2xl font-medium tracking-tight">
              Projetos
            </h1>
            <p className="mt-1 text-sm text-muted">
              Salvos neste navegador, neste computador.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setCreating((current) => !current)
                setName("Novo projeto")
                setError(null)
              }}
              disabled={busy}
              className="rounded-md bg-teal px-3 py-1.5 text-sm font-medium text-white hover:bg-teal-deep disabled:opacity-50"
            >
              Novo projeto
            </button>
            <button
              type="button"
              onClick={() => importRef.current?.click()}
              disabled={busy}
              className="rounded-md border border-line px-3 py-1.5 text-sm font-medium text-ink hover:bg-well disabled:opacity-50"
            >
              Importar pasta
            </button>
            <input
              ref={importRef}
              type="file"
              multiple
              className="hidden"
              onChange={(event) => {
                handleImport(event.target.files)
              }}
            />
          </div>
        </header>

        {creating && (
          <form
            onSubmit={handleCreate}
            className="mt-6 flex flex-wrap items-center gap-2"
          >
            <label className="min-w-0 flex-1 text-sm text-muted">
              Nome
              <input
                autoFocus
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="mt-1 w-full rounded-md border border-line bg-paper px-3 py-2 text-sm text-ink outline-none focus:border-teal"
              />
            </label>
            <button
              type="submit"
              disabled={busy}
              className="mt-5 rounded-md bg-teal px-3 py-2 text-sm font-medium text-white hover:bg-teal-deep disabled:opacity-50"
            >
              Criar
            </button>
            <button
              type="button"
              onClick={() => setCreating(false)}
              disabled={busy}
              className="mt-5 rounded-md px-3 py-2 text-sm text-muted hover:bg-well disabled:opacity-50"
            >
              Cancelar
            </button>
          </form>
        )}

        {error && (
          <p
            role="alert"
            className="mt-6 rounded-md bg-error-wash px-3 py-2 text-sm text-ink"
          >
            {error}
          </p>
        )}

        <div className="mt-8">
          {projects === null ? (
            <p className="text-sm text-muted">Carregando projetos…</p>
          ) : projects.length === 0 ? (
            <div className="rounded-xl border border-dashed border-line px-6 py-16 text-center">
              <p className="text-base font-medium">Nenhum projeto ainda</p>
              <p className="mx-auto mt-2 max-w-md text-sm text-muted">
                Crie um projeto novo ou importe uma pasta do computador. A
                lista continua aqui na próxima visita.
              </p>
            </div>
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {projects.map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  disabled={busy}
                  onOpen={() => openProject(project.id)}
                  onRename={async (nextName) => {
                    const updated = await renameProject(project.id, nextName)
                    setProjects((current) =>
                      current
                        ?.map((item) =>
                          item.id === updated.id ? updated : item,
                        )
                        .sort(byRecent) ?? null,
                    )
                  }}
                  onDelete={async () => {
                    await deleteProject(project.id)
                    setProjects((current) =>
                      current?.filter((item) => item.id !== project.id) ??
                        null,
                    )
                  }}
                  onError={(message) => setError(message)}
                />
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}

function ProjectCard({
  project,
  disabled,
  onOpen,
  onRename,
  onDelete,
  onError,
}: {
  project: ProjectSummary
  disabled: boolean
  onOpen: () => void
  onRename: (name: string) => Promise<void>
  onDelete: () => Promise<void>
  onError: (message: string) => void
}) {
  const [renaming, setRenaming] = useState(false)
  const [draft, setDraft] = useState(project.name)
  const [confirming, setConfirming] = useState(false)
  const [pending, setPending] = useState(false)

  const submitRename = (event: FormEvent) => {
    event.preventDefault()
    if (pending) return
    setPending(true)
    void onRename(draft)
      .then(() => setRenaming(false))
      .catch((renameError: unknown) => {
        onError(
          renameError instanceof Error
            ? renameError.message
            : "Não foi possível renomear o projeto",
        )
      })
      .finally(() => setPending(false))
  }

  const submitDelete = () => {
    if (pending) return
    setPending(true)
    void onDelete()
      .catch((deleteError: unknown) => {
        onError(
          deleteError instanceof Error
            ? deleteError.message
            : "Não foi possível apagar o projeto",
        )
        setPending(false)
        setConfirming(false)
      })
  }

  return (
    <li className="flex flex-col rounded-xl border border-line bg-paper p-4">
      {renaming ? (
        <form onSubmit={submitRename} className="flex flex-col gap-2">
          <input
            autoFocus
            value={draft}
            aria-label="Nome do projeto"
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") setRenaming(false)
            }}
            className="w-full rounded-md border border-line px-2 py-1.5 text-sm text-ink outline-none focus:border-teal"
          />
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={pending}
              className="rounded-md bg-teal px-2 py-1 text-xs font-medium text-white hover:bg-teal-deep disabled:opacity-50"
            >
              Salvar
            </button>
            <button
              type="button"
              onClick={() => setRenaming(false)}
              className="rounded-md px-2 py-1 text-xs text-muted hover:bg-well"
            >
              Cancelar
            </button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          onClick={onOpen}
          disabled={disabled || pending}
          className="min-w-0 text-left disabled:opacity-50"
        >
          <span className="block truncate text-base font-medium">
            {project.name}
          </span>
          <span className="mt-1 block text-xs text-muted">
            {updatedAtLabel.format(project.updatedAt)}
          </span>
          {project.mainTexPath && (
            <span className="mt-1 block truncate text-xs text-faint">
              {project.mainTexPath}
            </span>
          )}
        </button>
      )}

      {!renaming && (
        <div className="mt-4 flex items-center gap-2">
          {confirming ? (
            <>
              <span className="text-xs text-muted">Apagar este projeto?</span>
              <button
                type="button"
                onClick={submitDelete}
                disabled={pending}
                className="rounded-md bg-ink px-2 py-1 text-xs font-medium text-white disabled:opacity-50"
              >
                Apagar
              </button>
              <button
                type="button"
                onClick={() => setConfirming(false)}
                disabled={pending}
                className="rounded-md px-2 py-1 text-xs text-muted hover:bg-well"
              >
                Cancelar
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => {
                  setDraft(project.name)
                  setRenaming(true)
                  setConfirming(false)
                }}
                disabled={disabled || pending}
                className="rounded-md px-2 py-1 text-xs text-teal hover:bg-teal-wash disabled:opacity-50"
              >
                Renomear
              </button>
              <button
                type="button"
                onClick={() => setConfirming(true)}
                disabled={disabled || pending}
                className="rounded-md px-2 py-1 text-xs text-muted hover:bg-well disabled:opacity-50"
              >
                Apagar
              </button>
            </>
          )}
        </div>
      )}
    </li>
  )
}

function folderName(list: FileList) {
  const relative = list[0]?.webkitRelativePath ?? ""
  const [root] = relative.split("/")
  return root || list[0]?.name || "Projeto importado"
}

function byRecent(a: ProjectSummary, b: ProjectSummary) {
  return b.updatedAt - a.updatedAt || b.createdAt - a.createdAt
}
