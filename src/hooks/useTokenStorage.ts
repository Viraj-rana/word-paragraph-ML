import { useState, useEffect, useCallback } from "react";

const GITHUB_TOKEN_KEY = "codereview_github_token";
const GITLAB_TOKEN_KEY = "codereview_gitlab_token";
const REVIEW_HISTORY_KEY = "codereview_history";

export interface StoredReview {
  id: string;
  mrUrl: string;
  mrTitle: string;
  author: string;
  status: "passed" | "warnings" | "failed";
  issueCount: number;
  reviewedAt: string;
  summary: string;
}

export function useTokenStorage() {
  const [githubToken, setGithubTokenState] = useState<string>("");
  const [gitlabToken, setGitlabTokenState] = useState<string>("");
  const [reviewHistory, setReviewHistoryState] = useState<StoredReview[]>([]);

  // Load tokens from localStorage on mount
  useEffect(() => {
    const storedGithub = localStorage.getItem(GITHUB_TOKEN_KEY);
    const storedGitlab = localStorage.getItem(GITLAB_TOKEN_KEY);
    const storedHistory = localStorage.getItem(REVIEW_HISTORY_KEY);

    if (storedGithub) setGithubTokenState(storedGithub);
    if (storedGitlab) setGitlabTokenState(storedGitlab);
    if (storedHistory) {
      try {
        setReviewHistoryState(JSON.parse(storedHistory));
      } catch (e) {
        console.error("Failed to parse review history:", e);
      }
    }
  }, []);

  const setGithubToken = useCallback((token: string) => {
    setGithubTokenState(token);
    if (token) {
      localStorage.setItem(GITHUB_TOKEN_KEY, token);
    } else {
      localStorage.removeItem(GITHUB_TOKEN_KEY);
    }
  }, []);

  const setGitlabToken = useCallback((token: string) => {
    setGitlabTokenState(token);
    if (token) {
      localStorage.setItem(GITLAB_TOKEN_KEY, token);
    } else {
      localStorage.removeItem(GITLAB_TOKEN_KEY);
    }
  }, []);

  const addReviewToHistory = useCallback((review: StoredReview) => {
    setReviewHistoryState((prev) => {
      // Keep only last 50 reviews
      const updated = [review, ...prev.filter(r => r.id !== review.id)].slice(0, 50);
      localStorage.setItem(REVIEW_HISTORY_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const clearHistory = useCallback(() => {
    setReviewHistoryState([]);
    localStorage.removeItem(REVIEW_HISTORY_KEY);
  }, []);

  const hasTokens = Boolean(githubToken || gitlabToken);

  return {
    githubToken,
    gitlabToken,
    setGithubToken,
    setGitlabToken,
    reviewHistory,
    addReviewToHistory,
    clearHistory,
    hasTokens,
  };
}
