import type { Metadata } from "next";
import { DeleteMyData } from "@/components/delete-my-data";
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
        <h2>Reading the site</h2>
        <ul>
          <li>The leaderboard, explorer and text pages are static. Filters and sorting run in your browser.</li>
          <li>There are no accounts, analytics or advertising trackers.</li>
          <li>Fonts are served from this site itself, so your browser does not contact a font provider.</li>
        </ul>

        <h2>Arena and quiz</h2>
        <p>
          When you use the arena or the quiz, the site sets one cookie (<code>ub_uid</code>) holding a random id. It
          is not linked to your name, email or phone. Under that id we store:
        </p>
        <ul>
          <li>Arena: which two models answered, which one you preferred, and how many characters your question had.</li>
          <li>Quiz: which question you answered and whether you were right.</li>
        </ul>
        <p>We never store the text of your arena question. To answer it:</p>
        <ul>
          <li>
            The question is sent to the model provider (Groq) under its API terms. Please do not type personal
            details.
          </li>
          <li>
            The two answers are kept in a short-term cache for up to 24 hours, filed under a one-way hash of the
            question, so a repeated question does not cost another model call.
          </li>
          <li>
            For rate limits we count requests per salted hash of your IP address, in counters that expire within a day.
            The IP address itself is not stored.
          </li>
        </ul>
        <p>Arena answers are general information only, not medical, legal or financial advice.</p>
        <p>
          The published arena ranking contains only totals per model. You can delete everything stored under your
          browser&apos;s id at any time:
        </p>
        <DeleteMyData />

        <h2>Hosting</h2>
        <p>
          The hosting service (Vercel) may keep ordinary server logs of requests (for example IP address and browser
          type) under its own policy. We do not use them to identify anyone.
        </p>

        <h2>Before new features launch</h2>
        <p>
          A WhatsApp bot is planned. Before it goes live this page will say exactly what it stores. The intended design:
          a hashed identifier instead of a phone number, no message text kept long term, and a STOP command that deletes
          your data.
        </p>

        <h2 lang="ur" dir="rtl" className="urdu">
          مختصر اردو خلاصہ
        </h2>
        <p lang="ur" dir="rtl" className="urdu">
          ہم آپ کا نام، ای میل یا فون نمبر جمع نہیں کرتے۔ آرینا اور کوئز کے لیے ایک بے نام کوکی رکھی جاتی ہے جس کے تحت صرف
          آپ کا ووٹ اور کوئز کے جواب کا صحیح یا غلط ہونا محفوظ ہوتا ہے۔ آپ کے سوال کا متن محفوظ نہیں کیا جاتا۔ آپ اوپر
          دیے گئے بٹن سے اپنا تمام ڈیٹا کسی بھی وقت مٹا سکتے ہیں۔
        </p>

        <h2>Contact</h2>
        <p>
          Questions or removal requests: open an issue at <a href={`${GITHUB_URL}/issues`}>GitHub</a>.
        </p>
      </Prose>
    </div>
  );
}
