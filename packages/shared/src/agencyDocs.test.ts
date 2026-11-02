import { describe, expect, it } from 'vitest';
import {
  AGENCY_DOC_KINDS,
  agencyDocStarter,
  amountInWords,
  CONTRACT_TEMPLATES,
  contractAsText,
  contractParties,
  defaultDocStyle,
  docDate,
  docHeadingText,
  docRef,
  DOC_ACCENTS,
  DOC_FONTS,
  DOC_MARGINS,
  DOC_PAGES,
  DOC_SIZES,
  emptyInvoiceDoc,
  emptyParty,
  houseDoc,
  houseInvoiceDoc,
  invoiceAsText,
  invoiceForClient,
  invoiceTotals,
  money,
  monthlyReportDoc,
  parseContractDoc,
  parseDocStyle,
  parseInvoiceDoc,
  parseProfile,
  parseRetainerInput,
  retainerProposalDoc,
  stripNumber,
  type ContractDoc,
  type Invoice,
} from './index';

const sampleInvoice = (): Invoice => {
  const doc = parseInvoiceDoc({
    title: 'Tax invoice',
    from: { name: 'Studio One', line: 'Prop. A. Person', taxIds: [{ label: 'PAN', value: 'ABCDE1234F' }], address: '1 Main Road\nPune', email: 'hello@studio.test', phone: '' },
    to: { name: 'Acme Foods', line: 'Acme Foods Pvt Ltd', taxIds: [], address: '', email: '', phone: '' },
    bank: { bankName: 'Test Bank', holder: 'Studio One', account: '123456789', ifsc: 'tst0001', upi: '' },
    gstBps: 1800,
    gstSplit: true,
    tdsBps: 1000,
    tdsMode: 'show',
    footnote: 'Thank you.',
  });
  return {
    id: 'i1',
    number: 'KR-0007',
    ownerName: 'Studio One',
    ownerHandle: null,
    clientName: 'Acme Foods',
    clientEmail: '',
    items: [
      { description: 'Voxpop videos package', quantity: 5, unitCents: 700000 },
      { description: 'Extra edit', quantity: 1, unitCents: 150050 },
    ],
    totalCents: 0,
    currency: 'INR',
    status: 'sent',
    issueDate: '2026-09-22',
    dueDate: '2026-10-06',
    note: 'Please pay by the due date.',
    token: 'ABC',
    paidAt: null,
    createdAt: '2026-09-22T00:00:00.000Z',
    doc,
    agencyClientId: 'c1',
    revisedAt: null,
  };
};

describe('document style', () => {
  it('defaults are valid keys', () => {
    const d = defaultDocStyle();
    expect(DOC_FONTS).toContain(d.font);
    expect(DOC_SIZES).toContain(d.size);
    expect(DOC_ACCENTS).toContain(d.accent);
    expect(DOC_PAGES).toContain(d.page);
    expect(DOC_MARGINS).toContain(d.margin);
    expect(parseDocStyle(undefined)).toEqual(d);
  });
  it('anything that is not a known key falls back, so no raw value is ever kept', () => {
    const s = parseDocStyle({ font: 'url(javascript:alert(1))', size: 'huge', accent: '#ff0000', page: 'a3', margin: 'none', heading: 'x', signLayout: 'diagonal', logo: 'https://evil.test/x.png', footer: 'f'.repeat(500), pageNumbers: 'yes', letterhead: 0 });
    expect(s.font).toBe('serif');
    expect(s.size).toBe('normal');
    expect(s.accent).toBe('ink');
    expect(s.page).toBe('a4');
    expect(s.margin).toBe('normal');
    expect(s.heading).toBe('numbered');
    expect(s.signLayout).toBe('side');
    expect(s.logo).toBe('');
    expect(s.footer.length).toBe(200);
    expect(s.pageNumbers).toBe(true);
    expect(s.letterhead).toBe(true);
  });
  it('keeps real choices and an uploaded logo id, and a base fills the gaps', () => {
    const s = parseDocStyle({ font: 'sans', size: 'large', accent: 'navy', page: 'letter', margin: 'wide', heading: 'plain', logo: 'a1b2c3d4-e5f6', pageNumbers: false, signLayout: 'stacked', letterhead: false });
    expect(s).toMatchObject({ font: 'sans', size: 'large', accent: 'navy', page: 'letter', margin: 'wide', heading: 'plain', logo: 'a1b2c3d4-e5f6', pageNumbers: false, signLayout: 'stacked', letterhead: false });
    expect(parseDocStyle(s)).toEqual(s);
    expect(parseDocStyle({ font: 'nonsense' }, s).font).toBe('sans');
  });
  it('rides inside invoices, agreements and the business profile', () => {
    expect(parseInvoiceDoc({ style: { font: 'sans' } }).style?.font).toBe('sans');
    expect(parseInvoiceDoc({}).style?.font).toBe('serif');
    const c = parseContractDoc({ sections: [], style: { page: 'letter' } });
    expect(c?.style?.page).toBe('letter');
    expect(parseProfile({ docStyle: { accent: 'green' } }).docStyle?.accent).toBe('green');
    expect(emptyInvoiceDoc().style).toBeUndefined();
  });
});

describe('numbering and references', () => {
  it('numbers headings in order and drops the typed number', () => {
    expect(stripNumber('4. Trial content')).toBe('Trial content');
    expect(stripNumber('3.1 Something')).toBe('Something');
    expect(docHeadingText(defaultDocStyle(), '4. Trial content', 2)).toBe('2. Trial content');
    expect(docHeadingText(parseDocStyle({ heading: 'plain' }), '4. Trial content', 2)).toBe('4. Trial content');
  });
  it('references are short and upper case', () => {
    expect(docRef('AGR', 'a1b2-c3d4-e5')).toBe('AGR-A1B2C3');
    expect(docDate('2026-10-02T10:00:00.000Z')).toBe('2 Oct 2026');
  });
});

describe('agreement text', () => {
  const sign = (t: string) => {
    expect(t).not.toMatch(/undefined|null|\[object/);
    expect(t).not.toMatch(/<[a-z/][^>]*>/i);
    expect(t).not.toContain('**');
  };
  it('every built-in template reads as clean text with its blanks filled', () => {
    for (const t of CONTRACT_TEMPLATES) {
      const doc: ContractDoc = { ...t.doc, vars: { provider: 'A. Person', providerTitle: 'Founder', providerBusiness: 'Studio One', client: 'Acme Foods', clientAddress: 'Pune', clientContact: 'Asha', brands: 'Acme', jurisdiction: 'Pune' } };
      const text = contractAsText(doc, { reference: 'AGR-1', date: '2026-10-01' });
      sign(text);
      expect(text).toContain('Acme Foods');
      expect(text).toContain('Reference: AGR-1');
      expect(text).toMatch(/\n1\. PARTIES/);
      expect(text).toContain('\n\n');
    }
  });
  it('lists packages in whole cents, the brief with its answers, and the signature lines', () => {
    const base = CONTRACT_TEMPLATES.find((t) => t.key === 'trial')!.doc;
    const doc: ContractDoc = { ...base, vars: { client: 'Acme Foods' }, sections: base.sections.map((s) => (s.kind === 'packages' ? { ...s, packages: [{ name: 'Starter', units: 5, feeCents: 3500000 }] } : s)) };
    const text = contractAsText(doc, { answers: { objective: { picked: ['Paid ads and performance marketing'], other: '', text: '' } }, acceptance: { name: 'Asha Rao', title: 'Head of Brand', at: '2026-10-03T08:30:00.000Z' } });
    sign(text);
    expect(text).toContain(`Starter: 5 videos, ${money(3500000)}`);
    expect(text).toContain('[x] Paid ads and performance marketing');
    expect(text).toContain('Accepted electronically by Asha Rao on 3 Oct 2026, 08:30 UTC. Typed acceptance, not a certified e-signature.');
    expect(text).toContain('Signature: ____________________');
  });
  it('shows a parties block only when there is no Parties section', () => {
    const vars = { provider: 'A. Person', providerBusiness: 'Studio One', client: 'Acme Foods' };
    expect(contractParties({ vars }).map((p) => p.label)).toEqual(['Service provider', 'Client']);
    const withSection = { ...agencyDocStarter('brief'), vars };
    expect(contractAsText(withSection)).toContain('Service provider:');
    expect(contractAsText({ ...CONTRACT_TEMPLATES[0]!.doc, vars })).not.toContain('Service provider:\n');
  });
});

describe('invoice text', () => {
  it('has the lines, the CGST and SGST split and the TDS lines right in whole cents', () => {
    const inv = sampleInvoice();
    const t = invoiceTotals(inv.items, inv.doc);
    // 5 x 7000.00 + 1500.50 = 36500.50; GST 18% = 6570.09 (rounded), split 3285.04 + 3285.05
    expect(t.subtotal).toBe(3650050);
    expect(t.gst).toBe(657009);
    expect(t.cgst + t.sgst).toBe(t.gst);
    const text = invoiceAsText(inv);
    expect(text).toContain('TAX INVOICE KR-0007');
    expect(text).toContain('Date: 22 Sep 2026');
    expect(text).toContain(`Subtotal: ${money(t.subtotal)}`);
    expect(text).toContain(`CGST (9%): ${money(t.cgst)}`);
    expect(text).toContain(`SGST (9%): ${money(t.sgst)}`);
    expect(text).toContain(`Total: ${money(t.total)}`);
    expect(text).toContain(`Total amount in words: ${amountInWords(t.total)}`);
    expect(text).toContain(`TDS to deduct (10%): -${money(t.tdsDeducted)}`);
    expect(text).toContain(`To pay after TDS: ${money(t.netReceivable)}`);
    expect(text).toContain('IFSC code: TST0001');
    expect(text).not.toMatch(/undefined|<[a-z/][^>]*>|\*\*/i);
  });
  it('adds the TDS, then takes it off, and says so under the total when the client pays the TDS', () => {
    const inv = sampleInvoice();
    inv.doc = { ...inv.doc, tdsMode: 'grossup', gstSplit: false };
    const t = invoiceTotals(inv.items, inv.doc);
    const text = invoiceAsText(inv);
    expect(text).toContain(`TDS adjusted: ${money(t.tdsAdjusted)}`);
    expect(text).toContain(`GST (18%): ${money(t.gst)}`);
    expect(text).toContain(`TDS to deduct (${inv.doc.tdsBps / 100}%): -${money(t.tdsDeducted)}`);
    expect(text).toContain(`To pay after TDS: ${money(t.netReceivable)}`);
    expect(text).toContain('applicable for TDS deducted to be borne by the company as per the agreement terms.');
    expect(text).not.toMatch(/receive/i);
  });
  it('the client version leaves out what was switched off', () => {
    const inv = sampleInvoice();
    inv.doc = { ...inv.doc, show: { ...inv.doc.show, bank: false, words: false, notes: false } };
    const text = invoiceAsText(invoiceForClient(inv));
    expect(text).not.toContain('IFSC');
    expect(text).not.toContain('Bank account details');
    expect(text).not.toContain('Total amount in words');
    expect(text).not.toContain('Please pay by the due date');
    expect(text).toContain('Acme Foods');
    void emptyParty;
  });
});

describe('other kinds of document', () => {
  it('every kind starts as a document the editor and the page can open', () => {
    for (const kind of AGENCY_DOC_KINDS) {
      const doc = agencyDocStarter(kind);
      expect(doc.title.length).toBeGreaterThan(3);
      expect(doc.sections.length).toBeGreaterThan(3);
      expect(doc.sections.at(-1)?.kind).toBe('signatures');
      expect(parseContractDoc(doc)?.sections.length).toBe(doc.sections.length);
      const text = contractAsText(doc);
      expect(text).not.toMatch(/undefined|\*\*/);
    }
  });
  it('trial terms come from the trial agreement and point at no section numbers', () => {
    const t = contractAsText(agencyDocStarter('trial_terms'));
    expect(t).not.toMatch(/section \d/);
    expect(t).toContain('evaluation and approval only');
    expect(t).toContain('one point of contact');
  });
  it('a retainer proposal prices each option from the monthly fee, in whole cents', () => {
    const doc = retainerProposalDoc({ monthlyFeeCents: 4500050, months: [6, 1, 3, 3], deliverables: ['8 short videos', '2 reels'], revisionRounds: 2 });
    const pkgs = doc.sections.find((s) => s.kind === 'packages')!.packages!;
    expect(pkgs.map((p) => [p.units, p.feeCents])).toEqual([[1, 4500050], [3, 13500150], [6, 27000300]]);
    const text = contractAsText(doc);
    expect(text).toContain('- 8 short videos');
    expect(text).toContain('Two rounds');
    expect(parseRetainerInput({ months: [0, 99, 'x'], monthlyFeeCents: -4 }).months).toEqual([1, 3, 6]);
  });
  it('a monthly report is counts and titles only', () => {
    const doc = monthlyReportDoc({ clientName: 'Acme Foods', month: '2026-10', published: [{ title: 'Founder story reel' }, { title: 'Launch video' }], inReview: 1, open: 3, revisionsUsed: 2, invoicesRaised: 1, invoicesPaid: 1 });
    const text = contractAsText(doc);
    expect(doc.title).toBe('Monthly report, October 2026');
    expect(text).toContain('- Pieces delivered: 2');
    expect(text).toContain('- Founder story reel');
    expect(text).toContain('sent back for changes 2 times');
    expect(text).not.toMatch(/undefined|fee/i);
  });
});

describe('house templates', () => {
  it('never carry the names filled in, and carry the business only when asked', () => {
    const inv = sampleInvoice();
    inv.doc = { ...inv.doc, style: parseDocStyle({ logo: 'a1b2c3d4e5', footer: 'Studio One, Pune' }), footer: 'Studio One, Pune' };
    const plain = houseInvoiceDoc(inv.doc, false);
    expect(plain.to.name).toBe('');
    expect(plain.from.name).toBe('');
    expect(plain.bank.account).toBe('');
    expect(plain.style?.logo).toBe('');
    expect(plain.gstBps).toBe(1800);
    const full = houseInvoiceDoc(inv.doc, true);
    expect(full.to.name).toBe('');
    expect(full.from.name).toBe('Studio One');
    expect(full.bank.account).toBe('123456789');
    expect(full.style?.logo).toBe('a1b2c3d4e5');
    const k = { ...CONTRACT_TEMPLATES[0]!.doc, vars: { client: 'Acme', provider: 'A' }, style: parseDocStyle({ logo: 'a1b2c3d4e5' }) };
    expect(houseDoc(k, false).vars).toEqual({});
    expect(houseDoc(k, false).style?.logo).toBe('');
    expect(houseDoc(k, true).style?.logo).toBe('a1b2c3d4e5');
  });
});
