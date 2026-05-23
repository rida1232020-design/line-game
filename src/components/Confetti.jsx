import { useEffect, useRef } from "react";

// Confetti particle system using Canvas
export default function Confetti({ active }) {
  const canvasRef = useRef(null);
  const animRef   = useRef(null);
  const particles = useRef([]);

  useEffect(() => {
    if (!active) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    const W = canvas.width  = window.innerWidth;
    const H = canvas.height = window.innerHeight;

    const COLORS = [
      "#ffd700", "#ff6b6b", "#4ecdc4", "#45b7d1",
      "#96ceb4", "#ffeaa7", "#dfe6e9", "#fd79a8",
      "#6c5ce7", "#00b894",
    ];

    // Spawn particles
    for (let i = 0; i < 160; i++) {
      particles.current.push({
        x:    Math.random() * W,
        y:    -10 - Math.random() * 200,
        w:    6  + Math.random() * 8,
        h:    4  + Math.random() * 6,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        vx:   (Math.random() - 0.5) * 3,
        vy:   2  + Math.random() * 4,
        rot:  Math.random() * 360,
        rotV: (Math.random() - 0.5) * 8,
        alpha: 1,
      });
    }

    function draw() {
      ctx.clearRect(0, 0, W, H);
      particles.current = particles.current.filter(p => p.alpha > 0.02);
      particles.current.forEach(p => {
        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rot * Math.PI) / 180);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();

        p.x   += p.vx;
        p.y   += p.vy;
        p.rot += p.rotV;
        p.vy  += 0.08; // gravity
        if (p.y > H * 0.85) p.alpha -= 0.03;
      });
      if (particles.current.length > 0) {
        animRef.current = requestAnimationFrame(draw);
      }
    }

    animRef.current = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(animRef.current);
      particles.current = [];
    };
  }, [active]);

  if (!active) return null;
  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "fixed",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: 9999,
      }}
    />
  );
}
