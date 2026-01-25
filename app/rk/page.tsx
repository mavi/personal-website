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

        // Config
        const FIREFLY_COUNT = 80;

        class Firefly {
            x: number;
            y: number;
            vx: number;
            vy: number;
            size: number;
            alpha: number;
            t: number;

            constructor() {
                this.x = Math.random() * canvas!.width;
                this.y = Math.random() * canvas!.height;
                // Faster movement
                this.vx = (Math.random() - 0.5) * 1.5;
                this.vy = (Math.random() - 0.5) * 1.5;
                // Bigger size
                this.size = 2 + Math.random() * 3;
                this.alpha = Math.random();
                this.t = Math.random() * 100;
            }

            update() {
                this.x += this.vx;
                this.y += this.vy;
                this.t += 0.1; // Faster blink
                this.alpha = 0.4 + Math.sin(this.t) * 0.5; // Minimum brightness

                if (this.x < 0) this.x = canvas!.width;
                else if (this.x > canvas!.width) this.x = 0;
                if (this.y < 0) this.y = canvas!.height;
                else if (this.y > canvas!.height) this.y = 0;
            }

            draw(ctx: CanvasRenderingContext2D) {
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(255, 255, 150, ${this.alpha})`; // More yellow
                ctx.shadowBlur = 15; // Stronger glow
                ctx.shadowColor = 'rgba(255, 255, 100, 0.9)';
                ctx.fill();
                ctx.shadowBlur = 0;
            }
        }

        class Stem {
            x: number;
            y: number;
            height: number;
            progress: number; // 0 to 1
            points: { x: number, y: number }[];
            controlPoints: { x: number, y: number }[];
            width: number;
            color: string;
            scale: number;

            constructor(x: number, y: number, height: number, scale: number) {
                this.x = x;
                this.y = y;
                this.height = height;
                this.scale = scale;
                this.progress = 0;
                this.width = (3 + Math.random() * 4) * scale;
                this.color = `hsl(${100 + Math.random() * 40}, 50%, ${15 + Math.random() * 10}%)`;

                // Generate a wavy path
                this.points = [{ x, y }];
                this.controlPoints = [];
                const segments = 5; // More segments for taller flowers
                const segmentHeight = height / segments;
                let currentX = x;
                let currentY = y;

                // Wavy factor based on height
                const variance = 40 * scale;

                for (let i = 0; i < segments; i++) {
                    const nextY = currentY - segmentHeight;
                    // Add some "wind" bias? No, just random wiggle.
                    const nextX = currentX + (Math.random() - 0.5) * variance;
                    const cp1x = currentX + (Math.random() - 0.5) * (variance / 2);
                    const cp1y = currentY - segmentHeight * 0.3;
                    const cp2x = nextX + (Math.random() - 0.5) * (variance / 2);
                    const cp2y = currentY - segmentHeight * 0.7;

                    this.controlPoints.push({ x: cp1x, y: cp1y });
                    this.controlPoints.push({ x: cp2x, y: cp2y });
                    this.points.push({ x: nextX, y: nextY });

                    currentX = nextX;
                    currentY = nextY;
                }
            }

            update() {
                if (this.progress < 1) {
                    this.progress += 0.003 + Math.random() * 0.003; // Slightly slower
                    if (this.progress > 1) this.progress = 1;
                }
            }

            drawByPath(ctx: CanvasRenderingContext2D) {
                ctx.strokeStyle = this.color;
                ctx.lineWidth = this.width;
                ctx.lineCap = 'round';

                ctx.beginPath();
                ctx.moveTo(this.x, this.y);

                const totalSegments = this.points.length - 1;
                const fullSegments = Math.floor(this.progress * totalSegments);

                for (let i = 0; i < fullSegments; i++) {
                    const end = this.points[i + 1];
                    const cp1 = this.controlPoints[i * 2];
                    const cp2 = this.controlPoints[i * 2 + 1];
                    ctx.bezierCurveTo(cp1.x, cp1.y, cp2.x, cp2.y, end.x, end.y);
                }

                // Partial last segment
                if (fullSegments < totalSegments) {
                    const t = (this.progress * totalSegments) - fullSegments;
                    const P0 = this.points[fullSegments];
                    const P3 = this.points[fullSegments + 1];
                    const P1 = this.controlPoints[fullSegments * 2];
                    const P2 = this.controlPoints[fullSegments * 2 + 1];

                    const q0 = { x: (1 - t) * P0.x + t * P1.x, y: (1 - t) * P0.y + t * P1.y };
                    const q1 = { x: (1 - t) * P1.x + t * P2.x, y: (1 - t) * P1.y + t * P2.y };
                    const q2 = { x: (1 - t) * P2.x + t * P3.x, y: (1 - t) * P2.y + t * P3.y };
                    const r0 = { x: (1 - t) * q0.x + t * q1.x, y: (1 - t) * q0.y + t * q1.y };
                    const r1 = { x: (1 - t) * q1.x + t * q2.x, y: (1 - t) * q1.y + t * q2.y };
                    const B = { x: (1 - t) * r0.x + t * r1.x, y: (1 - t) * r0.y + t * r1.y };

                    ctx.bezierCurveTo(q0.x, q0.y, r0.x, r0.y, B.x, B.y);
                }
                ctx.stroke();
            }

            getTip() {
                if (this.points.length == 0) return { x: this.x, y: this.y };
                return this.points[this.points.length - 1];
            }
        }

        class Leaf {
            stem: Stem;
            position: number;
            side: number;
            progress: number;
            angle: number;
            color: string;
            size: number;

            constructor(stem: Stem, position: number, side: number) {
                this.stem = stem;
                this.position = position;
                this.side = side;
                this.progress = 0;
                this.angle = Math.PI / 4 * side + (Math.random() - 0.5) * 0.5;
                this.color = `hsl(${100 + Math.random() * 30}, 60%, ${25 + Math.random() * 10}%)`;
                this.size = (20 + Math.random() * 20) * stem.scale;
            }

            update() {
                if (this.stem.progress > this.position) {
                    this.progress += 0.02;
                    if (this.progress > 1) this.progress = 1;
                }
            }

            draw(ctx: CanvasRenderingContext2D) {
                if (this.progress <= 0) return;

                const totalSegments = this.stem.points.length - 1;
                const segmentIdx = Math.floor(this.position * totalSegments);
                const t = (this.position * totalSegments) - segmentIdx;

                const idx = Math.min(segmentIdx, this.stem.points.length - 2);
                const P0 = this.stem.points[idx];
                const P3 = this.stem.points[idx + 1];
                const P1 = this.stem.controlPoints[idx * 2];
                const P2 = this.stem.controlPoints[idx * 2 + 1];

                const mt = 1 - t;
                const mt2 = mt * mt;
                const t2 = t * t;
                const bx = mt2 * mt * P0.x + 3 * mt2 * t * P1.x + 3 * mt * t2 * P2.x + t2 * t * P3.x;
                const by = mt2 * mt * P0.y + 3 * mt2 * t * P1.y + 3 * mt * t2 * P2.y + t2 * t * P3.y;

                ctx.save();
                ctx.translate(bx, by);
                ctx.rotate(this.angle);

                const currentSize = this.size * this.progress;

                ctx.beginPath();
                ctx.fillStyle = this.color;
                ctx.moveTo(0, 0);
                ctx.bezierCurveTo(currentSize * 0.5, currentSize * -0.2, currentSize, currentSize * 0.5, 0, currentSize);
                ctx.bezierCurveTo(-currentSize, currentSize * 0.5, -currentSize * 0.5, currentSize * -0.2, 0, 0);
                ctx.fill();

                ctx.restore();
            }
        }

        class Bloom {
            x: number;
            y: number;
            stem: Stem;
            progress: number;
            petals: { angle: number, color: string, delay: number, lengthScale: number, widthScale: number }[];
            hue: number;
            size: number;

            constructor(stem: Stem) {
                this.stem = stem;
                this.x = 0;
                this.y = 0;
                this.progress = 0;
                this.size = (70 + Math.random() * 40) * stem.scale; // Bigger blooms depending on scale

                const rand = Math.random();
                if (rand < 0.30) {
                    this.hue = 340 + Math.random() * 20;
                } else if (rand < 0.70) {
                    this.hue = 320 + Math.random() * 30;
                } else {
                    this.hue = 30 + Math.random() * 30;
                }

                this.petals = [];

                // Multiple layers for "quality"
                const layers = 3;
                for (let l = 0; l < layers; l++) {
                    const count = 10 + l * 5;
                    for (let i = 0; i < count; i++) {
                        const angle = (Math.PI * 2 / count) * i + (Math.random() * 0.2);
                        this.petals.push({
                            angle: angle,
                            color: `hsla(${this.hue}, ${70 + Math.random() * 20}%, ${60 + Math.random() * 20 - l * 5}%, ${0.7 + l * 0.1})`,
                            delay: Math.random() * 0.3 + (l * 0.1),
                            lengthScale: 1 - (l * 0.2), // Inner petals shorter
                            widthScale: 0.5 + Math.random() * 0.3
                        });
                    }
                }
            }

            update() {
                if (this.stem.progress >= 0.95) { // Bloom a bit before full stop
                    this.progress += 0.01;
                    if (this.progress > 1) this.progress = 1;

                    const tip = this.stem.getTip();
                    this.x = tip.x;
                    this.y = tip.y;
                }
            }

            draw(ctx: CanvasRenderingContext2D) {
                if (this.stem.progress < 0.95) return;

                ctx.save();
                ctx.translate(this.x, this.y);
                // Gentle sway
                ctx.translate(Math.sin(Date.now() / 1000) * 2, Math.sin(Date.now() / 1300) * 2);

                this.petals.forEach((p) => {
                    let pp = (this.progress - p.delay) * 2;
                    if (pp < 0) pp = 0;
                    if (pp > 1) pp = 1;

                    pp = 1 - Math.pow(1 - pp, 3);

                    if (pp > 0) {
                        ctx.save();
                        ctx.rotate(p.angle);
                        ctx.fillStyle = p.color;

                        ctx.beginPath();
                        ctx.moveTo(0, 0);
                        const l = this.size * p.lengthScale * pp;
                        const w = this.size * p.widthScale * 0.6 * pp;

                        // Ruffled tip
                        ctx.bezierCurveTo(w, l * 0.5, w * 1.5, l, 0, l);
                        ctx.bezierCurveTo(-w * 1.5, l, -w, l * 0.5, 0, 0);

                        ctx.fill();
                        ctx.restore();
                    }
                });

                // Center
                if (this.progress > 0.2) {
                    ctx.beginPath();
                    ctx.arc(0, 0, (this.size * 0.15) * this.progress, 0, Math.PI * 2);
                    ctx.fillStyle = `hsl(${this.hue + 20}, 80%, 30%)`;
                    ctx.fill();
                }

                ctx.restore();
            }
        }

        // Main App Logic
        const entities: { stems: Stem[], leaves: Leaf[], blooms: Bloom[] } = {
            stems: [], leaves: [], blooms: []
        };

        const fireflies: Firefly[] = [];
        for (let i = 0; i < FIREFLY_COUNT; i++) fireflies.push(new Firefly());

        // Spacing cache to prevent overlap
        const occupiedPositions: { x: number, width: number }[] = [];

        const addFlower = (attempt: number = 0) => {
            if (attempt > 20) return; // Give up

            // Random sizing logic
            // 3 tiers: Tall/Big, Med/Med, Short/Small
            const tier = Math.random();
            let h, scale, yBase;

            // Depth-ish effect: Bigger ones lower (closer)
            if (tier < 0.3) {
                // Small/Back
                h = 200 + Math.random() * 150;
                scale = 0.5 + Math.random() * 0.2;
                yBase = canvas.height - 20;
            } else if (tier < 0.7) {
                // Med/Mid
                h = 350 + Math.random() * 200;
                scale = 0.8 + Math.random() * 0.3;
                yBase = canvas.height + 20;
            } else {
                // Large/Front
                h = 500 + Math.random() * 300;
                scale = 1.2 + Math.random() * 0.4;
                yBase = canvas.height + 50;
            }

            const x = Math.random() * canvas.width;

            // Check collision (rough x-axis spacing)
            const separation = 50 * scale;
            for (const pos of occupiedPositions) {
                if (Math.abs(pos.x - x) < (pos.width + separation)) {
                    addFlower(attempt + 1);
                    return;
                }
            }
            occupiedPositions.push({ x, width: 30 * scale });

            const stem = new Stem(x, yBase, h, scale);
            entities.stems.push(stem);

            // Add leaves
            const leafCount = 4 + Math.floor(Math.random() * 5);
            for (let i = 0; i < leafCount; i++) {
                // Start higher up for cleaner look
                const pos = 0.3 + (i / leafCount) * 0.6;
                entities.leaves.push(new Leaf(stem, pos, i % 2 == 0 ? 1 : -1));
            }

            entities.blooms.push(new Bloom(stem));
        };

        const resizeCanvas = () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
            // Reset and Regenerate on resize for better layout? 
            // Or just let them be. Let's clear on massive resize for simplicity or user can refresh.
        };
        window.addEventListener('resize', resizeCanvas);
        resizeCanvas();

        // Populate
        // Attempt to fill screen width
        // Brute force fill
        const fillGarden = () => {
            // Sort by scale visually? We are just pushing them, drawing order dictates depth.
            // We interactively add them.
            // Let's create a lot of attempts.
            for (let i = 0; i < 100; i++) {
                addFlower();
            }

            // Sort entities by scale so smaller (back) draw first?
            // stems array has mix. We need to sort ALL entities for true z-index but they are separate arrays.
            // Simplified: Sort stems by 'scale' (approx depth) and draw in that order.
            // But we loop per type. 
            // Actually, we should allow them to just mix.
        };

        fillGarden();

        const render = () => {
            const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
            grad.addColorStop(0, '#020014');
            grad.addColorStop(1, '#1a0b2e');

            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Fireflies moved to end

            // Render order: Smallest scale first (furthest back)
            // This requires combining everything or sorting indices.
            // Let's just group stems/blooms/leaves by flower index and sort THAT.

            // We can create a "Renderable" list
            const renderables = entities.stems.map((stem, i) => ({
                stem,
                leaves: entities.leaves.filter(l => l.stem === stem),
                bloom: entities.blooms.find(b => b.stem === stem),
                z: stem.scale // Sort key
            }));

            renderables.sort((a, b) => a.z - b.z);

            renderables.forEach(r => {
                r.stem.update();
                r.stem.drawByPath(ctx);

                r.leaves.forEach(l => { l.update(); l.draw(ctx); });

                if (r.bloom) {
                    r.bloom.update();
                    r.bloom.draw(ctx);
                }
            });

            // Fireflies on top
            fireflies.forEach(f => { f.update(); f.draw(ctx); });

            animationFrameId = requestAnimationFrame(render);
        };

        render();

        return () => {
            window.removeEventListener('resize', resizeCanvas);
            cancelAnimationFrame(animationFrameId);
        };
    }, []);

    return (
        <div style={{ width: '100vw', height: '100vh', overflow: 'hidden' }}>
            <canvas ref={canvasRef} style={{ display: 'block' }} />
        </div>
    );
}
