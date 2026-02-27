"use client"
import { useState, useEffect } from "react"


export default function CountdownTimer() {
  const [timeLeft, setTimeLeft] = useState<{ hours: number; minutes: number; seconds: number }>({
    hours: 0,
    minutes: 0,
    seconds: 0,
  })
  const [ended, setEnded] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)

    function getTimeLeft() {
      const now = new Date()
      const endTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).getTime()
      const current = now.getTime()
      const distance = endTime - current
      if (distance <= 0) {
        return { hours: 0, minutes: 0, seconds: 0, ended: true }
      }
      const hours = Math.floor((distance % 86400000) / 3600000)
      const minutes = Math.floor((distance % 3600000) / 60000)
      const seconds = Math.floor((distance % 60000) / 1000)
      return { hours, minutes, seconds, ended: false }
    }

    const update = () => {
      const { hours, minutes, seconds, ended } = getTimeLeft()
      setTimeLeft({ hours, minutes, seconds })
      setEnded(ended)
    }

    update()
    const timer = setInterval(update, 1000)
    return () => clearInterval(timer)
  }, [])

  if (!mounted) {
    return null
  }

  if (ended) {
    return <div className="text-white text-center text-lg">The sale has ended!</div>
  }

  return (
    <div className="flex space-x-4 mb-6" id="countdown-timer">
      <div className="text-center">
        <div className="bg-white/20 rounded-lg p-3 min-w-[60px]">
          <div className="text-2xl font-bold text-white">{timeLeft.hours}</div>
          <div className="text-xs text-blue-100">Hours</div>
        </div>
      </div>
      <div className="text-center">
        <div className="bg-white/20 rounded-lg p-3 min-w-[60px]">
          <div className="text-2xl font-bold text-white">{timeLeft.minutes}</div>
          <div className="text-xs text-blue-100">Min</div>
        </div>
      </div>
      <div className="text-center">
        <div className="bg-white/20 rounded-lg p-3 min-w-[60px]">
          <div className="text-2xl font-bold text-white">{timeLeft.seconds}</div>
          <div className="text-xs text-blue-100">Sec</div>
        </div>
      </div>
    </div>
  )
}
