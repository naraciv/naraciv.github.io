import {defineField, defineType} from 'sanity'

/**
 * Role holders change with in-game politics, so they are edited here rather
 * than needing a commit and a deploy.
 */
export const governmentRole = defineType({
  name: 'governmentRole',
  title: 'Government Role',
  type: 'document',
  fields: [
    defineField({
      name: 'title',
      title: 'Role',
      type: 'string',
      description:
        'The name of the role, e.g. "Shikken" or "Lord of the North". Optional while drafting — a role needs one before it shows on the site.',
    }),
    defineField({
      name: 'holder',
      title: 'Held by',
      type: 'string',
      description:
        'Minecraft username, or several separated by commas. Leave blank if the post is vacant — the site fills in "Vacant" for you. Roles under Other Roles and Nara’s Populace describe a kind of person rather than a post, so leave this empty for them.',
    }),
    defineField({
      name: 'group',
      title: 'Group',
      type: 'string',
      description: 'Which section of the government page this role appears under.',
      options: {
        list: [
          {title: 'Leadership (Shikken / Rensho / Taishō)', value: 'leadership'},
          {title: 'Daimyo', value: 'daimyo'},
          {title: 'Komuin', value: 'komuin'},
          {title: 'Other Roles', value: 'other'},
          {title: "Nara's Populace", value: 'populace'},
        ],
        layout: 'radio',
      },
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'description',
      title: 'Description',
      type: 'text',
      rows: 3,
      description: 'What this role is responsible for.',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'icon',
      title: 'Icon',
      type: 'string',
      description: 'Optional. Only the leadership cards show one.',
      options: {
        list: [
          {title: 'Star', value: 'star'},
          {title: 'Users', value: 'users'},
          {title: 'Crosshair', value: 'crosshair'},
        ],
      },
    }),
    defineField({
      name: 'order',
      title: 'Order',
      type: 'number',
      description: 'Lower numbers appear first within the group.',
      initialValue: 0,
    }),
  ],
  orderings: [
    {
      title: 'Group, then order',
      name: 'groupOrder',
      by: [
        {field: 'group', direction: 'asc'},
        {field: 'order', direction: 'asc'},
      ],
    },
  ],
  preview: {
    select: {title: 'title', holder: 'holder', group: 'group'},
    prepare: ({title, holder, group}) => ({
      title: title || 'Untitled role — not shown on the site',
      subtitle: ['other', 'populace'].includes(group) ? group : `${holder || 'Vacant'} · ${group}`,
    }),
  },
})
