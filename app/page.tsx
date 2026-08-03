import { redirect } from "next/navigation";
import { fullTitleHref } from "@/lib/wiki/title";

export default function HomePage() {
  redirect(fullTitleHref("/w", "대문"));
}
