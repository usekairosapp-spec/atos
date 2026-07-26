import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Megaphone, Trash2 } from "lucide-react";
import { getViewerContext } from "@/features/auth/viewer";
import { deleteAnnouncement } from "@/features/announcements/actions";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_TIMEZONE, formatDate, formatTime } from "@/shared/lib/timezone";

type PageProps = { params: Promise<{ announcementId: string }> };
type ProfileRelation = { full_name: string } | { full_name: string }[] | null;
type DepartmentRelation = { name: string } | { name: string }[] | null;

export default async function AnnouncementDetailPage({ params }: PageProps) {
  const [{ announcementId }, viewer] = await Promise.all([params, getViewerContext()]);
  if (!viewer) notFound();
  const supabase = await createClient();
  const { data: announcement } = await supabase.from("announcements")
    .select("id, title, body, department_id, target_user_id, created_by, created_at, departments(name), profiles!announcements_created_by_fkey(full_name)")
    .eq("id", announcementId).maybeSingle();
  if (!announcement) notFound();

  const department = announcement.departments as DepartmentRelation;
  const departmentName = Array.isArray(department) ? department[0]?.name : department?.name;
  const author = announcement.profiles as ProfileRelation;
  const authorName = Array.isArray(author) ? author[0]?.full_name : author?.full_name;
  const scopeLabel = announcement.target_user_id ? "Mensagem direta para você" : departmentName ? `Setor: ${departmentName}` : "Toda a igreja";
  const date = new Date(announcement.created_at);
  const tz = viewer.profile.timezone ?? DEFAULT_TIMEZONE;
  const canDelete = viewer.isChurchAdmin || announcement.created_by === viewer.user.id;

  return <main className="mx-auto max-w-2xl px-5 py-8 sm:px-8">
    <Link className="inline-flex items-center gap-2 font-semibold text-[var(--church-brand)]" href="/painel/comunicados"><ArrowLeft size={18} /> Comunicados</Link>
    <section className="mt-6 rounded-[1.75rem] bg-white p-6 shadow-sm sm:p-8">
      <div className="flex items-center gap-3"><span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[var(--church-brand-soft)] text-[var(--church-brand)]"><Megaphone size={22} /></span><div><span className="rounded-full bg-[var(--church-brand-soft)] px-3 py-1 text-xs font-semibold text-[var(--church-brand-on-soft)]">{scopeLabel}</span></div></div>
      <h1 className="mt-5 text-2xl font-bold">{announcement.title}</h1>
      <p className="mt-1 text-sm text-[#717880]">Por {authorName ?? "Liderança"} · {formatDate(date, tz)} às {formatTime(date, tz, { hour: "2-digit", minute: "2-digit" })}</p>
      <p className="mt-6 whitespace-pre-wrap text-base leading-relaxed">{announcement.body}</p>
      {canDelete ? <form action={deleteAnnouncement} className="mt-6 border-t border-[#eaeef3] pt-5"><input type="hidden" name="announcementId" value={announcement.id} /><button className="inline-flex items-center gap-2 text-sm font-semibold text-red-700" type="submit"><Trash2 size={16} />Apagar comunicado</button></form> : null}
    </section>
  </main>;
}
