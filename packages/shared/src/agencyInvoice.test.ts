import { describe, expect, it } from 'vitest';
import {
  amountInWords,
  docFromProfile,
  emptyProfile,
  INVOICE_DESIGN_META,
  INVOICE_DESIGNS,
  INVOICE_STARTER_BY_KEY,
  INVOICE_TITLES,
  invoiceAsText,
  invoiceFooterFor,
  invoiceFootnote,
  invoiceMoney,
  invoiceQty,
  invoiceTotals,
  packageExampleLine,
  packageInvoiceLine,
  parseInvoiceDoc,
  parsePackages,
  parseProfile,
  tdsGrossupNote,
  type Invoice,
  type ProfilePackages,
} from './index';

// The founder's invoice prints this footnote word for word when no TDS rate is set.
const PDF_FOOTNOTE = '*Additional % adjusted on total invoice amount applicable for TDS deducted to be borne by the company as per the agreement terms.';

// Neutral numbers, never anyone's real data.
const pk: ProfilePackages = {
  unit: 'Videos',
  rows: [
    { name: '5 Video Package', units: 5, feeCents: 40_000_00 },
    { name: '10 Video Package', units: 10, feeCents: 70_000_00 },
  ],
  block: { units: 4, feeCents: 24_000_00 },
};

const invoice = (over: Partial<Invoice['doc']> = {}): Invoice => ({
  id: 'i',
  number: 'TST-001',
  ownerName: 'Owner',
  ownerHandle: null,
  clientName: 'Client',
  clientEmail: '',
  items: [{ description: 'Package', quantity: 5, unitCents: 7_000_00 }],
  totalCents: 0,
  currency: 'INR',
  status: 'draft',
  issueDate: '2026-01-10',
  dueDate: '2026-01-20',
  note: '',
  token: 't',
  paidAt: null,
  createdAt: '',
  revisedAt: null,
  agencyClientId: null,
  doc: parseInvoiceDoc({ title: 'Advance Invoice', tdsMode: 'grossup', tdsBps: 0, bank: { bankName: 'Test Bank', upi: 'test@upi' }, qtyPad: true, qtyLabel: 'Qty/Hr rate', ...over }),
});

describe('invoice numbers as the founder\'s invoice prints them', () => {
  it('pads a quantity under ten only when asked', () => {
    expect(invoiceQty(5, true)).toBe('05');
    expect(invoiceQty(5)).toBe('5');
    expect(invoiceQty(12, true)).toBe('12');
  });
  it('always shows the paise on an invoice', () => {
    expect(invoiceMoney(700000)).toBe('₹7,000.00');
    expect(invoiceMoney(3500000)).toBe('₹35,000.00');
    expect(invoiceMoney(15000050)).toBe('₹1,50,000.50');
    expect(invoiceMoney(-1999, 'USD')).toBe('-$19.99');
  });
  it('offers the founder\'s titles and the Founder classic look', () => {
    expect(INVOICE_TITLES).toContain('Advance Invoice');
    expect(INVOICE_DESIGNS).toContain('founder');
    expect(INVOICE_DESIGN_META.founder.name).toBe('Founder classic');
    expect(emptyProfile().design).toBe('founder');
  });
  it('reads the quantity column\'s label and padding back, with older invoices on "Qty"', () => {
    const d = parseInvoiceDoc({ qtyLabel: 'Qty/Hr rate', qtyPad: true });
    expect(d.qtyLabel).toBe('Qty/Hr rate');
    expect(d.qtyPad).toBe(true);
    expect(parseInvoiceDoc({ qtyLabel: '<b>' }).qtyLabel).toBe('Qty');
    expect(parseInvoiceDoc({}).qtyPad).toBe(false);
  });
});

describe('the TDS line', () => {
  it('keeps a TDS ADJUSTED row at zero when the client bears the TDS', () => {
    const inv = invoice();
    const t = invoiceTotals(inv.items, inv.doc);
    expect(inv.doc.tdsMode).toBe('grossup');
    expect(t.tdsAdjusted).toBe(0);
    expect(invoiceAsText(inv)).toContain('TDS adjusted: ₹0');
  });
  it('prints the founder\'s footnote word for word without a rate, and the rate when there is one', () => {
    expect(tdsGrossupNote(0)).toBe(PDF_FOOTNOTE);
    expect(INVOICE_STARTER_BY_KEY.advance?.footnote).toBe(PDF_FOOTNOTE);
    expect(INVOICE_STARTER_BY_KEY.advance?.title).toBe('Advance Invoice');
    expect(invoiceFootnote(invoice().doc)).toEqual([PDF_FOOTNOTE]);
    expect(invoiceFootnote(invoice({ tdsBps: 1000 }).doc)).toEqual([tdsGrossupNote(1000)]);
    // An older copy of the TDS line is not printed twice; the owner's own words are kept.
    expect(invoiceFootnote(invoice({ footnote: PDF_FOOTNOTE, tdsBps: 200 }).doc)).toEqual([tdsGrossupNote(200)]);
    expect(invoiceFootnote(invoice({ footnote: 'Thank you.', tdsMode: 'none' }).doc)).toEqual(['Thank you.']);
  });
});

describe('the invoice as text', () => {
  it('uses the founder\'s labels', () => {
    const inv = invoice({ footnote: '' });
    inv.items = [{ description: 'Package', quantity: 5, unitCents: 7_000_00 }];
    const text = invoiceAsText(inv);
    expect(text).toContain('UPI Details: test@upi');
    expect(text).toContain('Bank Name: Test Bank');
    expect(text).toContain('Billed To:');
    expect(text).toContain('TOTAL AMOUNT IN WORDS : THIRTY FIVE THOUSAND ONLY');
    expect(amountInWords(3500000)).toBe('THIRTY FIVE THOUSAND ONLY');
    expect(text).toContain('Package: 05 x');
    expect(text).toContain(PDF_FOOTNOTE);
  });
});

describe('packages in the business profile', () => {
  it('works out the 6.1 example from the owner\'s own numbers', () => {
    expect(packageExampleLine(pk)).toBe(
      'After the 10 video package, additional videos are added in blocks of 4 at ₹24,000 per block. For example, 14 videos cost ₹70,000 + ₹24,000 = ₹94,000, and 18 videos cost ₹70,000 + ₹48,000 = ₹1,18,000.',
    );
  });
  it('says nothing when there is no block or no package', () => {
    expect(packageExampleLine({ ...pk, block: { units: 0, feeCents: 0 } })).toBe('');
    expect(packageExampleLine({ ...pk, rows: [] })).toBe('');
  });
  it('makes an invoice line with the rate per unit to the cent', () => {
    const p = { ...emptyProfile(), formatName: 'Street Talk', formatNameInline: 'StreetTalk', packages: pk };
    expect(packageInvoiceLine(pk.rows[0]!, p)).toEqual({ description: '05 StreetTalk Videos Package', quantity: 5, unitCents: 8_000_00 });
    expect(packageInvoiceLine({ name: 'x', units: 3, feeCents: 10_000_00 }, p).unitCents).toBe(3_33_333);
    expect(packageInvoiceLine(pk.rows[1]!, { ...p, formatNameInline: '', formatName: '' }).description).toBe('10 Videos Package');
  });
  it('reads the table defensively', () => {
    const back = parsePackages({ unit: '', rows: [{ name: 'A', units: 5, feeCents: 'lots' }, { name: 'B', units: 0, feeCents: 5 }, { name: 'C', units: '3', feeCents: 900 }], block: { units: 'x', feeCents: 10 } });
    expect(back.unit).toBe('Videos');
    expect(back.rows).toEqual([{ name: 'C', units: 3, feeCents: 900 }]);
    expect(back.block).toEqual({ units: 0, feeCents: 10 });
    expect(parsePackages({ rows: Array.from({ length: 12 }, () => ({ name: 'P', units: 1, feeCents: 1 })) }).rows).toHaveLength(8);
  });
});

describe('the business profile', () => {
  it('keeps two phones and two emails, a web address that is https or a bare domain, and defaults the inline names', () => {
    const p = parseProfile({
      brandName: 'Studio One',
      formatName: 'Street Talk',
      phones: ['+91 90000 00001', '+91 90000 00002', '+91 90000 00003'],
      emails: ['a@example.com', 'not an email', 'b@example.com', 'c@example.com'],
      website: 'www.example.com',
      packages: pk,
    });
    expect(p.phones).toEqual(['+91 90000 00001', '+91 90000 00002']);
    expect(p.emails).toEqual(['a@example.com', 'b@example.com']);
    expect(p.website).toBe('www.example.com');
    expect(p.operatingUnder).toBe('Studio One');
    expect(p.formatNameInline).toBe('Street Talk');
    expect(p.packages.rows).toHaveLength(2);
    expect(parseProfile({ website: 'javascript:alert(1)' }).website).toBe('');
    expect(parseProfile({ website: 'http://example.com' }).website).toBe('');
    expect(parseProfile({ website: 'https://example.com/work' }).website).toBe('https://example.com/work');
  });
  it('builds the two footer lines and drops what is empty', () => {
    const base = { ...emptyProfile(), businessName: 'Studio One', businessAddress: 'Street 1\nCity 560000', phones: ['+91 90000 00001', '+91 90000 00002'], emails: ['a@example.com'], website: 'www.example.com' };
    expect(invoiceFooterFor(base)).toBe('Prop. Studio One - Street 1, City 560000\nPhone: +91 90000 00001 | +91 90000 00002 | a@example.com | www.example.com');
    const noSite = invoiceFooterFor({ ...base, website: '' });
    expect(noSite.endsWith('a@example.com')).toBe(true);
    expect(noSite).not.toMatch(/\| $|\|\s*$/);
    expect(invoiceFooterFor(emptyProfile())).toBe('');
  });
  it('starts a new invoice from the profile: the footer, the quantity label and padding', () => {
    const p = { ...emptyProfile(), businessName: 'Studio One', invoiceQtyLabel: 'Qty/Hr rate' as const, invoiceQtyPad: true };
    const d = docFromProfile(p);
    expect(d.footer).toBe('Prop. Studio One');
    expect(d.qtyLabel).toBe('Qty/Hr rate');
    expect(d.qtyPad).toBe(true);
    expect(d.design).toBe('founder');
    expect(docFromProfile({ ...p, footer: 'My own footer' }).footer).toBe('My own footer');
  });
});
