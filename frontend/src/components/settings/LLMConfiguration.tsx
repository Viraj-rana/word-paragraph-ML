import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Brain,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  Plus,
  Trash2,
  Save
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface LLMProvider {
  provider: string;
  model: string;
  api_key: string;
  enabled: boolean;
}

interface ProjectLLMConfig {
  id: string;
  project_id: string;
  project_name: string;
  llm_providers: LLMProvider[];
  default_provider: string;
  created_at: string;
  updated_at: string;
}

const AVAILABLE_PROVIDERS = {
  gemini: {
    name: 'Google Gemini',
    models: ['gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-2.0-flash'],
    icon: '🤖'
  },
  openai: {
    name: 'OpenAI',
    models: ['gpt-4o', 'gpt-4-turbo', 'gpt-4', 'gpt-3.5-turbo'],
    icon: '🧠'
  },
  anthropic: {
    name: 'Anthropic Claude',
    models: ['claude-3-opus', 'claude-3-sonnet', 'claude-3-haiku'],
    icon: '🎭'
  }
};

export function LLMConfiguration() {
  const { toast } = useToast();
  const [currentProjectId] = useState('default-project');
  const [config, setConfig] = useState<ProjectLLMConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showApiKeys, setShowApiKeys] = useState<Record<string, boolean>>({});

  // Load configuration on mount
  useEffect(() => {
    loadConfiguration();
  }, []);

  const loadConfiguration = async () => {
    setIsLoading(true);
    try {
      const backendUrl = import.meta.env.REACT_APP_BACKEND_URL || '';
      const response = await fetch(`${backendUrl}/api/llm-config/${currentProjectId}`);

      if (!response.ok) {
        throw new Error('Failed to load configuration');
      }

      const data = await response.json();
      setConfig(data);
    } catch (error) {
      console.error('Error loading LLM configuration:', error);
      toast({
        title: 'Failed to load configuration',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const saveConfiguration = async () => {
    if (!config) return;

    setIsSaving(true);
    try {
      const backendUrl = import.meta.env.REACT_APP_BACKEND_URL || '';
      const response = await fetch(`${backendUrl}/api/llm-config`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          project_id: config.project_id,
          project_name: config.project_name,
          llm_providers: config.llm_providers,
          default_provider: config.default_provider
        })
      });

      if (!response.ok) {
        throw new Error('Failed to save configuration');
      }

      const data = await response.json();
      setConfig(data);

      toast({
        title: 'Configuration saved',
        description: 'Your LLM settings have been updated successfully.'
      });
    } catch (error) {
      console.error('Error saving LLM configuration:', error);
      toast({
        title: 'Failed to save configuration',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive'
      });
    } finally {
      setIsSaving(false);
    }
  };

  const addProvider = () => {
    if (!config) return;

    const newProvider: LLMProvider = {
      provider: 'gemini',
      model: 'gemini-1.5-pro',
      api_key: '',
      enabled: true
    };

    setConfig({
      ...config,
      llm_providers: [...config.llm_providers, newProvider]
    });
  };

  const removeProvider = (index: number) => {
    if (!config) return;

    const newProviders = config.llm_providers.filter((_, i) => i !== index);
    setConfig({
      ...config,
      llm_providers: newProviders
    });
  };

  const updateProvider = (index: number, field: keyof LLMProvider, value: any) => {
    if (!config) return;

    const newProviders = [...config.llm_providers];
    newProviders[index] = {
      ...newProviders[index],
      [field]: value
    };

    setConfig({
      ...config,
      llm_providers: newProviders
    });
  };

  const toggleApiKeyVisibility = (index: number) => {
    setShowApiKeys({
      ...showApiKeys,
      [index]: !showApiKeys[index]
    });
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  if (!config) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">Failed to load configuration</p>
          <Button onClick={loadConfiguration} className="mt-4">
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            LLM Model Configuration
          </CardTitle>
          <CardDescription>
            Configure AI models for code review analysis. Add your API keys and select default models per project.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="project-name">Project Name</Label>
              <Input
                id="project-name"
                value={config.project_name}
                onChange={(e) => setConfig({ ...config, project_name: e.target.value })}
                placeholder="My Project"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="default-provider">Default Provider</Label>
              <Select
                value={config.default_provider}
                onValueChange={(value) => setConfig({ ...config, default_provider: value })}
              >
                <SelectTrigger id="default-provider">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(AVAILABLE_PROVIDERS).map(([key, provider]) => (
                    <SelectItem key={key} value={key}>
                      {provider.icon} {provider.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                This provider will be used by default for code reviews
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Provider Cards */}
      {config.llm_providers.map((provider, index) => {
        const providerInfo = AVAILABLE_PROVIDERS[provider.provider as keyof typeof AVAILABLE_PROVIDERS];

        return (
          <Card key={index} className={provider.enabled ? 'border-primary/30' : ''}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{providerInfo?.icon}</span>
                  <div>
                    <CardTitle className="text-base">
                      {providerInfo?.name || provider.provider}
                    </CardTitle>
                    <CardDescription>
                      {provider.model}
                    </CardDescription>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {config.default_provider === provider.provider && (
                    <Badge className="bg-primary/10 text-primary border-primary/20">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Default
                    </Badge>
                  )}
                  <Switch
                    checked={provider.enabled}
                    onCheckedChange={(checked) => updateProvider(index, 'enabled', checked)}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeProvider(index)}
                    disabled={config.llm_providers.length === 1}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Provider</Label>
                  <Select
                    value={provider.provider}
                    onValueChange={(value) => {
                      updateProvider(index, 'provider', value);
                      // Auto-select first model when provider changes
                      const models = AVAILABLE_PROVIDERS[value as keyof typeof AVAILABLE_PROVIDERS]?.models || [];
                      if (models.length > 0) {
                        updateProvider(index, 'model', models[0]);
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(AVAILABLE_PROVIDERS).map(([key, p]) => (
                        <SelectItem key={key} value={key}>
                          {p.icon} {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Model</Label>
                  <Select
                    value={provider.model}
                    onValueChange={(value) => updateProvider(index, 'model', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {providerInfo?.models.map((model) => (
                        <SelectItem key={model} value={model}>
                          {model}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>API Key</Label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      type={showApiKeys[index] ? 'text' : 'password'}
                      value={provider.api_key}
                      onChange={(e) => updateProvider(index, 'api_key', e.target.value)}
                      placeholder="Enter your API key"
                      className="font-mono text-sm pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                      onClick={() => toggleApiKeyVisibility(index)}
                    >
                      {showApiKeys[index] ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Your API key is stored securely per project
                </p>
              </div>
            </CardContent>
          </Card>
        );
      })}

      {/* Add Provider Button */}
      <Button
        variant="outline"
        onClick={addProvider}
        className="w-full"
      >
        <Plus className="h-4 w-4 mr-2" />
        Add Another Provider
      </Button>

      {/* Save Button */}
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={loadConfiguration}>
          Reset
        </Button>
        <Button onClick={saveConfiguration} disabled={isSaving}>
          {isSaving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Saving...
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              Save Configuration
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
