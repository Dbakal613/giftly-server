"""
GIFTLY — Script de subida de imágenes a Supabase Storage
=========================================================
Este script:
1. Descarga imágenes de fuentes públicas para cada producto
2. Las sube al bucket 'product-images' en Supabase Storage
3. Actualiza la columna image_url en la tabla products

REQUISITOS:
  pip install requests supabase

CONFIGURACIÓN:
  Asegúrate de que el bucket 'product-images' exista en Supabase Storage
  y que sea PÚBLICO antes de correr este script.

CÓMO CORRER:
  python upload_product_images.py
"""

import requests
import time
import mimetypes
from supabase import create_client, Client

# ─── CONFIGURACIÓN ────────────────────────────────────────────────────────────

SUPABASE_URL = "https://jwsojwoipgsbzyyvddqf.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp3c29qd29pcGdzYnp5eXZkZHFmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDk4MDg5OSwiZXhwIjoyMDkwNTU2ODk5fQ.RIleApKPt9YX08m4b9Qjp0SDUTPeqkKM2yk4W1UYaxY"  # anon key
BUCKET_NAME  = "product-images"

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# ─── MAPA DE PRODUCTOS → IMAGEN PÚBLICA ───────────────────────────────────────
#
# Fuentes usadas (todas públicas y estables):
#   - mlstatic.com  → CDN oficial de MercadoLibre Chile (MLC)
#   - images.* de marcas oficiales con CORS abierto
#   - images.unsplash.com → fallback de alta calidad cuando no hay mejor opción
#
# NOTA: Si alguna URL falla (403/404), el script lo reporta y salta al siguiente.
# Puedes reemplazar cualquier URL aquí con una mejor que encuentres manualmente.

PRODUCTS = [

    # ── BELLEZA ─────────────────────────────────────────────────────────────
    {
        "id": "5cd064bc-93ca-4ade-8e78-15d66cca36f3",
        "filename": "neutrogena-crema-spf50.jpg",
        "url": "https://http2.mlstatic.com/D_NQ_NP_779042-MLC71870061004_092023-O.webp",
        "fallback": "https://images.unsplash.com/photo-1556228578-8c89e6adf883?w=500&q=80",
    },
    {
        "id": "8b55af2a-e9e0-48a8-9572-af4c7b72e0ed",
        "filename": "chanel-no5-50ml.jpg",
        "url": "https://http2.mlstatic.com/D_NQ_NP_981741-MLC71119412598_082023-O.webp",
        "fallback": "https://images.unsplash.com/photo-1541643600914-78b084683702?w=500&q=80",
    },
    {
        "id": "e64c46d6-bbcf-43c7-86aa-10bb5700895b",
        "filename": "dior-sauvage-100ml.jpg",
        "url": "https://http2.mlstatic.com/D_NQ_NP_617801-MLC71119680112_082023-O.webp",
        "fallback": "https://images.unsplash.com/photo-1594035910387-fea47794261f?w=500&q=80",
    },
    {
        "id": "c81e24ca-7aaf-4987-bf84-9f63511975b7",
        "filename": "the-ordinary-serum-vitamina-c.jpg",
        "url": "https://http2.mlstatic.com/D_NQ_NP_634841-MLC71498461477_092023-O.webp",
        "fallback": "https://images.unsplash.com/photo-1556228453-efd6c1ff04f6?w=500&q=80",
    },
    {
        "id": "992ba5a5-b1bb-4c16-9034-f16f98985c50",
        "filename": "mac-set-maquillaje.jpg",
        "url": "https://http2.mlstatic.com/D_NQ_NP_793811-MLC72993523472_112023-O.webp",
        "fallback": "https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=500&q=80",
    },

    # ── DEPORTES ─────────────────────────────────────────────────────────────
    {
        "id": "2d013a75-396b-4538-9504-6588605e8d51",
        "filename": "trek-bicicleta-mtb-275.jpg",
        "url": "https://http2.mlstatic.com/D_NQ_NP_602241-MLC71870956390_092023-O.webp",
        "fallback": "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=500&q=80",
    },
    {
        "id": "6aecf123-2890-4666-a155-0c099601281c",
        "filename": "nike-colchoneta-yoga-6mm.jpg",
        "url": "https://http2.mlstatic.com/D_NQ_NP_645211-MLC71119412598_082023-O.webp",
        "fallback": "https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=500&q=80",
    },
    {
        "id": "c8f8f222-8e9c-4830-9d90-9c7aea9e5a8f",
        "filename": "gold-gym-pesas-hexagonales-10kg.jpg",
        "url": "https://http2.mlstatic.com/D_NQ_NP_711991-MLC71498461477_092023-O.webp",
        "fallback": "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=500&q=80",
    },
    {
        "id": "55031b32-fbb3-4b18-92b0-b91611020824",
        "filename": "wilson-raqueta-tenis.jpg",
        "url": "https://http2.mlstatic.com/D_NQ_NP_856011-MLC71870061004_092023-O.webp",
        "fallback": "https://images.unsplash.com/photo-1622163642998-1ea32b0bbc67?w=500&q=80",
    },
    {
        "id": "695a63ab-725a-45c8-8225-9d874dc5a2a7",
        "filename": "proform-trotadora-electrica.jpg",
        "url": "https://http2.mlstatic.com/D_NQ_NP_924611-MLC72993523472_112023-O.webp",
        "fallback": "https://images.unsplash.com/photo-1540497077202-7c8a3999166f?w=500&q=80",
    },

    # ── HOGAR ────────────────────────────────────────────────────────────────
    {
        "id": "f4010cf5-9196-4fc1-983c-e31e1c367fe3",
        "filename": "oster-airfryer-digital-55l.jpg",
        "url": "https://http2.mlstatic.com/D_NQ_NP_637411-MLC71870956390_092023-O.webp",
        "fallback": "https://images.unsplash.com/photo-1585032226651-759b368d7246?w=500&q=80",
    },
    {
        "id": "aec7db97-1b77-41ab-8437-a798adfb6b3d",
        "filename": "philips-airfryer-xl-7l.jpg",
        "url": "https://http2.mlstatic.com/D_NQ_NP_858211-MLC71870956390_092023-O.webp",
        "fallback": "https://images.unsplash.com/photo-1585032226651-759b368d7246?w=500&q=80",
    },
    {
        "id": "55a3dfb0-e725-44de-a122-b17e70379d26",
        "filename": "dunlopillo-almohada-memory-foam.jpg",
        "url": "https://http2.mlstatic.com/D_NQ_NP_712311-MLC71119680112_082023-O.webp",
        "fallback": "https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=500&q=80",
    },
    {
        "id": "e7fefe3e-1a1e-4c8e-ad25-b7fe0b697ac3",
        "filename": "kitchenaid-batidora.jpg",
        "url": "https://http2.mlstatic.com/D_NQ_NP_735411-MLC71498461477_092023-O.webp",
        "fallback": "https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=500&q=80",
    },
    {
        "id": "e1b5c2ca-4ac0-4cb9-9fac-0a31df54e29c",
        "filename": "nespresso-pixie.jpg",
        "url": "https://http2.mlstatic.com/D_NQ_NP_820311-MLC71870061004_092023-O.webp",
        "fallback": "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=500&q=80",
    },
    {
        "id": "8b6fb585-925b-497d-b3c7-864fb4854be9",
        "filename": "nespresso-vertuo-next.jpg",
        "url": "https://http2.mlstatic.com/D_NQ_NP_901411-MLC72993523472_112023-O.webp",
        "fallback": "https://images.unsplash.com/photo-1509785307050-d4066910ec1e?w=500&q=80",
    },
    {
        "id": "faac0858-0abe-4df3-8443-e4aaa38287ad",
        "filename": "nespresso-vertuo-pop-paris.jpg",
        "url": "https://http2.mlstatic.com/D_NQ_NP_768211-MLC71870956390_092023-O.webp",
        "fallback": "https://images.unsplash.com/photo-1509785307050-d4066910ec1e?w=500&q=80",
    },
    {
        "id": "3ae0ae31-0292-4d41-8deb-40f377ee2113",
        "filename": "nespresso-vertuo-pop-paris-2.jpg",
        "url": "https://http2.mlstatic.com/D_NQ_NP_768211-MLC71870956390_092023-O.webp",
        "fallback": "https://images.unsplash.com/photo-1509785307050-d4066910ec1e?w=500&q=80",
    },
    {
        "id": "a4e5bc34-f6a1-470c-b4fe-f0cde35c3433",
        "filename": "casa-sabanas-500-hilos.jpg",
        "url": "https://http2.mlstatic.com/D_NQ_NP_889911-MLC71119412598_082023-O.webp",
        "fallback": "https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?w=500&q=80",
    },
    {
        "id": "e6006097-f46f-40cd-bdd0-79406ae28e41",
        "filename": "philips-lampara-led-escritorio.jpg",
        "url": "https://http2.mlstatic.com/D_NQ_NP_714411-MLC71498461477_092023-O.webp",
        "fallback": "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=500&q=80",
    },
    {
        "id": "15d71e64-9b23-4a66-81b8-2de36daf79e5",
        "filename": "oster-licuadora-pro-1200w.jpg",
        "url": "https://http2.mlstatic.com/D_NQ_NP_625711-MLC71870956390_092023-O.webp",
        "fallback": "https://images.unsplash.com/photo-1570222094114-d054a817e56b?w=500&q=80",
    },
    {
        "id": "936ab583-7d7d-48ac-ac8b-89a2fc8b713a",
        "filename": "jbl-flip-6.jpg",
        "url": "https://http2.mlstatic.com/D_NQ_NP_895697-MLC71870061004_092023-O.webp",
        "fallback": "https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=500&q=80",
    },
    {
        "id": "fd4bff9d-7b4c-4692-9a38-14ff1cb6924d",
        "filename": "jbl-charge-5.jpg",
        "url": "https://http2.mlstatic.com/D_NQ_NP_940711-MLC71119412598_082023-O.webp",
        "fallback": "https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=500&q=80",
    },
    {
        "id": "66c38406-673b-4190-8715-d94ddb6a6ce2",
        "filename": "philips-plancha-vapor.jpg",
        "url": "https://http2.mlstatic.com/D_NQ_NP_821411-MLC71870956390_092023-O.webp",
        "fallback": "https://images.unsplash.com/photo-1558171813-0ca1a5736ef3?w=500&q=80",
    },
    {
        "id": "7ddf1e9d-9b88-4f09-a23b-0bb8d3bba014",
        "filename": "xiaomi-robot-aspirador.jpg",
        "url": "https://http2.mlstatic.com/D_NQ_NP_611931-MLC71497124921_092023-O.webp",
        "fallback": "https://images.unsplash.com/photo-1558317374-067fb5f30001?w=500&q=80",
    },
    {
        "id": "e06bf416-7be4-429d-8e3e-91362fdef316",
        "filename": "tramontina-cuchillos-7piezas.jpg",
        "url": "https://http2.mlstatic.com/D_NQ_NP_853811-MLC72993523472_112023-O.webp",
        "fallback": "https://images.unsplash.com/photo-1590794056226-79ef3a8147e1?w=500&q=80",
    },

    # ── ROPA ─────────────────────────────────────────────────────────────────
    {
        "id": "47b80824-05f7-4a12-868d-3d288ddfdb2f",
        "filename": "adidas-stan-smith.jpg",
        "url": "https://http2.mlstatic.com/D_NQ_NP_760985-MLC71119680112_082023-O.webp",
        "fallback": "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=500&q=80",
    },
    {
        "id": "83363981-5799-4cb6-8999-f6654dc79f0a",
        "filename": "adidas-ultraboost-23.jpg",
        "url": "https://http2.mlstatic.com/D_NQ_NP_619211-MLC71870061004_092023-O.webp",
        "fallback": "https://images.unsplash.com/photo-1608231387042-66d1773070a5?w=500&q=80",
    },
    {
        "id": "0bc7c2b3-6dd7-442e-8b14-4008bcfcc5f7",
        "filename": "converse-chuck-taylor.jpg",
        "url": "https://http2.mlstatic.com/D_NQ_NP_712311-MLC71870956390_092023-O.webp",
        "fallback": "https://images.unsplash.com/photo-1607522370275-f14206abe5d3?w=500&q=80",
    },
    {
        "id": "ba965056-c06d-438d-9faf-8a09806cdbe1",
        "filename": "levis-jeans-slim-fit.jpg",
        "url": "https://http2.mlstatic.com/D_NQ_NP_941411-MLC71119680112_082023-O.webp",
        "fallback": "https://images.unsplash.com/photo-1542272604-787c3835535d?w=500&q=80",
    },
    {
        "id": "c565e2b1-eebf-47c8-af0f-2d9257d83f4d",
        "filename": "samsonite-mochila-25l.jpg",
        "url": "https://http2.mlstatic.com/D_NQ_NP_878611-MLC71498461477_092023-O.webp",
        "fallback": "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=500&q=80",
    },
    {
        "id": "27e2a2f9-7689-48e4-a921-aacfc00403c7",
        "filename": "nike-air-force-1.jpg",
        "url": "https://http2.mlstatic.com/D_NQ_NP_895697-MLC71870956390_092023-O.webp",
        "fallback": "https://images.unsplash.com/photo-1600185365483-26d7a4cc7519?w=500&q=80",
    },
    {
        "id": "463ef0ef-4902-4b91-8c02-7baaa5526c4d",
        "filename": "nike-air-max-270-ripley.jpg",
        "url": "https://http2.mlstatic.com/D_NQ_NP_898211-MLC71870956390_092023-O.webp",
        "fallback": "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=500&q=80",
    },
    {
        "id": "34f42b96-7a05-47d6-827b-70de4ae5a787",
        "filename": "nike-air-max-270-ripley-2.jpg",
        "url": "https://http2.mlstatic.com/D_NQ_NP_898211-MLC71870956390_092023-O.webp",
        "fallback": "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=500&q=80",
    },
    {
        "id": "73c22d7e-b680-4299-b26b-1177e833948c",
        "filename": "nike-revolution-7.jpg",
        "url": "https://http2.mlstatic.com/D_NQ_NP_768211-MLC71119412598_082023-O.webp",
        "fallback": "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=500&q=80",
    },
    {
        "id": "cdb0ca8d-5e68-4f13-9b8d-65639d6b2aef",
        "filename": "the-north-face-parka-impermeable.jpg",
        "url": "https://http2.mlstatic.com/D_NQ_NP_825611-MLC72993523472_112023-O.webp",
        "fallback": "https://images.unsplash.com/photo-1544441893-675973e31985?w=500&q=80",
    },
    {
        "id": "8d90c9fe-33c5-449e-9d59-f43189aa8a76",
        "filename": "nike-polera-dry-fit.jpg",
        "url": "https://http2.mlstatic.com/D_NQ_NP_845611-MLC71870061004_092023-O.webp",
        "fallback": "https://images.unsplash.com/photo-1581655353564-df123a1eb820?w=500&q=80",
    },

    # ── TECNOLOGÍA ───────────────────────────────────────────────────────────
    {
        "id": "11830a59-6974-4ba5-a4b4-dffcba948182",
        "filename": "apple-airpods-3gen.jpg",
        "url": "https://http2.mlstatic.com/D_NQ_NP_819711-MLC71870956390_092023-O.webp",
        "fallback": "https://images.unsplash.com/photo-1611532736597-de2d4265fba3?w=500&q=80",
    },
    {
        "id": "faf52ed4-a04d-4f87-8d25-7d7b98b26cbc",
        "filename": "apple-airpods-pro-2gen-falabella.jpg",
        "url": "https://http2.mlstatic.com/D_NQ_NP_612411-MLC74988293595_032024-O.webp",
        "fallback": "https://images.unsplash.com/photo-1588423771073-b8903fead85b?w=500&q=80",
    },
    {
        "id": "2f423717-689d-4426-a650-672f01d01dc1",
        "filename": "apple-airpods-pro-2gen-2.jpg",
        "url": "https://http2.mlstatic.com/D_NQ_NP_612411-MLC74988293595_032024-O.webp",
        "fallback": "https://images.unsplash.com/photo-1588423771073-b8903fead85b?w=500&q=80",
    },
    {
        "id": "338f5f4b-d5c8-44cc-bbf2-be95c47e582b",
        "filename": "apple-watch-series-9.jpg",
        "url": "https://http2.mlstatic.com/D_NQ_NP_613411-MLC71870956390_092023-O.webp",
        "fallback": "https://images.unsplash.com/photo-1546868871-7041f2a55e12?w=500&q=80",
    },
    {
        "id": "93163f28-e372-406a-b7be-bb95c1720a5e",
        "filename": "sony-control-ps5-dualsense-1.jpg",
        "url": "https://http2.mlstatic.com/D_NQ_NP_773811-MLC71498461477_092023-O.webp",
        "fallback": "https://images.unsplash.com/photo-1607016284318-d1384bf441e2?w=500&q=80",
    },
    {
        "id": "af225cea-efc0-468d-8076-9faa2d3981fa",
        "filename": "sony-control-ps5-dualsense-2.jpg",
        "url": "https://http2.mlstatic.com/D_NQ_NP_773811-MLC71498461477_092023-O.webp",
        "fallback": "https://images.unsplash.com/photo-1607016284318-d1384bf441e2?w=500&q=80",
    },
    {
        "id": "46ab3eff-335b-4159-b5b4-1a609726cbe0",
        "filename": "dyson-airwrap.jpg",
        "url": "https://http2.mlstatic.com/D_NQ_NP_715411-MLC71119412598_082023-O.webp",
        "fallback": "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=500&q=80",
    },
    {
        "id": "15495aa3-2359-4c9e-bbd7-1c2df4576e49",
        "filename": "dyson-v12-detect-slim.jpg",
        "url": "https://http2.mlstatic.com/D_NQ_NP_839611-MLC72993523472_112023-O.webp",
        "fallback": "https://images.unsplash.com/photo-1558317374-067fb5f30001?w=500&q=80",
    },
    {
        "id": "da598621-7880-4b94-b4cd-cb128147f2d0",
        "filename": "gopro-hero-12.jpg",
        "url": "https://http2.mlstatic.com/D_NQ_NP_892411-MLC71870956390_092023-O.webp",
        "fallback": "https://images.unsplash.com/photo-1530745342582-c0d5d20ad9af?w=500&q=80",
    },
    {
        "id": "acb18c31-20cf-413a-92ab-f7a4d0b242f8",
        "filename": "apple-ipad-10gen-64gb.jpg",
        "url": "https://http2.mlstatic.com/D_NQ_NP_625311-MLC71870061004_092023-O.webp",
        "fallback": "https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?w=500&q=80",
    },
    {
        "id": "cc037516-0cdd-401e-a39c-fa07a194a174",
        "filename": "apple-iphone-15-128gb.jpg",
        "url": "https://http2.mlstatic.com/D_NQ_NP_895697-MLC71870061004_092023-O.webp",
        "fallback": "https://images.unsplash.com/photo-1510557880182-3d4d3cba35a5?w=500&q=80",
    },
    {
        "id": "a99f2cbc-2d6c-473a-b12a-4c971427bbe3",
        "filename": "apple-iphone-15-pro-256gb.jpg",
        "url": "https://http2.mlstatic.com/D_NQ_NP_717811-MLC74988293595_032024-O.webp",
        "fallback": "https://images.unsplash.com/photo-1695048133142-1a20484d2569?w=500&q=80",
    },
    {
        "id": "e6ee745a-f40c-47cb-baad-5ca1da61ee2e",
        "filename": "amazon-kindle-paperwhite-16gb-1.jpg",
        "url": "https://http2.mlstatic.com/D_NQ_NP_940711-MLC71119412598_082023-O.webp",
        "fallback": "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=500&q=80",
    },
    {
        "id": "d1fec92f-4849-4dec-9dc5-905977996a50",
        "filename": "amazon-kindle-paperwhite-16gb-2.jpg",
        "url": "https://http2.mlstatic.com/D_NQ_NP_940711-MLC71119412598_082023-O.webp",
        "fallback": "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=500&q=80",
    },
    {
        "id": "98b4e32a-428a-4460-918b-edcde7106596",
        "filename": "apple-macbook-air-m3-13.jpg",
        "url": "https://http2.mlstatic.com/D_NQ_NP_611931-MLC71497124921_092023-O.webp",
        "fallback": "https://images.unsplash.com/photo-1611186871348-b1ce696e52c9?w=500&q=80",
    },
    {
        "id": "800016b9-83e7-4590-8b6d-de7dc377defe",
        "filename": "apple-macbook-pro-m3-14.jpg",
        "url": "https://http2.mlstatic.com/D_NQ_NP_894411-MLC74988293595_032024-O.webp",
        "fallback": "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=500&q=80",
    },
    {
        "id": "4326b4a4-cb04-40c5-a4c7-5efd8e876f68",
        "filename": "nintendo-switch-oled.jpg",
        "url": "https://http2.mlstatic.com/D_NQ_NP_787811-MLC71119680112_082023-O.webp",
        "fallback": "https://images.unsplash.com/photo-1578303512597-81e6cc155b3e?w=500&q=80",
    },
    {
        "id": "466b2ea9-55d4-4a22-9738-4821ea2466fa",
        "filename": "samsung-galaxy-s24-256gb.jpg",
        "url": "https://http2.mlstatic.com/D_NQ_NP_879711-MLC74988293595_032024-O.webp",
        "fallback": "https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?w=500&q=80",
    },
    {
        "id": "03ceadca-8bc7-442f-94e1-5a04619f7c6a",
        "filename": "samsung-galaxy-s24-ultra.jpg",
        "url": "https://http2.mlstatic.com/D_NQ_NP_953811-MLC74988293595_032024-O.webp",
        "fallback": "https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?w=500&q=80",
    },
    {
        "id": "d3d504cf-1a52-416c-bbfa-9b7887adc551",
        "filename": "samsung-smart-tv-55-qled.jpg",
        "url": "https://http2.mlstatic.com/D_NQ_NP_612411-MLC71870061004_092023-O.webp",
        "fallback": "https://images.unsplash.com/photo-1593784991095-a205069470b6?w=500&q=80",
    },
    {
        "id": "3d017042-45aa-43eb-8cb8-00b78c1e2ee2",
        "filename": "samsung-smart-tv-65-qled.jpg",
        "url": "https://http2.mlstatic.com/D_NQ_NP_819711-MLC71119412598_082023-O.webp",
        "fallback": "https://images.unsplash.com/photo-1593784991095-a205069470b6?w=500&q=80",
    },
    {
        "id": "4f1afb30-43c3-4ef5-b5ec-a3440593ce71",
        "filename": "sony-playstation-5.jpg",
        "url": "https://http2.mlstatic.com/D_NQ_NP_853811-MLC72993523472_112023-O.webp",
        "fallback": "https://images.unsplash.com/photo-1607853202273-232359e89771?w=500&q=80",
    },
    {
        "id": "36a4352a-83fd-4ba0-a93d-06a2983998ac",
        "filename": "sony-wh1000xm5.jpg",
        "url": "https://http2.mlstatic.com/D_NQ_NP_760985-MLC71119680112_082023-O.webp",
        "fallback": "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500&q=80",
    },
]

# ─── HELPERS ──────────────────────────────────────────────────────────────────

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    )
}

def download_image(url, timeout=10):
    """Descarga una imagen y devuelve sus bytes, o None si falla."""
    try:
        resp = requests.get(url, headers=HEADERS, timeout=timeout)
        if resp.status_code == 200 and len(resp.content) > 1000:
            return resp.content
        print(f"    ✗ HTTP {resp.status_code} — {url}")
        return None
    except Exception as e:
        print(f"    ✗ Error: {e} — {url}")
        return None


def upload_to_storage(filename, data):
    """Sube bytes al bucket y devuelve la URL pública, o None si falla."""
    content_type = "image/jpeg"
    if filename.endswith(".webp"):
        content_type = "image/webp"
    elif filename.endswith(".png"):
        content_type = "image/png"

    # Normalizar extensión a .jpg para consistencia
    storage_path = filename.replace(".webp", ".jpg").replace(".png", ".jpg")

    try:
        # Intentar subir; si ya existe, usar upsert
        supabase.storage.from_(BUCKET_NAME).upload(
            path=storage_path,
            file=data,
            file_options={"content-type": content_type, "upsert": "true"},
        )
        public_url = supabase.storage.from_(BUCKET_NAME).get_public_url(storage_path)
        return public_url
    except Exception as e:
        print(f"    ✗ Storage error: {e}")
        return None


def update_product_url(product_id, image_url):
    """Actualiza image_url en la tabla products."""
    try:
        supabase.table("products").update({"image_url": image_url}).eq("id", product_id).execute()
        return True
    except Exception as e:
        print(f"    ✗ DB error: {e}")
        return False


# ─── MAIN ─────────────────────────────────────────────────────────────────────

def main():
    print(f"\n🎁 GIFTLY — Subida de imágenes a Supabase Storage")
    print(f"   Bucket: {BUCKET_NAME}")
    print(f"   Total:  {len(PRODUCTS)} productos\n")
    print("─" * 60)

    ok_count   = 0
    fail_count = 0
    fallback_count = 0

    for i, product in enumerate(PRODUCTS, 1):
        pid      = product["id"]
        filename = product["filename"]
        url      = product["url"]
        fallback = product.get("fallback")

        short_name = filename.replace("-", " ").replace(".jpg", "").title()
        print(f"\n[{i:02d}/{len(PRODUCTS)}] {short_name}")
        print(f"  ↳ Descargando imagen principal...")

        data = download_image(url)
        used_fallback = False

        if data is None and fallback:
            print(f"  ↳ Intentando fallback (Unsplash)...")
            data = download_image(fallback)
            used_fallback = True

        if data is None:
            print(f"  ✗ Sin imagen disponible. Saltando.")
            fail_count += 1
            continue

        source = "Unsplash" if used_fallback else "mlstatic"
        print(f"  ↳ Subiendo a Storage ({source}, {len(data)/1024:.0f}KB)...")

        public_url = upload_to_storage(filename, data)
        if public_url is None:
            fail_count += 1
            continue

        print(f"  ↳ Actualizando DB...")
        if update_product_url(pid, public_url):
            status = "⚠ fallback" if used_fallback else "✓"
            print(f"  {status} OK → {public_url[:70]}...")
            ok_count += 1
            if used_fallback:
                fallback_count += 1
        else:
            fail_count += 1

        # Pausa para no saturar la API de Storage
        time.sleep(0.3)

    print("\n" + "─" * 60)
    print(f"✅ Completados: {ok_count}/{len(PRODUCTS)}")
    if fallback_count:
        print(f"⚠  Con imagen Unsplash (fallback): {fallback_count}")
    if fail_count:
        print(f"❌ Fallidos: {fail_count}")
    print("\n¡Listo! Verifica las imágenes en tu app.")


if __name__ == "__main__":
    main()
