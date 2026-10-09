import React from 'react';
import type { LucideIcon } from 'lucide-react';

export interface ServicePageHeaderProps {
  icon: LucideIcon;
  eyebrow: string;
  title: string;
  description: string;
}

/** Shared title treatment keeps the main service pages visually related. */
export const ServicePageHeader: React.FC<ServicePageHeaderProps> = ({
  icon: Icon,
  eyebrow,
  title,
  description
}) => (
  <header className="service-page-hero">
    <div className="service-page-hero__orbit" aria-hidden="true" />
    <div className="service-page-hero__content">
      <div className="service-page-hero__eyebrow">
        <span className="service-page-hero__icon"><Icon className="h-3.5 w-3.5" aria-hidden="true" /></span>
        <span>{eyebrow}</span>
      </div>
      <h1 className="service-page-hero__title">{title}</h1>
      <p className="service-page-hero__description">{description}</p>
    </div>
  </header>
);
