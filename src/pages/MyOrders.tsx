import { useAuth } from '@/hooks/useAuth'
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import MyOrdersUI from '@/pages/ui/MyOrdersUI'

/**
 * ROUTE COMPONENT - MyOrders
 * TIPO A - Solo ruta
 * Protected route - requires authentication
 */

const MyOrders = () => {
  const { user, loading } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (!loading && !user) {
      navigate('/')
    }
  }, [user, loading, navigate])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  return <MyOrdersUI />
}

export default MyOrders
