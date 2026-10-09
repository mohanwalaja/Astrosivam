import React from 'react';
import { Helmet } from 'react-helmet-async';

export interface SEOProps {
  title?: string;
  description?: string;
  canonical?: string;
  ogImage?: string;
  ogType?: 'website' | 'article' | 'profile';
  keywords?: string;
  noindex?: boolean;
}

const DEFAULT_TITLE = 'ASTRO SIVAM - Understand Your Life Through Vedic Astrology | astrosivam.com';
const DEFAULT_DESCRIPTION = 'ASTRO SIVAM (astrosivam.com) - Authentic Vedic Astrology Platform. Get precision Birth Jathagam (Horoscope / Kundali), 10-Poruthams Marriage Compatibility Matching, Sacred Baby Naming (Namakaran) & Subha Muhurtham Auspicious Dates in Tamil, English & Hindi.';
const DEFAULT_IMAGE = 'https://astrosivam.com/astrosivam_og_image.jpg?v=20261003';
const SITE_NAME = 'ASTRO SIVAM';

export const SEO: React.FC<SEOProps> = ({
  title = DEFAULT_TITLE,
  description = DEFAULT_DESCRIPTION,
  canonical = 'https://astrosivam.com/',
  ogImage = DEFAULT_IMAGE,
  ogType = 'website',
  keywords,
  noindex = false,
}) => {
  return (
    <Helmet>
      {/* Standard Meta Tags */}
      <title>{title}</title>
      <meta name="description" content={description} />
      {keywords && <meta name="keywords" content={keywords} />}
      <link rel="canonical" href={canonical} />
      {noindex ? (
        <meta name="robots" content="noindex, nofollow" />
      ) : (
        <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" />
      )}

      {/* OpenGraph Meta Tags */}
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:type" content={ogType} />
      <meta property="og:url" content={canonical} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={ogImage} />
      <meta property="og:image:secure_url" content={ogImage} />
      <meta property="og:image:alt" content={title} />

      {/* Twitter Card Meta Tags */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:site" content="@astrosivam" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={ogImage} />
    </Helmet>
  );
};
