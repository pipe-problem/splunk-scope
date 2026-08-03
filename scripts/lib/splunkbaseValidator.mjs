/**
 * Shared Splunkbase URL validation for refresh + validate scripts.
 */

const SPLUNKBASE_APP_RE = /^https:\/\/splunkbase\.splunk\.com\/app\/(\d+)\/?$/;
const USER_AGENT = 'SplunkScope-CatalogValidator/1.0';

export function canonicalSplunkbaseUrl(appId) {
  return `https://splunkbase.splunk.com/app/${String(appId).trim()}`;
}

export function parseAppIdFromUrl(url) {
  if (!url) return null;
  const m = String(url).match(SPLUNKBASE_APP_RE);
  return m ? m[1] : null;
}

export function normalizeTitle(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/splunk\s+/gi, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function titleMatchScore(expected, actual) {
  const e = normalizeTitle(expected).split(' ').filter(Boolean);
  const a = normalizeTitle(actual).split(' ').filter(Boolean);
  if (!e.length || !a.length) return 0;
  let matches = 0;
  for (const word of e) {
    if (a.some((x) => x.includes(word) || word.includes(x))) matches += 1;
  }
  return matches / Math.max(e.length, 1);
}

export function extractPageMeta(html) {
  const h1 = (html.match(/<h1[^>]*>([^<]+)<\/h1>/i) || [])[1]?.trim() || '';
  const title = (html.match(/<title>([^<]+)<\/title>/i) || [])[1]?.trim() || '';
  const builtBy = (html.match(/Built by ([^<\n]+)/i) || [])[1]?.trim() || '';
  const createdBy = (html.match(/Created By\s*<\/[^>]+>\s*([^<\n]+)/i) || [])[1]?.trim() || '';
  const typeMatch = (html.match(/Type\s*<\/[^>]+>\s*([^<\n]+)/i) || [])[1]?.trim() || '';
  const snippet = html.slice(0, 80000).replace(/\s+/g, ' ');
  const deprecation = /deprecated|end of life|end-of-life|migrate to|replacement product|no longer supported/i.test(snippet);
  let replacementUrl = null;
  const replMatch = snippet.match(/https:\/\/splunkbase\.splunk\.com\/app\/(\d+)/i);
  if (replMatch && deprecation) {
    replacementUrl = canonicalSplunkbaseUrl(replMatch[1]);
  }
  return { h1, title, builtBy, createdBy, typeMatch, deprecation, replacementUrl, snippet };
}

export function inferVendor(meta) {
  const raw = meta.createdBy || meta.builtBy || '';
  if (/splunk/i.test(raw)) return 'Splunk LLC';
  if (/cisco/i.test(raw)) return 'Cisco Systems, Inc.';
  if (/proofpoint/i.test(raw)) return 'Proofpoint Splunk Integrations';
  if (/fortinet/i.test(raw)) return 'Fortinet, Inc.';
  if (/tenable/i.test(raw)) return 'Tenable, Inc.';
  if (/palo alto/i.test(raw)) return 'Palo Alto Networks';
  if (/duo/i.test(raw)) return 'Duo Security';
  return raw || 'Community';
}

export function inferType(meta, fallback = 'addon') {
  const t = (meta.typeMatch || '').toLowerCase();
  if (t.includes('connector')) return 'connector';
  if (t.includes('content')) return 'content_pack';
  if (t === 'app') return 'app';
  if (t.includes('addon') || t.includes('add-on')) return 'addon';
  return fallback;
}

/**
 * @param {object} entry - seed/catalog entry
 * @param {{ fetchImpl?: typeof fetch, minScore?: number }} opts
 */
export async function validateSplunkbaseEntry(entry, opts = {}) {
  const fetchImpl = opts.fetchImpl || fetch;
  const minScore = opts.minScore ?? 0.45;
  const appId = entry.splunkbaseAppId || parseAppIdFromUrl(entry.splunkbaseUrl);
  const url = entry.splunkbaseUrl || (appId ? canonicalSplunkbaseUrl(appId) : null);

  if (!url || !appId) {
    return {
      ...entry,
      splunkbaseUrl: url,
      splunkbaseAppId: appId,
      status: 'needsReview',
      notes: [entry.notes, 'Missing splunkbaseUrl or splunkbaseAppId'].filter(Boolean).join(' ').trim(),
      validationReason: 'missing_url_or_app_id',
    };
  }

  const urlId = parseAppIdFromUrl(url);
  if (urlId !== String(appId)) {
    return {
      ...entry,
      splunkbaseUrl: canonicalSplunkbaseUrl(appId),
      splunkbaseAppId: String(appId),
      status: 'needsReview',
      notes: [entry.notes, `URL app ID ${urlId} does not match splunkbaseAppId ${appId}`].filter(Boolean).join(' ').trim(),
      validationReason: 'app_id_mismatch',
    };
  }

  try {
    const res = await fetchImpl(url, {
      redirect: 'follow',
      headers: { 'User-Agent': USER_AGENT, Accept: 'text/html' },
    });
    const html = await res.text();
    const meta = extractPageMeta(html);

    if (res.status === 404 || /404/.test(meta.h1)) {
      return {
        ...entry,
        splunkbaseUrl: canonicalSplunkbaseUrl(appId),
        splunkbaseAppId: String(appId),
        status: 'needsReview',
        notes: [entry.notes, `HTTP ${res.status} — Splunkbase page not found`].filter(Boolean).join(' ').trim(),
        validationReason: 'http_404',
        pageTitle: meta.h1 || meta.title,
      };
    }

    if (res.status !== 200) {
      return {
        ...entry,
        splunkbaseUrl: canonicalSplunkbaseUrl(appId),
        splunkbaseAppId: String(appId),
        status: 'needsReview',
        notes: [entry.notes, `HTTP ${res.status} — could not verify listing`].filter(Boolean).join(' ').trim(),
        validationReason: `http_${res.status}`,
        pageTitle: meta.h1 || meta.title,
      };
    }

    const pageTitle = meta.h1 || meta.title;
    const score = Math.max(
      titleMatchScore(entry.name, pageTitle),
      ...(entry.aliases || []).map((a) => titleMatchScore(a, pageTitle)),
    );

    let status = entry.status === 'deprecated' ? 'deprecated' : 'verified';
    let replacementId = entry.replacementId ?? null;
    let notes = entry.notes || '';

    if (meta.deprecation) {
      status = entry.replacementId ? 'replacementPreferred' : 'deprecated';
      const replAppId = meta.replacementUrl ? parseAppIdFromUrl(meta.replacementUrl) : null;
      if (replAppId && !replacementId) {
        notes = [notes, `Splunkbase deprecation notice references app ${replAppId}`].filter(Boolean).join(' ').trim();
      }
    }

    if (score < minScore && status !== 'deprecated') {
      status = 'needsReview';
      notes = [notes, `Page title "${pageTitle}" does not closely match expected name (score ${score.toFixed(2)})`].filter(Boolean).join(' ').trim();
    }

    if (entry.forceStatus) {
      status = entry.forceStatus;
    }

    return {
      ...entry,
      name: pageTitle && score >= minScore ? pageTitle : entry.name,
      splunkbaseUrl: canonicalSplunkbaseUrl(appId),
      splunkbaseAppId: String(appId),
      status,
      replacementId,
      vendor: entry.vendor || inferVendor(meta),
      type: entry.type || inferType(meta),
      notes,
      validationReason: status === 'verified' ? null : status,
      pageTitle,
      titleMatchScore: score,
      lastVerified: new Date().toISOString().slice(0, 10),
    };
  } catch (err) {
    return {
      ...entry,
      splunkbaseUrl: canonicalSplunkbaseUrl(appId),
      splunkbaseAppId: String(appId),
      status: 'needsReview',
      notes: [entry.notes, `Validation error: ${err.message}`].filter(Boolean).join(' ').trim(),
      validationReason: 'network_error',
    };
  }
}

export function isCustomerFacingLinkSafe(entry) {
  return entry && (entry.status === 'verified' || entry.status === 'replacementPreferred');
}

export function resolveCustomerUrl(entry, catalogById) {
  if (!entry) return null;
  if (entry.status === 'verified') return entry.splunkbaseUrl;
  if (entry.status === 'replacementPreferred' && entry.replacementId) {
    const repl = catalogById.get(entry.replacementId);
    if (repl?.splunkbaseUrl && repl.status === 'verified') return repl.splunkbaseUrl;
  }
  if (entry.status === 'deprecated' && entry.replacementId) {
    const repl = catalogById.get(entry.replacementId);
    if (repl?.splunkbaseUrl && repl.status === 'verified') return repl.splunkbaseUrl;
  }
  return null;
}
