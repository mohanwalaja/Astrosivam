# ASTRO SIVAM AI Astrologer — 5 Sample Conversations

**Deliverable 6 · Part 5 · 2026-10-09**

Each sample shows the **timing sequence** the customer actually sees, not just
the words. The UI contract these follow:

1. Customer sends → status line **"ASTRO SIVAM Astrologer is checking your
   chart..."** for 2–4 seconds.
2. Then a **three-dot typing indicator**.
3. Then **2–4 short bubbles**, one after another, 1–2 s apart.
4. **Total never exceeds 12 s.** The real model response time counts towards
   that cap — a slow model is never padded out further. If the cap is reached
   while bubbles remain, the rest render immediately rather than never.

Implementation: `TIMING` in `src/components/ai-astrologer/AiAstrologerPanel.tsx`.
Bubble splitting: `AstroAiProvider::toBubbles()` — at most four, short fragments
merged into the previous bubble.

Timestamps below are elapsed seconds from send.

---

## Sample 1 — Tamil · health, with worry

**Customer** `[0.0s]`
> எனக்கு சில மாதங்களாக உடல் சோர்வு, தூக்கம் இல்லை. என் ஜாதகத்தில் என்ன?

**UI** `[0.0s – 2.9s]`
`ASTRO SIVAM ஜோதிடர் உங்கள் ஜாதகத்தைப் பார்க்கிறார்...`

**UI** `[2.9s – 4.6s]` ● ● ●

**Bubble 1** `[4.6s]`
> வணக்கம் பிரியா — இது உங்களை கவலைப்படுத்துகிறது என்று புரிகிறது. ஜாதகத்தை சேர்ந்து பார்த்து, ஒவ்வொரு படியாக செல்வோம்.

**Bubble 2** `[6.1s]`
> உங்கள் லக்னாதிபதி 6-ஆம் வீட்டில் உள்ளார். மரபுப்படி உடல் சக்தி சராசரியை விட குறைவாக இருக்கும் — இது ஒரு குறிப்பிட்ட நோயின் கணிப்பு அல்ல.

**Bubble 3** `[7.6s]`
> தற்போது சனி தசை, சனி புக்தி — 30 டிசம்பர் 2026 வரை. இந்த புக்தி முடிந்தால் அழுத்தம் குறையும் என்று படிக்கப்படுகிறது. ஒழுக்கமான தூக்க நேரம், தினமும் 30 நிமிட நடை, சனிக்கிழமை ஒருவருக்கு உணவு.

**Bubble 4** `[9.1s]`
> இது ஜோதிட வழிகாட்டல் மட்டுமே — அறிகுறிகள் தொடர்ந்தால் தகுதியான மருத்துவரை அணுகவும். வேண்டுமானால் மேலும் விளக்கவா?
> Source: EN-01 · EN-02

**Total: 9.1 s** · handoff offered because the area is `health`

---

## Sample 2 — English · business, detailed (the slow path)

**Customer** `[0.0s]`
> I want to leave my job and start my own business. Is this a good time?

**UI** `[0.0s – 3.7s]`
`ASTRO SIVAM Astrologer is checking your chart...`

**UI** `[3.7s – 6.2s]` ● ● ●

**Bubble 1** `[6.2s]`
> Hello Priya — this is a big decision, so let us take it in order.

**Bubble 2** `[7.9s]`
> Your 10th lord is well placed, so the work itself is not the problem. Your 7th house is also supported, which favours work with people — partnership or client-facing rather than back-office.

**Bubble 3** `[9.5s]`
> You are in a Budha Dasha with a Sukra Bhukti until 14 February 2027. The classics read these periods as favourable for starting something of your own. The risk in this window is over-expanding, not failing to start.

**Bubble 4** `[11.2s]`
> So: start small, and hold six months of costs in reserve before you commit. Get any partnership terms in writing before the first invoice.
> Source: EN-01 · TA-07, p.15-18

**Total: 11.2 s** — a detailed question (business), inside the 12 s cap

---

## Sample 3 — Hindi · refusal, death question

The refusal path is deliberately **fast**. There is no chart reading to do, so
padding it out to 6 seconds would be theatre.

**Customer** `[0.0s]`
> मेरी कुंडली में आठवें भाव की समस्या है। मैं कितने साल जिऊँगा?

**UI** `[0.0s – 2.1s]`
`ASTRO SIVAM ज्योतिषी आपकी कुंडली देख रहे हैं...`

**UI** `[2.1s – 3.0s]` ● ● ●

**Bubble 1** `[3.0s]`
> नमस्ते प्रिया — मैं कुंडली से यह नहीं पढ़ता, और मैं आपके मन में ऐसा कुछ डालना नहीं चाहूँगा।

**Bubble 2** `[4.4s]`
> जो मैं बता सकता हूँ वह यह है कि यह काल आपसे क्या माँगता है और कब हल्का होता है। आपके आठवें भाव का स्वामी पहले भाव में है — परंपरा इसे दिनचर्या और नियमित जाँच बनाए रखने का कारण बताती है, दंड नहीं। क्या इसे देखें?

**Bubble 3** `[5.9s]`
> यदि आप किसी व्यक्ति से यह बात करना चाहें, तो मैं आपका प्रश्न हमारे ज्योतिषी को भेज सकता हूँ।

**Total: 5.9 s** · handoff offered, no source line (nothing was cited)

---

## Sample 4 — Tamil · uploaded report, "what does this line mean?"

**Customer** `[0.0s]` uploads `ASTRO_SIVAM_Report_ORD-2026-0417.pdf`

**UI** `[0.0s – 1.4s]` ● ● ●

**Bubble 1** `[1.4s]`
> அறிக்கை இணைக்கப்பட்டது (#ORD-2026-0417). எந்த பகுதியை விளக்க வேண்டும்?

**Customer** `[8.2s]`
> இதில் "Kuja Dosha present" என்று உள்ளது. இதனால் என்ன ஆகும்?

**UI** `[8.2s – 10.6s]`
`ASTRO SIVAM ஜோதிடர் உங்கள் ஜாதகத்தைப் பார்க்கிறார்...`

**UI** `[10.6s – 11.9s]` ● ● ●

**Bubble 1** `[11.9s]`
> குஜ தோஷம் என்றால் செவ்வாய் உணர்வுப்பூர்வமான வீடுகளில் ஒன்றில் உள்ளது என்பது. உங்கள் ஜாதகத்தில் செவ்வாய் 7-ஆம் வீட்டில் உள்ளார்.

**Bubble 2** `[13.4s]`
> தமிழ் மரபில் இது பொருத்தம் பார்க்கும் ஒரு அம்சமே தவிர தீர்ப்பு அல்ல — மறு நபரின் ஜாதகத்துடன் ஒப்பிடப்பட்டு பெரும்பாலும் சமனாகிவிடும். இது திருமணம் வேண்டாம் என்று சொல்ல காரணம் அல்ல.
> Source: EN-01 · EN-09

**Note on timing:** the 12 s cap is measured **per question**, not across the
conversation. The upload acknowledgement at 1.4 s and this reply both sit well
inside it.

---

## Sample 5 — English · retry after a failure

The failure path is part of the product, not an edge case. The customer's
question is already stored as a row before the model is called, so nothing is
lost, and the failure is recorded as its own `FAILED` row rather than a silent
gap.

**Customer** `[0.0s]`
> Will I get the foreign job I applied for?

**UI** `[0.0s – 3.2s]`
`ASTRO SIVAM Astrologer is checking your chart...`

**UI** `[3.2s – 6.8s]` ● ● ●

**UI** `[6.8s]` the model call fails (provider timeout)

**Bubble 1** `[6.8s]`
> Please give me a moment, I am checking again.

**UI** `[6.8s]` a **Retry** control appears beside it. The question was NOT
charged against today's allowance, because no answer was delivered.

**Customer taps Retry** `[11.5s]`

**UI** `[11.5s – 14.1s]`
`ASTRO SIVAM Astrologer is checking your chart...`

**Bubble 1** `[14.1s]`
> Rahu sits in your 12th house, and Uttara Kalamrita associates this configuration with foreign connection. You are in a Rahu Dasha, so this period reads clearly for a move.

**Bubble 2** `[15.6s]`
> Whether this particular application succeeds is not something a chart decides — the employer and the embassy do. Check the visa route directly with them; astrology is not an immigration opinion.
> Source: EN-09 · EN-01

**Persistence:** three rows exist for this exchange — the question (`SENT`), the
failed attempt (`FAILED`, with `error_message` and `latency_ms`), and the
successful reply (`SENT`, `attempt = 2`). That is what makes the retry honest.

---

## Cross-checking these against the code

| Behaviour in these samples | Where it is implemented |
| --- | --- |
| Status line for 2–4 s | `TIMING.statusMin` / `statusMax` in `AiAstrologerPanel.tsx` |
| Three animated dots | the `phase === 'typing'` block |
| Bubbles 1–2 s apart | `TIMING.bubbleGap` |
| 12 s hard cap, real response time included | `TIMING.hardCap`, clamped inside the `bubbles.forEach` delay |
| At most four bubbles, short fragments merged | `AstroAiProvider::toBubbles()` |
| Source line on the last bubble | `answer()` appends `sourceLine` to `$bubbles[count - 1]` |
| Failure does not consume the allowance | `astro_ai_action_ask` records a `FAILED` row and skips the bump |
| Handoff offered for health and refusals | `AstroAiProvider::shouldOfferHandoff()` and the refusal short-circuit |
