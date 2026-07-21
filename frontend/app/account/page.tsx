import type { Metadata } from "next";
import { AccountSettings } from "@/components/account/AccountSettings";

export const metadata: Metadata = {
  title: "Account | LLMRanked",
};

export default function AccountPage() {
  return <AccountSettings />;
}
