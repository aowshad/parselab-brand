export function Footer({ contact }: { contact: string }) {
  return (
    <footer className="mt-24 flex flex-col gap-2 border-t border-hairline py-8 text-sm text-muted sm:flex-row sm:items-center sm:justify-between">
      <p>© ParseLab LLC. Assets are for approved use only.</p>
      <p>
        Questions?{" "}
        <a href={`mailto:${contact}`} className="font-medium text-ink underline-offset-4 hover:underline">
          {contact}
        </a>
      </p>
    </footer>
  );
}
