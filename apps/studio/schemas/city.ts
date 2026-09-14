import {defineField, defineType} from 'sanity'

/**
 * One record per city, referenced by the homepage, the /homes city filter and
 * the rail graph, so the six cities are written down once.
 */
export const city = defineType({
  name: 'city',
  title: 'City',
  type: 'document',
  fields: [
    defineField({
      name: 'name',
      title: 'Name',
      type: 'string',
      description:
        'Optional, so you can save a draft as you go, but a city needs one before it shows on the site.',
    }),
    defineField({
      name: 'slug',
      title: 'Slug',
      type: 'slug',
      options: {source: 'name'},
      description: 'Generated from the name. Optional for the same reason.',
    }),
    defineField({
      name: 'coordinates',
      title: 'Coordinates',
      type: 'string',
      description: 'In-game X, Z, e.g. "3200, 4800". Y is optional and rarely useful here.',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'description',
      title: 'Description',
      type: 'text',
      rows: 4,
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'image',
      title: 'Image',
      type: 'image',
      options: {hotspot: true},
      fields: [
        defineField({
          name: 'alt',
          title: 'Alt text',
          type: 'string',
          description:
            'Describe the image for screen readers. Leave blank only if purely decorative.',
        }),
      ],
    }),
    defineField({
      name: 'order',
      title: 'Order',
      type: 'number',
      description: 'Lower numbers appear first. The capital should be 0.',
      initialValue: 0,
    }),
  ],
  preview: {
    select: {title: 'name', subtitle: 'coordinates', media: 'image'},
    prepare: ({title, subtitle, media}) => ({
      title: title || 'Untitled city (not shown on the site)',
      subtitle,
      media,
    }),
  },
})
