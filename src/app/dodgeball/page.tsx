import { redirect } from "next/navigation";

export default function DodgeballPage() {
  redirect("/leaderboard?tab=dodgeball");
}
