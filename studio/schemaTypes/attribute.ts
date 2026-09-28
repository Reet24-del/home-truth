import {defineArrayMember, defineField, defineType} from 'sanity'

export const attribute = defineType({
  name: 'attribute',
  title: 'Attribute',
  type: 'document',
  description:
    'A fact buyers care about, like floors per building or possession date. Claims from different documents are compared per attribute.',
  fields: [
    defineField({name: 'label', type: 'string', validation: (rule) => rule.required()}),
    defineField({
      name: 'key',
      type: 'string',
      description: 'Stable machine key, e.g. floors_per_tower.',
      validation: (rule) => rule.required().regex(/^[a-z0-9_]+$/),
    }),
    defineField({name: 'description', type: 'text', rows: 2}),
    defineField({
      name: 'valueType',
      title: 'Value type',
      type: 'string',
      options: {
        list: [
          {title: 'Number', value: 'number'},
          {title: 'Money (INR)', value: 'money'},
          {title: 'Date (YYYY-MM or YYYY-MM-DD)', value: 'date'},
          {title: 'List of terms', value: 'list'},
          {title: 'Text', value: 'text'},
        ],
        layout: 'radio',
      },
      validation: (rule) => rule.required(),
    }),
    defineField({name: 'unit', type: 'string'}),
    defineField({
      name: 'tolerance',
      type: 'number',
      description:
        'Relative difference still counted as a match (0.02 means 2%). Numbers and money only.',
      validation: (rule) => rule.min(0).max(1),
    }),
    defineField({
      name: 'comparison',
      type: 'string',
      initialValue: 'equal',
      options: {
        list: [
          {title: 'Sources must agree', value: 'equal'},
          {title: 'Must not exceed the legal limit', value: 'at_most'},
          {title: 'Must meet the legal minimum', value: 'at_least'},
        ],
        layout: 'radio',
      },
    }),
    defineField({
      name: 'severity',
      type: 'string',
      initialValue: 'major',
      options: {list: ['critical', 'major', 'minor'], layout: 'radio'},
    }),
    defineField({
      name: 'buyerImpact',
      title: 'Why it matters to a buyer',
      type: 'text',
      rows: 3,
    }),
    defineField({
      name: 'askFor',
      title: 'What to ask the builder for',
      type: 'text',
      rows: 2,
      description:
        'The document or written commitment that settles this. Used in the buyer’s checklist, so write it as the end of the sentence "Ask for ...".',
    }),
    defineField({
      name: 'vocabulary',
      type: 'array',
      description:
        'Controlled terms for list and text attributes, so different wording ("Rooftop infinity pool", "Swimming pool") maps to the same term.',
      of: [
        defineArrayMember({
          type: 'object',
          name: 'term',
          fields: [
            defineField({name: 'key', type: 'string', validation: (rule) => rule.required()}),
            defineField({name: 'label', type: 'string', validation: (rule) => rule.required()}),
          ],
          preview: {select: {title: 'label', subtitle: 'key'}},
        }),
      ],
    }),
  ],
  preview: {select: {title: 'label', subtitle: 'key'}},
})
