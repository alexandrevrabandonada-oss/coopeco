"use client"

import { createContext, useContext, useEffect, useState } from "react"
import { createClient, isSupabaseConfigured } from "@/lib/supabase"
import { Session, User } from "@supabase/supabase-js"

interface AuthContextType {
    user: User | null
    session: Session | null
    profile: unknown | null
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

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null)
    const [session, setSession] = useState<Session | null>(null)
    const [profile, setProfile] = useState<unknown | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    useEffect(() => {
        if (!isSupabaseConfigured) {
            setIsLoading(false)
            return
        }

        const supabase = createClient()

        const getInitialSession = async () => {
            const { data: { session } } = await supabase.auth.getSession()
            setSession(session)
            setUser(session?.user ?? null)

            if (session?.user) {
                const { data: profile } = await supabase
                    .from("profiles")
                    .select("*")
                    .eq("user_id", session.user.id)
                    .single()
                setProfile(profile)
            }

            setIsLoading(false)
        }

        getInitialSession()

        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
            setSession(session)
            setUser(session?.user ?? null)

            if (session?.user) {
                const { data: profile } = await supabase
                    .from("profiles")
                    .select("*")
                    .eq("user_id", session.user.id)
                    .single()
                setProfile(profile)
            } else {
                setProfile(null)
            }

            setIsLoading(false)
        })

        return () => {
            subscription.unsubscribe()
        }
    }, [])

    const signOut = async () => {
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
