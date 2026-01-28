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
  Loader2,
  HelpCircle,
  X,
  ExternalLink,
  Lock
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useTokenStorage } from "@/hooks/useTokenStorage";

// Dialog Component (inline since we don't have it)
const Dialog = ({ open, onOpenChange, children }: { open: boolean; onOpenChange: (open: boolean) => void; children: React.ReactNode }) => {
  if (!open) return null;
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center animate-fade-in">
      <div 
        className="fixed inset-0 bg-black/50 backdrop-blur-sm" 
        onClick={() => onOpenChange(false)}
      />
      <div className="relative bg-background rounded-lg shadow-2xl max-w-3xl w-full mx-4 max-h-[85vh] overflow-y-auto animate-scale-in">
        {children}
      </div>
    </div>
  );
};

const DialogContent = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div className={className}>
    {children}
  </div>
);

const DialogHeader = ({ children }: { children: React.ReactNode }) => (
  <div className="flex flex-col space-y-1.5 text-center sm:text-left p-6 border-b">
    {children}
  </div>
);

const DialogTitle = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <h2 className={`text-2xl font-semibold leading-none tracking-tight ${className}`}>
    {children}
  </h2>
);

const DialogDescription = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <p className={`text-sm text-muted-foreground ${className}`}>
    {children}
  </p>
);

const DialogClose = ({ onClick }: { onClick: () => void }) => (
  <Button
    variant="ghost"
    size="icon"
    className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none"
    onClick={onClick}
  >
    <X className="h-4 w-4" />
    <span className="sr-only">Close</span>
  </Button>
);

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
  const [gitlabDialogOpen, setGitlabDialogOpen] = useState(false);
  const [githubDialogOpen, setGithubDialogOpen] = useState(false);
  
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
                  <div className="flex items-center justify-between">
                    <Label htmlFor="gitlab-token" className="flex items-center gap-2">
                      Personal Access Token
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() => setGitlabDialogOpen(true)}
                      >
                        <HelpCircle className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </Label>
                    <Button
                      variant="link"
                      size="sm"
                      className="text-xs h-6"
                      onClick={() => window.open("https://gitlab.com/-/profile/personal_access_tokens", "_blank")}
                    >
                      <ExternalLink className="h-3 w-3 mr-1" />
                      Go to GitLab Token Settings
                    </Button>
                  </div>
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
                        className="font-mono text-sm pr-10 cursor-pointer"
                        onClick={() => setGitlabDialogOpen(true)}
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
                  <div className="flex items-center justify-between">
                    <Label htmlFor="github-token" className="flex items-center gap-2">
                      Personal Access Token
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() => setGithubDialogOpen(true)}
                      >
                        <HelpCircle className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </Label>
                    <Button
                      variant="link"
                      size="sm"
                      className="text-xs h-6"
                      onClick={() => window.open("https://github.com/settings/tokens", "_blank")}
                    >
                      <ExternalLink className="h-3 w-3 mr-1" />
                      Go to GitHub Token Settings
                    </Button>
                  </div>
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
                        className="font-mono text-sm pr-10 cursor-pointer"
                        onClick={() => setGithubDialogOpen(true)}
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

          {/* Rest of your existing tabs content remains the same */}
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

      {/* GitLab Dialog */}
      <Dialog open={gitlabDialogOpen} onOpenChange={setGitlabDialogOpen}>
        <DialogContent className="p-0 space-y-1">
          <DialogHeader className="text-left bg-gradient-to-r from-blue-500/10 to-purple-500/10 p-6">
            <DialogTitle className="h-5 flex items-center gap-3">
              <Lock className="h-5 w-5 text-primary" />
              <div>
                <div className="text-xl font-bold">Security & Connection Guide</div>
                <div className="text-sm font-semibold text-primary">SAFE & PRIVATE DATA SYNCHRONIZATION</div>
              </div>
            </DialogTitle>
            <DialogClose onClick={() => setGitlabDialogOpen(false)} />
          </DialogHeader>
          
          <div className="p-6 space-y-2">
            {/* Platform Selection this the guidance class dialog box */}
            <div className="flex items-center gap-6 border-b pb-2 h-5">
              {/* <div className="text-sm font-medium">GitHub</div> */}
              <div className="text-xs font-bold text-primary flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-primary"></div>
                GitLab
              </div>
            </div>

            {/* Security Pledge */}
            <div className="space-y-2">
              <div className="text-sm font-semibold">Security Pledge</div>
              
              <div className="bg-muted/70 rounded-lg p-5 space-y-2">
                {/* Generating GitLab Token Section */}
                <div className=" text-xs space-y-3">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <Key className="text-sm h-5 w-5" />
                    Generating a GitLab Token
                  </h3>
                  <p className="text-muted-foreground">
                    To access GitLab Merge Requests, create a Personal Access Token with API read rights.
                  </p>
                  
                  <div className="space-y-3 pl-4 border-l-2 border-primary/30">
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold">
                        1
                      </div>
                      <p>Go to your <strong>User Settings → Access Tokens</strong>.</p>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold">
                        2
                      </div>
                      <p>Set a name and select the <code className="px-2 py-1 bg-muted rounded">read_api</code> scope.</p>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold">
                        3
                      </div>
                      <p>Set an expiration date (we recommend 7-30 days for security).</p>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold">
                        4
                      </div>
                      <p>Click <strong>Create personal access token</strong> and copy the result.</p>
                    </div>
                  </div>
                </div>

                {/* Enterprise Privacy Commitment */}
                <div className="text-xs space-y-3 pt-4 border-t">
                  <h3 className="text-sm font-semibold">Enterprise Privacy Commitment</h3>
                  <p className="text-muted-foreground">
                    We value your source code's confidentiality above all else. Our architecture is built to be stateless and local.
                  </p>
                </div>

                {/* Zero Server Persistence */}
                <div className="space-y-2 pt-4 border-t">
                  <h4 className="text-xs font-semibold flex items-center gap-2">
                    <Shield className="h-4 w-4" />
                    ZERO SERVER PERSISTENCE
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    Your code diffs and access tokens are never saved on our backend. They reside temporarily in your browser's RAM during analysis.
                  </p>
                </div>

                {/* Browse-only Tokens */}
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold flex items-center gap-2">
                    <Key className="h-4 w-4" />
                    BROWSE-ONLY TOKENS
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    Access tokens are only used to initiate a direct handshake with GitHub/GitLab. They are cleared when the session ends or the tab is closed.
                  </p>
                </div>

                {/* HTTPS Encryption */}
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold flex items-center gap-2">
                    <Lock className="h-4 w-4" />
                    HTTPS ENCRYPTION
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    Every bit of data is encrypted in transit using industry-standard TLS 1.3 certificates.
                  </p>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-between pt-4 border-t">
              <Button
                variant="outline"
                onClick={() => window.open("https://gitlab.com/-/profile/personal_access_tokens", "_blank")}
                className="text-xs gap-2 w-30 h-15"
              >
                <ExternalLink className="h-4 w-4" />
                Go to GitLab Token Settings
              </Button>
              <Button
                onClick={() => setGitlabDialogOpen(false)}
                className=" text-xs gap-2 w-30 h-15"
              >
                Got it, I'm ready
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* GitHub Dialog */}
      <Dialog open={githubDialogOpen} onOpenChange={setGithubDialogOpen}>
        <DialogContent className="p-0 space-y-1">
          <DialogHeader className=" text-left bg-gradient-to-r from-green-500/10 to-blue-500/10 p-6">
            <DialogTitle className="h-5 flex items-center gap-3">
              <Lock className="h-5 w-5 text-primary" />
              <div>
                <div className="text-lg font-bold">Security & Connection Guide</div>
                <div className="text-xs font-semibold text-primary">SAFE & PRIVATE DATA SYNCHRONIZATION</div>
              </div>
            </DialogTitle>
            <DialogClose onClick={() => setGithubDialogOpen(false)} />
          </DialogHeader>
          
          <div className="p-6 space-y-2">
            {/* Platform Selection */}
            <div className="flex items-center gap-6 border-b pb-2 h-5">
              <div className="text-xs font-bold text-primary flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-primary"></div>
                GitHub
              </div>
            </div>

            {/* Security Pledge */}
            <div className="space-y-1">
              <div className="text-sm font-semibold">Security Pledge</div>
              {/* this is the base dialog box for background changes*/}
              <div className="bg-muted/70 rounded-lg p-5 space-y-2">
                {/* Generating GitHub Token Section */}
                <div className="text-xs space-y-3">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <Key className="h-5 w-5" />
                    Generating a GitHub Token
                  </h3>
                  <p className="text-muted-foreground">
                    To review private repositories, WinSolution requires a Personal Access Token (Classic).
                  </p>
                  
                  <div className="space-y-3 pl-4 border-l-2 border-primary/30">
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold">
                        1
                      </div>
                      <div>
                        <p><strong>Navigate to Settings → Developer settings → Personal access tokens → Tokens (classic).</strong></p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold">
                        2
                      </div>
                      <div>
                        <p>Click <strong>Generate new token (classic)</strong>. Give it a descriptive name like "WinSolution AI Review".</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold">
                        3
                      </div>
                      <div>
                        <p>Select the <code className="px-2 py-1 bg-muted rounded">'repo'</code> scope. This is required to read your private code diffs.</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold">
                        4
                      </div>
                      <div>
                        <p>Click <strong>Generate token</strong> and paste it into the Repository Access field.</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Enterprise Privacy Commitment */}
                <div className="text-xs space-y-2 pt-4 border-t">
                  <h3 className="text-sm font-semibold">Enterprise Privacy Commitment</h3>
                  <p className="text-muted-foreground">
                    We value your source code's confidentiality above all else. Our architecture is built to be stateless and local.
                  </p>
                </div>

                {/* Zero Server Persistence */}
                <div className="text-xs space-y-2 pt-4 border-t">
                  <h4 className="font-semibold flex items-center gap-2">
                    <Shield className="h-4 w-4" />
                    ZERO SERVER PERSISTENCE
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    Your code diffs and access tokens are never saved on our backend. They reside temporarily in your browser's RAM during analysis.
                  </p>
                </div>

                {/* Browse-only Tokens */}
                <div className="text-xs space-y-2">
                  <h4 className="font-semibold flex items-center gap-2">
                    <Key className="h-4 w-4" />
                    BROWSE-ONLY TOKENS
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    Access tokens are only used to initiate a direct handshake with GitHub/GitLab. They are cleared when the session ends or the tab is closed.
                  </p>
                </div>

                {/* AI Safety Protocols */}
                <div className="text-xs space-y-2">
                  <h4 className="font-semibold flex items-center gap-2">
                    <Shield className="h-4 w-4" />
                    AI SAFETY PROTOCOLS
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    We use the Google Gemini 3 Enterprise model, which ensures that your code is not stored or used for training.
                  </p>
                </div>

                {/* HTTPS Encryption */}
                <div className="text-xs space-y-2">
                  <h4 className="font-semibold flex items-center gap-2">
                    <Lock className="h-4 w-4" />
                    HTTPS ENCRYPTION
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    Every bit of data is encrypted in transit using industry-standard TLS 1.3 certificates.
                  </p>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-between pt-4 border-t">
              <Button
                variant="outline"
                onClick={() => window.open("https://github.com/settings/tokens", "_blank")}
                className="text-xs gap-2 w-30 h-15"
              >
                <ExternalLink className="h-4 w-4" />
                Go to GitHub Token Settings
              </Button>
              <Button
                onClick={() => setGithubDialogOpen(false)}
                className="text-xs gap-2 w-30 h-15"
              >
                Got it, I'm ready
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
