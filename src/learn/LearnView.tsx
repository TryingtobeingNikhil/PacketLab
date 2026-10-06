import { useStore } from '../store'
import { ExploreMap } from './ExploreMap'
import { LessonPlayer } from './LessonPlayer'

/** Learn opens on the map of the Internet; picking anything on it opens a lesson. */
export function LearnView() {
  const learnView = useStore((s) => s.learnView)
  if (learnView === 'lesson') return <LessonPlayer />
  return (
    <div className="body">
      <main className="main">
        <div className="canvas-wrap">
          <ExploreMap />
        </div>
      </main>
    </div>
  )
}
