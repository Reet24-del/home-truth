'use client'

import dynamic from 'next/dynamic'

import type {TowerProps} from './TowerScene'

// three.js is heavy and needs a browser, so it loads after the page is usable.
const TowerScene = dynamic(() => import('./TowerScene'), {
  ssr: false,
  loading: () => <div className="tower tower-loading" aria-hidden="true" />,
})

export function Tower(props: TowerProps) {
  return <TowerScene {...props} />
}
