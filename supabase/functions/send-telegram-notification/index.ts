//added telegram notify code review result on bot detailed information about Review

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ReviewIssue {
  id: string;
  file: string;
  line: number;
  severity: "error" | "warning" | "info";
  message: string;
  rule: string;
  suggestion?: string;
}

interface TelegramNotificationRequest {
  mrTitle: string;
  mrUrl: string;
  author: string;
  filesChanged: number;
  linesAdded: number;
  linesRemoved: number;
  reviewTime: string;
  status: "passed" | "warnings" | "failed";
  issues: ReviewIssue[];
  summary: string;
}

function getStatusEmoji(status: string): string {
  switch (status) {
    case "passed": return "✅";
    case "warnings": return "⚠️";
    case "failed": return "❌";
    default: return "📋";
  }
}

function getSeverityEmoji(severity: string): string {
  switch (severity) {
    case "error": return "🔴";
    case "warning": return "🟡";
    case "info": return "🔵";
    default: return "⚪";
  }
}

function escapeMarkdown(text: string): string {
  // Escape special characters for Telegram MarkdownV2
  return text.replace(/[_*\[\]()~`>#+\-=|{}.!\\]/g, '\\$&');
}

function buildTelegramMessage(data: TelegramNotificationRequest): string {
  const statusEmoji = getStatusEmoji(data.status);
  const statusText = data.status.charAt(0).toUpperCase() + data.status.slice(1);
  
  const errorCount = data.issues.filter(i => i.severity === "error").length;
  const warningCount = data.issues.filter(i => i.severity === "warning").length;
  const infoCount = data.issues.filter(i => i.severity === "info").length;

  let message = `${statusEmoji} *Code Review Complete*\n\n`;
  message += `📝 *MR:* ${escapeMarkdown(data.mrTitle)}\n`;
  message += `👤 *Author:* ${escapeMarkdown(data.author)}\n`;
  message += `📊 *Status:* ${statusText}\n\n`;
  
  message += `📁 *Stats:*\n`;
  message += `• Files Changed: ${data.filesChanged}\n`;
  message += `• Lines Added: \\+${data.linesAdded}\n`;
  message += `• Lines Removed: \\-${data.linesRemoved}\n`;
  message += `• Review Time: ${escapeMarkdown(data.reviewTime)}\n\n`;
  
  if (data.issues.length > 0) {
    message += `🔍 *Issues Found:*\n`;
    message += `• 🔴 Errors: ${errorCount}\n`;
    message += `• 🟡 Warnings: ${warningCount}\n`;
    message += `• 🔵 Info: ${infoCount}\n\n`;
    
    // Show top 5 issues
    const topIssues = data.issues.slice(0, 5);
    message += `📋 *Top Issues:*\n`;
    topIssues.forEach((issue, index) => {
      const emoji = getSeverityEmoji(issue.severity);
      message += `${index + 1}\\. ${emoji} ${escapeMarkdown(issue.file)}:${issue.line}\n`;
      message += `   ${escapeMarkdown(issue.message)}\n`;
    });
    
    if (data.issues.length > 5) {
      message += `\n_\\.\\.\\. and ${data.issues.length - 5} more issues_\n`;
    }
  }
  
  message += `\n💡 *Summary:*\n${escapeMarkdown(data.summary)}\n\n`;
  message += `🔗 [View Merge Request](${data.mrUrl})`;
  
  return message;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
    const TELEGRAM_CHAT_ID = Deno.env.get("TELEGRAM_CHAT_ID");

    if (!TELEGRAM_BOT_TOKEN) {
      throw new Error("TELEGRAM_BOT_TOKEN is not configured");
    }

    if (!TELEGRAM_CHAT_ID) {
      throw new Error("TELEGRAM_CHAT_ID is not configured");
    }

    const data: TelegramNotificationRequest = await req.json();

    console.log("Sending Telegram notification for MR:", data.mrTitle);

    const message = buildTelegramMessage(data);

    const telegramUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    
    const response = await fetch(telegramUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: message,
        parse_mode: "MarkdownV2",
        disable_web_page_preview: false,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      console.error("Telegram API error:", result);
      throw new Error(`Telegram API error: ${result.description || "Unknown error"}`);
    }

    console.log("Telegram notification sent successfully:", result.result?.message_id);

    return new Response(
      JSON.stringify({ success: true, messageId: result.result?.message_id }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error sending Telegram notification:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
