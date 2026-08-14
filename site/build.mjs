import fs from 'node:fs';
import path from 'node:path';

const DIST_DIR = path.resolve('site/dist');
const API_URL = process.env.LICENCECHECK_API || 'https://licencecheck.workers.dev';

// Ensure directory tree exists
function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

// Layout wrapper
function pageLayout(title, description, content, canonicalPath = '', jsonLd = null) {
  const canonicalUrl = `https://licencecheck.pages.dev${canonicalPath}`;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} | LicenceCheck Official Operating-Status Verifier</title>
  <meta name="description" content="${description}">
  <link rel="canonical" href="${canonicalUrl}">
  <style>
    :root {
      --bg: #0d1117;
      --card-bg: #161b22;
      --border: #30363d;
      --text: #c9d1d9;
      --text-heading: #ffffff;
      --accent: #58a6ff;
      --active-green: #238636;
      --closed-red: #da3633;
      --lapsed-orange: #d29922;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.6;
      margin: 0;
      padding: 0;
    }
    header {
      background: var(--card-bg);
      border-bottom: 1px solid var(--border);
      padding: 1rem 2rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    header a {
      color: var(--text-heading);
      text-decoration: none;
      font-weight: bold;
      font-size: 1.2rem;
    }
    nav a {
      color: var(--accent);
      margin-left: 1.5rem;
      text-decoration: none;
    }
    main {
      max-width: 900px;
      margin: 2rem auto;
      padding: 0 1rem;
    }
    h1 {
      color: var(--text-heading);
      font-size: 2.2rem;
      margin-bottom: 0.5rem;
    }
    .status-banner {
      display: inline-block;
      padding: 0.4rem 1rem;
      border-radius: 6px;
      font-weight: bold;
      margin: 1rem 0;
      text-transform: uppercase;
    }
    .status-ACTIVE { background: var(--active-green); color: #fff; }
    .status-CLOSED { background: var(--closed-red); color: #fff; }
    .status-LAPSED { background: var(--lapsed-orange); color: #fff; }
    .status-REVOKED { background: var(--closed-red); color: #fff; }
    
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 1.5rem 0;
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 6px;
      overflow: hidden;
    }
    th, td {
      padding: 0.75rem 1rem;
      text-align: left;
      border-bottom: 1px solid var(--border);
    }
    th {
      background: #21262d;
      color: var(--text-heading);
    }
    .cta-box {
      background: linear-gradient(135deg, #1f6feb 0%, #238636 100%);
      padding: 1.5rem;
      border-radius: 8px;
      color: white;
      text-align: center;
      margin: 2.5rem 0;
    }
    .cta-box a {
      background: white;
      color: #0d1117;
      padding: 0.75rem 1.5rem;
      border-radius: 6px;
      text-decoration: none;
      font-weight: bold;
      display: inline-block;
      margin-top: 1rem;
    }
    footer {
      border-top: 1px solid var(--border);
      text-align: center;
      padding: 2rem;
      color: #8b949e;
      margin-top: 4rem;
    }
  </style>
  ${jsonLd ? `<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>` : ''}
</head>
<body>
  <header>
    <a href="/">LicenceCheck</a>
    <nav>
      <a href="/coverage/">Coverage</a>
      <a href="/methodology/">Methodology</a>
      <a href="https://apify.com/store" target="_blank">Apify Actor</a>
    </nav>
  </header>
  <main>
    ${content}
  </main>
  <footer>
    <p>LicenceCheck — Official Operating-Status Verifier for Local Business Lists. Data sourced directly from municipal government open data portals.</p>
  </footer>
</body>
</html>`;
}

// Sample static pages builder
async function buildSite() {
  console.log('Building pSEO static site in site/dist...');
  ensureDir(DIST_DIR);

  // 1. Build Index / Home page
  const indexContent = `
    <h1>Official Operating-Status Verifier for Local Business Lists</h1>
    <p>LicenceCheck verifies whether local businesses still hold active government operating licences, or if they have lapsed, closed, or been revoked. Powered by direct municipal registry ingest and historical delta tracking.</p>
    
    <div class="cta-box">
      <h2>Verify a whole list of local businesses</h2>
      <p>Clean your leads list before running outreach or CRM imports. Pay only $0.05 per matched official record.</p>
      <a href="https://apify.com/store" target="_blank">Verify List on Apify Store →</a>
    </div>

    <h2>Covered Municipalities</h2>
    <ul>
      <li><strong>Chicago, IL</strong> — Official BACP Licence Register</li>
      <li><strong>New York City, NY</strong> — DCA & DOB License Datasets</li>
      <li><strong>San Francisco, CA</strong> — TTX Registered Businesses</li>
      <li><strong>Los Angeles, CA</strong> — Office of Finance Active Register Delta Archive</li>
    </ul>
  `;

  fs.writeFileSync(
    path.join(DIST_DIR, 'index.html'),
    pageLayout('LicenceCheck — Business Licence Status Verifier', 'Verify whether local businesses are active, lapsed, revoked, or closed against official government licence registries.', indexContent, '/')
  );

  // 2. Build /coverage/ page
  const coverageDir = path.join(DIST_DIR, 'coverage');
  ensureDir(coverageDir);
  const coverageContent = `
    <h1>Municipal Registry Coverage & Data Freshness</h1>
    <p>LicenceCheck maintains direct daily automated ingest connections to official municipal open data portals. The table below lists active coverage, closure determination methods, and current data freshness.</p>
    
    <table>
      <thead>
        <tr>
          <th>City / Jurisdiction</th>
          <th>Portal Domain</th>
          <th>Closure Method</th>
          <th>Freshness</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Chicago, IL</td>
          <td>data.cityofchicago.org</td>
          <td>Status code & expiration date</td>
          <td>Live daily sync</td>
          <td><span style="color:#3fb950">Active</span></td>
        </tr>
        <tr>
          <td>New York, NY</td>
          <td>data.cityofnewyork.us</td>
          <td>Status string & expiry date</td>
          <td>Live daily sync</td>
          <td><span style="color:#3fb950">Active</span></td>
        </tr>
        <tr>
          <td>San Francisco, CA</td>
          <td>data.sfgov.org</td>
          <td>DBA & Location end date</td>
          <td>Live daily sync</td>
          <td><span style="color:#3fb950">Active</span></td>
        </tr>
        <tr>
          <td>Los Angeles, CA</td>
          <td>data.lacity.org</td>
          <td>Snapshot Delta Archive (3-streak)</td>
          <td>Live daily sync</td>
          <td><span style="color:#3fb950">Active</span></td>
        </tr>
      </tbody>
    </table>

    <div class="cta-box">
      <h2>Need list hygiene for these cities?</h2>
      <a href="https://apify.com/store" target="_blank">Run LicenceCheck Actor →</a>
    </div>
  `;

  const datasetJsonLd = {
    "@context": "https://schema.org/",
    "@type": "Dataset",
    "name": "LicenceCheck Municipal Business Operating Status Archive",
    "description": "Multi-city municipal business licence status and historical closure dataset.",
    "url": "https://licencecheck.pages.dev/coverage/"
  };

  fs.writeFileSync(
    path.join(coverageDir, 'index.html'),
    pageLayout('Municipal Registry Coverage & Data Freshness', 'Live coverage status and data freshness metrics for Chicago, NYC, SF, and LA business licence registries.', coverageContent, '/coverage/', datasetJsonLd)
  );

  // 3. Build /methodology/ page
  const methodologyDir = path.join(DIST_DIR, 'methodology');
  ensureDir(methodologyDir);
  const methodologyContent = `
    <h1>Matching Methodology & 3-State Honesty Rule</h1>
    <p>LicenceCheck applies a deterministic blocking and similarity scoring algorithm to match user input lists against official government licence registries.</p>

    <h2>The 3-State Honesty Rule</h2>
    <p>To ensure zero false billing and eliminate incorrect support inquiries, LicenceCheck output is strictly structured:</p>
    <ul>
      <li><strong>ACTIVE / LAPSED / REVOKED / CLOSED</strong>: Billed at $0.05. Matched to an official government licence record.</li>
      <li><strong>NOT_IN_LICENSED_CATEGORY</strong>: Free ($0.00). The business type (e.g. software consultancy) does not require a city licence in that jurisdiction.</li>
      <li><strong>NO_COVERAGE</strong>: Free ($0.00). The city has not yet been ingested into our archive.</li>
      <li><strong>AMBIGUOUS</strong>: Free ($0.00). Multiple candidates exist at the target address and match confidence is below 0.88. We refuse to guess.</li>
    </ul>
  `;

  fs.writeFileSync(
    path.join(methodologyDir, 'index.html'),
    pageLayout('Matching Methodology & 3-State Honesty Rule', 'How LicenceCheck matches business records to municipal registers with zero false billing.', methodologyContent, '/methodology/')
  );

  // 4. Build sample business pSEO page: /business/joes-pizza-n-main-st-60601/
  const businessSampleDir = path.join(DIST_DIR, 'business', 'joes-pizza-n-main-st-60601');
  ensureDir(businessSampleDir);
  const businessContent = `
    <h1>Is JOE'S PIZZA in Chicago, IL still open?</h1>
    <div class="status-banner status-ACTIVE">ACTIVE — Official Licence on File</div>

    <h2>Government Licence Details</h2>
    <table>
      <tr><th>Legal Name</th><td>JOES PIZZA INC</td></tr>
      <tr><th>DBA Name</th><td>JOE'S PIZZA</td></tr>
      <tr><th>Licence Number</th><td>2701234</td></tr>
      <tr><th>Category</th><td>Retail Food Establishment</td></tr>
      <tr><th>Jurisdiction</th><td>Chicago, IL</td></tr>
      <tr><th>Issued Date</th><td>2021-04-02</td></tr>
      <tr><th>Expiration Date</th><td>2027-05-15</td></tr>
      <tr><th>Address</th><td>123 N MAIN ST, CHICAGO IL 60601</td></tr>
      <tr><th>Official Source</th><td><a href="https://data.cityofchicago.org" target="_blank" rel="nofollow">City of Chicago Open Data Record ↗</a></td></tr>
    </table>

    <h2>Licence Operating Status Timeline</h2>
    <table>
      <thead>
        <tr><th>Observed Date</th><th>From</th><th>To</th><th>Evidence</th></tr>
      </thead>
      <tbody>
        <tr><td>2021-04-02</td><td>—</td><td>ACTIVE</td><td>Initial licence issuance observed</td></tr>
        <tr><td>2023-05-15</td><td>ACTIVE</td><td>ACTIVE</td><td>Licence renewal observed</td></tr>
      </tbody>
    </table>

    <div class="cta-box">
      <h2>Verify a whole list of Chicago businesses</h2>
      <p>Clean your lead lists directly against official Chicago registers.</p>
      <a href="https://apify.com/store" target="_blank">Verify Business List →</a>
    </div>
  `;

  const businessJsonLd = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "name": "JOE'S PIZZA",
    "address": {
      "@type": "PostalAddress",
      "streetAddress": "123 N MAIN ST",
      "addressLocality": "Chicago",
      "addressRegion": "IL",
      "postalCode": "60601"
    }
  };

  fs.writeFileSync(
    path.join(businessSampleDir, 'index.html'),
    pageLayout("Is JOE'S PIZZA in Chicago, IL still open?", "Check official Chicago licence operating status, issue dates, and status change history for JOE'S PIZZA.", businessContent, '/business/joes-pizza-n-main-st-60601/', businessJsonLd)
  );

  // 5. Build sitemap index & sitemap.xml
  const sitemapContent = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://licencecheck.pages.dev/</loc><priority>1.0</priority></url>
  <url><loc>https://licencecheck.pages.dev/coverage/</loc><priority>0.9</priority></url>
  <url><loc>https://licencecheck.pages.dev/methodology/</loc><priority>0.8</priority></url>
  <url><loc>https://licencecheck.pages.dev/business/joes-pizza-n-main-st-60601/</loc><priority>0.7</priority></url>
</urlset>`;

  fs.writeFileSync(path.join(DIST_DIR, 'sitemap.xml'), sitemapContent);

  console.log('Static site build complete in site/dist/!');
}

buildSite().catch(err => {
  console.error('Build site error:', err);
  process.exit(1);
});
