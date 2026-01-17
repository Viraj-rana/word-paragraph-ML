import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RepoInfo {
  platform: "github" | "gitlab";
  owner: string;
  repo: string;
}

function parseRepoUrl(url: string): RepoInfo | null {
  // GitHub: https://github.com/owner/repo
  const githubMatch = url.match(/github\.com\/([^\/]+)\/([^\/]+)/);
  if (githubMatch) {
    return { platform: "github", owner: githubMatch[1], repo: githubMatch[2].replace(/\.git$/, "") };
  }
  
  // GitLab: https://gitlab.com/owner/repo or https://gitlab.com/group/subgroup/repo
  const gitlabMatch = url.match(/gitlab\.com\/(.+)/);
  if (gitlabMatch) {
    const path = gitlabMatch[1].replace(/\.git$/, "");
    const parts = path.split("/");
    if (parts.length >= 2) {
      const repo = parts.pop()!;
      const owner = parts.join("/");
      return { platform: "gitlab", owner, repo };
    }
  }
  
  return null;
}

async function fetchGitHubRepo(owner: string, repo: string, token?: string) {
  const headers: Record<string, string> = {
    "Accept": "application/vnd.github.v3+json",
    "User-Agent": "CodeReview-Bot",
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  // Fetch repo info
  const repoRes = await fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers });
  if (!repoRes.ok) {
    const error = await repoRes.text();
    throw new Error(`GitHub API error: ${repoRes.status} - ${error}`);
  }
  const repoData = await repoRes.json();

  // Fetch directory tree (root level)
  const treeRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees/HEAD?recursive=1`, { headers });
  let tree: any[] = [];
  if (treeRes.ok) {
    const treeData = await treeRes.json();
    tree = treeData.tree?.slice(0, 100) || [];
  }

  // Fetch languages
  const langRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/languages`, { headers });
  let languages: Record<string, number> = {};
  if (langRes.ok) {
    languages = await langRes.json();
  }

  // Try to fetch package.json for additional info
  let packageJson: any = null;
  const pkgRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/package.json`, { headers });
  if (pkgRes.ok) {
    const pkgData = await pkgRes.json();
    if (pkgData.content) {
      packageJson = JSON.parse(atob(pkgData.content));
    }
  }

  return { repoData, tree, languages, packageJson };
}

async function fetchGitLabRepo(owner: string, repo: string, token?: string) {
  const projectPath = encodeURIComponent(`${owner}/${repo}`);
  const headers: Record<string, string> = {};
  if (token) headers["PRIVATE-TOKEN"] = token;

  // Fetch project info
  const projectRes = await fetch(`https://gitlab.com/api/v4/projects/${projectPath}`, { headers });
  if (!projectRes.ok) {
    const error = await projectRes.text();
    throw new Error(`GitLab API error: ${projectRes.status} - ${error}`);
  }
  const projectData = await projectRes.json();

  // Fetch repository tree
  const treeRes = await fetch(`https://gitlab.com/api/v4/projects/${projectPath}/repository/tree?recursive=true&per_page=100`, { headers });
  let tree: any[] = [];
  if (treeRes.ok) {
    tree = await treeRes.json();
  }

  // Fetch languages
  const langRes = await fetch(`https://gitlab.com/api/v4/projects/${projectPath}/languages`, { headers });
  let languages: Record<string, number> = {};
  if (langRes.ok) {
    languages = await langRes.json();
  }

  // Try to fetch package.json
  let packageJson: any = null;
  const pkgRes = await fetch(`https://gitlab.com/api/v4/projects/${projectPath}/repository/files/package.json/raw?ref=HEAD`, { headers });
  if (pkgRes.ok) {
    const pkgText = await pkgRes.text();
    try {
      packageJson = JSON.parse(pkgText);
    } catch {}
  }

  return { projectData, tree, languages, packageJson };
}

async function analyzeWithAI(repoInfo: any, platform: string) {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

  // Limit tree to prevent overly large prompts
  const limitedTree = repoInfo.tree?.slice(0, 20) || [];

  const prompt = `Analyze this repository and generate a README.

Repository:
- Platform: ${platform}
- Name: ${repoInfo.name || repoInfo.path}
- Description: ${repoInfo.description || "No description"}
- Branch: ${repoInfo.default_branch}

Languages: ${JSON.stringify(repoInfo.languages || {})}

Files (sample):
${limitedTree.map((f: any) => f.path || f.name).join(", ") || "N/A"}

IMPORTANT: Keep the readme field SHORT (under 1500 characters). Include only essential sections.

Return JSON:
{
  "projectName": "string",
  "description": "1-2 sentences",
  "techStack": ["max 5 items"],
  "features": ["max 5 items"],
  "structure": ["max 5 dirs"],
  "readme": "Short markdown README (under 1500 chars)"
}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 50000);

  try {
    console.log("Starting AI analysis...");
    
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "You analyze repos and create concise READMEs. Return ONLY valid JSON. Keep readme under 1500 characters." },
          { role: "user", content: prompt },
        ],
        max_completion_tokens: 4000,
        response_format: { type: "json_object" },
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    console.log("AI response status:", response.status);

    if (!response.ok) {
      if (response.status === 429) throw new Error("Rate limit exceeded. Please try again later.");
      if (response.status === 402) throw new Error("Payment required. Please add credits to continue.");
      throw new Error(`AI analysis failed: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    
    if (!content) throw new Error("No response from AI");
    console.log("AI response length:", content.length);

    // Try to parse JSON, with fallback repair for truncated responses
    let jsonStr = content.trim();
    
    // Remove markdown code blocks if present
    const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim();
    }
    
    // Extract JSON boundaries
    const jsonStart = jsonStr.indexOf('{');
    if (jsonStart !== -1) {
      jsonStr = jsonStr.substring(jsonStart);
    }

    try {
      return JSON.parse(jsonStr);
    } catch (parseError) {
      console.error("Initial parse failed, attempting repair...");
      
      // Try to repair truncated JSON by closing open strings and brackets
      let repaired = jsonStr;
      
      // Count brackets to determine what's missing
      const openBraces = (repaired.match(/{/g) || []).length;
      const closeBraces = (repaired.match(/}/g) || []).length;
      const openBrackets = (repaired.match(/\[/g) || []).length;
      const closeBrackets = (repaired.match(/]/g) || []).length;
      
      // Check if we're inside an unclosed string (for readme field)
      const lastQuoteIndex = repaired.lastIndexOf('"');
      const afterLastQuote = repaired.substring(lastQuoteIndex + 1);
      
      // If truncated inside a string, close it
      if (!afterLastQuote.includes('"') && lastQuoteIndex > 0) {
        repaired = repaired + '..."';
      }
      
      // Close any open arrays
      for (let i = 0; i < openBrackets - closeBrackets; i++) {
        repaired += ']';
      }
      
      // Close any open objects
      for (let i = 0; i < openBraces - closeBraces; i++) {
        repaired += '}';
      }
      
      try {
        console.log("Attempting to parse repaired JSON...");
        return JSON.parse(repaired);
      } catch (repairError) {
        console.error("Failed to parse AI response:", content.substring(0, 500));
        throw new Error("AI returned invalid JSON. Please try again.");
      }
    }
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("AI analysis timed out. Repository may be too large.");
    }
    throw error;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { repoUrl, accessToken } = await req.json();

    if (!repoUrl) {
      return new Response(
        JSON.stringify({ error: "Repository URL is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const repoInfo = parseRepoUrl(repoUrl);
    if (!repoInfo) {
      return new Response(
        JSON.stringify({ error: "Invalid repository URL. Supported: GitHub, GitLab" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Indexing ${repoInfo.platform} repository: ${repoInfo.owner}/${repoInfo.repo}`);

    let fetchedData: any;

    if (repoInfo.platform === "github") {
      const data = await fetchGitHubRepo(repoInfo.owner, repoInfo.repo, accessToken);
      fetchedData = {
        name: data.repoData.name,
        description: data.repoData.description,
        default_branch: data.repoData.default_branch,
        stargazers_count: data.repoData.stargazers_count,
        forks_count: data.repoData.forks_count,
        tree: data.tree,
        languages: data.languages,
        packageJson: data.packageJson,
      };
    } else {
      const data = await fetchGitLabRepo(repoInfo.owner, repoInfo.repo, accessToken);
      fetchedData = {
        name: data.projectData.name,
        path: data.projectData.path_with_namespace,
        description: data.projectData.description,
        default_branch: data.projectData.default_branch,
        star_count: data.projectData.star_count,
        forks_count: data.projectData.forks_count,
        tree: data.tree,
        languages: data.languages,
        packageJson: data.packageJson,
      };
    }

    // Analyze with AI
    const analysis = await analyzeWithAI(fetchedData, repoInfo.platform);

    return new Response(
      JSON.stringify(analysis),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error indexing repository:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
