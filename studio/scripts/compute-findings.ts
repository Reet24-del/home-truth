// Recomputes findings after you add, edit or verify claims in the Studio.
// Run with: npm run findings

import {getCliClient} from 'sanity/cli'

import {recomputeFindings} from '../lib/findingsWriter'

await recomputeFindings(getCliClient({apiVersion: '2025-09-01'}))
