import Image from "next/image";

export function ProductArt({ src, alt, className = "" }: { src: string; alt: string; className?: string }) {
  return <div className={`product-art relative overflow-hidden ${className}`}><Image src={src} alt={alt} fill sizes="(max-width: 760px) 100vw, 50vw" className="object-contain" priority /></div>;
}
