import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

/*
 * Usage guidelines Markdown, styled to the site. Safe by construction: react-markdown never
 * renders raw HTML, images are dropped (only uploaded Do / Don't images appear), and links to
 * other sites open in a new tab without access to this page. Used by the public page and the
 * admin preview, so both look the same.
 */
const components: Components = {
  h1: ({ children }) => <h3 className="mt-8 text-h3 first:mt-0">{children}</h3>,
  h2: ({ children }) => <h3 className="mt-8 text-h3 first:mt-0">{children}</h3>,
  h3: ({ children }) => <h4 className="mt-6 text-small font-semibold first:mt-0">{children}</h4>,
  h4: ({ children }) => <h4 className="mt-6 text-small font-semibold first:mt-0">{children}</h4>,
  p: ({ children }) => <p className="mt-3 text-body text-pretty text-muted first:mt-0">{children}</p>,
  ul: ({ children }) => <ul className="mt-3 list-disc space-y-1.5 pl-5 text-body text-muted marker:text-strong">{children}</ul>,
  ol: ({ children }) => <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-body text-muted">{children}</ol>,
  strong: ({ children }) => <strong className="font-semibold text-ink">{children}</strong>,
  a: ({ href, children }) => {
    const external = /^https?:\/\//.test(href ?? "");
    return (
      <a href={href} {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})} className="font-medium text-ink underline underline-offset-4 hover:no-underline">
        {children}
      </a>
    );
  },
  code: ({ children }) => <code className="rounded-[4px] bg-track px-1 text-small text-ink">{children}</code>,
  hr: () => <hr className="my-6 border-hairline" />,
  blockquote: ({ children }) => <blockquote className="mt-3 border-l-2 border-strong pl-4">{children}</blockquote>,
  table: ({ children }) => (
    <div className="mt-3 overflow-x-auto">
      <table className="w-full text-left text-small">{children}</table>
    </div>
  ),
  th: ({ children }) => <th className="border-b border-hairline py-2 pr-4 font-semibold">{children}</th>,
  td: ({ children }) => <td className="border-b border-hairline py-2 pr-4 text-muted">{children}</td>,
};

export function Markdown({ children }: { children: string }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={components} disallowedElements={["img"]} skipHtml>
      {children}
    </ReactMarkdown>
  );
}
