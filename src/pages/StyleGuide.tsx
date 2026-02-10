import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { FileText, Save, Upload, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const defaultStyleGuide = `# Code Style Guide

## General Principles
- Write clean, readable, and maintainable code
- Follow the DRY (Don't Repeat Yourself) principle
- Use meaningful and descriptive names for variables, functions, and classes

## TypeScript/JavaScript
- Use TypeScript strict mode
- Prefer const over let; never use var
- Use arrow functions for callbacks
- Add proper type annotations for function parameters and return types

## React Components
- Use functional components with hooks
- Extract reusable logic into custom hooks
- Keep components small and focused
- Use proper prop types or TypeScript interfaces

## Naming Conventions
- camelCase for variables and functions
- PascalCase for components and classes
- UPPER_SNAKE_CASE for constants
- Use descriptive names that reflect purpose

## Error Handling
- Always handle errors in async operations
- Use try-catch blocks appropriately
- Provide meaningful error messages

## Security
- Never expose secrets in client-side code
- Validate and sanitize user inputs
- Use parameterized queries for database operations
`;

interface Rule {
  id: string;
  name: string;
  enabled: boolean;
  severity: "error" | "warning" | "info";
}

const defaultRules: Rule[] = [
  { id: "1", name: "SQL Injection Detection", enabled: true, severity: "error" },
  { id: "2", name: "Async Error Handling", enabled: true, severity: "warning" },
  { id: "3", name: "Cyclomatic Complexity", enabled: true, severity: "warning" },
  { id: "4", name: "Naming Conventions", enabled: true, severity: "info" },
  { id: "5", name: "TypeScript Strict Mode", enabled: true, severity: "warning" },
  { id: "6", name: "Unused Variables", enabled: false, severity: "info" },
  { id: "7", name: "Console Statements", enabled: true, severity: "warning" },
  { id: "8", name: "Magic Numbers", enabled: false, severity: "info" },
];

export default function StyleGuide() {
  const [styleGuide, setStyleGuide] = useState(defaultStyleGuide);
  const [rules, setRules] = useState(defaultRules);
  const [isSaved, setIsSaved] = useState(false);
  const { toast } = useToast();

  const handleSave = () => {
    setIsSaved(true);
    toast({
      title: "Style guide saved",
      description: "Your code style rules have been updated successfully.",
    });
    setTimeout(() => setIsSaved(false), 2000);
  };

  const toggleRule = (id: string) => {
    setRules(rules.map(rule => 
      rule.id === id ? { ...rule, enabled: !rule.enabled } : rule
    ));
  };

  const severityColors = {
    error: "bg-destructive/10 text-destructive border-destructive/20",
    warning: "bg-warning/10 text-warning border-warning/20",
    info: "bg-primary/10 text-primary border-primary/20",
  };

  return (
    <MainLayout>
      <div className="space-y-8 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Style Guide</h1>
            <p className="mt-2 text-muted-foreground">
              Configure your code style rules and documentation for AI-powered reviews.
            </p>
          </div>
          <Button onClick={handleSave} variant={isSaved ? "success" : "glow"}>
            {isSaved ? (
              <>
                <CheckCircle2 className="h-4 w-4" />
                Saved
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                Save Changes
              </>
            )}
          </Button>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Style Guide Document */}
          <Card glow className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                Style Guide Document
              </CardTitle>
              <CardDescription>
                This document will be used by the AI to analyze code against your standards.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Button variant="outline" size="sm">
                  <Upload className="h-4 w-4 mr-2" />
                  Import from file
                </Button>
              </div>
              <div className="space-y-2">
                <Label htmlFor="style-guide">Document Content (Markdown)</Label>
                <Textarea
                  id="style-guide"
                  value={styleGuide}
                  onChange={(e) => setStyleGuide(e.target.value)}
                  className="min-h-[500px] font-mono text-sm"
                  placeholder="Enter your style guide documentation..."
                />
              </div>
            </CardContent>
          </Card>

          {/* Rules Configuration */}
          <Card>
            <CardHeader>
              <CardTitle>Review Rules</CardTitle>
              <CardDescription>
                Enable or disable specific rules for code analysis.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {rules.map((rule) => (
                <div
                  key={rule.id}
                  className="flex items-center justify-between rounded-lg border border-border bg-secondary/30 p-3"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{rule.name}</span>
                      <Badge className={severityColors[rule.severity]}>
                        {rule.severity}
                      </Badge>
                    </div>
                  </div>
                  <Switch
                    checked={rule.enabled}
                    onCheckedChange={() => toggleRule(rule.id)}
                  />
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </MainLayout>
  );
}
