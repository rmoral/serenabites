/*
 * POST /api/create-checkout-session
 * ---------------------------------------------------------------
 * Handler Express. Recibe el carrito del cliente, recalcula precios
 * en servidor (nunca se confía en lo que envía el navegador), crea
 * una Stripe Checkout Session y devuelve la URL a la que redirigir
 * al usuario.
 *
 * Variables de entorno requeridas:
 *   STRIPE_SECRET_KEY    — sk_test_... o sk_live_...
 */

import Stripe from 'stripe';
import db from '../admin/db.js';

// El menú es la tabla `products` de SQLite. Es la fuente única de verdad
// para precios y disponibilidad — el back-office la edita, este endpoint
// la lee. Nunca se confía en el precio que envía el navegador.
function lookupProduct(id) {
  return db.prepare('SELECT id, name, price_cents FROM products WHERE id = ? AND is_active = 1').get(id);
}

const MIN_ORDER         = 1500;  // 15,00 €
const DELIVERY_FEE      =  250;  //  2,50 €
const FREE_DELIVERY_FROM= 2500;  // 25,00 €

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function createCheckoutSession(req, res) {
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const { items, mode, customer } = body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'El carrito está vacío.' });
    }
    if (mode !== 'delivery' && mode !== 'pickup') {
      return res.status(400).json({ error: 'Modo de entrega no válido.' });
    }

    const lineItems = items.map(it => {
      const dish = lookupProduct(it.id);
      if (!dish) throw new Error(`Plato no disponible: ${it.id}`);
      const qty = parseInt(it.qty, 10);
      if (!Number.isFinite(qty) || qty < 1 || qty > 20) {
        throw new Error(`Cantidad inválida para ${dish.name}.`);
      }
      return {
        quantity: qty,
        price_data: {
          currency: 'eur',
          unit_amount: dish.price_cents,
          product_data: { name: dish.name },
        },
      };
    });

    const subtotal = lineItems.reduce((a, li) => a + li.price_data.unit_amount * li.quantity, 0);

    if (mode === 'delivery' && subtotal < MIN_ORDER) {
      return res.status(400).json({
        error: `Pedido mínimo a domicilio: ${(MIN_ORDER / 100).toFixed(2)} €`,
      });
    }

    if (mode === 'delivery') {
      const fee = subtotal >= FREE_DELIVERY_FROM ? 0 : DELIVERY_FEE;
      if (fee > 0) {
        lineItems.push({
          quantity: 1,
          price_data: {
            currency: 'eur',
            unit_amount: fee,
            product_data: { name: 'Envío a domicilio' },
          },
        });
      }
    }

    // En el flujo normal el navegador envía Origin. Como fallback (p.ej.
    // si se llama desde herramientas), reconstruimos la URL respetando
    // X-Forwarded-Proto y X-Forwarded-Host de Apache.
    const proto = req.headers['x-forwarded-proto'] || 'https';
    const host  = req.headers['x-forwarded-host'] || req.headers.host;
    const origin = req.headers.origin || `${proto}://${host}`;

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: lineItems,
      success_url: `${origin}/?order=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  `${origin}/?order=cancel`,
      locale: 'es',
      // Toda la info del cliente se guarda como metadata. El webhook la
      // lee para enviar el WhatsApp al restaurante.
      metadata: {
        delivery_mode:     mode,
        customer_name:     (customer?.name     || '').slice(0, 100),
        customer_phone:    (customer?.phone    || '').slice(0, 30),
        customer_address:  (customer?.address  || '').slice(0, 200),
        customer_postcode: (customer?.postcode || '').slice(0, 10),
        customer_city:     (customer?.city     || '').slice(0, 80),
        notes:             (customer?.notes    || '').slice(0, 400),
      },
      phone_number_collection: { enabled: false }, // ya lo recogemos en el form
    });

    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error('[create-checkout-session]', err);
    return res.status(500).json({ error: err.message || 'Error creando la sesión de pago.' });
  }
}
