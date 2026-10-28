const PROJECT_HASH = /^#\/p\/([^/?#]+)$/

export function readProjectId(hash = window.location.hash) {
  const match = hash.match(PROJECT_HASH)
  const id = match?.[1]
  if (!id) return null

  try {
    return decodeURIComponent(id)
  } catch {
    return id
  }
}

export function openProject(id: string) {
  const next = `#/p/${encodeURIComponent(id)}`
  if (window.location.hash !== next) {
    window.location.hash = next
  }
}

export function openWorkspace() {
  if (readProjectId() === null) {
    if (window.location.hash !== "" && window.location.hash !== "#/") {
      window.location.hash = "#/"
    }
    return
  }

  window.location.hash = "#/"
}
