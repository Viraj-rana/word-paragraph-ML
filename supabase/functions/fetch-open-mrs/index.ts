import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface OpenMR {
  id: string;
  title: string;
  url: string;
  author: string;
  createdAt: string;
  platform: "github" | "gitlab";
  repo: string;
  number: number;
}

async function fetchGitHubOpenPRs(token: string): Promise<OpenMR[]> {
  const headers = {
    "Accept": "application/vnd.github.v3+json",
    "Authorization": `Bearer ${token}`,
    "User-Agent": "CodeReview-Bot",
  };

  // Get user info first
  const userRes = await fetch("https://api.github.com/user", { headers });
  if (!userRes.ok) {
    throw new Error("Invalid GitHub token");
  }
  const user = await userRes.json();

  // Get user's repos
  const reposRes = await fetch("https://api.github.com/user/repos?per_page=100&sort=updated", { headers });
  if (!reposRes.ok) {
    throw new Error("Failed to fetch repositories");
  }
  const repos = await reposRes.json();

  const openPRs: OpenMR[] = [];

  // Fetch open PRs from each repo (limit to first 10 repos for performance)
  const reposToCheck = repos.slice(0, 10);
  
  for (const repo of reposToCheck) {
    try {
      const prsRes = await fetch(
        `https://api.github.com/repos/${repo.full_name}/pulls?state=open&per_page=10`,
        { headers }
      );
      if (prsRes.ok) {
        const prs = await prsRes.json();
        for (const pr of prs) {
          openPRs.push({
            id: `github-${repo.full_name}-${pr.number}`,
            title: pr.title,
            url: pr.html_url,
            author: pr.user?.login || "unknown",
            createdAt: pr.created_at,
            platform: "github",
            repo: repo.full_name,
            number: pr.number,
          });
        }
      }
    } catch (e) {
      console.error(`Error fetching PRs for ${repo.full_name}:`, e);
    }
  }

  return openPRs;
}

async function fetchGitLabOpenMRs(token: string): Promise<OpenMR[]> {
  const headers = {
    "PRIVATE-TOKEN": token,
  };

  // Get user's projects
  const projectsRes = await fetch(
    "https://gitlab.com/api/v4/projects?membership=true&per_page=20&order_by=last_activity_at",
    { headers }
  );
  if (!projectsRes.ok) {
    throw new Error("Invalid GitLab token or failed to fetch projects");
  }
  const projects = await projectsRes.json();

  const openMRs: OpenMR[] = [];

  // Fetch open MRs from each project (limit to first 10 for performance)
  const projectsToCheck = projects.slice(0, 10);

  for (const project of projectsToCheck) {
    try {
      const mrsRes = await fetch(
        `https://gitlab.com/api/v4/projects/${project.id}/merge_requests?state=opened&per_page=10`,
        { headers }
      );
      if (mrsRes.ok) {
        const mrs = await mrsRes.json();
        for (const mr of mrs) {
          openMRs.push({
            id: `gitlab-${project.path_with_namespace}-${mr.iid}`,
            title: mr.title,
            url: mr.web_url,
            author: mr.author?.username || "unknown",
            createdAt: mr.created_at,
            platform: "gitlab",
            repo: project.path_with_namespace,
            number: mr.iid,
          });
        }
      }
    } catch (e) {
      console.error(`Error fetching MRs for ${project.path_with_namespace}:`, e);
    }
  }

  return openMRs;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { githubToken, gitlabToken } = await req.json();

    if (!githubToken && !gitlabToken) {
      return new Response(
        JSON.stringify({ error: "At least one token (GitHub or GitLab) is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const allMRs: OpenMR[] = [];

    if (githubToken) {
      try {
        console.log("Fetching GitHub PRs...");
        const githubPRs = await fetchGitHubOpenPRs(githubToken);
        allMRs.push(...githubPRs);
        console.log(`Found ${githubPRs.length} GitHub PRs`);
      } catch (e) {
        console.error("GitHub fetch error:", e);
      }
    }

    if (gitlabToken) {
      try {
        console.log("Fetching GitLab MRs...");
        const gitlabMRs = await fetchGitLabOpenMRs(gitlabToken);
        allMRs.push(...gitlabMRs);
        console.log(`Found ${gitlabMRs.length} GitLab MRs`);
      } catch (e) {
        console.error("GitLab fetch error:", e);
      }
    }

    // Sort by creation date, newest first
    allMRs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return new Response(
      JSON.stringify({ mrs: allMRs }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error fetching open MRs:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
