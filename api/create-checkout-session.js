/*
 * POST /api/create-checkout-session
 * ---------------------------------------------------------------
 * Recibe el carrito del cliente, recalcula precios en servidor (nunca
 * se confía en lo que envía el navegador), crea una Stripe Checkout
 * Session y devuelve la URL a la que redirigir al usuario.
 *
 * Variables de entorno requeridas:
 *   STRIPE_SECRET_KEY    — sk_test_... o sk_live_...
 *
 * Compatible con Vercel (default) y Netlify Functions (con un wrapper).
 */

import Stripe from 'stripe';

// Carta autorizada. Importes en céntimos. Cualquier id no presente aquí
// se rechaza. Esto evita que un usuario manipule el precio en el DOM.
// Las claves se derivan del nombre con: lowercase + NFD + strip diacríticos
// + strip caracteres no alfanuméricos. Coinciden 1:1 con el slug que
// genera el cliente en index.html. Cualquier desajuste = pedido rechazado.
const MENU = {
  pokesakura:          { name: 'Poké Sakura',             price: 1350 },
  bowlmediterraneo:    { name: 'Bowl Mediterráneo',       price: 1190 },
  bowlgarden:          { name: 'Bowl Garden',             price: 1090 },
  poketropical:        { name: 'Poké Tropical',           price: 1290 },
  wrapcaesar:          { name: 'Wrap Caesar',             price:  950 },
  pitahalloumi:        { name: 'Pita Halloumi',           price: 1050 },
  wrapmediterraneo:    { name: 'Wrap Mediterráneo',       price:  990 },
  wrapsalmon:          { name: 'Wrap Salmón',             price: 1150 },
  avocadotoast:        { name: 'Avocado Toast',           price:  890 },
  ricottafrutosrojos:  { name: 'Ricotta & Frutos rojos',  price:  850 },
  quesadillaverde:     { name: 'Quesadilla Verde',        price:  990 },
  smokedsalmontoast:   { name: 'Smoked Salmon Toast',     price: 1150 },
  berrybowl:           { name: 'Berry Bowl',              price:  850 },
  acaiclassic:         { name: 'Açaí Classic',            price:  950 },
  frozenyogurtnutella: { name: 'Frozen Yogurt & Nutella', price:  890 },
  acaitropical:        { name: 'Açaí Tropical',           price:  990 },
};

const MIN_ORDER         = 1500;  // 15,00 €
const DELIVERY_FEE      =  250;  //  2,50 €
const FREE_DELIVERY_FROM= 2500;  // 25,00 €

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

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
      const dish = MENU[it.id];
      if (!dish) throw new Error(`Plato no disponible: ${it.id}`);
      const qty = parseInt(it.qty, 10);
      if (!Number.isFinite(qty) || qty < 1 || qty > 20) {
        throw new Error(`Cantidad inválida para ${dish.name}.`);
      }
      return {
        quantity: qty,
        price_data: {
          currency: 'eur',
          unit_amount: dish.price,
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

    const origin = req.headers.origin || `https://${req.headers.host}`;

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
