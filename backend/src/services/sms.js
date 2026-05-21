import { prisma } from "../db.js";

const TEXTBEE_API_KEY = process.env.TEXTBEE_API_KEY || "";
const TEXTBEE_DEVICE_ID = process.env.TEXTBEE_DEVICE_ID || "";
/** Workshop line shown in SMS body (call/reply). Sender on the phone is your TextBee Android SIM. */
const WORKSHOP_PHONE = (process.env.WORKSHOP_PHONE || process.env.TEXTBEE_FROM_PHONE || "").trim();
/** Default country calling code (no +), e.g. 255 for Tanzania */
const TEXTBEE_DEFAULT_CC = (process.env.TEXTBEE_DEFAULT_COUNTRY_CODE || "255").replace(/\D/g, "") || "255";

const TEXTBEE_URL = (deviceId) =>
  `https://api.textbee.dev/api/v1/gateway/devices/${encodeURIComponent(deviceId)}/send-sms`;

export async function logSms({ jobId, customerId, category, message, status, providerResponse }) {
  return prisma.smsLog.create({
    data: {
      jobId: jobId || null,
      customerId: customerId || null,
      category,
      message,
      status,
      providerResponse: providerResponse || null,
    },
  });
}

function deviceLabelFromJob(device) {
  const brand = device?.brand?.trim() || "";
  const model = device?.model?.trim() || "";
  if (brand && model) return `${brand} ${model}`;
  return brand || model || "device";
}

/**
 * Normalizes stored phone numbers toward E.164 (TextBee requirement).
 * Optimized for TZ-style storage (07… / 255…); falls back to digits with +.
 */
export function normalizePhoneToE164(phone) {
  const raw = String(phone || "").trim();
  if (!raw) return null;
  const compact = raw.replace(/[\s\-().]/g, "");
  if (compact.startsWith("+")) {
    const digits = compact.slice(1).replace(/\D/g, "");
    return digits.length >= 9 ? `+${digits}` : null;
  }
  const digits = compact.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("0") && digits.length >= 10) {
    return `+${TEXTBEE_DEFAULT_CC}${digits.slice(1)}`;
  }
  if (digits.startsWith(TEXTBEE_DEFAULT_CC)) {
    return `+${digits}`;
  }
  if (digits.length === 9 && digits.startsWith("7")) {
    return `+${TEXTBEE_DEFAULT_CC}${digits}`;
  }
  if (digits.length >= 9 && digits.length <= 15) {
    return `+${digits}`;
  }
  return null;
}

/** Human-readable workshop number for SMS footer (not used as API sender — that is the Android SIM). */
function workshopPhoneForMessage() {
  if (!WORKSHOP_PHONE) return "";
  const e164 = normalizePhoneToE164(WORKSHOP_PHONE);
  if (e164) return e164;
  return WORKSHOP_PHONE.replace(/[\s\-().]/g, "");
}

function contactSuffix() {
  const phone = workshopPhoneForMessage();
  return phone ? ` Call or reply: ${phone}.` : "";
}

/**
 * Customer SMS when workshop status changes (technician quick actions).
 * Sends on Diagnosing, In progress, Waiting parts, and Complete — not on Delivered/Cancelled.
 */
export function customerSmsCategoryOnStatusChange(fromStatus, toStatus) {
  if (!fromStatus || !toStatus || fromStatus === toStatus) return null;
  if (toStatus === "CANCELLED" || toStatus === "DELIVERED" || toStatus === "PENDING") return null;
  if (toStatus === "DIAGNOSING") return "REPAIR_DIAGNOSING";
  if (toStatus === "IN_PROGRESS") return "REPAIR_IN_PROGRESS";
  if (toStatus === "WAITING_PARTS") return "WAITING_PARTS";
  if (toStatus === "COMPLETE") return "REPAIR_COMPLETED";
  return null;
}

export function smsTemplates({ deviceLabel, jobNumber }) {
  const device = deviceLabel || "device";
  const contact = contactSuffix();
  return {
    JOB_RECEIVED: `Your computer (${device}) has been received successfully at BIOSFIX TECHNOLOGY. Job: ${jobNumber}.${contact}`,
    REPAIR_STARTED: `Your computer (${device}) repair has started at BIOSFIX TECHNOLOGY. Job: ${jobNumber}.${contact}`,
    REPAIR_DIAGNOSING: `Your computer (${device}) is being diagnosed at BIOSFIX TECHNOLOGY. Job: ${jobNumber}.${contact}`,
    REPAIR_IN_PROGRESS: `Repair of your computer (${device}) is in progress at BIOSFIX TECHNOLOGY. Job: ${jobNumber}.${contact}`,
    WAITING_PARTS: `Your repair (${device}) is waiting for parts at BIOSFIX TECHNOLOGY. Job: ${jobNumber}. We will notify you when parts arrive.${contact}`,
    REPAIR_COMPLETED: `Repair of your computer (${device}) is complete. Collect at BIOSFIX TECHNOLOGY. Job: ${jobNumber}.${contact}`,
    COLLECTION_REMINDER: `Reminder: your computer (${device}) is ready for collection at BIOSFIX TECHNOLOGY. Job: ${jobNumber}.${contact}`,
  };
}

/** Send intake SMS after a new job is registered (reception walk-in). */
export async function sendJobReceivedSms(job) {
  const cust = job.customer;
  if (!cust?.phone) return { ok: false, reason: "no_phone" };
  const templates = smsTemplates({
    deviceLabel: deviceLabelFromJob(job.device),
    jobNumber: job.jobNumber,
  });
  return sendSms({
    to: cust.phone,
    message: templates.JOB_RECEIVED,
    jobId: job.id,
    customerId: cust.id,
    category: "JOB_RECEIVED",
  });
}

/** Send customer SMS for a workshop status change, if applicable. */
export async function sendCustomerStatusSms(job, fromStatus, toStatus) {
  const cat = customerSmsCategoryOnStatusChange(fromStatus, toStatus);
  if (!cat || !job?.customer?.phone) return { ok: false, reason: "no_sms_for_transition" };
  const templates = smsTemplates({
    deviceLabel: deviceLabelFromJob(job.device),
    jobNumber: job.jobNumber,
  });
  const message = templates[cat];
  if (!message) return { ok: false, reason: "no_template" };
  return sendSms({
    to: job.customer.phone,
    message,
    jobId: job.id,
    customerId: job.customer.id,
    category: cat,
  });
}

/**
 * textbee.dev — Android gateway API.
 * Messages are sent from the SIM in your registered TextBee phone (customer sees that number).
 * Set TEXTBEE_API_KEY and TEXTBEE_DEVICE_ID from https://app.textbee.dev/dashboard
 * Set WORKSHOP_PHONE to your business line (shown in SMS text for call/reply).
 * Optional: TEXTBEE_DEFAULT_COUNTRY_CODE=255 when numbers are stored as 07… without +.
 */
export async function sendSms({ to, message, jobId, customerId, category }) {
  const e164 = normalizePhoneToE164(to);
  if (!e164) {
    await logSms({
      jobId,
      customerId,
      category,
      message,
      status: "skipped_invalid_phone",
      providerResponse: JSON.stringify({ raw: to }),
    });
    return { ok: false, mode: "skipped", reason: "invalid_phone" };
  }

  if (!TEXTBEE_API_KEY || !TEXTBEE_DEVICE_ID) {
    await logSms({
      jobId,
      customerId,
      category,
      message,
      status: "skipped_no_credentials",
      providerResponse: JSON.stringify({
        note: "Set TEXTBEE_API_KEY and TEXTBEE_DEVICE_ID for live SMS (see .env.example)",
      }),
    });
    return { ok: true, mode: "log_only" };
  }

  try {
    const res = await fetch(TEXTBEE_URL(TEXTBEE_DEVICE_ID), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": TEXTBEE_API_KEY,
      },
      body: JSON.stringify({
        recipients: [e164],
        message,
      }),
    });
    const text = await res.text();
    await logSms({
      jobId,
      customerId,
      category,
      message,
      status: res.ok ? "sent" : "failed",
      providerResponse: text.slice(0, 2000),
    });
    return { ok: res.ok, mode: "live", status: res.status };
  } catch (e) {
    await logSms({
      jobId,
      customerId,
      category,
      message,
      status: "error",
      providerResponse: String(e).slice(0, 2000),
    });
    return { ok: false, error: String(e) };
  }
}
