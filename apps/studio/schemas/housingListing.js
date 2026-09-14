import {defineField, defineType} from 'sanity'

export const housingListing = defineType({
  name: 'listingPost',
  title: 'Housing Listings',
  type: 'document',
  fields: [
    defineField({
      name: 'address',
      title: 'Address',
      type: 'string',
      description: 'The street address or landmark name for this property (Optional).',
    }),
    defineField({
      name: 'coordinates',
      title: 'Coordinates (X, Y, Z)',
      type: 'string',
      description:
        'The in-game Minecraft coordinates (e.g., "X: 120, Y: 64, Z: -450"). This field is required.',
      validation: (Rule) => Rule.required().error('In-game coordinates are required.'),
    }),
    defineField({
      name: 'price',
      title: 'Price (Diamonds)',
      type: 'number',
      description: 'The purchase or rent price in Diamonds.',
      initialValue: 0,
    }),
    defineField({
      name: 'building_type',
      title: 'Building Type',
      type: 'string',
      description: 'Select the classification for this property.',
      initialValue: 'home',
      options: {
        list: [
          {title: 'Home', value: 'home'},
          {title: 'Apartment', value: 'apartment'},
          {title: 'House & Shop', value: 'house_and_shop'},
          {title: 'Hotel Room', value: 'hotel_room'},
          {title: 'Shop', value: 'shop'},
        ],
        layout: 'dropdown',
      },
    }),
    defineField({
      name: 'is_rental',
      title: 'Is this a Rental?',
      type: 'boolean',
      description: 'Toggle on if this property is for rent instead of for sale.',
      initialValue: false,
    }),
    defineField({
      name: 'city',
      title: 'City / Region',
      type: 'string',
      description: 'The city or territory where the listing is located.',
      initialValue: 'Shiroyama',
    }),
    defineField({
      name: 'listing_owner',
      title: 'Listing Owner',
      type: 'string',
      description: 'The player, group, or faction that owns this listing.',
      initialValue: 'Government',
    }),
    defineField({
      name: 'schematic_file',
      title: 'Schematic File',
      type: 'file',
      description: 'Upload a .litematic or .schematic file for the build layout (Optional).',
      options: {
        accept: '.litematic,.schematic',
      },
    }),
    defineField({
      name: 'images',
      title: 'Images',
      type: 'array',
      description: 'Screenshots or renders of the property.',
      of: [{type: 'image', options: {hotspot: true}}],
    }),
    defineField({
      name: 'is_active',
      title: 'Active Listing',
      type: 'boolean',
      description:
        'Toggle on if this property is currently available. Inactive listings will not be displayed on the map.',
      initialValue: true,
    }),
  ],
})
