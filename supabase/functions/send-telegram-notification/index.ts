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

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildTelegramMessage(data: TelegramNotificationRequest): string {
  const statusEmoji = getStatusEmoji(data.status);
  const statusText = data.status.charAt(0).toUpperCase() + data.status.slice(1);

  const errorCount = data.issues.filter(i => i.severity === "error").length;
  const warningCount = data.issues.filter(i => i.severity === "warning").length;
  const infoCount = data.issues.filter(i => i.severity === "info").length;

  let message = `${statusEmoji} <b>Code Review Complete</b>\n\n`;
  message += `📝 <b>MR:</b> ${escapeHtml(data.mrTitle)}\n`;
  message += `👤 <b>Author:</b> ${escapeHtml(data.author)}\n`;
  message += `📊 <b>Status:</b> ${statusText}\n\n`;

  message += `📁 <b>Stats:</b>\n`;
  message += `• Files Changed: ${data.filesChanged}\n`;
  message += `• Lines Added: +${data.linesAdded}\n`;
  message += `• Lines Removed: -${data.linesRemoved}\n`;
  message += `• Review Time: ${escapeHtml(data.reviewTime)}\n\n`;

  if (data.issues.length > 0) {
    message += `🔍 <b>Issues Found:</b>\n`;
    message += `• 🔴 Errors: ${errorCount}\n`;
    message += `• 🟡 Warnings: ${warningCount}\n`;
    message += `• 🔵 Info: ${infoCount}\n\n`;

    const topIssues = data.issues.slice(0, 5);
    message += `📋 <b>Top Issues:</b>\n`;
    topIssues.forEach((issue, index) => {
      const emoji = getSeverityEmoji(issue.severity);
      message += `${index + 1}. ${emoji} <code>${escapeHtml(issue.file)}:${issue.line}</code>\n`;
      const shortMessage = issue.message.length > 80
        ? issue.message.substring(0, 80) + "..."
        : issue.message;
      message += `   ${escapeHtml(shortMessage)}\n`;
    });

    if (data.issues.length > 5) {
      message += `\n<i>... and ${data.issues.length - 5} more issues</i>\n`;
    }
  }

  message += `\n💡 <b>Summary:</b>\n${escapeHtml(data.summary)}\n\n`;
  message += `🔗 <a href="${escapeHtml(data.mrUrl)}">View Merge Request</a>`;

  return message;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
    const TELEGRAM_CHAT_ID = Deno.env.get("TELEGRAM_CHAT_ID");

    if (!TELEGRAM_BOT_TOKEN || TELEGRAM_BOT_TOKEN === "") {
      console.error("TELEGRAM_BOT_TOKEN is not configured");
      return new Response(
        JSON.stringify({
          error: "TELEGRAM_BOT_TOKEN is not configured in Supabase secrets",
          instructions: "Set it using: supabase secrets set TELEGRAM_BOT_TOKEN=your_bot_token"
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }

    if (!TELEGRAM_CHAT_ID || TELEGRAM_CHAT_ID === "") {
      console.error("TELEGRAM_CHAT_ID is not configured");
      return new Response(
        JSON.stringify({
          error: "TELEGRAM_CHAT_ID is not configured in Supabase secrets",
          instructions: "Set it using: supabase secrets set TELEGRAM_CHAT_ID=your_chat_id"
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }

    const data: TelegramNotificationRequest = await req.json();

    console.log("Sending Telegram notification for MR:", data.mrTitle);
    console.log("Using chat ID:", TELEGRAM_CHAT_ID);

    let message: string;
    try {
      message = buildTelegramMessage(data);
      console.log("Message built successfully, length:", message.length);
    } catch (buildError) {
      console.error("Error building message:", buildError);
      throw new Error(`Failed to build message: ${buildError instanceof Error ? buildError.message : "Unknown error"}`);
    }

    const telegramUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;

    console.log("Sending to Telegram API...");
    const response = await fetch(telegramUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: message,
        parse_mode: "HTML",
        disable_web_page_preview: false,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      console.error("Telegram API error response:", JSON.stringify(result, null, 2));
      const errorMsg = result.description || result.error_code || "Unknown error";

      if (result.error_code === 400 && result.description?.includes("chat not found")) {
        throw new Error(`Invalid TELEGRAM_CHAT_ID. The bot cannot access chat: ${TELEGRAM_CHAT_ID}. Make sure to start the bot first by sending /start`);
      }

      if (result.error_code === 401) {
        throw new Error("Invalid TELEGRAM_BOT_TOKEN. Please check your bot token.");
      }

      throw new Error(`Telegram API error (${result.error_code}): ${errorMsg}`);
    }

    console.log("Telegram notification sent successfully! Message ID:", result.result?.message_id);

    return new Response(
      JSON.stringify({
        success: true,
        messageId: result.result?.message_id,
        chatId: TELEGRAM_CHAT_ID
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error sending Telegram notification:", errorMessage);

    return new Response(
      JSON.stringify({
        error: errorMessage,
        hint: "Check the function logs for more details"
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
