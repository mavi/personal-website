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
        const FLOWER_COUNT = 15;
        const FIREFLY_COUNT = 30;

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
                this.vx = (Math.random() - 0.5) * 0.5;
                this.vy = (Math.random() - 0.5) * 0.5;
                this.size = Math.random() * 2;
                this.alpha = Math.random();
                this.t = Math.random() * 100;
            }

            update() {
                this.x += this.vx;
                this.y += this.vy;
                this.t += 0.05;
                this.alpha = 0.5 + Math.sin(this.t) * 0.5;

                if (this.x < 0) this.x = canvas!.width;
                else if (this.x > canvas!.width) this.x = 0;
                if (this.y < 0) this.y = canvas!.height;
                else if (this.y > canvas!.height) this.y = 0;
            }

            draw(ctx: CanvasRenderingContext2D) {
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(255, 255, 200, ${this.alpha})`;
                ctx.shadowBlur = 10;
                ctx.shadowColor = 'rgba(255, 255, 200, 0.8)';
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

            constructor(x: number, y: number, height: number) {
                this.x = x;
                this.y = y;
                this.height = height;
                this.progress = 0;
                this.width = 2 + Math.random() * 3;
                this.color = `hsl(${100 + Math.random() * 40}, 40%, ${20 + Math.random() * 10}%)`; // Dark green

                // Generate a wavy path
                this.points = [{ x, y }];
                this.controlPoints = [];
                const segments = 4;
                const segmentHeight = height / segments;
                let currentX = x;
                let currentY = y;

                for (let i = 0; i < segments; i++) {
                    const nextY = currentY - segmentHeight;
                    const nextX = currentX + (Math.random() - 0.5) * 60;
                    const cp1x = currentX + (Math.random() - 0.5) * 30;
                    const cp1y = currentY - segmentHeight * 0.3;
                    const cp2x = nextX + (Math.random() - 0.5) * 30;
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
                    this.progress += 0.005 + Math.random() * 0.005;
                    if (this.progress > 1) this.progress = 1;
                }
            }

            draw(ctx: CanvasRenderingContext2D) {
                ctx.beginPath();
                ctx.moveTo(this.x, this.y);
                ctx.strokeStyle = this.color;
                ctx.lineWidth = this.width;
                ctx.lineCap = 'round';

                // Draw up to progress
                // Simplification: Draw almost full curve but use mask or dash offset? 
                // Better: Interpolate points?
                // Easiest "growing" look: setLineDash.

                // Re-trace full path to calculate length (expensive per frame but accurate)
                // Or just clipping region. Let's use clipping region approach or progressive drawing.
                // Actually, for "organic" growth, we want the tip to move.

                // Complex bezier interpolation is hard. Let's use simple logic:
                // Just draw segments based on progress.

                const totalSegments = this.points.length - 1;
                const currentSegmentFloat = this.progress * totalSegments;
                const currentSegmentIndex = Math.floor(currentSegmentFloat);
                const segmentProgress = currentSegmentFloat - currentSegmentIndex;

                for (let i = 0; i < currentSegmentIndex; i++) {
                    const start = this.points[i];
                    const end = this.points[i + 1];
                    const cp1 = this.controlPoints[i * 2];
                    const cp2 = this.controlPoints[i * 2 + 1];
                    ctx.bezierCurveTo(cp1.x, cp1.y, cp2.x, cp2.y, end.x, end.y);
                }

                if (currentSegmentIndex < totalSegments) {
                    const start = this.points[currentSegmentIndex];
                    const end = this.points[currentSegmentIndex + 1];
                    const cp1 = this.controlPoints[currentSegmentIndex * 2];
                    const cp2 = this.controlPoints[currentSegmentIndex * 2 + 1];

                    // Interpolate cubic bezier
                    // This is tricky without a library, but let's approximate by moving the 'end' point linearly?
                    // No, that straightens curves.
                    // Correct way: split bezier. Too much math for this snippet.
                    // Hack: just draw the sub-curve with `setLineDash`?

                    // Let's use the full path but trace it with dashoffset! 
                }
                ctx.stroke();
            }

            // Simpler Draw method using dash offset trick for the WHOLE path
            drawByPath(ctx: CanvasRenderingContext2D) {
                // Build path
                const path = new Path2D();
                path.moveTo(this.x, this.y);
                for (let i = 0; i < this.points.length - 1; i++) {
                    const end = this.points[i + 1];
                    const cp1 = this.controlPoints[i * 2];
                    const cp2 = this.controlPoints[i * 2 + 1];
                    path.bezierCurveTo(cp1.x, cp1.y, cp2.x, cp2.y, end.x, end.y);
                }

                ctx.strokeStyle = this.color;
                ctx.lineWidth = this.width;
                ctx.lineCap = 'round';

                // To animate "drawing", we can't easily measure path length in standard Canvas API without SVG.
                // Workaround: Draw full path, mask with a "growing" rectangle (boring).
                // Workaround 2: Calculate points manually (better).

                // Let's use the segment logic again, it's roughly correct.
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
                    // We simply stop drawing at the intermediate point.
                    // For true "drawing", obtaining the t-point on a bezier is:
                    // B(t) = (1-t)^3 P0 + 3(1-t)^2 t P1 + 3(1-t) t^2 P2 + t^3 P3
                    const t = (this.progress * totalSegments) - fullSegments;
                    const P0 = this.points[fullSegments];
                    const P3 = this.points[fullSegments + 1];
                    const P1 = this.controlPoints[fullSegments * 2];
                    const P2 = this.controlPoints[fullSegments * 2 + 1];

                    // Calculate split point (De Casteljau's algorithm visually approximated)
                    // Or just draw to the point B(t).
                    // Drawing a SUB-Curve correctly requires splitting logic.
                    // Let's implement calculateBezierPoint to find the 'end' tip, and draw a straight line to it? No, looks bad.
                    // Let's try splitting!

                    const q0 = { x: (1 - t) * P0.x + t * P1.x, y: (1 - t) * P0.y + t * P1.y };
                    const q1 = { x: (1 - t) * P1.x + t * P2.x, y: (1 - t) * P1.y + t * P2.y };
                    const q2 = { x: (1 - t) * P2.x + t * P3.x, y: (1 - t) * P2.y + t * P3.y };
                    const r0 = { x: (1 - t) * q0.x + t * q1.x, y: (1 - t) * q0.y + t * q1.y };
                    const r1 = { x: (1 - t) * q1.x + t * q2.x, y: (1 - t) * q1.y + t * q2.y };
                    const B = { x: (1 - t) * r0.x + t * r1.x, y: (1 - t) * r0.y + t * r1.y }; // The point at t

                    // Draw the partial curve
                    ctx.bezierCurveTo(q0.x, q0.y, r0.x, r0.y, B.x, B.y);
                }

                ctx.stroke();

                // Return the tip position for leaves/flowers
                if (this.progress >= 1) {
                    return this.points[this.points.length - 1];
                } else {
                    // return B(t) logic if needed, but for now only attach when done or use rough estimation
                    return null;
                }
            }

            getTip() {
                if (this.points.length == 0) return { x: this.x, y: this.y };
                return this.points[this.points.length - 1];
            }
        }

        class Leaf {
            stem: Stem;
            position: number; // 0 to 1 along stem
            side: number; // -1 or 1
            progress: number;
            angle: number;
            color: string;

            constructor(stem: Stem, position: number, side: number) {
                this.stem = stem;
                this.position = position;
                this.side = side;
                this.progress = 0;
                this.angle = Math.PI / 4 * side + (Math.random() - 0.5) * 0.5;
                this.color = `hsl(${100 + Math.random() * 30}, 50%, 30%)`;
            }

            update() {
                if (this.stem.progress > this.position) {
                    this.progress += 0.02;
                    if (this.progress > 1) this.progress = 1;
                }
            }

            draw(ctx: CanvasRenderingContext2D) {
                if (this.progress <= 0) return;

                // Rough estimation of position on stem
                // We need the point at 'position' on the stem.
                // Simplified: Just lerp between the segment points.
                const totalSegments = this.stem.points.length - 1;
                const segmentIdx = Math.floor(this.position * totalSegments);
                const t = (this.position * totalSegments) - segmentIdx;

                // Get point (approx linear is fine for attachment, or reuse bezier logic)
                // Let's reuse bezier precise point for quality
                const idx = Math.min(segmentIdx, this.stem.points.length - 2);
                const P0 = this.stem.points[idx];
                const P3 = this.stem.points[idx + 1];
                const P1 = this.stem.controlPoints[idx * 2];
                const P2 = this.stem.controlPoints[idx * 2 + 1];

                // Cubic bezier formula
                const mt = 1 - t;
                const mt2 = mt * mt;
                const t2 = t * t;
                const bx = mt2 * mt * P0.x + 3 * mt2 * t * P1.x + 3 * mt * t2 * P2.x + t2 * t * P3.x;
                const by = mt2 * mt * P0.y + 3 * mt2 * t * P1.y + 3 * mt * t2 * P2.y + t2 * t * P3.y;

                ctx.save();
                ctx.translate(bx, by);
                ctx.rotate(this.angle); // Rotate to leaf direction

                const size = 30 * this.progress;

                ctx.beginPath();
                ctx.fillStyle = this.color;
                ctx.moveTo(0, 0);
                ctx.bezierCurveTo(size * 0.5, size * -0.2, size, size * 0.5, 0, size);
                ctx.bezierCurveTo(-size, size * 0.5, -size * 0.5, size * -0.2, 0, 0);
                ctx.fill();

                ctx.restore();
            }
        }

        class Bloom {
            x: number;
            y: number;
            stem: Stem;
            progress: number;
            petals: { angle: number, color: string, delay: number }[];
            hue: number;

            constructor(stem: Stem) {
                this.stem = stem;
                this.x = 0;
                this.y = 0;
                this.progress = 0;

                // Romantic colors
                const rand = Math.random();
                if (rand < 0.30) {
                    this.hue = 340 + Math.random() * 20;
                } else if (rand < 0.70) {
                    this.hue = 320 + Math.random() * 30;
                } else {
                    this.hue = 30 + Math.random() * 30;
                }

                this.petals = [];
                const count = 15;
                for (let i = 0; i < count; i++) {
                    this.petals.push({
                        angle: (Math.PI * 2 / count) * i,
                        color: `hsla(${this.hue}, ${70 + Math.random() * 20}%, ${60 + Math.random() * 20}%, 0.8)`,
                        delay: Math.random() * 0.5
                    });
                }
            }

            update() {
                if (this.stem.progress >= 1) {
                    this.progress += 0.01;
                    if (this.progress > 1) this.progress = 1;

                    const tip = this.stem.getTip();
                    this.x = tip.x;
                    this.y = tip.y;
                }
            }

            draw(ctx: CanvasRenderingContext2D) {
                if (this.stem.progress < 1) return;

                ctx.save();
                ctx.translate(this.x, this.y);
                // Bobbing effect
                ctx.translate(0, Math.sin(Date.now() / 500) * 2);

                const baseSize = 40;
                this.petals.forEach((p, i) => {
                    // Individual petal progress
                    let pp = (this.progress - p.delay) * 2;
                    if (pp < 0) pp = 0;
                    if (pp > 1) pp = 1;

                    // Ease out elastic or back for "unfolding" snap?
                    // Smooth ease out
                    pp = 1 - Math.pow(1 - pp, 3);

                    if (pp > 0) {
                        ctx.save();
                        ctx.rotate(p.angle);
                        ctx.fillStyle = p.color;

                        ctx.beginPath();
                        ctx.moveTo(0, 0);
                        // Unfold by growing length and width
                        const l = baseSize * pp;
                        const w = baseSize * 0.6 * pp;

                        ctx.bezierCurveTo(w, l * 0.5, w * 0.5, l, 0, l);
                        ctx.bezierCurveTo(-w * 0.5, l, -w, l * 0.5, 0, 0);

                        ctx.fill();
                        ctx.restore();
                    }
                });

                // Center
                if (this.progress > 0.2) {
                    ctx.beginPath();
                    ctx.arc(0, 0, 5 * this.progress, 0, Math.PI * 2);
                    ctx.fillStyle = '#ffeba7';
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

        const addFlower = () => {
            const x = 100 + Math.random() * (canvas.width - 200);
            const y = canvas.height + 20; // Start below screen
            const h = 300 + Math.random() * 400; // Tall stems

            const stem = new Stem(x, y, h);
            entities.stems.push(stem);

            // Add leaves
            const leafCount = 3 + Math.floor(Math.random() * 4);
            for (let i = 0; i < leafCount; i++) {
                entities.leaves.push(new Leaf(stem, 0.2 + (i / leafCount) * 0.6, i % 2 == 0 ? 1 : -1));
            }

            // Add bloom
            entities.blooms.push(new Bloom(stem));
        };

        // Initial flowers
        for (let i = 0; i < 5; i++) setTimeout(addFlower, i * 1000);

        const resizeCanvas = () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        };
        window.addEventListener('resize', resizeCanvas);
        resizeCanvas();

        const render = () => {
            // Gradient Background for "Night Garden"
            const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
            grad.addColorStop(0, '#020014'); // Deep midnight
            grad.addColorStop(1, '#09092b'); // Dark blue-purple at bottom

            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Fireflies
            fireflies.forEach(f => { f.update(); f.draw(ctx); });

            // Stems
            entities.stems.forEach(s => { s.update(); s.drawByPath(ctx); });

            // Leaves
            entities.leaves.forEach(l => { l.update(); l.draw(ctx); });

            // Blooms
            entities.blooms.forEach(b => { b.update(); b.draw(ctx); });

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
