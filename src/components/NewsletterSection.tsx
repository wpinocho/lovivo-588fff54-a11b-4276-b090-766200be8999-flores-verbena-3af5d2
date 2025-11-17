import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { HeadlessNewsletter } from '@/components/headless/HeadlessNewsletter';
import { Mail } from 'lucide-react';

/**
 * EDITABLE UI COMPONENT - NewsletterSection
 * 
 * Componente de suscripción a newsletter con diseño inspirado en Verbena Flores
 */

export const NewsletterSection = () => {
  return (
    <HeadlessNewsletter>
      {(logic) => (
        <section className="bg-secondary/30 py-16 border-y">
          <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            {logic.success ? (
              <div className="space-y-4">
                <div className="flex justify-center">
                  <div className="bg-primary/10 rounded-full p-3">
                    <Mail className="h-8 w-8 text-primary" />
                  </div>
                </div>
                <h3 className="text-2xl font-bold">
                  ¡Gracias por suscribirte!
                </h3>
                <p className="text-muted-foreground">
                  Recibirás nuestras mejores ofertas y promociones pronto.
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="space-y-2">
                  <h3 className="text-2xl font-bold">
                    ¿Quieres recibir promociones?
                  </h3>
                  <p className="text-lg text-muted-foreground">
                    Suscríbete a nuestro newsletter y recibe ofertas exclusivas
                  </p>
                </div>
                
                <form 
                  onSubmit={(e) => {
                    e.preventDefault();
                    logic.handleSubscribe();
                  }}
                  className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto"
                >
                  <Input 
                    type="email"
                    placeholder="tu@email.com"
                    value={logic.email}
                    onChange={(e) => logic.setEmail(e.target.value)}
                    disabled={logic.isSubmitting}
                    className="flex-1"
                    required
                  />
                  <Button 
                    type="submit"
                    disabled={logic.isSubmitting}
                    className="sm:w-auto bg-primary hover:bg-primary/90"
                  >
                    {logic.isSubmitting ? 'Suscribiendo...' : 'Suscribirse'}
                  </Button>
                </form>
                
                {logic.error && (
                  <p className="text-sm text-destructive">
                    {logic.error}
                  </p>
                )}
              </div>
            )}
          </div>
        </section>
      )}
    </HeadlessNewsletter>
  );
};