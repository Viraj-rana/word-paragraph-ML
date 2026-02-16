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
  const limitedTree = repoInfo.tree?.slice(0, 15) || [];

  const prompt = `Analyze this repository and return a JSON object.

Repository: ${repoInfo.name || repoInfo.path}
Platform: ${platform}
Description: ${repoInfo.description || "No description"}
Languages: ${Object.keys(repoInfo.languages || {}).slice(0, 5).join(", ") || "Unknown"}
Files: ${limitedTree.map((f: any) => f.path || f.name).slice(0, 10).join(", ") || "N/A"}

CRITICAL: Return ONLY a valid JSON object with these exact fields:
- projectName: string (project name)
- description: string (one short sentence, max 100 chars)
- techStack: array of max 4 strings
- features: array of max 4 strings  
- structure: array of max 4 strings (main directories)
- readme: string (brief markdown, max 800 chars, no code blocks)

Keep ALL values SHORT to avoid truncation.`;

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
          { role: "system", content: "You are a JSON generator. Return ONLY valid JSON, no markdown, no explanation. Keep all string values short." },
          { role: "user", content: prompt },
        ],
        max_completion_tokens: 2000,
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

    // Clean up the response
    let jsonStr = content.trim();
    
    // Remove markdown code blocks if present
    const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim();
    }
    
    // Find JSON object boundaries
    const jsonStart = jsonStr.indexOf('{');
    const jsonEnd = jsonStr.lastIndexOf('}');
    
    if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
      jsonStr = jsonStr.substring(jsonStart, jsonEnd + 1);
    } else if (jsonStart !== -1) {
      jsonStr = jsonStr.substring(jsonStart);
    }

    // First attempt: direct parse
    try {
      const parsed = JSON.parse(jsonStr);
      console.log("JSON parsed successfully");
      return validateAndNormalize(parsed, repoInfo);
    } catch (parseError) {
      console.error("Initial parse failed, attempting repair...");
      console.log("Raw content to repair:", jsonStr.substring(0, 300));
    }
    
    // Second attempt: repair truncated JSON
    try {
      const repaired = repairTruncatedJson(jsonStr);
      console.log("Attempting to parse repaired JSON...");
      const parsed = JSON.parse(repaired);
      return validateAndNormalize(parsed, repoInfo);
    } catch (repairError) {
      console.error("Repair failed. Content:", jsonStr.substring(0, 500));
    }
    
    // Third attempt: extract partial data using regex
    console.log("Attempting regex extraction...");
    return extractPartialData(jsonStr, repoInfo);

  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("AI analysis timed out. Repository may be too large.");
    }
    throw error;
  }
}

function repairTruncatedJson(jsonStr: string): string {
  let repaired = jsonStr;
  
  // Remove trailing incomplete values after last complete property
  // Look for patterns like: "key": "incomplete value without closing quote
  const lastCompleteMatch = repaired.match(/(.*"[^"]+"\s*:\s*(?:\[[^\]]*\]|"[^"]*"|true|false|null|\d+)\s*,?)\s*"[^"]*"?\s*:\s*[^,}\]]*$/s);
  if (lastCompleteMatch) {
    repaired = lastCompleteMatch[1];
  }
  
  // Remove trailing comma if present
  repaired = repaired.replace(/,\s*$/, '');
  
  // Close any unclosed strings
  const quotes = (repaired.match(/"/g) || []).length;
  if (quotes % 2 !== 0) {
    repaired += '"';
  }
  
  // Close any unclosed arrays
  const openBrackets = (repaired.match(/\[/g) || []).length;
  const closeBrackets = (repaired.match(/\]/g) || []).length;
  for (let i = 0; i < openBrackets - closeBrackets; i++) {
    repaired += ']';
  }
  
  // Close any unclosed objects
  const openBraces = (repaired.match(/{/g) || []).length;
  const closeBraces = (repaired.match(/}/g) || []).length;
  for (let i = 0; i < openBraces - closeBraces; i++) {
    repaired += '}';
  }
  
  return repaired;
}

function extractPartialData(content: string, repoInfo: any): any {
  const result: any = {
    projectName: repoInfo.name || repoInfo.path || "Unknown Project",
    description: repoInfo.description || "Repository analysis completed.",
    techStack: [],
    features: [],
    structure: [],
    readme: `# ${repoInfo.name || repoInfo.path || "Project"}\n\n${repoInfo.description || "A software project."}`
  };
  
  // Extract projectName
  const nameMatch = content.match(/"projectName"\s*:\s*"([^"]+)"/);
  if (nameMatch) result.projectName = nameMatch[1];
  
  // Extract description
  const descMatch = content.match(/"description"\s*:\s*"([^"]+)"/);
  if (descMatch) result.description = descMatch[1];
  
  // Extract arrays using regex
  const extractArray = (key: string): string[] => {
    const arrayMatch = content.match(new RegExp(`"${key}"\\s*:\\s*\\[([^\\]]*)`));
    if (arrayMatch) {
      const items = arrayMatch[1].match(/"([^"]+)"/g);
      if (items) {
        return items.map(s => s.replace(/"/g, '')).slice(0, 5);
      }
    }
    return [];
  };
  
  result.techStack = extractArray("techStack");
  result.features = extractArray("features");
  result.structure = extractArray("structure");
  
  // Try to extract readme
  const readmeMatch = content.match(/"readme"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  if (readmeMatch) {
    result.readme = readmeMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"');
  }
  
  // Add languages to techStack if empty
  if (result.techStack.length === 0 && repoInfo.languages) {
    result.techStack = Object.keys(repoInfo.languages).slice(0, 4);
  }
  
  console.log("Extracted partial data successfully");
  return result;
}

function validateAndNormalize(parsed: any, repoInfo: any): any {
  return {
    projectName: String(parsed.projectName || repoInfo.name || repoInfo.path || "Unknown"),
    description: String(parsed.description || repoInfo.description || "A software project."),
    techStack: Array.isArray(parsed.techStack) ? parsed.techStack.slice(0, 5).map(String) : [],
    features: Array.isArray(parsed.features) ? parsed.features.slice(0, 5).map(String) : [],
    structure: Array.isArray(parsed.structure) ? parsed.structure.slice(0, 5).map(String) : [],
    readme: String(parsed.readme || `# ${parsed.projectName || repoInfo.name}\n\n${parsed.description || ""}`)
  };
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
