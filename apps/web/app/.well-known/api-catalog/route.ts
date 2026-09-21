import { site } from '@/lib/site'

/** RFC 9727 API catalog, so agents can find the JSON endpoints behind /government, /shops, /heads and /rocket. */
export async function GET() {
  const apis: [path: string, doc: string][] = [
    ['/api/government', '/government'],
    ['/api/shops', '/shops'],
    ['/api/heads', '/heads'],
    ['/api/rocket', '/rocket'],
  ]

  const linkset = apis.map(([path, doc]) => ({
    anchor: `${site.url}${path}`,
    'service-desc': [{ href: `${site.url}/openapi.json`, type: 'application/vnd.oai.openapi+json;version=3.0' }],
    'service-doc': [{ href: `${site.url}${doc}` }],
  }))

  return Response.json(
    { linkset },
    { headers: { 'Content-Type': 'application/linkset+json' } },
  )
}
