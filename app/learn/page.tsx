import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function LearnPage() {
  const supabase = await createClient();
  const { data: sasl } = await supabase.from("subjects").select("id").eq("code","sasl-r12").maybeSingle();
  const subject = sasl?.id ? `&subject=${sasl.id}` : "";
  redirect(`/marketplace?role=deaf_tutor&subjectName=Learn%20Sign%20Language${subject}`);
}
