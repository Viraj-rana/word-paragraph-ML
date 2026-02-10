import { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { 
  Settings as SettingsIcon, 
  Key, 
  GitBranch, 
  Bell, 
  Shield,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useTokenStorage } from "@/hooks/useTokenStorage";

export default function Settings() {
  const { 
    githubToken, 
    gitlabToken, 
    setGithubToken, 
    setGitlabToken 
  } = useTokenStorage();
  
  const [localGitlabToken, setLocalGitlabToken] = useState("");
  const [localGithubToken, setLocalGithubToken] = useState("");
  const [showGitlabToken, setShowGitlabToken] = useState(false);
  const [showGithubToken, setShowGithubToken] = useState(false);
  const [reviewMode, setReviewMode] = useState("warning");
  const [verifyingGitlab, setVerifyingGitlab] = useState(false);
  const [verifyingGithub, setVerifyingGithub] = useState(false);
  const [gitlabVerified, setGitlabVerified] = useState(false);
  const [githubVerified, setGithubVerified] = useState(false);
  const [notifications, setNotifications] = useState({
    email: true,
    slack: false,
    telegram: true,
    inApp: true,
  });
  const { toast } = useToast();

  // Initialize local tokens from stored tokens
  useEffect(() => {
    if (githubToken) {
      setLocalGithubToken(githubToken);
      setGithubVerified(true);
    }
    if (gitlabToken) {
      setLocalGitlabToken(gitlabToken);
      setGitlabVerified(true);
    }
  }, [githubToken, gitlabToken]);

  const verifyGitlabToken = async () => {
    if (!localGitlabToken) {
      toast({
        title: "Token required",
        description: "Please enter your GitLab token first.",
        variant: "destructive",
      });
      return;
    }

    setVerifyingGitlab(true);
    try {
      const response = await fetch("https://gitlab.com/api/v4/user", {
        headers: { "PRIVATE-TOKEN": localGitlabToken },
      });

      if (response.ok) {
        const user = await response.json();
        setGitlabToken(localGitlabToken);
        setGitlabVerified(true);
        toast({
          title: "GitLab connected",
          description: `Successfully connected as ${user.username}`,
        });
      } else {
        throw new Error("Invalid token");
      }
    } catch (error) {
      setGitlabVerified(false);
      toast({
        title: "Verification failed",
        description: "Invalid GitLab token. Please check and try again.",
        variant: "destructive",
      });
    } finally {
      setVerifyingGitlab(false);
    }
  };

  const verifyGithubToken = async () => {
    if (!localGithubToken) {
      toast({
        title: "Token required",
        description: "Please enter your GitHub token first.",
        variant: "destructive",
      });
      return;
    }

    setVerifyingGithub(true);
    try {
      const response = await fetch("https://api.github.com/user", {
        headers: { 
          "Authorization": `Bearer ${localGithubToken}`,
          "Accept": "application/vnd.github.v3+json",
        },
      });

      if (response.ok) {
        const user = await response.json();
        setGithubToken(localGithubToken);
        setGithubVerified(true);
        toast({
          title: "GitHub connected",
          description: `Successfully connected as ${user.login}`,
        });
      } else {
        throw new Error("Invalid token");
      }
    } catch (error) {
      setGithubVerified(false);
      toast({
        title: "Verification failed",
        description: "Invalid GitHub token. Please check and try again.",
        variant: "destructive",
      });
    } finally {
      setVerifyingGithub(false);
    }
  };

  const handleSave = () => {
    toast({
      title: "Settings saved",
      description: "Your configuration has been updated successfully.",
    });
  };

  return (
    <MainLayout>
      <div className="space-y-8 animate-fade-in">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
          <p className="mt-2 text-muted-foreground">
            Configure integrations, API keys, and review preferences.
          </p>
        </div>

        <Tabs defaultValue="integrations" className="space-y-6">
          <TabsList>
            <TabsTrigger value="integrations" className="gap-2">
              <GitBranch className="h-4 w-4" />
              Integrations
            </TabsTrigger>
            <TabsTrigger value="review" className="gap-2">
              <Shield className="h-4 w-4" />
              Review Settings
            </TabsTrigger>
            <TabsTrigger value="notifications" className="gap-2">
              <Bell className="h-4 w-4" />
              Notifications
            </TabsTrigger>
          </TabsList>

          <TabsContent value="integrations" className="space-y-6">
            {/* GitLab Integration */}
            <Card glow>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <GitBranch className="h-5 w-5 text-primary" />
                  GitLab Integration
                  {gitlabVerified && (
                    <Badge className="bg-success/10 text-success border-success/20">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Connected
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription>
                  Connect your GitLab account to enable code review on merge requests.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="gitlab-token">Personal Access Token</Label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Input
                        id="gitlab-token"
                        type={showGitlabToken ? "text" : "password"}
                        placeholder="glpat-xxxxxxxxxxxxxxxxxxxx"
                        value={localGitlabToken}
                        onChange={(e) => {
                          setLocalGitlabToken(e.target.value);
                          setGitlabVerified(false);
                        }}
                        className="font-mono text-sm pr-10"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                        onClick={() => setShowGitlabToken(!showGitlabToken)}
                      >
                        {showGitlabToken ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                    <Button 
                      variant="outline" 
                      onClick={verifyGitlabToken}
                      disabled={verifyingGitlab}
                    >
                      {verifyingGitlab ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : gitlabVerified ? (
                        <CheckCircle2 className="h-4 w-4 text-success" />
                      ) : (
                        "Verify & Save"
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Required scopes: <code className="text-primary">api</code>, <code className="text-primary">read_repository</code>
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* GitHub Integration */}
            <Card glow>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <GitBranch className="h-5 w-5 text-primary" />
                  GitHub Integration
                  {githubVerified && (
                    <Badge className="bg-success/10 text-success border-success/20">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Connected
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription>
                  Connect your GitHub account to enable code review on pull requests.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="github-token">Personal Access Token</Label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Input
                        id="github-token"
                        type={showGithubToken ? "text" : "password"}
                        placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                        value={localGithubToken}
                        onChange={(e) => {
                          setLocalGithubToken(e.target.value);
                          setGithubVerified(false);
                        }}
                        className="font-mono text-sm pr-10"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                        onClick={() => setShowGithubToken(!showGithubToken)}
                      >
                        {showGithubToken ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                    <Button 
                      variant="outline" 
                      onClick={verifyGithubToken}
                      disabled={verifyingGithub}
                    >
                      {verifyingGithub ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : githubVerified ? (
                        <CheckCircle2 className="h-4 w-4 text-success" />
                      ) : (
                        "Verify & Save"
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Required scopes: <code className="text-primary">repo</code>, <code className="text-primary">read:org</code>
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="review" className="space-y-6">
            <Card glow>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-primary" />
                  Review Mode
                </CardTitle>
                <CardDescription>
                  Configure how the code review should behave in your CI/CD pipeline.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label>Review Mode</Label>
                  <Select value={reviewMode} onValueChange={setReviewMode}>
                    <SelectTrigger className="w-full md:w-[300px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="warning">
                        <div className="flex items-center gap-2">
                          <Badge className="bg-warning/10 text-warning border-warning/20">Warning</Badge>
                          <span>Non-blocking alerts</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="blocking">
                        <div className="flex items-center gap-2">
                          <Badge className="bg-destructive/10 text-destructive border-destructive/20">Blocking</Badge>
                          <span>Fail on errors</span>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {reviewMode === "warning" 
                      ? "Issues will be reported but won't block the merge request."
                      : "Critical issues will cause the CI job to fail."
                    }
                  </p>
                </div>

                <div className="space-y-4">
                  <Label>Additional Options</Label>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between rounded-lg border border-border p-3">
                      <div>
                        <p className="text-sm font-medium">Auto-approve on pass</p>
                        <p className="text-xs text-muted-foreground">
                          Automatically approve MRs with no issues
                        </p>
                      </div>
                      <Switch />
                    </div>
                    <div className="flex items-center justify-between rounded-lg border border-border p-3">
                      <div>
                        <p className="text-sm font-medium">Skip draft MRs</p>
                        <p className="text-xs text-muted-foreground">
                          Don't run reviews on draft merge requests
                        </p>
                      </div>
                      <Switch defaultChecked />
                    </div>
                    <div className="flex items-center justify-between rounded-lg border border-border p-3">
                      <div>
                        <p className="text-sm font-medium">Include suggestions</p>
                        <p className="text-xs text-muted-foreground">
                          Add fix suggestions to review comments
                        </p>
                      </div>
                      <Switch defaultChecked />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="notifications" className="space-y-6">
            <Card glow>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="h-5 w-5 text-primary" />
                  Notification Preferences
                </CardTitle>
                <CardDescription>
                  Choose how you want to be notified about review results.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between rounded-lg border border-border p-3">
                    <div>
                      <p className="text-sm font-medium">Email notifications</p>
                      <p className="text-xs text-muted-foreground">
                        Receive review summaries via email
                      </p>
                    </div>
                    <Switch 
                      checked={notifications.email}
                      onCheckedChange={(checked) => 
                        setNotifications({ ...notifications, email: checked })
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between rounded-lg border border-border p-3">
                    <div>
                      <p className="text-sm font-medium">Slack notifications</p>
                      <p className="text-xs text-muted-foreground">
                        Post review results to a Slack channel
                      </p>
                    </div>
                    <Switch 
                      checked={notifications.slack}
                      onCheckedChange={(checked) => 
                        setNotifications({ ...notifications, slack: checked })
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between rounded-lg border border-border p-3">
                    <div>
                      <p className="text-sm font-medium">Telegram notifications</p>
                      <p className="text-xs text-muted-foreground">
                        Send review results to your Telegram group
                      </p>
                    </div>
                    <Switch 
                      checked={notifications.telegram}
                      onCheckedChange={(checked) => 
                        setNotifications({ ...notifications, telegram: checked })
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between rounded-lg border border-border p-3">
                    <div>
                      <p className="text-sm font-medium">In-app notifications</p>
                      <p className="text-xs text-muted-foreground">
                        Show notifications in the dashboard
                      </p>
                    </div>
                    <Switch 
                      checked={notifications.inApp}
                      onCheckedChange={(checked) => 
                        setNotifications({ ...notifications, inApp: checked })
                      }
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end">
          <Button onClick={handleSave} variant="glow" size="lg">
            <CheckCircle2 className="h-4 w-4" />
            Save All Settings
          </Button>
        </div>
      </div>
    </MainLayout>
  );
}
