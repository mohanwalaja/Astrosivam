import React, { useState, useEffect } from 'react';
import { HelmetProvider } from 'react-helmet-async';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LanguageProvider } from './context/LanguageContext';
import { ThemeProvider } from './context/ThemeContext';
import { Navbar } from './components/layout/Navbar';
import { Footer } from './components/layout/Footer';
import { HomePage } from './pages/HomePage';
import { BirthJathagamPage } from './pages/BirthJathagamPage';
import { MarriageCompatibilityPage } from './pages/MarriageCompatibilityPage';
import { BabyNamingPage } from './pages/BabyNamingPage';
import { MuhurthamPage } from './pages/MuhurthamPage';
import { ServicesPage } from './pages/ServicesPage';
import { HowItWorksPage } from './pages/HowItWorksPage';
import { AboutPage } from './pages/AboutPage';
import { ContactPage } from './pages/ContactPage';
import { PoliciesPage } from './pages/PoliciesPage';
import { AstrologyTeamPage } from './pages/AstrologyTeamPage';
import { CustomerDashboard } from './pages/CustomerDashboard';
import { AdminPortal } from './pages/AdminPortal';
import { NotFoundPage } from './pages/NotFoundPage';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { LiveChatWidget } from './components/common/LiveChatWidget';
import { CosmicBackground } from './components/common/CosmicBackground';
import { CartProvider } from './context/CartContext';
import { FamilyCartDrawer } from './components/cart/FamilyCartDrawer';
import { UnifiedCheckoutModal } from './components/cart/UnifiedCheckoutModal';
import { FamilyCartFloatingBar } from './components/cart/FamilyCartFloatingBar';

function AppContent() {
  const getInitialRoute = () => {
    try {
      // 1. Check query parameter first if explicitly provided (e.g. /?route=muhurtham)
      const params = new URLSearchParams(window.location.search);
      const queryRoute = params.get('route');
      if (queryRoute) {
        if (queryRoute === 'admin' || queryRoute === 'admin-portal') return 'admin';
        if (queryRoute === 'eclipse-guide' || queryRoute === 'eclipse' || queryRoute === 'kiraganam') return 'services';
        if (queryRoute === 'logos' || queryRoute === 'brand-logos' || queryRoute === 'logo-concepts') return 'home';
        const validRoutes = [
          'home', 'services', 'birth-jathagam', 'marriage-compatibility', 'baby-naming', 'muhurtham',
          'how-it-works', 'about', 'team', 'contact', 'dashboard', 'login', 'register',
          'policy-privacy', 'policy-terms', 'policy-payment', 'policy-refund'
        ];
        if (validRoutes.includes(queryRoute)) return queryRoute;
      }

      // 2. Check path name for clean URL routing
      const rawPath = window.location.pathname.toLowerCase().replace(/\/+$/, '');
      const pathname = rawPath === '' ? '/' : rawPath;
      if (pathname === '/' || pathname === '/home') return 'home';

      if (
        pathname === '/admin' ||
        pathname === '/admin-portal' ||
        pathname === '/admin.php' ||
        pathname.endsWith('/admin') ||
        pathname.endsWith('/admin-portal')
      ) {
        return 'admin';
      }
      if (pathname === '/login') return 'login';
      if (pathname === '/register') return 'register';
      if (pathname === '/dashboard') return 'dashboard';
      if (pathname === '/services') return 'services';
      if (pathname === '/birth-jathagam') return 'birth-jathagam';
      if (pathname === '/marriage-compatibility') return 'marriage-compatibility';
      if (pathname === '/baby-naming') return 'baby-naming';
      if (pathname === '/muhurtham' || pathname === '/subha-muhurtham' || pathname === '/muhurtha') return 'muhurtham';
      if (pathname === '/how-it-works') return 'how-it-works';
      if (pathname === '/about') return 'about';
      if (pathname === '/team') return 'team';
      if (pathname === '/contact') return 'contact';
      if (pathname === '/privacy' || pathname === '/privacy-policy' || pathname === '/policy-privacy') return 'policy-privacy';
      if (pathname === '/terms' || pathname === '/terms-and-conditions' || pathname === '/policy-terms') return 'policy-terms';
      if (pathname === '/payment-policy' || pathname === '/policy-payment') return 'policy-payment';
      if (pathname === '/refund-policy' || pathname === '/policy-refund') return 'policy-refund';

      if (
        pathname === '/eclipse-guide' ||
        pathname === '/eclipse' ||
        pathname === '/kiraganam' ||
        pathname.endsWith('/eclipse-guide') ||
        pathname.endsWith('/eclipse')
      ) {
        window.history.replaceState({}, '', '/services');
        return 'services';
      }

      if (
        pathname === '/logos' ||
        pathname === '/brand-logos' ||
        pathname === '/logo-concepts' ||
        pathname.endsWith('/logo-concepts')
      ) {
        window.history.replaceState({}, '', '/');
        return 'home';
      }

      // If a non-root path is reached and is not in the recognized list, check if valid
      if (pathname !== '/') {
        return 'not-found';
      }
    } catch (e) {
      // window/URLSearchParams unavailable (SSR safety), ignore
    }
    return 'home';
  };

  const [currentRoute, setCurrentRoute] = useState<string>(getInitialRoute());
  const { user, birthProfile } = useAuth();

  // Handle browser back/forward buttons and programmatic app:navigate events
  useEffect(() => {
    const handlePopState = () => {
      setCurrentRoute(getInitialRoute());
    };
    const handleAppNavigate = (e: any) => {
      if (e?.detail) {
        handleNavigate(e.detail);
      }
    };

    window.addEventListener('popstate', handlePopState);
    window.addEventListener('app:navigate', handleAppNavigate);
    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('app:navigate', handleAppNavigate);
    };
  }, []);

  // Scroll to top on route change
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [currentRoute]);

  const handleNavigate = (route: string) => {
    const targetRoute = route === 'admin-portal' ? 'admin' : route;
    setCurrentRoute(targetRoute);
    try {
      if (targetRoute === 'not-found') {
        // preserve current URL
        return;
      }
      const cleanPath = targetRoute === 'home' ? '/' : `/${targetRoute}`;
      const url = new URL(cleanPath, window.location.origin);
      if (targetRoute === 'dashboard') {
        const currentParams = new URLSearchParams(window.location.search);
        const order = currentParams.get('order');
        if (order) url.searchParams.set('order', order);
      }
      window.history.pushState({}, '', url.pathname + url.search);
    } catch (e) {
      // Ignore if History API unavailable
    }
  };

  const renderRoute = () => {
    switch (currentRoute) {
      case 'home':
        return <HomePage onNavigate={handleNavigate} />;
      case 'services':
        return <ServicesPage onNavigate={handleNavigate} />;
      case 'birth-jathagam':
        return <BirthJathagamPage onNavigate={handleNavigate} />;
      case 'marriage-compatibility':
        return <MarriageCompatibilityPage onNavigate={handleNavigate} />;
      case 'baby-naming':
        return <BabyNamingPage onNavigate={handleNavigate} />;
      case 'muhurtham':
        return <MuhurthamPage onNavigate={handleNavigate} />;
      case 'how-it-works':
        return <HowItWorksPage onNavigate={handleNavigate} />;
      case 'about':
        return <AboutPage onNavigate={handleNavigate} />;
      case 'team':
        return <AstrologyTeamPage onNavigate={handleNavigate} />;
      case 'contact':
        return <ContactPage />;
      case 'dashboard':
        return <CustomerDashboard onNavigate={handleNavigate} />;
      case 'admin':
      case 'admin-portal':
        return (
          <ErrorBoundary>
            <AdminPortal onNavigate={handleNavigate} />
          </ErrorBoundary>
        );
      case 'login':
        return <LoginPage onNavigate={handleNavigate} />;
      case 'register':
        return <RegisterPage onNavigate={handleNavigate} />;
      case 'policy-privacy':
        return <PoliciesPage type="privacy" onNavigate={handleNavigate} />;
      case 'policy-terms':
        return <PoliciesPage type="terms" onNavigate={handleNavigate} />;
      case 'policy-payment':
        return <PoliciesPage type="payment" onNavigate={handleNavigate} />;
      case 'policy-refund':
        return <PoliciesPage type="refund" onNavigate={handleNavigate} />;
      case 'not-found':
        return <NotFoundPage onNavigate={handleNavigate} />;
      default:
        return <NotFoundPage onNavigate={handleNavigate} />;
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#0b0718] dark:bg-[#0b0718] text-[#fffdfa] font-sans antialiased selection:bg-amber-500 selection:text-slate-950 relative">
      {/* Cosmic Constellations Background Canvas */}
      <CosmicBackground />

      <Navbar currentRoute={currentRoute} onNavigate={handleNavigate} />
      <main className="flex-grow relative z-10">
        {renderRoute()}
      </main>
      <Footer onNavigate={handleNavigate} />

      {/* Family Order Tray & Unified Checkout Components */}
      <FamilyCartFloatingBar onNavigate={handleNavigate} />
      <FamilyCartDrawer onNavigate={handleNavigate} />
      <UnifiedCheckoutModal onNavigate={handleNavigate} />

      <LiveChatWidget />
    </div>
  );
}

export default function App() {
  return (
    <HelmetProvider>
      <LanguageProvider>
        <AuthProvider>
          <ThemeProvider>
            <CartProvider>
              <AppContent />
            </CartProvider>
          </ThemeProvider>
        </AuthProvider>
      </LanguageProvider>
    </HelmetProvider>
  );
}
