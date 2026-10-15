const KB = require('./knowledgeBase');
const categories = ['Royalty & Payments', 'ISBN & Metadata Issues', 'Printing & Quality', 'Distribution & Availability', 'Book Status & Production Updates', 'General Inquiry'];
const priorities = ['Critical', 'High', 'Medium', 'Low'];
function fallbackClassify(text) {
  const t = text.toLowerCase(); let category = 'General Inquiry', priority = 'Medium';
  if (/royalt|payment|payout|paid|earning|bank transfer|money|₹/.test(t)) category = 'Royalty & Payments';
  else if (/isbn|metadata|wrong title|author bio|description/.test(t)) category = 'ISBN & Metadata Issues';
  else if (/print|blurry|misprint|binding|paper|color|colour|pages/.test(t)) category = 'Printing & Quality';
  else if (/amazon|flipkart|unavailable|distribution|listing|stock sync/.test(t)) category = 'Distribution & Availability';
  else if (/production|typesetting|proofread|cover design|published|manuscript|status/.test(t)) category = 'Book Status & Production Updates';
  if (/isbn|duplicate|wrong book linked|no royalty.{0,20}(month|quarter)|6 months|fraud|urgent|misprint|defect/.test(t)) priority = 'High';
  if (/legal notice|chargeback|data breach|safety issue|multiple failed payout/.test(t)) priority = 'Critical';
  if (/can i|how do i|update my bio|general question/.test(t)) priority = 'Low';
  return { category, priority };
}
async function askAI(system, user, maxTokens = 450) {
  if (!process.env.OPENAI_API_KEY) return null;
  const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 18000);
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', { method: 'POST', signal: controller.signal, headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model: process.env.OPENAI_MODEL || 'gpt-4o-mini', temperature: 0.2, max_tokens: maxTokens, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] }) });
    if (!response.ok) throw new Error(`AI provider returned ${response.status}`);
    const data = await response.json(); return data.choices?.[0]?.message?.content || null;
  } catch (err) { console.warn('AI unavailable; using fallback:', err.message); return null; } finally { clearTimeout(timer); }
}
async function classifyTicket(subject, description) {
  const local = fallbackClassify(`${subject}
${description}`);
  const raw = await askAI(`You classify BookLeaf author support tickets. Use only these categories: ${categories.join('; ')}. Use only these priorities: ${priorities.join('; ')}. Prioritize verified urgency and business impact. Return ONLY valid JSON: {"category":"...","priority":"..."}.`, `Subject: ${subject}
Description: ${description}
Relevant policy: ${KB.slice(0, 1600)}`, 100);
  if (!raw) return local;
  try { const parsed = JSON.parse(raw.replace(/```json|```/g, '').trim()); return { category: categories.includes(parsed.category) ? parsed.category : local.category, priority: priorities.includes(parsed.priority) ? parsed.priority : local.priority }; } catch { return local; }
}
async function draftResponse(ticket) {
  const local = localDraft(ticket);
  const recent = (ticket.messages || []).slice(-4).map(m => `${m.senderRole}: ${m.body}`).join('\n');
  const raw = await askAI(`You are a BookLeaf Publishing support representative. Draft a concise, empathetic, professional reply. Use only the policy below. Do not invent dates, account information, actual book status, or actions already completed. If investigation is needed, promise an update within 48 hours. Acknowledge concern, explain the relevant policy, and end with a clear next step. Return only the reply text.

KNOWLEDGE BASE:
${KB}`, `Ticket subject: ${ticket.subject}
Author query: ${ticket.description}
Book: ${ticket.bookTitle || 'General / Account Level'}
Current status: ${ticket.status}
Recent conversation:
${recent || 'No replies yet.'}`, 300);
  return raw?.trim() || local;
}
function localDraft(ticket) {
  const t = `${ticket.subject} ${ticket.description}`.toLowerCase();
  const greeting = 'Hello, thank you for reaching out to BookLeaf. I understand your concern, and I’m sorry for the inconvenience.';
  if (/royalt|payment|payout|earning/.test(t)) return `${greeting}

Royalties are calculated quarterly and paid within 45 days after the quarter ends, provided the accumulated balance meets the ₹1,000 minimum threshold. Any smaller balance rolls over to the next quarter. Please check that your bank details are up to date in your author dashboard.

We’ll review your account and payout records and update you within 48 hours. If the payment is overdue, we’ll escalate it to the relevant team.`;
  if (/isbn/.test(t)) return `${greeting}

ISBN mismatches are treated as high-priority issues. We’ll escalate this to our production team for verification and provide an update within 48 hours.

Please share the ISBN shown on the physical copy and the listing, if available, so our team can investigate accurately.`;
  if (/print|blurry|misprint|binding|color|colour|pages/.test(t)) return `${greeting}

We’re sorry the copies did not meet the expected quality. Please reply with clear photos showing the defect and, if possible, the book’s order details. Once the issue is verified, BookLeaf will arrange a free reprint. The standard reprint turnaround is 5–7 business days after confirmation.`;
  if (/amazon|flipkart|unavailable|listing|distribution/.test(t)) return `${greeting}

An unavailable listing can be caused by a stock synchronisation issue. We’ll ask the distribution team to check the listing and trigger a re-sync if needed. This typically takes 24–48 hours.

Please share the platform and listing URL so we can check the correct listing.`;
  if (/description|bio|metadata/.test(t)) return `${greeting}

Metadata updates can be submitted through your dashboard or by emailing the BookLeaf team. Once processed, changes typically appear on platforms within 3–5 business days.

Please share the exact text you’d like updated and the relevant book title.`;
  return `${greeting}

We’ll review the details of your request and check the relevant account or production information. Our team will provide an update within 48 hours if further investigation is needed.

If you have supporting details or screenshots, please add them to this ticket so we can resolve it as efficiently as possible.`;
}
module.exports = { classifyTicket, draftResponse, fallbackClassify };
