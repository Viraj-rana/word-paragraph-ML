import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { useTokenStorage } from "@/hooks/useTokenStorage";
import { supabase } from "@/integrations/supabase/client";
import { 
  GitCompare, 
  Loader2, 
  FileText, 
  FilePlus, 
  FileX, 
  FileEdit,
  RotateCcw,
  GitCommit,
  ArrowRight,
  AlertCircle
} from "lucide-react";

interface MRDetails {
  title: string;
  author: string;
  commitSha: string;
  createdAt: string;
  filesChanged: FileChange[];
  totalAdditions: number;
  totalDeletions: number;
}

interface FileChange {
  filename: string;
  status: "added" | "modified" | "removed" | "renamed";
  additions: number;
  deletions: number;
  patch?: string;
}

interface ComparisonResult {
  newFiles: string[];
  modifiedFiles: string[];
  removedFiles: string[];
  revertedChanges: string[];
  previousMR: MRDetails;
  currentMR: MRDetails;
}

export default function DiffComparison() {
  const { toast } = useToast();
  const { githubToken, gitlabToken } = useTokenStorage();
  
  const [previousMRUrl, setPreviousMRUrl] = useState("");
  const [currentMRUrl, setCurrentMRUrl] = useState("");
  const [isComparing, setIsComparing] = useState(false);
  const [comparison, setComparison] = useState<ComparisonResult | null>(null);

  const parseMRUrl = (url: string): { platform: "github" | "gitlab"; owner: string; repo: string; mrNumber: string } | null => {
    // GitHub: https://github.com/owner/repo/pull/123
    const githubMatch = url.match(/github\.com\/([^\/]+)\/([^\/]+)\/pull\/(\d+)/);
    if (githubMatch) {
      return { platform: "github", owner: githubMatch[1], repo: githubMatch[2], mrNumber: githubMatch[3] };
    }
    
    // GitLab: https://gitlab.com/owner/repo/-/merge_requests/123
    const gitlabMatch = url.match(/gitlab\.com\/([^\/]+)\/([^\/]+)\/-\/merge_requests\/(\d+)/);
    if (gitlabMatch) {
      return { platform: "gitlab", owner: gitlabMatch[1], repo: gitlabMatch[2], mrNumber: gitlabMatch[3] };
    }
    
    return null;
  };

  const fetchGitHubPR = async (owner: string, repo: string, prNumber: string): Promise<MRDetails> => {
    const headers: Record<string, string> = {
      "Accept": "application/vnd.github.v3+json",
    };
    if (githubToken) {
      headers["Authorization"] = `Bearer ${githubToken}`;
    }

    const [prResponse, filesResponse] = await Promise.all([
      fetch(`https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}`, { headers }),
      fetch(`https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}/files`, { headers })
    ]);

    if (!prResponse.ok || !filesResponse.ok) {
      throw new Error("Failed to fetch GitHub PR details");
    }

    const prData = await prResponse.json();
    const filesData = await filesResponse.json();

    const filesChanged: FileChange[] = filesData.map((file: any) => ({
      filename: file.filename,
      status: file.status as FileChange["status"],
      additions: file.additions,
      deletions: file.deletions,
      patch: file.patch
    }));

    return {
      title: prData.title,
      author: prData.user?.login || "Unknown",
      commitSha: prData.head?.sha?.substring(0, 7) || "Unknown",
      createdAt: prData.created_at,
      filesChanged,
      totalAdditions: prData.additions,
      totalDeletions: prData.deletions
    };
  };

  const fetchGitLabMR = async (owner: string, repo: string, mrNumber: string): Promise<MRDetails> => {
    const projectPath = encodeURIComponent(`${owner}/${repo}`);
    const headers: Record<string, string> = {};
    if (gitlabToken) {
      headers["PRIVATE-TOKEN"] = gitlabToken;
    }

    const [mrResponse, changesResponse] = await Promise.all([
      fetch(`https://gitlab.com/api/v4/projects/${projectPath}/merge_requests/${mrNumber}`, { headers }),
      fetch(`https://gitlab.com/api/v4/projects/${projectPath}/merge_requests/${mrNumber}/changes`, { headers })
    ]);

    if (!mrResponse.ok || !changesResponse.ok) {
      throw new Error("Failed to fetch GitLab MR details");
    }

    const mrData = await mrResponse.json();
    const changesData = await changesResponse.json();

    const filesChanged: FileChange[] = (changesData.changes || []).map((change: any) => {
      let status: FileChange["status"] = "modified";
      if (change.new_file) status = "added";
      else if (change.deleted_file) status = "removed";
      else if (change.renamed_file) status = "renamed";

      const additions = (change.diff?.match(/^\+[^+]/gm) || []).length;
      const deletions = (change.diff?.match(/^-[^-]/gm) || []).length;

      return {
        filename: change.new_path || change.old_path,
        status,
        additions,
        deletions,
        patch: change.diff
      };
    });

    const totalAdditions = filesChanged.reduce((sum, f) => sum + f.additions, 0);
    const totalDeletions = filesChanged.reduce((sum, f) => sum + f.deletions, 0);

    return {
      title: mrData.title,
      author: mrData.author?.username || "Unknown",
      commitSha: mrData.sha?.substring(0, 7) || "Unknown",
      createdAt: mrData.created_at,
      filesChanged,
      totalAdditions,
      totalDeletions
    };
  };

  const compareChanges = (previous: MRDetails, current: MRDetails): ComparisonResult => {
    const previousFiles = new Set(previous.filesChanged.map(f => f.filename));
    const currentFiles = new Set(current.filesChanged.map(f => f.filename));

    const newFiles: string[] = [];
    const modifiedFiles: string[] = [];
    const removedFiles: string[] = [];
    const revertedChanges: string[] = [];

    // Find new files (in current but not in previous)
    current.filesChanged.forEach(file => {
      if (!previousFiles.has(file.filename)) {
        if (file.status === "added") {
          newFiles.push(file.filename);
        }
      }
    });

    // Find removed files (in previous but not in current, or marked as removed)
    previous.filesChanged.forEach(file => {
      const currentFile = current.filesChanged.find(f => f.filename === file.filename);
      if (!currentFile && file.status === "added") {
        // File was added in previous MR but not in current - could be reverted
        revertedChanges.push(file.filename);
      }
    });

    current.filesChanged.forEach(file => {
      if (file.status === "removed") {
        removedFiles.push(file.filename);
      }
    });

    // Find modified files (in both)
    current.filesChanged.forEach(file => {
      if (previousFiles.has(file.filename) && file.status === "modified") {
        modifiedFiles.push(file.filename);
      } else if (file.status === "modified" && !previousFiles.has(file.filename)) {
        modifiedFiles.push(file.filename);
      }
    });

    return {
      newFiles,
      modifiedFiles,
      removedFiles,
      revertedChanges,
      previousMR: previous,
      currentMR: current
    };
  };

  const handleCompare = async () => {
    if (!previousMRUrl || !currentMRUrl) {
      toast({
        title: "Missing URLs",
        description: "Please enter both MR URLs to compare",
        variant: "destructive"
      });
      return;
    }

    const previousParsed = parseMRUrl(previousMRUrl);
    const currentParsed = parseMRUrl(currentMRUrl);

    if (!previousParsed || !currentParsed) {
      toast({
        title: "Invalid URLs",
        description: "Please enter valid GitHub or GitLab MR URLs",
        variant: "destructive"
      });
      return;
    }

    setIsComparing(true);
    setComparison(null);

    try {
      let previousMR: MRDetails;
      let currentMR: MRDetails;

      if (previousParsed.platform === "github") {
        previousMR = await fetchGitHubPR(previousParsed.owner, previousParsed.repo, previousParsed.mrNumber);
      } else {
        previousMR = await fetchGitLabMR(previousParsed.owner, previousParsed.repo, previousParsed.mrNumber);
      }

      if (currentParsed.platform === "github") {
        currentMR = await fetchGitHubPR(currentParsed.owner, currentParsed.repo, currentParsed.mrNumber);
      } else {
        currentMR = await fetchGitLabMR(currentParsed.owner, currentParsed.repo, currentParsed.mrNumber);
      }

      const result = compareChanges(previousMR, currentMR);
      setComparison(result);

      toast({
        title: "Comparison Complete",
        description: `Compared ${previousMR.filesChanged.length} files vs ${currentMR.filesChanged.length} files`
      });
    } catch (error) {
      console.error("Comparison error:", error);
      toast({
        title: "Comparison Failed",
        description: error instanceof Error ? error.message : "Failed to compare MRs",
        variant: "destructive"
      });
    } finally {
      setIsComparing(false);
    }
  };

  const getStatusIcon = (status: FileChange["status"]) => {
    switch (status) {
      case "added": return <FilePlus className="h-4 w-4 text-success" />;
      case "modified": return <FileEdit className="h-4 w-4 text-warning" />;
      case "removed": return <FileX className="h-4 w-4 text-destructive" />;
      case "renamed": return <FileText className="h-4 w-4 text-info" />;
    }
  };

  const hasTokens = Boolean(githubToken || gitlabToken);

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
            <GitCompare className="h-8 w-8 text-primary" />
            Diff Comparison
          </h1>
          <p className="text-muted-foreground mt-1">
            Compare two merge requests to see what changed between them
          </p>
        </div>

        {/* Token Warning */}
        {!hasTokens && (
          <Card className="border-warning/50 bg-warning/5">
            <CardContent className="flex items-center gap-3 py-4">
              <AlertCircle className="h-5 w-5 text-warning" />
              <p className="text-sm text-warning">
                Add your GitHub or GitLab token in Settings to access private repositories
              </p>
            </CardContent>
          </Card>
        )}

        {/* Input Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <span className="text-muted-foreground">Previous MR</span>
              </CardTitle>
              <CardDescription>Enter the URL of the older merge request</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label htmlFor="previous-mr">Previous MR URL</Label>
                <Input
                  id="previous-mr"
                  placeholder="https://github.com/owner/repo/pull/123"
                  value={previousMRUrl}
                  onChange={(e) => setPreviousMRUrl(e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <span className="text-muted-foreground">Current MR</span>
              </CardTitle>
              <CardDescription>Enter the URL of the newer merge request</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label htmlFor="current-mr">Current MR URL</Label>
                <Input
                  id="current-mr"
                  placeholder="https://gitlab.com/owner/repo/-/merge_requests/456"
                  value={currentMRUrl}
                  onChange={(e) => setCurrentMRUrl(e.target.value)}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Compare Button */}
        <div className="flex justify-center">
          <Button 
            size="lg" 
            onClick={handleCompare}
            disabled={isComparing || !previousMRUrl || !currentMRUrl}
            className="px-8"
          >
            {isComparing ? (
              <>
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                Comparing...
              </>
            ) : (
              <>
                <GitCompare className="h-5 w-5 mr-2" />
                Compare Merge Requests
              </>
            )}
          </Button>
        </div>

        {/* Results */}
        {comparison && (
          <div className="space-y-6">
            <Separator />
            
            {/* Summary Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="bg-success/10 border-success/30">
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2">
                    <FilePlus className="h-5 w-5 text-success" />
                    <div>
                      <p className="text-2xl font-bold text-success">{comparison.newFiles.length}</p>
                      <p className="text-xs text-muted-foreground">New Files</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-warning/10 border-warning/30">
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2">
                    <FileEdit className="h-5 w-5 text-warning" />
                    <div>
                      <p className="text-2xl font-bold text-warning">{comparison.modifiedFiles.length}</p>
                      <p className="text-xs text-muted-foreground">Modified Files</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-destructive/10 border-destructive/30">
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2">
                    <FileX className="h-5 w-5 text-destructive" />
                    <div>
                      <p className="text-2xl font-bold text-destructive">{comparison.removedFiles.length}</p>
                      <p className="text-xs text-muted-foreground">Removed Files</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-info/10 border-info/30">
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2">
                    <RotateCcw className="h-5 w-5 text-info" />
                    <div>
                      <p className="text-2xl font-bold text-info">{comparison.revertedChanges.length}</p>
                      <p className="text-xs text-muted-foreground">Reverted</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Side by Side Comparison */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Previous MR */}
              <Card>
                <CardHeader className="bg-muted/30">
                  <CardTitle className="text-lg">Previous MR State</CardTitle>
                  <CardDescription>{comparison.previousMR.title}</CardDescription>
                </CardHeader>
                <CardContent className="pt-4 space-y-4">
                  <div className="flex items-center gap-4 text-sm">
                    <div className="flex items-center gap-1">
                      <GitCommit className="h-4 w-4 text-muted-foreground" />
                      <code className="bg-muted px-2 py-0.5 rounded text-xs">{comparison.previousMR.commitSha}</code>
                    </div>
                    <Badge variant="outline">{comparison.previousMR.author}</Badge>
                  </div>
                  
                  <div className="flex gap-4 text-sm">
                    <span className="text-success">+{comparison.previousMR.totalAdditions}</span>
                    <span className="text-destructive">-{comparison.previousMR.totalDeletions}</span>
                    <span className="text-muted-foreground">{comparison.previousMR.filesChanged.length} files</span>
                  </div>

                  <Separator />

                  <ScrollArea className="h-[300px]">
                    <div className="space-y-2">
                      {comparison.previousMR.filesChanged.map((file, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-sm py-1">
                          {getStatusIcon(file.status)}
                          <span className="truncate flex-1 font-mono text-xs">{file.filename}</span>
                          <span className="text-success text-xs">+{file.additions}</span>
                          <span className="text-destructive text-xs">-{file.deletions}</span>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>

              {/* Current MR */}
              <Card>
                <CardHeader className="bg-primary/10">
                  <CardTitle className="text-lg">Current MR State</CardTitle>
                  <CardDescription>{comparison.currentMR.title}</CardDescription>
                </CardHeader>
                <CardContent className="pt-4 space-y-4">
                  <div className="flex items-center gap-4 text-sm">
                    <div className="flex items-center gap-1">
                      <GitCommit className="h-4 w-4 text-muted-foreground" />
                      <code className="bg-muted px-2 py-0.5 rounded text-xs">{comparison.currentMR.commitSha}</code>
                    </div>
                    <Badge variant="outline">{comparison.currentMR.author}</Badge>
                  </div>
                  
                  <div className="flex gap-4 text-sm">
                    <span className="text-success">+{comparison.currentMR.totalAdditions}</span>
                    <span className="text-destructive">-{comparison.currentMR.totalDeletions}</span>
                    <span className="text-muted-foreground">{comparison.currentMR.filesChanged.length} files</span>
                  </div>

                  <Separator />

                  <ScrollArea className="h-[300px]">
                    <div className="space-y-2">
                      {comparison.currentMR.filesChanged.map((file, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-sm py-1">
                          {getStatusIcon(file.status)}
                          <span className="truncate flex-1 font-mono text-xs">{file.filename}</span>
                          <span className="text-success text-xs">+{file.additions}</span>
                          <span className="text-destructive text-xs">-{file.deletions}</span>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>

            {/* Change Classification */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ArrowRight className="h-5 w-5" />
                  Change Classification
                </CardTitle>
                <CardDescription>Summary of changes between the two merge requests</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* New Files */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-success font-medium">
                      <FilePlus className="h-4 w-4" />
                      New Files ({comparison.newFiles.length})
                    </div>
                    <ScrollArea className="h-[150px] bg-muted/30 rounded p-2">
                      {comparison.newFiles.length > 0 ? (
                        comparison.newFiles.map((file, idx) => (
                          <p key={idx} className="text-xs font-mono truncate py-0.5">{file}</p>
                        ))
                      ) : (
                        <p className="text-xs text-muted-foreground">No new files</p>
                      )}
                    </ScrollArea>
                  </div>

                  {/* Modified Files */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-warning font-medium">
                      <FileEdit className="h-4 w-4" />
                      Modified Files ({comparison.modifiedFiles.length})
                    </div>
                    <ScrollArea className="h-[150px] bg-muted/30 rounded p-2">
                      {comparison.modifiedFiles.length > 0 ? (
                        comparison.modifiedFiles.map((file, idx) => (
                          <p key={idx} className="text-xs font-mono truncate py-0.5">{file}</p>
                        ))
                      ) : (
                        <p className="text-xs text-muted-foreground">No modified files</p>
                      )}
                    </ScrollArea>
                  </div>

                  {/* Removed Files */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-destructive font-medium">
                      <FileX className="h-4 w-4" />
                      Removed Files ({comparison.removedFiles.length})
                    </div>
                    <ScrollArea className="h-[150px] bg-muted/30 rounded p-2">
                      {comparison.removedFiles.length > 0 ? (
                        comparison.removedFiles.map((file, idx) => (
                          <p key={idx} className="text-xs font-mono truncate py-0.5">{file}</p>
                        ))
                      ) : (
                        <p className="text-xs text-muted-foreground">No removed files</p>
                      )}
                    </ScrollArea>
                  </div>

                  {/* Reverted Changes */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-info font-medium">
                      <RotateCcw className="h-4 w-4" />
                      Reverted ({comparison.revertedChanges.length})
                    </div>
                    <ScrollArea className="h-[150px] bg-muted/30 rounded p-2">
                      {comparison.revertedChanges.length > 0 ? (
                        comparison.revertedChanges.map((file, idx) => (
                          <p key={idx} className="text-xs font-mono truncate py-0.5">{file}</p>
                        ))
                      ) : (
                        <p className="text-xs text-muted-foreground">No reverted changes</p>
                      )}
                    </ScrollArea>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
