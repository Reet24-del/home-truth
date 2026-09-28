'use client'

import dynamic from 'next/dynamic'

import type {BrochureProps} from './BrochureScene'

const BrochureScene = dynamic(() => import('./BrochureScene'), {
  ssr: false,
  loading: () => <div className="brochure brochure-loading" aria-hidden="true" />,
})

export function Brochure(props: BrochureProps) {
  return <BrochureScene {...props} />
}
