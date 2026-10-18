import type { Metadata } from "next";
import Link from "next/link";
import { CONTACT_EMAIL } from "@/components/legal-links";

export const metadata: Metadata = { title: "Terms of Service" };

export default function TermsPage() {
  return (
    <article>
      <h1>Terms of Service</h1>
      <p className="text-sm text-subtle">Effective October 18, 2026</p>

      <p>
        These terms govern your use of Pursely. By signing in, you agree to them. If you don&apos;t agree, please
        don&apos;t use the service.
      </p>

      <h2>The service</h2>
      <p>
        Pursely is a free tool for recording expenses and income, setting budgets and viewing charts. It is for
        personal record keeping only and is not financial, tax or legal advice. Currency settings change how amounts
        are displayed; Pursely does not convert currencies or move money.
      </p>

      <h2>Your account</h2>
      <ul>
        <li>You sign in with a Google account and are responsible for keeping that account secure.</li>
        <li>You must be at least 13 years old to use Pursely.</li>
        <li>You are responsible for what happens under your account, including who you invite to your household.</li>
      </ul>

      <h2>Your data</h2>
      <p>
        The records you enter belong to you. You give Pursely permission to store, process and display them only as
        needed to run the service, including showing them to members of your household. You can export your
        transactions at any time. How we handle your data is described in the{" "}
        <Link href="/privacy">Privacy Policy</Link>.
      </p>

      <h2>Households</h2>
      <p>
        A household shares one ledger. The owner decides who can join and whether each member can edit or only view.
        Records added to a household ledger stay with the household if you leave or are removed.
      </p>

      <h2>Acceptable use</h2>
      <p>You agree not to:</p>
      <ul>
        <li>Access or try to access other people&apos;s data.</li>
        <li>Disrupt the service, probe it for vulnerabilities without permission, or overload it with automated requests.</li>
        <li>Use Pursely for anything unlawful.</li>
      </ul>

      <h2>Availability</h2>
      <p>
        Pursely is provided &quot;as is&quot; and &quot;as available&quot;, without warranties of any kind. Features
        may change, and the service may be interrupted or discontinued. Keep your own copies of anything important by
        using the CSV export.
      </p>

      <h2>Limitation of liability</h2>
      <p>
        To the extent permitted by law, Pursely and its operator are not liable for any indirect, incidental or
        consequential damages, or for any loss of data, profits or savings, arising from your use of the service.
      </p>

      <h2>Ending your use</h2>
      <p>
        You can stop using Pursely at any time and ask for your account to be deleted. Accounts that break these terms
        may be suspended or removed.
      </p>

      <h2>Changes to these terms</h2>
      <p>
        If these terms change, the new version will be posted here with a new effective date. Continuing to use
        Pursely after a change means you accept the updated terms.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about these terms: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
      </p>
    </article>
  );
}
