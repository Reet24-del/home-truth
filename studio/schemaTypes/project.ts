import {defineField, defineType} from 'sanity'

export const project = defineType({
  name: 'project',
  title: 'Project',
  type: 'document',
  description: 'A real-estate project (or one registered phase of it) that buyers want to check.',
  fields: [
    defineField({name: 'name', type: 'string', validation: (rule) => rule.required()}),
    defineField({
      name: 'slug',
      type: 'slug',
      options: {source: 'name'},
      validation: (rule) => rule.required(),
    }),
    defineField({name: 'registrationNumber', title: 'RERA registration number', type: 'string'}),
    defineField({name: 'promoter', title: 'Promoter (builder)', type: 'string'}),
    defineField({name: 'city', type: 'string'}),
    defineField({name: 'state', type: 'string'}),
    defineField({
      name: 'isDemo',
      title: 'Fictional demo project',
      type: 'boolean',
      initialValue: false,
    }),
    defineField({name: 'summary', type: 'text', rows: 3}),
  ],
  preview: {select: {title: 'name', subtitle: 'registrationNumber'}},
})
