import { LEGAL_VERSION, SUBPROCESSORS } from '@kreators/shared';
import { A, Grid, H, LegalPage, Mail, P, contactEmail, useBusiness, versionDate } from './legalBits';

/** Everyone who handles personal data for us. The list is in the shared package, so this page, the privacy page and the docs never disagree. */
export function Subprocessors() {
  const { business } = useBusiness();
  const email = contactEmail(business);
  return (
    <LegalPage
      wide
      title="Subprocessors"
      lede={`The companies that handle personal data for us, what they do and where. Version ${LEGAL_VERSION}, last changed ${versionDate()}.`}
    >
      <H>Who they are</H>
      <P>
        We use these companies to run kreators.app. They act on our instructions and for no purpose of their own. Most only handle your data when you use the feature that needs them, as the last column shows. The <A to="/privacy">privacy page</A> explains the rest.
      </P>
      <Grid label="Subprocessors" head={['Company', 'What it does', 'What data', 'Where', 'When']} rows={SUBPROCESSORS.map((s) => [s.name, s.does, s.data, s.where, s.when])} />
      <H>When the list changes</H>
      <P>
        When we add or change a company, we update this page and the date above. If you want an email about changes, write to <Mail address={email} /> and say so. You can object to a new company by writing to the same address.
      </P>
      <H>Your own customers</H>
      <P>
        Creators keep information about their own customers and clients in kreators.app, such as orders in the shop, or clients and invoices in Agency. For that data, the creator decides what is kept and why, and we process it on the creator's behalf. A customer who wants to see or delete it should ask the creator first. If you cannot reach them, write to us.
      </P>
    </LegalPage>
  );
}
