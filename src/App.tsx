import { useEffect, useState } from "react"
import { Editor } from "./components/Editor"
import { Workspace } from "./components/Workspace"
import { readProjectId } from "./workspace/navigation"

function App() {
  const [projectId, setProjectId] = useState<string | null>(() =>
    readProjectId(),
  )

  useEffect(() => {
    const sync = () => setProjectId(readProjectId())
    window.addEventListener("hashchange", sync)
    return () => window.removeEventListener("hashchange", sync)
  }, [])

  if (projectId) return <Editor key={projectId} projectId={projectId} />
  return <Workspace />
}

export default App
