import React from 'react';

/**
 * Authentic ASTRO SIVAM Cosmic Background
 * Deep celestial dark slate/indigo with warm amber-gold and navagraha cosmic glow.
 */
export const CosmicBackground: React.FC = () => {
  return (
    <div
      className="fixed inset-0 pointer-events-none z-0 overflow-hidden select-none"
      aria-hidden="true"
    >
      <div className="absolute inset-0 bg-[#0a0714] dark:bg-[#070512] transition-colors duration-500" />
      <div className="absolute -top-32 -right-32 w-[550px] h-[550px] rounded-full bg-gradient-to-br from-amber-500/10 via-amber-600/5 to-transparent blur-3xl" />
      <div className="absolute -top-20 -left-20 w-[600px] h-[600px] rounded-full bg-gradient-to-br from-purple-700/10 via-indigo-900/5 to-transparent blur-3xl" />
      <div className="absolute -bottom-40 left-1/2 -translate-x-1/2 w-[800px] h-[500px] rounded-full bg-gradient-to-t from-indigo-950/20 via-purple-950/10 to-transparent blur-3xl" />
      <div
        className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05]"
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, rgba(255, 255, 255, 0.4) 1px, transparent 0)`,
          backgroundSize: '40px 40px'
        }}
      />
    </div>
  );
};
