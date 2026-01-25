'use client';

import { useEffect, useRef } from 'react';

export default function FlowerPage() {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let animationFrameId: number;
        let peonies: Peony[] = [];

        const resizeCanvas = () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        };

        window.addEventListener('resize', resizeCanvas);
        resizeCanvas();

        class Peony {
            x: number;
            y: number;
            size: number;
            maxSize: number;
            growthRate: number;
            petals: { angle: number; length: number; width: number; color: string; offset: number }[] = [];
            hue: number;
            saturation: number;
            lightness: number;
            bloomed: boolean;
            opacity: number;

            constructor(x: number, y: number) {
                this.x = x;
                this.y = y;
                this.size = 0;
                this.maxSize = 60 + Math.random() * 60; // Larger flowers
                this.growthRate = 0.1 + Math.random() * 0.2; // Slower, smoother growth

                // Romantic palette: Deep reds (340-360), Soft Pinks (330-350), Creamy Whites (warm)
                // Weighted random for better color distribution
                const rand = Math.random();
                if (rand < 0.30) {
                    // Deep Red/Burgundy
                    this.hue = 340 + Math.random() * 20;
                    this.saturation = 80 + Math.random() * 20;
                    this.lightness = 20 + Math.random() * 20;
                } else if (rand < 0.70) {
                    // Soft Pink/Magenta
                    this.hue = 320 + Math.random() * 30;
                    this.saturation = 60 + Math.random() * 20;
                    this.lightness = 70 + Math.random() * 20;
                } else {
                    // White/Cream
                    this.hue = 30 + Math.random() * 30;
                    this.saturation = 20 + Math.random() * 30;
                    this.lightness = 85 + Math.random() * 15;
                }

                this.bloomed = false;
                this.opacity = 0;
                this.generatePetals();
            }

            generatePetals() {
                const layers = 12; // More layers for "quality" look
                for (let l = 0; l < layers; l++) {
                    const count = 8 + l * 5; // Denser petals
                    for (let i = 0; i < count; i++) {
                        const angle = (Math.PI * 2 / count) * i + (Math.random() * 0.5 - 0.25);

                        // Slight variation in color per petal for realism
                        const pLightness = this.lightness + (Math.random() * 10 - 5) - (l * 2); // Inner petals often darker or lighter depending on flower, let's go darker center for depth
                        const pColor = `hsla(${this.hue}, ${this.saturation}%, ${Math.max(10, pLightness)}%, ${0.1 + l * 0.05})`; // Transparency for soft look

                        this.petals.push({
                            angle: angle,
                            length: 0.2 + l * 0.08, // Layers grow outwards
                            width: 0.3 + Math.random() * 0.3,
                            color: pColor,
                            offset: Math.random() * 0.5
                        });
                    }
                }
            }

            update() {
                if (this.size < this.maxSize) {
                    this.size += this.growthRate;
                    if (this.opacity < 1) this.opacity += 0.01;
                } else {
                    this.bloomed = true;
                }
            }

            draw(ctx: CanvasRenderingContext2D) {
                ctx.save();
                ctx.translate(this.x, this.y);
                ctx.globalAlpha = this.opacity; // Fade in

                // Soft glow effect
                ctx.shadowBlur = 15;
                ctx.shadowColor = `hsla(${this.hue}, ${this.saturation}%, ${this.lightness}%, 0.5)`;

                this.petals.forEach(petal => {
                    const petalLen = this.size * petal.length;
                    const petalWid = this.size * petal.width;

                    ctx.save();
                    ctx.rotate(petal.angle);
                    ctx.fillStyle = petal.color;

                    // Allow petals to blend softly
                    ctx.globalCompositeOperation = 'source-over';

                    ctx.beginPath();

                    // More organic petal shape
                    ctx.moveTo(0, 0);

                    // Asymmetric bezier for natural look
                    ctx.bezierCurveTo(
                        petalWid * 0.5, petalLen * 0.4,
                        petalWid * 1.2, petalLen * 0.8,
                        0, petalLen
                    );
                    ctx.bezierCurveTo(
                        -petalWid * 1.2, petalLen * 0.8,
                        -petalWid * 0.5, petalLen * 0.4,
                        0, 0
                    );

                    ctx.fill();
                    ctx.restore();
                });

                // Center
                ctx.beginPath();
                ctx.arc(0, 0, this.size * 0.1, 0, Math.PI * 2);
                ctx.fillStyle = `hsla(${this.hue}, ${this.saturation - 20}%, ${Math.max(20, this.lightness - 30)}%, 0.9)`;
                ctx.fill();

                ctx.restore();
            }
        }

        const addPeony = () => {
            const x = Math.random() * canvas.width;
            const y = Math.random() * canvas.height;
            peonies.push(new Peony(x, y));
        };

        // Add initial flower
        addPeony();

        // Add more periodically
        const interval = setInterval(() => {
            if (peonies.length < 30) { // Keep count reasonable but lush
                addPeony();
            }
        }, 1200); // Slower appearance for romantic pacing

        const render = () => {
            // Background: Deep Black for contrast
            ctx.fillStyle = '#000000';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            peonies.forEach(peony => {
                peony.update();
                peony.draw(ctx);
            });

            animationFrameId = requestAnimationFrame(render);
        };

        render();

        return () => {
            window.removeEventListener('resize', resizeCanvas);
            cancelAnimationFrame(animationFrameId);
            clearInterval(interval);
        };
    }, []);

    return (
        <div style={{ width: '100vw', height: '100vh', overflow: 'hidden' }}>
            <canvas ref={canvasRef} style={{ display: 'block' }} />
        </div>
    );
}
