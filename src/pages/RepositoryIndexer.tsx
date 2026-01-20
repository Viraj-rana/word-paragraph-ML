import { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { GitBranch, Loader2, FileText, Code, Folder, CheckCircle2, Copy, RefreshCw, Database, Sparkles, FileCode } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";

interface IndexResult {
  projectName: string;
  description: string;
  techStack: string[];
  features: string[];
  structure: string[];
  readme: string;
}

type LoadingStep = "idle" | "fetching" | "analyzing" | "generating" | "complete";

export default function RepositoryIndexer() {
  const { t } = useLanguage();
  const [repoUrl, setRepoUrl] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState<LoadingStep>("idle");
  const [stepProgress, setStepProgress] = useState(0);
  const [result, setResult] = useState<IndexResult | null>(null);
  const [hasError, setHasError] = useState(false);
  const { toast } = useToast();

  const STEPS: { key: LoadingStep; label: string; icon: typeof GitBranch }[] = [
    { key: "fetching", label: t("indexer.fetching"), icon: Database },
    { key: "analyzing", label: t("indexer.analyzing"), icon: Sparkles },
    { key: "generating", label: t("indexer.generating"), icon: FileCode },
  ];

  // Simulate progress through steps during loading
  useEffect(() => {
    if (!isLoading) {
      setCurrentStep("idle");
      setStepProgress(0);
      return;
    }

    // Step 1: Fetching (0-2s)
    setCurrentStep("fetching");
    setStepProgress(0);
    
    const progressInterval = setInterval(() => {
      setStepProgress(prev => Math.min(prev + 2, 100));
    }, 100);

    const step2Timer = setTimeout(() => {
      setCurrentStep("analyzing");
      setStepProgress(0);
    }, 2000);

    const step3Timer = setTimeout(() => {
      setCurrentStep("generating");
      setStepProgress(0);
    }, 5000);

    return () => {
      clearInterval(progressInterval);
      clearTimeout(step2Timer);
      clearTimeout(step3Timer);
    };
  }, [isLoading]);

  const handleIndex = async () => {
    if (!repoUrl) {
      toast({
        title: t("indexer.repoUrlRequired"),
        description: t("indexer.repoUrlRequiredDesc"),
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    setResult(null);
    setHasError(false);
    
    try {
      const { data, error } = await supabase.functions.invoke("index-repository", {
        body: { repoUrl, accessToken: accessToken || undefined },
      });

      if (error) {
        throw new Error(error.message || "Failed to index repository");
      }

      if (data.error) {
        throw new Error(data.error);
      }

      setCurrentStep("complete");
      setStepProgress(100);
      setResult(data);
      toast({
        title: t("indexer.indexedSuccess"),
        description: t("indexer.indexedSuccessDesc"),
      });
    } catch (error) {
      console.error("Error indexing repository:", error);
      setHasError(true);
      toast({
        title: t("indexer.indexFailed"),
        description: error instanceof Error ? error.message : "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = () => {
    if (result?.readme) {
      navigator.clipboard.writeText(result.readme);
      toast({
        title: t("indexer.copiedToClipboard"),
        description: t("indexer.copiedDesc"),
      });
    }
  };

  return (
    <MainLayout>
      <div className="space-y-8 animate-fade-in">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("indexer.title")}</h1>
          <p className="mt-2 text-muted-foreground">
            {t("indexer.description")}
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Input Form */}
          <Card glow>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <GitBranch className="h-5 w-5 text-primary" />
                {t("indexer.repoDetails")}
              </CardTitle>
              <CardDescription>
                {t("indexer.repoDetailsDesc")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="repo-url">{t("indexer.repoUrl")}</Label>
                <Input
                  id="repo-url"
                  placeholder={t("indexer.repoUrlPlaceholder")}
                  value={repoUrl}
                  onChange={(e) => setRepoUrl(e.target.value)}
                  className="font-mono text-sm"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="access-token">
                  {t("indexer.accessToken")} <span className="text-muted-foreground">{t("indexer.forPrivateRepos")}</span>
                </Label>
                <Input
                  id="access-token"
                  type="password"
                  placeholder={t("indexer.tokenPlaceholder")}
                  value={accessToken}
                  onChange={(e) => setAccessToken(e.target.value)}
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  {t("indexer.tokenNote")}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={handleIndex}
                  disabled={isLoading}
                  className="flex-1"
                  variant="glow"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {t("indexer.indexing")}
                    </>
                  ) : (
                    <>
                      <GitBranch className="h-4 w-4" />
                      {t("indexer.indexRepo")}
                    </>
                  )}
                </Button>
                {hasError && !isLoading && (
                  <Button
                    onClick={handleIndex}
                    variant="outline"
                    className="shrink-0"
                  >
                    <RefreshCw className="h-4 w-4" />
                    {t("indexer.retry")}
                  </Button>
                )}
              </div>

              {/* Progress Steps */}
              {isLoading && (
                <div className="space-y-3 pt-4 border-t border-border/50 animate-fade-in">
                  {STEPS.map((step, index) => {
                    const StepIcon = step.icon;
                    const stepIndex = STEPS.findIndex(s => s.key === currentStep);
                    const isActive = step.key === currentStep;
                    const isComplete = index < stepIndex || currentStep === "complete";

                    return (
                      <div key={step.key} className="space-y-1.5">
                        <div className="flex items-center gap-2">
                          <div className={`flex h-6 w-6 items-center justify-center rounded-full transition-colors ${
                            isComplete ? "bg-success text-success-foreground" :
                            isActive ? "bg-primary text-primary-foreground" :
                            "bg-muted text-muted-foreground"
                          }`}>
                            {isComplete ? (
                              <CheckCircle2 className="h-3.5 w-3.5" />
                            ) : isActive ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <StepIcon className="h-3.5 w-3.5" />
                            )}
                          </div>
                          <span className={`text-sm font-medium transition-colors ${
                            isComplete ? "text-success" :
                            isActive ? "text-foreground" :
                            "text-muted-foreground"
                          }`}>
                            {step.label}
                          </span>
                        </div>
                        {isActive && (
                          <div className="ml-8">
                            <Progress value={stepProgress} className="h-1.5" />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Results */}
          {result && (
            <Card className="animate-slide-up">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-success" />
                    {t("indexer.analysisComplete")}
                  </span>
                  <Badge variant="secondary" className="font-mono">
                    {result.projectName}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-2">{t("indexer.techStack")}</h4>
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
                  <h4 className="text-sm font-medium text-muted-foreground mb-2">{t("indexer.keyFeatures")}</h4>
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
                  <h4 className="text-sm font-medium text-muted-foreground mb-2">{t("indexer.projectStructure")}</h4>
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
                {t("indexer.generatedReadme")}
              </CardTitle>
              <Button variant="outline" size="sm" onClick={copyToClipboard}>
                <Copy className="h-4 w-4 mr-2" />
                {t("indexer.copy")}
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