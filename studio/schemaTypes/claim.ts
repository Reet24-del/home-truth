import {defineArrayMember, defineField, defineType} from 'sanity'

export const claim = defineType({
  name: 'claim',
  title: 'Claim',
  type: 'document',
  description:
    'One fact as stated by one document, with the exact quote it came from. Fill in the value field that matches the attribute type.',
  fields: [
    defineField({
      name: 'attribute',
      type: 'reference',
      to: [{type: 'attribute'}],
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'source',
      type: 'reference',
      to: [{type: 'sourceDocument'}],
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'project',
      type: 'reference',
      to: [{type: 'project'}],
      description: 'Leave empty for claims from laws, which apply to every project.',
    }),
    defineField({name: 'numberValue', title: 'Number / money value', type: 'number'}),
    defineField({
      name: 'dateValue',
      title: 'Date value',
      type: 'string',
      description: 'YYYY-MM when the source only gives a month, otherwise YYYY-MM-DD.',
      validation: (rule) => rule.regex(/^\d{4}-\d{2}(-\d{2})?$/),
    }),
    defineField({
      name: 'textValue',
      title: 'Text value',
      type: 'string',
      description: 'Use a vocabulary key when the attribute has a vocabulary.',
    }),
    defineField({
      name: 'listValue',
      title: 'List value',
      type: 'array',
      of: [defineArrayMember({type: 'string'})],
      description: 'Vocabulary keys from the attribute.',
    }),
    defineField({
      name: 'quote',
      type: 'text',
      rows: 3,
      description: 'Copied word for word from the source document.',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'location',
      type: 'string',
      description: 'Section, clause or page, e.g. "Clause 3".',
    }),
    defineField({name: 'note', type: 'string'}),
    defineField({
      name: 'verified',
      type: 'boolean',
      initialValue: false,
      description: 'A person has checked this claim against the source.',
    }),
    defineField({
      name: 'extractedBy',
      title: 'Extracted by',
      type: 'string',
      options: {list: ['seed', 'claude', 'human']},
      readOnly: true,
    }),
  ],
  preview: {
    select: {
      attribute: 'attribute.label',
      source: 'source.shortName',
      numberValue: 'numberValue',
      dateValue: 'dateValue',
      textValue: 'textValue',
      verified: 'verified',
    },
    prepare({attribute, source, numberValue, dateValue, textValue, verified}) {
      const value = numberValue ?? dateValue ?? textValue ?? 'list'
      return {
        title: `${attribute ?? 'Claim'}: ${value}`,
        subtitle: `${source ?? 'Unknown source'}${verified ? ' · verified' : ' · unverified'}`,
      }
    },
  },
})
