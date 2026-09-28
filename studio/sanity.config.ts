import {visionTool} from '@sanity/vision'
import {defineConfig} from 'sanity'
import {structureTool} from 'sanity/structure'

import {schemaTypes} from './schemaTypes'
import {structure} from './structure'

const projectId = process.env.SANITY_STUDIO_PROJECT_ID
const dataset = process.env.SANITY_STUDIO_DATASET || 'production'

if (!projectId) {
  throw new Error('Set SANITY_STUDIO_PROJECT_ID in studio/.env (see .env.example)')
}

export default defineConfig({
  name: 'home-truth',
  title: 'Home Truth',
  projectId,
  dataset,
  plugins: [structureTool({structure}), visionTool()],
  schema: {types: schemaTypes},
})
