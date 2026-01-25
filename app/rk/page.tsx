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
            bloomed: boolean;

            constructor(x: number, y: number) {
                this.x = x;
                this.y = y;
                this.size = 0;
                this.maxSize = 40 + Math.random() * 40; // Random max size
                this.growthRate = 0.2 + Math.random() * 0.3;
                this.hue = 330 + Math.random() * 40; // Pinks to Reds (330-370/10)
                this.bloomed = false;
                this.generatePetals();
            }

            generatePetals() {
                const layers = 5;
                for (let l = 0; l < layers; l++) {
                    const count = 6 + l * 4;
                    for (let i = 0; i < count; i++) {
                        const angle = (Math.PI * 2 / count) * i + (Math.random() * 0.5 - 0.25);
                        const lightness = 50 + l * 5 + Math.random() * 10;
                        this.petals.push({
                            angle: angle,
                            length: 0.5 + l * 0.15, // Relative to current size
                            width: 0.4 + Math.random() * 0.2,
                            color: `hsl(${this.hue}, ${70 + Math.random() * 20}%, ${lightness}%)`,
                            offset: Math.random() * 0.2
                        });
                    }
                }
            }

            update() {
                if (this.size < this.maxSize) {
                    this.size += this.growthRate;
                } else {
                    this.bloomed = true;
                }
            }

            draw(ctx: CanvasRenderingContext2D) {
                ctx.save();
                ctx.translate(this.x, this.y);

                // Sort petals by "layer" roughly (drawing order is tricky, but inner first? actually outer first usually looks better for overlap)
                // Simplification: just draw them. Real peonies look messy (in a good way).

                // Let's try drawing "layers" from outside in or inside out.
                // Inside out makes sense for growth, but painter's algorithm needs back to front.
                // For a 2D top-down view, outer petals are "below" inner petals.

                this.petals.forEach(petal => {
                    const petalLen = this.size * petal.length;
                    const petalWid = this.size * petal.width;

                    ctx.save();
                    ctx.rotate(petal.angle);
                    ctx.fillStyle = petal.color;
                    ctx.beginPath();

                    // Draw a ruffled petal path
                    ctx.moveTo(0, 0);

                    // Quadratic or Bezier for petal shape
                    // Control points for width
                    ctx.bezierCurveTo(
                        petalWid / 2, petalLen * 0.3,
                        petalWid, petalLen * 0.8,
                        0, petalLen
                    );
                    ctx.bezierCurveTo(
                        -petalWid, petalLen * 0.8,
                        -petalWid / 2, petalLen * 0.3,
                        0, 0
                    );

                    ctx.fill();
                    // Optional: minimal stroke for definition
                    // ctx.strokeStyle = 'rgba(0,0,0,0.05)';
                    // ctx.stroke();

                    ctx.restore();
                });

                // Center center
                ctx.beginPath();
                ctx.arc(0, 0, this.size * 0.2, 0, Math.PI * 2);
                ctx.fillStyle = `hsl(${this.hue + 10}, 80%, 40%)`;
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
            if (peonies.length < 50) { // Limit count
                addPeony();
            }
        }, 800);

        const render = () => {
            ctx.fillStyle = '#fdfcf0'; // Creamy background
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
