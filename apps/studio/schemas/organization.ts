import {defineField, defineType} from 'sanity'

export const organization = defineType({
  name: 'organization',
  title: 'National Organization',
  type: 'document',
  fields: [
    defineField({
      name: 'title',
      title: 'Name',
      type: 'string',
      description:
        'Optional while drafting; an organization needs one before it shows on the site.',
    }),
    defineField({
      name: 'description',
      title: 'Description',
      type: 'text',
      rows: 4,
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'icon',
      title: 'Icon',
      type: 'string',
      options: {
        list: [
          {title: 'Book', value: 'book'},
          {title: 'Open book', value: 'bookOpen'},
          {title: 'Coffee', value: 'coffee'},
          {title: 'Mail', value: 'mail'},
          {title: 'Users', value: 'users'},
        ],
      },
    }),
    defineField({name: 'order', title: 'Order', type: 'number', initialValue: 0}),
  ],
  preview: {
    select: {title: 'title', subtitle: 'description'},
    prepare: ({title, subtitle}) => ({
      title: title || 'Untitled organization (not shown on the site)',
      subtitle,
    }),
  },
})
