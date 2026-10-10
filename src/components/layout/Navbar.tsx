import React, { useState } from 'react';
import {
  Sparkles,
  Heart,
  Baby,
  Home as HomeIcon,
  Users,
  LogOut,
  Shield,
  Menu,
  X,
  ChevronDown,
  ChevronRight,
  FileText,
  Layers,
  ShoppingBag,
  Calendar,
  CircleHelp
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { resolveDisplayName } from '../../utils/displayName';
import { useLanguage } from '../../context/LanguageContext';
import { useCart } from '../../context/CartContext';
import { BrandWordmark } from '../common/BrandLockup';

interface NavbarProps {
  currentRoute: string;
  onNavigate: (route: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ currentRoute, onNavigate }) => {
  const { user, birthProfile, isAdmin, logout } = useAuth();
  // The name saved in the website profile is authoritative — never a stale
  // name or one with a "(Google)" tag attached.
  const displayName = user ? resolveDisplayName(birthProfile?.name, user.name, user.email) : '';
  const { t } = useLanguage();
  const { items: cartItems, openCart } = useCart();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  const navLinks = [
    { key: 'home', label: t('home'), route: 'home', icon: HomeIcon },
    { key: 'birth_jathagam', label: t('birth_jathagam'), route: 'birth-jathagam', icon: Sparkles },
    { key: 'marriage_compatibility', label: t('marriage_compatibility'), route: 'marriage-compatibility', icon: Heart },
    { key: 'baby_naming', label: t('baby_naming'), route: 'baby-naming', icon: Baby },
    { key: 'muhurtham', label: t('muhurtham') || 'Subha Muhurtham', route: 'muhurtham', icon: Calendar },
    { key: 'team', label: 'Astrology Team', route: 'team', icon: Users }
  ];

  // Keep the phone menu focused on the core customer journey. Supporting
  // company links remain available in the footer and on larger screens.
  const mobileNavLinks = [
    ...navLinks.filter(link => link.key !== 'team'),
    { key: 'how_it_works', label: t('how_it_works'), route: 'how-it-works', icon: CircleHelp }
  ];

  const navTo = (route: string) => {
    onNavigate(route);
    setIsMobileMenuOpen(false);
    setIsUserMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-40 bg-[#0f172a]/75 backdrop-blur-md border-b border-white/10 text-white shadow-xl select-none transition-colors">
      {/* Main Navigation Bar */}
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between sm:h-20 md:h-22">

          {/* Compact on phones; the full brand lock-up returns above 640px. */}
          <button
            type="button"
            onClick={() => navTo('home')}
            className="group flex shrink-0 items-center gap-2 py-1 text-left sm:gap-3.5"
            title="ASTRO SIVAM - Indian Vedic Astrology"
            aria-label="ASTRO SIVAM home"
          >
            {/* Identical to the footer lock-up — same shared component, so the
                header and footer brand blocks cannot drift apart. emblemAlt is
                empty because the button already carries the name in aria-label. */}
            <BrandWordmark emblemAlt="" />
          </button>

          {/* Right Action Cluster: User & Auth Buttons & Family Tray */}
          <div className="flex items-center gap-2 sm:gap-3">

            {/* Orders Cart Button */}
            {cartItems.length > 0 && (
              <button
                type="button"
                onClick={openCart}
                className="flex min-h-11 items-center gap-1.5 rounded-xl border border-amber-500/40 bg-amber-500/10 px-2.5 text-sm font-bold text-amber-400 shadow-xs transition-all hover:bg-amber-500/20 active:scale-95 sm:px-3"
                title="View Orders Cart"
                aria-label={`View orders cart with ${cartItems.length} ${cartItems.length === 1 ? 'item' : 'items'}`}
              >
                <ShoppingBag className="h-4 w-4" />
                <span className="hidden md:inline">Cart</span>
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 text-[11px] font-black text-slate-950">
                  {cartItems.length}
                </span>
              </button>
            )}

            {user ? (
              <div className="relative hidden lg:block">
                <button
                  type="button"
                  onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                  className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/20 text-xs font-semibold text-slate-200 transition-colors backdrop-blur-sm"
                >
                  <div className="w-6 h-6 rounded-full bg-gradient-to-r from-[#ffb703] to-[#fb8500] text-slate-950 flex items-center justify-center font-black text-[11px] shadow-xs">
                    {displayName.charAt(0).toUpperCase()}
                  </div>
                  <span className="hidden sm:inline max-w-[100px] truncate">{displayName}</span>
                  {isAdmin && (
                    <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-purple-500/30 text-purple-300 border border-purple-500/40">
                      ADMIN
                    </span>
                  )}
                  <ChevronDown className="w-3 h-3 text-slate-400" />
                </button>

                {isUserMenuOpen && (
                  <div className="absolute right-0 mt-2 w-64 bg-[#0d1024]/95 backdrop-blur-2xl border border-white/15 rounded-2xl shadow-2xl p-2 z-50 text-xs space-y-1.5 animate-in fade-in zoom-in-95 duration-150">
                    <div className="p-2.5 rounded-xl bg-white/[0.04] border border-white/10 flex items-center gap-2.5">
                      <div className="relative w-9 h-9 shrink-0 rounded-xl bg-gradient-to-br from-amber-400 via-amber-500 to-amber-600 text-slate-950 font-black text-sm flex items-center justify-center shadow-xs">
                        {displayName ? displayName.charAt(0).toUpperCase() : 'U'}
                        <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-[#0d1024]" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-bold text-white text-xs truncate flex items-center gap-1.5">
                          <span className="truncate">{displayName || 'User'}</span>
                          {isAdmin && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-purple-500/20 text-purple-300 border border-purple-500/30">
                              ADMIN
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400 truncate">{user.email}</div>
                      </div>
                    </div>

                    <div className="space-y-1 pt-1">
                      <button
                        onClick={() => navTo('dashboard')}
                        className="w-full text-left px-3 py-2 rounded-xl text-slate-200 hover:bg-amber-400/10 hover:text-amber-200 flex items-center gap-2.5 transition-colors font-medium group"
                      >
                        <div className="w-7 h-7 rounded-lg bg-amber-400/15 border border-amber-400/25 flex items-center justify-center text-amber-300 group-hover:bg-amber-400/25">
                          <Layers className="w-3.5 h-3.5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-xs text-white">Orders &amp; Delivery Status</div>
                          <div className="text-[10px] text-slate-400">View horoscope PDFs &amp; charts</div>
                        </div>
                        <ChevronRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-amber-300 transition-colors" />
                      </button>

                      {isAdmin && (
                        <button
                          onClick={() => navTo('admin')}
                          className="w-full text-left px-3 py-2 rounded-xl text-purple-200 hover:bg-purple-950/40 flex items-center gap-2.5 transition-colors font-medium border border-purple-500/20 group"
                        >
                          <div className="w-7 h-7 rounded-lg bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-300 group-hover:bg-purple-500/30">
                            <Shield className="w-3.5 h-3.5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-bold text-xs text-purple-200">Admin Control Center</div>
                            <div className="text-[10px] text-purple-300/70">Manage orders &amp; settings</div>
                          </div>
                          <ChevronRight className="w-3.5 h-3.5 text-purple-400/60 group-hover:text-purple-300 transition-colors" />
                        </button>
                      )}
                    </div>

                    <div className="pt-1 border-t border-white/10">
                      <button
                        onClick={() => {
                          logout();
                          navTo('home');
                        }}
                        className="w-full text-left px-3 py-2 rounded-xl text-rose-300 hover:bg-rose-950/30 hover:text-rose-200 flex items-center gap-2.5 transition-colors font-semibold"
                      >
                        <LogOut className="w-3.5 h-3.5 text-rose-400" />
                        <span>Sign Out</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="hidden items-center gap-2 lg:flex">
                <button
                  onClick={() => navTo('login')}
                  className="px-3 sm:px-4 py-1.5 sm:py-2 text-xs font-bold text-slate-200 hover:text-white bg-white/5 hover:bg-white/10 border border-white/20 hover:border-white/40 rounded-xl backdrop-blur-sm transition-all duration-200 active:scale-95 shadow-xs whitespace-nowrap"
                >
                  {t('login')}
                </button>
                <button
                  onClick={() => navTo('register')}
                  className="px-3.5 sm:px-4.5 py-1.5 sm:py-2 rounded-xl bg-gradient-to-r from-[#ffb703] to-[#fb8500] hover:from-[#ffc324] hover:to-[#fc911b] text-slate-950 text-xs font-black shadow-md hover:shadow-[0_4px_16px_rgba(251,133,0,0.4)] hover:-translate-y-0.5 active:translate-y-0 active:scale-95 transition-all duration-200 whitespace-nowrap"
                >
                  {t('register')}
                </button>
              </div>
            )}

            {/* Mobile Menu Toggle Button */}
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/15 bg-white/5 text-slate-200 transition-colors hover:bg-white/10 hover:text-white lg:hidden"
              aria-label={isMobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
              aria-expanded={isMobileMenuOpen}
            >
              {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Desktop service navigation: a dedicated, centered row keeps the brand clear */}
      <div className="hidden lg:block border-t border-white/[0.06] bg-slate-950/20">
        <nav aria-label="Main navigation" className="max-w-7xl mx-auto px-6 lg:px-8 flex items-center justify-center gap-2 py-2">
          {navLinks.map(link => {
            const isActive = currentRoute === link.route;
            const Icon = link.icon;
            return (
              <button
                key={link.key}
                onClick={() => navTo(link.route)}
                aria-current={isActive ? 'page' : undefined}
                className={`group flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-semibold tracking-wide whitespace-nowrap transition-all duration-200 cursor-pointer ${
                  isActive
                    ? 'bg-amber-400/15 text-amber-200 ring-1 ring-inset ring-amber-300/30 shadow-[0_4px_18px_rgba(245,158,11,0.08)]'
                    : 'text-slate-300 hover:text-white hover:bg-white/[0.07]'
                }`}
                title={link.label}
              >
                <Icon className={`w-4 h-4 transition-colors ${isActive ? 'text-amber-300' : 'text-slate-400 group-hover:text-amber-300'}`} strokeWidth={1.9} />
                <span>{link.label}</span>
                {isActive && <span className="w-1.5 h-1.5 rounded-full bg-amber-300 ml-0.5" />}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Compact modern mobile navigation */}
      {isMobileMenuOpen && (
        <div className="max-h-[calc(100vh-4rem)] overflow-y-auto border-b border-white/10 bg-[#0c0f24]/98 backdrop-blur-2xl shadow-2xl lg:hidden">
          <nav aria-label="Mobile navigation" className="mx-auto max-w-7xl px-3.5 py-3.5">
            <p className="px-2 pb-2 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">
              Vedic Services
            </p>

            <div className="space-y-1.5">
              {mobileNavLinks.map(link => {
                const isActive = currentRoute === link.route;
                const Icon = link.icon;
                return (
                  <button
                    type="button"
                    key={link.key}
                    onClick={() => navTo(link.route)}
                    aria-current={isActive ? 'page' : undefined}
                    className={`flex min-h-12 w-full items-center gap-3.5 rounded-2xl border px-3.5 text-left text-[15px] transition-all duration-150 ${
                      isActive
                        ? 'border-amber-400/35 bg-gradient-to-r from-amber-400/15 to-amber-500/5 font-bold text-white shadow-[0_2px_12px_rgba(245,158,11,0.08)]'
                        : 'border-white/5 font-medium text-slate-200 hover:border-white/10 hover:bg-white/[0.05]'
                    }`}
                  >
                    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition-colors ${
                      isActive ? 'bg-amber-400/20 text-amber-300' : 'bg-white/5 text-slate-400'
                    }`}>
                      <Icon className="h-4.5 w-4.5" strokeWidth={1.8} />
                    </div>
                    <span className="flex-1 font-semibold">{link.label}</span>
                    <ChevronRight className={`h-4 w-4 transition-transform ${isActive ? 'text-amber-300' : 'text-slate-600'}`} />
                  </button>
                );
              })}
            </div>

            {/* User Account / Auth Section */}
            <div className="mt-4 pt-3.5 border-t border-white/10">
              {user ? (
                <div className="space-y-2.5">
                  {/* Authenticated User Header Card */}
                  <div className="flex items-center justify-between rounded-2xl border border-amber-500/25 bg-gradient-to-r from-amber-500/[0.12] via-slate-900/70 to-slate-900/50 p-3 backdrop-blur-md shadow-lg shadow-black/30">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 via-amber-500 to-amber-600 text-slate-950 font-black text-base shadow-[0_2px_12px_rgba(245,158,11,0.25)]">
                        {displayName ? displayName.charAt(0).toUpperCase() : 'U'}
                        <span className="absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-slate-900 ring-2 ring-slate-900">
                          <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <h4 className="truncate text-sm font-bold text-white tracking-tight">
                            {displayName || 'Member'}
                          </h4>
                          {isAdmin && (
                            <span className="shrink-0 rounded-md bg-purple-500/25 border border-purple-400/35 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-purple-200">
                              Admin
                            </span>
                          )}
                        </div>
                        <p className="truncate text-[11px] text-slate-400 font-medium">
                          {user.email || 'AstroSivam Account'}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        logout();
                        navTo('home');
                      }}
                      title="Sign out"
                      aria-label="Sign out"
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-300 transition-all hover:border-rose-500/40 hover:bg-rose-500/15 hover:text-rose-200 active:scale-95"
                    >
                      <LogOut className="h-4 w-4" strokeWidth={1.8} />
                    </button>
                  </div>

                  {/* Primary Action Card: Orders & Delivery Status */}
                  <button
                    type="button"
                    onClick={() => navTo('dashboard')}
                    className="group flex w-full items-center gap-3.5 rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-left transition-all duration-200 hover:border-amber-400/40 hover:bg-amber-400/[0.08] active:scale-[0.99]"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-400/15 border border-amber-400/30 text-amber-300 shadow-inner transition-colors group-hover:bg-amber-400/25 group-hover:text-amber-200">
                      <Layers className="h-5 w-5" strokeWidth={1.9} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-[14px] font-bold text-slate-100 group-hover:text-amber-200 transition-colors">
                          Orders &amp; Delivery Status
                        </span>
                        <ChevronRight className="h-4 w-4 text-slate-500 transition-transform group-hover:translate-x-0.5 group-hover:text-amber-300" />
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5 font-medium">
                        Track horoscope PDFs, charts &amp; consultations
                      </p>
                    </div>
                  </button>

                  {/* Admin Control Center Card (if admin) */}
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => navTo('admin')}
                      className="group flex w-full items-center gap-3.5 rounded-2xl border border-purple-500/25 bg-purple-950/25 p-3 text-left transition-all duration-200 hover:border-purple-400/40 hover:bg-purple-950/45 active:scale-[0.99]"
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-purple-500/20 border border-purple-500/40 text-purple-300 shadow-inner transition-colors group-hover:bg-purple-500/30 group-hover:text-purple-200">
                        <Shield className="h-5 w-5" strokeWidth={1.9} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="text-[14px] font-bold text-purple-200 group-hover:text-white transition-colors">
                            Admin Control Center
                          </span>
                          <ChevronRight className="h-4 w-4 text-purple-400/60 transition-transform group-hover:translate-x-0.5 group-hover:text-purple-300" />
                        </div>
                        <p className="text-[11px] text-purple-300/70 mt-0.5 font-medium">
                          Manage orders, report approvals &amp; system settings
                        </p>
                      </div>
                    </button>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => navTo('login')}
                    className="min-h-11 rounded-xl border border-white/20 bg-white/5 px-3 text-sm font-bold text-slate-100 transition-colors hover:bg-white/10"
                  >
                    {t('login')}
                  </button>
                  <button
                    type="button"
                    onClick={() => navTo('register')}
                    className="min-h-11 rounded-xl bg-gradient-to-r from-[#ffb703] to-[#fb8500] px-3 text-sm font-black text-slate-950 shadow-md"
                  >
                    {t('register')}
                  </button>
                </div>
              )}
            </div>

          </nav>
        </div>
      )}
    </header>
  );
};
