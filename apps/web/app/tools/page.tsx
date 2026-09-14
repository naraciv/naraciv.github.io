import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { BarChart2, Rocket, Shield } from 'lucide-react'
import { JsonLd } from '@/components/JsonLd'
import { site } from '@/lib/site'

export const metadata: Metadata = {
  title: 'Tools',
  description:
    'Community tools and utilities for Civ players: snitch viewer, grid planner, and playtime statistics.',
  alternates: { canonical: '/tools' },
}

/* This page uses primary-alt (#2596be) throughout. */
const tools = [
  { href: '/snitches', name: 'Snitch Viewer' },
  { href: '/planner', name: 'Grid Planner' },
  { href: '/stats', name: 'Playtime Statistics' },
  { href: '/rocket', name: 'Rocket Calculator' },
] as const

export default function ToolsPage() {
  return (
    <div className="px-4 pt-[100px]">
      <div className="mx-auto max-w-5xl py-16">
        <JsonLd
          data={{
            '@context': 'https://schema.org',
            '@type': 'ItemList',
            name: 'Nara tools',
            itemListElement: tools.map((tool, i) => ({
              '@type': 'ListItem',
              position: i + 1,
              item: {
                '@type': 'WebApplication',
                name: tool.name,
                url: `${site.url}${tool.href}`,
                applicationCategory: 'UtilitiesApplication',
                operatingSystem: 'Any',
              },
            })),
          }}
        />

        <div className="mb-12 text-center">
          <h1 className="mb-3 text-4xl font-bold">Tools</h1>
          <p className="text-lg text-ink-3">Community tools and utilities for Civ Players</p>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {tools.map((tool) => (
            <Link
              key={tool.href}
              href={tool.href}
              className="group block rounded-xl p-6 text-center transition-transform duration-300 hover:-translate-y-1"
            >
              <h2 className="mb-4 text-2xl font-bold">{tool.name}</h2>
              <div className="mx-auto flex size-50 shrink-0 items-center justify-center rounded-2xl border border-edge bg-surface transition-[box-shadow,border-color] duration-300 group-hover:border-primary-alt group-hover:shadow-[0_12px_40px_rgba(37,150,190,0.15)]">
                {tool.href === '/snitches' ? (
                  <Image
                    src="/images/note_block.webp"
                    alt=""
                    width={160}
                    height={160}
                    className="[image-rendering:pixelated]"
                  />
                ) : tool.href === '/planner' ? (
                  <Shield aria-hidden className="size-42 text-primary-alt" strokeWidth={1.5} />
                ) : tool.href === '/rocket' ? (
                  <Rocket aria-hidden className="size-42 text-primary-alt" strokeWidth={1.5} />
                ) : (
                  <BarChart2 aria-hidden className="size-42 text-primary-alt" strokeWidth={1.5} />
                )}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
