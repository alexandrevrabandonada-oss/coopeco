"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Home, Map, MessageSquare, User, Recycle, LayoutGrid } from "lucide-react"

export function BottomNav() {
    const pathname = usePathname()

    const navItems = [
        { href: "/", icon: Home, label: "Home" },
        { href: "/mural", icon: MessageSquare, label: "Mural" },
        { href: "/mapa", icon: Map, label: "Mapa" },
        { href: "/perfil", icon: User, label: "Perfil" },
    ]

    return (
        <nav className="bottom-nav glass">
            {navItems.map((item) => {
                const Icon = item.icon
                const isActive = pathname === item.href
                return (
                    <Link key={item.href} href={item.href} className={`nav-item ${isActive ? "active" : ""}`}>
                        <Icon />
                        <span>{item.label}</span>
                    </Link>
                )
            })}
        </nav>
    )
}

export function Header() {
    return (
        <header className="header glass">
            <Link href="/" className="logo">ECO</Link>
            <Link href="/menu" className="nav-item">
                <LayoutGrid size={24} />
            </Link>
        </header>
    )
}
