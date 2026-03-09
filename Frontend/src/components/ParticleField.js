import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useRef } from 'react';
export function ParticleField() {
    const canvasRef = useRef(null);
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas)
            return;
        const ctx = canvas.getContext('2d');
        if (!ctx)
            return;
        let animationId;
        let particles = [];
        const resize = () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        };
        const init = () => {
            resize();
            particles = [];
            const count = Math.min(60, Math.floor((canvas.width * canvas.height) / 20000));
            for (let i = 0; i < count; i++) {
                particles.push({
                    x: Math.random() * canvas.width,
                    y: Math.random() * canvas.height,
                    vx: (Math.random() - 0.5) * 0.2,
                    vy: (Math.random() - 0.5) * 0.2,
                    size: Math.random() * 1.2 + 0.3,
                    opacity: Math.random() * 0.2 + 0.03,
                });
            }
        };
        const draw = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            for (let i = 0; i < particles.length; i++) {
                for (let j = i + 1; j < particles.length; j++) {
                    const dx = particles[i].x - particles[j].x;
                    const dy = particles[i].y - particles[j].y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < 140) {
                        const alpha = (1 - dist / 140) * 0.04;
                        ctx.strokeStyle = `rgba(0, 230, 118, ${alpha})`;
                        ctx.lineWidth = 0.5;
                        ctx.beginPath();
                        ctx.moveTo(particles[i].x, particles[i].y);
                        ctx.lineTo(particles[j].x, particles[j].y);
                        ctx.stroke();
                    }
                }
            }
            for (const p of particles) {
                p.x += p.vx;
                p.y += p.vy;
                if (p.x < 0)
                    p.x = canvas.width;
                if (p.x > canvas.width)
                    p.x = 0;
                if (p.y < 0)
                    p.y = canvas.height;
                if (p.y > canvas.height)
                    p.y = 0;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(0, 230, 118, ${p.opacity})`;
                ctx.fill();
            }
            animationId = requestAnimationFrame(draw);
        };
        init();
        draw();
        window.addEventListener('resize', resize);
        return () => {
            cancelAnimationFrame(animationId);
            window.removeEventListener('resize', resize);
        };
    }, []);
    return (_jsx("canvas", { ref: canvasRef, className: "fixed inset-0 pointer-events-none z-0", style: { opacity: 0.5 } }));
}
export function GridBackground() {
    return (_jsxs("div", { className: "fixed inset-0 pointer-events-none z-0", children: [_jsx("div", { className: "absolute inset-0 bg-grid animate-grid-fade" }), _jsx("div", { className: "absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-gradient-radial from-brand/[0.04] via-transparent to-transparent" }), _jsx("div", { className: "absolute bottom-0 right-0 w-[500px] h-[400px] bg-gradient-radial from-brand/[0.03] via-transparent to-transparent" })] }));
}
