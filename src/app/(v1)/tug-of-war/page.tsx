import { redirect } from "next/navigation";

export default function TugOfWarPage() {
  redirect("/leaderboard?tab=tug");
}
