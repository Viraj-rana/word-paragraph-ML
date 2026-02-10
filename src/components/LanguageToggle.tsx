import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Languages } from "lucide-react";

export function LanguageToggle() {
  const { language, toggleLanguage } = useLanguage();

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleLanguage}
      className="fixed top-4 right-16 z-50 h-9 w-9 rounded-full bg-secondary/80 backdrop-blur-sm hover:bg-secondary"
      title={language === "en" ? "Switch to Russian" : "Переключить на английский"}
    >
      <span className="text-xs font-bold uppercase">
        {language === "en" ? "RU" : "EN"}
      </span>
      <span className="sr-only">Toggle language</span>
    </Button>
  );
}
