// @polsia:user-owned

export const COHORT_OFFER_ID = 'cohorte-12-semanas';
export const COHORT_DURATION_WEEKS = 12;
export const COHORT_MIN_PRICE_USD = 1500;
export const COHORT_MAX_PRICE_USD = 2500;
export const COHORT_DEFAULT_PRICE_USD = 1800;
const priceRangeFormatter = new Intl.NumberFormat('es-ES', {
  maximumFractionDigits: 0,
  useGrouping: 'always',
});
export const COHORT_PRICE_RANGE_LABEL = `US$${priceRangeFormatter.format(COHORT_MIN_PRICE_USD)}–${priceRangeFormatter.format(COHORT_MAX_PRICE_USD)}`;

export function isCohortPrice(value: number) {
  return Number.isInteger(value) && value >= COHORT_MIN_PRICE_USD && value <= COHORT_MAX_PRICE_USD;
}
