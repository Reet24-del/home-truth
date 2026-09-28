import {defineField, defineType} from 'sanity'

export const SOURCE_KINDS = [
  {title: 'Registration (filed with the regulator)', value: 'registration'},
  {title: 'Agreement for sale', value: 'agreement'},
  {title: 'Marketing (brochure, website, ad)', value: 'marketing'},
  {title: 'Law or regulation', value: 'law'},
  {title: 'Other', value: 'other'},
]

export const sourceDocument = defineType({
  name: 'sourceDocument',
  title: 'Source document',
  type: 'document',
  description:
    'A document a claim can come from. Its kind decides how much it is trusted: law > registration > agreement > other > marketing.',
  fields: [
    defineField({name: 'title', type: 'string', validation: (rule) => rule.required()}),
    defineField({
      name: 'shortName',
      title: 'Short name',
      type: 'string',
      description: 'Used in findings, e.g. "Brochure" or "RERA registration".',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'kind',
      type: 'string',
      options: {list: SOURCE_KINDS, layout: 'radio'},
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'project',
      type: 'reference',
      to: [{type: 'project'}],
      description: 'Leave empty for laws and rules that apply to every project.',
      hidden: ({document}) => document?.kind === 'law',
    }),
    defineField({name: 'publisher', type: 'string'}),
    defineField({name: 'publishedAt', title: 'Published on', type: 'date'}),
    defineField({name: 'url', title: 'Official URL', type: 'url'}),
    defineField({name: 'file', title: 'Original file', type: 'file'}),
    defineField({
      name: 'body',
      title: 'Full text',
      type: 'text',
      rows: 20,
      description:
        'Markdown text of the document. Claim extraction and the Knowledge Base dataset source read this field.',
    }),
  ],
  preview: {select: {title: 'title', subtitle: 'kind'}},
})
