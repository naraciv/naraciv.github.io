import { createClient } from '@sanity/client'

/**
 * Public read-only client. The project id and dataset are not secrets — a
 * public dataset is designed to be addressed this way. Never give this client a write token.
 */
export const sanity = createClient({
  projectId: 'scdpub0o',
  dataset: 'production',
  apiVersion: '2021-10-21',
  useCdn: true,
})
