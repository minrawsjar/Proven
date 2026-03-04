import { useEffect, useRef } from 'react'

interface Node3D {
  x: number; y: number; z: number
  px: number; py: number
  size: number
}

export function NetworkSphere({ className = '' }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animationId: number
    let angle = 0
    const nodeCount = 80
    const connectionDistance = 0.55
    const nodes: Node3D[] = []

    const resize = () => {
      const dpr = window.devicePixelRatio || 1
      const rect = canvas.getBoundingClientRect()
      canvas.width = rect.width * dpr
      canvas.height = rect.height * dpr
      ctx.scale(dpr, dpr)
    }

    // Distribute nodes on a sphere using fibonacci spiral
    for (let i = 0; i < nodeCount; i++) {
      const goldenRatio = (1 + Math.sqrt(5)) / 2
      const theta = (2 * Math.PI * i) / goldenRatio
      const phi = Math.acos(1 - (2 * (i + 0.5)) / nodeCount)

      nodes.push({
        x: Math.sin(phi) * Math.cos(theta),
        y: Math.sin(phi) * Math.sin(theta),
        z: Math.cos(phi),
        px: 0,
        py: 0,
        size: Math.random() * 1.5 + 1,
      })
    }

    const project = (node: Node3D, cx: number, cy: number, radius: number) => {
      // Rotate around Y axis
      const cosA = Math.cos(angle)
      const sinA = Math.sin(angle)
      const rx = node.x * cosA - node.z * sinA
      const rz = node.x * sinA + node.z * cosA

      // Slight tilt around X
      const cosB = Math.cos(0.3)
      const sinB = Math.sin(0.3)
      const ry = node.y * cosB - rz * sinB
      const rz2 = node.y * sinB + rz * cosB

      const scale = 1 / (1 - rz2 * 0.3)
      node.px = cx + rx * radius * scale
      node.py = cy + ry * radius * scale

      return { depth: rz2, scale }
    }

    const draw = () => {
      const rect = canvas.getBoundingClientRect()
      const w = rect.width
      const h = rect.height
      ctx.clearRect(0, 0, w, h)

      const cx = w / 2
      const cy = h / 2
      const radius = Math.min(w, h) * 0.38

      // Project all nodes
      const projected = nodes.map((node) => ({
        node,
        ...project(node, cx, cy, radius),
      }))

      // Sort by depth for correct rendering
      projected.sort((a, b) => a.depth - b.depth)

      // Draw connections
      for (let i = 0; i < projected.length; i++) {
        for (let j = i + 1; j < projected.length; j++) {
          const a = projected[i]
          const b = projected[j]
          const dx = a.node.x - b.node.x
          const dy = a.node.y - b.node.y
          const dz = a.node.z - b.node.z
          const dist = Math.sqrt(dx * dx + dy * dy + dz * dz)

          if (dist < connectionDistance) {
            const avgDepth = (a.depth + b.depth) / 2
            const alpha = (1 - dist / connectionDistance) * (0.08 + avgDepth * 0.06)
            if (alpha > 0.01) {
              ctx.strokeStyle = `rgba(0, 230, 118, ${Math.min(alpha, 0.15)})`
              ctx.lineWidth = 0.6
              ctx.beginPath()
              ctx.moveTo(a.node.px, a.node.py)
              ctx.lineTo(b.node.px, b.node.py)
              ctx.stroke()
            }
          }
        }
      }

      // Draw nodes
      for (const { node, depth, scale } of projected) {
        const alpha = 0.15 + (depth + 1) * 0.35
        const size = node.size * scale

        // Glow for front-facing nodes
        if (depth > 0.2) {
          ctx.beginPath()
          ctx.arc(node.px, node.py, size * 3, 0, Math.PI * 2)
          ctx.fillStyle = `rgba(0, 230, 118, ${alpha * 0.08})`
          ctx.fill()
        }

        ctx.beginPath()
        ctx.arc(node.px, node.py, size, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(0, 230, 118, ${Math.min(alpha, 0.85)})`
        ctx.fill()
      }

      // Central glow
      const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius * 0.8)
      gradient.addColorStop(0, 'rgba(0, 230, 118, 0.03)')
      gradient.addColorStop(0.5, 'rgba(0, 230, 118, 0.01)')
      gradient.addColorStop(1, 'rgba(0, 230, 118, 0)')
      ctx.fillStyle = gradient
      ctx.fillRect(0, 0, w, h)

      angle += 0.003
      animationId = requestAnimationFrame(draw)
    }

    resize()
    draw()
    window.addEventListener('resize', resize)

    return () => {
      cancelAnimationFrame(animationId)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className={`w-full h-full ${className}`}
      style={{ aspectRatio: '1', filter: 'drop-shadow(0 0 40px rgba(0, 230, 118, 0.3))' }}
    />
  )
}
