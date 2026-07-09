import { supabase } from '../lib/supabase';

export async function fetchUserWishlists(userId) {
  return supabase
    .from('wishlists')
    .select('id, title, description, visibility, created_at, wishlist_items(count)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
}

export async function createWishlist({ userId, title, visibility, description = null }) {
  return supabase.from('wishlists').insert({
    user_id:     userId,
    title,
    visibility,
    ...(description ? { description } : {}),
  });
}

export async function deleteWishlist(id) {
  return supabase.from('wishlists').delete().eq('id', id);
}

export async function fetchWishlistItems(wishlistId) {
  return supabase
    .from('wishlist_items')
    .select('id, product_id, note, status, created_at')
    .eq('wishlist_id', wishlistId)
    .order('created_at', { ascending: false });
}

export async function addWishlistItem({ wishlistId, productId }) {
  return supabase.from('wishlist_items').upsert(
    { wishlist_id: wishlistId, product_id: String(productId) },
    { onConflict: 'wishlist_id,product_id' }
  );
}

export async function removeWishlistItem(itemId) {
  return supabase.from('wishlist_items').delete().eq('id', itemId);
}

export async function fetchUserWishlistsBasic(userId) {
  return supabase
    .from('wishlists')
    .select('id, title')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
}
