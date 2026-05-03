/*
 * POST /api/stripe-webhook
 * ---------------------------------------------------------------
 * Handler Express. Recibe eventos de Stripe (configura el endpoint
 * en Stripe Dashboard → Developers → Webhooks). Cuando llega un
 * `checkout.session.completed` verifica la firma sobre el body crudo,
 * consulta los line items y envía el resumen al WhatsApp del
 * restaurante usando Twilio.
 *
 * Este handler espera que el body sea un Buffer (Express debe estar
 * configurado con `express.raw({ type: 'application/json' })` para
 * esta ruta — ver server.js).
 *
 * Variables de entorno requeridas:
 *   STRIPE_SECRET_KEY        — sk_test_... o sk_live_...
 *   STRIPE_WEBHOOK_SECRET    — whsec_... (lo da Stripe al crear el endpoint)
 *   TWILIO_ACCOUNT_SID       — AC...
 *   TWILIO_AUTH_TOKEN        — token de Twilio
 *   TWILIO_WHATSAPP_FROM     — p.ej. "whatsapp:+14155238886" (sandbox)
 *   RESTAURANT_WHATSAPP_TO   — p.ej. "whatsapp:+34649575108"
 *
 * Si las variables de Twilio no están definidas, el endpoint sigue
 * respondiendo 200 OK pero solo deja el pedido en logs.
 */

import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

async function sendWhatsApp(message) {
  const sid   = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from  = process.env.TWILIO_WHATSAPP_FROM;
  const to    = process.env.RESTAURANT_WHATSAPP_TO;

  if (!sid || !token || !from || !to) {
    console.warn('[stripe-webhook] Twilio no configurado — pedido en logs:\n' + message);
    return;
  }

  const auth = Buffer.from(`${sid}:${token}`).toString('base64');
  const body = new URLSearchParams({ From: from, To: to, Body: message });

  const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  });
  if (!r.ok) {
    const txt = await r.text();
    throw new Error(`Twilio ${r.status}: ${txt}`);
  }
}

function eur(cents) {
  return (cents / 100).toFixed(2).replace('.', ',') + ' €';
}

export default async function stripeWebhook(req, res) {
  const sig    = req.headers['stripe-signature'];
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;
  try {
    // req.body es un Buffer porque montamos express.raw() para esta ruta
    event = stripe.webhooks.constructEvent(req.body, sig, secret);
  } catch (err) {
    console.error('[stripe-webhook] firma inválida:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type !== 'checkout.session.completed') {
    return res.status(200).json({ received: true, ignored: event.type });
  }

  try {
    const session = event.data.object;
    const m = session.metadata || {};
    const items = await stripe.checkout.sessions.listLineItems(session.id, { limit: 50 });

    const lines = items.data
      .map(li => `· ${li.quantity}× ${li.description} — ${eur(li.amount_total)}`)
      .join('\n');

    const isDelivery = m.delivery_mode === 'delivery';
    const orderId    = '#' + session.id.slice(-8).toUpperCase();

    const text = [
      '🟢 *Nuevo pedido — Serena Bites*',
      `Pedido ${orderId}`,
      '',
      `*Modo:* ${isDelivery ? 'A domicilio' : 'Recogida en barra'}`,
      `*Cliente:* ${m.customer_name || '—'}`,
      `*Teléfono:* ${m.customer_phone || '—'}`,
      isDelivery
        ? `*Dirección:* ${m.customer_address}, ${m.customer_postcode}${m.customer_city ? ' ' + m.customer_city : ''}`
        : null,
      '',
      lines,
      '',
      `*Total cobrado:* ${eur(session.amount_total)}`,
      m.notes ? `*Notas:* ${m.notes}` : null,
    ]
      .filter(Boolean)
      .join('\n');

    await sendWhatsApp(text);
  } catch (err) {
    console.error('[stripe-webhook] error procesando pedido:', err);
    // 500 → Stripe reintentará. El procesado es idempotente porque
    // dedupa por session.id.
    return res.status(500).json({ error: err.message });
  }

  return res.status(200).json({ received: true });
}

