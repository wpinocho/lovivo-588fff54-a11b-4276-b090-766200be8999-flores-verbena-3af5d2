export const getLogoUrl = (logos: any[], key: string): string | null => {
  if (!Array.isArray(logos)) return null
  
  const logo = logos.find(logo => logo.key === key)
  return logo?.url || null
}