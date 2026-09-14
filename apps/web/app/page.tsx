import Image from 'next/image'
import Link from 'next/link'
import { Heart, MapPin, Sun, Users } from 'lucide-react'
import { getCities } from '@nara/lib'
import { GachaMachine } from '@/components/GachaMachine'
import { Lightbox } from '@/components/Lightbox'
import { JsonLd } from '@/components/JsonLd'
import { site } from '@/lib/site'

export const revalidate = 300

const pillars = [
  {
    icon: Heart,
    color: 'text-purple',
    title: 'Chill Philosophy',
    body: 'We aim for low drama and minding our own business, while still being a player on the international stage.',
  },
  {
    icon: Sun,
    color: 'text-gold',
    title: 'Environmentalism',
    body: 'We carefully consider terrain in all construction, avoiding unnecessary destruction of natural features.',
  },
  {
    icon: Users,
    color: 'text-primary',
    title: 'Multicultural Community',
    body: 'A vibrant community from across the world (if the world was just NA and Australia), with unique architectural styles united under one Shogunate.',
  },
]

export default async function HomePage() {
  const cities = await getCities()

  return (
    <>
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'WebSite',
          name: site.name,
          url: site.url,
          description: site.description,
          potentialAction: {
            '@type': 'SearchAction',
            target: {
              '@type': 'EntryPoint',
              urlTemplate: `${site.url}/shops?search={search_term_string}`,
            },
            'query-input': 'required name=search_term_string',
          },
        }}
      />

      {/* Without pt-navbar the top 42px of the NARA wordmark sits behind the
          fixed navbar. */}
      <div className="pt-navbar">
        <GachaMachine />
      </div>

      {/* ── About ── */}
      <section id="about" className="gacha-section relative mx-auto max-w-6xl px-4 py-20">
        <h2 className="section-title text-gacha">The Nation of Nara</h2>
        <div className="grid items-center gap-10 md:grid-cols-2">
          <div className="z-20">
            <p className="mb-6 text-xl">
              Nara is a meritocratic and feudalistic shogunate located in the +,+ quadrant on the
              continent of Alenarith. History has redefined Nara into a{' '}
              <span className="text-gacha">multicultural empire</span> with regions of different
              styles and cultures joined under one Shogunate.
            </p>
            <p className="mb-6 text-lg text-ink-hero">
              Founded on June 2nd, 2022, we&rsquo;ve grown from a small settlement to a thriving
              nation with multiple cities, a robust economy, and a rich culture. Our philosophy is
              to <span className="text-gacha">chill</span> and enjoy being part of a large and
              vibrant community from across the world.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <Link
                href="/government"
                className="gacha-pull-btn px-7 py-2.5 text-base tracking-[2px]"
              >
                Our Government
              </Link>
              <Link href="/joining" className="btn-outline">
                Join Nara
              </Link>
            </div>
          </div>

          <div className="relative z-10">
            <Image
              src="/images/nara_above.webp"
              alt="Shiroyama landscape"
              width={1200}
              height={800}
              priority
              className="big-city-image city-image rounded-lg shadow-2xl"
              tabIndex={0}
              role="button"
              data-full-src="/images/nara_above.webp"
            />
            <div className="capital-badge pointer-events-none absolute -right-5 -bottom-5 rounded-lg p-4 shadow-lg">
              <p className="font-bold text-white">Capital: Shiroyama</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Cities ── */}
      <section className="gacha-section px-4 py-20">
        <div className="mx-auto max-w-6xl">
          <h2 className="section-title text-gacha">Our Cities</h2>
          <div className="grid gap-8 md:grid-cols-3">
            {cities.map((city) => (
              <article key={city._id} className="gacha-card">
                {city.image?.url && (
                  <Image
                    src={city.image.url}
                    alt={city.image.alt ?? city.name}
                    width={640}
                    height={360}
                    className="city-image h-48 w-full object-cover"
                    tabIndex={0}
                    role="button"
                    /* the grid gets a 640px thumbnail; the modal needs the original */
                    data-full-src={city.image.url}
                    data-name={city.name}
                    data-coordinates={city.coordinates}
                    data-description={city.description}
                  />
                )}
                <div className="p-6">
                  <h3 className="text-gacha mb-2 text-2xl font-bold">{city.name}</h3>
                  <p className="mb-2 flex items-center gap-1 text-sm text-ink-2">
                    <MapPin aria-hidden className="size-4" />
                    <span className="sr-only">Coordinates: </span>
                    {city.coordinates}
                  </p>
                  <p className="text-ink-hero">{city.description}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── Culture ── */}
      <section className="gacha-section mx-auto max-w-6xl px-4 py-20">
        <h2 className="section-title text-gacha">Our Culture</h2>
        <div className="grid items-center gap-10 md:grid-cols-2">
          <div className="order-2 md:order-1">
            <p className="mb-6 text-xl text-ink-hero">
              Nara was born as a nation inspired by East Asian styles, particularly Japanese. As we
              grew, we developed new styles inspired by different cultures, molding regions into
              different themes.
            </p>
            <div className="space-y-4">
              {pillars.map(({ icon: Icon, color, title, body }) => (
                <div key={title} className="flex items-start">
                  <Icon aria-hidden className={`mt-1 mr-4 size-6 shrink-0 ${color}`} />
                  <div>
                    <h3 className="text-gacha text-lg font-bold">{title}</h3>
                    <p className="text-ink-hero">{body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="order-1 md:order-2">
            <Image
              src="/images/nara_flag_white_border.svg"
              alt="The flag of Nara"
              width={800}
              height={533}
              className="culture-flag mx-auto h-auto w-3/4 rounded-lg shadow-xl md:w-[600px] lg:w-[800px]"
            />
          </div>
        </div>
      </section>

      {/* ── Collection CTA ── */}
      <section className="gacha-section px-4 py-16">
        <div className="gacha-banner mx-auto max-w-2xl text-center">
          <h2 className="text-gacha relative z-10 mb-4 text-3xl font-bold">
            📦 View Your Collection
          </h2>
          <p className="relative z-10 mb-6 text-ink-hero">
            See all the Narans you&rsquo;ve found and check your progress of completing the full
            nara
          </p>
          <Link href="/collect" className="gacha-pull-btn relative z-10">
            View Collection
          </Link>
        </div>
      </section>

      <Lightbox />
    </>
  )
}
