

## Fix Telegram Notification and Add Auto-Review

### What's Changing

Two fixes to the Merge Review page. Nothing else in the app will be touched.

---

### 1. Fix Broken Telegram Notification

**Problem:** The `sendTelegramNotification` function (lines 173-216) uses `import.meta.env.REACT_APP_BACKEND_URL` and a `fetch()` call to `/api/send-telegram-notification`. This never works because that env variable doesn't exist in this project.

**Fix:** Replace the broken `fetch()` call with `supabase.functions.invoke("send-telegram-notification", { body: {...} })` -- the exact same pattern already used by `sendEmailNotification` on lines 134-171. The edge function already exists and the secrets (`TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`) are already configured.

---

### 2. Auto-Review Most Recent MR on Load

**Problem:** When tokens are saved, open MRs are fetched automatically, but the user still has to manually click one and start the review.

**Fix:** After `fetchOpenMRs` returns results for the first time:
- Automatically select the first (most recent) MR
- Trigger `handleReview()` on it
- Use a `useRef` flag (`hasAutoReviewed`) to prevent re-triggering on manual refresh
- All existing manual functionality (paste URL, click review, select from list) stays exactly the same

---

### Technical Details

**File:** `frontend/src/pages/MergeReview.tsx`

**Change 1 -- Lines 173-216:** Replace `sendTelegramNotification` body:
```typescript
const sendTelegramNotification = async (reviewData: ReviewResult) => {
  setIsSendingTelegram(true);
  try {
    const { error } = await supabase.functions.invoke("send-telegram-notification", {
      body: {
        mrTitle: reviewData.mrTitle,
        mrUrl: mrUrl,
        author: reviewData.author,
        filesChanged: reviewData.filesChanged,
        linesAdded: reviewData.linesAdded,
        linesRemoved: reviewData.linesRemoved,
        reviewTime: reviewData.reviewTime,
        status: reviewData.status,
        issues: reviewData.issues,
        summary: reviewData.summary,
      },
    });

    if (error) {
      throw new Error(error.message || "Failed to send Telegram notification");
    }

    toast({
      title: "Telegram notification sent",
      description: "Review summary has been sent to your Telegram group.",
    });
  } catch (error) {
    console.error("Error sending Telegram notification:", error);
    toast({
      title: "Telegram notification failed",
      description: error instanceof Error ? error.message : "An unexpected error occurred",
      variant: "destructive",
    });
  } finally {
    setIsSendingTelegram(false);
  }
};
```

**Change 2 -- Add `useRef` import and auto-review logic:**
- Import `useRef` alongside existing `useState, useEffect`
- Add `const hasAutoReviewed = useRef(false);`
- After `fetchOpenMRs` succeeds and sets `openMRs`, add a `useEffect` that watches `openMRs`: if MRs exist and `hasAutoReviewed.current` is false, set `mrUrl` to the first MR's URL, set the flag to true, and call `handleReview()`

**No other files will be changed.**
