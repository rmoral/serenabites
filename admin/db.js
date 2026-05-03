/*
 * SQLite layer
 * ---------------------------------------------------------------
 * Una sola DB en data/serenabites.db (creado al arrancar si no existe).
 * Esquema versionado mediante PRAGMA user_version + migraciones idempotentes.
 *
 * Diseño:
 *   - products            menú autoritativo (precio en céntimos)
 *   - customers           dedupe por teléfono normalizado
 *   - orders              uno por checkout completado
 *   - order_items         líneas de pedido (snapshot del nombre/precio)
 *   - users               usuarios del back-office (admin | staff)
 *   - sessions            cookie de admin → user_id
 */

import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import { mkdirSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { randomBytes } from 'node:crypto';

const DB_PATH = process.env.DB_PATH || resolve(process.cwd(), 'data/serenabites.db');

// Asegurar carpeta data/
const dir = dirname(DB_PATH);
if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ─── MIGRACIONES ───────────────────────────────────────────────
const migrations = [
  // v1 — esquema inicial
  () => {
    db.exec(`
      CREATE TABLE products (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        category TEXT NOT NULL,
        price_cents INTEGER NOT NULL,
        description TEXT,
        image_url TEXT,
        is_active INTEGER NOT NULL DEFAULT 1,
        is_signature INTEGER NOT NULL DEFAULT 0,
        is_veg INTEGER NOT NULL DEFAULT 0,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE customers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        phone TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        email TEXT,
        last_address TEXT,
        last_postcode TEXT,
        last_city TEXT,
        total_orders INTEGER NOT NULL DEFAULT 0,
        total_spent_cents INTEGER NOT NULL DEFAULT 0,
        first_order_at INTEGER,
        last_order_at INTEGER,
        notes TEXT,
        created_at INTEGER NOT NULL
      );

      CREATE TABLE orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        stripe_session_id TEXT UNIQUE,
        customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
        customer_name TEXT NOT NULL,
        customer_phone TEXT NOT NULL,
        customer_email TEXT,
        delivery_mode TEXT NOT NULL CHECK (delivery_mode IN ('delivery','pickup')),
        delivery_address TEXT,
        delivery_postcode TEXT,
        delivery_city TEXT,
        notes TEXT,
        subtotal_cents INTEGER NOT NULL,
        delivery_fee_cents INTEGER NOT NULL DEFAULT 0,
        total_cents INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'paid'
          CHECK (status IN ('paid','preparing','ready','out_for_delivery','delivered','cancelled')),
        receipt_url TEXT,
        paid_at INTEGER NOT NULL,
        fulfilled_at INTEGER,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE INDEX idx_orders_paid_at  ON orders(paid_at DESC);
      CREATE INDEX idx_orders_status   ON orders(status);
      CREATE INDEX idx_orders_customer ON orders(customer_id);

      CREATE TABLE order_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        product_id TEXT,
        product_name TEXT NOT NULL,
        quantity INTEGER NOT NULL,
        unit_price_cents INTEGER NOT NULL,
        total_cents INTEGER NOT NULL
      );

      CREATE INDEX idx_order_items_order ON order_items(order_id);
      CREATE INDEX idx_order_items_product ON order_items(product_id);

      CREATE TABLE users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('admin','staff')),
        is_active INTEGER NOT NULL DEFAULT 1,
        last_login_at INTEGER,
        created_at INTEGER NOT NULL
      );

      CREATE TABLE sessions (
        token TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        expires_at INTEGER NOT NULL,
        created_at INTEGER NOT NULL
      );
      CREATE INDEX idx_sessions_user ON sessions(user_id);
    `);
  },
];

function runMigrations() {
  const current = db.pragma('user_version', { simple: true });
  for (let v = current; v < migrations.length; v++) {
    db.transaction(migrations[v])();
    db.pragma(`user_version = ${v + 1}`);
    console.log(`[db] migración v${v + 1} aplicada`);
  }
}

// ─── SEED ──────────────────────────────────────────────────────
const SEED_PRODUCTS = [
  // Pokés & Bowls
  { id: 'pokesakura',        cat: 'bowls',  name: 'Poké Sakura',             price: 1350, sig: 1, veg: 0, desc: 'Salmón fresco marinado en soja-jengibre, arroz integral templado, edamame, pepino, aguacate, cebolla crujiente y mayonesa de wasabi suave.', img: 'https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?w=600&q=80' },
  { id: 'bowlmediterraneo',  cat: 'bowls',  name: 'Bowl Mediterráneo',       price: 1190, sig: 1, veg: 0, desc: 'Quinoa, pollo al limón con hierbas, tomate cherry, hummus de cúrcuma, pepino, olivas Kalamata, feta y aceite de orégano.', img: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&q=80' },
  { id: 'bowlgarden',        cat: 'bowls',  name: 'Bowl Garden',             price: 1090, sig: 0, veg: 1, desc: 'Falafel recién horneado, quinoa, hummus, kale masajeado con limón, granada, zanahoria asada, semillas y tahini cítrico.', img: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=600&q=80' },
  { id: 'poketropical',      cat: 'bowls',  name: 'Poké Tropical',           price: 1290, sig: 1, veg: 0, desc: 'Atún rojo, arroz, mango maduro, edamame, pepino, aguacate, cebolla morada, sésamo tostado y salsa ponzu cítrica.', img: 'https://images.unsplash.com/photo-1543339308-43e59d6b73a6?w=600&q=80' },
  // Wraps & Pitas
  { id: 'wrapcaesar',        cat: 'wraps',  name: 'Wrap Caesar',             price:  950, sig: 0, veg: 0, desc: 'Tortilla integral, pollo asado a la sal, romana fresca, parmesano de pasto, picatostes de pan de masa madre y César cremosa de la casa.', img: 'https://images.unsplash.com/photo-1626700051175-6818013e1d4f?w=600&q=80' },
  { id: 'pitahalloumi',      cat: 'wraps',  name: 'Pita Halloumi',           price: 1050, sig: 0, veg: 1, desc: 'Halloumi a la plancha, hummus de cúrcuma, hojas verdes, tomate maduro, pepino y tzatziki fresco con menta dentro de pita esponjosa.', img: 'https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=600&q=80' },
  { id: 'wrapmediterraneo',  cat: 'wraps',  name: 'Wrap Mediterráneo',       price:  990, sig: 0, veg: 0, desc: 'Pollo al limón con hierbas, hummus, tomate cherry, pepino, feta, olivas Kalamata, espinaca baby y aceite de orégano.', img: 'https://images.unsplash.com/photo-1600335895229-6e75511892c8?w=600&q=80' },
  { id: 'wrapsalmon',        cat: 'wraps',  name: 'Wrap Salmón',             price: 1150, sig: 0, veg: 0, desc: 'Salmón ahumado, queso fresco con cebollino, aguacate machacado en el plato, rúcula con pimienta, alcaparras y eneldo fresco.', img: 'https://images.unsplash.com/photo-1565299507177-b0ac66763828?w=600&q=80' },
  // Brunch
  { id: 'avocadotoast',      cat: 'brunch', name: 'Avocado Toast',           price:  890, sig: 0, veg: 0, desc: 'Pan de masa madre, aguacate machacado en el plato, huevo poché, ralladura de lima, escamas de chile suave y AOVE arbequino.', img: 'https://images.unsplash.com/photo-1525351484163-7529414344d8?w=600&q=80' },
  { id: 'ricottafrutosrojos',cat: 'brunch', name: 'Ricotta & Frutos rojos',  price:  850, sig: 0, veg: 1, desc: 'Ricotta fresca batida con un toque de miel cruda, frutos rojos de temporada, pistacho del Mediterráneo y ralladura de limón.', img: 'https://images.unsplash.com/photo-1484723091739-30a097e8f929?w=600&q=80' },
  { id: 'quesadillaverde',   cat: 'brunch', name: 'Quesadilla Verde',        price:  990, sig: 0, veg: 0, desc: 'Tortilla de espinacas, pollo desmenuzado, queso curado de cabra, espinaca baby, salsa verde con cilantro fresco y lima exprimida.', img: 'https://images.unsplash.com/photo-1620288627223-53302f4e8c74?w=600&q=80' },
  { id: 'smokedsalmontoast', cat: 'brunch', name: 'Smoked Salmon Toast',     price: 1150, sig: 0, veg: 0, desc: 'Pan integral de centeno, salmón ahumado en finas capas, queso fresco con cebollino, aguacate, alcaparras y un toque de eneldo.', img: 'https://images.unsplash.com/photo-1551782450-a2132b4ba21d?w=600&q=80' },
  // Yogur & Açaí
  { id: 'berrybowl',         cat: 'dulces', name: 'Berry Bowl',              price:  850, sig: 0, veg: 1, desc: 'Yogur griego artesano, granola de la casa con miel, fresas, arándanos y plátano. Un toque de miel cruda al final.', img: 'https://images.unsplash.com/photo-1488477181946-6428a0291777?w=600&q=80' },
  { id: 'acaiclassic',       cat: 'dulces', name: 'Açaí Classic',            price:  950, sig: 0, veg: 1, desc: 'Açaí amazónico cremoso, plátano, fresas frescas, granola, coco rallado, semillas de chía y un toque de miel cruda.', img: 'https://images.unsplash.com/photo-1490474418585-ba9bad8fd0ea?w=600&q=80' },
  { id: 'frozenyogurtnutella', cat: 'dulces', name: 'Frozen Yogurt & Nutella', price: 890, sig: 0, veg: 1, desc: 'Helado artesano de yogur griego, plátano, fresas, un drizzle de Nutella, almendras laminadas y galletas caseras de avena.', img: 'https://images.unsplash.com/photo-1488900128323-21503983a07e?w=600&q=80' },
  { id: 'acaitropical',      cat: 'dulces', name: 'Açaí Tropical',           price:  990, sig: 0, veg: 1, desc: 'Açaí, mango maduro, kiwi, piña, granola de coco, mantequilla de cacahuete artesana y mix de semillas de la casa.', img: 'https://images.unsplash.com/photo-1505252585461-04db1eb84625?w=600&q=80' },
];

function seedIfEmpty() {
  const now = Date.now();

  const productCount = db.prepare('SELECT COUNT(*) AS n FROM products').get().n;
  if (productCount === 0) {
    const ins = db.prepare(`INSERT INTO products
      (id,name,category,price_cents,description,image_url,is_active,is_signature,is_veg,sort_order,created_at,updated_at)
      VALUES (@id,@name,@category,@price_cents,@description,@image_url,1,@is_signature,@is_veg,@sort_order,@now,@now)`);
    db.transaction(() => {
      SEED_PRODUCTS.forEach((p, i) => ins.run({
        id: p.id, name: p.name, category: p.cat, price_cents: p.price,
        description: p.desc, image_url: p.img,
        is_signature: p.sig, is_veg: p.veg,
        sort_order: i, now,
      }));
    })();
    console.log(`[db] sembrados ${SEED_PRODUCTS.length} productos`);
  }

  const userCount = db.prepare('SELECT COUNT(*) AS n FROM users').get().n;
  if (userCount === 0) {
    const email = process.env.ADMIN_INITIAL_EMAIL || 'admin@serenabites.com';
    const password = process.env.ADMIN_INITIAL_PASSWORD || randomBytes(9).toString('base64url');
    const hash = bcrypt.hashSync(password, 10);
    db.prepare(`INSERT INTO users (email,name,password_hash,role,is_active,created_at)
                VALUES (?,?,?,'admin',1,?)`).run(email, 'Admin', hash, now);
    if (!process.env.ADMIN_INITIAL_PASSWORD) {
      console.log('\n══════════════════════════════════════════════════');
      console.log('  ADMIN CREADO');
      console.log(`  Email:    ${email}`);
      console.log(`  Password: ${password}`);
      console.log('  ⚠  Guárdalo: no se volverá a mostrar.');
      console.log('══════════════════════════════════════════════════\n');
    } else {
      console.log(`[db] admin creado: ${email} (password de la env)`);
    }
  }
}

export function init() {
  runMigrations();
  seedIfEmpty();
  return db;
}

export default db;

// ─── Helpers ───────────────────────────────────────────────────
export const now = () => Date.now();

export function normalisePhone(raw) {
  if (!raw) return '';
  return String(raw).replace(/[^\d+]/g, '');
}
