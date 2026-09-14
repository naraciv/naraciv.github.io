import type { Metadata } from 'next'
import { NaranCollection } from '@/components/NaranCollection'

export const metadata: Metadata = {
  title: 'Collect-a-Naran',
  description:
    "Your personal collection of Nara's finest citizens — every Naran you have pulled from the daily gacha, by rarity.",
  alternates: { canonical: '/collect' },
}

export default function CollectPage() {
  return (
    <div className="px-4 pt-[100px]">
      <div className="mx-auto max-w-6xl py-10">
        <div className="mb-12 text-center">
          <h1 className="text-gacha mb-3 text-5xl font-bold tracking-widest">COLLECT-A-NARAN</h1>
          <p className="text-xl text-ink-3">
            Your personal collection of Nara&rsquo;s finest citizens
          </p>
        </div>
        <NaranCollection />
      </div>
    </div>
  )
}
