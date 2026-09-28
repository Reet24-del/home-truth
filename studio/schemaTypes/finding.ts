import {defineArrayMember, defineField, defineType} from 'sanity'

export const finding = defineType({
  name: 'finding',
  title: 'Finding',
  type: 'document',
  readOnly: true,
  description:
    'Computed by `npm run findings` from the claims. Edit the claims, then recompute; do not edit findings by hand.',
  fields: [
    // Weak references, so claims and attributes can be deleted and findings recomputed.
    defineField({name: 'project', type: 'reference', weak: true, to: [{type: 'project'}]}),
    defineField({name: 'attribute', type: 'reference', weak: true, to: [{type: 'attribute'}]}),
    defineField({
      name: 'status',
      type: 'string',
      options: {list: ['match', 'mismatch', 'violation', 'single_source']},
    }),
    defineField({
      name: 'severity',
      type: 'string',
      options: {list: ['critical', 'major', 'minor']},
    }),
    defineField({name: 'summary', type: 'text', rows: 3}),
    defineField({
      name: 'entries',
      description: 'What each source says, and how it compares.',
      type: 'array',
      of: [
        defineArrayMember({
          type: 'object',
          name: 'entry',
          fields: [
            defineField({
              name: 'role',
              type: 'string',
              options: {
                list: ['reference', 'agrees', 'conflicts', 'limit', 'violates', 'complies'],
              },
            }),
            defineField({name: 'display', type: 'string'}),
            defineField({name: 'claim', type: 'reference', weak: true, to: [{type: 'claim'}]}),
          ],
          preview: {select: {title: 'display', subtitle: 'role'}},
        }),
      ],
    }),
    defineField({name: 'computedAt', type: 'datetime'}),
  ],
  preview: {
    select: {title: 'attribute.label', status: 'status', severity: 'severity', project: 'project.name'},
    prepare({title, status, severity, project}) {
      return {title: `${title}: ${status}`, subtitle: `${severity} · ${project}`}
    },
  },
})
