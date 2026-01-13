'use client';


import Image from 'next/image';
import { ProfileData } from '@/types';
import { SocialLinks } from './SocialLinks';
import { motion } from 'framer-motion';

interface ProfileCardProps {
    data: ProfileData;
}

export const ProfileCard: React.FC<ProfileCardProps> = ({ data }) => {
    const themeColor = data.theme?.color;

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative z-10 w-full max-w-2xl mx-4 glass-card rounded-[2rem] p-8 md:p-12 overflow-hidden"
            whileHover={{
                scale: 1.02,
                y: -5,
                boxShadow: `0 20px 40px -10px ${themeColor ? themeColor + '30' : 'rgba(255,255,255,0.1)'}`,
                borderColor: themeColor ? `${themeColor}80` : 'rgba(255,255,255,0.3)'
            }}
            transition={{
                type: "spring",
                stiffness: 300,
                damping: 20,
                opacity: { duration: 0.5, ease: "easeOut" }
            }}
            style={{
                borderColor: themeColor ? `${themeColor}40` : undefined,
            }}
        >
            {/* Shine Effect Overlay */}
            <motion.div
                className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-transparent z-0 pointer-events-none"
                animate={{
                    backgroundPosition: ["0% 100%", "100% 0%"],
                }}
                transition={{
                    duration: 8,
                    ease: "linear",
                    repeat: Infinity,
                }}
                style={{
                    backgroundSize: "200% 200%",
                }}
            />

            {/* Profile Content */}
            <div className="relative z-10 flex flex-col items-center text-center gap-4">

                {/* Avatar Area */}
                {data.avatarUrl && (
                    <div className="relative">
                        <div className="relative w-32 h-32 md:w-40 md:h-40 rounded-full overflow-hidden border-4 border-white/10 shadow-2xl"
                            style={{ borderColor: themeColor ? `${themeColor}40` : undefined }}>
                            <Image
                                src={data.avatarUrl}
                                alt={data.name}
                                fill
                                className="object-cover"
                            />
                        </div>
                    </div>
                )}

                {/* Name & Role Group */}
                <div className="w-full space-y-1">
                    <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-white">
                        {data.name}
                    </h1>
                    {data.role && <p className="text-white/40 text-sm md:text-base font-medium">{data.role}</p>}
                </div>

                {/* Bio */}
                {data.bio && (
                    <p className="text-base md:text-lg text-white/70 leading-relaxed font-light max-w-xl mx-auto">
                        {data.bio}
                    </p>
                )}

                {/* Social Links */}
                <div>
                    <SocialLinks socials={data.socials} />
                </div>
            </div>
        </motion.div >
    );
};
