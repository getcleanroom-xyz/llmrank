import { connection } from "next/server";
import { BrandsPageClient } from "@/components/brands/BrandsPageClient";

export const metadata = {
  title: "Brands | LLMRank",
  description: "Manage your brands and track AI visibility across ChatGPT, Gemini, Claude, and more.",
};

export default async function BrandsPage() {
  await connection();
  return <BrandsPageClient />;
}
