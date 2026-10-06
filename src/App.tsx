import { useEffect } from 'react'
import { TopBar } from './components/TopBar'
import { Glossary, Shortcuts, Welcome } from './components/Modals'
import { LearnView } from './learn/LearnView'
import { SandboxView } from './sandbox/SandboxView'
import { loadFromHash } from './share'
import { useStore } from './store'

export default function App() {
  const { mode, theme, glossaryOpen, shortcutsOpen, welcomed, set } = useStore()

  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  useEffect(() => {
    if (loadFromHash()) set({ welcomed: true })
  }, [set])

  return (
    <div className="app">
      <TopBar />
      {mode === 'learn' ? <LearnView /> : <SandboxView />}
      {glossaryOpen && <Glossary />}
      {shortcutsOpen && <Shortcuts />}
      {!welcomed && <Welcome />}
    </div>
  )
}
