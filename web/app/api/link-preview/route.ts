import { NextResponse } from 'next/server';
import fetch from 'node-fetch';

interface MetaTags {
  title?: string;
  description?: string;
  ogImage?: string;
}

async function getMetaTags(url: string): Promise<MetaTags> {
  const headers = new Headers({
    Accept: 'text/html',
  });

  try {
    const response = await fetch(url, { headers });
    if (!response.ok) throw new Error(`Failed to fetch ${url}`);

    // Read the HTML content
    const htmlContent = await response.text();

    // Use regular expressions to extract meta tags
    const metaTitleMatch = htmlContent.match(/<title[^>]*>(.*?)<\/title>/);
    const metaDescriptionMatch = htmlContent.match(/<meta\s+name="description"\s+content="(.*?)"\s*\/?>/);
    const ogImageMatch = htmlContent.match(/<meta\s+property="og:image"\s+content="(.*?)"\s*\/?>/);

    return {
      title: metaTitleMatch ? metaTitleMatch[1] : undefined,
      description: metaDescriptionMatch ? metaDescriptionMatch[1] : undefined,
      ogImage: ogImageMatch ? ogImageMatch[1] : undefined,
    };
  } catch (error) {
    console.error(`Error fetching meta tags for ${url}:`, error);
    return {};
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get('link');

  if (!url) {
    return NextResponse.json({ error: 'Missing link parameter' }, { status: 400 });
  }

  try {
    const metaTags = await getMetaTags(url);

    return NextResponse.json(metaTags, { status: 200 });
  } catch (error) {
    console.error(`Error processing request for ${url}:`, error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
