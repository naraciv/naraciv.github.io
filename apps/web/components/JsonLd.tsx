/**
 * Structured data. Emitted server-side so it is in the delivered HTML for
 * crawlers that do not run JavaScript — which is most LLM crawlers.
 */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      // Content is authored here, never user input.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  )
}
