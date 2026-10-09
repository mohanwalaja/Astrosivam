/** Shared ceiling for one family checkout; both HTTP backends enforce it. */
export const MAX_FAMILY_ORDER_ITEMS = 6;

/** True only while another report can still be added to this checkout. */
export function hasFamilyOrderCapacity(itemCount: number): boolean {
  return Number.isInteger(itemCount) && itemCount >= 0 && itemCount < MAX_FAMILY_ORDER_ITEMS;
}
