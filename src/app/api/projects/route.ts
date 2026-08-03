import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getGithubUrls } from "@/lib/github/utils";
import { createClient } from "@/lib/supabase/server";
import { isUrl } from "@/lib/utils/string-utils";

// Manual "add project on the fly" path -- for late submissions/walk-ins that
// never went through the CSV import. Deliberately minimal: only
// project_title is required, everything else (table, links, one contact,
// tracks) is optional, matching how CSV-imported projects can have any of
// these fields blank too.
export async function POST(request: Request) {
  try {
    const session = await getSession();

    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => null);

    const eventId =
      typeof body?.event_id === "string" ? body.event_id.trim() : "";
    const projectTitle =
      typeof body?.project_title === "string" ? body.project_title.trim() : "";

    if (!eventId) {
      return NextResponse.json(
        { error: "event_id is required" },
        { status: 400 },
      );
    }
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
    // No column marks which link is "the Devpost one" -- the CSV import
    // only ever gets one canonical submission_url from Devpost itself, but
    // here it's just whichever pasted link points at devpost.com.
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

    const supabase = await createClient();

    const { data: project, error } = await supabase
      .from("projects")
      .insert({
        event_id: eventId,
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
      .select()
      .single();

    if (error) {
      console.error("Error creating project:", error);
      return NextResponse.json(
        { error: "Failed to create project" },
        { status: 500 },
      );
    }

    return NextResponse.json({ project }, { status: 201 });
  } catch (error) {
    console.error("Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
