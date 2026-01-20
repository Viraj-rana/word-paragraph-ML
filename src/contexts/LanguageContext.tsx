import { createContext, useContext, useState, ReactNode } from "react";

type Language = "en" | "ru";

interface LanguageContextType {
  language: Language;
  toggleLanguage: () => void;
  t: (key: string) => string;
}

const translations: Record<Language, Record<string, string>> = {
  en: {
    // Repository Indexer
    "indexer.title": "Repository Indexer",
    "indexer.description": "Analyze a repository and generate a comprehensive README file.",
    "indexer.repoDetails": "Repository Details",
    "indexer.repoDetailsDesc": "Enter the repository URL and optional access token for private repos.",
    "indexer.repoUrl": "Repository URL",
    "indexer.repoUrlPlaceholder": "https://gitlab.com/username/repo or https://github.com/username/repo",
    "indexer.accessToken": "Access Token",
    "indexer.forPrivateRepos": "(for private repos)",
    "indexer.tokenPlaceholder": "glpat-xxxx or ghp_xxxx",
    "indexer.tokenNote": "Required for private repositories. Token is not stored.",
    "indexer.indexing": "Indexing...",
    "indexer.indexRepo": "Index Repository",
    "indexer.retry": "Retry",
    "indexer.fetching": "Fetching repository data",
    "indexer.analyzing": "Analyzing codebase",
    "indexer.generating": "Generating README",
    "indexer.analysisComplete": "Analysis Complete",
    "indexer.techStack": "Tech Stack",
    "indexer.keyFeatures": "Key Features",
    "indexer.projectStructure": "Project Structure",
    "indexer.generatedReadme": "Generated README.md",
    "indexer.copy": "Copy",
    "indexer.repoUrlRequired": "Repository URL required",
    "indexer.repoUrlRequiredDesc": "Please enter a valid GitLab or GitHub repository URL.",
    "indexer.indexedSuccess": "Repository indexed successfully",
    "indexer.indexedSuccessDesc": "README file has been generated based on the repository analysis.",
    "indexer.indexFailed": "Failed to index repository",
    "indexer.copiedToClipboard": "Copied to clipboard",
    "indexer.copiedDesc": "README content has been copied.",
    
    // Merge Review
    "review.title": "Merge Request Review",
    "review.description": "Analyze merge requests against your style guide and best practices.",
    "review.config": "Review Configuration",
    "review.configDesc": "Enter the merge request URL to perform automated code review.",
    "review.mrUrl": "Merge Request URL",
    "review.mrUrlPlaceholder": "https://gitlab.com/group/project/-/merge_requests/123",
    "review.accessToken": "Access Token",
    "review.forPrivateRepos": "(for private repos)",
    "review.tokenPlaceholder": "glpat-xxxx",
    "review.analyzing": "Analyzing Code...",
    "review.startReview": "Start Review",
    "review.filesChanged": "Files Changed",
    "review.linesAdded": "Lines Added",
    "review.linesRemoved": "Lines Removed",
    "review.issuesFound": "Issues Found",
    "review.all": "All",
    "review.errors": "Errors",
    "review.warnings": "Warnings",
    "review.passed": "Passed",
    "review.failed": "Failed",
    "review.mrUrlRequired": "Merge Request URL required",
    "review.mrUrlRequiredDesc": "Please enter a valid GitLab or GitHub merge request URL.",
    "review.reviewComplete": "Code review complete",
    "review.reviewCompleteDesc": "Found {count} issues that need attention.",
    "review.reviewFailed": "Failed to review merge request",
    "review.emailSent": "Email notification sent",
    "review.emailSentDesc": "Review summary has been sent to your email.",
    "review.emailFailed": "Failed to send email",
  },
  ru: {
    // Repository Indexer
    "indexer.title": "Индексатор репозитория",
    "indexer.description": "Анализируйте репозиторий и создавайте подробный файл README.",
    "indexer.repoDetails": "Детали репозитория",
    "indexer.repoDetailsDesc": "Введите URL репозитория и токен доступа для приватных репозиториев.",
    "indexer.repoUrl": "URL репозитория",
    "indexer.repoUrlPlaceholder": "https://gitlab.com/username/repo или https://github.com/username/repo",
    "indexer.accessToken": "Токен доступа",
    "indexer.forPrivateRepos": "(для приватных репозиториев)",
    "indexer.tokenPlaceholder": "glpat-xxxx или ghp_xxxx",
    "indexer.tokenNote": "Требуется для приватных репозиториев. Токен не сохраняется.",
    "indexer.indexing": "Индексация...",
    "indexer.indexRepo": "Индексировать репозиторий",
    "indexer.retry": "Повторить",
    "indexer.fetching": "Получение данных репозитория",
    "indexer.analyzing": "Анализ кодовой базы",
    "indexer.generating": "Генерация README",
    "indexer.analysisComplete": "Анализ завершён",
    "indexer.techStack": "Технологии",
    "indexer.keyFeatures": "Основные функции",
    "indexer.projectStructure": "Структура проекта",
    "indexer.generatedReadme": "Сгенерированный README.md",
    "indexer.copy": "Копировать",
    "indexer.repoUrlRequired": "Требуется URL репозитория",
    "indexer.repoUrlRequiredDesc": "Пожалуйста, введите корректный URL репозитория GitLab или GitHub.",
    "indexer.indexedSuccess": "Репозиторий успешно проиндексирован",
    "indexer.indexedSuccessDesc": "Файл README создан на основе анализа репозитория.",
    "indexer.indexFailed": "Не удалось проиндексировать репозиторий",
    "indexer.copiedToClipboard": "Скопировано в буфер обмена",
    "indexer.copiedDesc": "Содержимое README скопировано.",
    
    // Merge Review
    "review.title": "Проверка Merge Request",
    "review.description": "Анализируйте merge request на соответствие вашему стилю кода и лучшим практикам.",
    "review.config": "Настройки проверки",
    "review.configDesc": "Введите URL merge request для автоматической проверки кода.",
    "review.mrUrl": "URL Merge Request",
    "review.mrUrlPlaceholder": "https://gitlab.com/group/project/-/merge_requests/123",
    "review.accessToken": "Токен доступа",
    "review.forPrivateRepos": "(для приватных репозиториев)",
    "review.tokenPlaceholder": "glpat-xxxx",
    "review.analyzing": "Анализ кода...",
    "review.startReview": "Начать проверку",
    "review.filesChanged": "Изменено файлов",
    "review.linesAdded": "Добавлено строк",
    "review.linesRemoved": "Удалено строк",
    "review.issuesFound": "Найдено проблем",
    "review.all": "Все",
    "review.errors": "Ошибки",
    "review.warnings": "Предупреждения",
    "review.passed": "Успешно",
    "review.failed": "Провалено",
    "review.mrUrlRequired": "Требуется URL Merge Request",
    "review.mrUrlRequiredDesc": "Пожалуйста, введите корректный URL merge request GitLab или GitHub.",
    "review.reviewComplete": "Проверка кода завершена",
    "review.reviewCompleteDesc": "Найдено {count} проблем, требующих внимания.",
    "review.reviewFailed": "Не удалось проверить merge request",
    "review.emailSent": "Email уведомление отправлено",
    "review.emailSentDesc": "Сводка проверки отправлена на вашу почту.",
    "review.emailFailed": "Не удалось отправить email",
  },
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>("en");

  const toggleLanguage = () => {
    setLanguage((prev) => (prev === "en" ? "ru" : "en"));
  };

  const t = (key: string): string => {
    return translations[language][key] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, toggleLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
}
