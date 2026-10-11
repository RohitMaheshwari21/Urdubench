import type { Metadata } from "next";
import { Prose } from "@/components/prose";
import { GITHUB_URL } from "@/lib/data";

export const metadata: Metadata = {
  title: "Privacy",
  description: "What this website does and does not collect.",
};

export default function Privacy() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Privacy</h1>
      <Prose>
        <h2>Today</h2>
        <p>This website is static. In its current form:</p>
        <ul>
          <li>It has no accounts, forms, comments or search that is sent to a server.</li>
          <li>It sets no cookies and uses no analytics or advertising trackers.</li>
          <li>
            Fonts are served from this site itself, not from Google&apos;s servers, so your browser does not contact a
            font provider.
          </li>
          <li>
            Filters and sorting on the leaderboard and explorer run in your browser; nothing you type is sent anywhere.
          </li>
        </ul>
        <p>
          The hosting service (Vercel) may keep ordinary server logs of requests (for example IP address and browser
          type) under its own policy. We do not use them to identify anyone.
        </p>

        <h2>What the data on this site contains</h2>
        <p>
          Benchmark questions and model answers only. The questions are written for the benchmark and contain no real
          people&apos;s data. No user text is stored.
        </p>

        <h2>Before new features launch</h2>
        <p>
          A model arena, a quiz and a WhatsApp bot are planned. Before any of them goes live, this page will be updated to
          say exactly what is stored. The intended design is minimal: no raw message text kept long term, a hashed
          identifier instead of a phone number, anonymous votes, and a command to delete your data.
        </p>

        <h2 lang="ur" dir="rtl" className="urdu">
          مختصر اردو خلاصہ
        </h2>
        <p lang="ur" dir="rtl" className="urdu">
          یہ ویب سائٹ فی الحال کوئی ذاتی معلومات جمع نہیں کرتی۔ اس میں کوئی اکاؤنٹ، کوکیز یا اشتہاری ٹریکنگ نہیں ہے۔
          ہوسٹنگ سروس عام سرور لاگز رکھ سکتی ہے۔ مستقبل میں کوئز یا واٹس ایپ جیسی سہولتیں شامل ہوں تو اس صفحے کو پہلے
          اپ ڈیٹ کیا جائے گا۔
        </p>

        <h2>Contact</h2>
        <p>
          Questions or removal requests: open an issue at <a href={`${GITHUB_URL}/issues`}>GitHub</a>.
        </p>
      </Prose>
    </div>
  );
}
