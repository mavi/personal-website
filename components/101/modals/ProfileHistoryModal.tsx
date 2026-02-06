'use client'

import { useEffect, useState } from 'react'
import { ProfileCard } from '@/components/101/profile/ProfileCard'
import { Stats } from '@/components/101/profile/Stats'
import { MatchHistory } from '@/components/101/profile/MatchHistory'
import type { User, Match } from '@/lib/101/supabase/types'

interface ProfileHistoryModalProps {
    username: string
    currentUserId: string
    isOwnProfile: boolean
    defaultTab?: 'profile' | 'history'
    onClose: () => void
}

export function ProfileHistoryModal({
    username,
    currentUserId,
    isOwnProfile,
    defaultTab = 'profile',
    onClose
}: ProfileHistoryModalProps) {
    const [activeTab, setActiveTab] = useState<'profile' | 'history'>(defaultTab)
    const [profile, setProfile] = useState<User | null>(null)
    const [matches, setMatches] = useState<Match[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        fetchData()
    }, [username])

    const fetchData = async () => {
        try {
            setIsLoading(true)
            setError(null)

            // Fetch profile data
            const profileRes = await fetch(`/api/101/profile/${username}`)
            const profileData = await profileRes.json()

            if (!profileRes.ok) {
                throw new Error(profileData.error || 'Profil yüklenemedi')
            }

            setProfile(profileData.user)
            setMatches(profileData.matches || [])
        } catch (err) {
            setError((err as Error).message)
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="fixed inset-0 z-[9999] bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
            <div
                className="bg-[#132f4c] rounded-lg border border-[#1a3a5c] w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col"
                onClick={e => e.stopPropagation()}
            >
                {/* Header with tabs */}
                <div className="flex items-center justify-between border-b border-[#1a3a5c] sticky top-0 bg-[#132f4c] z-10">
                    <div className="flex">
                        <button
                            onClick={() => setActiveTab('profile')}
                            className={`px-4 py-3 text-sm font-medium transition-colors relative ${activeTab === 'profile'
                                    ? 'text-[#d4af37]'
                                    : 'text-[#8899aa] hover:text-white'
                                }`}
                        >
                            Profil
                            {activeTab === 'profile' && (
                                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#d4af37]" />
                            )}
                        </button>
                        <button
                            onClick={() => setActiveTab('history')}
                            className={`px-4 py-3 text-sm font-medium transition-colors relative ${activeTab === 'history'
                                    ? 'text-[#d4af37]'
                                    : 'text-[#8899aa] hover:text-white'
                                }`}
                        >
                            Geçmiş
                            {activeTab === 'history' && (
                                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#d4af37]" />
                            )}
                        </button>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-[#8899aa] hover:text-white text-xl leading-none px-4 py-3"
                    >
                        ×
                    </button>
                </div>

                {/* Content */}
                <div className="p-4 overflow-y-auto flex-1">
                    {isLoading ? (
                        <div className="flex justify-center py-12">
                            <div className="w-8 h-8 border-2 border-[#d4af37] border-t-transparent rounded-full animate-spin" />
                        </div>
                    ) : error ? (
                        <div className="text-center py-8">
                            <p className="text-[#ef4444]">{error}</p>
                        </div>
                    ) : activeTab === 'profile' ? (
                        profile ? (
                            <div className="space-y-6">
                                <ProfileCard
                                    user={profile}
                                    isOwnProfile={isOwnProfile}
                                    onUpdate={fetchData}
                                />
                                <Stats user={profile} />
                            </div>
                        ) : (
                            <div className="text-center py-8">
                                <p className="text-[#8899aa]">Kullanıcı bulunamadı</p>
                            </div>
                        )
                    ) : (
                        <MatchHistory matches={matches} currentUserId={currentUserId} />
                    )}
                </div>
            </div>
        </div>
    )
}
