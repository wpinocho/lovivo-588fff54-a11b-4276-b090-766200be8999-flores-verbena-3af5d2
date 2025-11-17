import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { CheckCircle, Package, Mail, ArrowLeft } from 'lucide-react'
import { formatMoney } from '@/lib/money'
import { useToast } from '@/hooks/use-toast'

interface OrderDetails {
  id: string
  order_number: string
  total_amount: number
  currency_code: string
  status: string
  shipping_address?: any
  billing_address?: any
  order_items: any[]
  created_at: string
}

const ThankYou = () => {
  const { orderId } = useParams()
  const navigate = useNavigate()
  const { toast } = useToast()
  const [order, setOrder] = useState<OrderDetails | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!orderId) {
      navigate('/')
      return
    }

    const loadOrder = () => {
      try {
        // Try to get order from localStorage (saved from successful payment)
        const completedOrderJson = localStorage.getItem('completed_order')
        if (completedOrderJson) {
          const completedOrder = JSON.parse(completedOrderJson)
          setOrder(completedOrder)
          // Clean up localStorage
          localStorage.removeItem('completed_order')
        } else {
          toast({
            title: 'Error',
            description: 'Could not load order information',
            variant: 'destructive'
          })
          navigate('/')
        }
      } catch (error) {
        console.error('Error loading order:', error)
        toast({
          title: 'Error',
          description: 'Could not load order information',
          variant: 'destructive'
        })
        navigate('/')
      } finally {
        setLoading(false)
      }
    }

    loadOrder()
  }, [orderId, navigate, toast])

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <p className="text-muted-foreground">Order not found</p>
            <Button asChild className="mt-4">
              <Link to="/">Back to store</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Header de confirmación */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <h1 className="text-3xl font-bold text-foreground mb-2">
            ¡Pago confirmado!
          </h1>
          <p className="text-lg text-muted-foreground mb-4">
            Gracias por tu compra. Tu pedido ha sido procesado exitosamente.
          </p>
          <Badge variant="secondary" className="text-sm">
            Pedido #{order.order_number}
          </Badge>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Información del pedido */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="w-5 h-5" />
                Detalles del pedido
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                {order.order_items.filter(item => item.quantity > 0).map((item, index) => (
                  <div key={index} className="flex gap-4 items-start">
                    {/* Product Image */}
                    {item.product_images && item.product_images.length > 0 && (
                      <div className="w-16 h-16 bg-muted rounded-lg flex-shrink-0 overflow-hidden">
                        <img 
                          src={item.product_images[0]} 
                          alt={item.product_name || 'Producto'}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none'
                          }}
                        />
                      </div>
                    )}
                    
                    <div className="flex-1">
                      <p className="font-medium">{item.product_name || 'Producto'}</p>
                      {item.variant_name && (
                        <p className="text-sm text-muted-foreground">
                          {item.variant_name}
                        </p>
                      )}
                      <p className="text-sm text-muted-foreground">
                        Cantidad: {item.quantity}
                      </p>
                    </div>
                    <p className="font-medium">
                      {formatMoney(item.price * item.quantity, order.currency_code)}
                    </p>
                  </div>
                ))}
              </div>

              <Separator />

              <div className="space-y-2">
                <div className="flex justify-between text-lg font-bold">
                  <span>Total</span>
                  <span>{formatMoney(order.total_amount, order.currency_code)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Información de entrega */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="w-5 h-5" />
                Información de entrega
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {order.shipping_address ? (
                <div>
                  <h4 className="font-medium mb-2">Dirección de envío:</h4>
                  <div className="text-sm text-muted-foreground space-y-1">
                    <p>{order.shipping_address.first_name} {order.shipping_address.last_name}</p>
                    <p>{order.shipping_address.address1}</p>
                    {order.shipping_address.address2 && <p>{order.shipping_address.address2}</p>}
                    <p>{order.shipping_address.city}, {order.shipping_address.province}</p>
                    <p>{order.shipping_address.zip} {order.shipping_address.country}</p>
                    {order.shipping_address.phone && <p>Tel: {order.shipping_address.phone}</p>}
                  </div>
                </div>
              ) : (
                <div>
                  <h4 className="font-medium mb-2">Método de entrega:</h4>
                  <p className="text-sm text-muted-foreground">Recolección en tienda</p>
                </div>
              )}

              <Separator />

              <div>
                <h4 className="font-medium mb-2">Próximos pasos:</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Recibirás un email de confirmación</li>
                  <li>• Te notificaremos cuando tu pedido esté listo</li>
                  <li>• Podrás rastrear tu pedido con el número #{order.order_number}</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Botones de acción */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center mt-8">
          <Button asChild variant="outline">
            <Link to="/" className="flex items-center gap-2">
              <ArrowLeft className="w-4 h-4" />
              Seguir comprando
            </Link>
          </Button>
        </div>
      </div>
    </div>
  )
}

export default ThankYou