import type { ReactNode } from 'react'
import { withBasePath } from '../data/paths'

type Props = {
  eyebrow: string
  title: string
  summary?: ReactNode
}

export function BrandLockup({ eyebrow, title, summary }: Props) {
  return <div className="hero__brand">
    <img className="hero__mark" src={withBasePath('/assets/rankingsdiff-mark.png')} alt="Draft Distillery" />
    <div>
      <span className="eyebrow">{eyebrow}</span>
      <h1>{title}</h1>
      {summary ? <div className="hero__brand-summary">{summary}</div> : null}
    </div>
  </div>
}
