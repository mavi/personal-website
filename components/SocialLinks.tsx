import { Globe } from 'lucide-react';
import React from 'react';
import { motion } from 'framer-motion';
import {
    FaSpotify,
    FaPinterest,
    FaInstagram,
    FaTwitter,
    FaLinkedin,
    FaGithub,
    FaDiscord,
    FaYoutube,
    FaTwitch,
    FaTiktok
} from 'react-icons/fa';

const IconMap: Record<string, any> = {
    spotify: FaSpotify,
    pinterest: FaPinterest,
    instagram: FaInstagram,
    twitter: FaTwitter,
    linkedin: FaLinkedin,
    github: FaGithub,
    discord: FaDiscord,
    youtube: FaYoutube,
    twitch: FaTwitch,
    tiktok: FaTiktok
};

interface SocialLinksProps {
    socials: Array<{ platform: string; url: string }>;
}

const container = {
    hidden: { opacity: 0 },
    show: {
        opacity: 1,
        transition: {
            staggerChildren: 0.1
        }
    }
};

const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 }
};

export const SocialLinks: React.FC<SocialLinksProps> = ({ socials }) => {
    return (
        <motion.div
            className="flex gap-4 pt-4"
            variants={container}
            initial="hidden"
            animate="show"
        >
            {socials?.map((social, idx) => {
                const Icon = IconMap[social.platform.toLowerCase()] || Globe;
                return (
                    <motion.a
                        key={idx}
                        href={social.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        variants={item}
                        whileHover={{ scale: 1.1, backgroundColor: "rgba(255,255,255,0.2)" }}
                        whileTap={{ scale: 0.95 }}
                        className="w-12 h-12 rounded-full flex items-center justify-center bg-white/10 border border-white/10 backdrop-blur-md transition-colors"
                    >
                        <Icon size={20} className="text-white drop-shadow-md" />
                    </motion.a>
                )
            })}
        </motion.div>
    );
};
