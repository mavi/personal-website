import type { Metadata } from 'next'
import './styles.css'

export const metadata: Metadata = {
  title: 'Okey 101 | eren.live',
  description: 'Online Okey 101 oyunu - Arkadaşlarınızla oynayın!'
}

export default function Okey101Layout({
  children
}: {
  children: React.ReactNode
}) {
  return (
    <div className="okey-app min-h-screen bg-[#1a2f23]">
      {children}
    </div>
  )
}

