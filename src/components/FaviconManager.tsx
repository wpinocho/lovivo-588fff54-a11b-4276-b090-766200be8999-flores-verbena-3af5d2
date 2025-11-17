import { useEffect } from 'react'
import { useSettings } from '@/contexts/SettingsContext'
import { getLogoUrl } from '@/lib/logo-utils'

export const FaviconManager = () => {
  const { logos } = useSettings()

  useEffect(() => {
    if (!logos) return

    const faviconUrl = getLogoUrl(logos, 'favicon')
    
    if (faviconUrl) {
      // Remove existing favicon
      const existingFavicon = document.querySelector('link[rel="icon"]')
      if (existingFavicon) {
        existingFavicon.remove()
      }

      // Create new favicon
      const favicon = document.createElement('link')
      favicon.rel = 'icon'
      favicon.href = faviconUrl
      
      // Determine type based on file extension
      const extension = faviconUrl.split('.').pop()?.toLowerCase()
      if (extension === 'svg') {
        favicon.type = 'image/svg+xml'
      } else if (extension === 'png') {
        favicon.type = 'image/png'
      } else if (extension === 'jpg' || extension === 'jpeg') {
        favicon.type = 'image/jpeg'
      } else if (extension === 'ico') {
        favicon.type = 'image/x-icon'
      }

      document.head.appendChild(favicon)
    }
  }, [logos])

  return null
}