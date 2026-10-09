/**
 * Express 5 types route parameters as `string | string[]`, because a parameter
 * can repeat when a path uses a wildcard or a repeatable modifier. Every route
 * in this project declares plain `:name` parameters, so the value is always a
 * single string; this helper narrows it once instead of scattering casts
 * (or accidentally accepting an array) through the handlers.
 */
export function routeParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value.length > 0 ? value[0] : '';
  }
  return value ?? '';
}

/** Numeric route parameter, e.g. `/orders/:id/items/:itemId`. */
export function numericRouteParam(value: string | string[] | undefined): number {
  return Number(routeParam(value));
}
