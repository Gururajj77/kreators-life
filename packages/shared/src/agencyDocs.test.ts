import { describe, expect, it } from 'vitest';
import {
  AGENCY_DOC_KINDS,
  agencyDocStarter,
  amountInWords,
  CONTRACT_TEMPLATES,
  contractAsText,
  contractGapNote,
  contractGaps,
  contractVarGroups,
  contractVarsFor,
  contractVarsUsed,
  fillContractText,
  emptyProfile,
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
      { description: 'Sample videos package', quantity: 5, unitCents: 700000 },
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
      // The typed layout (the Trial agreement) keeps the reference off the paper; the legal layout prints it.
      if (parseDocStyle(t.doc.style).layout !== 'typed') expect(text).toContain('Reference: AGR-1');
      expect(text).toMatch(/\n1\. PARTIES/);
      expect(text).toContain('\n\n');
    }
  });
  it('lists packages in whole cents, the brief with its answers, and the signature lines', () => {
    const base = CONTRACT_TEMPLATES.find((t) => t.key === 'trial')!.doc;
    const doc: ContractDoc = { ...base, vars: { client: 'Acme Foods' }, sections: base.sections.map((s) => (s.kind === 'packages' ? { ...s, packages: [{ name: 'Starter', units: 5, feeCents: 3500000 }] } : s)) };
    const text = contractAsText(doc, { answers: { objective: { picked: ['Paid ads / Performance marketing'], other: '', text: '' } }, acceptance: { name: 'Asha Rao', title: 'Head of Brand', at: '2026-10-03T08:30:00.000Z' } });
    sign(text);
    expect(text).toContain('Package | Videos | Package fee | Effective rate per video');
    expect(text).toContain(`Starter | 5 | ${money(3500000)} | ${money(700000)}`);
    expect(text).toContain('[x] Paid ads / Performance marketing');
    expect(text).toContain('[ ] Organic content (value/entertainment first)');
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
    expect(text).toContain(`TOTAL AMOUNT IN WORDS : ${amountInWords(t.total)}`);
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
    expect(text).toContain(`IGST (18%): ${money(t.gst)}`);
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
    expect(text).not.toMatch(/amount in words/i);
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
    expect(t).not.toMatch(/section \d/i);
    expect(t).toContain('solely for evaluation and approval purposes');
    expect(t).toContain('one primary point of contact');
    expect(t).not.toMatch(/^\d+\.\d+ /m);
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

describe('a document filled from the client and the profile', () => {
  const profile = { ...emptyProfile(), signerName: 'Asha Rao', signerTitle: 'Founder', jurisdiction: 'Mumbai', brandName: 'Asha Films', operatingUnder: 'Asha Films', from: { ...emptyParty(), name: 'Asha Studio', address: '12 Hill Road, Mumbai', email: 'asha@example.com', phone: '+91 98000 00000' } };
  const client = { name: 'Acme Foods', address: '4 Park Street, Kolkata', contactName: 'Ravi Kumar', channels: ['YouTube', 'Instagram'], piecesPerMonth: 8, hoursPerMonth: 20, revisionsPerPiece: 2, retainerCents: 5500000, currency: 'INR' };
  const typed = { projectWhat: 'Launch videos', deliveryDate: '1 Dec 2026', trialPieces: '2', trialFee: 'None', sessionDate: '3 Nov 2026' };
  // A signing line is meant to be written on; everything else must be filled.
  const unsigned = (t: string) => t.split('\n').filter((l) => !/^(Signature|Date): _+$/.test(l)).join('\n');
  it('leaves no blank, placeholder or brace in any agreement or document kind for a fully filled client', () => {
    const vars = { ...contractVarsFor(profile, client), ...typed };
    expect(vars.channels).toBe('YouTube, Instagram');
    expect(vars.pieces).toBe('8');
    const docs = [...CONTRACT_TEMPLATES.map((t) => t.doc), ...AGENCY_DOC_KINDS.map((k) => agencyDocStarter(k))];
    for (const d of docs) {
      const doc = { ...d, vars };
      expect(contractGaps(doc), d.title).toEqual([]);
      for (const audience of ['owner', 'client'] as const) {
        const text = unsigned(contractAsText(doc, { audience }));
        expect(text, `${d.title} ${audience}`).not.toMatch(/__|\{|\}|TBD/);
      }
    }
  });
  it('the designation takes the brand once: a bare title gets it, a title typed whole is kept as typed', () => {
    expect(contractVarsFor({ ...profile, signerTitle: 'Founder', brandName: 'North Studio' }, client).providerDesignation).toBe('Founder, North Studio');
    expect(contractVarsFor({ ...profile, signerTitle: 'Founder, North Studio', brandName: 'North Studio' }, client).providerDesignation).toBe('Founder, North Studio');
  });
  it('a missing value never shows as underscores: the client copy drops the line, the owner copy carries one note', () => {
    const vars = contractVarsFor({ ...profile, from: { ...profile.from, phone: '' } }, { ...client, contactName: '' });
    const doc = { ...CONTRACT_TEMPLATES.find((t) => t.key === 'retainer')!.doc, vars };
    const forClient = contractAsText(doc, { audience: 'client' });
    expect(unsigned(forClient)).not.toContain('__');
    expect(forClient).toContain('Email: asha@example.com');
    expect(forClient).not.toMatch(/Phone:|Point of contact:/);
    const forOwner = contractAsText(doc, { audience: 'owner' });
    expect(forOwner).toContain('Your business details are not set (phone): add them once in Settings.');
    expect(forOwner).toContain("The client's point of contact is not set");
    expect(contractGapNote({ ...doc, vars: { ...vars, providerPhone: '1', clientContact: 'Ravi' } })).toBeNull();
    expect(fillContractText('**Service provider:** {{provider}}, {{providerTitle}}, {{providerBusiness}}', { provider: 'Asha', providerBusiness: 'Studio' }, 'client')).toBe('**Service provider:** Asha, Studio');
    expect(fillContractText('Point of contact: {{clientContact}} (authorised to speak for the client)\nNext', {}, 'client')).toBe('Next');
  });
  it('a part nobody has written is left out of the client copy', () => {
    const doc = { ...agencyDocStarter('brief'), vars: { ...contractVarsFor(profile, client), sessionDate: '3 Nov 2026' } };
    expect(contractAsText(doc, { audience: 'client' })).not.toContain('WHAT WE AGREED');
    expect(contractAsText(doc, { audience: 'owner' })).toContain('Not written yet.');
  });
});

describe('the variables a document uses, for the Fill in the details form', () => {
  const sections = (bodies: string[], extra: Partial<ContractDoc['sections'][number]>[] = []) => [...bodies.map((body, i) => ({ id: `s${i}`, heading: '', kind: 'text' as const, body })), ...extra.map((e, i) => ({ id: `x${i}`, heading: '', kind: 'text' as const, body: '', ...e }))];
  it('lists every variable once, in the order its words name it, the either forms included', () => {
    const doc = { sections: sections(['{{client}} and {{brandName?$ owns|Our team owns}} it.', 'Again {{client}}, {{formatName|}} and {{pastClients?brands such as $|different}}.', '{{packageExample}} in {{currencyWords}}, {{notAVar}}']) };
    expect(contractVarsUsed(doc)).toEqual(['client', 'brandName', 'formatName', 'pastClients']);
  });
  it('reads questions, the words after a table and a signature block', () => {
    const doc = { sections: sections(['{{brands}}'], [{ kind: 'brief', questions: [{ id: 'q', label: 'For {{clientContact}}?', options: [], multi: false, other: false, text: true }] }, { tail: '{{deliveryDate}}' }, { kind: 'signatures' }]) };
    expect(contractVarsUsed(doc)).toEqual(['brands', 'clientContact', 'deliveryDate', 'provider', 'providerDesignation']);
  });
  it('groups them as your business, the client and this document only, each in reading order', () => {
    const doc = { sections: sections(['{{trialFee}} {{client}} {{provider}} {{providerEmail2}} {{clientAddress}}']) };
    expect(contractVarGroups(doc)).toEqual([
      { from: 'profile', vars: [{ key: 'provider', label: 'Your name', optional: false }, { key: 'providerEmail2', label: 'Your second email', optional: true }] },
      { from: 'client', vars: [{ key: 'client', label: 'Client', optional: false }, { key: 'clientAddress', label: 'Client address', optional: false }] },
      { from: 'typed', vars: [{ key: 'trialFee', label: 'Trial fee, if any', optional: false }] },
    ]);
    expect(contractVarGroups({ sections: [] })).toEqual([]);
  });
  it('the Trial agreement asks for its parties, its words and the client, never the currency', () => {
    const trial = CONTRACT_TEMPLATES.find((t) => t.key === 'trial')!.doc;
    const used = contractVarsUsed(trial);
    expect(used.slice(0, 7)).toEqual(['provider', 'providerBusiness', 'providerBrand', 'providerAddress', 'providerEmail', 'providerEmail2', 'providerPhones']);
    for (const k of ['client', 'clientAddress', 'brands', 'clientContact', 'formatNameInline', 'brandName', 'formatName', 'pastClients', 'jurisdiction', 'providerDesignation']) expect(used, k).toContain(k);
    expect(used).not.toContain('currencyWords');
    expect(new Set(used).size).toBe(used.length);
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

describe('what an agreement prints', () => {
  it('prints the main text and leaves out a brief and the notes of information in the trial agreement', async () => {
    const { CONTRACT_TEMPLATES, sectionPrints, parseContractDoc } = await import('./index');
    const trial = CONTRACT_TEMPLATES.find((t) => t.key === 'trial')!.doc;
    const off = trial.sections.filter((s) => !sectionPrints(s)).map((s) => s.id);
    expect(off).toEqual(['brief', 'after', 'how']);
    for (const id of ['parties', 'purpose', 'ownership', 'packages', 'payment', 'law', 'sign']) expect(sectionPrints(trial.sections.find((s) => s.id === id)!)).toBe(true);
    // The choice survives a save, and a person can turn a section back on.
    const again = parseContractDoc(JSON.parse(JSON.stringify({ ...trial, sections: trial.sections.map((s) => (s.id === 'how' ? { ...s, print: true } : s)) })))!;
    expect(sectionPrints(again.sections.find((s) => s.id === 'how')!)).toBe(true);
    expect(sectionPrints(again.sections.find((s) => s.id === 'after')!)).toBe(false);
  });

  it('switches one section on the printed page and changes nothing else, never the signatures', async () => {
    const { CONTRACT_TEMPLATES, sectionPrints, withSectionPrint } = await import('./index');
    const trial = CONTRACT_TEMPLATES.find((t) => t.key === 'trial')!.doc;
    const on = withSectionPrint(trial, 'brief', true)!;
    expect(sectionPrints(on.sections.find((s) => s.id === 'brief')!)).toBe(true);
    // Every other section is the very same object, and the words of the switched one are untouched.
    on.sections.forEach((s, i) => (s.id === 'brief' ? expect({ ...s, print: undefined }).toEqual({ ...trial.sections[i], print: undefined }) : expect(s).toBe(trial.sections[i])));
    expect(on.title).toBe(trial.title);
    expect(sectionPrints(withSectionPrint(on, 'brief', false)!.sections.find((s) => s.id === 'brief')!)).toBe(false);
    expect(withSectionPrint(trial, 'sign', false)).toBeNull();
    expect(withSectionPrint(trial, 'nope', true)).toBeNull();
    // The template itself is never changed.
    expect(sectionPrints(trial.sections.find((s) => s.id === 'brief')!)).toBe(false);
  });
});

describe('the Trial agreement, to the letter', async () => {
  const m = await import('./index');
  const { CONTRACT_TEMPLATE_BY_KEY, contractVarsFor, emptyProfile, emptyParty, fillContractText, contractAsText, docVars, withProfilePackages, cleanContractAnswers, parseBodyBlocks, joinBodyBlocks, agencyDocStarter, AGENCY_DOC_KINDS, CONTRACT_TEMPLATES, sectionPrints, CURRENCY_WORDS, parseDocStyle } = m;
  const trial = CONTRACT_TEMPLATE_BY_KEY.trial!.doc;
  const sec = (id: string) => trial.sections.find((s) => s.id === id)!;
  // Neutral sample values only: nobody's real name, number or price is written in the repo.
  const profile = {
    ...emptyProfile(),
    signerName: 'Asha Rao',
    signerTitle: 'Founder',
    jurisdiction: 'Pune, Maharashtra',
    brandName: 'Acme Studio',
    operatingUnder: 'Acme Studio',
    businessName: 'Rao Media',
    businessAddress: '1 Test Road, Pune 411001, India',
    emails: ['one@example.com', 'two@example.com'],
    phones: ['+91 90000 00001', '+91 90000 00002'],
    formatName: 'Street Interview',
    formatNameInline: 'street interview',
    pastClients: 'Brand One, Brand Two',
    packages: { unit: 'Videos', rows: [{ name: '4 Video Package', units: 4, feeCents: 2000000 }, { name: '8 Video Package', units: 8, feeCents: 3600000 }], block: { units: 4, feeCents: 1600000 } },
    from: { ...emptyParty(), name: 'Rao Media', email: 'one@example.com' },
  };
  const client = { name: 'Test Foods Pvt Ltd', address: '2 Market Lane, Delhi', contactName: 'Ravi Kumar', contactTitle: 'Head of Brand', brands: 'Test Foods', currency: 'INR' };
  const filled = { ...trial, vars: contractVarsFor(profile, client), sections: withProfilePackages(structuredClone(trial.sections), profile) };

  it('has the same title, subtitle and opening paragraph', () => {
    expect(trial.title).toBe('TRIAL ENGAGEMENT AGREEMENT');
    expect(trial.subtitle).toBe('TRIAL VIDEO, BRIEF AND PILOT ENGAGEMENT TERMS');
    expect(trial.sections[0]!.heading).toBe('');
    expect(trial.sections[0]!.body).toBe('This Agreement is entered into on the date of acceptance by the Client. It sets out the terms of the trial, the creative brief the Client needs to complete, what happens after the trial, and the pricing for the pilot engagement that follows.');
    expect(trial.sections.map((s) => s.id)).toEqual(['intro', 'parties', 'purpose', 'brief', 'ownership', 'after', 'packages', 'payment', 'how', 'law', 'sign']);
    expect(trial.sections.slice(1).map((s) => s.heading)).toEqual(['1. PARTIES', '2. PURPOSE OF THE TRIAL', '3. TRIAL VIDEO BRIEF', '4. TRIAL CONTENT, OWNERSHIP AND USAGE', '5. WHAT HAPPENS AFTER THE TRIAL', '6. PACKAGES AND PRICING', '7. PAYMENT TERMS', '8. HOW WE WORK: CREATIVE AND PRODUCTION ALIGNMENT', '9. CONFIDENTIALITY AND GOVERNING LAW', '10. ACCEPTANCE AND SIGNATURES']);
    expect(parseDocStyle(trial.style).layout).toBe('typed');
    expect(parseDocStyle(trial.style).heading).toBe('plain');
  });

  it('fills the parties line for line, and an empty second email takes only its own line', () => {
    const lines = fillContractText(sec('parties').body, filled.vars, 'client').split('\n');
    expect(lines).toEqual([
      '**Service Provider:** Asha Rao',
      'Proprietor, Rao Media, operating under Acme Studio',
      '1 Test Road, Pune 411001, India',
      '**Email:** one@example.com',
      '**Email:** two@example.com',
      '**Phone:** +91 90000 00001 | +91 90000 00002',
      '',
      '**Client:** Test Foods Pvt Ltd',
      'Address: 2 Market Lane, Delhi',
      'Brand(s) for this trial: Test Foods',
      'Hereinafter referred to as the “Client”',
      '',
      '**Point of Contact**',
      'Name: Ravi Kumar',
      'Authorized Representative of the Client',
      '',
      'The Service Provider and the Client are collectively referred to as the “Parties”.',
    ]);
    const one = fillContractText(sec('parties').body, { ...filled.vars, providerEmail2: '' }, 'client').split('\n');
    expect(one.filter((l) => l.startsWith('**Email:**'))).toEqual(['**Email:** one@example.com']);
    expect(one.length).toBe(lines.length - 1);
  });

  it('keeps the purpose in shape with and without the format word', () => {
    expect(fillContractText(sec('purpose').body, filled.vars, 'client')).toContain('the Service Provider’s street interview style of work on its own brand');
    expect(fillContractText(sec('purpose').body, { ...filled.vars, formatNameInline: '' }, 'client')).toContain('the Service Provider’s style of work on its own brand');
    expect(fillContractText(sec('purpose').body, {}, 'client')).not.toMatch(/\{|\}| {2}/);
  });

  it('asks the brief as the agreement does: the tick boxes, the brand guide lines and 3 to 5 links', () => {
    const qs = sec('brief').questions!;
    const boxes = (id: string) => {
      const q = qs.find((x) => x.id === id)!;
      return q.options.length + (q.other ? 1 : 0);
    };
    expect(boxes('objective')).toBe(4);
    expect(boxes('brand')).toBe(6);
    expect(boxes('musts')).toBe(9);
    expect(qs.find((x) => x.id === 'response')!.answerLabel).toBe('Client response:');
    expect(qs.find((x) => x.id === 'identity')!.fields).toHaveLength(4);
    expect(qs.find((x) => x.id === 'editing')!.fields).toHaveLength(11);
    expect(qs.find((x) => x.id === 'references')!.links).toEqual({ min: 3, max: 5 });
    expect(qs.map((q) => q.heading).filter(Boolean)).toEqual(['3.1 Objective', '3.2 Brand Integration', '3.3 Desired Viewer Response', '3.4 Non-Negotiables', '3.5 Brand Guide']);
    expect(sec('brief').tail).toMatch(/^### 3\.6 Creative Alignment\n/);
  });

  it('keeps only real answers: offered options, named fields and at most five web links', () => {
    const got = cleanContractAnswers(trial, {
      objective: { picked: ['Paid ads / Performance marketing', 'Something made up'], other: 'Launch' },
      response: { text: 'Curious', picked: ['x'] },
      identity: { fields: { 'Brand personality (3 to 5 words)': 'Warm, bold', 'Not a field': 'x' } },
      references: { links: ['https://a.example/1', 'javascript:alert(1)', 'https://a.example/2', 'http://a.example/3', 'https://a.example/4', 'https://a.example/5', 'https://a.example/6'] },
      constructor: { picked: ['x'] },
      nope: { picked: ['x'] },
    });
    expect(got.objective!.picked).toEqual(['Paid ads / Performance marketing']);
    expect(got.objective!.other).toBe('Launch');
    expect(got.response!.picked).toEqual([]);
    expect(got.response!.text).toBe('Curious');
    expect(got.identity!.fields).toEqual({ 'Brand personality (3 to 5 words)': 'Warm, bold' });
    expect(got.references!.links).toEqual(['https://a.example/1', 'https://a.example/2', 'http://a.example/3', 'https://a.example/4', 'https://a.example/5']);
    expect(Object.keys(got)).not.toContain('nope');
    expect(Object.keys(got)).not.toContain('constructor');
  });

  it('takes the packages from the profile and works the example out from them', () => {
    const pk = filled.sections.find((s) => s.id === 'packages')!;
    expect(pk.packages).toHaveLength(2);
    expect(trial.sections.find((s) => s.id === 'packages')!.packages).toEqual([]);
    const words = fillContractText(`${pk.body}\n\n${pk.tail}`, docVars(filled), 'client');
    expect(words).toContain(`All amounts are in ${CURRENCY_WORDS.INR}.`);
    expect(words).toContain('After the 8 video package, additional videos are added in blocks of 4 at ₹16,000 per block. For example, 12 videos cost ₹36,000 + ₹16,000 = ₹52,000, and 16 videos cost ₹36,000 + ₹32,000 = ₹68,000.');
    const text = contractAsText(filled);
    expect(text).toContain('Package | Videos | Package fee | Effective rate per video\n4 Video Package | 4 | ₹20,000 | ₹5,000\n8 Video Package | 8 | ₹36,000 | ₹4,500\nAdditional videos beyond 8 | Each block of 4 | ₹16,000 per block | ₹4,000');
    // No packages: the client's copy has no empty table and no 6.1, and the owner is told once.
    const bare = { ...trial, vars: filled.vars };
    expect(contractAsText(bare)).not.toContain('Package | Videos');
    expect(contractAsText(bare)).not.toContain('6.1 Additional Videos');
    expect(contractAsText(bare)).toContain('6.2 One Brand Per Package');
    expect(contractAsText(bare, { audience: 'owner' })).toContain('Your packages are not set: add them once in Settings.');
  });

  it('falls back to the agreement\'s own sentence shape when the brand, format or past clients are empty', () => {
    const empty = { ...filled.vars, brandName: '', formatName: '', formatNameInline: '', pastClients: '' };
    const how = fillContractText(sec('how').body, empty, 'client');
    expect(how).toContain('We specialize in authentic, reaction-led creative using real people and real conversations.');
    expect(how).toContain('Our team owns the creative execution.');
    expect(how).toContain('working across different consumer categories have reinforced one thing for us:');
    expect(how).toContain('The strength of the format comes from the fact that the responses aren\'t scripted.');
    expect(how).not.toMatch(/\{\{|\}\}| {2}|__/);
    const full = fillContractText(sec('how').body, filled.vars, 'client');
    expect(full).toContain('Acme Studio specializes in authentic');
    expect(full).toContain('Acme Studio owns the creative execution.');
    expect(full).toContain('across brands such as Brand One, Brand Two and other consumer categories have reinforced');
    expect(full).toContain('The strength of the Street Interview format comes from');
    expect(full).toContain('**Setup → Question → Participant → Follow-up → Reaction → Edit**');
    expect(full).toContain('**Hypothesis → Interaction → Production → Edit → Learn → Improve**');
    expect(fillContractText('a {{x|b}} c {{y?[$]|none}}.', { y: 'v' })).toBe('a b c [v].');
    expect(fillContractText('a {{x|}} c', {})).toBe('a c');
  });

  it('signs as the agreement does, and prints the main terms only', () => {
    expect(sec('sign').body).toBe('By signing below, the Parties confirm that they have read and agreed to the terms of this Agreement.');
    expect(filled.vars.providerDesignation).toBe('Founder, Acme Studio');
    const text = contractAsText(filled);
    expect(text).toContain('For the Service Provider:\nName: Asha Rao\nDesignation: Founder, Acme Studio\nSignature:');
    expect(text).toContain('For the Client:\nName:');
    expect(sec('law').body).toContain('Jurisdiction shall lie exclusively with the courts of {{jurisdiction}}.');
    expect(trial.sections.filter((s) => !sectionPrints(s)).map((s) => s.id)).toEqual(['brief', 'after', 'how']);
  });

  it('reads as text in the agreement\'s own order, with every sentence that has no variable in it', () => {
    const text = contractAsText(filled).replace(/\s+/g, ' ');
    const fixed = trial.sections
      .flatMap((s) => [s.heading, s.body, ...(s.questions ?? []).flatMap((q) => [q.heading ?? '', q.intro ?? '', q.group ?? '', q.label, ...q.options, ...(q.fields ?? [])]), s.tail ?? ''])
      .flatMap((t) => t.split(/\n+/))
      .map((l) => l.replace(/^###\s+|^- /, '').replace(/\*\*/g, '').trim())
      .filter((l) => l && !l.includes('{{'));
    let at = 0;
    for (const line of fixed) {
      const i = text.indexOf(line, at);
      expect(i, line).toBeGreaterThanOrEqual(0);
      at = i;
    }
    expect(text).not.toMatch(/###|\*\*|\{\{/);
  });

  it('turns every body into blocks and back, byte for byte', () => {
    const docs = [...CONTRACT_TEMPLATES.map((t) => t.doc), ...AGENCY_DOC_KINDS.map((k) => agencyDocStarter(k))];
    for (const d of docs) {
      for (const s of d.sections) {
        for (const body of [s.body, s.tail ?? '']) expect(joinBodyBlocks(parseBodyBlocks(body))).toBe(body);
      }
    }
    const blocks = parseBodyBlocks('**Step 1: Trial review.** The trial.\n\n- one\n- {{brandName?$ owns|We own}}\n\n### 3.1 Objective\n\n**Setup → Edit**');
    expect(blocks.map((b) => b.kind)).toEqual(['p', 'li', 'li', 'h3', 'strong']);
    expect(blocks[0]!.segments[0]).toEqual({ bold: 'Step 1: Trial review.' });
    expect(blocks[2]!.segments[0]).toEqual({ var: 'brandName', when: '$ owns', fallback: 'We own' });
    // A new block (no separator) joins after a bullet with one line break, else with a blank line.
    expect(joinBodyBlocks([...blocks.slice(0, 2), { kind: 'li', segments: ['two'], sep: '' }])).toBe('**Step 1: Trial review.** The trial.\n\n- one\n- two');
  });
});
