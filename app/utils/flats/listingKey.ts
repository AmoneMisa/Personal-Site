import type { FlatListing } from "~/types/flats";

/**
 * Stable identity for one listing across devices.
 *
 * Source ids are not globally unique, and the same provider reuses an id in
 * different regional catalogues, so the source and country are part of the key.
 *
 * The casing is not cosmetic: this must produce byte-identical keys to the
 * Flutter app's `listingKey` (flat-finder app/lib/models/listing_identity.dart)
 * and to what the backend stores in user_data.saved_items.item_key. If the web
 * wrote "OLX:uz:42" where the phone wrote "olx:UZ:42", the same flat would sync
 * as two separate favourites and the union merge would never dedupe them.
 */
export function flatListingKey(listing: Pick<FlatListing, "source" | "country" | "id">): string {
  return listingKeyParts(listing.source, listing.country, listing.id);
}

export function listingKeyParts(source: string, country: string, id: string): string {
  return `${String(source).toLowerCase()}:${String(country).toUpperCase()}:${id}`;
}
