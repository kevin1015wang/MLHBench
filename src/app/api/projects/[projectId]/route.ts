import { NextResponse } from "next/server";
import { requireEventAccess } from "@/lib/auth/guest-access";
import { getSession } from "@/lib/auth/session";
import { getGithubUrls } from "@/lib/github/utils";
import { createClient } from "@/lib/supabase/server";
import { isUrl } from "@/lib/utils/string-utils";

// Edits the same minimal field set the manual "Add Project" flow supports
// (see POST /api/projects) -- title, table, links, one contact, tracks.
// Everything else (about_the_project, built_with, prize/code review results,
// etc.) is either CSV/AI-derived, or -- for judging fields -- already
// editable inline in the detail pane via its own auto-save.
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  try {
    const session = await getSession();
    const { projectId } = await params;

    const supabase = await createClient();

    const { data: existingProject, error: fetchError } = await supabase
      .from("projects")
      .select("event_id")
      .eq("id", projectId)
      .maybeSingle();

    if (fetchError || !existingProject) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const accessError = await requireEventAccess(
      session,
      existingProject.event_id,
    );
    if (accessError) return accessError;

    const body = await request.json().catch(() => null);

    const projectTitle =
      typeof body?.project_title === "string" ? body.project_title.trim() : "";
    if (!projectTitle) {
      return NextResponse.json(
        { error: "project_title is required" },
        { status: 400 },
      );
    }

    const tableNumber =
      typeof body?.table_number === "string" && body.table_number.trim()
        ? body.table_number.trim()
        : null;
    const links = Array.isArray(body?.links)
      ? body.links
          .filter((link: unknown): link is string => typeof link === "string")
          .map((link: string) => link.trim())
          .filter(isUrl)
      : [];
    // No column marks which link is "the Devpost one" -- just whichever
    // pasted link points at devpost.com, same heuristic as project creation.
    const submissionUrl =
      links.find((link: string) =>
        link.toLowerCase().includes("devpost.com"),
      ) ?? null;
    const githubUrl = getGithubUrls(links.join("\n"))[0] ?? null;
    const contactName =
      typeof body?.contact_name === "string" ? body.contact_name.trim() : "";
    const contactEmail =
      typeof body?.contact_email === "string" && body.contact_email.trim()
        ? body.contact_email.trim()
        : null;
    const standardizedOptInPrizes = Array.isArray(
      body?.standardized_opt_in_prizes,
    )
      ? body.standardized_opt_in_prizes.filter(
          (slug: unknown): slug is string => typeof slug === "string",
        )
      : [];

    const [submitterFirstName, ...rest] = contactName
      .split(" ")
      .filter(Boolean);
    const submitterLastName = rest.join(" ");

    const { data: project, error } = await supabase
      .from("projects")
      .update({
        project_title: projectTitle,
        table_number: tableNumber,
        submission_url: submissionUrl,
        github_url: githubUrl,
        try_it_out_links: links,
        submitter_first_name: submitterFirstName || null,
        submitter_last_name: submitterLastName || null,
        submitter_email: contactEmail,
        standardized_opt_in_prizes: standardizedOptInPrizes,
      })
      .eq("id", projectId)
      .select()
      .single();

    if (error) {
      console.error("Error updating project:", error);
      return NextResponse.json(
        { error: "Failed to update project" },
        { status: 500 },
      );
    }

    return NextResponse.json({ project });
  } catch (error) {
    console.error("Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
