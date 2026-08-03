import { useEffect, useRef } from 'react'

const SCANNER_INTERVAL = 80

export default function useBarcodeScanner(onScan, { enabled = true } = {}) {
  const bufferRef = useRef('')
  const lastTimeRef = useRef(0)
  const timeoutRef = useRef(null)

  useEffect(() => {
    if (!enabled) return

    const handler = (e) => {
      if (
        e.target.tagName === 'INPUT' ||
        e.target.tagName === 'TEXTAREA' ||
        e.target.isContentEditable
      ) {
        return
      }

      const now = Date.now()

      if (e.key === 'Enter') {
        if (bufferRef.current.length >= 3) {
          const barcode = bufferRef.current
          bufferRef.current = ''
          onScan(barcode)
        }
        bufferRef.current = ''
        clearTimeout(timeoutRef.current)
        return
      }

      if (e.key.length === 1) {
        if (now - lastTimeRef.current > SCANNER_INTERVAL && bufferRef.current.length > 0) {
          bufferRef.current = ''
        }
        bufferRef.current += e.key
        lastTimeRef.current = now
        clearTimeout(timeoutRef.current)
        timeoutRef.current = setTimeout(() => {
          bufferRef.current = ''
        }, 200)
      }
    }

    window.addEventListener('keydown', handler)

    return () => {
      window.removeEventListener('keydown', handler)
      clearTimeout(timeoutRef.current)
    }
  }, [onScan, enabled])
}
