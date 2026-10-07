import { NextResponse } from 'next/server';
import * as cheerio from 'cheerio';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get('url');

  if (!url) {
    return NextResponse.json(
      { error: 'Missing "url" query parameter' },
      { status: 400 }
    );
  }

  try {
    // Validate URL format
    const parsedUrl = new URL(url);

    // Fetch the target webpage with a User-Agent to avoid being blocked
    const response = await fetch(parsedUrl.toString(), {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      // Optional: Add a timeout using AbortController if needed
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch the URL. Status: ${response.status}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // Helper function to resolve relative image URLs to absolute URLs
    const resolveUrl = (relativeUrl: string | undefined) => {
      if (!relativeUrl) return null;
      try {
        return new URL(relativeUrl, parsedUrl.origin).toString();
      } catch {
        return relativeUrl;
      }
    };

    // Extract Title (OG -> Twitter -> Standard Title)
    const title =
      $('meta[property="og:title"]').attr('content') ||
      $('meta[name="twitter:title"]').attr('content') ||
      $('title').text() ||
      null;

    // Extract Description (OG -> Twitter -> Standard Description)
    const description =
      $('meta[property="og:description"]').attr('content') ||
      $('meta[name="twitter:description"]').attr('content') ||
      $('meta[name="description"]').attr('content') ||
      null;

    // Extract Image (OG -> Twitter -> First image on page)
    const rawImage =
      $('meta[property="og:image"]').attr('content') ||
      $('meta[property="og:image:secure_url"]').attr('content') ||
      $('meta[name="twitter:image"]').attr('content') ||
      $('img').attr('src');

    const image = resolveUrl(rawImage);

    // Extract Favicon
    const rawFavicon =
      $('link[rel="icon"]').attr('href') ||
      $('link[rel="shortcut icon"]').attr('href') ||
      '/favicon.ico';
    
    const favicon = resolveUrl(rawFavicon);

    return NextResponse.json({
      url: parsedUrl.toString(),
      title: title ? title.trim() : null,
      description: description ? description.trim() : null,
      image,
      favicon,
    });
  } catch (error: any) {
    console.error('Preview generation error:', error.message);
    return NextResponse.json(
      { error: 'Failed to generate preview', details: error.message },
      { status: 500 }
    );
  }
}
