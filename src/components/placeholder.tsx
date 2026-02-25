import { ChevronLeft } from "lucide-react"
import Link from "next/link"

interface PlaceholderProps {
    title: string
    description?: string
    backHref?: string
}

export default function Placeholder({ title, description, backHref }: PlaceholderProps) {
    return (
        <div className="animate-slide-up" style={{ padding: '1rem 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '2.5rem' }}>
                {backHref && (
                    <Link href={backHref} style={{ padding: '8px', border: '2px solid var(--foreground)', background: 'white' }}>
                        <ChevronLeft size={24} />
                    </Link>
                )}
                <h1 className="stencil-text" style={{ fontSize: '2rem', background: 'var(--primary)', padding: '0 8px', border: '2px solid var(--foreground)' }}>
                    {title}
                </h1>
            </div>

            <div className="card" style={{ textAlign: 'left', minHeight: '30vh', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <p style={{ fontSize: '1.25rem', fontWeight: 700, textTransform: 'uppercase' }}>
                    [ {description || "Esta página está em desenvolvimento como parte do MVP."} ]
                </p>
            </div>
        </div>
    )
}
