import { useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useTokenStorage } from '@/hooks/useTokenStorage';
import { 
  Code2, 
  Loader2, 
  FileCode, 
  GitBranch,
  ArrowLeftRight,
  MessageSquare,
  AlertCircle
} from 'lucide-react';
import { parse, html } from 'diff2html';
import 'diff2html/bundles/css/diff2html.min.css';

interface FileChange {
  filename: string;
  status: 'added' | 'modified' | 'removed' | 'renamed';
  additions: number;
  deletions: number;
  patch?: string;
}

interface DiffComment {
  id: string;
  file: string;
  line: number;
  author: string;
  text: string;
  timestamp: string;
}

export default function CodeDiff() {
  const { toast } = useToast();
  const { githubToken, gitlabToken } = useTokenStorage();
  
  const [mrUrl, setMrUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [filesChanged, setFilesChanged] = useState<FileChange[]>([]);
  const [selectedFile, setSelectedFile] = useState<FileChange | null>(null);
  const [diffHtml, setDiffHtml] = useState<string>('');
  const [viewMode, setViewMode] = useState<'side-by-side' | 'unified'>('side-by-side');
  const [comments, setComments] = useState<DiffComment[]>([]);
  const [mrTitle, setMrTitle] = useState('');
  const [mrAuthor, setMrAuthor] = useState('');

  const parseMRUrl = (url: string): { platform: 'github' | 'gitlab'; owner: string; repo: string; mrNumber: string } | null => {
    // GitHub: https://github.com/owner/repo/pull/123
    const githubMatch = url.match(/github\.com\/([^\/]+)\/([^\/]+)\/pull\/(\d+)/);
    if (githubMatch) {
      return { platform: 'github', owner: githubMatch[1], repo: githubMatch[2], mrNumber: githubMatch[3] };
    }
    
    // GitLab: https://gitlab.com/owner/repo/-/merge_requests/123
    const gitlabMatch = url.match(/gitlab\.com\/([^\/]+)\/([^\/]+)\/-\/merge_requests\/(\d+)/);
    if (gitlabMatch) {
      return { platform: 'gitlab', owner: gitlabMatch[1], repo: gitlabMatch[2], mrNumber: gitlabMatch[3] };
    }
    
    return null;
  };

  const fetchGitHubPR = async (owner: string, repo: string, prNumber: string) => {
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github.v3+json',
    };
    if (githubToken) {
      headers.Authorization = `Bearer ${githubToken}`;
    }

    const [prResponse, filesResponse] = await Promise.all([
      fetch(`https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}`, { headers }),
      fetch(`https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}/files`, { headers })
    ]);

    if (!prResponse.ok || !filesResponse.ok) {
      throw new Error('Failed to fetch GitHub PR details');
    }

    const prData = await prResponse.json();
    const filesData = await filesResponse.json();

    const files: FileChange[] = filesData.map((file: any) => ({
      filename: file.filename,
      status: file.status as FileChange['status'],
      additions: file.additions,
      deletions: file.deletions,
      patch: file.patch
    }));

    setMrTitle(prData.title);
    setMrAuthor(prData.user?.login || 'Unknown');
    setFilesChanged(files);
    
    if (files.length > 0 && files[0].patch) {
      setSelectedFile(files[0]);
      generateDiffHtml(files[0].patch, files[0].filename);
    }
  };

  const fetchGitLabMR = async (owner: string, repo: string, mrNumber: string) => {
    const projectPath = encodeURIComponent(`${owner}/${repo}`);
    const headers: Record<string, string> = {};
    if (gitlabToken) {
      headers['PRIVATE-TOKEN'] = gitlabToken;
    }

    const [mrResponse, changesResponse] = await Promise.all([
      fetch(`https://gitlab.com/api/v4/projects/${projectPath}/merge_requests/${mrNumber}`, { headers }),
      fetch(`https://gitlab.com/api/v4/projects/${projectPath}/merge_requests/${mrNumber}/changes`, { headers })
    ]);

    if (!mrResponse.ok || !changesResponse.ok) {
      throw new Error('Failed to fetch GitLab MR details');
    }

    const mrData = await mrResponse.json();
    const changesData = await changesResponse.json();

    const files: FileChange[] = (changesData.changes || []).map((change: any) => {
      let status: FileChange['status'] = 'modified';
      if (change.new_file) status = 'added';
      else if (change.deleted_file) status = 'removed';
      else if (change.renamed_file) status = 'renamed';

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

    setMrTitle(mrData.title);
    setMrAuthor(mrData.author?.username || 'Unknown');
    setFilesChanged(files);
    
    if (files.length > 0 && files[0].patch) {
      setSelectedFile(files[0]);
      generateDiffHtml(files[0].patch, files[0].filename);
    }
  };

  const generateDiffHtml = (patch: string, filename: string) => {
    try {
      // Create unified diff format
      const diffString = `diff --git a/${filename} b/${filename}\n${patch}`;
      
      const diffJson = parse(diffString);
      
      const outputFormat = viewMode === 'side-by-side' ? 'side-by-side' : 'line-by-line';
      const diffHtmlOutput = html(diffJson, {
        drawFileList: false,
        matching: 'lines',
        outputFormat,
        renderNothingWhenEmpty: false,
      });
      
      setDiffHtml(diffHtmlOutput);
    } catch (error) {
      console.error('Error generating diff HTML:', error);
      toast({
        title: 'Error generating diff',
        description: 'Failed to parse the diff. The patch format might be invalid.',
        variant: 'destructive'
      });
    }
  };

  const handleFetchDiff = async () => {
    if (!mrUrl) {
      toast({
        title: 'MR URL required',
        description: 'Please enter a merge request URL',
        variant: 'destructive'
      });
      return;
    }

    const parsed = parseMRUrl(mrUrl);
    if (!parsed) {
      toast({
        title: 'Invalid URL',
        description: 'Please enter a valid GitHub or GitLab MR URL',
        variant: 'destructive'
      });
      return;
    }

    setIsLoading(true);
    setFilesChanged([]);
    setSelectedFile(null);
    setDiffHtml('');

    try {
      if (parsed.platform === 'github') {
        await fetchGitHubPR(parsed.owner, parsed.repo, parsed.mrNumber);
      } else {
        await fetchGitLabMR(parsed.owner, parsed.repo, parsed.mrNumber);
      }

      toast({
        title: 'Diff loaded successfully',
        description: `Loaded changes for ${filesChanged.length} files`
      });
    } catch (error) {
      console.error('Error fetching diff:', error);
      toast({
        title: 'Failed to fetch diff',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileSelect = (file: FileChange) => {
    setSelectedFile(file);
    if (file.patch) {
      generateDiffHtml(file.patch, file.filename);
    }
  };

  const handleViewModeChange = (mode: 'side-by-side' | 'unified') => {
    setViewMode(mode);
    if (selectedFile && selectedFile.patch) {
      generateDiffHtml(selectedFile.patch, selectedFile.filename);
    }
  };

  const getStatusBadge = (status: FileChange['status']) => {
    const variants = {
      added: 'bg-success/10 text-success border-success/20',
      modified: 'bg-warning/10 text-warning border-warning/20',
      removed: 'bg-destructive/10 text-destructive border-destructive/20',
      renamed: 'bg-info/10 text-info border-info/20'
    };
    
    return (
      <Badge className={variants[status]}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  const hasTokens = Boolean(githubToken || gitlabToken);

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
            <Code2 className="h-8 w-8 text-primary" />
            Code Diff Viewer
          </h1>
          <p className="text-muted-foreground mt-1">
            View detailed code changes with syntax highlighting and inline comments
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
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <GitBranch className="h-5 w-5 text-primary" />
              Load Merge Request
            </CardTitle>
            <CardDescription>
              Enter a GitHub PR or GitLab MR URL to view the code diff
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <div className="flex-1 space-y-2">
                <Label htmlFor="mr-url">MR/PR URL</Label>
                <Input
                  id="mr-url"
                  placeholder="https://github.com/owner/repo/pull/123"
                  value={mrUrl}
                  onChange={(e) => setMrUrl(e.target.value)}
                  className="font-mono text-sm"
                />
              </div>
            </div>
            <Button 
              onClick={handleFetchDiff}
              disabled={isLoading}
              className="w-full md:w-auto"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Loading...
                </>
              ) : (
                <>
                  <FileCode className="h-4 w-4 mr-2" />
                  Load Code Diff
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {filesChanged.length > 0 && (
          <>
            {/* MR Info */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">{mrTitle}</CardTitle>
                <CardDescription>
                  by {mrAuthor} • {filesChanged.length} files changed
                </CardDescription>
              </CardHeader>
            </Card>

            {/* View Mode Toggle */}
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold">File Changes</h2>
              <Tabs value={viewMode} onValueChange={(v) => handleViewModeChange(v as any)}>
                <TabsList>
                  <TabsTrigger value="side-by-side" className="gap-2">
                    <ArrowLeftRight className="h-4 w-4" />
                    Side-by-Side
                  </TabsTrigger>
                  <TabsTrigger value="unified" className="gap-2">
                    <FileCode className="h-4 w-4" />
                    Unified
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            <div className="grid grid-cols-12 gap-6">
              {/* File List Sidebar */}
              <Card className="col-span-12 lg:col-span-3">
                <CardHeader>
                  <CardTitle className="text-sm">Files</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <ScrollArea className="h-[600px]">
                    <div className="space-y-1 p-4">
                      {filesChanged.map((file, idx) => (
                        <button
                          key={idx}
                          onClick={() => handleFileSelect(file)}
                          className={`w-full text-left p-3 rounded-lg border transition-colors ${
                            selectedFile?.filename === file.filename
                              ? 'bg-primary/10 border-primary'
                              : 'bg-secondary/30 border-border hover:bg-secondary/50'
                          }`}
                        >
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              {getStatusBadge(file.status)}
                            </div>
                            <p className="text-xs font-mono truncate">
                              {file.filename}
                            </p>
                            <div className="flex gap-2 text-xs">
                              <span className="text-success">+{file.additions}</span>
                              <span className="text-destructive">-{file.deletions}</span>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>

              {/* Diff Display */}
              <Card className="col-span-12 lg:col-span-9">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-sm font-mono">
                        {selectedFile?.filename || 'Select a file'}
                      </CardTitle>
                      {selectedFile && (
                        <CardDescription className="flex gap-2 mt-1">
                          <span className="text-success">+{selectedFile.additions} additions</span>
                          <span className="text-destructive">-{selectedFile.deletions} deletions</span>
                        </CardDescription>
                      )}
                    </div>
                    {getStatusBadge(selectedFile?.status || 'modified')}
                  </div>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[600px]">
                    {diffHtml ? (
                      <div 
                        className="diff2html-container"
                        dangerouslySetInnerHTML={{ __html: diffHtml }}
                      />
                    ) : (
                      <div className="flex items-center justify-center h-full text-muted-foreground">
                        <div className="text-center">
                          <FileCode className="h-12 w-12 mx-auto mb-2 opacity-50" />
                          <p>Select a file to view the diff</p>
                        </div>
                      </div>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </MainLayout>
  );
}
