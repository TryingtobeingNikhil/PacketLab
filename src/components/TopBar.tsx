import { useState } from 'react'
import { BookOpen, FlaskConical, GraduationCap, HelpCircle, Link2, ListTree, Moon, PanelRight, Redo2, Sun, Trash2, Undo2 } from 'lucide-react'
import { useStore } from '../store'
import { shareUrl } from '../share'

export function Logo({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <rect width="32" height="32" rx="9" fill="var(--ink)" />
      <circle cx="16" cy="16" r="9" fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeDasharray="40 17" transform="rotate(-50 16 16)" />
      <rect x="12.5" y="12.5" width="7" height="7" rx="1.2" fill="var(--bg)" transform="rotate(45 16 16)" />
    </svg>
  )
}

export function TopBar() {
  const s = useStore()
  const { mode, setMode, theme, toggleTheme, level, set, leftOpen, rightOpen } = s
  const [copied, setCopied] = useState(false)
  const narrow = innerWidth <= 1000

  return (
    <header className="header">
      <button className="ibtn only-narrow" onClick={() => set({ leftOpen: !leftOpen, ...(narrow ? { rightOpen: false } : {}) })} aria-label="Toggle sidebar">
        <ListTree size={17} />
      </button>
      <div className="logo">
        <Logo />
        <span>Packet<em>lab</em></span>
      </div>
      <nav className="tabs" role="tablist" aria-label="Mode">
        <button className={`tab${mode === 'learn' ? ' on' : ''}`} onClick={() => (mode === 'learn' ? set({ learnView: 'map' }) : setMode('learn'))} role="tab" aria-selected={mode === 'learn'}>
          <GraduationCap size={16} /> Learn
        </button>
        <button className={`tab${mode === 'sandbox' ? ' on' : ''}`} onClick={() => setMode('sandbox')} role="tab" aria-selected={mode === 'sandbox'}>
          <FlaskConical size={16} /> Sandbox
        </button>
      </nav>
      {mode === 'sandbox' && (
        <>
          <span className="vsep hide-sm" />
          <button className="ibtn hide-sm" onClick={s.undo} disabled={!s.past.length} aria-label="Undo" title="Undo (⌘Z)"><Undo2 size={16} /></button>
          <button className="ibtn hide-sm" onClick={s.redo} disabled={!s.future.length} aria-label="Redo" title="Redo (⇧⌘Z)"><Redo2 size={16} /></button>
        </>
      )}
      <span className="spacer" />
      <div className="hdr-actions">
        <div className="toggle hide-sm" title="Beginner keeps it simple; Intermediate opens every “Go deeper” note">
          <button className={level === 'beginner' ? 'on' : ''} onClick={() => set({ level: 'beginner' })}>Beginner</button>
          <button className={level === 'intermediate' ? 'on' : ''} onClick={() => set({ level: 'intermediate' })}>Intermediate</button>
        </div>
        <span className="vsep hide-sm" />
        <button className="ibtn" onClick={() => set({ glossaryOpen: true })} aria-label="Glossary" title="Glossary"><BookOpen size={17} /></button>
        {mode === 'sandbox' && (
          <>
            <button
              className={`ibtn${copied ? ' on' : ''}`}
              aria-label="Copy share link"
              title={copied ? 'Link copied' : 'Copy a link to this design'}
              onClick={async () => {
                const url = shareUrl()
                history.replaceState(null, '', url)
                try {
                  await navigator.clipboard.writeText(url)
                } catch {
                  /* clipboard blocked: the URL bar still has it */
                }
                setCopied(true)
                setTimeout(() => setCopied(false), 1600)
              }}
            >
              <Link2 size={17} />
            </button>
            <button className="ibtn hide-sm" onClick={() => confirm('Clear the canvas?') && s.clearCanvas()} aria-label="Clear canvas" title="Clear canvas"><Trash2 size={17} /></button>
            <button className={`ibtn${rightOpen ? ' on' : ''}`} onClick={() => set({ rightOpen: !rightOpen, ...(narrow ? { leftOpen: false } : {}) })} aria-label="Toggle inspector" title="Inspector"><PanelRight size={17} /></button>
          </>
        )}
        <button className="ibtn" onClick={toggleTheme} aria-label="Toggle theme" title={theme === 'dark' ? 'Paper (light)' : 'Night (dark)'}>
          {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
        </button>
        <button className="ibtn hide-sm" onClick={() => set({ shortcutsOpen: true })} aria-label="Help" title="Help & shortcuts"><HelpCircle size={17} /></button>
      </div>
    </header>
  )
}
