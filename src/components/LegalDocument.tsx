import { card } from "@/lib/ui";

/**
 * Wspólna oprawa regulaminu i polityki prywatności.
 *
 * Typografia jest ustawiona tutaj, a nie w każdym dokumencie z osobna, żeby oba
 * czytało się tak samo i żeby zmiana odstępów nie wymagała ruszania treści.
 */
export default function LegalDocument({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="mt-6 flex flex-col gap-4">{children}</div>;
}

export function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className={card}>
      <h2 className="mb-2 text-base font-semibold">{title}</h2>
      <div className="flex flex-col gap-2 text-sm leading-relaxed text-muted-foreground [&_a]:underline [&_li]:ml-4 [&_li]:list-disc [&_strong]:text-foreground [&_ul]:flex [&_ul]:flex-col [&_ul]:gap-1">
        {children}
      </div>
    </section>
  );
}
