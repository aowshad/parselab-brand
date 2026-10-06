/** Same footer on every page, on the page container. */
export function Footer({ contact, text }: { contact: string; text: string }) {
  return (
    <footer className="container-page">
      <div className="mt-24 flex flex-col gap-2 border-t border-hairline py-8 text-small text-muted sm:flex-row sm:items-center sm:justify-between">
        <p>{text}</p>
        <p>
          Need another format?{" "}
          <a href={`mailto:${contact}`} className="motion-colors rounded-[4px] font-medium text-ink hover:underline hover:underline-offset-4">
            {contact}
          </a>
        </p>
      </div>
    </footer>
  );
}
