import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description:
    'Nara collects no personal data and uses no cross-site tracking. What is recorded, why, and how to request removal.',
  alternates: { canonical: '/privacy' },
}

const EMAIL = 'dev@bulbmin(dot)com'

export default function PrivacyPage() {
  return (
    <div className="px-4 pt-[100px]">
      <article className="mx-auto w-5/6 max-w-4xl py-20">
        <h1 className="mb-12 text-center text-5xl font-bold text-primary">Privacy Policy</h1>

        <div className="space-y-6 leading-relaxed text-ink-2">
          <p>
            This website is operated by the members of Nara, and we value your privacy. We do not
            collect any personal data, or use cross-site tracking technologies of any kind.
          </p>

          <h2 className="mt-8 text-2xl font-semibold text-primary">Data Collection</h2>
          <p>
            The site does <strong>not</strong> store any personal information from visitors.
          </p>
          <p>
            Your IP address will be recorded if you participate in the gacha game. No other
            information about you or your computer is collected. Addtionally, your IP address may be
            recorded temporarily by our hosting provider as part of standard server operations. This
            is solely for anti-scraping, rate-limiting, and DDoS protection measures. These records
            are not stored permanently, analyzed, or linked to individual users.
          </p>

          <h2 className="mt-8 text-2xl font-semibold text-primary">Site Data</h2>
          <p>
            All data displayed on this website has been manually provided by the Nara maintainers.
            No data belonging to any <em>Civ player</em> is automatically collected or scraped by
            us. We rely on available pre-existing APIs at this time.
          </p>

          <h2 className="mt-8 text-2xl font-semibold text-primary">Your Rights</h2>
          <p>
            If you reside in a jurisdiction with data privacy laws and believe any data on this site
            pertains to you, you may request its removal. Please email {EMAIL} with the relevant
            proof required for your jurisdiction, and we will review and process your request.
          </p>
          <p>
            If you would like a copy of the data maintained by the Nara team that pertains to your
            Civ player, you may also request it via {EMAIL} with relevant proof.
          </p>

          <h2 className="mt-8 text-2xl font-semibold text-primary">Contact</h2>
          <p>
            For all other questions or concerns about this privacy policy, please email {EMAIL} with{' '}
            <strong>&ldquo;Nara Website Privacy Policy&rdquo;</strong> in the subject line.
          </p>

          <p className="mt-10 text-sm text-ink-4">Last updated: April 2026</p>
        </div>
      </article>
    </div>
  )
}
