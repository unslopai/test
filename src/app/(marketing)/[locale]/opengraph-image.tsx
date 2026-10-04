import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ImageResponse } from 'next/og';
import { notFound } from 'next/navigation';
import { isSupportedLocale, type SupportedLocale } from '@/i18n/config';
import englishCatalog from '../../../../messages/en.json';
import germanCatalog from '../../../../messages/de.json';

/**
 * Branded 1200×630 og:image for the landing page (ROADMAP §2: link previews
 * on X/LinkedIn/Slack rendered text-only before this existed). Rendered from
 * the same design tokens as the landing: #0a0a0b surface, dot grid, Silkscreen
 * wordmark + lime caret, Geist headline.
 *
 * Copy comes from the catalogs via direct JSON import (kept in parity by
 * catalog-parity.test.ts) instead of next-intl: metadata image routes run
 * outside the next-intl request context, and the explicit locale param is the
 * only locale source we need here.
 */

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = 'Unslop — Review gate for AI-generated code';

const CATALOGS: Record<SupportedLocale, typeof englishCatalog> = {
  en: englishCatalog,
  de: germanCatalog,
};

const SURFACE_COLOR = '#0a0a0b';
const DOT_GRID_COLOR = '#1c1c21';
const ACCENT_COLOR = '#bef264';

interface OpenGraphImageProps {
  readonly params: Promise<{ locale: string }>;
}

export default async function OpenGraphImage({ params }: OpenGraphImageProps) {
  const { locale } = await params;
  if (!isSupportedLocale(locale)) {
    notFound();
  }
  const metaText = CATALOGS[locale].marketing.meta;
  const assetsDirectory = join(process.cwd(), 'src', 'app', '(marketing)', 'assets');
  const [silkscreenBold, geistBold, geistRegular] = await Promise.all([
    readFile(join(assetsDirectory, 'silkscreen-bold.ttf')),
    readFile(join(assetsDirectory, 'geist-bold.ttf')),
    readFile(join(assetsDirectory, 'geist-regular.ttf')),
  ]);

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '64px 80px',
          backgroundColor: SURFACE_COLOR,
          backgroundImage: `radial-gradient(circle closest-side, ${DOT_GRID_COLOR} 13%, transparent 13%)`,
          backgroundSize: '36px 36px',
          backgroundRepeat: 'repeat',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <span style={{ fontFamily: 'Silkscreen', fontSize: 48, color: '#fafafa' }}>unslop</span>
          <div
            style={{ width: 20, height: 38, marginLeft: 12, backgroundColor: ACCENT_COLOR, display: 'flex' }}
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div
            style={{
              fontFamily: 'Geist',
              fontSize: 84,
              fontWeight: 700,
              color: '#fafafa',
              lineHeight: 1.05,
              maxWidth: 1000,
              display: 'flex',
            }}
          >
            {metaText.ogTitle}
          </div>
          <div
            style={{ width: 128, height: 8, marginTop: 32, backgroundColor: ACCENT_COLOR, display: 'flex' }}
          />
          <div
            style={{
              marginTop: 32,
              fontFamily: 'Geist',
              fontWeight: 400,
              fontSize: 32,
              color: '#a1a1aa',
              lineHeight: 1.4,
              maxWidth: 940,
              display: 'flex',
            }}
          >
            {metaText.ogTagline}
          </div>
        </div>
        <div style={{ display: 'flex', fontFamily: 'Silkscreen', fontSize: 26, color: '#71717a' }}>
          unslop.codes
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: 'Silkscreen', data: silkscreenBold, weight: 700, style: 'normal' },
        { name: 'Geist', data: geistBold, weight: 700, style: 'normal' },
        { name: 'Geist', data: geistRegular, weight: 400, style: 'normal' },
      ],
    },
  );
}
