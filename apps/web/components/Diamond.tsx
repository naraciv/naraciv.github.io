import Image from 'next/image'

/**
 * The Minecraft diamond sprite, hotlinked wherever a price appears.
 * Third-party and therefore fragile; if it ever 404s, self-host it.
 */
export const DIAMOND_ICON = 'https://ccvaults.com/assets/10.%20Items/11.%20Materials/Diamond.png'

export function Diamond({ className = 'size-4' }: { className?: string }) {
  return (
    <Image
      src={DIAMOND_ICON}
      alt=""
      width={16}
      height={16}
      unoptimized
      className={`${className} inline-block align-middle [image-rendering:pixelated]`}
    />
  )
}

/** A price in diamonds. Free listings never show an icon. */
export function Price({
  price,
  rental,
  className,
}: {
  price: number
  rental?: boolean
  className?: string
}) {
  if (price === 0) return <>Free</>
  return (
    <>
      <Diamond className={className} /> {price}
      {rental ? '/mo' : ''}
    </>
  )
}
