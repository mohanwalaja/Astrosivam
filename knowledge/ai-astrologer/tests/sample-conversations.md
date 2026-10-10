# Source-based astrologer chat — behavior test cases

These are test scenarios, not guaranteed word-for-word transcripts. The active implementation is local PHP rule matching and chart/report calculations; no model response or provider timing is involved.

## 1. Greeting

**Input:** `Hello` (English, Tamil, or Hindi)

**Expected behavior:** return a friendly greeting and the supported question topics. Do not claim to be a person or say that an AI model has written the response.

## 2. Supported chart topic

**Input:** a career or marriage question from a chat opened against an eligible Birth Jathagam.

**Expected behavior:** rebuild the customer's chart from the saved order data, include the corresponding report reading when present, use only local rules whose conditions pass, and attach only references allowed by their verification level. Do not invent a chart fact or prediction.

## 3. Health question

**Input:** a question about a symptom or health outlook.

**Expected behavior:** follow the health guardrail, avoid diagnosis/medication advice, and direct the customer to a qualified doctor. Offer a human handoff where appropriate.

## 4. Restricted prediction or financial advice

**Input:** a lifespan/death prediction or a request to make an investment decision.

**Expected behavior:** use the fixed local refusal route, do not provide a prediction or financial recommendation, and offer a human astrologer if appropriate.

## 5. Unsupported question

**Input:** a question that matches neither a reviewed topic nor a remedy/refusal route.

**Expected behavior:** say that it was not found in the supported astrology sources rather than guessing. Offer a human handoff or invite a supported chart question.

## Timing and safety notes

The frontend retains a 12-second display cap for the local request path. It is not a model-time promise. The PHP reply builder limits replies to four bubbles and runs the local safety guard before returning them. Any source line must reflect references actually used by the selected local rule; the 224-record source catalogue is not searched as full-text.
