import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Link } from "react-router-dom"
import { HeadlessProductCard } from "@/components/headless/HeadlessProductCard"
import type { Product } from "@/lib/supabase"

/**
 * EDITABLE UI COMPONENT - ProductCardUI
 * 
 * Componente de tarjeta de producto con diseño inspirado en Verbena Flores
 */

interface ProductCardUIProps {
  product: Product
}

export const ProductCardUI = ({ product }: ProductCardUIProps) => {
  return (
    <HeadlessProductCard product={product}>
      {(logic) => (
        <Card className="bg-card border hover:shadow-lg transition-shadow">
          <CardContent className="p-4">
            <Link to={`/products/${logic.product.slug}`} className="block">
              <div className="aspect-square bg-muted rounded-md mb-3 overflow-hidden relative">
                {(logic.matchingVariant?.image || (logic.product.images && logic.product.images.length > 0)) ? (
                  <img
                    src={(logic.matchingVariant?.image as any) || logic.product.images![0]}
                    alt={logic.product.title}
                    className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                    Sin imagen
                  </div>
                )}

                {/* Badges */}
                <div className="absolute top-2 left-2 flex flex-col gap-1">
                  {logic.discountPercentage && (
                    <span className="bg-destructive text-destructive-foreground text-xs px-2 py-1 rounded font-medium">
                      -{logic.discountPercentage}%
                    </span>
                  )}
                  {logic.product.featured && (
                    <span className="bg-primary text-primary-foreground text-xs px-2 py-1 rounded font-medium">
                      Destacado
                    </span>
                  )}
                  {!logic.inStock && (
                    <span className="bg-secondary text-secondary-foreground text-xs px-2 py-1 rounded font-medium">
                      Agotado
                    </span>
                  )}
                </div>
              </div>

              <h3 className="font-medium text-sm mb-1 line-clamp-2">
                {logic.product.title}
              </h3>
              {logic.product.description && (
                <p className="text-muted-foreground text-xs mb-3 line-clamp-2">
                  {logic.product.description.replace(/<[^>]*>/g, '')}
                </p>
              )}
            </Link>

            {logic.hasVariants && logic.options && (
              <div className="mb-3 space-y-2">
                {logic.options.map((opt) => (
                  <div key={opt.id}>
                    <div className="text-xs font-medium mb-1">{opt.name}</div>
                    <div className="flex flex-wrap gap-2">
                      {opt.values.filter(val => logic.isOptionValueAvailable(opt.name, val)).map((val) => {
                        const isSelected = logic.selected[opt.name] === val
                        const swatch = opt.name.toLowerCase() === 'color' ? opt.swatches?.[val] : undefined

                        if (swatch) {
                          return (
                            <button
                              key={val}
                              type="button"
                              onClick={() => logic.handleOptionChange(opt.name, val)}
                              title={`${opt.name}: ${val}`}
                              className={`h-6 w-6 rounded-full border ${
                                logic.selected[opt.name] && !isSelected ? 'opacity-40' : ''
                              }`}
                              style={{ 
                                backgroundColor: swatch, 
                                borderColor: 'hsl(var(--border))'
                              }}
                              aria-label={`${opt.name}: ${val}`}
                            />
                          )
                        }

                        return (
                          <button
                            key={val}
                            type="button"
                            onClick={() => logic.handleOptionChange(opt.name, val)}
                            className={`border rounded px-2 py-1 text-xs font-medium ${
                              isSelected 
                                ? 'border-primary bg-primary text-primary-foreground' 
                                : logic.selected[opt.name] && !isSelected
                                  ? 'border-border bg-card text-muted-foreground opacity-40'
                                  : 'border-border bg-card'
                            }`}
                            aria-pressed={isSelected}
                            aria-label={`${opt.name}: ${val}`}
                            title={`${opt.name}: ${val}`}
                          >
                            {val}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center justify-between">
              <div className="flex flex-col">
                <span className="font-semibold">
                  {logic.formatMoney(logic.currentPrice)}
                </span>
                {logic.currentCompareAt && logic.currentCompareAt > logic.currentPrice && (
                  <span className="text-muted-foreground text-xs line-through">
                    {logic.formatMoney(logic.currentCompareAt)}
                  </span>
                )}
              </div>
              <Button
                size="sm"
                onClick={() => {
                  logic.onAddToCartSuccess()
                  logic.handleAddToCart()
                }}
                disabled={!logic.canAddToCart}
                className="bg-primary hover:bg-primary/90 text-primary-foreground disabled:opacity-50"
              >
                {logic.inStock ? 'Agregar' : 'Agotado'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </HeadlessProductCard>
  )
}