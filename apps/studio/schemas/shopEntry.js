import {defineField, defineType} from 'sanity'

export const shopEntry = defineType({
  name: 'shopEntry',
  title: 'Shop Database',
  type: 'document',
  fields: [
    defineField({
      name: 'csv_file',
      title: 'CSV File',
      type: 'file',
      description: 'Upload a CSV file containing the shop data.',
      options: {
        accept: '.csv',
      },
      validation: (Rule) => Rule.required().error('A CSV file is required.'),
    }),
  ],
  preview: {
    select: {
      createdAt: '_createdAt',
    },
    prepare({createdAt}) {
      const date = createdAt
        ? new Date(createdAt).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })
        : 'New Entry'
      return {
        title: `${date}`,
      }
    },
  },
})
