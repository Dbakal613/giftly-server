import { supabase } from '../lib/supabase';

export async function upsertProduct(product) {
  const { data: existing } = await supabase
    .from('products')
    .select('id')
    .eq('name', product.name)
    .eq('store', product.store || '')
    .maybeSingle();

  if (existing) return existing.id;

  const { data: newP, error } = await supabase
    .from('products')
    .insert({
      name:        product.name,
      brand:       product.brand || '',
      store:       product.store || '',
      price:       Math.round(product.price || 0),
      image_emoji: product.image_emoji || '',
      image_url:   product.image_url || null,
      category:    product.category || '',
    })
    .select('id')
    .single();

  if (error) throw new Error('No se pudo guardar el producto: ' + error.message);
  return newP.id;
}
