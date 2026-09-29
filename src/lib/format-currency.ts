/** Formats an amount in minor units (e.g. cents) as a localized currency string. */
export function formatMinorUnits(amountInMinorUnits: number, currencyCode: string, locale: string): string {
    return new Intl.NumberFormat(locale, { style: 'currency', currency: currencyCode })
        .format(amountInMinorUnits / 100);
}
