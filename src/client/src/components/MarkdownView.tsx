import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import "highlight.js/styles/github.css";
import { useState, type ComponentPropsWithoutRef } from "react";
import { Icon } from "./Icon";

interface MarkdownViewProps {
  content: string;
  className?: string;
  size?: "sm" | "md" | "lg";
  onLinkClick?: (href: string) => void;
}

function CodeBlock({
  className,
  children,
  size = "md",
  ...props
}: ComponentPropsWithoutRef<"code"> & { size?: "sm" | "md" | "lg" }) {
  const match = /language-(\w+)/.exec(className || "");
  const lang = match?.[1] ?? "";
  const code = String(children).replace(/\n$/, "");
  const isInline = !className && !code.includes("\n");
  const [copied, setCopied] = useState(false);

  if (isInline) {
    return (
      <code
        className="rounded bg-indigo-50 px-1.5 py-0.5 font-mono text-[0.85em] text-indigo-700 border border-indigo-100"
        {...props}
      >
        {children}
      </code>
    );
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = code;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const codeSizeClass = size === "lg" ? "text-[15px]" : size === "sm" ? "text-[12px]" : "text-[13px]";

  return (
    <div className="group relative my-3 overflow-hidden rounded-lg border border-hairline">
      {/* 헤더 */}
      <div className="flex items-center justify-between bg-surface-soft px-4 py-1.5">
        <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-muted">
          {lang || "code"}
        </span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-medium text-muted transition hover:bg-hairline hover:text-ink"
        >
          <Icon name={copied ? "check" : "copy"} size="xs" />
          {copied ? "복사됨" : "복사"}
        </button>
      </div>
      {/* 코드 본문 */}
      <pre className={`overflow-x-auto bg-[#FAFBFC] p-4 leading-[1.6] ${codeSizeClass}`}>
        <code className={`font-mono text-slate-800 ${className ?? ""}`} {...props}>
          {children}
        </code>
      </pre>
    </div>
  );
}

function stripFrontmatter(content: string): string {
  if (!content) return "";
  const normalized = content.replace(/\r\n/g, "\n");
  const trimmed = normalized.trimStart();
  if (trimmed.startsWith("---")) {
    const firstDashIndex = trimmed.indexOf("---");
    const secondDashIndex = trimmed.indexOf("---", firstDashIndex + 3);
    if (secondDashIndex !== -1) {
      return trimmed.slice(secondDashIndex + 3).trimStart();
    }
  }
  return content;
}

export function MarkdownView({ content, className = "", size = "md", onLinkClick }: MarkdownViewProps) {
  const cleanContent = stripFrontmatter(content);
  const sizes = {
    sm: {
      h1: "text-lg",
      h2: "text-base",
      h3: "text-sm",
      h4: "text-xs",
      body: "text-xs md:text-sm",
    },
    md: {
      h1: "text-xl",
      h2: "text-lg",
      h3: "text-base",
      h4: "text-sm",
      body: "text-sm",
    },
    lg: {
      h1: "text-2xl md:text-3xl font-black",
      h2: "text-xl md:text-2xl",
      h3: "text-lg md:text-xl",
      h4: "text-base md:text-lg",
      body: "text-base md:text-lg md:leading-relaxed",
    },
  }[size];

  return (
    <div className={`loadout-md ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={{
          code: (props) => <CodeBlock size={size} {...props} />,

          h1: ({ children }) => (
            <h1 className={`mb-4 mt-6 border-b border-hairline pb-2 font-bold text-ink first:mt-0 ${sizes.h1}`}>
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className={`mb-3 mt-5 border-b border-hairline pb-1.5 font-bold text-ink first:mt-0 ${sizes.h2}`}>
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className={`mb-2 mt-4 font-bold text-ink ${sizes.h3}`}>{children}</h3>
          ),
          h4: ({ children }) => (
            <h4 className={`mb-2 mt-3 font-bold text-ink ${sizes.h4}`}>{children}</h4>
          ),

          p: ({ children }) => (
            <p className={`mb-3 leading-relaxed text-body ${sizes.body}`}>{children}</p>
          ),

          ul: ({ children }) => (
            <ul className={`mb-3 ml-1 list-none space-y-1.5 text-body ${sizes.body}`}>{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className={`mb-3 ml-4 list-decimal space-y-1.5 text-body ${sizes.body}`}>{children}</ol>
          ),
          li: ({ children }) => (
            <li className={`relative pl-4 leading-relaxed text-body before:absolute before:left-0 before:top-[0.6em] before:h-1.5 before:w-1.5 before:rounded-full before:bg-primary/40 ${sizes.body}`}>
              {children}
            </li>
          ),

          blockquote: ({ children }) => (
            <blockquote className={`my-3 rounded-r-lg border-l-[3px] border-primary bg-primary-soft/50 py-2 pl-4 pr-3 text-body ${sizes.body}`}>
              {children}
            </blockquote>
          ),

          a: ({ href, children }) => {
            const isRelative = href && !href.startsWith("http://") && !href.startsWith("https://") && !href.startsWith("mailto:") && !href.startsWith("#");
            if (isRelative && onLinkClick) {
              return (
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    onLinkClick(href);
                  }}
                  className="font-medium text-primary underline decoration-primary/30 underline-offset-2 transition hover:decoration-primary/60 cursor-pointer border-none bg-transparent p-0 text-left inline-block"
                >
                  {children}
                </button>
              );
            }
            return (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-primary underline decoration-primary/30 underline-offset-2 transition hover:decoration-primary/60"
              >
                {children}
              </a>
            );
          },

          table: ({ children }) => (
            <div className="my-3 overflow-x-auto rounded-lg border border-hairline">
              <table className={`w-full ${size === "lg" ? "text-base" : "text-sm"}`}>{children}</table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="border-b border-hairline bg-surface-soft">{children}</thead>
          ),
          th: ({ children }) => (
            <th className="px-3 py-2 text-left text-xs font-bold text-muted">{children}</th>
          ),
          td: ({ children }) => (
            <td className="border-t border-hairline px-3 py-2 text-body">{children}</td>
          ),

          hr: () => <hr className="my-5 border-hairline" />,

          strong: ({ children }) => (
            <strong className="font-semibold text-ink">{children}</strong>
          ),

          img: ({ src, alt }) => (
            <img
              src={src}
              alt={alt ?? ""}
              className="my-3 max-w-full rounded-lg border border-hairline"
            />
          ),

          // frontmatter 같은 ---로 둘러싸인 YAML 블록 처리
          pre: ({ children }) => <>{children}</>,
        }}
      >
        {cleanContent}
      </ReactMarkdown>
    </div>
  );
}
