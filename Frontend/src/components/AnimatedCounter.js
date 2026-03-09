import { jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState, useRef } from 'react';
export function AnimatedCounter({ end, duration = 2000, prefix = '', suffix = '', decimals = 0, className = '', }) {
    const [current, setCurrent] = useState(0);
    const [hasAnimated, setHasAnimated] = useState(false);
    const ref = useRef(null);
    useEffect(() => {
        const observer = new IntersectionObserver(([entry]) => {
            if (entry.isIntersecting && !hasAnimated) {
                setHasAnimated(true);
                const startTime = Date.now();
                const animate = () => {
                    const elapsed = Date.now() - startTime;
                    const progress = Math.min(elapsed / duration, 1);
                    // Ease out cubic
                    const eased = 1 - Math.pow(1 - progress, 3);
                    setCurrent(eased * end);
                    if (progress < 1)
                        requestAnimationFrame(animate);
                };
                requestAnimationFrame(animate);
            }
        }, { threshold: 0.3 });
        if (ref.current)
            observer.observe(ref.current);
        return () => observer.disconnect();
    }, [end, duration, hasAnimated]);
    const formatted = current.toLocaleString('en-US', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
    });
    return (_jsxs("span", { ref: ref, className: `stat-number ${className}`, children: [prefix, formatted, suffix] }));
}
