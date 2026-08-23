import { redirect } from "next/navigation";

export default async function LearnPage() {
  redirect("/marketplace?role=deaf_tutor&subjectName=Learn%20Sign%20Language");
}
