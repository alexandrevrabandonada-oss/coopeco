"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Home, Map, MessageSquare, User, LayoutGrid, Bell } from "lucide-react"
import { useAuth } from "@/contexts/auth-context"
import { useEffect, useMemo, useState } from "react"
import { createClient } from "@/lib/supabase"

export function BottomNav() {
    const pathname = usePathname()
    const { user } = useAuth()
    const supabase = useMemo(() => createClient(), [])
    const [unreadCount, setUnreadCount] = useState(0)

    useEffect(() => {
        const run = async () => {
            if (!user) {
                setUnreadCount(0)
                return
            }
            const { count } = await supabase
                .from("user_notifications")
                .select("id", { count: "exact", head: true })
                .eq("user_id", user.id)
                .eq("is_read", false)
            setUnreadCount(count || 0)
        }
        run()
    }, [user, supabase, pathname])

    const navItems = [
        { href: "/", icon: Home, label: "Home" },
        { href: "/mural", icon: MessageSquare, label: "Mural" },
        { href: "/mapa", icon: Map, label: "Mapa" },
        { href: "/notificacoes", icon: Bell, label: "Alertas" },
        { href: "/perfil", icon: User, label: "Perfil" },
    ]

    return (
        <nav className="bottom-nav glass">
            {navItems.map((item) => {
                const Icon = item.icon
                const isActive = pathname === item.href
                return (
                    <Link key={item.href} href={item.href} className={`nav-item ${isActive ? "active" : ""} ${item.href === "/notificacoes" ? "nav-with-badge" : ""}`}>
                        <Icon />
                        {item.href === "/notificacoes" && unreadCount > 0 && (
                            <span className="notif-badge">{unreadCount > 99 ? "99+" : unreadCount}</span>
                        )}
                        <span>{item.label}</span>
                    </Link>
                )
            })}
        </nav>
    )
}

export function Header() {
    const { user } = useAuth()
    const supabase = useMemo(() => createClient(), [])
    const [unreadCount, setUnreadCount] = useState(0)

    useEffect(() => {
        const run = async () => {
            if (!user) {
                setUnreadCount(0)
                return
            }
            const { count } = await supabase
                .from("user_notifications")
                .select("id", { count: "exact", head: true })
                .eq("user_id", user.id)
                .eq("is_read", false)
            setUnreadCount(count || 0)
        }
        run()
    }, [user, supabase])

    return (
        <header className="header glass">
            <Link href="/" className="logo">ECO</Link>
            <div className="flex items-center gap-4">
                <Link href="/notificacoes" className="nav-item nav-with-badge">
                    <Bell size={24} />
                    {unreadCount > 0 && <span className="notif-badge">{unreadCount > 99 ? "99+" : unreadCount}</span>}
                </Link>
                <Link href="/menu" className="nav-item">
                    <LayoutGrid size={24} />
                </Link>
            </div>
        </header>
    )
}
