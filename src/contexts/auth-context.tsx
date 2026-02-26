"use client"

import { createContext, useContext, useEffect, useState } from "react"
import { createClient, isSupabaseConfigured } from "@/lib/supabase"
import { Session, User } from "@supabase/supabase-js"
import { Profile } from "@/types/eco"

interface AuthContextType {
    user: User | null
    session: Session | null
    profile: Profile | null
    isLoading: boolean
    signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    session: null,
    profile: null,
    isLoading: true,
    signOut: async () => { },
})

interface E2EBootstrap {
    user: User
    profile: Profile | null
}

function readE2EBootstrap(): E2EBootstrap | null {
    if (typeof window === "undefined") return null
    if (!["localhost", "127.0.0.1"].includes(window.location.hostname)) return null

    const raw = window.localStorage.getItem("eco_e2e_auth")
    if (!raw) return null

    try {
        const parsed = JSON.parse(raw) as { user?: User; profile?: Profile | null }
        if (!parsed.user) return null
        return {
            user: parsed.user,
            profile: parsed.profile ?? null,
        }
    } catch {
        return null
    }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const e2eBootstrap = readE2EBootstrap()
    const [user, setUser] = useState<User | null>(e2eBootstrap?.user ?? null)
    const [session, setSession] = useState<Session | null>(
        e2eBootstrap?.user ? ({ user: e2eBootstrap.user } as Session) : null
    )
    const [profile, setProfile] = useState<Profile | null>(e2eBootstrap?.profile ?? null)
    const [isLoading, setIsLoading] = useState(!e2eBootstrap)

    useEffect(() => {
        let isMounted = true

        if (e2eBootstrap) {
            return () => {
                isMounted = false
            }
        }

        const supabase = isSupabaseConfigured ? createClient() : null

        const loadProfile = async (uid: string) => {
            if (!supabase) return null
            const { data } = await supabase
                .from("profiles")
                .select("*, neighborhood:neighborhoods(name)")
                .eq("user_id", uid)
                .single()
            return data
        }

        const init = async () => {
            if (!supabase || !isSupabaseConfigured) {
                if (isMounted) setIsLoading(false)
                return
            }

            const { data: { session: initialSession } } = await supabase.auth.getSession()
            if (isMounted) {
                setSession(initialSession)
                setUser(initialSession?.user ?? null)
            }

            if (initialSession?.user) {
                const p = await loadProfile(initialSession.user.id)
                if (isMounted) setProfile(p)
            }
            if (isMounted) setIsLoading(false)
        }

        init()

        if (supabase) {
            const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
                if (isMounted) {
                    setSession(newSession)
                    setUser(newSession?.user ?? null)
                }

                if (newSession?.user) {
                    const p = await loadProfile(newSession.user.id)
                    if (isMounted) setProfile(p)
                } else {
                    if (isMounted) setProfile(null)
                }
                if (isMounted) setIsLoading(false)
            })

            return () => {
                isMounted = false
                subscription.unsubscribe()
            }
        }

        return () => {
            isMounted = false
        }
    }, [e2eBootstrap])

    const signOut = async () => {
        if (
            typeof window !== "undefined" &&
            ["localhost", "127.0.0.1"].includes(window.location.hostname) &&
            !!window.localStorage.getItem("eco_e2e_auth")
        ) {
            window.localStorage.removeItem("eco_e2e_auth")
            window.localStorage.removeItem("eco_e2e_access_token")
            setUser(null)
            setSession(null)
            setProfile(null)
            return
        }

        if (!isSupabaseConfigured) return
        const supabase = createClient()
        await supabase.auth.signOut()
    }

    return (
        <AuthContext.Provider value={{ user, session, profile, isLoading, signOut }}>
            {children}
        </AuthContext.Provider>
    )
}

export const useAuth = () => useContext(AuthContext)
