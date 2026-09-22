import { useEffect, useRef } from "react"

const TAU = Math.PI * 2

export default function KineticGrid({ children, className = "" }) {
  const canvasRef = useRef(null)
  const pointerRef = useRef({ x: 0, y: 0, active: false })
  const ripplesRef = useRef([])

  useEffect(() => {
    const canvas = canvasRef.current
    const host = canvas?.parentElement
    if (!canvas || !host) return undefined
    const context = canvas.getContext("2d")
    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)")
    let frame
    let width = 0
    let height = 0
    let dpr = 1

    function resize() {
      const bounds = host.getBoundingClientRect()
      width = Math.max(1, bounds.width)
      height = Math.max(1, bounds.height)
      dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(height * dpr)
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      context.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    function setPointer(event) {
      const bounds = host.getBoundingClientRect()
      pointerRef.current = { x: event.clientX - bounds.left, y: event.clientY - bounds.top, active: true }
    }

    function addRipple(event) {
      setPointer(event)
      const { x, y } = pointerRef.current
      ripplesRef.current = [...ripplesRef.current.slice(-3), { x, y, started: performance.now() }]
    }

    function clearPointer() {
      pointerRef.current.active = false
    }

    function draw(now) {
      const pointer = pointerRef.current
      const ripples = ripplesRef.current
      context.clearRect(0, 0, width, height)
      context.lineWidth = 1
      const gap = Math.max(28, Math.min(42, width / 27))
      const offsetX = (width % gap) / 2
      const offsetY = (height % gap) / 2
      const rows = Math.ceil(height / gap) + 1
      const columns = Math.ceil(width / gap) + 1

      for (let row = -1; row < rows; row += 1) {
        for (let column = -1; column < columns; column += 1) {
          const baseX = offsetX + column * gap
          const baseY = offsetY + row * gap
          const dx = baseX - pointer.x
          const dy = baseY - pointer.y
          const distance = Math.sqrt(dx * dx + dy * dy)
          const pull = pointer.active && !motionQuery.matches ? Math.max(0, 1 - distance / 260) ** 2 : 0
          let x = baseX - dx * pull * 0.18
          let y = baseY - dy * pull * 0.18
          let glow = pull

          for (const ripple of ripples) {
            const age = (now - ripple.started) / 1000
            const radius = age * 260
            if (age >= 0 && age < 1.15) {
              const rippleDx = x - ripple.x
              const rippleDy = y - ripple.y
              const rippleDistance = Math.sqrt(rippleDx * rippleDx + rippleDy * rippleDy)
              const wave = Math.max(0, 1 - Math.abs(rippleDistance - radius) / 42) * (1 - age / 1.15)
              x += rippleDx * wave * 0.1
              y += rippleDy * wave * 0.1
              glow = Math.max(glow, wave)
            }
          }

          const alpha = 0.15 + glow * 0.75
          context.fillStyle = `rgba(215, 250, 107, ${alpha})`
          context.beginPath()
          context.arc(x, y, 1.15 + glow * 2.5, 0, TAU)
          context.fill()

          if (column < columns - 1) {
            context.strokeStyle = `rgba(116, 213, 216, ${0.045 + glow * 0.15})`
            context.beginPath()
            context.moveTo(x, y)
            context.lineTo(offsetX + (column + 1) * gap, baseY)
            context.stroke()
          }
        }
      }

      ripplesRef.current = ripples.filter((ripple) => now - ripple.started < 1200)
      frame = window.requestAnimationFrame(draw)
    }

    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(host)
    host.addEventListener("pointermove", setPointer)
    host.addEventListener("pointerdown", addRipple)
    host.addEventListener("pointerleave", clearPointer)
    frame = window.requestAnimationFrame(draw)

    return () => {
      window.cancelAnimationFrame(frame)
      observer.disconnect()
      host.removeEventListener("pointermove", setPointer)
      host.removeEventListener("pointerdown", addRipple)
      host.removeEventListener("pointerleave", clearPointer)
    }
  }, [])

  return <div className={`kinetic-grid ${className}`}><canvas aria-hidden="true" ref={canvasRef} />{children}</div>
}
