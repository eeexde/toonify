import type { Metadata } from "next";

export const metadata: Metadata = { title: "About & legal" };

const contact = process.env.CONTACT_EMAIL;

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="display mb-2 text-[1.5rem]">{title}</h2>
      <div className="space-y-3 text-sm leading-relaxed text-muted">{children}</div>
    </section>
  );
}

const link = "font-semibold text-fg underline decoration-line-strong underline-offset-2 hover:decoration-accent";

export default function About() {
  return (
    <div className="mx-auto max-w-xl">
      <h1 className="display mb-6 text-[2.25rem] md:text-[2.75rem]">About &amp; legal</h1>

      <Section title="What Toonify is">
        <p>
          Toonify is a free reader for titles listed on{" "}
          <a href="https://mangadex.org" target="_blank" rel="noreferrer" className={link}>MangaDex</a>. It hosts no
          comics itself: pages are fetched from MangaDex when you read them, and chapters belong to the scanlation groups
          credited on each one. Toonify is not affiliated with MangaDex.
        </p>
      </Section>

      <Section title="Privacy">
        <p>There are no accounts, ads or analytics.</p>
        <p>
          Your library, reading history, progress and settings stay in this browser&apos;s storage. They never leave your
          device unless you export a backup yourself. Clearing site data removes them.
        </p>
        <p>
          The server sees your IP address on each request, as any website does. It keeps a per-address request count
          for about a minute to stop abuse, then discards it. Requests to MangaDex are made by the server, so MangaDex
          does not see your address.
          {process.env.SOURCE_SCRAPERGO === "1"
            ? " Images from the ScraperGo source load straight from that site, which does see it."
            : null}
        </p>
      </Section>

      <Section title="Terms">
        <p>
          Toonify is provided as is, without warranty. Some titles are marked 18+; they are hidden unless you turn them
          on in Settings, and by doing so you confirm you are of legal age where you live.
        </p>
        <p>Automated or bulk access is rate limited and may be blocked.</p>
      </Section>

      <Section title="Copyright & takedowns">
        <p>
          If you hold rights to a work shown here and want it removed, contact the scanlation group or{" "}
          <a href="https://mangadex.org/rules" target="_blank" rel="noreferrer" className={link}>MangaDex</a>, which
          hosts the files.
          {contact ? (
            <>
              {" "}You can also email{" "}
              <a href={`mailto:${contact}`} className={link}>{contact}</a>
              {" "}with the title and a link.
            </>
          ) : null}
        </p>
      </Section>
    </div>
  );
}
