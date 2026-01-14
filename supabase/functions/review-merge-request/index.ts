import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface MRInfo {
  platform: "github" | "gitlab";
  owner: string;
  repo: string;
  mrNumber: string;
}

function parseMRUrl(url: string): MRInfo | null {
  // GitHub PR: https://github.com/owner/repo/pull/123
  const githubMatch = url.match(/github\.com\/([^\/]+)\/([^\/]+)\/pull\/(\d+)/);
  if (githubMatch) {
    return { platform: "github", owner: githubMatch[1], repo: githubMatch[2], mrNumber: githubMatch[3] };
  }
  
  // GitLab MR: https://gitlab.com/owner/repo/-/merge_requests/123
  const gitlabMatch = url.match(/gitlab\.com\/(.+)\/-\/merge_requests\/(\d+)/);
  if (gitlabMatch) {
    const path = gitlabMatch[1];
    const parts = path.split("/");
    const repo = parts.pop()!;
    const owner = parts.join("/");
    return { platform: "gitlab", owner, repo, mrNumber: gitlabMatch[2] };
  }
  
  return null;
}

async function fetchGitHubPR(owner: string, repo: string, prNumber: string, token?: string) {
  const headers: Record<string, string> = {
    "Accept": "application/vnd.github.v3+json",
    "User-Agent": "CodeReview-Bot",
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  // Fetch PR info
  const prRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}`, { headers });
  if (!prRes.ok) {
    const error = await prRes.text();
    throw new Error(`GitHub API error: ${prRes.status} - ${error}`);
  }
  const prData = await prRes.json();

  // Fetch PR files/diff
  const filesRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}/files`, { headers });
  let files: any[] = [];
  if (filesRes.ok) {
    files = await filesRes.json();
  }

  // Fetch commits
  const commitsRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}/commits`, { headers });
  let commits: any[] = [];
  if (commitsRes.ok) {
    commits = await commitsRes.json();
  }

  return { prData, files, commits };
}

async function fetchGitLabMR(owner: string, repo: string, mrNumber: string, token?: string) {
  const projectPath = encodeURIComponent(`${owner}/${repo}`);
  const headers: Record<string, string> = {};
  if (token) headers["PRIVATE-TOKEN"] = token;

  // Fetch MR info
  const mrRes = await fetch(`https://gitlab.com/api/v4/projects/${projectPath}/merge_requests/${mrNumber}`, { headers });
  if (!mrRes.ok) {
    const error = await mrRes.text();
    throw new Error(`GitLab API error: ${mrRes.status} - ${error}`);
  }
  const mrData = await mrRes.json();

  // Fetch MR changes/diff
  const changesRes = await fetch(`https://gitlab.com/api/v4/projects/${projectPath}/merge_requests/${mrNumber}/changes`, { headers });
  let changes: any = {};
  if (changesRes.ok) {
    changes = await changesRes.json();
  }

  // Fetch commits
  const commitsRes = await fetch(`https://gitlab.com/api/v4/projects/${projectPath}/merge_requests/${mrNumber}/commits`, { headers });
  let commits: any[] = [];
  if (commitsRes.ok) {
    commits = await commitsRes.json();
  }

  return { mrData, changes, commits };
}

async function analyzeCodeWithAI(mrInfo: any, diffs: string, styleGuide?: string) {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

  const systemPrompt = `You are an expert code reviewer. Analyze the provided code changes and identify issues related to:
1. Security vulnerabilities (SQL injection, XSS, etc.)
2. Code quality and best practices
3. Performance issues
4. Error handling
5. Code style and naming conventions
${styleGuide ? `\n6. Adherence to the following style guide:\n${styleGuide}` : ""}

For each issue found, provide:
- The file and approximate line number
- Severity (error, warning, or info)
- A clear description of the issue
- The relevant rule/category
- A suggestion for fixing the issue

Always respond with valid JSON only.`;

  const userPrompt = `Analyze this merge request:

Title: ${mrInfo.title}
Author: ${mrInfo.author}
Description: ${mrInfo.description || "No description"}

Code Changes (Diffs):
${diffs.slice(0, 15000)} ${diffs.length > 15000 ? "\n... (truncated for length)" : ""}

Provide a JSON response with this structure:
{
  "status": "passed" | "warnings" | "failed",
  "issues": [
    {
      "id": "unique-id",
      "file": "path/to/file.ts",
      "line": 42,
      "severity": "error" | "warning" | "info",
      "message": "Description of the issue",
      "rule": "category/rule-name",
      "suggestion": "How to fix it"
    }
  ],
  "summary": "Overall summary of the code review in 2-3 sentences"
}

If there are critical errors (severity: error), set status to "failed".
If there are only warnings, set status to "warnings".
If no issues or only info-level, set status to "passed".`;

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: systemPrompt + "\n\nCRITICAL: Output ONLY the raw JSON object with no markdown formatting or code blocks." },
        { role: "user", content: userPrompt },
      ],
      max_completion_tokens: 4000,
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    if (response.status === 429) throw new Error("Rate limit exceeded. Please try again later.");
    if (response.status === 402) throw new Error("Payment required. Please add credits to continue.");
    throw new Error(`AI analysis failed: ${response.status}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  
  if (!content) throw new Error("No response from AI");

  // Parse JSON from response (handle potential markdown wrapping or extra text)
  let jsonStr = content.trim();
  
  // Try to extract JSON from markdown code blocks
  const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1].trim();
  }
  
  // Try to find JSON object boundaries if there's extra text
  const jsonStart = jsonStr.indexOf('{');
  const jsonEnd = jsonStr.lastIndexOf('}');
  if (jsonStart !== -1 && jsonEnd !== -1 && jsonStart < jsonEnd) {
    jsonStr = jsonStr.substring(jsonStart, jsonEnd + 1);
  }
  
  try {
    return JSON.parse(jsonStr);
  } catch (parseError) {
    console.error("Failed to parse AI response:", content.substring(0, 500));
    throw new Error("AI returned invalid JSON response. Please try again.");
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const startTime = Date.now();
    const { mrUrl, accessToken, styleGuide } = await req.json();

    if (!mrUrl) {
      return new Response(
        JSON.stringify({ error: "Merge request URL is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const mrInfo = parseMRUrl(mrUrl);
    if (!mrInfo) {
      return new Response(
        JSON.stringify({ error: "Invalid merge request URL. Supported: GitHub PRs, GitLab MRs" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Reviewing ${mrInfo.platform} MR: ${mrInfo.owner}/${mrInfo.repo}#${mrInfo.mrNumber}`);

    let mrData: any;
    let diffs = "";
    let filesChanged = 0;
    let linesAdded = 0;
    let linesRemoved = 0;

    if (mrInfo.platform === "github") {
      const data = await fetchGitHubPR(mrInfo.owner, mrInfo.repo, mrInfo.mrNumber, accessToken);
      mrData = {
        title: data.prData.title,
        author: data.prData.user?.login || "unknown",
        description: data.prData.body,
      };
      filesChanged = data.files.length;
      data.files.forEach((file: any) => {
        linesAdded += file.additions || 0;
        linesRemoved += file.deletions || 0;
        diffs += `\n\n--- ${file.filename} ---\n${file.patch || "Binary file or no changes"}`;
      });
    } else {
      const data = await fetchGitLabMR(mrInfo.owner, mrInfo.repo, mrInfo.mrNumber, accessToken);
      mrData = {
        title: data.mrData.title,
        author: data.mrData.author?.username || "unknown",
        description: data.mrData.description,
      };
      const changesArr = data.changes.changes || [];
      filesChanged = changesArr.length;
      changesArr.forEach((change: any) => {
        const diffLines = (change.diff || "").split("\n");
        diffLines.forEach((line: string) => {
          if (line.startsWith("+") && !line.startsWith("+++")) linesAdded++;
          if (line.startsWith("-") && !line.startsWith("---")) linesRemoved++;
        });
        diffs += `\n\n--- ${change.new_path} ---\n${change.diff || "Binary file or no changes"}`;
      });
    }

    // Analyze with AI
    const analysis = await analyzeCodeWithAI(mrData, diffs, styleGuide);

    const reviewTime = ((Date.now() - startTime) / 1000 / 60).toFixed(1);

    const result = {
      mrTitle: mrData.title,
      author: mrData.author,
      filesChanged,
      linesAdded,
      linesRemoved,
      reviewTime: `${reviewTime} minutes`,
      status: analysis.status,
      issues: analysis.issues || [],
      summary: analysis.summary,
    };

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error reviewing merge request:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
