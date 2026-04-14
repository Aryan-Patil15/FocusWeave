import type { SVGProps } from "react";
import Image from "next/image";

export function Logo(props: React.HTMLAttributes<HTMLDivElement> & { className?: string }) {
  return (
    <div {...props} className={`flex items-center gap-2 ${props.className || ''}`}>
      <Image 
        src="/logo.png" 
        alt="FocusWeave Logo" 
        width={36} 
        height={36} 
        className="rounded-xl shadow-sm object-contain"
        priority
      />
      <span className="font-bold text-xl tracking-tight bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent hidden sm:inline-block">
        FocusWeave
      </span>
    </div>
  );
}

export function IconSpinner(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
      className={`animate-spin ${props.className || ""}`}
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}
