import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { GitBranch, Loader2, FileText, Code, Folder, CheckCircle2, Copy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface IndexResult {
  projectName: string;
  description: string;
  techStack: string[];
  features: string[];
  structure: string[];
  readme: string;
}

export default function RepositoryIndexer() {
  const [repoUrl, setRepoUrl] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<IndexResult | null>(null);
  const { toast } = useToast();

  const handleIndex = async () => {
    if (!repoUrl) {
      toast({
        title: "Repository URL required",
        description: "Please enter a valid GitLab or GitHub repository URL.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    
    // Simulate API call - in production, this would call the edge function
    await new Promise((resolve) => setTimeout(resolve, 3000));
    
    setResult({
      projectName: "example-project",
      description: "A modern web application built with React and TypeScript",
      techStack: ["React", "TypeScript", "Tailwind CSS", "Vite", "Node.js"],
      features: [
        "User authentication and authorization",
        "RESTful API integration",
        "Responsive design",
        "Dark mode support",
      ],
      structure: [
        "src/components - React components",
        "src/pages - Page components",
        "src/hooks - Custom React hooks",
        "src/utils - Utility functions",
      ],
      readme: `# Example Project

## Overview
A modern web application built with React and TypeScript.

## Tech Stack
- React 18
- TypeScript 5
- Tailwind CSS
- Vite

## Features
- User authentication and authorization
- RESTful API integration
- Responsive design
- Dark mode support

## Getting Started
\`\`\`bash
npm install
npm run dev
\`\`\`

## License
MIT`,
    });
    
    setIsLoading(false);
    toast({
      title: "Repository indexed successfully",
      description: "README file has been generated based on the repository analysis.",
    });
  };

  const copyToClipboard = () => {
    if (result?.readme) {
      navigator.clipboard.writeText(result.readme);
      toast({
        title: "Copied to clipboard",
        description: "README content has been copied.",
      });
    }
  };

  return (
    <MainLayout>
      <div className="space-y-8 animate-fade-in">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Repository Indexer</h1>
          <p className="mt-2 text-muted-foreground">
            Analyze a repository and generate a comprehensive README file.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Input Form */}
          <Card glow>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <GitBranch className="h-5 w-5 text-primary" />
                Repository Details
              </CardTitle>
              <CardDescription>
                Enter the repository URL and optional access token for private repos.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="repo-url">Repository URL</Label>
                <Input
                  id="repo-url"
                  placeholder="https://gitlab.com/username/repo or https://github.com/username/repo"
                  value={repoUrl}
                  onChange={(e) => setRepoUrl(e.target.value)}
                  className="font-mono text-sm"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="access-token">
                  Access Token <span className="text-muted-foreground">(for private repos)</span>
                </Label>
                <Input
                  id="access-token"
                  type="password"
                  placeholder="glpat-xxxx or ghp_xxxx"
                  value={accessToken}
                  onChange={(e) => setAccessToken(e.target.value)}
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  Required for private repositories. Token is not stored.
                </p>
              </div>
              <Button
                onClick={handleIndex}
                disabled={isLoading}
                className="w-full"
                variant="glow"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Analyzing Repository...
                  </>
                ) : (
                  <>
                    <GitBranch className="h-4 w-4" />
                    Index Repository
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Results */}
          {result && (
            <Card className="animate-slide-up">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-success" />
                    Analysis Complete
                  </span>
                  <Badge variant="secondary" className="font-mono">
                    {result.projectName}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-2">Tech Stack</h4>
                  <div className="flex flex-wrap gap-2">
                    {result.techStack.map((tech) => (
                      <Badge key={tech} className="bg-primary/10 text-primary border-primary/20">
                        <Code className="h-3 w-3 mr-1" />
                        {tech}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-2">Key Features</h4>
                  <ul className="space-y-1">
                    {result.features.map((feature) => (
                      <li key={feature} className="flex items-center gap-2 text-sm">
                        <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-2">Project Structure</h4>
                  <ul className="space-y-1">
                    {result.structure.map((item) => (
                      <li key={item} className="flex items-center gap-2 text-sm font-mono text-muted-foreground">
                        <Folder className="h-3 w-3" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Generated README */}
        {result && (
          <Card className="animate-slide-up">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                Generated README.md
              </CardTitle>
              <Button variant="outline" size="sm" onClick={copyToClipboard}>
                <Copy className="h-4 w-4 mr-2" />
                Copy
              </Button>
            </CardHeader>
            <CardContent>
              <Textarea
                value={result.readme}
                readOnly
                className="min-h-[400px] font-mono text-sm bg-secondary/50"
              />
            </CardContent>
          </Card>
        )}
      </div>
    </MainLayout>
  );
}
