import React, { useState } from 'react';
import { Mail, MapPin, Send, CheckCircle2, MessageSquare, Clock, ShieldCheck, AlertCircle, Loader2, Facebook, ExternalLink } from 'lucide-react';
import { api } from '../services/api';
import { SEO } from '../components/common/SEO';
import { PersonNameField } from '../components/common/PersonNameField';
import { ServicePageHeader } from '../components/common/ServicePageHeader';
import { normalizePersonName } from '../utils/birthDetails';

export const ContactPage: React.FC = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSent, setIsSent] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [responseMsg, setResponseMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    const cleanName = normalizePersonName(name);
    if (!cleanName) {
      setErrorMessage('Please enter your full name.');
      return;
    }
    if (!message.trim()) {
      setErrorMessage('Please enter a message.');
      return;
    }
    setIsSubmitting(true);

    try {
      const res = await api.submitContactMessage({
        name: cleanName,
        email: email.trim().toLowerCase(),
        subject: subject.trim(),
        message: message.trim()
      });

      if (res.success) {
        setIsSent(true);
        setResponseMsg(res.message || 'Your message was saved to our admin inbox.');
        setName('');
        setEmail('');
        setSubject('');
        setMessage('');
      } else {
        setErrorMessage(res.message || 'Failed to dispatch message. Please try again.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'An error occurred while sending your message.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="service-page">
      <SEO
        title="Contact ASTRO SIVAM - Astrological Support & Inquiries"
        description="Get in touch with ASTRO SIVAM for astrology consultations, order inquiries, and technical support. We are available 7 days a week."
        canonical="https://astrosivam.com/contact"
      />
      
      <ServicePageHeader
        icon={MessageSquare}
        eyebrow="Direct Astrological Inquiry · Support"
        title="Contact ASTRO SIVAM"
        description="Have an inquiry regarding a service report, birth time clarification, or payment verification? Send us a message; it will be saved in our admin inbox for review."
      />

      {/* Grid: Contact Info + Message Form */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Contact Info */}
        <div className="lg:col-span-5 space-y-6">
          <div className="service-form-card p-6 text-white space-y-6">
            <h3 className="text-base font-bold text-amber-400 flex items-center gap-2">
              <span>Astrological Advisory Centre</span>
            </h3>

            <div className="space-y-4 text-xs text-slate-300">
              <div className="flex items-start gap-3">
                <MapPin className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-white">Advisory Centre &amp; Ashram</div>
                  <p className="text-slate-400 mt-0.5">Chennai, India • Serving Fiji, Australia, NZ &amp; worldwide diaspora</p>
                  <p className="text-[10px] text-amber-400 mt-0.5">🇮🇳 Traditional Vedic Astrological Council • Chennai, India</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Mail className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-white">Email Address</div>
                  <p className="text-slate-400 mt-0.5">admin@astrosivam.com</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Facebook className="w-4 h-4 text-[#1877F2] shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-white">Official Facebook Page</div>
                  <a
                    href="https://www.facebook.com/Astrosivamofficial"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[#5AA7FF] hover:text-[#90C2FF] transition-colors mt-0.5 font-semibold"
                  >
                    <span>facebook.com/Astrosivamofficial</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Clock className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-white">Consultation Hours</div>
                  <p className="text-slate-400 mt-0.5">Monday – Saturday: 8:00 AM – 8:00 PM (IST, UTC+5:30)</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded-2xl p-5 text-xs text-slate-700 dark:text-slate-300 space-y-3">
            <div className="font-bold text-amber-900 dark:text-amber-300 flex items-center justify-between">
              <span>Administrator Inbox</span>
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
            </div>
            <p className="text-slate-600 dark:text-slate-400 leading-relaxed text-[11px]">
              Inquiries are saved in our administrator inbox for review. For time-sensitive matters, please use the support contact details listed on this page.
            </p>
            <div className="text-[11px] text-amber-800 dark:text-amber-400 font-medium">
              ★ The team will respond as soon as possible.
            </div>
          </div>
        </div>

        {/* Contact Form */}
        <div className="lg:col-span-7 service-form-card p-5 sm:p-7">
          {isSent ? (
            <div className="text-center py-10 space-y-4 animate-fade-in">
              <div className="w-14 h-14 bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 rounded-2xl flex items-center justify-center mx-auto shadow-md">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                Message Received
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
                {responseMsg || 'Your inquiry has been saved in the ASTRO SIVAM administrator inbox.'}
              </p>
              <button
                type="button"
                onClick={() => {
                  setIsSent(false);
                  setResponseMsg('');
                }}
                className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold rounded-xl shadow transition-colors"
              >
                Send Another Message
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                  Send a Message to Admin
                </h3>
                <span className="text-[10px] text-slate-400 font-semibold">
                  Admin Inbox
                </span>
              </div>

              {errorMessage && (
                <div className="p-3 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 rounded-xl text-xs text-rose-600 dark:text-rose-400 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <PersonNameField
                  id="contact-name"
                  label="Your full name"
                  value={name}
                  onChange={setName}
                  placeholder="e.g. Anand Prasad"
                  size="sm"
                />

                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Your Email Address <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="e.g. anand@example.com"
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Subject / Order Number
                </label>
                <input
                  type="text"
                  value={subject}
                  onChange={e => setSubject(e.target.value)}
                  placeholder="e.g. Inquiry regarding Birth Horoscope or Order #AF-2026-1002"
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Message Details <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={4}
                  required
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  placeholder="Write your questions, consultation notes, or report inquiry here..."
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2 active:scale-98"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Saving your message...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Send Message to Admin</span>
                  </>
                )}
              </button>
            </form>
          )}
        </div>

      </div>

    </div>
  );
};
