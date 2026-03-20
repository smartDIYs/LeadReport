const HUBSPOT_API_BASE = "https://api.hubapi.com";

function getAccessToken(): string {
  const token = process.env.HUBSPOT_ACCESS_TOKEN;
  if (!token) throw new Error("HUBSPOT_ACCESS_TOKEN is not set");
  return token;
}

async function hubspotFetch(path: string, options?: RequestInit) {
  const res = await fetch(`${HUBSPOT_API_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${getAccessToken()}`,
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HubSpot API error: ${res.status} ${text}`);
  }
  return res.json();
}

const TARGET_FORMS = [
  "新規お問い合わせフォーム",
  "お試し加工フォーム",
  "レンタルフォーム",
  "オンラインデモフォーム",
  "製品体験フォーム",
];

const EXCLUDED_SOURCES: string[] = [];

interface HubSpotForm {
  id: string;
  name: string;
}

interface FormSubmissionValue {
  name: string;
  value: string;
  objectTypeId?: string;
}

interface FormSubmission {
  submittedAt: number;
  values: FormSubmissionValue[];
}

interface ContactProperties {
  email: string;
  hs_analytics_source: string | null;
  hs_analytics_source_data_1: string | null;
  lifecyclestage: string | null;
  createdate: string | null;
}

interface Contact {
  id: string;
  properties: ContactProperties;
}

// Get all forms and find target form GUIDs
async function getTargetForms(): Promise<HubSpotForm[]> {
  const forms: HubSpotForm[] = [];
  let after: string | undefined;

  do {
    const url = `/marketing/v3/forms?limit=100${after ? `&after=${after}` : ""}`;
    const data = await hubspotFetch(url);

    for (const form of data.results || []) {
      if (TARGET_FORMS.includes(form.name)) {
        forms.push({ id: form.id, name: form.name });
      }
    }
    after = data.paging?.next?.after;
  } while (after);

  return forms;
}

// Get form submissions within date range, returning submitter emails
async function getFormSubmissions(
  formGuid: string,
  startTimestamp: number,
  endTimestamp: number
): Promise<string[]> {
  const emails: string[] = [];
  let after: string | undefined;

  while (true) {
    const url = `/form-integrations/v1/submissions/forms/${formGuid}?limit=50${after ? `&after=${after}` : ""}`;
    const data = await hubspotFetch(url);

    let reachedBeforeStart = false;

    for (const submission of (data.results || []) as FormSubmission[]) {
      // Submissions are sorted newest first
      if (submission.submittedAt > endTimestamp) continue;
      if (submission.submittedAt < startTimestamp) {
        reachedBeforeStart = true;
        break;
      }

      const emailField = submission.values?.find(
        (v) => v.name === "email" || v.name === "メールアドレス"
      );
      if (emailField?.value) {
        emails.push(emailField.value.toLowerCase().trim());
      }
    }

    if (reachedBeforeStart || !data.paging?.next?.after) break;
    after = data.paging.next.after;
  }

  return emails;
}

// Batch fetch contacts by email
async function batchGetContacts(emails: string[]): Promise<Contact[]> {
  const contacts: Contact[] = [];
  const batchSize = 100;

  for (let i = 0; i < emails.length; i += batchSize) {
    const batch = emails.slice(i, i + batchSize);

    try {
      const data = await hubspotFetch("/crm/v3/objects/contacts/batch/read", {
        method: "POST",
        body: JSON.stringify({
          properties: [
            "hs_analytics_source",
            "hs_analytics_source_data_1",
            "lifecyclestage",
            "createdate",
            "email",
          ],
          idProperty: "email",
          inputs: batch.map((email) => ({ id: email })),
        }),
      });

      if (data.results) {
        contacts.push(...data.results);
      }
    } catch {
      // Some emails might not match a contact — continue with remaining
      console.error(`Batch read failed for batch starting at index ${i}`);
    }
  }

  return contacts;
}

// Lifecycle stages at or beyond "opportunity"
const OPPORTUNITY_STAGES = new Set([
  "opportunity",
  "customer",
  "evangelist",
]);

// Lifecycle stages at or beyond "customer"
const CUSTOMER_STAGES = new Set(["customer", "evangelist"]);

export interface DrillDownReport {
  name: string;
  totalContacts: number;
  opportunityCount: number;
  customerCount: number;
  opportunityRate: number;
  customerRate: number;
}

export interface TrafficSourceReport {
  source: string;
  sourceLabel: string;
  totalContacts: number;
  opportunityCount: number;
  customerCount: number;
  opportunityRate: number;
  customerRate: number;
  drillDown: DrillDownReport[];
}

export interface ReportResult {
  rows: TrafficSourceReport[];
  meta: {
    formsFound: string[];
    formsNotFound: string[];
    totalSubmissions: number;
    uniqueEmails: number;
    contactsMatched: number;
  };
}

const SOURCE_LABELS: Record<string, string> = {
  ORGANIC_SEARCH: "オーガニック検索",
  PAID_SEARCH: "有料検索",
  EMAIL_MARKETING: "Eメールマーケティング",
  SOCIAL_MEDIA: "オーガニックソーシャル",
  REFERRALS: "参照サイト",
  OTHER_CAMPAIGNS: "その他のキャンペーン",
  PAID_SOCIAL: "有料ソーシャル",
  AI_REFERRALS: "AI参照",
  DIRECT_TRAFFIC: "直接トラフィック",
  OFFLINE: "オフラインソース",
};

export async function generateReport(
  startDate: string,
  endDate: string
): Promise<ReportResult> {
  const startTimestamp = new Date(startDate).getTime();
  const endTimestamp = new Date(`${endDate}T23:59:59.999`).getTime();

  // Step 1: Get target forms
  const forms = await getTargetForms();
  const formsFound = forms.map((f) => f.name);
  const formsNotFound = TARGET_FORMS.filter((name) => !formsFound.includes(name));

  if (forms.length === 0) {
    return {
      rows: [],
      meta: {
        formsFound: [],
        formsNotFound: TARGET_FORMS,
        totalSubmissions: 0,
        uniqueEmails: 0,
        contactsMatched: 0,
      },
    };
  }

  // Step 2: Get submissions for each form in parallel
  const submissionResults = await Promise.all(
    forms.map((form) =>
      getFormSubmissions(form.id, startTimestamp, endTimestamp)
    )
  );

  const allEmails = new Set<string>();
  let totalSubmissions = 0;
  for (const emails of submissionResults) {
    totalSubmissions += emails.length;
    emails.forEach((email) => allEmails.add(email));
  }

  if (allEmails.size === 0) {
    return {
      rows: [],
      meta: {
        formsFound,
        formsNotFound,
        totalSubmissions: 0,
        uniqueEmails: 0,
        contactsMatched: 0,
      },
    };
  }

  // Step 3: Batch fetch contacts
  const contacts = await batchGetContacts(Array.from(allEmails));

  // Step 4: Filter and aggregate (with drill-down)
  type Stats = { total: number; opportunity: number; customer: number };
  const sourceMap = new Map<string, Stats>();
  const drillDownMap = new Map<string, Map<string, Stats>>();

  let contactsMatched = 0;

  for (const contact of contacts) {
    const source = contact.properties.hs_analytics_source;
    const drillDown1 = contact.properties.hs_analytics_source_data_1 || "(不明)";
    const lifecycle = contact.properties.lifecyclestage;
    const createdate = contact.properties.createdate;

    // Skip excluded sources or contacts with no source
    if (!source || EXCLUDED_SOURCES.includes(source)) continue;

    // Filter by createdate within range (new contacts only)
    if (createdate) {
      const created = new Date(createdate).getTime();
      if (created < startTimestamp || created > endTimestamp) continue;
    }

    contactsMatched++;

    // Source-level stats
    if (!sourceMap.has(source)) {
      sourceMap.set(source, { total: 0, opportunity: 0, customer: 0 });
    }
    const stats = sourceMap.get(source)!;
    stats.total++;

    // Drill-down stats
    if (!drillDownMap.has(source)) {
      drillDownMap.set(source, new Map());
    }
    const ddMap = drillDownMap.get(source)!;
    if (!ddMap.has(drillDown1)) {
      ddMap.set(drillDown1, { total: 0, opportunity: 0, customer: 0 });
    }
    const ddStats = ddMap.get(drillDown1)!;
    ddStats.total++;

    if (lifecycle && OPPORTUNITY_STAGES.has(lifecycle)) {
      stats.opportunity++;
      ddStats.opportunity++;
    }
    if (lifecycle && CUSTOMER_STAGES.has(lifecycle)) {
      stats.customer++;
      ddStats.customer++;
    }
  }

  function calcRate(num: number, den: number): number {
    return den > 0 ? Math.round((num / den) * 1000) / 10 : 0;
  }

  // Step 5: Build report rows with drill-down
  const rows: TrafficSourceReport[] = [];
  for (const [source, stats] of sourceMap) {
    const ddMap = drillDownMap.get(source);
    const drillDown: DrillDownReport[] = [];

    if (ddMap) {
      for (const [name, dd] of ddMap) {
        drillDown.push({
          name,
          totalContacts: dd.total,
          opportunityCount: dd.opportunity,
          customerCount: dd.customer,
          opportunityRate: calcRate(dd.opportunity, dd.total),
          customerRate: calcRate(dd.customer, dd.total),
        });
      }
      drillDown.sort((a, b) => b.totalContacts - a.totalContacts);
    }

    rows.push({
      source,
      sourceLabel: SOURCE_LABELS[source] || source,
      totalContacts: stats.total,
      opportunityCount: stats.opportunity,
      customerCount: stats.customer,
      opportunityRate: calcRate(stats.opportunity, stats.total),
      customerRate: calcRate(stats.customer, stats.total),
      drillDown,
    });
  }

  // Sort by total contacts descending
  rows.sort((a, b) => b.totalContacts - a.totalContacts);

  return {
    rows,
    meta: {
      formsFound,
      formsNotFound,
      totalSubmissions,
      uniqueEmails: allEmails.size,
      contactsMatched,
    },
  };
}
