import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

interface ReviewIssue {
  id: string;
  file: string;
  line: number;
  severity: "error" | "warning" | "info";
  message: string;
  rule: string;
  suggestion?: string;
}

interface ReviewEmailRequest {
  recipientEmail: string;
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

const getStatusColor = (status: string): string => {
  switch (status) {
    case "passed":
      return "#22c55e";
    case "warnings":
      return "#f59e0b";
    case "failed":
      return "#ef4444";
    default:
      return "#6b7280";
  }
};

const getStatusEmoji = (status: string): string => {
  switch (status) {
    case "passed":
      return "✅";
    case "warnings":
      return "⚠️";
    case "failed":
      return "❌";
    default:
      return "📋";
  }
};

const getSeverityColor = (severity: string): string => {
  switch (severity) {
    case "error":
      return "#ef4444";
    case "warning":
      return "#f59e0b";
    case "info":
      return "#3b82f6";
    default:
      return "#6b7280";
  }
};

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const data: ReviewEmailRequest = await req.json();
    const {
      recipientEmail,
      mrTitle,
      mrUrl,
      author,
      filesChanged,
      linesAdded,
      linesRemoved,
      reviewTime,
      status,
      issues,
      summary,
    } = data;

    const errorCount = issues.filter((i) => i.severity === "error").length;
    const warningCount = issues.filter((i) => i.severity === "warning").length;
    const infoCount = issues.filter((i) => i.severity === "info").length;

    const statusColor = getStatusColor(status);
    const statusEmoji = getStatusEmoji(status);

    const issuesHtml = issues
      .slice(0, 10)
      .map(
        (issue) => `
        <tr>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">
            <span style="display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; color: white; background-color: ${getSeverityColor(issue.severity)};">
              ${issue.severity.toUpperCase()}
            </span>
          </td>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; font-family: monospace; font-size: 13px; color: #6366f1;">
            ${issue.file}:${issue.line}
          </td>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; font-size: 14px; color: #374151;">
            ${issue.message}
            ${issue.suggestion ? `<br><span style="color: #6b7280; font-size: 12px;">💡 ${issue.suggestion}</span>` : ""}
          </td>
        </tr>
      `
      )
      .join("");

    const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Merge Request Review Summary</title>
      </head>
      <body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 40px 20px;">
          <tr>
            <td align="center">
              <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                <!-- Header -->
                <tr>
                  <td style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); padding: 30px; border-radius: 12px 12px 0 0;">
                    <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700;">
                      ${statusEmoji} Code Review Complete
                    </h1>
                    <p style="color: #a5b4fc; margin: 10px 0 0 0; font-size: 14px;">
                      Automated review for your merge request
                    </p>
                  </td>
                </tr>
                
                <!-- MR Title & Author -->
                <tr>
                  <td style="padding: 25px 30px 15px 30px;">
                    <h2 style="margin: 0 0 10px 0; font-size: 20px; color: #1f2937;">
                      ${mrTitle}
                    </h2>
                    <p style="margin: 0; color: #6b7280; font-size: 14px;">
                      👤 Author: <strong>${author}</strong> &nbsp;|&nbsp; ⏱️ Review time: ${reviewTime}
                    </p>
                  </td>
                </tr>
                
                <!-- Status Badge -->
                <tr>
                  <td style="padding: 0 30px 20px 30px;">
                    <span style="display: inline-block; padding: 8px 16px; border-radius: 20px; font-size: 14px; font-weight: 600; color: white; background-color: ${statusColor};">
                      ${status.toUpperCase()}
                    </span>
                  </td>
                </tr>
                
                <!-- Stats -->
                <tr>
                  <td style="padding: 0 30px 25px 30px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td width="33%" style="background-color: #f9fafb; padding: 15px; text-align: center; border-radius: 8px 0 0 8px;">
                          <p style="margin: 0; font-size: 24px; font-weight: 700; color: #374151;">${filesChanged}</p>
                          <p style="margin: 5px 0 0 0; font-size: 12px; color: #6b7280;">Files Changed</p>
                        </td>
                        <td width="33%" style="background-color: #ecfdf5; padding: 15px; text-align: center;">
                          <p style="margin: 0; font-size: 24px; font-weight: 700; color: #22c55e;">+${linesAdded}</p>
                          <p style="margin: 5px 0 0 0; font-size: 12px; color: #6b7280;">Added</p>
                        </td>
                        <td width="33%" style="background-color: #fef2f2; padding: 15px; text-align: center; border-radius: 0 8px 8px 0;">
                          <p style="margin: 0; font-size: 24px; font-weight: 700; color: #ef4444;">-${linesRemoved}</p>
                          <p style="margin: 5px 0 0 0; font-size: 12px; color: #6b7280;">Removed</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                
                <!-- Issues Summary -->
                <tr>
                  <td style="padding: 0 30px 20px 30px;">
                    <table width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #e5e7eb; border-radius: 8px;">
                      <tr>
                        <td width="33%" style="padding: 12px; text-align: center; border-right: 1px solid #e5e7eb;">
                          <span style="font-size: 20px; font-weight: 700; color: #ef4444;">${errorCount}</span>
                          <span style="font-size: 13px; color: #6b7280;"> Errors</span>
                        </td>
                        <td width="33%" style="padding: 12px; text-align: center; border-right: 1px solid #e5e7eb;">
                          <span style="font-size: 20px; font-weight: 700; color: #f59e0b;">${warningCount}</span>
                          <span style="font-size: 13px; color: #6b7280;"> Warnings</span>
                        </td>
                        <td width="33%" style="padding: 12px; text-align: center;">
                          <span style="font-size: 20px; font-weight: 700; color: #3b82f6;">${infoCount}</span>
                          <span style="font-size: 13px; color: #6b7280;"> Info</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                
                <!-- Summary -->
                <tr>
                  <td style="padding: 0 30px 25px 30px;">
                    <h3 style="margin: 0 0 10px 0; font-size: 16px; color: #374151;">Summary</h3>
                    <p style="margin: 0; padding: 15px; background-color: #f9fafb; border-radius: 8px; font-size: 14px; color: #4b5563; line-height: 1.6;">
                      ${summary}
                    </p>
                  </td>
                </tr>
                
                ${
                  issues.length > 0
                    ? `
                <!-- Issues Table -->
                <tr>
                  <td style="padding: 0 30px 25px 30px;">
                    <h3 style="margin: 0 0 15px 0; font-size: 16px; color: #374151;">
                      Issues Found ${issues.length > 10 ? `(showing 10 of ${issues.length})` : ""}
                    </h3>
                    <table width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
                      <tr style="background-color: #f9fafb;">
                        <th style="padding: 10px 12px; text-align: left; font-size: 12px; font-weight: 600; color: #6b7280; text-transform: uppercase;">Severity</th>
                        <th style="padding: 10px 12px; text-align: left; font-size: 12px; font-weight: 600; color: #6b7280; text-transform: uppercase;">Location</th>
                        <th style="padding: 10px 12px; text-align: left; font-size: 12px; font-weight: 600; color: #6b7280; text-transform: uppercase;">Message</th>
                      </tr>
                      ${issuesHtml}
                    </table>
                  </td>
                </tr>
                `
                    : ""
                }
                
                <!-- Action Buttons -->
                <tr>
                  <td style="padding: 0 30px 30px 30px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td align="center" style="padding-right: 10px;">
                          <a href="${mrUrl}" style="display: inline-block; padding: 14px 28px; background-color: #22c55e; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px;">
                            ✅ Approve & Merge
                          </a>
                        </td>
                        <td align="center" style="padding-left: 10px;">
                          <a href="${mrUrl}" style="display: inline-block; padding: 14px 28px; background-color: #ef4444; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px;">
                            ❌ Request Changes
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                
                <!-- Footer -->
                <tr>
                  <td style="padding: 20px 30px; background-color: #f9fafb; border-radius: 0 0 12px 12px; text-align: center;">
                    <p style="margin: 0; font-size: 12px; color: #9ca3af;">
                      This is an automated code review notification.
                      <br>
                      <a href="${mrUrl}" style="color: #6366f1;">View full merge request →</a>
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
    `;

    // Send email via Resend API
    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      // Note: Resend testing mode only allows sending to the verified account email
      // To send to other recipients, verify a domain at resend.com/domains
      body: JSON.stringify({
        from: "Code Review <onboarding@resend.dev>",
        to: ["hackteck278@gmail.com"],
        subject: `${statusEmoji} Code Review: ${mrTitle} - ${status.toUpperCase()}`,
        html,
      }),
    });

    if (!emailResponse.ok) {
      const errorText = await emailResponse.text();
      throw new Error(`Failed to send email: ${errorText}`);
    }

    const result = await emailResponse.json();
    console.log("Email sent successfully:", result);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in send-review-email function:", errorMessage);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
