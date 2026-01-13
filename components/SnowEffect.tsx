'use client';

import { useEffect, useState } from 'react';

interface Snowflake {
    id: number;
    left: string;
    animationDelay: string;
    animationDuration: string;
    opacity: number;
    size: string;
}

export const SnowEffect = () => {
    const [snowflakes, setSnowflakes] = useState<Snowflake[]>([]);

    useEffect(() => {
        const flakes = Array.from({ length: 50 }).map((_, i) => ({
            id: i,
            left: `${Math.random() * 100}vw`,
            animationDelay: `${Math.random() * 10}s`,
            animationDuration: `${Math.random() * 5 + 5}s`, // 5-10s duration
            opacity: Math.random() * 0.5 + 0.3, // 0.3 - 0.8 opacity
            size: `${Math.random() * 3 + 2}px`, // 2-5px size
        }));
        setSnowflakes(flakes);
    }, []);

    if (snowflakes.length === 0) return null;

    return (
        <div className="fixed inset-0 pointer-events-none z-[-1] overflow-hidden" aria-hidden="true">
            {snowflakes.map((flake) => (
                <div
                    key={flake.id}
                    className="absolute bg-white rounded-full"
                    style={{
                        left: flake.left,
                        top: '-20px',
                        width: flake.size,
                        height: flake.size,
                        animation: `snowfall ${flake.animationDuration} linear infinite`,
                        animationDelay: flake.animationDelay,
                        opacity: flake.opacity,
                    }}
                />
            ))}
        </div>
    );
};
