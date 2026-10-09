import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  Award,
  Clock,
  GraduationCap,
  Sparkles,
  CheckCircle2,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  Pause,
  Play,
  LayoutGrid,
  SlidersHorizontal
} from 'lucide-react';
import { api } from '../../services/api';
import { TeamMember } from '../../types';
import { useLanguage } from '../../context/LanguageContext';
import { DEFAULT_TEAM_MEMBERS } from '../../data/defaultTeamMembers';
import logoImg from '../../assets/astrosivam_logo.png';

interface AstrologyTeamSectionProps {
  showTitle?: boolean;
  limit?: number;
  onNavigate?: (route: string) => void;
  defaultLayout?: 'slider' | 'grid';
}

export const AstrologyTeamSection: React.FC<AstrologyTeamSectionProps> = ({
  showTitle = true,
  limit,
  onNavigate,
  defaultLayout = 'slider'
}) => {
  const { language } = useLanguage();
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>(DEFAULT_TEAM_MEMBERS);
  const [loading, setLoading] = useState(true);
  const [layoutMode, setLayoutMode] = useState<'slider' | 'grid'>(defaultLayout);
  const [isAutoPlaying, setIsAutoPlaying] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  const scrollRef = useRef<HTMLDivElement>(null);
  const autoSlideTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const fetchTeam = async () => {
      try {
        const res = await api.getAstrologyTeam();
        if (res && res.success && Array.isArray(res.team) && res.team.length > 0) {
          setTeamMembers(res.team);
        } else {
          setTeamMembers(DEFAULT_TEAM_MEMBERS);
        }
      } catch (err) {
        console.error('Failed to load team, using default council:', err);
        setTeamMembers(DEFAULT_TEAM_MEMBERS);
      } finally {
        setLoading(false);
      }
    };
    fetchTeam();
  }, []);

  const activeRoster = teamMembers.length > 0 ? teamMembers : DEFAULT_TEAM_MEMBERS;
  const displayedMembers = limit ? activeRoster.slice(0, limit) : activeRoster;

  // Scroll to a specific index in the slider (contained within the carousel)
  const scrollToIndex = useCallback((index: number) => {
    if (!scrollRef.current) return;
    const container = scrollRef.current;
    const cards = container.querySelectorAll<HTMLElement>('.team-slider-item');
    if (!cards || cards.length === 0) return;

    const targetIdx = (index + displayedMembers.length) % displayedMembers.length;
    const targetCard = cards[targetIdx];
    if (targetCard) {
      const scrollPosition = targetCard.offsetLeft - container.offsetLeft;
      container.scrollTo({
        left: scrollPosition,
        behavior: 'smooth'
      });
      setCurrentIndex(targetIdx);
    }
  }, [displayedMembers.length]);

  // Navigate left / right
  const handlePrev = () => {
    const nextIdx = currentIndex === 0 ? displayedMembers.length - 1 : currentIndex - 1;
    scrollToIndex(nextIdx);
  };

  const handleNext = useCallback(() => {
    const nextIdx = (currentIndex + 1) % (displayedMembers.length || 1);
    scrollToIndex(nextIdx);
  }, [currentIndex, displayedMembers.length, scrollToIndex]);

  // Auto-sliding is disabled by default to prevent unexpected scroll shifts
  useEffect(() => {
    if (autoSlideTimerRef.current) {
      clearInterval(autoSlideTimerRef.current);
    }
  }, []);

  // Track active slide on manual touch or scroll
  const handleScrollEvent = () => {
    if (!scrollRef.current) return;
    const container = scrollRef.current;
    const cards = container.querySelectorAll<HTMLElement>('.team-slider-item');
    if (!cards || cards.length === 0) return;

    const scrollLeft = container.scrollLeft;
    let closestIndex = 0;
    let minDistance = Infinity;

    cards.forEach((card, idx) => {
      const distance = Math.abs(card.offsetLeft - container.offsetLeft - scrollLeft);
      if (distance < minDistance) {
        minDistance = distance;
        closestIndex = idx;
      }
    });

    setCurrentIndex(closestIndex);
  };

  const teamThemes = [
    {
      cardClass: 'team-card team-card-sapphire',
      badgeClass: 'bg-sky-500/20 text-sky-300 border-sky-500/30',
      photoBorder: 'border-sky-500/40',
      expBadge: 'bg-sky-400 text-slate-950',
      tagClass: 'bg-sky-500/10 text-sky-300 border-sky-500/25',
      footerTag: 'text-sky-300/70',
    },
    {
      cardClass: 'team-card team-card-crimson',
      badgeClass: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
      photoBorder: 'border-rose-500/40',
      expBadge: 'bg-rose-400 text-slate-950',
      tagClass: 'bg-rose-500/10 text-rose-300 border-rose-500/25',
      footerTag: 'text-rose-300/70',
    },
    {
      cardClass: 'team-card team-card-emerald',
      badgeClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
      photoBorder: 'border-emerald-500/40',
      expBadge: 'bg-emerald-400 text-slate-950',
      tagClass: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/25',
      footerTag: 'text-emerald-300/70',
    },
    {
      cardClass: 'team-card team-card-purple',
      badgeClass: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
      photoBorder: 'border-purple-500/40',
      expBadge: 'bg-purple-400 text-slate-950',
      tagClass: 'bg-purple-500/10 text-purple-300 border-purple-500/25',
      footerTag: 'text-purple-300/70',
    },
    {
      cardClass: 'team-card team-card-gold',
      badgeClass: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
      photoBorder: 'border-amber-500/40',
      expBadge: 'bg-amber-400 text-slate-950',
      tagClass: 'bg-amber-500/10 text-amber-300 border-amber-500/25',
      footerTag: 'text-amber-300/70',
    }
  ];

  return (
    <section className="space-y-8 select-none">
      {/* USER ASSURANCE & ETHICAL CHARTER BANNER */}
      <div className="assurance-box p-6 sm:p-8 relative overflow-hidden">
        <div className="flex flex-col md:flex-row items-start md:items-center gap-5 sm:gap-6 relative z-10">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-300 flex items-center justify-center font-black shrink-0 shadow-md">
            <ShieldCheck className="w-8 h-8 text-amber-300" />
          </div>
          <div className="space-y-2.5 text-left flex-1">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-500/30 text-amber-300 text-[11px] font-extrabold uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Our Astrological Assurance & Ethics</span>
            </div>
            <p className="text-sm sm:text-base font-bold text-[#fffdfa] leading-relaxed">
              &ldquo;ASTRO SIVAM provides astrology services for users worldwide. Our reports are prepared based on the provided birth details, planetary positions and established astrological principles. We do not use fear-based predictions or try to frighten people. Our purpose is to provide clear, respectful and responsible astrological guidance.&rdquo;
            </p>
            <p className="text-xs sm:text-sm text-slate-300 font-medium">
              Every request is prepared with the support of our authentic India-based Priest and Vedic Astrology Team and delivered to your registered email.
            </p>
          </div>
        </div>
      </div>

      {showTitle && (
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-amber-500/20 border border-amber-500/30 text-amber-300 text-xs font-bold uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5" />
              <span>India-Based Priest & Astrology Team</span>
            </div>
            <h2 className="display-serif text-2xl sm:text-3xl font-extrabold text-[#fffdfa]">
              Our Astrology Team
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed font-normal">
              Our distinguished panel of India-based Vedic scholars, Sanskrit epigraphists, and Sivagama Priests support all birth chart calculations, wedding synastry (Poruthams), and auspicious naming consultations.
            </p>
          </div>

          {/* Slider Controls (Auto-Slide, Prev, Next, Layout Switch) */}
          <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto">
            {/* Auto-play toggle button */}
            {layoutMode === 'slider' && displayedMembers.length > 1 && (
              <button
                type="button"
                onClick={() => setIsAutoPlaying(prev => !prev)}
                className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition-colors ${
                  isAutoPlaying
                    ? 'bg-amber-500/20 border-amber-500/40 text-amber-300 hover:bg-amber-500/30'
                    : 'bg-slate-800/80 border-slate-700 text-slate-400 hover:text-white'
                }`}
                title={isAutoPlaying ? 'Pause Automatic Slide' : 'Resume Automatic Slide'}
              >
                {isAutoPlaying ? (
                  <>
                    <Pause className="w-3.5 h-3.5 text-amber-400" />
                    <span className="hidden md:inline">Auto-Slide On</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 text-slate-300" />
                    <span className="hidden md:inline">Auto-Slide Paused</span>
                  </>
                )}
              </button>
            )}

            {/* Layout Toggle (Slider vs Grid) */}
            <button
              type="button"
              onClick={() => setLayoutMode(prev => prev === 'slider' ? 'grid' : 'slider')}
              className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700 text-slate-300 hover:text-white hover:border-slate-600 transition-colors"
              title={layoutMode === 'slider' ? 'Switch to Grid View' : 'Switch to Automatic Slide View'}
            >
              {layoutMode === 'slider' ? (
                <LayoutGrid className="w-4 h-4 text-amber-300" />
              ) : (
                <SlidersHorizontal className="w-4 h-4 text-amber-300" />
              )}
            </button>

            {/* Arrow Navigation */}
            {layoutMode === 'slider' && displayedMembers.length > 1 && (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handlePrev}
                  className="w-9 h-9 rounded-xl border border-amber-500/30 bg-[#1c1538] text-amber-300 flex items-center justify-center hover:border-amber-400 hover:text-amber-200 transition-all shadow-sm active:scale-95"
                  aria-label="Previous scholar"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={handleNext}
                  className="w-9 h-9 rounded-xl border border-amber-500/30 bg-[#1c1538] text-amber-300 flex items-center justify-center hover:border-amber-400 hover:text-amber-200 transition-all shadow-sm active:scale-95"
                  aria-label="Next scholar"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Loading Skeleton */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-pulse">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-72 bg-slate-800/50 border border-amber-500/20 rounded-3xl" />
          ))}
        </div>
      ) : displayedMembers.length === 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {DEFAULT_TEAM_MEMBERS.map((member, idx) => {
            const theme = teamThemes[idx % teamThemes.length];
            return (
              <div key={member.id} className={`${theme.cardClass} p-6 flex flex-col justify-between space-y-4`}>
                <div className="flex items-center gap-4">
                  <div className="relative shrink-0">
                    <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500/20 via-slate-900 to-amber-950/60 border-2 ${theme.photoBorder} shadow-md flex items-center justify-center p-1.5`}>
                      <img src={logoImg} alt="ASTRO SIVAM Emblem" className="w-full h-full object-contain" />
                    </div>
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">{member.nameEn}</h3>
                    <div className="text-xs text-amber-400 font-semibold">{member.titleEn}</div>
                  </div>
                </div>
                <p className="text-xs text-slate-300">{member.bioEn}</p>
              </div>
            );
          })}
        </div>
      ) : layoutMode === 'slider' ? (
        /* AUTOMATIC SLIDING CAROUSEL */
        <div
          className="relative group"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          onTouchStart={() => setIsHovered(true)}
          onTouchEnd={() => setIsHovered(false)}
        >
          {/* Horizontal Track */}
          <div
            ref={scrollRef}
            onScroll={handleScrollEvent}
            className="flex gap-6 overflow-x-auto pb-4 pt-1 snap-x snap-mandatory scroll-smooth focus:outline-none no-scrollbar"
            tabIndex={0}
            style={{
              scrollbarWidth: 'none',
              msOverflowStyle: 'none'
            }}
          >
            {displayedMembers.map((member, idx) => {
              const memberName =
                language === 'ta' && member.nameTa
                  ? member.nameTa
                  : language === 'hi' && member.nameHi
                  ? member.nameHi
                  : member.nameEn || member.fullName || 'Astrology Scholar';

              const memberTitle =
                language === 'ta' && member.titleTa
                  ? member.titleTa
                  : member.titleEn || member.vedicEducation || 'Senior Astrologer';

              const memberEdu =
                language === 'ta' && member.educationTa
                  ? member.educationTa
                  : member.educationEn || member.education || member.vedicEducation || 'Vedic Astrology Scholar';

              const memberBio =
                language === 'ta' && member.bioTa
                  ? member.bioTa
                  : member.bioEn || member.biography || '';

              const expYears = member.experienceYears ?? member.yearsOfExperience ?? 15;

              const specs = Array.isArray(member.specializations)
                ? member.specializations
                : typeof member.specialization === 'string'
                ? member.specialization.split(',').map(s => s.trim()).filter(Boolean)
                : [];

              const theme = teamThemes[idx % teamThemes.length];

              return (
                <div
                  key={member.id}
                  className={`team-slider-item shrink-0 w-full sm:w-[calc(50%-12px)] lg:w-[calc(33.333%-16px)] snap-start ${theme.cardClass} p-6 flex flex-col justify-between space-y-4 transition-all duration-300 hover:scale-[1.01]`}
                >
                  <div className="space-y-4 relative z-10">
                    {/* Emblem & Experience Badge */}
                    <div className="flex items-center gap-4">
                      <div className="relative shrink-0">
                        <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500/20 via-slate-900 to-amber-950/60 border-2 ${theme.photoBorder} shadow-md flex items-center justify-center p-2 group-hover:scale-105 transition-transform`}>
                          <img
                            src={logoImg}
                            alt="ASTRO SIVAM Emblem"
                            className="w-full h-full object-contain"
                          />
                        </div>
                        <div className={`absolute -bottom-1 -right-1 ${theme.expBadge} text-[9px] font-black px-1.5 py-0.2 rounded-full shadow-xs`}>
                          {expYears}+ YRS
                        </div>
                      </div>

                      <div className="space-y-0.5">
                        <h3 className="text-base font-bold text-[#fffdfa] leading-tight">
                          {memberName}
                        </h3>
                        {language !== 'en' && member.nameEn && (
                          <div className="text-[11px] text-amber-200/70 font-medium">
                            {member.nameEn}
                          </div>
                        )}
                        <div className="text-xs text-amber-400 font-semibold">
                          {memberTitle}
                        </div>
                      </div>
                    </div>

                    {/* Education & Credentials */}
                    <div className="space-y-1.5 pt-2 border-t border-white/10 text-xs">
                      <div className="flex items-start gap-2 text-slate-300">
                        <GraduationCap className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                        <span>{memberEdu}</span>
                      </div>

                      <div className="flex items-start gap-2 text-slate-300">
                        <Award className="w-3.5 h-3.5 text-sky-400 shrink-0 mt-0.5" />
                        <span>{expYears} Years Traditional Vedic Experience</span>
                      </div>
                    </div>

                    {/* Specialization Tags */}
                    {specs.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {specs.map((spec, sIdx) => (
                          <span
                            key={sIdx}
                            className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${theme.tagClass}`}
                          >
                            {spec}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Bio */}
                    {memberBio && (
                      <p className="text-xs text-slate-300 leading-relaxed pt-1 line-clamp-3 font-normal">
                        {memberBio}
                      </p>
                    )}
                  </div>

                  {/* Verification footer */}
                  <div className="pt-3 border-t border-white/10 flex items-center justify-between text-[11px] text-slate-400 relative z-10">
                    <span className="flex items-center gap-1 text-emerald-400 font-medium">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Active Member</span>
                    </span>
                    <span className={theme.footerTag}>ASTRO SIVAM Team</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Dot Indicators & Status Bar */}
          {displayedMembers.length > 1 && (
            <div className="flex items-center justify-between pt-2">
              {/* Dots */}
              <div className="flex items-center gap-2">
                {displayedMembers.map((_, dotIdx) => (
                  <button
                    key={dotIdx}
                    onClick={() => scrollToIndex(dotIdx)}
                    className={`h-2 rounded-full transition-all duration-300 cursor-pointer ${
                      currentIndex === dotIdx
                        ? 'w-7 bg-amber-400'
                        : 'w-2 bg-white/20 hover:bg-white/40'
                    }`}
                    aria-label={`Slide to Priest ${dotIdx + 1}`}
                  />
                ))}
              </div>

              {/* Autoplay status hint */}
              <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
                {isHovered ? (
                  <span className="text-amber-300/80 font-medium">Hovering (Paused)</span>
                ) : isAutoPlaying ? (
                  <span className="flex items-center gap-1 text-slate-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                    <span>Auto-sliding</span>
                  </span>
                ) : (
                  <span>Manual mode</span>
                )}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* STANDARD GRID VIEW */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {displayedMembers.map((member, idx) => {
            const memberName =
              language === 'ta' && member.nameTa
                ? member.nameTa
                : language === 'hi' && member.nameHi
                ? member.nameHi
                : member.nameEn || member.fullName || 'Astrology Scholar';

            const memberTitle =
              language === 'ta' && member.titleTa
                ? member.titleTa
                : member.titleEn || member.vedicEducation || 'Senior Astrologer';

            const memberEdu =
              language === 'ta' && member.educationTa
                ? member.educationTa
                : member.educationEn || member.education || member.vedicEducation || 'Vedic Astrology Scholar';

            const memberBio =
              language === 'ta' && member.bioTa
                ? member.bioTa
                : member.bioEn || member.biography || '';

            const expYears = member.experienceYears ?? member.yearsOfExperience ?? 15;

            const specs = Array.isArray(member.specializations)
              ? member.specializations
              : typeof member.specialization === 'string'
              ? member.specialization.split(',').map(s => s.trim()).filter(Boolean)
              : [];

            const theme = teamThemes[idx % teamThemes.length];

            return (
              <div
                key={member.id}
                className={`${theme.cardClass} p-6 flex flex-col justify-between space-y-4 group`}
              >
                <div className="space-y-4 relative z-10">
                  {/* Emblem & Experience Badge */}
                  <div className="flex items-center gap-4">
                    <div className="relative shrink-0">
                      <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500/20 via-slate-900 to-amber-950/60 border-2 ${theme.photoBorder} shadow-md flex items-center justify-center p-2 group-hover:scale-105 transition-transform`}>
                        <img
                          src={logoImg}
                          alt="ASTRO SIVAM Emblem"
                          className="w-full h-full object-contain"
                        />
                      </div>
                      <div className={`absolute -bottom-1 -right-1 ${theme.expBadge} text-[9px] font-black px-1.5 py-0.2 rounded-full shadow-xs`}>
                        {expYears}+ YRS
                      </div>
                    </div>

                    <div className="space-y-0.5">
                      <h3 className="text-base font-bold text-[#fffdfa] leading-tight">
                        {memberName}
                      </h3>
                      {language !== 'en' && member.nameEn && (
                        <div className="text-[11px] text-amber-200/70 font-medium">
                          {member.nameEn}
                        </div>
                      )}
                      <div className="text-xs text-amber-400 font-semibold">
                        {memberTitle}
                      </div>
                    </div>
                  </div>

                  {/* Education & Credentials */}
                  <div className="space-y-1.5 pt-2 border-t border-white/10 text-xs">
                    <div className="flex items-start gap-2 text-slate-300">
                      <GraduationCap className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                      <span>{memberEdu}</span>
                    </div>

                    <div className="flex items-start gap-2 text-slate-300">
                      <Award className="w-3.5 h-3.5 text-sky-400 shrink-0 mt-0.5" />
                      <span>{expYears} Years Traditional Vedic Experience</span>
                    </div>
                  </div>

                  {/* Specialization Tags */}
                  {specs.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {specs.map((spec, sIdx) => (
                        <span
                          key={sIdx}
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${theme.tagClass}`}
                        >
                          {spec}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Bio */}
                  {memberBio && (
                    <p className="text-xs text-slate-300 leading-relaxed pt-1 line-clamp-3 font-normal">
                      {memberBio}
                    </p>
                  )}
                </div>

                {/* Verification footer */}
                <div className="pt-3 border-t border-white/10 flex items-center justify-between text-[11px] text-slate-400 relative z-10">
                  <span className="flex items-center gap-1 text-emerald-400 font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Active Member</span>
                  </span>
                  <span className={theme.footerTag}>ASTRO SIVAM Team</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};
