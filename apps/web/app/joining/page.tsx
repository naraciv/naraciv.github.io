import type { Metadata } from 'next'
import { CheckCircle2, House, Shield, TrendingUp, Users } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Card, DiscordButton, SectionHeading } from '@/components/ui'
import { JsonLd } from '@/components/JsonLd'
import { site } from '@/lib/site'
import { benefits, lookFor, steps } from '@/content/joining'

export const metadata: Metadata = {
  title: 'Join Nara',
  description:
    'Join Nara now now now now. Join Nara discord Nara.',
  alternates: { canonical: '/joining' },
}

/* This page uses primary-alt (#2596be) throughout. */

const benefitIcons: Record<(typeof benefits)[number]['icon'], LucideIcon> = {
  house: House,
  shield: Shield,
  users: Users,
  trendingUp: TrendingUp,
}

export default function JoiningPage() {
  return (
    <div className="px-4 pt-[100px]">
      <div className="mx-auto max-w-4xl py-20">
        {/* FAQPage no longer yields rich results for general sites (Google
            restricted it in August 2023). Emitted for machine comprehension
            only — do not expect a SERP change. */}
        <JsonLd
          data={{
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            url: `${site.url}/joining`,
            mainEntity: [
              {
                '@type': 'Question',
                name: 'How do I join Nara?',
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: steps.map((s, i) => `${i + 1}. ${s.title}: ${s.description}`).join(' '),
                },
              },
              {
                '@type': 'Question',
                name: 'What does Nara look for in new citizens?',
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: lookFor.map((l) => `${l.title}: ${l.description}`).join(' '),
                },
              },
              {
                '@type': 'Question',
                name: 'What do citizens of Nara get?',
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: benefits.map((b) => `${b.title}: ${b.description}`).join(' '),
                },
              },
            ],
          }}
        />

        <div className="mb-16 text-center">
          <h1 className="mb-6 text-4xl font-bold text-primary-alt">Welcome to Nara</h1>
          <p className="text-xl text-ink-2">
            We&rsquo;re always looking for dedicated players who share our values of vibing,
            environmentalism, and quality building.
          </p>
        </div>

        <section className="mb-16">
          <SectionHeading alt>What We Look For</SectionHeading>
          <div className="grid gap-6 md:grid-cols-2">
            {lookFor.map((item) => (
              <Card key={item.title}>
                <div className="mb-4 flex items-start">
                  <CheckCircle2
                    aria-hidden
                    className="mt-1 mr-3 size-6 shrink-0 text-primary-alt"
                  />
                  <div>
                    <h3 className="mb-2 text-xl font-bold">{item.title}</h3>
                    <p className="text-ink-2">{item.description}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </section>

        <section className="mb-16">
          <SectionHeading alt>How to Join</SectionHeading>
          <Card className="p-8">
            <ol className="space-y-6">
              {steps.map((step, i) => (
                <li key={step.title} className="flex items-start">
                  <div className="mt-1 mr-4 flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-alt">
                    {/* Ground colour on #2596be is 8.4:1; white is only 3.7:1. */}
                    <span className="font-bold text-ground">{i + 1}</span>
                  </div>
                  <div>
                    <h3 className="mb-2 text-xl font-bold">{step.title}</h3>
                    <p className="mb-3 text-ink-2">{step.description}</p>
                    {step.cta && <DiscordButton href={site.discord}>{step.cta}</DiscordButton>}
                  </div>
                </li>
              ))}
            </ol>
          </Card>
        </section>

        <section className="mb-16">
          <SectionHeading alt>What You Get as a Citizen</SectionHeading>
          <div className="grid gap-6 md:grid-cols-2">
            {benefits.map((benefit) => {
              const Icon = benefitIcons[benefit.icon]
              return (
                <Card key={benefit.title} className="flex items-start">
                  <Icon aria-hidden className="mt-1 mr-4 size-6 shrink-0 text-primary-alt" />
                  <div>
                    <h3 className="mb-2 text-lg font-bold">{benefit.title}</h3>
                    <p className="text-ink-2">{benefit.description}</p>
                  </div>
                </Card>
              )
            })}
          </div>
        </section>

        <section className="rounded-lg bg-gradient-to-r from-primary-alt to-edge p-12 text-center">
          <h2 className="mb-4 text-3xl font-bold">Ready to Join?</h2>
          <p className="mb-6 text-xl">Take the first step and join our Discord community today!</p>
          <DiscordButton href={site.discord} variant="light">
            Join Naracord
          </DiscordButton>
        </section>
      </div>
    </div>
  )
}
