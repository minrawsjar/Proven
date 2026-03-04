import { motion } from 'framer-motion'
import { useEffect, useState, useRef } from 'react'
import { Check } from 'lucide-react'

interface SplashScreenProps {
  onComplete: () => void
}

export function SplashScreen({ onComplete }: SplashScreenProps) {
  const [phase, setPhase] = useState<'enter' | 'shine' | 'exit'>('enter')
  const onCompleteRef = useRef(onComplete)

  useEffect(() => {
    onCompleteRef.current = onComplete
  }, [onComplete])

  useEffect(() => {
    let isMounted = true

    const shineTimer = setTimeout(() => {
      if (isMounted) setPhase('shine')
    }, 1800)

    const exitTimer = setTimeout(() => {
      if (isMounted) setPhase('exit')
    }, 3200)

    const completeTimer = setTimeout(() => {
      if (isMounted) onCompleteRef.current()
    }, 4000)

    return () => {
      isMounted = false
      clearTimeout(shineTimer)
      clearTimeout(exitTimer)
      clearTimeout(completeTimer)
    }
  }, [])

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden"
      style={{
        background: 'radial-gradient(ellipse at center, #0a1f12 0%, #030B06 70%)',
      }}
      initial={{ opacity: 1 }}
      animate={{ opacity: phase === 'exit' ? 0 : 1 }}
      transition={{ duration: 0.8 }}
    >
      {/* Animated background particles */}
      <div className="absolute inset-0 overflow-hidden">
        {[...Array(30)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 bg-[#00E676] rounded-full"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
            }}
            initial={{ opacity: 0, scale: 0 }}
            animate={{
              opacity: phase === 'exit' ? 0 : [0, 0.6, 0],
              scale: [0, 1, 0],
            }}
            transition={{
              duration: 3,
              delay: Math.random() * 2,
              repeat: Infinity,
              repeatDelay: Math.random() * 2,
            }}
          />
        ))}
      </div>

      {/* Expanding ring effect */}
      <motion.div
        className="absolute inset-0 flex items-center justify-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: phase === 'exit' ? 0 : 1 }}
      >
        {[...Array(3)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute border border-[#00E676] rounded-full"
            initial={{ width: 0, height: 0, opacity: 0 }}
            animate={{
              width: [0, 800],
              height: [0, 800],
              opacity: [0, 0.3, 0],
            }}
            transition={{
              duration: 2.5,
              delay: i * 0.4,
              ease: 'easeOut',
            }}
          />
        ))}
      </motion.div>

      {/* Main content container */}
      <div className="relative z-10 flex items-center gap-4">
        {/* "Proven" text */}
        <motion.div
          className="relative"
          initial={{ opacity: 0, x: -50 }}
          animate={{
            opacity: phase === 'exit' ? 0 : 1,
            x: phase === 'exit' ? -100 : 0,
            scale: phase === 'shine' ? [1, 1.05, 1] : 1,
          }}
          transition={{
            opacity: { duration: 0.8 },
            x: { duration: 0.8, ease: 'easeOut' },
            scale: { duration: 0.6 },
          }}
        >
          <h1
            className="font-bold tracking-tight relative"
            style={{
              fontSize: 'clamp(4rem, 15vw, 10rem)',
              fontFamily: 'Inter, sans-serif',
              background: 'linear-gradient(135deg, #00E676 0%, #00C853 50%, #00E676 100%)',
              backgroundSize: '200% 100%',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            <motion.span
              animate={
                phase === 'shine'
                  ? { backgroundPosition: ['0% 0%', '200% 0%'] }
                  : {}
              }
              transition={{ duration: 1.2, ease: 'easeInOut' }}
              style={{
                background:
                  'linear-gradient(135deg, #00E676 0%, #69F0AE 25%, #00E676 50%, #69F0AE 75%, #00E676 100%)',
                backgroundSize: '200% 100%',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                display: 'inline-block',
              }}
            >
              Proven
            </motion.span>
          </h1>

          {/* Glow effect under text */}
          <motion.div
            className="absolute inset-0 blur-2xl"
            style={{
              background: 'radial-gradient(ellipse at center, #00E676 0%, transparent 70%)',
            }}
            initial={{ opacity: 0 }}
            animate={{
              opacity: phase === 'exit' ? 0 : [0, 0.4, 0.6, 0.4],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              repeatType: 'reverse',
            }}
          />
        </motion.div>

        {/* Checkmark icon */}
        <motion.div
          className="relative flex items-center justify-center"
          initial={{ opacity: 0, scale: 0, rotate: -180 }}
          animate={{
            opacity: phase === 'exit' ? 0 : 1,
            scale: phase === 'exit' ? 0 : 1,
            rotate: phase === 'exit' ? 180 : 0,
            y: phase === 'shine' ? [0, -10, 0] : 0,
          }}
          transition={{
            opacity: { duration: 0.8, delay: 0.4 },
            scale: { duration: 0.8, delay: 0.4, ease: 'backOut' },
            rotate: { duration: 0.8, delay: 0.4 },
            y: { duration: 0.6 },
          }}
        >
          {/* Checkmark background glow */}
          <motion.div
            className="absolute rounded-full bg-[#00E676] blur-xl"
            style={{
              width: 'clamp(4rem, 12vw, 8rem)',
              height: 'clamp(4rem, 12vw, 8rem)',
            }}
            animate={{
              opacity: [0.3, 0.6, 0.3],
              scale: [1, 1.2, 1],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              repeatType: 'reverse',
            }}
          />

          {/* Checkmark circle container */}
          <motion.div
            className="relative rounded-full border-4 border-[#00E676] flex items-center justify-center"
            style={{
              width: 'clamp(5rem, 15vw, 10rem)',
              height: 'clamp(5rem, 15vw, 10rem)',
              background: 'rgba(0, 230, 118, 0.1)',
              boxShadow:
                '0 0 40px rgba(0, 230, 118, 0.4), inset 0 0 40px rgba(0, 230, 118, 0.1)',
            }}
            animate={
              phase === 'shine'
                ? { borderColor: ['#00E676', '#69F0AE', '#00E676'] }
                : {}
            }
            transition={{ duration: 1.2 }}
          >
            <Check
              className="text-[#00E676]"
              style={{
                width: 'clamp(2.5rem, 8vw, 5rem)',
                height: 'clamp(2.5rem, 8vw, 5rem)',
                strokeWidth: 3,
              }}
            />
          </motion.div>

          {/* Spinning ring around checkmark */}
          <motion.div
            className="absolute rounded-full border-2 border-transparent"
            style={{
              width: 'clamp(6rem, 18vw, 12rem)',
              height: 'clamp(6rem, 18vw, 12rem)',
              borderTopColor: '#00E676',
              borderRightColor: '#00E676',
            }}
            animate={{
              rotate: 360,
              opacity: phase === 'exit' ? 0 : [0.5, 1, 0.5],
            }}
            transition={{
              rotate: {
                duration: 3,
                repeat: Infinity,
                ease: 'linear',
              },
              opacity: {
                duration: 2,
                repeat: Infinity,
                repeatType: 'reverse',
              },
            }}
          />
        </motion.div>
      </div>

      {/* Bottom tagline */}
      <motion.div
        className="absolute bottom-24 left-0 right-0 text-center"
        initial={{ opacity: 0, y: 20 }}
        animate={{
          opacity: phase === 'exit' ? 0 : [0, 1, 1, 0.8],
          y: phase === 'exit' ? 40 : 0,
        }}
        transition={{
          duration: 1,
          delay: 1.2,
        }}
      >
        <p
          className="text-[#00E676] tracking-widest font-mono"
          style={{
            fontSize: 'clamp(0.75rem, 2vw, 1rem)',
            textShadow: '0 0 20px rgba(0, 230, 118, 0.5)',
          }}
        >
          SECURING DEFI, ONE MILESTONE AT A TIME
        </p>
      </motion.div>

      {/* Progress bar */}
      <motion.div
        className="absolute bottom-0 left-0 right-0 h-1 bg-[#00E676]/20"
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ duration: 3.8, ease: 'easeInOut' }}
        style={{ transformOrigin: 'left' }}
      >
        <motion.div
          className="h-full bg-gradient-to-r from-[#00E676] to-[#69F0AE]"
          style={{
            boxShadow: '0 0 20px rgba(0, 230, 118, 0.8)',
          }}
          animate={{
            opacity: [0.6, 1, 0.6],
          }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            repeatType: 'reverse',
          }}
        />
      </motion.div>
    </motion.div>
  )
}
