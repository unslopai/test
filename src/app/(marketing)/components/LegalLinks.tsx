import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import type { SupportedLocale } from '@/i18n/config';
import { liveLegalPageSlugs } from '@/lib/legal/legal-pages';

interface LegalLinksProps {
    readonly locale: SupportedLocale;
    readonly className?: string;
}

/**
 * Footer-Links auf die freigeschalteten Rechtsseiten (LEGAL_PAGES_SPEC.md
 * §5.2). Rendert nichts, solange das Flag leer ist — dann sieht der Footer
 * aus wie heute. Wird im Marketing-Footer und auf der Login-Seite genutzt,
 * weil das Impressum von jeder Seite erreichbar sein muss.
 */
export async function LegalLinks({ locale, className }: LegalLinksProps) {
    const liveSlugs = liveLegalPageSlugs();
    if (liveSlugs.length === 0) return null;

    const legalText = await getTranslations('marketing.legal');
    return (
        <nav aria-label={legalText('navLabel')} className={className}>
            {liveSlugs.map((slug) => (
                <Link
                    key={slug}
                    href={`/${locale}/${slug}`}
                    className="text-zinc-400 transition-colors hover:text-zinc-100"
                >
                    {legalText(`links.${slug}`)}
                </Link>
            ))}
        </nav>
    );
}
