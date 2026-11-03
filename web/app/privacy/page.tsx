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

        <h2>Ask (question answering)</h2>
        <p>Questions typed on the Ask page are not stored by us and are not linked to the cookie. To answer one:</p>
        <ul>
          <li>
            The question is sent to Google&apos;s Gemini API (free tier) to find matching passages. Google says it may
            use free-tier content to improve its products.
          </li>
          <li>The question and the matching passages are sent to Groq to write the answer.</li>
          <li>
            The answer is cached for up to 24 hours under a one-way hash of the question. Rate-limit counters work as
            above.
          </li>
        </ul>
        <p>Answers come from Urdu Wikipedia (CC BY-SA 4.0) with links to the articles used.</p>

        <h2>Hosting</h2>
        <p>
          The hosting service (Vercel) may keep ordinary server logs of requests (for example IP address and browser
          type) under its own policy. We do not use them to identify anyone.
        </p>

        <h2>WhatsApp bot</h2>
        <ul>
          <li>
            Your phone number is turned into a salted one-way hash. Only that hash, your chosen language, the quiz
            question you are answering and your score are stored. Nothing is stored if you only read the help text.
          </li>
          <li>Message text is never stored or logged. Message ids are kept for 2 days to avoid answering twice.</li>
          <li>
            Messages starting with <code>ask</code> are handled like the Ask page above (sent to Google and Groq, not
            stored).
          </li>
          <li>
            Send <strong>stop</strong> at any time to delete everything stored for your number. The bot only replies
            to you and never messages you first.
          </li>
          <li>WhatsApp (Meta) handles the messages themselves under its own terms.</li>
        </ul>

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
