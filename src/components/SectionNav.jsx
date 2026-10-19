import { useEffect, useState } from 'react'

/**
 * In-page section navigation (Overview / Plan / Community).
 *
 * - Anchor links with native fallback; a lightweight IntersectionObserver
 *   highlights the section currently in view (scroll-spy).
 * - Items whose section is absent (e.g. "Plan" before a location is chosen)
 *   are simply not rendered — the nav never shows dead links.
 *
 * @param {{ sections: Array<{ id: string, label: string }> }} props
 */
export function SectionNav({ sections }) {
  const [activeId, setActiveId] = useState(sections[0]?.id ?? null)

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined' || sections.length === 0) return undefined

    const visible = new Map()
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          visible.set(entry.target.id, entry.isIntersecting ? entry.intersectionRatio : 0)
        }
        let bestId = null
        let bestRatio = 0
        for (const [id, ratio] of visible) {
          if (ratio > bestRatio) {
            bestRatio = ratio
            bestId = id
          }
        }
        if (bestId) setActiveId(bestId)
      },
      { rootMargin: '-20% 0px -55% 0px', threshold: [0, 0.15, 0.4, 0.75] },
    )

    for (const section of sections) {
      const element = document.getElementById(section.id)
      if (element) observer.observe(element)
    }
    return () => observer.disconnect()
  }, [sections])

  if (sections.length < 2) return null

  return (
    <nav className="section-nav" aria-label="Page sections">
      <ul className="section-nav__list">
        {sections.map((section) => (
          <li key={section.id}>
            <a
              href={`#${section.id}`}
              className={`section-nav__link${activeId === section.id ? ' is-active' : ''}`}
              aria-current={activeId === section.id ? 'true' : undefined}
            >
              {section.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}

export default SectionNav
